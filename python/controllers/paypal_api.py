import flask
import requests
from db_config import get_connection

paypal_bp = flask.Blueprint('paypal_bp', __name__)

# ── PayPal Sandbox credentials ──────────────────────────────────
# Replace these with your own sandbox credentials from
# https://developer.paypal.com/dashboard/applications/sandbox
PAYPAL_CLIENT_ID = "AXKA7gPB2A_t8SHI2C8RtNsLOfE2dbh-5tTgmyP9uWR9an4hHdG2Qjxm0eJaqhabjC-Kbl3NFvZXRhVq"
PAYPAL_SECRET = "EHErQ5frVfI8DPYYpUx8DyKSQ8doQUCVzobsdhOUa5DFFGms5k1GP0YvBTlUQr5LJqxNYotSUKbc7het"
PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"


@paypal_bp.route('/client-id', methods=['GET'])
def get_client_id():
    """Return the PayPal client ID to the frontend."""
    return flask.jsonify({"clientId": PAYPAL_CLIENT_ID}), 200


def _get_access_token():
    """Get an OAuth 2.0 access token from PayPal."""
    res = requests.post(
        f"{PAYPAL_BASE_URL}/v1/oauth2/token",
        auth=(PAYPAL_CLIENT_ID, PAYPAL_SECRET),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "client_credentials"},
        timeout=15,
    )
    res.raise_for_status()
    return res.json()["access_token"]


# ── 1. Create a PayPal order from cart items (no DB bill yet) ──

@paypal_bp.route('/create-order', methods=['POST'])
def create_order():
    """
    Expects JSON: { "CustomerID": "...", "items": [{"ProductVariantID": "...", "Num": 1}] }
    Looks up current prices from DB, creates a PayPal order.
    No bill is written to the DB at this stage.
    """
    try:
        cus_id = flask.request.json.get("CustomerID")
        items  = flask.request.json.get("items", [])

        if not cus_id or not items:
            return flask.jsonify({"error": "CustomerID and items are required"}), 400

        # Look up prices and calculate total in VND
        db_conn = get_connection()
        cursor = db_conn.cursor()
        total_vnd = 0.0
        for item in items:
            variant_id = item.get("ProductVariantID")
            num = item.get("Num", 0)
            cursor.execute("SELECT SellingPrice FROM ProductVariant WHERE ProductVariantID = ?", (variant_id,))
            row = cursor.fetchone()
            if not row:
                cursor.close()
                return flask.jsonify({"error": f"Product '{variant_id}' not found"}), 404
            total_vnd += float(row[0]) * num
        cursor.close()

        if total_vnd <= 0:
            return flask.jsonify({"error": "Order total must be greater than 0"}), 400

        usd_total = f"{total_vnd / 25000:.2f}"

        token = _get_access_token()
        res = requests.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders",
            json={
                "intent": "CAPTURE",
                "purchase_units": [{
                    "description": "CellTech Order",
                    "amount": {"currency_code": "USD", "value": usd_total},
                }],
            },
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=15,
        )
        res.raise_for_status()
        return flask.jsonify({"orderID": res.json()["id"]}), 200

    except requests.exceptions.HTTPError as http_err:
        return flask.jsonify({"error": str(http_err), "details": http_err.response.text}), 502
    except Exception as e:
        import traceback
        traceback.print_exc()
        return flask.jsonify({"error": str(e)}), 500


# ── 2. Capture PayPal order → create confirmed bill atomically ──

@paypal_bp.route('/capture-order', methods=['POST'])
def capture_order():
    """
    Expects JSON: { "orderID": "...", "CustomerID": "...", "items": [{"ProductVariantID": "...", "Num": 1}] }
    Captures the PayPal payment, then creates bill + details + deducts stock in one transaction.
    No Pending state used.
    """
    try:
        order_id = flask.request.json.get("orderID")
        cus_id   = flask.request.json.get("CustomerID")
        items    = flask.request.json.get("items", [])

        if not order_id or not cus_id or not items:
            return flask.jsonify({"error": "orderID, CustomerID and items are required"}), 400

        # Capture the PayPal payment first
        token = _get_access_token()
        res = requests.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=15,
        )
        res.raise_for_status()
        capture_data = res.json()

        if capture_data.get("status") != "COMPLETED":
            return flask.jsonify({"error": "Payment not completed", "details": capture_data}), 400

        # Payment confirmed — create bill + details + deduct stock atomically
        import uuid as _uuid
        from db_config import generate_new_id as _gen_id

        db_conn = get_connection()
        cursor = db_conn.cursor()

        # Validate stock before writing anything
        for item in items:
            variant_id = item.get("ProductVariantID")
            num = item.get("Num", 0)
            cursor.execute("SELECT StockQuantity FROM ProductVariant WHERE ProductVariantID = ?", (variant_id,))
            row = cursor.fetchone()
            if not row or row[0] < num:
                db_conn.rollback()
                cursor.close()
                return flask.jsonify({"error": f"Product '{variant_id}' out of stock"}), 400

        bill_id = _gen_id(cursor, "Bill", "BillID", "BILL")
        cursor.execute(
            "INSERT INTO Bill(BillID, CustomerID, EmployeeID, TotalPrice, PayMethod, Status) VALUES (?, ?, ?, ?, ?, ?)",
            (bill_id, cus_id, None, 0, 'PayPal', 'Confirmed')
        )

        for item in items:
            variant_id = item.get("ProductVariantID")
            num = item.get("Num", 0)
            bd_id = "BD_" + str(_uuid.uuid4())[:6]

            cursor.execute("SELECT SellingPrice FROM ProductVariant WHERE ProductVariantID = ?", (variant_id,))
            price = cursor.fetchone()[0]

            cursor.execute(
                "INSERT INTO BillDetail(BillDetailID, BillID, ProductVariantID, Num, Price) VALUES (?, ?, ?, ?, ?)",
                (bd_id, bill_id, variant_id, num, price)
            )
            cursor.execute(
                "UPDATE Bill SET TotalPrice = TotalPrice + (? * ?) WHERE BillID = ?",
                (price, num, bill_id)
            )
            cursor.execute(
                "UPDATE ProductVariant SET StockQuantity = StockQuantity - ? WHERE ProductVariantID = ?",
                (num, variant_id)
            )

        db_conn.commit()
        cursor.close()

        return flask.jsonify({
            "success": True,
            "message": "Payment captured and order confirmed",
            "BillID": bill_id,
        }), 200

    except requests.exceptions.HTTPError as http_err:
        return flask.jsonify({"error": str(http_err), "details": http_err.response.text}), 502
    except Exception as e:
        if 'db_conn' in locals():
            db_conn.rollback()
        import traceback
        traceback.print_exc()
        return flask.jsonify({"error": str(e)}), 500

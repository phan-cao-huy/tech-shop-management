import flask
import uuid
from db_config import get_connection, get_json_results, generate_new_id

bill_bp = flask.Blueprint('bill_bp', __name__)

@bill_bp.route('/getall', methods = ['GET'])
def get_all_bills():
    db_conn = get_connection()
    cursor = db_conn.cursor()
    try:
        query = """
            SELECT 
                b.*, 
                c.FullName AS CustomerName, 
                c.Phone AS CustomerPhone,
                c.Address AS CustomerAddress,
                e.FullName AS EmployeeName
            FROM Bill b
            LEFT JOIN Customer c ON b.CustomerID = c.CustomerID
            LEFT JOIN Employee e ON b.EmployeeID = e.EmployeeID
            ORDER BY b.BillID DESC
        """
        cursor.execute(query)
        bills = get_json_results(cursor)

        for b in bills:
            if b.get('TotalPrice') is not None:
                b['TotalPrice'] = float(b['TotalPrice'])

        cursor.close()
        return flask.jsonify(bills), 200

    except Exception as e:
        if cursor: cursor.close()
        return flask.jsonify({"error": str(e)}), 500

@bill_bp.route('/<id>', methods = ['GET'])
def get_bill(id):
    db_conn = get_connection()
    cursor = db_conn.cursor()
    cursor.execute('select * from Bill where BillID = ?', (id,))
    return flask.jsonify(get_json_results(cursor)), 200

@bill_bp.route('/add', methods = ['POST'])
def create_bill():
    try:
        db_conn = get_connection()
        cursor = db_conn.cursor()
        bill_id = generate_new_id(cursor, "Bill", "BillID", "BILL")
        cus_id = flask.request.json.get("CustomerID")
        emp_id = flask.request.json.get("EmployeeID")
        payment_method = flask.request.json.get("PaymentMethod")
        status = flask.request.json.get("Status", "Pending")
        total = flask.request.json.get("TotalPrice", 0)
        db_conn = get_connection()
        cursor = db_conn.cursor()
        if cus_id:
            cursor.execute("SELECT CustomerID FROM Customer WHERE CustomerID = ?", (cus_id,))
            if not cursor.fetchone():
                return flask.jsonify({"mess": f"Lỗi: Khách hàng mang mã '{cus_id}' không tồn tại!"}), 400

        if emp_id:
            cursor.execute("SELECT EmployeeID FROM Employee WHERE EmployeeID = ?", (emp_id,))
        sql = "insert into Bill(BillID, CustomerID, EmployeeID, TotalPrice, PayMethod, Status) values (?, ?, ?, ?, ?, ?)"
        cursor.execute(sql, (bill_id, cus_id, emp_id, total, payment_method, status))
        db_conn.commit()
        return flask.jsonify({"mess": "Bill created successfully",
                              "BillID": bill_id}), 200
    except Exception as e:
        db_conn.rollback()
        return flask.jsonify({"error": str(e)}), 500
@bill_bp.route('/bill-details/get/<BillID>', methods=['GET'])
def get_bill_details(BillID):
    db_conn = get_connection()
    cursor = db_conn.cursor()
    try:
        query = """
            SELECT 
                bd.*, 
                p.ProductName, 
                pv.Color, 
                pv.Image,
                pv.Version AS VariantVersion
            FROM BillDetail bd
            LEFT JOIN ProductVariant pv ON bd.ProductVariantID = pv.ProductVariantID
            LEFT JOIN Product p ON pv.ProductID = p.ProductID
            WHERE bd.BillID = ?
        """
        cursor.execute(query, (BillID,))
        details = get_json_results(cursor)

        if not details:
            cursor.close()
            return flask.jsonify([]), 200

        # Ép kiểu dữ liệu (Decimal sang Float) để JSON không bị lỗi
        for d in details:
            if d.get('Price') is not None:
                d['Price'] = float(d['Price'])
            if d.get('Num') is not None:
                d['Num'] = int(d['Num'])

        cursor.close()
        return flask.jsonify(details), 200

    except Exception as e:
        if cursor: cursor.close()
        import traceback
        print(traceback.format_exc())
        return flask.jsonify({"error": str(e)}), 500


# ================= PAYMENT STATUS (for Transfer polling) =================

@bill_bp.route('/<id>/payment-status', methods=['GET'])
def payment_status(id):
    try:
        db_conn = get_connection()
        cursor = db_conn.cursor()
        cursor.execute("SELECT Status FROM Bill WHERE BillID = ?", (id,))
        row = cursor.fetchone()
        cursor.close()
        if not row:
            return flask.jsonify({"error": "Bill not found"}), 404
        return flask.jsonify({"Status": row[0]}), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500


# ================= LỘ TRÌNH VẬN HÀNH ĐƠN HÀNG =================

# 1. XÁC NHẬN ĐƠN (Pending -> Confirmed) - TRỪ KHO TẠI ĐÂY
@bill_bp.route('/<id>/confirm', methods=['POST'])
def confirm_bill(id):
    try:
        db_conn = get_connection()
        cursor = db_conn.cursor()

        cursor.execute("SELECT Status FROM Bill WHERE BillID = ?", (id,))
        status_row = cursor.fetchone()
        if not status_row or status_row[
            0] != 'Pending':  # Lưu ý: Khi tạo đơn mới ở /add, bạn nhớ đổi default Status thành 'Pending'
            return flask.jsonify({"mess": "Chỉ có thể xác nhận đơn ở trạng thái Pending!"}), 400

        # Kiểm tra và trừ tồn kho
        cursor.execute("SELECT ProductVariantID, Num FROM BillDetail WHERE BillID = ?", (id,))
        details = cursor.fetchall()
        for detail in details:
            variant_id, num_order = detail[0], detail[1]
            cursor.execute("SELECT StockQuantity FROM ProductVariant WHERE ProductVariantID = ?", (variant_id,))
            current_stock = cursor.fetchone()[0]

            if current_stock < num_order:
                return flask.jsonify({"mess": f"Sản phẩm {variant_id} không đủ tồn kho (Còn: {current_stock})"}), 400

            cursor.execute("UPDATE ProductVariant SET StockQuantity = StockQuantity - ? WHERE ProductVariantID = ?",
                           (num_order, variant_id))

        cursor.execute("UPDATE Bill SET Status = 'Confirmed' WHERE BillID = ?", (id,))
        db_conn.commit()
        return flask.jsonify({"mess": "Đã xác nhận đơn và trừ tồn kho thành công!"}), 200
    except Exception as e:
        db_conn.rollback()
        return flask.jsonify({"error": str(e)}), 500


# 2. ĐANG ĐÓNG GÓI (Confirmed -> Packaging)
@bill_bp.route('/<id>/packaging', methods=['POST'])
def packaging_bill(id):
    return update_bill_status(id, 'Confirmed', 'Packaging', "Đơn hàng đang được đóng gói!")


# 3. ĐÓNG GÓI XONG (Packaging -> Packaged)
@bill_bp.route('/<id>/packaged', methods=['POST'])
def packaged_bill(id):
    return update_bill_status(id, 'Packaging', 'Packaged', "Đã đóng gói xong, chờ bưu tá lấy hàng!")


# 4. ĐANG GIAO HÀNG (Packaged -> In_transit)
@bill_bp.route('/<id>/ship', methods=['POST'])
def ship_bill(id):
    return update_bill_status(id, 'Packaged', 'In_transit', "Đơn hàng đã được giao cho đơn vị vận chuyển!")


# 5. HOÀN THÀNH - GIAO HÀNG THÀNH CÔNG (In_transit -> Completed)
@bill_bp.route('/<id>/complete', methods=['POST'])
def complete_bill(id):
    return update_bill_status(id, 'In_transit', 'Completed', "Đơn hàng đã được giao thành công và hoàn thành!")


# Hàm Helper dùng chung để update các trạng thái không có logic phức tạp
def update_bill_status(bill_id, current_status, new_status, success_msg):
    try:
        db_conn = get_connection()
        cursor = db_conn.cursor()
        cursor.execute("SELECT Status FROM Bill WHERE BillID = ?", (bill_id,))
        status_row = cursor.fetchone()
        if not status_row or status_row[0] != current_status:
            return flask.jsonify({"mess": f"Chỉ có thể chuyển sang '{new_status}' từ '{current_status}'"}), 400

        cursor.execute("UPDATE Bill SET Status = ? WHERE BillID = ?", (new_status, bill_id))
        db_conn.commit()
        return flask.jsonify({"mess": success_msg}), 200
    except Exception as e:
        db_conn.rollback()
        return flask.jsonify({"error": str(e)}), 500


# 6. HỦY ĐƠN VÀ HOÀN TỒN KHO
@bill_bp.route('/<id>/cancel', methods=['POST'])
def cancel_bill(id):
    try:
        db_conn = get_connection()
        cursor = db_conn.cursor()
        cursor.execute("SELECT Status FROM Bill WHERE BillID = ?", (id,))
        status = cursor.fetchone()[0]

        if status in ('Cancelled', 'Completed'):
            return flask.jsonify({"mess": "Không thể hủy đơn hàng ở trạng thái này!"}), 400

        # Nếu đã qua bước Confirmed (tức là đã bị trừ kho) -> Phải hoàn lại kho
        if status not in ('Pending'):
            cursor.execute("SELECT ProductVariantID, Num FROM BillDetail WHERE BillID = ?", (id,))
            for val in cursor.fetchall():
                cursor.execute("UPDATE ProductVariant SET StockQuantity = StockQuantity + ? WHERE ProductVariantID = ?",
                               (val[1], val[0]))

        cursor.execute("UPDATE Bill SET Status = 'Cancelled' WHERE BillID = ?", (id,))
        db_conn.commit()
        return flask.jsonify({"mess": "Đã hủy đơn hàng thành công"}), 200
    except Exception as e:
        db_conn.rollback()
        return flask.jsonify({"error": str(e)}), 500


@bill_bp.route('/<id>/stock', methods = ['GET'])
def check_stock(id):
    db_conn = get_connection()
    cursor = db_conn.cursor()
    cursor.execute("select StockQuantity from ProductVariant where ProductVariantID = ?", (id,))
    stock = cursor.fetchone()
    if stock:
        return flask.jsonify({"ProductVariantID": id,
                              "StockQuantity": stock[0]}), 200
    return flask.jsonify({"error": "Product not found"}), 404
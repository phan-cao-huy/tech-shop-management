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
        status = flask.request.json.get("Status", "Draft")
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
                pv.Description AS VariantDescription
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


@bill_bp.route('/<id>/checkout', methods=['POST'])
def checkout_bill(id):
    try:
        db_conn = get_connection()
        cursor = db_conn.cursor()

        # Lấy trạng thái hiện tại để tránh checkout 2 lần
        cursor.execute("SELECT Status FROM Bill WHERE BillID = ?", (id,))
        current_status = cursor.fetchone()
        if not current_status or current_status[0] != 'Draft':
            return flask.jsonify({"mess": "Chỉ có thể chốt đơn từ trạng thái Draft!"}), 400

        # Kiểm tra và trừ tồn kho
        cursor.execute("SELECT ProductVariantID, Num FROM BillDetail WHERE BillID = ?", (id,))
        details = cursor.fetchall()

        for detail in details:
            variant_id = detail[0]
            num_order = detail[1]
            cursor.execute("SELECT StockQuantity FROM ProductVariant WHERE ProductVariantID = ?", (variant_id,))
            current_stock = cursor.fetchone()[0]

            if current_stock < num_order:
                return flask.jsonify(
                    {"mess": f"Sản phẩm {variant_id} không đủ số lượng tồn kho (Còn: {current_stock})"}), 400

            cursor.execute("UPDATE ProductVariant SET StockQuantity = StockQuantity - ? WHERE ProductVariantID = ?",
                           (num_order, variant_id))

        # Chuyển trạng thái sang Đang giao (Shipping)
        cursor.execute("UPDATE Bill SET Status = 'Shipping' WHERE BillID = ?", (id,))
        db_conn.commit()
        return flask.jsonify({"mess": "Chốt đơn thành công, hàng đang được giao!"}), 200

    except Exception as e:
        db_conn.rollback()
        return flask.jsonify({"error": str(e)}), 500


@bill_bp.route('/<id>/complete', methods=['POST'])
def complete_bill(id):
    try:
        db_conn = get_connection()
        cursor = db_conn.cursor()

        cursor.execute("SELECT Status FROM Bill WHERE BillID = ?", (id,))
        status_row = cursor.fetchone()

        if not status_row:
            return flask.jsonify({"error": "Không tìm thấy hóa đơn"}), 404

        if status_row[0] != 'Shipping':
            return flask.jsonify({"mess": "Chỉ có thể hoàn thành đơn đang ở trạng thái 'Đang giao' (Shipping)"}), 400

        cursor.execute("UPDATE Bill SET Status = 'Completed' WHERE BillID = ?", (id,))
        db_conn.commit()
        return flask.jsonify({"mess": "Xác nhận đơn hàng đã giao thành công!"}), 200

    except Exception as e:
        db_conn.rollback()
        return flask.jsonify({"error": str(e)}), 500


@bill_bp.route('/<id>/deliver', methods=['POST'])
def deliver_bill(id):
    try:
        db_conn = get_connection()
        cursor = db_conn.cursor()

        cursor.execute("SELECT Status FROM Bill WHERE BillID = ?", (id,))
        status = cursor.fetchone()

        if not status or status[0] != 'Shipping':
            return flask.jsonify({"mess": "Chỉ có thể đánh dấu 'Đã giao' cho đơn đang 'Shipping'"}), 400

        # Chuyển sang trạng thái Đã giao (Delivered)
        # Nếu database của bạn có cột DeliveryDate, hãy update luôn thời gian hiện tại vào đó để làm mốc tính 7 ngày
        cursor.execute("UPDATE Bill SET Status = 'Delivered' WHERE BillID = ?", (id,))
        db_conn.commit()
        return flask.jsonify({"mess": "Đơn hàng đã đến tay khách, bắt đầu tính thời gian đổi trả!"}), 200
    except Exception as e:
        db_conn.rollback()
        return flask.jsonify({"error": str(e)}), 500


@bill_bp.route('/<id>/return', methods=['POST'])
def return_bill(id):
    try:
        db_conn = get_connection()
        cursor = db_conn.cursor()

        cursor.execute("SELECT Status FROM Bill WHERE BillID = ?", (id,))
        status = cursor.fetchone()

        if not status or status[0] not in ('Delivered', 'Completed'):
            return flask.jsonify({"mess": "Chỉ có thể trả hàng cho đơn đã giao hoặc hoàn thành."}), 400

        # 1. Hoàn lại số lượng tồn kho
        cursor.execute("SELECT ProductVariantID, Num FROM BillDetail WHERE BillID = ?", (id,))
        for val in cursor.fetchall():
            cursor.execute("UPDATE ProductVariant SET StockQuantity = StockQuantity + ? WHERE ProductVariantID = ?",
                           (val[1], val[0]))

        # 2. Cập nhật trạng thái thành Returned và Set TotalPrice = 0 (Trường hợp hoàn trả toàn bộ)
        cursor.execute("UPDATE Bill SET Status = 'Returned', TotalPrice = 0 WHERE BillID = ?", (id,))
        db_conn.commit()
        return flask.jsonify({"mess": "Xử lý trả hàng thành công! Đã hoàn kho và trừ doanh thu."}), 200
    except Exception as e:
        db_conn.rollback()
        return flask.jsonify({"error": str(e)}), 500
@bill_bp.route('/<id>/cancel', methods=['POST'])
def cancel_bill(id):
    try:
        db_conn = get_connection()
        cursor = db_conn.cursor()

        cursor.execute("SELECT Status FROM Bill WHERE BillID = ?", (id,))
        status_row = cursor.fetchone()

        if not status_row:
            return flask.jsonify({"error": "Không tìm thấy hóa đơn"}), 404

        status = status_row[0]
        if status == 'Cancelled':
            return flask.jsonify({"mess": "Đơn hàng này đã bị hủy trước đó rồi!"}), 400

        # Nếu trạng thái là Shipping hoặc Completed (đã bị trừ tồn kho trước đó) thì cộng lại
        if status in ('Shipping', 'Completed'):
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
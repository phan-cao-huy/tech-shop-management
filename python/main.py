import pyodbc
import flask
from flask_cors import CORS
import uuid

con_str = (
        "DRIVER={SQL Server};"
        "SERVER=localhost,1433;"
        "DATABASE=DuLieu;"
        "UID=sa;"
        "PWD=dung0;"
    )
conn = pyodbc.connect(con_str)
app = flask.Flask(__name__)
CORS(app)

#Chuyen doi tu SQL server sang danh sach json
def get_json_results(cursor):
    res = []
    keys = [i[0] for i in cursor.description] # lay ten cot cua cac bang
    for val in cursor.fetchall(): # lay du lieu cac bang
        res.append(dict(zip(keys, val)))
    return  res

#API tai khoan
@app.route('/accounts/getall', methods = ['GET'])
def get_all_accounts():
    cursor = conn.cursor()
    cursor.execute("select * from Account")
    return flask.jsonify(get_json_results(cursor)), 200

@app.route('/accounts/get/<id>', methods = ['GET'])
def get_account(id):
    cursor = conn.cursor()
    cursor.execute("select * from Account where AccountID = ?", (id,))
    return flask.jsonify(get_json_results(cursor)), 200

@app.route('/accounts/delete/<id>', methods = ['DELETE'])
def delete_account(id):
    try:
        cursor = conn.cursor()
        cursor.execute("select AccountID from Account where AccountID = ?", (id,))

        if not cursor.fetchone():
            return flask.jsonify({"mess": "Account does not exist"}), 404
        cursor.execute("delete from Account where AccountID = ?", (id,))

        conn.commit()
        return flask.jsonify({"mess": "Account deleted"}), 200
    except Exception as e:
        return flask.jsonify({"mess": str(e)}), 500


@app.route('/auth/login', methods = ['POST'])
def login():
    try:
        user = flask.request.json.get("Username")
        pwd = flask.request.json.get("Password")

        cursor = conn.cursor()
        cursor.execute("select AccountID, Role, EmployeeID, CustomerID from Account where Username = ? and Password = ? AND IsActive = 1", (user, pwd))
        account = cursor.fetchone()

        if account:
            return flask.jsonify({
                "mess": "Login Successful",
                "AccountID": account[0],
                "Role": account[1]
            }), 200
        else:
            return flask.jsonify({"mess": "Wrong account of password"}), 401
    except Exception as e:
        return flask.jsonify({"mess": str(e)})

@app.route('/auth/register', methods = ['POST'])
def register():
    try:
        username = flask.request.json.get("Username")
        password = flask.request.json.get("Password")
        fullname = flask.request.json.get("FullName")
        phone = flask.request.json.get("Phone")
        email = flask.request.json.get("Email")
        address = flask.request.json.get("Address")

        cursor = conn.cursor()
        cursor.execute("select AccountID from Account where Username = ?", (username,))
        if cursor.fetchone():
            return flask.jsonify({"mess": "Username already exists"}), 400
        cursor.execute("select CustomerID from Customer where Phone = ?", (phone,))
        if cursor.fetchone():
            return flask.jsonify({"mess": "Phone already exists"}), 400
        cursor.execute("select CustomerID from Customer where Email = ?", (email,))
        if cursor.fetchone():
            return flask.jsonify({"mess": "Email already exists"}), 400
        customer_id = "CUS_" + str(uuid.uuid4())[:6]
        account_id = "ACC_" + str(uuid.uuid4())[:6]

        sql_customer ="insert into customer(CustomerID, FullName, Phone, Email, Address) values (?, ?, ?, ?, ?)"
        cursor.execute(sql_customer, (customer_id, fullname, phone, email, address))

        sql_account = "insert into account(AccountID, Username, Password, Role, IsActive, CustomerID) values (?,?,?, 'Customer', 1,?)"
        cursor.execute(sql_account, (account_id, username, password, customer_id))

        conn.commit()

        return flask.jsonify({
            "mess": "Register Successful",
            "Username": username,
            "AccountID": account_id
        }), 200
    except Exception as e:
        conn.rollback()
        print(e)
        return flask.jsonify({"mess": "Error system: " + str(e)}), 500

@app.route('/customers/getall', methods = ['GET'])
def get_all_customers():
    cursor = conn.cursor()
    cursor.execute('select * from Customer')
    return flask.jsonify(get_json_results(cursor)), 200

@app.route('/customers/get/<id>', methods = ['GET'])
def get_customer(id):
    cursor = conn.cursor()
    cursor.execute('select * from Customer where CustomerID = ?', (id,))
    return flask.jsonify(get_json_results(cursor)), 200

@app.route('/customers/add', methods = ['POST'])
def add_customer():
    try:
        customer_id = "CUS_" + str(uuid.uuid4())[:6]
        account_id = "ACC_" + str(uuid.uuid4())[:6]
        username = flask.request.json.get("Username")
        password = flask.request.json.get("Password")
        fullname = flask.request.json.get("FullName")
        phone = flask.request.json.get("Phone")
        email = flask.request.json.get("Email")
        address = flask.request.json.get("Address")

        cursor = conn.cursor()
        cursor.execute("select AccountID from Account where Username = ?", (username,))
        if cursor.fetchone():
            return flask.jsonify({"mess": "Username already exists"}), 400
        cursor.execute("select CustomerID from Customer where Phone = ?", (phone,))
        if cursor.fetchone():
            return flask.jsonify({"mess": "Phone already exists"}), 400
        cursor.execute("select CustomerID from Customer where Email = ?", (email,))
        if cursor.fetchone():
            return flask.jsonify({"mess": "Email already exists"}), 400

        sql_customer = "insert into Customer(CustomerID, FullName, Phone, Email, Address) values (?, ?, ?, ?, ?)"
        cursor.execute(sql_customer, (customer_id, fullname, phone, email, address))
        sql_account = "insert into Account(AccountID, Username, Password, Role, IsActive, CustomerID) values (?,?,?, 'Customer', 1,?)"
        cursor.execute(sql_account, (account_id, username, password, customer_id))
        conn.commit()
        return flask.jsonify({
            "mess": "Add Successful",
            "CustomerID": customer_id,
            "AccountID": account_id
        }), 200
    except Exception as e:
        conn.rollback()
        return flask.jsonify({"error": str(e)}), 500


@app.route('/customers/update/<id>', methods = ['PUT'])
def update_customer(id):
    try:
        full_name = flask.request.json.get("FullName")
        phone = flask.request.json.get("Phone")
        email = flask.request.json.get("Email")
        address = flask.request.json.get("Address")
        cursor = conn.cursor()
        cursor.execute("update Customer set FullName = ?, Phone = ?, Email = ?, Address = ? where CustomerID = ?", (full_name, phone, email, address, id))
        conn.commit()
        return flask.jsonify({"mess": "Update successful"}), 200
    except Exception as e:
        conn.rollback()
        return flask.jsonify({"error": str(e)}), 500

@app.route('/customers/delete/<id>', methods = ['DELETE'])
def delete_customer(id):
    try:
        customer_id = id
        cursor = conn.cursor()
        cursor.execute('select top 1 BillID from Bill where CustomerID = ?', (customer_id,))
        if cursor.fetchone():
            return flask.jsonify({"mess": "Cannot delete! This customer already has invoice history"}), 400

        cursor.execute("delete from Account where CustomerID = ?", (customer_id,))
        cursor.execute("delete from Customer where CustomerID = ?", (customer_id,))
        conn.commit()
        return flask.jsonify({"mess": "Delete successful"}), 200
    except Exception as e:
        conn.rollback()
        return flask.jsonify({"error": str(e)}), 500


@app.route('/employees/getall', methods = ['GET'])
def get_all_employees():
    cursor = conn.cursor()
    cursor.execute('select * from Employee')
    return flask.jsonify(get_json_results(cursor)), 200

@app.route('/employees/get/<id>', methods = ['GET'])
def get_employee(id):
    cursor = conn.cursor()
    cursor.execute('select * from Employee where EmployeeID = ?', (id,))
    return flask.jsonify(get_json_results(cursor)), 200

@app.route('/employees/add', methods = ['POST'])
def add_employee():
    try:
        employee_id = "EMP_" + str(uuid.uuid4())[:6]
        account_id = "ACC_" + str(uuid.uuid4())[:6]
        username = flask.request.json.get("Username")
        password = flask.request.json.get("Password")
        fullname = flask.request.json.get("FullName")
        phone = flask.request.json.get("Phone")
        email = flask.request.json.get("Email")
        role = flask.request.json.get("Role", "Employee")
        cursor = conn.cursor()
        cursor.execute("select AccountID from Account where Username = ?", (username,))
        if cursor.fetchone():
            return flask.jsonify({"mess": "Username already exists"}), 400
        cursor.execute("select EmployeeID from Employee where Phone = ?", (phone,))
        if cursor.fetchone():
            return flask.jsonify({"mess": "Phone already exists"}), 400
        cursor.execute("select EmployeeID from Employee where Email = ?", (email,))
        if cursor.fetchone():
            return flask.jsonify({"mess": "Email already exists"}), 400

        sql_employee = "insert into Employee(EmployeeID, FullName, Phone, Email, Role) values (?, ?, ?, ?, ?)"
        cursor.execute(sql_employee, (employee_id, fullname, phone, email, role))

        sql_account = "insert into Account(AccountID, Username, Password, Role, IsActive, EmployeeID) values (?, ?, ?, ?, 1, ?)"
        cursor.execute(sql_account, (account_id, username, password, role, employee_id))
        conn.commit()
        return flask.jsonify({
            "mess": "Add Successful",
            "EmployeeID": employee_id,
            "AccountID": account_id
        }), 200
    except Exception as e:
        conn.rollback()
        return flask.jsonify({"error": str(e)}), 500


@app.route('/employees/update/<id>', methods = ['PUT'])
def update_employee(id):
    try:
        full_name = flask.request.json.get("FullName")
        phone = flask.request.json.get("Phone")
        email = flask.request.json.get("Email")
        role = flask.request.json.get("Role", "Employee")
        cursor = conn.cursor()
        cursor.execute("update Employee set FullName = ?, Phone = ?, Email = ?, Role = ? where EmployeeID = ?", (full_name, phone, email, role, id))
        conn.commit()
        return flask.jsonify({"mess": "Update successful"}), 200
    except Exception as e:
        conn.rollback()
        return flask.jsonify({"error": str(e)}), 500

@app.route('/employees/delete/<id>', methods = ['DELETE'])
def delete_employee(id):
    try:
        customer_id = id
        cursor = conn.cursor()
        cursor.execute("delete from Account where EmployeeID = ?", (customer_id,))
        cursor.execute("delete from Employee where EmployeeID = ?", (customer_id,))
        conn.commit()
        return flask.jsonify({"mess": "Delete successful"}), 200
    except Exception as e:
        conn.rollback()
        return flask.jsonify({"error": str(e)}), 500

@app.route('/bills/getall', methods = ['GET'])
def get_all_bills():
    cursor = conn.cursor()
    cursor.execute('select * from Bill')
    return flask.jsonify(get_json_results(cursor)), 200

@app.route('/bills/get/<id>', methods = ['GET'])
def get_bill(id):
    cursor = conn.cursor()
    cursor.execute('select * from Bill where BillID = ?', (id,))
    return flask.jsonify(get_json_results(cursor)), 200

@app.route('/bills/add', methods = ['POST'])
def create_bill():
    try:
        bill_id = "BILL_" + str(uuid.uuid4())[:6]
        cus_id = flask.request.json.get("CustomerID")
        emp_id = flask.request.json.get("EmployeeID")
        payment_method = flask.request.json.get("PaymentMethod")
        status = flask.request.json.get("Status", "Draft")
        total = flask.request.json.get("TotalPrice", 0)
        cursor = conn.cursor()
        sql = "insert into Bill(BillID, CustomerID, EmployeeID, TotalPrice, PayMethod, Status) values (?, ?, ?, ?, ?, ?)"
        cursor.execute(sql, (bill_id, cus_id, emp_id, total, payment_method, status))
        conn.commit()
        return flask.jsonify({"mess": "Bill created successfully",
                              "BillID": bill_id}), 200
    except Exception as e:
        conn.rollback()
        return flask.jsonify({"error": str(e)}), 500

@app.route('/bills/<id>/checkout', methods = ['POST'])
def checkout_bill(id):
    try:
        cursor = conn.cursor()
        cursor.execute("select ProductVariantID, Num from BillDetail where BillID = ?", (id,))
        details = cursor.fetchall()

        for detail in details:
            variant_id = detail[0]
            num_order = detail[1]
            cursor.execute("select StockQuantity from ProductVariant where ProductVariantID = ?", (variant_id,))
            current_stock = cursor.fetchone()[0]
            if current_stock < num_order:
                return flask.jsonify({"mess": f"Product {variant_id} is out of stock"}), 200
            cursor.execute("update ProductVariant set StockQuantity = StockQuantity - ? where ProductVariantID = ?", (num_order, variant_id))
        cursor.execute("update Bill set Status = 'Completed' where BillID = ?", (id,))
        conn.commit()
        return flask.jsonify({"mess": "Payment successful, stock has been deducted!"}), 200
    except Exception as e:
        conn.rollback()
        return flask.jsonify({"error": str(e)}), 500
@app.route('/bills/<id>/cancel', methods = ['POST'])
def cancel_bill(id):
    try:
        cursor = conn.cursor()
        cursor.execute("select Status from Bill where BillID = ?", (id,))
        status = cursor.fetchone()[0]
        if status == 'Completed':
            cursor.execute("select ProductVariantID, Num from BillDetail where BillID = ?", (id,))
            for val in cursor.fetchall():
                cursor.execute("update ProductVariant set StockQuantity = StockQuantity + ? where ProductVariantID = ?", (val[1], val[0]))
        cursor.execute("update Bill set Status = 'Cancelled' where BillID = ?", (id,))
        conn.commit()
        return flask.jsonify({"mess": "Bill canceled successfully"}), 200
    except Exception as e:
        conn.rollback()
        return flask.jsonify({"error": str(e)}), 500

@app.route('/bill-details/getall', methods = ['GET'])
def get_all_bill_details():
    cursor = conn.cursor()
    cursor.execute('select * from BillDetail')
    return flask.jsonify(get_json_results(cursor)), 200

@app.route('/bill-details/get/<id>', methods = ['GET'])
def get_bill_detail(id):
    cursor = conn.cursor()
    cursor.execute('select * from BillDetail where BillID = ?', (id,))
    return flask.jsonify(get_json_results(cursor)), 200

@app.route('/bill-details/add', methods=['POST'])
def add_bill_detail():
    cursor = conn.cursor()
    try:
        bd_id = "BD_" + str(uuid.uuid4())[:6]
        bill_id = flask.request.json.get("BillID")
        variant_id = flask.request.json.get("ProductVariantID")
        num = flask.request.json.get("Num")

        # 1. Lấy giá bán hiện tại của sản phẩm
        cursor.execute("SELECT SellingPrice FROM ProductVariant WHERE ProductVariantID=?", variant_id)
        price_row = cursor.fetchone()
        if not price_row:
            return flask.jsonify({"mess": "Sản phẩm không tồn tại"}), 404
        price = price_row[0]

        # 2. Thêm vào chi tiết hóa đơn (lưu lại giá ngay thời điểm mua)
        sql_insert = "INSERT INTO BillDetail(BillDetailID, BillID, ProductVariantID, Num, Price) VALUES(?, ?, ?, ?, ?)"
        cursor.execute(sql_insert, (bd_id, bill_id, variant_id, num, price))

        # 3. Cập nhật lại TotalPrice trong bảng Bill tổng
        cursor.execute("UPDATE Bill SET TotalPrice = TotalPrice + (? * ?) WHERE BillID=?", (price, num, bill_id))

        conn.commit()
        return flask.jsonify({"mess": "Thêm sản phẩm vào đơn thành công",
                              "BillDetailID": bd_id}), 200
    except Exception as e:
        conn.rollback()
        return flask.jsonify({"error": str(e)}), 500

@app.route('/bills/<id>/stock', methods = ['GET'])
def check_stock(id):
    cursor = conn.cursor()
    cursor.execute("select StockQuantity from ProductVariant where ProductVariantID = ?", (id,))
    stock = cursor.fetchone()
    if stock:
        return flask.jsonify({"ProductVariantID": id,
                              "StockQuanity": stock[0]}), 200
    return flask.jsonify({"error": "Product not found"}), 404


@app.route('/reports/revenue', methods=['GET'])
def report_revenue():
    cursor = conn.cursor()
    cursor.execute("SELECT SUM(TotalPrice) FROM Bill WHERE Status = 'Completed'")
    rev = cursor.fetchone()[0]
    if rev is None:
        rev = 0
    return flask.jsonify({"TotalRevenue": rev}), 200

@app.route('/reports/top-products', methods=['GET'])
def top_products():
    cursor = conn.cursor()
    sql = """
        SELECT TOP 10 
            pv.ProductID, pv.Color, pv.Capacity, SUM(bd.Num) as TotalSold
        FROM BillDetail bd
        INNER JOIN Bill b ON bd.BillID = b.BillID
        INNER JOIN ProductVariant pv ON bd.ProductVariantID = pv.ProductVariantID
        WHERE b.Status = 'Completed'
        GROUP BY pv.ProductID, pv.Color, pv.Capacity
        ORDER BY TotalSold DESC
    """
    cursor.execute(sql)
    return flask.jsonify(get_json_results(cursor)), 200

# Dũng
# Category
@app.route('/categories', methods=['GET'])
def get_all_category():
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM Category")
        res = get_json_results(cursor)
        if res:
            return flask.jsonify(res), 200
        else:
            return flask.jsonify({"message":"Can't get all category!"}), 404
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/categories/<ID>', methods=['GET'])
def get_category_by_id(ID):
    cursor = conn.cursor()
    try:
        query = "SELECT * FROM Category ct WHERE ct.CategoryID = ?"
        cursor.execute(query, (ID,))
        res = get_json_results(cursor)
        if res:
            return flask.jsonify(res), 200
        else:
            return flask.jsonify({"message":"Can't find this category!"}), 404
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/categories', methods=['POST'])
def add_categories():
    cursor = conn.cursor()
    try:
        CategoryID = "CAT_" + str(uuid.uuid4())[:6]
        Name = flask.request.json.get("Name")
        cursor.execute("SELECT CategoryID FROM Category WHERE CategoryID = ?", (CategoryID,))
        if cursor.fetchone():
            return flask.jsonify({"message":"CategoryID already exists!"}), 400
        query = "INSERT INTO Category(CategoryID, Name) VALUES(?, ?)"
        cursor.execute(query, (CategoryID, Name))
        conn.commit()
        conn.close()
        return flask.jsonify({"message":"Success!"}), 201
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/categories/<ID>', methods=['PUT'])
def update_category(ID):
    cursor = conn.cursor()
    try:
        Name = flask.request.json.get("Name")
        query = "UPDATE Category SET Name = ? WHERE CategoryID = ?"
        cursor.execute(query, (Name, ID))
        conn.commit()
        conn.close()
        return flask.jsonify({"message":"Success!"}), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/categories/<ID>', methods=['DELETE'])
def delete_category(ID):
    cursor = conn.cursor()
    try:
        query = "DELETE FROM Category WHERE CategoryID = ?"
        cursor.execute(query, (ID,))
        conn.commit()  
        conn.close() 
        return flask.jsonify({"message":"Success!"}), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 
# Product
@app.route('/products', methods=['GET'])
def get_all_product():
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM Product")
        res = get_json_results(cursor)
        if res:
            return flask.jsonify(res), 200
        else:
            return flask.jsonify({"message":"Can't get all product!"}), 404
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/products/<ID>', methods=['GET'])
def get_product_by_id(ID):
    cursor = conn.cursor()
    try:
        query = "SELECT * FROM Product pr WHERE pr.ProductID = ?"
        cursor.execute(query, (ID,))
        res = get_json_results(cursor)
        if res:
            return flask.jsonify(res), 200
        else:
            return flask.jsonify({"message":"Can't find this product!"}), 404
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/products', methods=['POST'])
def add_product():
    cursor = conn.cursor()
    try:
        ProductID = "PRO_" + str(uuid.uuid4())[:6]
        ProductName = flask.request.json.get("ProductName")
        Brand = flask.request.json.get("Brand") 
        CategoryID = "CAT_" + str(uuid.uuid4())[:6]
        Description = flask.request.json.get("Description")
        Image = flask.request.json.get("Image")
        Information = flask.request.json.get("Information")
        Status = flask.request.json.get("Status")
        cursor.execute("SELECT ProductID FROM Product WHERE ProductID = ?", (ProductID,))
        if cursor.fetchone():
            return flask.jsonify({"message":"ProductID already exists!"}), 400
        cursor.execute("SELECT ProductName FROM Product WHERE ProductName = ?", (ProductName,))
        if cursor.fetchone():
            return flask.jsonify({"message":"Product name already exist!"}), 400
        query = """
                INSERT INTO Product(ProductID, ProductName, Brand, 
                Image, Description, Information, Status, CategoryID) 
                VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                """
        cursor.execute(query, (ProductID, ProductName, Brand, Image, Description, Information, Status, CategoryID))
        conn.commit()
        conn.close()
        return flask.jsonify({"message":"Success!"}), 201
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/products/<ID>', methods=['PUT'])
def update_product(ID):
    cursor = conn.cursor()
    try:
        ProductName = flask.request.json.get("ProductName")
        Brand = flask.request.json.get("Brand") 
        Description = flask.request.json.get("Description")
        Image = flask.request.json.get("Image")
        Information = flask.request.json.get("Information")
        Status = flask.request.json.get("Status")
        query = """
                UPDATE Product SET ProductName = ?, Brand = ?,Image = ?,
                Description = ?, Information = ?, Status = ?
                WHERE ProductID = ?
                """
        cursor.execute(query, (ProductName, Brand, Image, Description, Information, Status, ID))
        conn.commit()
        conn.close()
        return flask.jsonify({"message":"Success!"}), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     

@app.route('/products/<ID>', methods=['DELETE'])
def delete_product(ID):
    cursor = conn.cursor()
    try:
        query = "DELETE FROM Product WHERE ProductID = ?"
        cursor.execute(query, (ID,))
        conn.commit()   
        conn.close()
        return flask.jsonify({"message":"Success!"}), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 
# Product Variant
@app.route('/variants', methods=['GET'])
def get_all_variant():
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM Productvariant")
        res = get_json_results(cursor)
        if res:
            return flask.jsonify(res), 200
        else:
            return flask.jsonify({"message":"Can't get all product variant!"}), 404
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/variants/<ID>', methods=['GET'])
def get_variant_by_id(ID):
    cursor = conn.cursor()
    try:
        query = "SELECT * FROM Productvariant pv WHERE pv.ProductVariantID = ?"
        cursor.execute(query, (ID,))
        res = get_json_results(cursor)
        return flask.jsonify(res), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/variants', methods=['POST'])
def add_variant():
    cursor = conn.cursor()
    try:
        ProductVariantID = "VAR_" + str(uuid.uuid4())[:6]
        ProductID = "PRO_" + str(uuid.uuid4())[:6]
        Capacity = flask.request.json.get("Capacity") 
        Color = flask.request.json.get("Color")
        StockQuantity = flask.request.json.get("StockQuantity")
        SellingPrice = flask.request.json.get("SellingPrice")
        cursor.execute("SELECT ProductVariantID FROM ProductVariant WHERE ProductID = ?", (ProductVariantID,))
        if cursor.fetchone():
            return flask.jsonify({"message":"ProductVariantID already exist!"}), 400
        query = """
                INSERT INTO ProductVariant(ProductVariantID, ProductID, Color, Capacity,  
                SellingPrice, StockQuantity) 
                VALUES(?, ?, ?, ?, ?, ?)
                """
        cursor.execute(query, (ProductVariantID, ProductID, Color, Capacity, SellingPrice, StockQuantity))
        conn.commit()
        conn.close()
        return flask.jsonify({"message":"Success!"}), 201
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/variants/<ID>', methods=['PUT'])
def update_variant(ID):
    cursor = conn.cursor()
    try:
        Capacity = flask.request.json.get("Capacity") 
        Color = flask.request.json.get("Color")
        StockQuantity = flask.request.json.get("StockQuantity")
        SellingPrice = flask.request.json.get("SellingPrice")
        query = """
                UPDATE Productvariant SET Color = ?, Capacity = ?,
                SellingPrice = ?, StockQuantity = ?
                WHERE ProductVariantID = ?
                """
        cursor.execute(query, (Color, Capacity, SellingPrice, StockQuantity, ID))
        conn.commit()
        conn.close()
        return flask.jsonify({"message":"Success!"}), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/variants/<ID>', methods=['DELETE'])
def delete_variant(ID):
    cursor = conn.cursor()
    try:
        query = "DELETE FROM Productvariant WHERE ProductVariantID = ?"
        cursor.execute(query, (ID,))
        conn.commit() 
        conn.close()  
        return flask.jsonify({"message":"Success!"}), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/products/<ID>/variants', methods=['GET'])
def get_product_variant(ID):
    cursor = conn.cursor()
    try:
        query = """
                SELECT * FROM Productvariant pv 
                JOIN Product pro ON pv.ProductID = pro.ProductID 
                WHERE pv.ProductID = ?
                """
        cursor.execute(query, (ID,))
        res = get_json_results(cursor)
        if res:
            return flask.jsonify(res), 200
        else:
            return flask.jsonify({"message":"Can't find this product variant!"}), 404
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 
# Supplier
@app.route('/suppliers', methods=['GET'])
def get_all_supplier():
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM Supplier")
        res = get_json_results(cursor)
        if res:
            return flask.jsonify(res), 200
        else:
            return flask.jsonify({"message":"Can't get all supplier!"}), 404
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/suppliers', methods=['POST'])
def add_supplier():
    cursor = conn.cursor()
    try:
        SupplierID = "SUP_" + str(uuid.uuid4())[:6]
        SupplierName = flask.request.json.get("SupplierName")
        Address = flask.request.json.get("Address") 
        Phone = flask.request.json.get("Phone")
        Email = flask.request.json.get("Email")
        cursor.execute("SELECT SupplierID FROM Supplier WHERE SupplierID = ?", (SupplierID,))
        if cursor.fetchone():
            return flask.jsonify({"message":"SupplierID already exist!"}), 400
        cursor.execute("SELECT SupplierName FROM Supplier WHERE SupplierName = ?", (SupplierName,))
        if cursor.fetchone():
            return flask.jsonify({"message":"Supplier name already exist!"}), 400
        query = "INSERT INTO Supplier(SupplierID, SupplierName, Address, Phone, Email) VALUES(?, ?, ?, ?, ?)"
        cursor.execute(query, (SupplierID, SupplierName, Address, Phone, Email))
        conn.commit()
        conn.close()
        return flask.jsonify({"message":"Success!"}), 201
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/suppliers/<ID>', methods=['PUT'])
def update_supplier(ID):
    cursor = conn.cursor()
    try:
        SupplierName = flask.request.json.get("SupplierName")
        Address = flask.request.json.get("Address") 
        Phone = flask.request.json.get("Phone")
        Email = flask.request.json.get("Email")
        query = "UPDATE Supplier SET, SupplierName = ?, Address = ?, Phone = ?, Email = ? WHERE SupplierID = ?"
        cursor.execute(query, (SupplierName, Address, Phone, Email, ID))
        conn.commit()
        conn.close()
        return flask.jsonify({"message":"Success!"}), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/suppliers/<ID>', methods=['DELETE'])
def delete_supplier(ID):
    cursor = conn.cursor()
    try:
        query = "DELETE FROM Supplier WHERE SupplierID = ?"
        cursor.execute(query, (ID,))
        conn.commit()  
        conn.close() 
        return flask.jsonify({"message":"Success!"}), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 
# Purchae Order
@app.route('/purchase_orders', methods=['GET'])
def get_all_purchase_order():
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM PurchaseOrder")
        res = get_json_results(cursor)
        if res:
            return flask.jsonify(res), 200
        else:
            return flask.jsonify({"message":"Can't get all purchase order!"}), 404
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/purchase_orders/<ID>')
def get_purchase_order_detail(ID):
    cursor = conn.cursor()
    try:
        query = """
                SELECT * FROM PurchaseOrder po JOIN PurchaseOrderDetail pod 
                ON po.PurchaseOrderID = pod.PurchaseOrderID
                WHERE po.PurchaseOrderID = ?
                """
        cursor.execute(query, (ID,))
        res = get_json_results(cursor)
        if res:
            return flask.jsonify(res), 200
        else:
            return flask.jsonify({"message":"Can't find this purchase order detail!"}), 404
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/purchase_orders', methods=['POST'])
def add_purchase_order():
    cursor = conn.cursor()
    try:
        PurchaseOrderID = "PO_" + str(uuid.uuid4())[:6]
        Status = flask.request.json.get("Status")
        EmployeeID = flask.request.json.get("EmployeeID")
        SupplierID = flask.request.json.get("SupplierID") 
        cursor.execute("SELECT PurchaseOrderID FROM PurchaseOrder WHERE PurchaseOrderID = ?", (PurchaseOrderID,))
        if cursor.fetchone():
            return flask.jsonify({"message":"PurchaseOrderID already exist!"}), 400
        query = """
                INSERT INTO PurchaseOrder(PurchaseOrderID, SupplierID, EmployeeID,  Status) 
                VALUES(?, ?, ?, ?)
                """
        cursor.execute(query, (PurchaseOrderID, SupplierID, EmployeeID, Status))
        conn.commit()
        conn.close()
        return flask.jsonify({"message":"Success!"}), 201
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/purchase_orders/<ID>', methods=['PUT'])
def update_purchase_order(ID):
    cursor = conn.cursor()
    try:
        Status = flask.request.json.get("Status")
        query = """
                UPDATE PurchaseOrder SET Status = ?
                WHERE PurchaseOrderID = ?
                """
        cursor.execute(query, (Status, ID))
        conn.commit()
        conn.close()
        return flask.jsonify({"message":"Success!"}), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/purchase_orders/<ID>', methods=['DELETE'])
def delete_purchase_order(ID):
    cursor = conn.cursor()
    try:
        query = "DELETE FROM PurchaseOrder WHERE PurchaseOrderID = ?"
        cursor.execute(query, (ID,))
        conn.commit()  
        conn.close() 
        return flask.jsonify({"message":"Success!"}), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/purchase_orders/<ID>/confirm', methods=['POST'])
def confirm_purchase_order(ID):
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT Status FROM PurchaseOrder WHERE PurchaseOrderID = ?", (ID,))
        status_list = get_json_results(cursor)
        if not status_list:
            return flask.jsonify({"error": "Not found"}), 404
        if status_list[0]['Status'] == 'Pending Payment':
            return flask.jsonify({"error": "This order has been confirmed before"}), 400
        cursor.execute("UPDATE PurchaseOrder SET Status = 'Pending Payment' WHERE PurchaseOrderID = ?", (ID,))   
        update_stock_query = """
            UPDATE pv
            SET pv.StockQuantity = pv.StockQuantity + pod.NumOrder
            FROM Productvariant pv
            JOIN PurchaseOrderDetail pod ON pv.ProductVariantID = pod.ProductVariantID
            WHERE pod.PurchaseOrderID = ?
            """
        cursor.execute(update_stock_query, (ID,))
        conn.commit() 
        conn.close()       
        return flask.jsonify({"message": "Confirmed and stock updated successfully!"}), 200        
    except Exception as e:
        if conn:
            conn.rollback()
        return flask.jsonify({"error": str(e)}), 500    
    finally:
        if conn: 
            conn.close()

@app.route('/purchase_orders/<ID>/pay', methods=['POST'])
def pay_purchase_order(ID):
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT Status FROM PurchaseOrder WHERE PurchaseOrderID = ?", (ID,))
        status_list = get_json_results(cursor)
        
        if not status_list:
            return flask.jsonify({"error": "Not found"}), 404
        if status_list[0]['Status'] == 'Completed':
            return flask.jsonify({"error": "This order has been payed before"}), 400
        cursor.execute("UPDATE PurchaseOrder SET Status = 'Completed' WHERE PurchaseOrderID = ?", (ID,))
        conn.commit() 
        conn.close()       
        return flask.jsonify({"message": "Confirmed and stock updated successfully!"}), 200        
    except Exception as e:
        if conn:
            conn.rollback()
        return flask.jsonify({"error": str(e)}), 500    
    finally:
        if conn: 
            conn.close()
# Purchase Order Detail
@app.route('/purchase_order_details', methods=['GET'])
def get_all_purchase_order_detail():
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM PurchaseOrderDetail")
        res = get_json_results(cursor)
        if res:
            return flask.jsonify(res), 200
        else:
            return flask.jsonify({"message":"Can't get all purchase order detail!"}), 404
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/purchase_order_details', methods=['POST'])
def add_purchase_order_detail():
    cursor = conn.cursor()
    try:
        PurchaseOrderID = flask.request.json.get("PurchaseOrderID")
        PurchaseOrderDetailID = "POD_" + str(uuid.uuid4())[:6] 
        NumOrder = flask.request.json.get("NumOrder")
        ProductVariantID = flask.request.json.get("ProductVariantID")
        ImportPrice = flask.request.json.get("ImportPrice")
        cursor.execute("SELECT PurchaseOrderDetailID FROM PurchaseOrderDetail WHERE PurchaseOrderDetailID = ?", (PurchaseOrderDetailID,))
        if cursor.fetchone():
            return flask.jsonify({"message":"PurchaseOrderDetailID already exist!"}), 400
        query = """
                INSERT INTO PurchaseOrderDetail(PurchaseOrderDetailID, PurchaseOrderID, 
                ProductVariantID, NumOrder, ImportPrice) VALUES(?, ?, ?, ?, ?)
                """
        cursor.execute(query, (PurchaseOrderDetailID, PurchaseOrderID, ProductVariantID, NumOrder, ImportPrice))
        conn.commit()
        conn.close()
        return flask.jsonify({"message":"Success!"}), 201
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 

@app.route('/purchase_order_details/<ID>', methods=['PUT'])
def update_purchase_order_detail(ID):
    cursor = conn.cursor()
    try:
        NumOrder = flask.request.json.get("NumOrder")
        ImportPrice = flask.request.json.get("ImportPrice")
        query = """
                UPDATE PurchaseOrderDetail SET NumOrder = ?,
                ImportPrice = ? WHERE PurchaseOrderDetailID = ?
                """
        cursor.execute(query, (NumOrder, ImportPrice, ID))
        conn.commit()
        conn.close()
        return flask.jsonify({"message":"Success!"}), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 
@app.route('/purchase_order_details/<ID>', methods=['DELETE'])
def delete_purchase_order_detail(ID):
    cursor = conn.cursor()
    try:
        query = "DELETE FROM PurchaseOrderDetail WHERE PurchaseOrderDetailID = ?"
        cursor.execute(query, (ID,))
        conn.commit()   
        conn.close()
        return flask.jsonify({"message":"Success!"}), 200
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500     
 
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

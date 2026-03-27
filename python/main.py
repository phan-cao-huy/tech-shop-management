import pyodbc
import flask
from flask_cors import CORS
import uuid
con_str = (
    "Driver={SQL Server};"
    "Server=localhost\\SQLEXPRESS;"
    "Database=DuLieu;"
    "Trusted_Connection=yes;"
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
        fullname = flask.request.json.get("Fullname")
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

        sql_customer ="insert into customer(CustomerID, Fullname, Phone, Email, Address) values (?, ?, ?, ?, ?)"
        cursor.execute(sql_customer, (customer_id, fullname, phone, email, address))

        sql_account = "insert into account(AccountID, Username, Password, Role, IsActive, CustomerID) values (?,?,?, 'Customer', 1,?)"
        cursor.execute(sql_account, (account_id, username, password, customer_id))

        conn.commit()

        return flask.jsonify({
            "mess": "Register Successful",
            "Username": username
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

@app.route('/customers/add', methods = ['POST'])
def add_customer():
    try:
        customer_id = "CUS_" + str(uuid.uuid4())[:6]
        account_id = "ACC_" + str(uuid.uuid4())[:6]
        username = flask.request.json.get("Username")
        password = flask.request.json.get("Password")
        fullname = flask.request.json.get("Fullname")
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

        sql_customer = "insert into Customer(CustomerID, Fullname, Phone, Email, Address) values (?, ?, ?, ?, ?)"
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

        sql_employee = "insert into Employee(EmployeeID, FullName, Phone, Email, Role) values (?, ?, ?, ?, 'Employee')"
        cursor.execute(sql_employee, (employee_id, fullname, phone, email))

        sql_account = "insert into Account(AccountID, Username, Password, Role, IsActive, EmployeeID) values (?, ?, ?, 'Employee', 1, ?)"
        cursor.execute(sql_account, (account_id, username, password, employee_id))
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
        cursor = conn.cursor()
        cursor.execute("update Employee set FullName = ?, Phone = ?, Email = ? where EmployeeID = ?", (full_name, phone, email, id))
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


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
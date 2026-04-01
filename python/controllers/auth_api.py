import flask
import uuid
from db_config import conn, get_json_results
from werkzeug.security import generate_password_hash, check_password_hash

auth_bp = flask.Blueprint('auth_bp', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        user = flask.request.json.get("Username")
        pwd = flask.request.json.get("Password")
        cursor = conn.cursor()
        cursor.execute(
            "select AccountID, Role, EmployeeID, CustomerID, Password from Account where Username = ? AND IsActive = 1",
            (user,))
        account = cursor.fetchone()

        if account:
            db_hashed_password = account[4]
            if check_password_hash(db_hashed_password, pwd):
                return flask.jsonify({
                    "mess": "Login Successful",
                    "AccountID": account[0],
                    "Role": account[1]
                }), 200
            else:
                return flask.jsonify({"mess": "Sai mật khẩu"}), 401
        else:
            return flask.jsonify({"mess": "Tài khoản không tồn tại"}), 401
    except Exception as e:
        return flask.jsonify({"mess": str(e)})


@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        username = flask.request.json.get("Username")
        password = flask.request.json.get("Password")
        fullname = flask.request.json.get("FullName")
        phone = flask.request.json.get("Phone")
        email = flask.request.json.get("Email")
        address = flask.request.json.get("Address")

        hashed_password = generate_password_hash(password)

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

        sql_customer = "insert into customer(CustomerID, FullName, Phone, Email, Address) values (?, ?, ?, ?, ?)"
        cursor.execute(sql_customer, (customer_id, fullname, phone, email, address))
        sql_account = "insert into account(AccountID, Username, Password, Role, IsActive, CustomerID) values (?, ?, ?, 'Customer', 1, ?)"
        cursor.execute(sql_account, (account_id, username, hashed_password, customer_id))

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
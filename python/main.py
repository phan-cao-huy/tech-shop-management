import flask
from flask_cors import CORS

# Import các Blueprint từ thư mục controllers
from controllers.account_api import account_bp
from controllers.auth_api import auth_bp
from controllers.bill_api import bill_bp
from controllers.bill_detail_api import bill_detail_bp
from controllers.category_api import category_bp
from controllers.customer_api import customer_bp
from controllers.employee_api import employee_bp
from controllers.product_api import product_bp
from controllers.product_variant_api import variant_bp
from controllers.purchase_order_api import purchase_order_bp
from controllers.purchase_order_detail_api import purchase_order_detail_bp
from controllers.report_api import report_bp
from controllers.supplier_api import supplier_bp
from controllers.paypal_api import paypal_bp

app = flask.Flask(__name__)
CORS(app)

# ==========================================================
# ĐĂNG KÝ BLUEPRINT VÀ THIẾT LẬP TIỀN TỐ (URL PREFIX)
# ==========================================================

# Nhóm tài khoản và xác thực
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(account_bp, url_prefix='/accounts')

# Nhóm người dùng
app.register_blueprint(customer_bp, url_prefix='/customers')
app.register_blueprint(employee_bp, url_prefix='/employees')
app.register_blueprint(supplier_bp, url_prefix='/suppliers')

# Nhóm sản phẩm
app.register_blueprint(category_bp, url_prefix='/categories')
app.register_blueprint(product_bp, url_prefix='/products')
app.register_blueprint(variant_bp, url_prefix='/variants')

# Nhóm bán hàng (Hóa đơn xuất)
app.register_blueprint(bill_bp, url_prefix='/bills')
app.register_blueprint(bill_detail_bp, url_prefix='/bill-details')

# Nhóm nhập hàng (Hóa đơn nhập)
app.register_blueprint(purchase_order_bp, url_prefix='/purchase_orders')
app.register_blueprint(purchase_order_detail_bp, url_prefix='/purchase_order_details')

# Nhóm báo cáo thống kê
app.register_blueprint(report_bp, url_prefix='/reports')

# Nhóm thanh toán PayPal
app.register_blueprint(paypal_bp, url_prefix='/paypal')

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
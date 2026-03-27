import flask
import uuid
from db_config import conn, get_json_results

account_bp = flask.Blueprint('account_bp', __name__)

@account_bp.route('/getall', methods = ['GET'])
def get_all_accounts():
    cursor = conn.cursor()
    cursor.execute("select * from Account")
    return flask.jsonify(get_json_results(cursor)), 200

@account_bp.route('/<id>', methods = ['GET'])
def get_account(id):
    cursor = conn.cursor()
    cursor.execute("select * from Account where AccountID = ?", (id,))
    return flask.jsonify(get_json_results(cursor)), 200

@account_bp.route('/delete/<id>', methods = ['DELETE'])
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

@account_bp.route('/search', methods=['POST'])
def search_accounts():
    try:
        keyword = flask.request.args.get('keyword', )
        cursor = conn.cursor()
        sql = "select * from Account where Username like ? or Role like ?"
        search_term = f"%{keyword}%"
        cursor.execute(sql, (search_term, search_term,))
        return flask.jsonify(get_json_results(cursor)), 200
    except Exception as e:
        return flask.jsonify({'error': str(e)}), 400
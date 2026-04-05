from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.mysql import LONGTEXT
from paddleocr import PaddleOCR
import os
import re
from datetime import datetime

app = Flask(__name__)

# 1. ENHANCED CORS
CORS(app, resources={r"/*": {"origins": "*"}})

# 2. DATABASE CONFIGURATION
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+mysqlconnector://root:%25%40u3DqZE@localhost/vaultify_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# 3. OCR INITIALIZATION
ocr = PaddleOCR(use_angle_cls=True, lang='en')

# 4. DATABASE MODELS
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    pin = db.Column(db.String(4), nullable=False)

class Bill(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100))
    vendor = db.Column(db.String(100))
    date = db.Column(db.String(50))
    category = db.Column(db.String(50))
    price = db.Column(db.Float, default=0.0)
    warranty = db.Column(db.String(20))
    img = db.Column(LONGTEXT)

class Claim(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    bill_id = db.Column(db.Integer, db.ForeignKey('bill.id'), nullable=False)
    status = db.Column(db.String(20), default='Pending') 
    description = db.Column(db.Text)
    history_log = db.Column(db.Text) 
    claim_docs = db.Column(LONGTEXT) 
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

with app.app_context():
    db.create_all()

# --- SMART UNIVERSAL PARSER ---
def universal_parser(text_list):
    parsed = {
        "vendor": "Unknown Vendor",
        "name": "General Asset",
        "date": "",
        "price": 0.0 
    }

    full_text_blob = " ".join(text_list).upper()
    
    months_map = {
        "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06",
        "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12"
    }

    date_pattern = r'(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2}|\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4})'

    match = re.search(date_pattern, full_text_blob)
    if match:
        raw = match.group()
        try:
            if any(m in raw for m in months_map):
                parts = raw.split()
                if len(parts) == 3:
                    parsed['date'] = f"{parts[2]}-{months_map[parts[1][:3]]}-{parts[0].zfill(2)}"
            else:
                sep = '/' if '/' in raw else '-'
                parts = raw.split(sep)
                if len(parts[0]) == 4: 
                    parsed['date'] = raw
                else: 
                    parsed['date'] = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
        except Exception as e:
            print(f"Date Parsing Error: {e}")

    # Inside universal_parser(text_list) in app.py

    # Detect if the receipt uses Dollars
    is_dollar = "$" in full_text_blob
    exchange_rate = 92.69 # Currently: 1 USD = 83 INR

    # Your existing price extraction
    price_pattern = r'(\d{1,3}(?:,\d{3})*(?:\.\d{2}))'
    all_prices = re.findall(price_pattern, full_text_blob)

    if all_prices:
        try:
            numeric_prices = [float(p.replace(',', '')) for p in all_prices]
            raw_price = max(numeric_prices)
            
            # If dollar detected, convert to INR automatically
            if is_dollar:
                parsed['price'] = round(raw_price * exchange_rate, 2)
            else:
                parsed['price'] = raw_price
        except:
            parsed['price'] = 0.0

    for candidate in text_list[:5]:
        if len(candidate) > 4 and not any(char.isdigit() for char in candidate):
            if not any(k in candidate.lower() for k in ["ave", "road", "tel", "gst", "receipt"]):
                parsed['vendor'] = candidate
                break

    keywords = ["book", "shirt", "pant", "soap", "bin", "laptop", "mouse", "bicycle", "cycle"]
    for text in text_list:
        if any(k in text.lower() for k in keywords):
            clean_name = re.sub(r'\d+[\.,]\d{2}', '', text)
            parsed['name'] = clean_name.replace('QTY / DESCRIPTION', '').strip().split('(')[0].strip()
            break
            
    return parsed

# 5. ROUTES
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(username=data.get('username')).first():
        return jsonify({"error": "Exists"}), 400
    new_user = User(username=data.get('username'), pin=data.get('pin'))
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "Success"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data.get('username'), pin=data.get('pin')).first()
    if user: return jsonify({"message": "OK", "user": user.username}), 200
    return jsonify({"error": "Denied"}), 401

@app.route('/api/save-bill', methods=['POST'])
def save_bill():
    try:
        data = request.json
        user = User.query.filter_by(username=data.get('username')).first()
        if not user: return jsonify({"error": "No User"}), 404
        new_bill = Bill(user_id=user.id, name=data.get('name'), vendor=data.get('vendor'),
                        date=data.get('date'), category=data.get('category'),
                        price=data.get('price', 0.0),
                        warranty=data.get('warranty'), img=data.get('img'))
        db.session.add(new_bill)
        db.session.commit()
        return jsonify({"message": "Saved"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-bills', methods=['GET'])
def get_bills():
    try:
        user = User.query.filter_by(username=request.args.get('username')).first()
        if not user: return jsonify([]), 200
        bills = Bill.query.filter_by(user_id=user.id).all()
        return jsonify([{"id":b.id,"name":b.name,"vendor":b.vendor,"date":b.date,"category":b.category,"warranty":b.warranty,"price": b.price,"img":b.img} for b in bills]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/delete-bill/<int:id>', methods=['DELETE'])
def delete_bill(id):
    bill = Bill.query.get(id)
    if bill:
        db.session.delete(bill)
        db.session.commit()
        return jsonify({"message": "Deleted"}), 200
    return jsonify({"error": "Not found"}), 404

@app.route('/api/scan', methods=['POST'])
def scan_bill():
    file = request.files['file']
    if not os.path.exists('uploads'): os.makedirs('uploads')
    file_path = os.path.join('uploads', file.filename)
    file.save(file_path)

    result = ocr.ocr(file_path, cls=True)
    extracted = [line[1][0] for line in result[0]] if result and result[0] else []
    parsed = universal_parser(extracted)

    return jsonify({"message": "Done", "data": extracted, "parsed": parsed})

# --- CLAIM TRACKER ROUTES ---

@app.route('/api/submit-claim', methods=['POST'])
def submit_claim():
    try:
        data = request.json
        existing = Claim.query.filter_by(bill_id=data.get('itemId')).first()
        if existing:
            return jsonify({"error": "A claim for this item is already active"}), 400

        new_claim = Claim(
            bill_id=data.get('itemId'),
            description=data.get('desc'),
            status='Pending',
            history_log=f"Claim Initiated|{datetime.now().strftime('%Y-%m-%d %H:%M')}"
        )
        db.session.add(new_claim)
        db.session.commit()
        return jsonify({"message": "Claim successfully launched"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-claims', methods=['GET'])
def get_claims():
    try:
        username = request.args.get('username')
        user = User.query.filter_by(username=username).first()
        if not user: return jsonify([]), 200
        
        results = db.session.query(Bill, Claim).join(Claim, Bill.id == Claim.bill_id).filter(Bill.user_id == user.id).all()
        
        output = []
        for bill, claim in results:
            output.append({
                "cid": claim.id,
                "itemId": bill.id,
                "name": bill.name,
                "vendor": bill.vendor,
                "status": claim.status,
                "desc": claim.description,
                "date": bill.date,
                "warranty": bill.warranty,
                "history": claim.history_log,
                "docs": claim.claim_docs or ""
            })
        return jsonify(output), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# NEW: Update Claim Status with History Logging
@app.route('/api/update-claim-status', methods=['POST'])
def update_claim_status():
    try:
        data = request.json
        claim = Claim.query.get(data.get('cid'))
        if claim:
            new_status = data.get('status')
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')
            # Prepend the new status change to the history log string
            claim.history_log = f"{new_status}|{timestamp}\n" + (claim.history_log or "")
            claim.status = new_status
            db.session.commit()
            return jsonify({"message": "Status updated successfully"}), 200
        return jsonify({"error": "Claim not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# NEW: Upload additional claim documents (Base64)
@app.route('/api/upload-claim-doc', methods=['POST'])
def upload_claim_doc():
    try:
        data = request.json
        claim = Claim.query.get(data.get('cid'))
        if claim:
            claim.claim_docs = data.get('doc') # Base64 string
            db.session.commit()
            return jsonify({"message": "Document uploaded successfully"}), 200
        return jsonify({"error": "Claim not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/delete-claim/<int:cid>', methods=['DELETE'])
def delete_claim(cid):
    try:
        claim = Claim.query.get(cid)
        if claim:
            db.session.delete(claim)
            db.session.commit()
            return jsonify({"message": "Claim deleted"}), 200
        return jsonify({"error": "Claim not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
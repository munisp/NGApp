#!/usr/bin/env python3
"""
Email Receipt Generation and Delivery Service
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Dict, Any, Optional

from flask import Flask, request, jsonify
import psycopg2
import psycopg2.extras
from jinja2 import Template

app = Flask(__name__)

# Email configuration
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@payment-switch.com")

# Database configuration (PostgreSQL)
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "user": os.getenv("DB_USER", "payment_user"),
    "password": os.getenv("DB_PASSWORD", ""),
    "dbname": os.getenv("DB_NAME", "payment_switch"),
}


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "email-receipt"})


@app.route("/send-receipt", methods=["POST"])
def send_receipt():
    """Generate and send email receipt"""
    data = request.json
    
    transaction_id = data.get("transaction_id")
    email = data.get("email")
    
    if not transaction_id:
        return jsonify({"error": "transaction_id is required"}), 400
    
    try:
        # Get transaction details
        transaction = get_transaction(transaction_id)
        if not transaction:
            return jsonify({"error": "Transaction not found"}), 404
        
        # Use provided email or transaction email
        recipient_email = email or transaction.get("customer_email")
        if not recipient_email:
            return jsonify({"error": "No email address available"}), 400
        
        # Generate receipt HTML
        receipt_html = generate_receipt_html(transaction)
        
        # Send email
        send_email(
            to=recipient_email,
            subject=f"Payment Receipt - {transaction_id}",
            html=receipt_html
        )
        
        return jsonify({
            "success": True,
            "email": recipient_email,
            "transaction_id": transaction_id
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/send-bulk-receipts", methods=["POST"])
def send_bulk_receipts():
    """Send receipts for multiple transactions"""
    data = request.json
    
    transaction_ids = data.get("transaction_ids", [])
    
    if not transaction_ids:
        return jsonify({"error": "transaction_ids is required"}), 400
    
    results = {
        "success": [],
        "failed": []
    }
    
    for txn_id in transaction_ids:
        try:
            transaction = get_transaction(txn_id)
            if not transaction or not transaction.get("customer_email"):
                results["failed"].append({
                    "transaction_id": txn_id,
                    "error": "Transaction not found or no email"
                })
                continue
            
            receipt_html = generate_receipt_html(transaction)
            send_email(
                to=transaction["customer_email"],
                subject=f"Payment Receipt - {txn_id}",
                html=receipt_html
            )
            
            results["success"].append(txn_id)
            
        except Exception as e:
            results["failed"].append({
                "transaction_id": txn_id,
                "error": str(e)
            })
    
    return jsonify(results)


@app.route("/preview-receipt", methods=["POST"])
def preview_receipt():
    """Preview receipt HTML without sending"""
    data = request.json
    
    transaction_id = data.get("transaction_id")
    if not transaction_id:
        return jsonify({"error": "transaction_id is required"}), 400
    
    try:
        transaction = get_transaction(transaction_id)
        if not transaction:
            return jsonify({"error": "Transaction not found"}), 404
        
        receipt_html = generate_receipt_html(transaction)
        
        return jsonify({
            "html": receipt_html,
            "transaction_id": transaction_id
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def get_transaction(transaction_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve transaction details from database"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        query = """
            SELECT 
                t.transaction_id,
                t.amount,
                t.currency,
                t.status,
                t.payment_method,
                t.card_last4,
                t.card_brand,
                t.processed_at,
                ps.customer_name,
                ps.customer_email,
                ps.description
            FROM transactions t
            LEFT JOIN payment_sessions ps ON t.session_id = ps.session_id
            WHERE t.transaction_id = %s
        """
        
        cursor.execute(query, (transaction_id,))
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        return result
        
    except Exception as e:
        print(f"Database error: {e}")
        return None


def generate_receipt_html(transaction: Dict[str, Any]) -> str:
    """Generate receipt HTML from template"""
    
    # Format amount
    amount = transaction.get("amount", 0) / 100
    formatted_amount = f"{amount:,.2f}"
    
    # Format date
    processed_at = transaction.get("processed_at")
    if processed_at:
        formatted_date = processed_at.strftime("%B %d, %Y at %I:%M %p")
    else:
        formatted_date = "N/A"
    
    # Determine status class
    status = transaction.get("status", "").lower()
    status_class = {
        "completed": "completed",
        "pending": "pending",
        "failed": "failed"
    }.get(status, "pending")
    
    # Receipt template
    template_str = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Receipt</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .receipt-container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e5e5;
        }
        .header h1 {
            margin: 0;
            color: #2563eb;
            font-size: 28px;
        }
        .status {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 4px;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 12px;
            margin-top: 10px;
        }
        .status.completed {
            background-color: #d1fae5;
            color: #065f46;
        }
        .status.pending {
            background-color: #fef3c7;
            color: #92400e;
        }
        .status.failed {
            background-color: #fee2e2;
            color: #991b1b;
        }
        .amount {
            text-align: center;
            margin: 30px 0;
        }
        .amount-value {
            font-size: 48px;
            font-weight: 700;
            color: #1f2937;
        }
        .amount-currency {
            font-size: 24px;
            color: #6b7280;
            margin-left: 8px;
        }
        .details {
            margin: 30px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #f3f4f6;
        }
        .detail-label {
            color: #6b7280;
            font-weight: 500;
        }
        .detail-value {
            color: #1f2937;
            font-weight: 600;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e5e5e5;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="receipt-container">
        <div class="header">
            <h1>Payment Receipt</h1>
            <span class="status {{ status_class }}">{{ status }}</span>
        </div>

        <div class="amount">
            <span class="amount-value">{{ formatted_amount }}</span>
            <span class="amount-currency">{{ currency }}</span>
        </div>

        <div class="details">
            <div class="detail-row">
                <span class="detail-label">Transaction ID</span>
                <span class="detail-value">{{ transaction_id }}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Date & Time</span>
                <span class="detail-value">{{ formatted_date }}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Payment Method</span>
                <span class="detail-value">{{ payment_method }}</span>
            </div>
            {% if card_last4 %}
            <div class="detail-row">
                <span class="detail-label">Card</span>
                <span class="detail-value">{{ card_brand }} •••• {{ card_last4 }}</span>
            </div>
            {% endif %}
            <div class="detail-row">
                <span class="detail-label">Customer</span>
                <span class="detail-value">{{ customer_name }}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Email</span>
                <span class="detail-value">{{ customer_email }}</span>
            </div>
            {% if description %}
            <div class="detail-row">
                <span class="detail-label">Description</span>
                <span class="detail-value">{{ description }}</span>
            </div>
            {% endif %}
        </div>

        <div class="footer">
            <p>Thank you for your payment!</p>
            <p>If you have any questions, please contact support.</p>
            <p style="margin-top: 20px; font-size: 12px;">
                This is an automated receipt. Please do not reply to this email.
            </p>
        </div>
    </div>
</body>
</html>
    """
    
    template = Template(template_str)
    html = template.render(
        transaction_id=transaction.get("transaction_id", ""),
        formatted_amount=formatted_amount,
        currency=transaction.get("currency", "USD"),
        status=status.title(),
        status_class=status_class,
        formatted_date=formatted_date,
        payment_method=transaction.get("payment_method", "").title(),
        card_last4=transaction.get("card_last4"),
        card_brand=transaction.get("card_brand"),
        customer_name=transaction.get("customer_name", "Valued Customer"),
        customer_email=transaction.get("customer_email", ""),
        description=transaction.get("description")
    )
    
    return html


def send_email(to: str, subject: str, html: str):
    """Send email via SMTP"""
    
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print("SMTP credentials not configured, skipping email send")
        return
    
    msg = MIMEMultipart("alternative")
    msg["From"] = SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    
    html_part = MIMEText(html, "html")
    msg.attach(html_part)
    
    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"Email sent successfully to {to}")
        
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8004"))
    app.run(host="0.0.0.0", port=port, debug=True)

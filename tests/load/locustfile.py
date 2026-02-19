"""
Load tests using Locust
"""

from locust import HttpUser, task, between
import json

class AgentBankingUser(HttpUser):
    """Simulated user for load testing"""
    
    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks
    
    @task(3)
    def view_products(self):
        """View product catalog"""
        self.client.get("/products")
    
    @task(2)
    def create_order(self):
        """Create an order"""
        order_data = {
            "customer_id": "CUST-12345",
            "items": [
                {"product_id": "PROD-001", "quantity": 2}
            ]
        }
        self.client.post("/orders", json=order_data)
    
    @task(1)
    def process_payment(self):
        """Process a payment"""
        payment_data = {
            "amount": 1000.0,
            "currency": "KES",
            "payment_method": "mpesa"
        }
        self.client.post("/payments", json=payment_data)
    
    @task(1)
    def check_inventory(self):
        """Check inventory"""
        self.client.get("/inventory/products/PROD-001")
    
    def on_start(self):
        """Called when a user starts"""
        pass

class HighLoadUser(HttpUser):
    """High load scenario"""
    
    wait_time = between(0.1, 0.5)  # Aggressive load
    
    @task
    def rapid_fire_requests(self):
        """Rapid fire requests"""
        self.client.get("/health")
        self.client.get("/products")
        self.client.get("/orders")

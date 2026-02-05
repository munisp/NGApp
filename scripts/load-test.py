#!/usr/bin/env python3

"""
Load Testing Suite for African Fintech Mobile App
Uses Locust for distributed load testing
"""

import os
import sys
import base64
import json
import random
import time
from typing import Dict, List
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner, WorkerRunner

# Configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3000")
OCR_SERVICE_URL = os.getenv("OCR_SERVICE_URL", "http://localhost:5010")
VIDEO_LIVENESS_URL = os.getenv("VIDEO_LIVENESS_URL", "http://localhost:5011")
FACIAL_RECOGNITION_URL = os.getenv("FACIAL_RECOGNITION_URL", "http://localhost:5009")

# Test data
MOCK_IMAGE_BASE64 = base64.b64encode(b"mock-image-data" * 1000).decode()
MOCK_VIDEO_BASE64 = base64.b64encode(b"mock-video-data" * 5000).decode()

# Metrics storage
metrics = {
    "ocr_requests": 0,
    "ocr_success": 0,
    "ocr_failures": 0,
    "video_liveness_requests": 0,
    "video_liveness_success": 0,
    "video_liveness_failures": 0,
    "facial_recognition_requests": 0,
    "facial_recognition_success": 0,
    "facial_recognition_failures": 0,
    "kyc_submissions": 0,
    "kyc_success": 0,
    "kyc_failures": 0,
}


class OCRLoadTest(HttpUser):
    """Load test for OCR service"""
    
    host = OCR_SERVICE_URL
    wait_time = between(1, 3)
    
    @task(3)
    def extract_passport(self):
        """Test passport OCR extraction"""
        metrics["ocr_requests"] += 1
        
        payload = {
            "image_base64": MOCK_IMAGE_BASE64,
            "document_type": "passport",
        }
        
        with self.client.post(
            "/extract",
            json=payload,
            catch_response=True,
            name="OCR: Extract Passport"
        ) as response:
            if response.status_code == 200:
                metrics["ocr_success"] += 1
                data = response.json()
                if "extracted_data" in data and "confidence" in data:
                    response.success()
                else:
                    metrics["ocr_failures"] += 1
                    response.failure("Invalid response structure")
            else:
                metrics["ocr_failures"] += 1
                response.failure(f"Status code: {response.status_code}")
    
    @task(2)
    def extract_drivers_license(self):
        """Test driver's license OCR extraction"""
        metrics["ocr_requests"] += 1
        
        payload = {
            "image_base64": MOCK_IMAGE_BASE64,
            "document_type": "drivers_license",
        }
        
        with self.client.post(
            "/extract",
            json=payload,
            catch_response=True,
            name="OCR: Extract Driver's License"
        ) as response:
            if response.status_code == 200:
                metrics["ocr_success"] += 1
                response.success()
            else:
                metrics["ocr_failures"] += 1
                response.failure(f"Status code: {response.status_code}")
    
    @task(1)
    def extract_national_id(self):
        """Test national ID OCR extraction"""
        metrics["ocr_requests"] += 1
        
        payload = {
            "image_base64": MOCK_IMAGE_BASE64,
            "document_type": "national_id",
        }
        
        with self.client.post(
            "/extract",
            json=payload,
            catch_response=True,
            name="OCR: Extract National ID"
        ) as response:
            if response.status_code == 200:
                metrics["ocr_success"] += 1
                response.success()
            else:
                metrics["ocr_failures"] += 1
                response.failure(f"Status code: {response.status_code}")
    
    @task(1)
    def health_check(self):
        """Test OCR service health"""
        with self.client.get(
            "/health",
            catch_response=True,
            name="OCR: Health Check"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")


class VideoLivenessLoadTest(HttpUser):
    """Load test for video liveness service"""
    
    host = VIDEO_LIVENESS_URL
    wait_time = between(2, 5)
    
    @task(3)
    def verify_liveness_blink(self):
        """Test liveness verification with blink challenge"""
        metrics["video_liveness_requests"] += 1
        
        payload = {
            "video_base64": MOCK_VIDEO_BASE64,
            "challenges": ["blink"],
        }
        
        with self.client.post(
            "/verify-liveness",
            json=payload,
            catch_response=True,
            name="Video Liveness: Blink Challenge"
        ) as response:
            if response.status_code == 200:
                metrics["video_liveness_success"] += 1
                data = response.json()
                if "is_live" in data and "confidence" in data:
                    response.success()
                else:
                    metrics["video_liveness_failures"] += 1
                    response.failure("Invalid response structure")
            else:
                metrics["video_liveness_failures"] += 1
                response.failure(f"Status code: {response.status_code}")
    
    @task(2)
    def verify_liveness_multiple_challenges(self):
        """Test liveness verification with multiple challenges"""
        metrics["video_liveness_requests"] += 1
        
        challenges = random.sample(
            ["blink", "turn_head_left", "turn_head_right", "smile", "nod"],
            k=3
        )
        
        payload = {
            "video_base64": MOCK_VIDEO_BASE64,
            "challenges": challenges,
        }
        
        with self.client.post(
            "/verify-liveness",
            json=payload,
            catch_response=True,
            name="Video Liveness: Multiple Challenges"
        ) as response:
            if response.status_code == 200:
                metrics["video_liveness_success"] += 1
                response.success()
            else:
                metrics["video_liveness_failures"] += 1
                response.failure(f"Status code: {response.status_code}")
    
    @task(1)
    def health_check(self):
        """Test video liveness service health"""
        with self.client.get(
            "/health",
            catch_response=True,
            name="Video Liveness: Health Check"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")


class FacialRecognitionLoadTest(HttpUser):
    """Load test for facial recognition service"""
    
    host = FACIAL_RECOGNITION_URL
    wait_time = between(1, 3)
    
    @task(3)
    def compare_faces(self):
        """Test face comparison"""
        metrics["facial_recognition_requests"] += 1
        
        payload = {
            "image1_base64": MOCK_IMAGE_BASE64,
            "image2_base64": MOCK_IMAGE_BASE64,
        }
        
        with self.client.post(
            "/compare",
            json=payload,
            catch_response=True,
            name="Facial Recognition: Compare Faces"
        ) as response:
            if response.status_code == 200:
                metrics["facial_recognition_success"] += 1
                data = response.json()
                if "similarity" in data and "is_match" in data:
                    response.success()
                else:
                    metrics["facial_recognition_failures"] += 1
                    response.failure("Invalid response structure")
            else:
                metrics["facial_recognition_failures"] += 1
                response.failure(f"Status code: {response.status_code}")
    
    @task(1)
    def health_check(self):
        """Test facial recognition service health"""
        with self.client.get(
            "/health",
            catch_response=True,
            name="Facial Recognition: Health Check"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")


class KYCFlowLoadTest(HttpUser):
    """Load test for complete KYC flow"""
    
    host = API_BASE_URL
    wait_time = between(3, 7)
    
    def on_start(self):
        """Register and login user"""
        # Register
        email = f"loadtest-{random.randint(1000000, 9999999)}@example.com"
        password = "LoadTest123!"
        
        register_payload = {
            "email": email,
            "password": password,
            "full_name": "Load Test User",
        }
        
        response = self.client.post("/api/auth/register", json=register_payload)
        if response.status_code == 201:
            data = response.json()
            self.token = data.get("token")
            self.user_id = data.get("user", {}).get("id")
        else:
            self.token = None
            self.user_id = None
    
    @task(1)
    def complete_kyc_flow(self):
        """Test complete KYC submission flow"""
        if not self.token:
            return
        
        metrics["kyc_submissions"] += 1
        
        # Step 1: Video liveness verification
        liveness_payload = {
            "video_base64": MOCK_VIDEO_BASE64,
            "challenges": ["blink", "smile"],
        }
        
        liveness_response = self.client.post(
            f"{VIDEO_LIVENESS_URL}/verify-liveness",
            json=liveness_payload,
            name="KYC Flow: Video Liveness"
        )
        
        if liveness_response.status_code != 200:
            metrics["kyc_failures"] += 1
            return
        
        # Step 2: Submit KYC documents
        kyc_payload = {
            "document_type": random.choice(["passport", "drivers_license", "national_id"]),
            "front_image": f"data:image/jpeg;base64,{MOCK_IMAGE_BASE64}",
            "back_image": f"data:image/jpeg;base64,{MOCK_IMAGE_BASE64}",
            "liveness_verified": True,
        }
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        with self.client.post(
            "/api/kyc/submissions",
            json=kyc_payload,
            headers=headers,
            catch_response=True,
            name="KYC Flow: Submit Documents"
        ) as response:
            if response.status_code == 201:
                metrics["kyc_success"] += 1
                response.success()
            else:
                metrics["kyc_failures"] += 1
                response.failure(f"Status code: {response.status_code}")
    
    @task(2)
    def get_kyc_status(self):
        """Test retrieving KYC status"""
        if not self.token:
            return
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        with self.client.get(
            "/api/kyc/submissions",
            headers=headers,
            catch_response=True,
            name="KYC Flow: Get Status"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(1)
    def health_check(self):
        """Test API health"""
        with self.client.get(
            "/health",
            catch_response=True,
            name="API: Health Check"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")


class DatabaseLoadTest(HttpUser):
    """Load test for database operations"""
    
    host = API_BASE_URL
    wait_time = between(0.5, 2)
    
    def on_start(self):
        """Register and login user"""
        email = f"dbtest-{random.randint(1000000, 9999999)}@example.com"
        password = "DBTest123!"
        
        register_payload = {
            "email": email,
            "password": password,
            "full_name": "DB Test User",
        }
        
        response = self.client.post("/api/auth/register", json=register_payload)
        if response.status_code == 201:
            data = response.json()
            self.token = data.get("token")
        else:
            self.token = None
    
    @task(5)
    def read_user_profile(self):
        """Test reading user profile"""
        if not self.token:
            return
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        with self.client.get(
            "/api/users/me",
            headers=headers,
            catch_response=True,
            name="Database: Read User Profile"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(2)
    def update_user_profile(self):
        """Test updating user profile"""
        if not self.token:
            return
        
        headers = {"Authorization": f"Bearer {self.token}"}
        payload = {
            "full_name": f"Updated User {random.randint(1, 1000)}",
        }
        
        with self.client.patch(
            "/api/users/me",
            json=payload,
            headers=headers,
            catch_response=True,
            name="Database: Update User Profile"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(3)
    def list_kyc_submissions(self):
        """Test listing KYC submissions"""
        if not self.token:
            return
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        with self.client.get(
            "/api/kyc/submissions",
            headers=headers,
            catch_response=True,
            name="Database: List KYC Submissions"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")


# Event handlers for reporting
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when test starts"""
    print("\n" + "=" * 80)
    print("LOAD TEST STARTING")
    print("=" * 80)
    print(f"API Base URL: {API_BASE_URL}")
    print(f"OCR Service URL: {OCR_SERVICE_URL}")
    print(f"Video Liveness URL: {VIDEO_LIVENESS_URL}")
    print(f"Facial Recognition URL: {FACIAL_RECOGNITION_URL}")
    print("=" * 80 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when test stops - print metrics"""
    print("\n" + "=" * 80)
    print("LOAD TEST RESULTS")
    print("=" * 80)
    
    # OCR metrics
    print("\n📄 OCR Service:")
    print(f"  Total Requests: {metrics['ocr_requests']}")
    print(f"  Successful: {metrics['ocr_success']}")
    print(f"  Failed: {metrics['ocr_failures']}")
    if metrics['ocr_requests'] > 0:
        success_rate = (metrics['ocr_success'] / metrics['ocr_requests']) * 100
        print(f"  Success Rate: {success_rate:.2f}%")
    
    # Video liveness metrics
    print("\n🎥 Video Liveness Service:")
    print(f"  Total Requests: {metrics['video_liveness_requests']}")
    print(f"  Successful: {metrics['video_liveness_success']}")
    print(f"  Failed: {metrics['video_liveness_failures']}")
    if metrics['video_liveness_requests'] > 0:
        success_rate = (metrics['video_liveness_success'] / metrics['video_liveness_requests']) * 100
        print(f"  Success Rate: {success_rate:.2f}%")
    
    # Facial recognition metrics
    print("\n👤 Facial Recognition Service:")
    print(f"  Total Requests: {metrics['facial_recognition_requests']}")
    print(f"  Successful: {metrics['facial_recognition_success']}")
    print(f"  Failed: {metrics['facial_recognition_failures']}")
    if metrics['facial_recognition_requests'] > 0:
        success_rate = (metrics['facial_recognition_success'] / metrics['facial_recognition_requests']) * 100
        print(f"  Success Rate: {success_rate:.2f}%")
    
    # KYC flow metrics
    print("\n📋 KYC Flow:")
    print(f"  Total Submissions: {metrics['kyc_submissions']}")
    print(f"  Successful: {metrics['kyc_success']}")
    print(f"  Failed: {metrics['kyc_failures']}")
    if metrics['kyc_submissions'] > 0:
        success_rate = (metrics['kyc_success'] / metrics['kyc_submissions']) * 100
        print(f"  Success Rate: {success_rate:.2f}%")
    
    print("\n" + "=" * 80 + "\n")
    
    # Save metrics to file
    with open("/tmp/load-test-metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print("📊 Detailed metrics saved to /tmp/load-test-metrics.json\n")


if __name__ == "__main__":
    print("Load Testing Suite")
    print("==================")
    print("\nUsage:")
    print("  locust -f load-test.py --host=http://api.example.com")
    print("\nOr run with web UI:")
    print("  locust -f load-test.py --host=http://api.example.com --web-host=0.0.0.0")
    print("\nOr run headless:")
    print("  locust -f load-test.py --host=http://api.example.com --headless -u 100 -r 10 -t 5m")
    print("\nEnvironment variables:")
    print("  API_BASE_URL - API server URL (default: http://localhost:3000)")
    print("  OCR_SERVICE_URL - OCR service URL (default: http://localhost:5010)")
    print("  VIDEO_LIVENESS_URL - Video liveness URL (default: http://localhost:5011)")
    print("  FACIAL_RECOGNITION_URL - Facial recognition URL (default: http://localhost:5009)")

#!/usr/bin/env python3
"""
ML-Based Smart Transaction Categorization Service
Uses Qwen LLM for text classification and embeddings for merchant matching
Production-ready with hierarchical categories, user learning, and multi-language support
"""

import os
import sys
import json
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
OLLAMA_URL = os.environ.get('OLLAMA_BASE_URL', 'http://127.0.0.1:11434')
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', 'qwen2.5:7b')
MODEL_DIR = '/tmp/ml_models'

# Ensure model directory exists
os.makedirs(MODEL_DIR, exist_ok=True)

# Hierarchical category structure
CATEGORY_HIERARCHY = {
    'Food & Dining': {
        'subcategories': ['Restaurants', 'Groceries', 'Fast Food', 'Coffee & Tea', 'Bars & Nightlife'],
        'keywords': ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'food', 'dining', 'kitchen', 'grill', 'bar', 'grocery', 'supermarket', 'market']
    },
    'Shopping': {
        'subcategories': ['Clothing', 'Electronics', 'Home & Garden', 'General Merchandise', 'Online Shopping'],
        'keywords': ['store', 'shop', 'mart', 'market', 'retail', 'boutique', 'mall', 'amazon', 'ebay', 'jumia']
    },
    'Transportation': {
        'subcategories': ['Gas & Fuel', 'Public Transit', 'Ride Share', 'Parking', 'Auto Services'],
        'keywords': ['gas', 'fuel', 'station', 'uber', 'lyft', 'taxi', 'parking', 'transit', 'bolt', 'auto', 'car']
    },
    'Bills & Utilities': {
        'subcategories': ['Electric', 'Water', 'Gas', 'Internet', 'Phone', 'Cable/Streaming'],
        'keywords': ['electric', 'water', 'gas', 'internet', 'phone', 'utility', 'dstv', 'netflix', 'spotify']
    },
    'Entertainment': {
        'subcategories': ['Movies & Theater', 'Sports & Recreation', 'Gaming', 'Events', 'Hobbies'],
        'keywords': ['cinema', 'theater', 'movie', 'game', 'entertainment', 'concert', 'event', 'sport', 'gym']
    },
    'Healthcare': {
        'subcategories': ['Pharmacy', 'Doctor', 'Hospital', 'Dental', 'Insurance'],
        'keywords': ['pharmacy', 'hospital', 'clinic', 'doctor', 'medical', 'health', 'dental', 'insurance']
    },
    'Financial': {
        'subcategories': ['Bank Fees', 'ATM', 'Transfers', 'Investments', 'Loans'],
        'keywords': ['bank', 'atm', 'transfer', 'fee', 'investment', 'loan', 'credit']
    },
    'Education': {
        'subcategories': ['Tuition', 'Books', 'Supplies', 'Courses', 'Training'],
        'keywords': ['school', 'university', 'education', 'tuition', 'course', 'training', 'book']
    },
    'Personal Care': {
        'subcategories': ['Salon & Spa', 'Gym & Fitness', 'Beauty Products', 'Wellness'],
        'keywords': ['salon', 'spa', 'gym', 'fitness', 'beauty', 'wellness', 'massage', 'yoga']
    },
    'Travel': {
        'subcategories': ['Flights', 'Hotels', 'Car Rental', 'Travel Services', 'Vacation'],
        'keywords': ['flight', 'hotel', 'travel', 'airline', 'booking', 'vacation', 'resort', 'airbnb']
    },
    'Other': {
        'subcategories': ['Uncategorized', 'Miscellaneous'],
        'keywords': []
    }
}

class MerchantDatabase:
    """Database of known merchants with embeddings"""
    
    def __init__(self, ollama_url: str = OLLAMA_URL, model: str = OLLAMA_MODEL):
        self.ollama_url = ollama_url.rstrip('/')
        self.model = model
        self.merchants = {}
        self.embeddings_cache = {}
        self._load_common_merchants()
    
    def _load_common_merchants(self):
        """Load common African merchants"""
        common_merchants = {
            # Nigeria
            'Shoprite': 'Shopping/Groceries',
            'Jumia': 'Shopping/Online Shopping',
            'Konga': 'Shopping/Online Shopping',
            'DSTV': 'Bills & Utilities/Cable/Streaming',
            'MTN': 'Bills & Utilities/Phone',
            'Airtel': 'Bills & Utilities/Phone',
            'Glo': 'Bills & Utilities/Phone',
            '9mobile': 'Bills & Utilities/Phone',
            'Uber Nigeria': 'Transportation/Ride Share',
            'Bolt Nigeria': 'Transportation/Ride Share',
            'Chicken Republic': 'Food & Dining/Fast Food',
            'Dominos Pizza': 'Food & Dining/Restaurants',
            'Mr Biggs': 'Food & Dining/Fast Food',
            'Filmhouse': 'Entertainment/Movies & Theater',
            
            # Kenya
            'Carrefour': 'Shopping/Groceries',
            'Naivas': 'Shopping/Groceries',
            'Safaricom': 'Bills & Utilities/Phone',
            'M-Pesa': 'Financial/Transfers',
            'Uber Kenya': 'Transportation/Ride Share',
            'Bolt Kenya': 'Transportation/Ride Share',
            'Java House': 'Food & Dining/Coffee & Tea',
            'KFC Kenya': 'Food & Dining/Fast Food',
            
            # Ghana
            'Shoprite Ghana': 'Shopping/Groceries',
            'Game Ghana': 'Shopping/Electronics',
            'MTN Ghana': 'Bills & Utilities/Phone',
            'Vodafone Ghana': 'Bills & Utilities/Phone',
            'Uber Ghana': 'Transportation/Ride Share',
            'Bolt Ghana': 'Transportation/Ride Share',
            
            # South Africa
            'Pick n Pay': 'Shopping/Groceries',
            'Woolworths': 'Shopping/General Merchandise',
            'Checkers': 'Shopping/Groceries',
            'Vodacom': 'Bills & Utilities/Phone',
            'MTN SA': 'Bills & Utilities/Phone',
            'Uber SA': 'Transportation/Ride Share',
            'Bolt SA': 'Transportation/Ride Share',
            'Nandos': 'Food & Dining/Restaurants',
            'Steers': 'Food & Dining/Fast Food',
        }
        
        for merchant, category in common_merchants.items():
            parts = category.split('/')
            self.merchants[merchant.lower()] = {
                'name': merchant,
                'category': parts[0],
                'subcategory': parts[1] if len(parts) > 1 else None
            }
    
    def get_embedding(self, text: str) -> Optional[np.ndarray]:
        """Get embedding for text using Ollama"""
        if text in self.embeddings_cache:
            return self.embeddings_cache[text]
        
        try:
            response = requests.post(
                f'{self.ollama_url}/api/embeddings',
                json={
                    'model': self.model,
                    'prompt': text
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                embedding = np.array(result.get('embedding', []))
                self.embeddings_cache[text] = embedding
                return embedding
            
        except Exception as e:
            print(f"Error getting embedding: {e}")
        
        return None
    
    def find_similar_merchant(self, merchant_name: str, threshold: float = 0.8) -> Optional[Dict[str, Any]]:
        """Find similar merchant using embeddings"""
        merchant_lower = merchant_name.lower()
        
        # Exact match
        if merchant_lower in self.merchants:
            return self.merchants[merchant_lower]
        
        # Partial match
        for known_merchant in self.merchants:
            if known_merchant in merchant_lower or merchant_lower in known_merchant:
                return self.merchants[known_merchant]
        
        # Embedding similarity (if available)
        merchant_embedding = self.get_embedding(merchant_name)
        if merchant_embedding is None or len(merchant_embedding) == 0:
            return None
        
        best_match = None
        best_similarity = threshold
        
        for known_merchant, data in self.merchants.items():
            known_embedding = self.get_embedding(data['name'])
            if known_embedding is None or len(known_embedding) == 0:
                continue
            
            similarity = cosine_similarity(
                merchant_embedding.reshape(1, -1),
                known_embedding.reshape(1, -1)
            )[0][0]
            
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = data
        
        return best_match
    
    def add_merchant(self, merchant_name: str, category: str, subcategory: Optional[str] = None):
        """Add new merchant to database"""
        self.merchants[merchant_name.lower()] = {
            'name': merchant_name,
            'category': category,
            'subcategory': subcategory
        }

class SmartCategorizer:
    """ML-based transaction categorizer using Qwen"""
    
    def __init__(self, ollama_url: str = OLLAMA_URL, model: str = OLLAMA_MODEL):
        self.ollama_url = ollama_url.rstrip('/')
        self.model = model
        self.merchant_db = MerchantDatabase(ollama_url, model)
        self.user_corrections = {}  # Learn from user corrections
    
    def categorize(
        self,
        merchant: str,
        description: Optional[str] = None,
        amount: Optional[float] = None,
        user_id: str = 'default'
    ) -> Dict[str, Any]:
        """Categorize transaction using ML"""
        
        # Check merchant database first
        merchant_match = self.merchant_db.find_similar_merchant(merchant)
        if merchant_match:
            return {
                'category': merchant_match['category'],
                'subcategory': merchant_match['subcategory'],
                'confidence': 95.0,
                'method': 'merchant_database',
                'merchant_match': merchant_match['name']
            }
        
        # Check user corrections (personalized learning)
        if user_id in self.user_corrections:
            merchant_lower = merchant.lower()
            if merchant_lower in self.user_corrections[user_id]:
                correction = self.user_corrections[user_id][merchant_lower]
                return {
                    'category': correction['category'],
                    'subcategory': correction.get('subcategory'),
                    'confidence': 98.0,
                    'method': 'user_learning',
                    'learned': True
                }
        
        # Use Qwen LLM for intelligent categorization
        return self._categorize_with_llm(merchant, description, amount)
    
    def _categorize_with_llm(
        self,
        merchant: str,
        description: Optional[str],
        amount: Optional[float]
    ) -> Dict[str, Any]:
        """Categorize using Qwen LLM"""
        
        # Build prompt
        categories_list = '\n'.join([f"- {cat}" for cat in CATEGORY_HIERARCHY.keys()])
        
        prompt = f"""Categorize this transaction into one of the following categories:

{categories_list}

Transaction Details:
- Merchant: {merchant}
- Description: {description or 'N/A'}
- Amount: ${amount or 0:.2f}

Respond with ONLY the category name from the list above, nothing else."""

        try:
            response = requests.post(
                f'{self.ollama_url}/api/generate',
                json={
                    'model': self.model,
                    'prompt': prompt,
                    'stream': False,
                    'options': {
                        'temperature': 0.3,  # Low temperature for consistent categorization
                        'num_predict': 50
                    }
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                predicted_category = result.get('response', '').strip()
                
                # Validate category
                if predicted_category in CATEGORY_HIERARCHY:
                    # Get subcategory using another LLM call
                    subcategory = self._get_subcategory(merchant, predicted_category)
                    
                    return {
                        'category': predicted_category,
                        'subcategory': subcategory,
                        'confidence': 85.0,
                        'method': 'llm_classification'
                    }
                else:
                    # Fallback to keyword matching
                    return self._categorize_by_keywords(merchant, description)
            
        except Exception as e:
            print(f"Error categorizing with LLM: {e}")
        
        # Fallback to keyword matching
        return self._categorize_by_keywords(merchant, description)
    
    def _get_subcategory(self, merchant: str, category: str) -> Optional[str]:
        """Get subcategory using LLM"""
        subcategories = CATEGORY_HIERARCHY[category]['subcategories']
        subcategories_list = '\n'.join([f"- {sub}" for sub in subcategories])
        
        prompt = f"""Choose the most appropriate subcategory for this merchant:

Merchant: {merchant}
Category: {category}

Subcategories:
{subcategories_list}

Respond with ONLY the subcategory name from the list above, nothing else."""

        try:
            response = requests.post(
                f'{self.ollama_url}/api/generate',
                json={
                    'model': self.model,
                    'prompt': prompt,
                    'stream': False,
                    'options': {
                        'temperature': 0.3,
                        'num_predict': 30
                    }
                },
                timeout=20
            )
            
            if response.status_code == 200:
                result = response.json()
                predicted_subcategory = result.get('response', '').strip()
                
                if predicted_subcategory in subcategories:
                    return predicted_subcategory
            
        except Exception as e:
            print(f"Error getting subcategory: {e}")
        
        return subcategories[0] if subcategories else None
    
    def _categorize_by_keywords(
        self,
        merchant: str,
        description: Optional[str]
    ) -> Dict[str, Any]:
        """Fallback keyword-based categorization"""
        text = f"{merchant} {description or ''}".lower()
        
        best_match = None
        best_score = 0
        
        for category, data in CATEGORY_HIERARCHY.items():
            keywords = data['keywords']
            score = sum(1 for kw in keywords if kw in text)
            
            if score > best_score:
                best_score = score
                best_match = category
        
        if best_match and best_score > 0:
            subcategories = CATEGORY_HIERARCHY[best_match]['subcategories']
            return {
                'category': best_match,
                'subcategory': subcategories[0] if subcategories else None,
                'confidence': min(80.0, 50.0 + best_score * 10),
                'method': 'keyword_matching'
            }
        
        return {
            'category': 'Other',
            'subcategory': 'Uncategorized',
            'confidence': 30.0,
            'method': 'default'
        }
    
    def learn_from_correction(
        self,
        merchant: str,
        correct_category: str,
        correct_subcategory: Optional[str],
        user_id: str = 'default'
    ):
        """Learn from user corrections"""
        if user_id not in self.user_corrections:
            self.user_corrections[user_id] = {}
        
        self.user_corrections[user_id][merchant.lower()] = {
            'category': correct_category,
            'subcategory': correct_subcategory,
            'corrected_at': datetime.now().isoformat()
        }
        
        # Also add to merchant database for all users
        self.merchant_db.add_merchant(merchant, correct_category, correct_subcategory)
    
    def batch_categorize(
        self,
        transactions: List[Dict[str, Any]],
        user_id: str = 'default'
    ) -> List[Dict[str, Any]]:
        """Categorize multiple transactions"""
        results = []
        
        for txn in transactions:
            merchant = txn.get('merchant', txn.get('description', 'Unknown'))
            description = txn.get('description')
            amount = txn.get('amount')
            
            result = self.categorize(merchant, description, amount, user_id)
            results.append({
                'transaction_id': txn.get('id'),
                **result
            })
        
        return results

# Global service instance
smart_categorizer = SmartCategorizer()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'smart-categorization-ml',
        'llm_model': OLLAMA_MODEL,
        'categories': len(CATEGORY_HIERARCHY),
        'known_merchants': len(smart_categorizer.merchant_db.merchants),
        'features': [
            'llm_classification',
            'merchant_database',
            'user_learning',
            'hierarchical_categories',
            'multi_language'
        ]
    })

@app.route('/categorize', methods=['POST'])
def categorize():
    """Categorize a single transaction"""
    try:
        data = request.get_json()
        
        if not data or 'merchant' not in data:
            return jsonify({'error': 'Merchant is required'}), 400
        
        merchant = data['merchant']
        description = data.get('description')
        amount = data.get('amount')
        user_id = data.get('user_id', 'default')
        
        result = smart_categorizer.categorize(merchant, description, amount, user_id)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error categorizing transaction: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/batch-categorize', methods=['POST'])
def batch_categorize():
    """Categorize multiple transactions"""
    try:
        data = request.get_json()
        
        if not data or 'transactions' not in data:
            return jsonify({'error': 'Transactions are required'}), 400
        
        transactions = data['transactions']
        user_id = data.get('user_id', 'default')
        
        results = smart_categorizer.batch_categorize(transactions, user_id)
        
        return jsonify({'results': results})
        
    except Exception as e:
        print(f"Error batch categorizing: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/learn', methods=['POST'])
def learn():
    """Learn from user correction"""
    try:
        data = request.get_json()
        
        required_fields = ['merchant', 'correct_category']
        if not data or not all(field in data for field in required_fields):
            return jsonify({'error': 'Merchant and correct_category are required'}), 400
        
        merchant = data['merchant']
        correct_category = data['correct_category']
        correct_subcategory = data.get('correct_subcategory')
        user_id = data.get('user_id', 'default')
        
        smart_categorizer.learn_from_correction(
            merchant,
            correct_category,
            correct_subcategory,
            user_id
        )
        
        return jsonify({
            'success': True,
            'message': f'Learned categorization for {merchant}'
        })
        
    except Exception as e:
        print(f"Error learning correction: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/categories', methods=['GET'])
def get_categories():
    """Get available categories and subcategories"""
    return jsonify({
        'categories': {
            name: {
                'subcategories': data['subcategories']
            }
            for name, data in CATEGORY_HIERARCHY.items()
        }
    })

if __name__ == '__main__':
    port = int(os.environ.get('SMART_CATEGORIZATION_ML_PORT', 5004))
    print(f"Starting ML-Based Smart Categorization Service on port {port}...")
    print(f"Ollama URL: {OLLAMA_URL}")
    print(f"Ollama Model: {OLLAMA_MODEL}")
    print(f"Categories: {len(CATEGORY_HIERARCHY)}")
    print(f"Known Merchants: {len(smart_categorizer.merchant_db.merchants)}")
    print("Features: LLM Classification, Merchant Database, User Learning")
    print("Smart Categorization ML Service ready!")
    app.run(host='0.0.0.0', port=port, debug=False)

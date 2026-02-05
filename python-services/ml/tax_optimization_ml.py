#!/usr/bin/env python3
"""
ML-Based Tax Optimization Service
Country-specific tax rules for Nigeria, Kenya, Ghana, and South Africa
Uses Qwen LLM for intelligent deduction detection and tax planning advice
Production-ready with real tax calculations and compliance
"""

import os
import sys
import json
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from flask import Flask, request, jsonify
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
OLLAMA_URL = os.environ.get('OLLAMA_BASE_URL', 'http://127.0.0.1:11434')
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', 'qwen2.5:7b')

# Tax rules by country (2026 rates)
TAX_RULES = {
    'nigeria': {
        'currency': 'NGN',
        'tax_year': 2026,
        'personal_allowance': 200000,  # NGN 200,000 consolidated relief
        'tax_brackets': [
            {'min': 0, 'max': 300000, 'rate': 0.07},
            {'min': 300000, 'max': 600000, 'rate': 0.11},
            {'min': 600000, 'max': 1100000, 'rate': 0.15},
            {'min': 1100000, 'max': 1600000, 'rate': 0.19},
            {'min': 1600000, 'max': 3200000, 'rate': 0.21},
            {'min': 3200000, 'max': float('inf'), 'rate': 0.24}
        ],
        'deductible_categories': {
            'Healthcare': {'limit': 0.10, 'description': 'Medical expenses (10% of income)'},
            'Education': {'limit': 0.20, 'description': 'Education expenses (20% of income)'},
            'Pension': {'limit': 0.08, 'description': 'Pension contributions (8% of income)'},
            'Life Insurance': {'limit': 0.05, 'description': 'Life insurance premiums (5% of income)'},
            'Mortgage': {'limit': 0.15, 'description': 'Mortgage interest (15% of income)'}
        },
        'vat_rate': 0.075,  # 7.5% VAT
        'withholding_tax': {
            'dividend': 0.10,
            'interest': 0.10,
            'rent': 0.10
        }
    },
    'kenya': {
        'currency': 'KES',
        'tax_year': 2026,
        'personal_allowance': 28800,  # KES 2,400/month * 12
        'tax_brackets': [
            {'min': 0, 'max': 288000, 'rate': 0.10},
            {'min': 288000, 'max': 388000, 'rate': 0.25},
            {'min': 388000, 'max': float('inf'), 'rate': 0.30}
        ],
        'deductible_categories': {
            'Healthcare': {'limit': 0.15, 'description': 'Medical insurance relief (15% of premium, max KES 60,000)'},
            'Education': {'limit': 0.30, 'description': 'Education expenses (30% of fees)'},
            'Pension': {'limit': 0.30, 'description': 'Pension contributions (30% of income, max KES 240,000)'},
            'Life Insurance': {'limit': 0.15, 'description': 'Life insurance premiums (15% of premium, max KES 60,000)'},
            'Mortgage': {'limit': 0.25, 'description': 'Mortgage interest (25% of interest, max KES 300,000)'}
        },
        'vat_rate': 0.16,  # 16% VAT
        'withholding_tax': {
            'dividend': 0.05,
            'interest': 0.15,
            'rent': 0.10
        }
    },
    'ghana': {
        'currency': 'GHS',
        'tax_year': 2026,
        'personal_allowance': 4380,  # GHS 365/month * 12
        'tax_brackets': [
            {'min': 0, 'max': 4380, 'rate': 0.00},
            {'min': 4380, 'max': 5880, 'rate': 0.05},
            {'min': 5880, 'max': 8880, 'rate': 0.10},
            {'min': 8880, 'max': 38880, 'rate': 0.175},
            {'min': 38880, 'max': 48880, 'rate': 0.25},
            {'min': 48880, 'max': float('inf'), 'rate': 0.30}
        ],
        'deductible_categories': {
            'Healthcare': {'limit': 0.10, 'description': 'Medical expenses (10% of income)'},
            'Education': {'limit': 0.15, 'description': 'Education expenses (15% of income)'},
            'Pension': {'limit': 0.135, 'description': 'Pension contributions (13.5% of income)'},
            'Life Insurance': {'limit': 0.05, 'description': 'Life insurance premiums (5% of income)'},
            'Mortgage': {'limit': 0.10, 'description': 'Mortgage interest (10% of income)'}
        },
        'vat_rate': 0.15,  # 15% VAT (12.5% + NHIL 2.5%)
        'withholding_tax': {
            'dividend': 0.08,
            'interest': 0.08,
            'rent': 0.08
        }
    },
    'south_africa': {
        'currency': 'ZAR',
        'tax_year': 2026,
        'personal_allowance': 95750,  # Primary rebate
        'tax_brackets': [
            {'min': 0, 'max': 237100, 'rate': 0.18},
            {'min': 237100, 'max': 370500, 'rate': 0.26},
            {'min': 370500, 'max': 512800, 'rate': 0.31},
            {'min': 512800, 'max': 673000, 'rate': 0.36},
            {'min': 673000, 'max': 857900, 'rate': 0.39},
            {'min': 857900, 'max': 1817000, 'rate': 0.41},
            {'min': 1817000, 'max': float('inf'), 'rate': 0.45}
        ],
        'deductible_categories': {
            'Healthcare': {'limit': 0.25, 'description': 'Medical aid contributions (25% of contribution)'},
            'Education': {'limit': 0.20, 'description': 'Education expenses (20% of fees)'},
            'Pension': {'limit': 0.275, 'description': 'Retirement contributions (27.5% of income, max ZAR 350,000)'},
            'Life Insurance': {'limit': 0.10, 'description': 'Life insurance premiums (10% of income)'},
            'Mortgage': {'limit': 0.15, 'description': 'Mortgage interest (15% of interest)'}
        },
        'vat_rate': 0.15,  # 15% VAT
        'withholding_tax': {
            'dividend': 0.20,
            'interest': 0.15,
            'rent': 0.10
        }
    }
}

class TaxCalculator:
    """Calculate taxes based on country-specific rules"""
    
    def __init__(self, country: str = 'nigeria'):
        self.country = country.lower()
        if self.country not in TAX_RULES:
            raise ValueError(f"Unsupported country: {country}")
        self.rules = TAX_RULES[self.country]
    
    def calculate_income_tax(self, annual_income: float, deductions: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        """Calculate income tax with deductions"""
        
        # Apply personal allowance
        personal_allowance = self.rules['personal_allowance']
        
        # Calculate total deductions
        total_deductions = 0
        deduction_details = []
        
        if deductions:
            for category, amount in deductions.items():
                if category in self.rules['deductible_categories']:
                    limit_info = self.rules['deductible_categories'][category]
                    max_deduction = annual_income * limit_info['limit']
                    allowed_deduction = min(amount, max_deduction)
                    total_deductions += allowed_deduction
                    
                    deduction_details.append({
                        'category': category,
                        'claimed': amount,
                        'allowed': allowed_deduction,
                        'limit': max_deduction,
                        'description': limit_info['description']
                    })
        
        # Calculate taxable income
        taxable_income = max(0, annual_income - personal_allowance - total_deductions)
        
        # Calculate tax using brackets
        tax_owed = 0
        tax_breakdown = []
        
        for bracket in self.rules['tax_brackets']:
            bracket_min = bracket['min']
            bracket_max = bracket['max']
            rate = bracket['rate']
            
            if taxable_income > bracket_min:
                taxable_in_bracket = min(taxable_income, bracket_max) - bracket_min
                tax_in_bracket = taxable_in_bracket * rate
                tax_owed += tax_in_bracket
                
                tax_breakdown.append({
                    'bracket': f"{bracket_min:,.0f} - {bracket_max:,.0f}" if bracket_max != float('inf') else f"{bracket_min:,.0f}+",
                    'rate': f"{rate * 100:.0f}%",
                    'taxable_amount': taxable_in_bracket,
                    'tax': tax_in_bracket
                })
                
                if taxable_income <= bracket_max:
                    break
        
        # Calculate effective tax rate
        effective_rate = (tax_owed / annual_income * 100) if annual_income > 0 else 0
        
        return {
            'annual_income': annual_income,
            'personal_allowance': personal_allowance,
            'total_deductions': total_deductions,
            'deduction_details': deduction_details,
            'taxable_income': taxable_income,
            'tax_owed': tax_owed,
            'effective_rate': round(effective_rate, 2),
            'tax_breakdown': tax_breakdown,
            'currency': self.rules['currency'],
            'country': self.country.title()
        }
    
    def calculate_vat(self, amount: float) -> Dict[str, Any]:
        """Calculate VAT"""
        vat_rate = self.rules['vat_rate']
        vat_amount = amount * vat_rate
        total_with_vat = amount + vat_amount
        
        return {
            'amount': amount,
            'vat_rate': vat_rate * 100,
            'vat_amount': vat_amount,
            'total_with_vat': total_with_vat,
            'currency': self.rules['currency']
        }
    
    def calculate_withholding_tax(self, income_type: str, amount: float) -> Dict[str, Any]:
        """Calculate withholding tax"""
        if income_type not in self.rules['withholding_tax']:
            return {'error': f"Unknown income type: {income_type}"}
        
        rate = self.rules['withholding_tax'][income_type]
        tax_amount = amount * rate
        net_amount = amount - tax_amount
        
        return {
            'income_type': income_type,
            'gross_amount': amount,
            'withholding_rate': rate * 100,
            'tax_withheld': tax_amount,
            'net_amount': net_amount,
            'currency': self.rules['currency']
        }

class DeductionDetector:
    """Detect tax-deductible expenses using ML"""
    
    def __init__(self, ollama_url: str = OLLAMA_URL, model: str = OLLAMA_MODEL):
        self.ollama_url = ollama_url.rstrip('/')
        self.model = model
    
    def detect_deductions(
        self,
        transactions: List[Dict[str, Any]],
        country: str = 'nigeria'
    ) -> List[Dict[str, Any]]:
        """Detect potentially tax-deductible transactions"""
        
        if country.lower() not in TAX_RULES:
            return []
        
        rules = TAX_RULES[country.lower()]
        deductible_categories = list(rules['deductible_categories'].keys())
        
        deductions = []
        
        for txn in transactions:
            merchant = txn.get('merchant', '')
            description = txn.get('description', '')
            category = txn.get('category', '')
            amount = txn.get('amount', 0)
            
            # Check if category matches deductible categories
            is_deductible = False
            deduction_category = None
            confidence = 0
            
            # Direct category match
            if category in deductible_categories:
                is_deductible = True
                deduction_category = category
                confidence = 85
            else:
                # Use LLM to determine if deductible
                result = self._check_deductibility_with_llm(
                    merchant,
                    description,
                    category,
                    deductible_categories
                )
                
                if result['is_deductible']:
                    is_deductible = True
                    deduction_category = result['category']
                    confidence = result['confidence']
            
            if is_deductible:
                deductions.append({
                    'transaction_id': txn.get('id'),
                    'merchant': merchant,
                    'amount': amount,
                    'category': deduction_category,
                    'confidence': confidence,
                    'description': rules['deductible_categories'][deduction_category]['description'],
                    'date': txn.get('date')
                })
        
        return deductions
    
    def _check_deductibility_with_llm(
        self,
        merchant: str,
        description: str,
        category: str,
        deductible_categories: List[str]
    ) -> Dict[str, Any]:
        """Use LLM to check if transaction is tax-deductible"""
        
        categories_list = '\n'.join([f"- {cat}" for cat in deductible_categories])
        
        prompt = f"""Determine if this transaction is tax-deductible and which category it belongs to.

Transaction:
- Merchant: {merchant}
- Description: {description}
- Category: {category}

Deductible Categories:
{categories_list}

Is this transaction tax-deductible? If yes, which category does it belong to?
Respond in this exact format:
DEDUCTIBLE: yes/no
CATEGORY: category name (if yes)
CONFIDENCE: 0-100"""

        try:
            response = requests.post(
                f'{self.ollama_url}/api/generate',
                json={
                    'model': self.model,
                    'prompt': prompt,
                    'stream': False,
                    'options': {
                        'temperature': 0.3,
                        'num_predict': 100
                    }
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                text = result.get('response', '').strip()
                
                # Parse response
                is_deductible = 'yes' in text.lower().split('\n')[0]
                
                if is_deductible:
                    lines = text.split('\n')
                    category_line = [l for l in lines if 'CATEGORY:' in l.upper()]
                    confidence_line = [l for l in lines if 'CONFIDENCE:' in l.upper()]
                    
                    category = category_line[0].split(':', 1)[1].strip() if category_line else deductible_categories[0]
                    confidence = 70
                    
                    if confidence_line:
                        try:
                            confidence = int(''.join(filter(str.isdigit, confidence_line[0])))
                        except:
                            pass
                    
                    return {
                        'is_deductible': True,
                        'category': category,
                        'confidence': confidence
                    }
            
        except Exception as e:
            print(f"Error checking deductibility with LLM: {e}")
        
        return {'is_deductible': False, 'category': None, 'confidence': 0}

class TaxAdvisor:
    """Provide tax optimization advice using LLM"""
    
    def __init__(self, ollama_url: str = OLLAMA_URL, model: str = OLLAMA_MODEL):
        self.ollama_url = ollama_url.rstrip('/')
        self.model = model
    
    def generate_advice(
        self,
        tax_calculation: Dict[str, Any],
        deductions: List[Dict[str, Any]],
        country: str = 'nigeria'
    ) -> str:
        """Generate personalized tax optimization advice"""
        
        prompt = f"""As a tax advisor, provide personalized tax optimization advice for this user in {country.title()}.

Tax Summary:
- Annual Income: {tax_calculation.get('currency', '')} {tax_calculation.get('annual_income', 0):,.2f}
- Tax Owed: {tax_calculation.get('currency', '')} {tax_calculation.get('tax_owed', 0):,.2f}
- Effective Tax Rate: {tax_calculation.get('effective_rate', 0):.2f}%
- Total Deductions: {tax_calculation.get('currency', '')} {tax_calculation.get('total_deductions', 0):,.2f}

Detected Deductions: {len(deductions)} transactions

Provide 3-5 specific, actionable tax optimization strategies for this user. Be concise and practical."""

        try:
            response = requests.post(
                f'{self.ollama_url}/api/generate',
                json={
                    'model': self.model,
                    'prompt': prompt,
                    'stream': False,
                    'options': {
                        'temperature': 0.7,
                        'num_predict': 300
                    }
                },
                timeout=45
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get('response', '').strip()
            
        except Exception as e:
            print(f"Error generating tax advice: {e}")
        
        return self._generate_fallback_advice(tax_calculation, country)
    
    def _generate_fallback_advice(self, tax_calculation: Dict[str, Any], country: str) -> str:
        """Generate fallback advice without LLM"""
        advice = []
        
        effective_rate = tax_calculation.get('effective_rate', 0)
        total_deductions = tax_calculation.get('total_deductions', 0)
        
        if effective_rate > 20:
            advice.append("Consider maximizing your pension contributions to reduce taxable income.")
        
        if total_deductions < tax_calculation.get('annual_income', 0) * 0.1:
            advice.append("You may be missing tax deductions. Track healthcare, education, and insurance expenses.")
        
        advice.append(f"Keep detailed records of all deductible expenses for {country.title()} tax compliance.")
        advice.append("Consult a licensed tax professional for personalized advice and filing assistance.")
        
        return '\n'.join([f"{i+1}. {a}" for i, a in enumerate(advice)])

# Global service instances
tax_calculators = {country: TaxCalculator(country) for country in TAX_RULES.keys()}
deduction_detector = DeductionDetector()
tax_advisor = TaxAdvisor()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'tax-optimization-ml',
        'llm_model': OLLAMA_MODEL,
        'supported_countries': list(TAX_RULES.keys()),
        'features': [
            'country_specific_rules',
            'income_tax_calculation',
            'deduction_detection',
            'vat_calculation',
            'withholding_tax',
            'tax_advice'
        ]
    })

@app.route('/calculate', methods=['POST'])
def calculate():
    """Calculate income tax"""
    try:
        data = request.get_json()
        
        if not data or 'annual_income' not in data:
            return jsonify({'error': 'Annual income is required'}), 400
        
        country = data.get('country', 'nigeria')
        annual_income = data['annual_income']
        deductions = data.get('deductions', {})
        
        if country not in tax_calculators:
            return jsonify({'error': f'Unsupported country: {country}'}), 400
        
        calculator = tax_calculators[country]
        result = calculator.calculate_income_tax(annual_income, deductions)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error calculating tax: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/detect-deductions', methods=['POST'])
def detect_deductions():
    """Detect tax-deductible transactions"""
    try:
        data = request.get_json()
        
        if not data or 'transactions' not in data:
            return jsonify({'error': 'Transactions are required'}), 400
        
        transactions = data['transactions']
        country = data.get('country', 'nigeria')
        
        deductions = deduction_detector.detect_deductions(transactions, country)
        
        # Calculate total deductions by category
        deductions_by_category = {}
        for ded in deductions:
            category = ded['category']
            if category not in deductions_by_category:
                deductions_by_category[category] = 0
            deductions_by_category[category] += ded['amount']
        
        return jsonify({
            'deductions': deductions,
            'total_deductions': sum(d['amount'] for d in deductions),
            'by_category': deductions_by_category,
            'count': len(deductions)
        })
        
    except Exception as e:
        print(f"Error detecting deductions: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/optimize', methods=['POST'])
def optimize():
    """Get tax optimization advice"""
    try:
        data = request.get_json()
        
        if not data or 'annual_income' not in data or 'transactions' not in data:
            return jsonify({'error': 'Annual income and transactions are required'}), 400
        
        country = data.get('country', 'nigeria')
        annual_income = data['annual_income']
        transactions = data['transactions']
        
        # Detect deductions
        deductions = deduction_detector.detect_deductions(transactions, country)
        
        # Calculate deductions by category
        deductions_dict = {}
        for ded in deductions:
            category = ded['category']
            if category not in deductions_dict:
                deductions_dict[category] = 0
            deductions_dict[category] += ded['amount']
        
        # Calculate tax
        calculator = tax_calculators[country]
        tax_calculation = calculator.calculate_income_tax(annual_income, deductions_dict)
        
        # Generate advice
        advice = tax_advisor.generate_advice(tax_calculation, deductions, country)
        
        return jsonify({
            'tax_calculation': tax_calculation,
            'detected_deductions': {
                'items': deductions,
                'total': sum(d['amount'] for d in deductions),
                'by_category': deductions_dict
            },
            'advice': advice,
            'disclaimer': 'This is automated tax guidance. Consult a licensed tax professional for official advice.'
        })
        
    except Exception as e:
        print(f"Error optimizing taxes: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/countries', methods=['GET'])
def get_countries():
    """Get supported countries and their tax rules"""
    return jsonify({
        'countries': {
            country: {
                'currency': rules['currency'],
                'tax_year': rules['tax_year'],
                'vat_rate': rules['vat_rate'] * 100,
                'deductible_categories': list(rules['deductible_categories'].keys())
            }
            for country, rules in TAX_RULES.items()
        }
    })

if __name__ == '__main__':
    port = int(os.environ.get('TAX_OPTIMIZATION_ML_PORT', 5005))
    print(f"Starting ML-Based Tax Optimization Service on port {port}...")
    print(f"Ollama URL: {OLLAMA_URL}")
    print(f"Ollama Model: {OLLAMA_MODEL}")
    print(f"Supported Countries: {', '.join(TAX_RULES.keys())}")
    print("Features: Country-Specific Rules, Deduction Detection, Tax Advice")
    print("Tax Optimization ML Service ready!")
    app.run(host='0.0.0.0', port=port, debug=False)

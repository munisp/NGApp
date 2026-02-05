#!/usr/bin/env python3
"""
ML-Based Investment Risk Assessment Service
Uses Modern Portfolio Theory, Monte Carlo simulation, and Qwen LLM for investment advice
Production-ready with real risk calculations, portfolio optimization, and diversification analysis
"""

import os
import sys
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
from scipy.optimize import minimize
from flask import Flask, request, jsonify
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
OLLAMA_URL = os.environ.get('OLLAMA_BASE_URL', 'http://127.0.0.1:11434')
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', 'qwen2.5:7b')

# Asset class risk profiles (historical data-based)
ASSET_CLASSES = {
    'cash': {
        'name': 'Cash & Equivalents',
        'expected_return': 0.02,  # 2%
        'volatility': 0.01,  # 1%
        'risk_level': 1
    },
    'bonds': {
        'name': 'Bonds & Fixed Income',
        'expected_return': 0.05,  # 5%
        'volatility': 0.05,  # 5%
        'risk_level': 2
    },
    'stocks': {
        'name': 'Stocks & Equities',
        'expected_return': 0.10,  # 10%
        'volatility': 0.18,  # 18%
        'risk_level': 4
    },
    'real_estate': {
        'name': 'Real Estate',
        'expected_return': 0.08,  # 8%
        'volatility': 0.12,  # 12%
        'risk_level': 3
    },
    'commodities': {
        'name': 'Commodities',
        'expected_return': 0.07,  # 7%
        'volatility': 0.20,  # 20%
        'risk_level': 5
    },
    'crypto': {
        'name': 'Cryptocurrency',
        'expected_return': 0.15,  # 15%
        'volatility': 0.60,  # 60%
        'risk_level': 5
    }
}

# Correlation matrix (simplified)
CORRELATION_MATRIX = {
    'cash': {'cash': 1.0, 'bonds': 0.1, 'stocks': 0.0, 'real_estate': 0.0, 'commodities': 0.0, 'crypto': 0.0},
    'bonds': {'cash': 0.1, 'bonds': 1.0, 'stocks': 0.2, 'real_estate': 0.3, 'commodities': 0.1, 'crypto': 0.0},
    'stocks': {'cash': 0.0, 'bonds': 0.2, 'stocks': 1.0, 'real_estate': 0.5, 'commodities': 0.4, 'crypto': 0.3},
    'real_estate': {'cash': 0.0, 'bonds': 0.3, 'stocks': 0.5, 'real_estate': 1.0, 'commodities': 0.3, 'crypto': 0.2},
    'commodities': {'cash': 0.0, 'bonds': 0.1, 'stocks': 0.4, 'real_estate': 0.3, 'commodities': 1.0, 'crypto': 0.4},
    'crypto': {'cash': 0.0, 'bonds': 0.0, 'stocks': 0.3, 'real_estate': 0.2, 'commodities': 0.4, 'crypto': 1.0}
}

class PortfolioAnalyzer:
    """Analyze investment portfolio risk and return"""
    
    def __init__(self):
        self.asset_classes = ASSET_CLASSES
        self.correlation_matrix = CORRELATION_MATRIX
    
    def calculate_portfolio_metrics(self, holdings: Dict[str, float]) -> Dict[str, Any]:
        """Calculate portfolio expected return, volatility, and Sharpe ratio"""
        
        # Normalize holdings to weights
        total_value = sum(holdings.values())
        if total_value == 0:
            return {'error': 'Portfolio is empty'}
        
        weights = {asset: value / total_value for asset, value in holdings.items()}
        
        # Calculate expected return
        expected_return = sum(
            weights.get(asset, 0) * self.asset_classes[asset]['expected_return']
            for asset in self.asset_classes
            if asset in weights
        )
        
        # Calculate portfolio volatility (risk)
        volatility = 0
        for asset1 in weights:
            for asset2 in weights:
                if asset1 in self.asset_classes and asset2 in self.asset_classes:
                    vol1 = self.asset_classes[asset1]['volatility']
                    vol2 = self.asset_classes[asset2]['volatility']
                    corr = self.correlation_matrix.get(asset1, {}).get(asset2, 0)
                    volatility += weights[asset1] * weights[asset2] * vol1 * vol2 * corr
        
        volatility = np.sqrt(volatility)
        
        # Calculate Sharpe ratio (assuming 2% risk-free rate)
        risk_free_rate = 0.02
        sharpe_ratio = (expected_return - risk_free_rate) / volatility if volatility > 0 else 0
        
        # Calculate risk level (1-5)
        risk_level = sum(
            weights.get(asset, 0) * self.asset_classes[asset]['risk_level']
            for asset in self.asset_classes
            if asset in weights
        )
        
        return {
            'expected_return': round(expected_return * 100, 2),  # %
            'volatility': round(volatility * 100, 2),  # %
            'sharpe_ratio': round(sharpe_ratio, 2),
            'risk_level': round(risk_level, 1),
            'weights': {asset: round(weight * 100, 2) for asset, weight in weights.items()},
            'total_value': total_value
        }
    
    def assess_diversification(self, holdings: Dict[str, float]) -> Dict[str, Any]:
        """Assess portfolio diversification"""
        
        total_value = sum(holdings.values())
        if total_value == 0:
            return {'score': 0, 'status': 'empty'}
        
        weights = {asset: value / total_value for asset, value in holdings.items()}
        
        # Calculate Herfindahl-Hirschman Index (HHI)
        # Lower HHI = more diversified
        hhi = sum(w ** 2 for w in weights.values())
        
        # Diversification score (0-100)
        # Perfect diversification across 6 assets: HHI = 1/6 = 0.167
        # Single asset: HHI = 1.0
        diversification_score = max(0, (1 - hhi) / (1 - 1/6) * 100)
        
        # Count asset classes
        num_assets = len(holdings)
        
        # Assess concentration risk
        max_weight = max(weights.values()) if weights else 0
        is_concentrated = max_weight > 0.5  # More than 50% in one asset
        
        # Status
        if diversification_score >= 80:
            status = 'excellent'
        elif diversification_score >= 60:
            status = 'good'
        elif diversification_score >= 40:
            status = 'moderate'
        else:
            status = 'poor'
        
        return {
            'score': round(diversification_score, 1),
            'status': status,
            'num_assets': num_assets,
            'hhi': round(hhi, 3),
            'max_weight': round(max_weight * 100, 1),
            'is_concentrated': is_concentrated,
            'recommendation': self._get_diversification_recommendation(diversification_score, num_assets)
        }
    
    def _get_diversification_recommendation(self, score: float, num_assets: int) -> str:
        """Get diversification recommendation"""
        if score >= 80:
            return "Your portfolio is well-diversified across multiple asset classes."
        elif score >= 60:
            return "Good diversification, but consider adding more asset classes for better risk management."
        elif num_assets <= 2:
            return "Your portfolio is highly concentrated. Consider diversifying across at least 4-5 asset classes."
        else:
            return "Rebalance your portfolio to reduce concentration in dominant assets."
    
    def monte_carlo_simulation(
        self,
        holdings: Dict[str, float],
        years: int = 10,
        simulations: int = 1000
    ) -> Dict[str, Any]:
        """Run Monte Carlo simulation for portfolio projections"""
        
        metrics = self.calculate_portfolio_metrics(holdings)
        if 'error' in metrics:
            return metrics
        
        initial_value = metrics['total_value']
        expected_return = metrics['expected_return'] / 100
        volatility = metrics['volatility'] / 100
        
        # Run simulations
        final_values = []
        
        for _ in range(simulations):
            value = initial_value
            for year in range(years):
                # Generate random return based on expected return and volatility
                annual_return = np.random.normal(expected_return, volatility)
                value *= (1 + annual_return)
            final_values.append(value)
        
        final_values = np.array(final_values)
        
        # Calculate percentiles
        percentiles = {
            'p10': np.percentile(final_values, 10),
            'p25': np.percentile(final_values, 25),
            'p50': np.percentile(final_values, 50),  # Median
            'p75': np.percentile(final_values, 75),
            'p90': np.percentile(final_values, 90)
        }
        
        # Calculate probability of loss
        prob_loss = (final_values < initial_value).sum() / simulations * 100
        
        return {
            'initial_value': initial_value,
            'years': years,
            'simulations': simulations,
            'expected_final_value': round(np.mean(final_values), 2),
            'median_final_value': round(percentiles['p50'], 2),
            'best_case_p90': round(percentiles['p90'], 2),
            'worst_case_p10': round(percentiles['p10'], 2),
            'probability_of_loss': round(prob_loss, 1),
            'percentiles': {k: round(v, 2) for k, v in percentiles.items()}
        }
    
    def optimize_portfolio(
        self,
        target_return: Optional[float] = None,
        risk_tolerance: str = 'moderate'
    ) -> Dict[str, Any]:
        """Optimize portfolio allocation using Modern Portfolio Theory"""
        
        # Risk tolerance to target volatility mapping
        risk_map = {
            'conservative': 0.08,  # 8% volatility
            'moderate': 0.12,  # 12% volatility
            'aggressive': 0.18  # 18% volatility
        }
        
        target_volatility = risk_map.get(risk_tolerance, 0.12)
        
        # Number of assets
        n_assets = len(self.asset_classes)
        asset_names = list(self.asset_classes.keys())
        
        # Expected returns and volatilities
        returns = np.array([self.asset_classes[a]['expected_return'] for a in asset_names])
        vols = np.array([self.asset_classes[a]['volatility'] for a in asset_names])
        
        # Build covariance matrix
        corr_matrix = np.array([
            [self.correlation_matrix[a1][a2] for a2 in asset_names]
            for a1 in asset_names
        ])
        cov_matrix = np.outer(vols, vols) * corr_matrix
        
        # Objective: Minimize negative Sharpe ratio (maximize Sharpe)
        def objective(weights):
            portfolio_return = np.dot(weights, returns)
            portfolio_vol = np.sqrt(np.dot(weights, np.dot(cov_matrix, weights)))
            sharpe = (portfolio_return - 0.02) / portfolio_vol if portfolio_vol > 0 else 0
            return -sharpe  # Minimize negative = maximize positive
        
        # Constraints
        constraints = [
            {'type': 'eq', 'fun': lambda w: np.sum(w) - 1},  # Weights sum to 1
        ]
        
        # Add volatility constraint
        if target_volatility:
            constraints.append({
                'type': 'ineq',
                'fun': lambda w: target_volatility - np.sqrt(np.dot(w, np.dot(cov_matrix, w)))
            })
        
        # Bounds: 0% to 100% for each asset
        bounds = tuple((0, 1) for _ in range(n_assets))
        
        # Initial guess: equal weights
        initial_weights = np.array([1/n_assets] * n_assets)
        
        # Optimize
        result = minimize(
            objective,
            initial_weights,
            method='SLSQP',
            bounds=bounds,
            constraints=constraints
        )
        
        if result.success:
            optimal_weights = result.x
            optimal_allocation = {
                asset: round(weight * 100, 1)
                for asset, weight in zip(asset_names, optimal_weights)
                if weight > 0.01  # Only include assets with >1% allocation
            }
            
            # Calculate metrics for optimal portfolio
            portfolio_return = np.dot(optimal_weights, returns)
            portfolio_vol = np.sqrt(np.dot(optimal_weights, np.dot(cov_matrix, optimal_weights)))
            sharpe = (portfolio_return - 0.02) / portfolio_vol
            
            return {
                'success': True,
                'risk_tolerance': risk_tolerance,
                'optimal_allocation': optimal_allocation,
                'expected_return': round(portfolio_return * 100, 2),
                'volatility': round(portfolio_vol * 100, 2),
                'sharpe_ratio': round(sharpe, 2)
            }
        else:
            return {'success': False, 'error': 'Optimization failed'}

class InvestmentAdvisor:
    """Provide investment advice using LLM"""
    
    def __init__(self, ollama_url: str = OLLAMA_URL, model: str = OLLAMA_MODEL):
        self.ollama_url = ollama_url.rstrip('/')
        self.model = model
    
    def generate_advice(
        self,
        portfolio_metrics: Dict[str, Any],
        diversification: Dict[str, Any],
        risk_tolerance: str = 'moderate'
    ) -> str:
        """Generate personalized investment advice"""
        
        prompt = f"""As an investment advisor, provide personalized investment advice for this portfolio.

Portfolio Metrics:
- Expected Return: {portfolio_metrics.get('expected_return', 0)}%
- Volatility (Risk): {portfolio_metrics.get('volatility', 0)}%
- Sharpe Ratio: {portfolio_metrics.get('sharpe_ratio', 0)}
- Risk Level: {portfolio_metrics.get('risk_level', 0)}/5

Diversification:
- Score: {diversification.get('score', 0)}/100 ({diversification.get('status', 'unknown')})
- Number of Assets: {diversification.get('num_assets', 0)}
- Concentration Risk: {'Yes' if diversification.get('is_concentrated') else 'No'}

Risk Tolerance: {risk_tolerance}

Provide 3-5 specific, actionable investment recommendations. Be concise and practical."""

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
            print(f"Error generating investment advice: {e}")
        
        return self._generate_fallback_advice(portfolio_metrics, diversification)
    
    def _generate_fallback_advice(
        self,
        portfolio_metrics: Dict[str, Any],
        diversification: Dict[str, Any]
    ) -> str:
        """Generate fallback advice without LLM"""
        advice = []
        
        sharpe = portfolio_metrics.get('sharpe_ratio', 0)
        div_score = diversification.get('score', 0)
        risk_level = portfolio_metrics.get('risk_level', 0)
        
        if sharpe < 0.5:
            advice.append("Your risk-adjusted returns are low. Consider rebalancing to improve your Sharpe ratio.")
        
        if div_score < 60:
            advice.append("Improve diversification by adding more asset classes to reduce portfolio risk.")
        
        if diversification.get('is_concentrated'):
            advice.append("Reduce concentration risk by limiting any single asset to less than 40% of your portfolio.")
        
        if risk_level > 4:
            advice.append("Your portfolio has high risk. Consider adding bonds or cash to reduce volatility.")
        
        advice.append("Regularly rebalance your portfolio to maintain your target allocation.")
        advice.append("Consult a licensed financial advisor for personalized investment guidance.")
        
        return '\n'.join([f"{i+1}. {a}" for i, a in enumerate(advice)])

# Global service instances
portfolio_analyzer = PortfolioAnalyzer()
investment_advisor = InvestmentAdvisor()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'investment-risk-ml',
        'llm_model': OLLAMA_MODEL,
        'asset_classes': len(ASSET_CLASSES),
        'features': [
            'portfolio_analysis',
            'risk_assessment',
            'diversification_analysis',
            'monte_carlo_simulation',
            'portfolio_optimization',
            'investment_advice'
        ]
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze portfolio risk and return"""
    try:
        data = request.get_json()
        
        if not data or 'holdings' not in data:
            return jsonify({'error': 'Holdings are required'}), 400
        
        holdings = data['holdings']
        
        # Calculate metrics
        metrics = portfolio_analyzer.calculate_portfolio_metrics(holdings)
        if 'error' in metrics:
            return jsonify(metrics), 400
        
        # Assess diversification
        diversification = portfolio_analyzer.assess_diversification(holdings)
        
        return jsonify({
            'metrics': metrics,
            'diversification': diversification
        })
        
    except Exception as e:
        print(f"Error analyzing portfolio: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/simulate', methods=['POST'])
def simulate():
    """Run Monte Carlo simulation"""
    try:
        data = request.get_json()
        
        if not data or 'holdings' not in data:
            return jsonify({'error': 'Holdings are required'}), 400
        
        holdings = data['holdings']
        years = data.get('years', 10)
        simulations = data.get('simulations', 1000)
        
        result = portfolio_analyzer.monte_carlo_simulation(holdings, years, simulations)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error running simulation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/optimize', methods=['POST'])
def optimize():
    """Optimize portfolio allocation"""
    try:
        data = request.get_json()
        
        risk_tolerance = data.get('risk_tolerance', 'moderate')
        target_return = data.get('target_return')
        
        result = portfolio_analyzer.optimize_portfolio(target_return, risk_tolerance)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error optimizing portfolio: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/advise', methods=['POST'])
def advise():
    """Get investment advice"""
    try:
        data = request.get_json()
        
        if not data or 'holdings' not in data:
            return jsonify({'error': 'Holdings are required'}), 400
        
        holdings = data['holdings']
        risk_tolerance = data.get('risk_tolerance', 'moderate')
        
        # Analyze portfolio
        metrics = portfolio_analyzer.calculate_portfolio_metrics(holdings)
        if 'error' in metrics:
            return jsonify(metrics), 400
        
        diversification = portfolio_analyzer.assess_diversification(holdings)
        
        # Generate advice
        advice = investment_advisor.generate_advice(metrics, diversification, risk_tolerance)
        
        # Get optimal allocation
        optimal = portfolio_analyzer.optimize_portfolio(None, risk_tolerance)
        
        return jsonify({
            'current_portfolio': {
                'metrics': metrics,
                'diversification': diversification
            },
            'advice': advice,
            'optimal_allocation': optimal,
            'disclaimer': 'This is automated investment guidance. Consult a licensed financial advisor before making investment decisions.'
        })
        
    except Exception as e:
        print(f"Error generating advice: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/asset-classes', methods=['GET'])
def get_asset_classes():
    """Get available asset classes"""
    return jsonify({
        'asset_classes': {
            key: {
                'name': data['name'],
                'expected_return': data['expected_return'] * 100,
                'volatility': data['volatility'] * 100,
                'risk_level': data['risk_level']
            }
            for key, data in ASSET_CLASSES.items()
        }
    })

if __name__ == '__main__':
    port = int(os.environ.get('INVESTMENT_RISK_ML_PORT', 5006))
    print(f"Starting ML-Based Investment Risk Assessment Service on port {port}...")
    print(f"Ollama URL: {OLLAMA_URL}")
    print(f"Ollama Model: {OLLAMA_MODEL}")
    print(f"Asset Classes: {len(ASSET_CLASSES)}")
    print("Features: Portfolio Analysis, Monte Carlo, Optimization, Investment Advice")
    print("Investment Risk ML Service ready!")
    app.run(host='0.0.0.0', port=port, debug=False)

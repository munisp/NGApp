#!/usr/bin/env python3
"""
Tax Optimization Suggestions Service
Provides AI-powered tax planning and optimization strategies
"""

import sys
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any

def calculate_tax_loss_harvesting_opportunities(portfolio: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Identify tax-loss harvesting opportunities in the portfolio
    """
    opportunities = []
    
    for holding in portfolio:
        purchase_price = holding.get("purchasePrice", 0)
        current_price = holding.get("currentPrice", 0)
        quantity = holding.get("quantity", 0)
        symbol = holding.get("symbol", "")
        
        loss = (purchase_price - current_price) * quantity
        
        if loss > 100:  # Significant loss threshold
            opportunities.append({
                "symbol": symbol,
                "action": "sell_for_tax_loss",
                "potentialSavings": loss * 0.25,  # Assuming 25% tax rate
                "currentLoss": loss,
                "recommendation": f"Consider selling {symbol} to realize ${loss:.2f} in losses. This could save you approximately ${loss * 0.25:.2f} in taxes.",
                "risk": "medium",
                "timing": "before_year_end"
            })
    
    return opportunities

def calculate_optimal_withdrawal_timing(accounts: List[Dict[str, Any]], age: int) -> List[Dict[str, Any]]:
    """
    Calculate optimal withdrawal timing for retirement accounts
    """
    suggestions = []
    
    # Check for RMD requirements (Required Minimum Distributions)
    if age >= 73:
        for account in accounts:
            if account.get("type") in ["401k", "traditional_ira"]:
                balance = account.get("balance", 0)
                rmd_amount = balance / (110.5 - age)  # Simplified RMD calculation
                
                suggestions.append({
                    "accountId": account.get("id"),
                    "accountName": account.get("name"),
                    "action": "required_minimum_distribution",
                    "amount": rmd_amount,
                    "deadline": f"{datetime.now().year}-12-31",
                    "recommendation": f"You must withdraw at least ${rmd_amount:,.2f} from your {account.get('name')} by December 31 to avoid penalties.",
                    "penalty": rmd_amount * 0.50,  # 50% penalty for missing RMD
                    "priority": "high"
                })
    
    # Suggest Roth conversions during low-income years
    total_income = sum(acc.get("annualIncome", 0) for acc in accounts)
    if total_income < 50000:  # Low income year
        for account in accounts:
            if account.get("type") == "traditional_ira":
                balance = account.get("balance", 0)
                conversion_amount = min(balance, 25000)  # Convert up to $25k
                
                suggestions.append({
                    "accountId": account.get("id"),
                    "accountName": account.get("name"),
                    "action": "roth_conversion",
                    "amount": conversion_amount,
                    "recommendation": f"Consider converting ${conversion_amount:,.2f} to a Roth IRA this year while you're in a lower tax bracket.",
                    "taxImpact": conversion_amount * 0.12,  # 12% tax bracket
                    "longTermBenefit": conversion_amount * 0.10,  # Estimated long-term tax savings
                    "priority": "medium"
                })
    
    return suggestions

def calculate_deduction_maximization(expenses: List[Dict[str, Any]], income: float) -> List[Dict[str, Any]]:
    """
    Identify opportunities to maximize tax deductions
    """
    strategies = []
    
    # Calculate current deductions
    charitable_donations = sum(e.get("amount", 0) for e in expenses if e.get("category") == "charity")
    medical_expenses = sum(e.get("amount", 0) for e in expenses if e.get("category") == "medical")
    business_expenses = sum(e.get("amount", 0) for e in expenses if e.get("category") == "business")
    
    # Charitable donation strategies
    if charitable_donations > 0:
        strategies.append({
            "category": "charitable_donations",
            "currentAmount": charitable_donations,
            "strategy": "donor_advised_fund",
            "recommendation": "Consider bunching multiple years of charitable donations into a Donor-Advised Fund to exceed the standard deduction threshold.",
            "potentialSavings": charitable_donations * 0.24,  # 24% tax bracket
            "implementation": "Open a DAF account and contribute this year's and next year's donations now.",
            "priority": "medium"
        })
    
    # Medical expense strategies
    if medical_expenses > income * 0.075:  # Exceeds 7.5% AGI threshold
        deductible_medical = medical_expenses - (income * 0.075)
        strategies.append({
            "category": "medical_expenses",
            "currentAmount": medical_expenses,
            "deductibleAmount": deductible_medical,
            "strategy": "itemize_medical",
            "recommendation": f"Your medical expenses exceed 7.5% of your income. You can deduct ${deductible_medical:,.2f}.",
            "potentialSavings": deductible_medical * 0.22,
            "implementation": "Keep all medical receipts and itemize deductions on Schedule A.",
            "priority": "high"
        })
    
    # Retirement contribution strategies
    max_401k = 23000  # 2024 limit
    max_ira = 7000    # 2024 limit
    
    strategies.append({
        "category": "retirement_contributions",
        "strategy": "maximize_401k",
        "recommendation": f"Maximize your 401(k) contributions to ${max_401k:,.0f} to reduce taxable income.",
        "potentialSavings": max_401k * 0.24,
        "implementation": "Increase your 401(k) contribution percentage through your employer's benefits portal.",
        "priority": "high"
    })
    
    strategies.append({
        "category": "retirement_contributions",
        "strategy": "traditional_ira",
        "recommendation": f"Contribute ${max_ira:,.0f} to a Traditional IRA for additional tax deduction.",
        "potentialSavings": max_ira * 0.22,
        "implementation": "Open a Traditional IRA and make contributions before tax deadline.",
        "priority": "medium"
    })
    
    # HSA strategy (if applicable)
    hsa_max = 4150  # 2024 individual limit
    strategies.append({
        "category": "health_savings",
        "strategy": "maximize_hsa",
        "recommendation": f"Contribute to an HSA (${hsa_max:,.0f} limit) for triple tax benefits.",
        "potentialSavings": hsa_max * 0.22,
        "implementation": "Enroll in a high-deductible health plan and open an HSA account.",
        "priority": "medium"
    })
    
    return strategies

def generate_tax_planning_calendar() -> List[Dict[str, Any]]:
    """
    Generate tax planning calendar with key deadlines
    """
    current_year = datetime.now().year
    
    deadlines = [
        {
            "date": f"{current_year}-01-31",
            "title": "IRA Contribution Deadline (Prior Year)",
            "description": "Last day to contribute to IRA for the previous tax year",
            "action": "Make IRA contributions",
            "priority": "high"
        },
        {
            "date": f"{current_year}-04-15",
            "title": "Tax Filing Deadline",
            "description": "Deadline to file federal income tax return",
            "action": "File tax return or request extension",
            "priority": "critical"
        },
        {
            "date": f"{current_year}-04-15",
            "title": "Q1 Estimated Tax Payment",
            "description": "First quarterly estimated tax payment due",
            "action": "Pay Q1 estimated taxes",
            "priority": "high"
        },
        {
            "date": f"{current_year}-06-15",
            "title": "Q2 Estimated Tax Payment",
            "description": "Second quarterly estimated tax payment due",
            "action": "Pay Q2 estimated taxes",
            "priority": "high"
        },
        {
            "date": f"{current_year}-09-15",
            "title": "Q3 Estimated Tax Payment",
            "description": "Third quarterly estimated tax payment due",
            "action": "Pay Q3 estimated taxes",
            "priority": "high"
        },
        {
            "date": f"{current_year}-10-15",
            "title": "Extended Return Deadline",
            "description": "Deadline for extended tax returns",
            "action": "File extended return",
            "priority": "high"
        },
        {
            "date": f"{current_year}-12-15",
            "title": "Q4 Estimated Tax Payment",
            "description": "Fourth quarterly estimated tax payment due (if not filing by Jan 31)",
            "action": "Pay Q4 estimated taxes",
            "priority": "high"
        },
        {
            "date": f"{current_year}-12-31",
            "title": "Year-End Tax Planning Deadline",
            "description": "Last day for tax-loss harvesting, charitable donations, and retirement contributions",
            "action": "Complete year-end tax strategies",
            "priority": "critical"
        },
        {
            "date": f"{current_year}-12-31",
            "title": "Required Minimum Distribution Deadline",
            "description": "Last day to take RMDs from retirement accounts (age 73+)",
            "action": "Withdraw RMDs",
            "priority": "critical"
        }
    ]
    
    return deadlines

def generate_tax_optimization_report(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate comprehensive tax optimization report
    """
    portfolio = data.get("portfolio", [])
    accounts = data.get("accounts", [])
    expenses = data.get("expenses", [])
    income = data.get("income", 75000)
    age = data.get("age", 35)
    
    # Calculate all optimization opportunities
    tax_loss_opportunities = calculate_tax_loss_harvesting_opportunities(portfolio)
    withdrawal_strategies = calculate_optimal_withdrawal_timing(accounts, age)
    deduction_strategies = calculate_deduction_maximization(expenses, income)
    tax_calendar = generate_tax_planning_calendar()
    
    # Calculate total potential savings
    total_savings = (
        sum(opp.get("potentialSavings", 0) for opp in tax_loss_opportunities) +
        sum(strat.get("potentialSavings", 0) for strat in deduction_strategies)
    )
    
    # Generate AI-powered insights
    insights = []
    
    if len(tax_loss_opportunities) > 0:
        insights.append(f"You have {len(tax_loss_opportunities)} tax-loss harvesting opportunities that could save you ${sum(o.get('potentialSavings', 0) for o in tax_loss_opportunities):,.2f} in taxes.")
    
    if age < 50:
        insights.append("You're in your prime earning years. Focus on maximizing retirement contributions to reduce current tax burden.")
    elif age >= 73:
        insights.append("Don't forget your Required Minimum Distributions (RMDs) to avoid hefty penalties.")
    
    if income < 60000:
        insights.append("Your income qualifies you for the Saver's Credit. Contribute to retirement accounts to claim this credit.")
    
    insights.append("Consider tax-loss harvesting before year-end to offset capital gains.")
    insights.append("Maximize HSA contributions for triple tax benefits: deductible, tax-free growth, and tax-free withdrawals for medical expenses.")
    
    return {
        "summary": {
            "totalPotentialSavings": total_savings,
            "opportunitiesCount": len(tax_loss_opportunities) + len(withdrawal_strategies) + len(deduction_strategies),
            "priorityActions": len([s for s in deduction_strategies if s.get("priority") == "high"]),
            "insights": insights
        },
        "taxLossHarvesting": tax_loss_opportunities,
        "withdrawalStrategies": withdrawal_strategies,
        "deductionStrategies": deduction_strategies,
        "taxCalendar": tax_calendar,
        "generatedAt": datetime.now().isoformat()
    }

def main():
    """Main entry point"""
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data) if input_data else {}
        
        # Generate optimization report
        result = generate_tax_optimization_report(data)
        
        # Output result as JSON
        print(json.dumps(result, indent=2))
        sys.exit(0)
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "message": "Failed to generate tax optimization report"
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()

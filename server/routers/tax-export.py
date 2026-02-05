#!/usr/bin/env python3
"""
Tax Document Export Service
Generates country-specific tax reports for African countries
"""

import json
import sys
from datetime import datetime
from typing import List, Dict, Any

# Tax authority formats for African countries
TAX_AUTHORITIES = {
    "nigeria": {
        "name": "Federal Inland Revenue Service (FIRS)",
        "tin_label": "Tax Identification Number (TIN)",
        "currency": "NGN",
        "tax_year": "Calendar Year",
    },
    "kenya": {
        "name": "Kenya Revenue Authority (KRA)",
        "tin_label": "Personal Identification Number (PIN)",
        "currency": "KES",
        "tax_year": "Calendar Year",
    },
    "ghana": {
        "name": "Ghana Revenue Authority (GRA)",
        "tin_label": "Taxpayer Identification Number (TIN)",
        "currency": "GHS",
        "tax_year": "Calendar Year",
    },
    "south_africa": {
        "name": "South African Revenue Service (SARS)",
        "tin_label": "Tax Reference Number",
        "currency": "ZAR",
        "tax_year": "March 1 - February 28",
    },
}

def categorize_transaction_for_tax(transaction: Dict[str, Any]) -> str:
    """
    Categorize transaction for tax reporting purposes
    """
    category = transaction.get("category", "").lower()
    
    # Map to tax categories
    tax_category_map = {
        "salary": "Employment Income",
        "freelance": "Self-Employment Income",
        "investment": "Investment Income",
        "dividend": "Dividend Income",
        "interest": "Interest Income",
        "rental": "Rental Income",
        "business": "Business Income",
        "food": "Personal Expenses",
        "transport": "Transportation",
        "shopping": "Personal Expenses",
        "bills": "Utilities & Bills",
        "entertainment": "Entertainment",
        "health": "Medical Expenses",
        "education": "Education Expenses",
        "charity": "Charitable Donations",
        "mortgage": "Mortgage Interest",
        "insurance": "Insurance Premiums",
        "tax": "Tax Payments",
    }
    
    return tax_category_map.get(category, "Other Expenses")

def calculate_income_summary(transactions: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Calculate income summary by category
    """
    income_categories = [
        "Employment Income",
        "Self-Employment Income",
        "Investment Income",
        "Dividend Income",
        "Interest Income",
        "Rental Income",
        "Business Income",
    ]
    
    income_summary = {cat: 0.0 for cat in income_categories}
    
    for txn in transactions:
        if txn.get("type") == "credit":  # Income transactions
            tax_category = categorize_transaction_for_tax(txn)
            if tax_category in income_categories:
                income_summary[tax_category] += txn.get("amount", 0)
    
    # Filter out zero amounts
    return {k: v for k, v in income_summary.items() if v > 0}

def calculate_expense_summary(transactions: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Calculate deductible expense summary by category
    """
    deductible_categories = [
        "Medical Expenses",
        "Education Expenses",
        "Charitable Donations",
        "Mortgage Interest",
        "Business Expenses",
    ]
    
    expense_summary = {cat: 0.0 for cat in deductible_categories}
    
    for txn in transactions:
        if txn.get("type") == "debit":  # Expense transactions
            tax_category = categorize_transaction_for_tax(txn)
            if tax_category in deductible_categories:
                expense_summary[tax_category] += txn.get("amount", 0)
    
    # Filter out zero amounts
    return {k: v for k, v in expense_summary.items() if v > 0}

def generate_tax_report(
    country: str,
    tax_year: int,
    taxpayer_name: str,
    tax_id: str,
    transactions: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Generate country-specific tax report
    """
    if country not in TAX_AUTHORITIES:
        raise ValueError(f"Unsupported country: {country}")
    
    authority = TAX_AUTHORITIES[country]
    
    # Calculate summaries
    income_summary = calculate_income_summary(transactions)
    expense_summary = calculate_expense_summary(transactions)
    
    # Calculate totals
    total_income = sum(income_summary.values())
    total_deductions = sum(expense_summary.values())
    taxable_income = total_income - total_deductions
    
    # Calculate estimated tax (simplified rates)
    estimated_tax = calculate_estimated_tax(country, taxable_income)
    
    # Generate report
    report = {
        "country": country,
        "tax_authority": authority["name"],
        "tax_year": tax_year,
        "report_date": datetime.now().isoformat(),
        "taxpayer": {
            "name": taxpayer_name,
            "tax_id": tax_id,
            "tin_label": authority["tin_label"],
        },
        "currency": authority["currency"],
        "income": {
            "categories": income_summary,
            "total": round(total_income, 2),
        },
        "deductions": {
            "categories": expense_summary,
            "total": round(total_deductions, 2),
        },
        "taxable_income": round(taxable_income, 2),
        "estimated_tax": round(estimated_tax, 2),
        "transaction_count": len(transactions),
        "period": {
            "start": min(txn["date"] for txn in transactions) if transactions else 0,
            "end": max(txn["date"] for txn in transactions) if transactions else 0,
        },
    }
    
    return report

def calculate_estimated_tax(country: str, taxable_income: float) -> float:
    """
    Calculate estimated tax based on country-specific tax brackets
    Simplified progressive tax calculation
    """
    # Simplified tax brackets (actual rates vary by country and year)
    tax_brackets = {
        "nigeria": [
            (300000, 0.07),
            (300000, 0.11),
            (500000, 0.15),
            (500000, 0.19),
            (1600000, 0.21),
            (float("inf"), 0.24),
        ],
        "kenya": [
            (288000, 0.10),
            (100000, 0.25),
            (float("inf"), 0.30),
        ],
        "ghana": [
            (4380, 0.00),
            (1000, 0.05),
            (1000, 0.10),
            (40620, 0.175),
            (float("inf"), 0.25),
        ],
        "south_africa": [
            (237100, 0.18),
            (133100, 0.26),
            (63000, 0.31),
            (276900, 0.36),
            (421000, 0.39),
            (550000, 0.41),
            (float("inf"), 0.45),
        ],
    }
    
    brackets = tax_brackets.get(country, [])
    tax = 0.0
    remaining_income = taxable_income
    
    for bracket_limit, rate in brackets:
        if remaining_income <= 0:
            break
        
        taxable_amount = min(remaining_income, bracket_limit)
        tax += taxable_amount * rate
        remaining_income -= taxable_amount
    
    return tax

def format_tax_report_text(report: Dict[str, Any]) -> str:
    """
    Format tax report as plain text for PDF generation
    """
    lines = []
    
    # Header
    lines.append("=" * 80)
    lines.append(f"TAX REPORT - {report['tax_year']}")
    lines.append(f"{report['tax_authority']}")
    lines.append("=" * 80)
    lines.append("")
    
    # Taxpayer Information
    lines.append("TAXPAYER INFORMATION")
    lines.append("-" * 80)
    lines.append(f"Name: {report['taxpayer']['name']}")
    lines.append(f"{report['taxpayer']['tin_label']}: {report['taxpayer']['tax_id']}")
    lines.append(f"Report Date: {datetime.fromisoformat(report['report_date']).strftime('%B %d, %Y')}")
    lines.append(f"Currency: {report['currency']}")
    lines.append("")
    
    # Income Summary
    lines.append("INCOME SUMMARY")
    lines.append("-" * 80)
    for category, amount in report['income']['categories'].items():
        lines.append(f"{category:.<50} {report['currency']} {amount:>15,.2f}")
    lines.append("-" * 80)
    lines.append(f"{'Total Income':.<50} {report['currency']} {report['income']['total']:>15,.2f}")
    lines.append("")
    
    # Deductions Summary
    if report['deductions']['categories']:
        lines.append("DEDUCTIBLE EXPENSES")
        lines.append("-" * 80)
        for category, amount in report['deductions']['categories'].items():
            lines.append(f"{category:.<50} {report['currency']} {amount:>15,.2f}")
        lines.append("-" * 80)
        lines.append(f"{'Total Deductions':.<50} {report['currency']} {report['deductions']['total']:>15,.2f}")
        lines.append("")
    
    # Tax Calculation
    lines.append("TAX CALCULATION")
    lines.append("-" * 80)
    lines.append(f"{'Total Income':.<50} {report['currency']} {report['income']['total']:>15,.2f}")
    lines.append(f"{'Less: Deductions':.<50} {report['currency']} ({report['deductions']['total']:>14,.2f})")
    lines.append("-" * 80)
    lines.append(f"{'Taxable Income':.<50} {report['currency']} {report['taxable_income']:>15,.2f}")
    lines.append(f"{'Estimated Tax':.<50} {report['currency']} {report['estimated_tax']:>15,.2f}")
    lines.append("")
    
    # Footer
    lines.append("=" * 80)
    lines.append(f"Total Transactions Analyzed: {report['transaction_count']}")
    lines.append(f"Period: {datetime.fromtimestamp(report['period']['start']/1000).strftime('%B %d, %Y')} - {datetime.fromtimestamp(report['period']['end']/1000).strftime('%B %d, %Y')}")
    lines.append("")
    lines.append("NOTE: This is an estimated tax report for informational purposes only.")
    lines.append("Please consult with a qualified tax professional for accurate tax filing.")
    lines.append("=" * 80)
    
    return "\n".join(lines)

def main():
    """Main entry point for the tax export service"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        action = input_data.get("action")
        
        if action == "generate_report":
            report = generate_tax_report(
                input_data["country"],
                input_data["tax_year"],
                input_data["taxpayer_name"],
                input_data["tax_id"],
                input_data["transactions"]
            )
            
            # Add formatted text version
            report["formatted_text"] = format_tax_report_text(report)
            
            result = report
        elif action == "get_authorities":
            result = TAX_AUTHORITIES
        else:
            result = {"error": f"Unknown action: {action}"}
        
        # Write result to stdout
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        error_result = {"error": str(e)}
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()

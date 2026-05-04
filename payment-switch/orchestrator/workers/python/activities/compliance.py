"""
Compliance Check Activities
"""

import logging
from typing import Dict, Any, List
from datetime import datetime

from temporalio import activity

logger = logging.getLogger(__name__)


class ComplianceActivities:
    """Compliance and regulatory check activities"""
    
    def __init__(self):
        # Sanctions lists (would load from database in production)
        self.sanctions_list = ['sanctioned_entity_1', 'sanctioned_entity_2']
        self.high_risk_countries = ['XX', 'YY', 'ZZ']
    
    @activity.defn(name="RunComplianceCheck")
    async def run_compliance_check(self, check_request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run comprehensive compliance check
        
        Args:
            check_request: Compliance check request
            
        Returns:
            Compliance check result
        """
        logger.info(f"Running compliance check: {check_request.get('CheckType')}")
        
        check_type = check_request.get('CheckType', 'full')
        merchant_id = check_request.get('MerchantID')
        
        result = {
            'CheckID': f"CHK-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            'Status': 'passed',
            'Score': 0,
            'Issues': [],
            'RequiresReview': False
        }
        
        # Run different checks based on type
        if check_type in ['kyc', 'full']:
            kyc_result = await self.validate_kyc(check_request)
            result['Score'] += kyc_result['score']
            result['Issues'].extend(kyc_result['issues'])
        
        if check_type in ['aml', 'full']:
            sanctions_result = await self.check_sanctions(check_request)
            result['Score'] += sanctions_result['score']
            result['Issues'].extend(sanctions_result['issues'])
        
        # Determine overall status
        if result['Score'] > 80:
            result['Status'] = 'failed'
        elif result['Score'] > 50:
            result['Status'] = 'review'
            result['RequiresReview'] = True
        else:
            result['Status'] = 'passed'
        
        logger.info(f"Compliance check complete: status={result['Status']}, score={result['Score']}")
        return result
    
    @activity.defn(name="ValidateKYC")
    async def validate_kyc(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate KYC (Know Your Customer) information
        
        Args:
            data: KYC data to validate
            
        Returns:
            Validation result
        """
        logger.info("Validating KYC information")
        
        issues = []
        score = 0
        
        # Check business name
        business_name = data.get('application', {}).get('BusinessName', '')
        if len(business_name) < 3:
            issues.append("Invalid business name")
            score += 20
        
        # Check tax ID
        tax_id = data.get('application', {}).get('TaxID', '')
        if not tax_id:
            issues.append("Missing tax ID")
            score += 30
        
        # Check documents
        documents = data.get('Documents', [])
        if len(documents) < 2:
            issues.append("Insufficient documentation")
            score += 25
        
        # Check country risk
        country = data.get('application', {}).get('Country', '')
        if country in self.high_risk_countries:
            issues.append(f"High-risk country: {country}")
            score += 40
        
        return {
            'score': score,
            'issues': issues,
            'passed': score < 50
        }
    
    @activity.defn(name="CheckSanctions")
    async def check_sanctions(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Check against sanctions lists
        
        Args:
            data: Entity data to check
            
        Returns:
            Sanctions check result
        """
        logger.info("Checking sanctions lists")
        
        issues = []
        score = 0
        
        business_name = data.get('application', {}).get('BusinessName', '').lower()
        
        # Check against sanctions list
        for sanctioned_entity in self.sanctions_list:
            if sanctioned_entity.lower() in business_name:
                issues.append(f"Match found on sanctions list: {sanctioned_entity}")
                score += 100  # Automatic fail
                break
        
        # Check beneficial owners (if provided)
        owners = data.get('BeneficialOwners', [])
        for owner in owners:
            owner_name = owner.get('name', '').lower()
            for sanctioned_entity in self.sanctions_list:
                if sanctioned_entity.lower() in owner_name:
                    issues.append(f"Beneficial owner on sanctions list: {owner_name}")
                    score += 100
                    break
        
        return {
            'score': score,
            'issues': issues,
            'passed': score == 0
        }

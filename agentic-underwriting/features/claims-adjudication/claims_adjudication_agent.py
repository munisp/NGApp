"""
Agentic Claims Adjudication System

This agent automates the entire claims adjudication process using
Ollama with the nigerian-insurance-expert model.
"""

import asyncio
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path

from langchain.agents import AgentExecutor, create_structured_chat_agent
from langchain.tools import Tool
from langchain_community.llms import Ollama
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.memory import ConversationBufferMemory

import psycopg2
from psycopg2.extras import RealDictCursor


class ClaimsAdjudicationAgent:
    """
    Autonomous agent for claims adjudication.
    """

    def __init__(
        self,
        llm_model: str = "nigerian-insurance-expert",
        ollama_base_url: str = "http://localhost:11434",
        db_config: Dict[str, str] = None,
    ):
        """
        Initialize Claims Adjudication Agent.

        Args:
            llm_model: Ollama model for agent reasoning
            ollama_base_url: Base URL for Ollama API
            db_config: Database configuration
        """
        self.llm = Ollama(
            model=llm_model,
            base_url=ollama_base_url,
            temperature=0.1,
        )

        self.db_config = db_config or {
            "host": "localhost",
            "port": 5432,
            "database": "insurance_platform",
            "user": "postgres",
            "password": "postgres",
        }

        # Create tools
        self.tools = self._create_tools()

        # Create agent
        self.agent = self._create_agent()

    def _get_db_connection(self):
        """Get database connection."""
        return psycopg2.connect(**self.db_config)

    def _create_tools(self) -> List[Tool]:
        """Create tools for the agent."""
        tools = [
            Tool(
                name="get_policy_details",
                func=self._tool_get_policy_details,
                description="""
                Retrieve policy information from the database.
                Input: policy_id
                Output: policy details including coverage, limits, exclusions
                """,
            ),
            Tool(
                name="get_claim_documents",
                func=self._tool_get_claim_documents,
                description="""
                Access claim documents (e.g., police reports, medical bills).
                Input: claim_id
                Output: list of document paths and types
                """,
            ),
            Tool(
                name="check_policy_coverage",
                func=self._tool_check_policy_coverage,
                description="""
                Check if the claim is covered under the policy.
                Input: JSON with 'policy_id', 'claim_type', 'claim_details'
                Output: coverage determination with reasoning
                """,
            ),
            Tool(
                name="detect_fraud",
                func=self._tool_detect_fraud,
                description="""
                Assess the likelihood of fraud for a claim.
                Input: JSON with 'claim_id', 'policy_id', 'claim_details'
                Output: fraud risk score (0-100) and flags
                """,
            ),
            Tool(
                name="calculate_settlement_amount",
                func=self._tool_calculate_settlement_amount,
                description="""
                Calculate the settlement amount based on policy limits and claim details.
                Input: JSON with 'policy_id', 'claim_amount', 'claim_type'
                Output: calculated settlement amount with breakdown
                """,
            ),
            Tool(
                name="initiate_payment",
                func=self._tool_initiate_payment,
                description="""
                Trigger the payment workflow to settle the claim.
                Input: JSON with 'claim_id', 'beneficiary_account', 'amount'
                Output: payment initiation confirmation
                """,
            ),
        ]

        return tools

    async def _tool_get_policy_details(self, policy_id: str) -> str:
        """Tool: Get policy details from database."""
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            cursor.execute(
                """
                SELECT 
                    policy_id,
                    policy_number,
                    policy_type,
                    sum_assured,
                    premium_amount,
                    start_date,
                    end_date,
                    status,
                    coverage_details,
                    exclusions
                FROM policies
                WHERE policy_id = %s
                """,
                (policy_id,),
            )

            policy = cursor.fetchone()
            cursor.close()
            conn.close()

            if policy:
                return json.dumps(dict(policy), indent=2, default=str)
            else:
                return json.dumps({"error": "Policy not found"})

        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _tool_get_claim_documents(self, claim_id: str) -> str:
        """Tool: Get claim documents."""
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            cursor.execute(
                """
                SELECT 
                    document_id,
                    document_type,
                    document_path,
                    uploaded_at
                FROM claim_documents
                WHERE claim_id = %s
                """,
                (claim_id,),
            )

            documents = cursor.fetchall()
            cursor.close()
            conn.close()

            return json.dumps([dict(doc) for doc in documents], indent=2, default=str)

        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _tool_check_policy_coverage(self, input_json: str) -> str:
        """Tool: Check policy coverage using the Nigerian insurance expert model."""
        try:
            data = json.loads(input_json)
            policy_id = data["policy_id"]
            claim_type = data["claim_type"]
            claim_details = data["claim_details"]

            # Get policy details
            policy_json = await self._tool_get_policy_details(policy_id)
            policy = json.loads(policy_json)

            # Use LLM to interpret policy and determine coverage
            prompt = f"""
            As a Nigerian insurance expert, determine if the following claim is covered under the policy.

            Policy Details:
            {json.dumps(policy, indent=2)}

            Claim Type: {claim_type}
            Claim Details: {claim_details}

            Provide your determination in the following JSON format:
            {{
                "covered": true/false,
                "reasoning": "Detailed explanation",
                "applicable_clauses": ["List of applicable policy clauses"],
                "exclusions_triggered": ["List of exclusions, if any"],
                "recommendation": "APPROVE/REJECT/MANUAL_REVIEW"
            }}
            """

            response = await asyncio.to_thread(self.llm.invoke, prompt)

            # Extract JSON from response
            import re
            json_match = re.search(r"\{.*\}", response, re.DOTALL)
            if json_match:
                return json_match.group(0)
            else:
                return json.dumps({"error": "Failed to parse LLM response", "raw_response": response})

        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _tool_detect_fraud(self, input_json: str) -> str:
        """Tool: Detect fraud using ML model and rules."""
        try:
            data = json.loads(input_json)
            claim_id = data["claim_id"]
            policy_id = data["policy_id"]
            claim_details = data["claim_details"]

            # Fraud detection logic
            fraud_score = 0
            flags = []

            # Rule 1: Check claim amount vs sum assured
            if "claim_amount" in claim_details and "sum_assured" in claim_details:
                if claim_details["claim_amount"] > claim_details["sum_assured"] * 0.9:
                    fraud_score += 30
                    flags.append("Claim amount close to or exceeds sum assured")

            # Rule 2: Check claim frequency
            conn = self._get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT COUNT(*) as claim_count
                FROM claims
                WHERE policy_id = %s
                AND created_at > NOW() - INTERVAL '6 months'
                """,
                (policy_id,),
            )
            result = cursor.fetchone()
            cursor.close()
            conn.close()

            if result and result[0] > 2:
                fraud_score += 25
                flags.append(f"Multiple claims in last 6 months: {result[0]}")

            # Rule 3: Check claim timing (within first 30 days)
            if "policy_start_date" in claim_details and "claim_date" in claim_details:
                from datetime import datetime
                policy_start = datetime.fromisoformat(claim_details["policy_start_date"])
                claim_date = datetime.fromisoformat(claim_details["claim_date"])
                days_diff = (claim_date - policy_start).days

                if days_diff < 30:
                    fraud_score += 20
                    flags.append(f"Claim filed within {days_diff} days of policy start")

            # Rule 4: Check for missing documents
            if "documents_submitted" in claim_details:
                required_docs = {"police_report", "medical_report", "receipts"}
                submitted_docs = set(claim_details["documents_submitted"])
                missing_docs = required_docs - submitted_docs

                if missing_docs:
                    fraud_score += 15
                    flags.append(f"Missing documents: {', '.join(missing_docs)}")

            # Determine risk level
            if fraud_score >= 70:
                risk_level = "HIGH"
                recommendation = "REJECT"
            elif fraud_score >= 40:
                risk_level = "MEDIUM"
                recommendation = "MANUAL_REVIEW"
            else:
                risk_level = "LOW"
                recommendation = "APPROVE"

            result = {
                "fraud_score": fraud_score,
                "risk_level": risk_level,
                "flags": flags,
                "recommendation": recommendation,
            }

            return json.dumps(result, indent=2)

        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _tool_calculate_settlement_amount(self, input_json: str) -> str:
        """Tool: Calculate settlement amount."""
        try:
            data = json.loads(input_json)
            policy_id = data["policy_id"]
            claim_amount = float(data["claim_amount"])
            claim_type = data["claim_type"]

            # Get policy details
            policy_json = await self._tool_get_policy_details(policy_id)
            policy = json.loads(policy_json)

            if "error" in policy:
                return json.dumps(policy)

            sum_assured = float(policy["sum_assured"])

            # Calculate settlement based on claim type
            if claim_type == "total_loss":
                settlement_amount = min(claim_amount, sum_assured)
                deductible = 0
            elif claim_type == "partial_loss":
                # Apply 10% deductible for partial loss
                deductible = claim_amount * 0.10
                settlement_amount = min(claim_amount - deductible, sum_assured)
            elif claim_type == "medical":
                # Medical claims: 20% co-payment
                deductible = claim_amount * 0.20
                settlement_amount = min(claim_amount - deductible, sum_assured)
            else:
                settlement_amount = min(claim_amount, sum_assured)
                deductible = 0

            result = {
                "claim_amount": claim_amount,
                "sum_assured": sum_assured,
                "deductible": deductible,
                "settlement_amount": settlement_amount,
                "breakdown": {
                    "gross_claim": claim_amount,
                    "less_deductible": deductible,
                    "net_settlement": settlement_amount,
                },
            }

            return json.dumps(result, indent=2)

        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _tool_initiate_payment(self, input_json: str) -> str:
        """Tool: Initiate payment for claim settlement."""
        try:
            data = json.loads(input_json)
            claim_id = data["claim_id"]
            beneficiary_account = data["beneficiary_account"]
            amount = float(data["amount"])

            # Update claim status
            conn = self._get_db_connection()
            cursor = conn.cursor()

            cursor.execute(
                """
                UPDATE claims
                SET status = 'APPROVED',
                    settlement_amount = %s,
                    approved_at = NOW(),
                    updated_at = NOW()
                WHERE claim_id = %s
                """,
                (amount, claim_id),
            )

            conn.commit()
            cursor.close()
            conn.close()

            # In production, this would trigger the Temporal workflow for payment
            result = {
                "success": True,
                "claim_id": claim_id,
                "payment_status": "INITIATED",
                "beneficiary_account": beneficiary_account,
                "amount": amount,
                "initiated_at": datetime.utcnow().isoformat(),
            }

            return json.dumps(result, indent=2)

        except Exception as e:
            return json.dumps({"error": str(e)})

    def _create_agent(self) -> AgentExecutor:
        """Create the LangChain agent."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert claims adjudicator for a Nigerian insurance company.

            Your role is to automate the claims adjudication process by:
            1. Retrieving policy and claim details
            2. Verifying policy coverage for the claim
            3. Detecting potential fraud
            4. Calculating the correct settlement amount
            5. Initiating payment for approved claims

            You must follow Nigerian insurance regulations and NAICOM guidelines.

            For each claim, provide a comprehensive assessment with:
            - Coverage determination
            - Fraud risk assessment
            - Settlement amount calculation
            - Final recommendation (APPROVE/REJECT/MANUAL_REVIEW)
            - Detailed reasoning for your decision

            Always prioritize policyholder protection while preventing fraud.
            """),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])

        memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
        )

        agent = create_structured_chat_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=prompt,
        )

        agent_executor = AgentExecutor(
            agent=agent,
            tools=self.tools,
            memory=memory,
            verbose=True,
            max_iterations=15,
            handle_parsing_errors=True,
        )

        return agent_executor

    async def adjudicate_claim(self, claim_id: str) -> Dict[str, Any]:
        """
        Adjudicate a claim autonomously.

        Args:
            claim_id: ID of the claim to adjudicate

        Returns:
            Adjudication result with decision and reasoning
        """
        prompt = f"""
        Adjudicate the following claim: {claim_id}

        Follow these steps:
        1. Get the claim documents
        2. Get the policy details
        3. Check if the claim is covered under the policy
        4. Detect any fraud indicators
        5. If the claim is covered and fraud risk is low, calculate the settlement amount
        6. If approved, initiate payment
        7. Provide a comprehensive summary of your decision

        Provide your final decision in JSON format with the following structure:
        {{
            "claim_id": "{claim_id}",
            "decision": "APPROVED/REJECTED/MANUAL_REVIEW",
            "settlement_amount": <amount or null>,
            "reasoning": "Detailed explanation",
            "fraud_score": <score>,
            "coverage_determination": "Covered/Not Covered",
            "next_steps": "Description of next steps"
        }}
        """

        try:
            response = await asyncio.to_thread(
                self.agent.invoke,
                {"input": prompt}
            )

            return {
                "success": True,
                "claim_id": claim_id,
                "adjudication_result": response["output"],
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            return {
                "success": False,
                "claim_id": claim_id,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }


# Example usage
async def main():
    """Example usage of Claims Adjudication Agent."""
    agent = ClaimsAdjudicationAgent()

    # Adjudicate a claim
    result = await agent.adjudicate_claim("CLM-12345678901-1706437200")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())

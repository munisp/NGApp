"""
Data Collection Agent - "The Investigator"

This agent is responsible for gathering all necessary information about
the applicant from both internal and external sources.
"""

import asyncio
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

import httpx
from langchain.agents import AgentExecutor, create_react_agent
from langchain.tools import Tool
from langchain_community.llms import Ollama
from langchain.prompts import PromptTemplate

from tools.database_tools import query_customer_data, query_data_lake
from tools.external_api_tools import (
    verify_nin_with_nimc,
    get_credit_history,
    search_web,
    analyze_social_media
)


class DataCollectionAgent:
    """
    The Data Collection Agent uses an LLM (Qwen via Ollama) to intelligently
    gather and structure data about a policy applicant.
    """

    def __init__(self, ollama_base_url: str = "http://localhost:11434"):
        """
        Initialize the Data Collection Agent.

        Args:
            ollama_base_url: The base URL for the Ollama API
        """
        # Initialize Ollama with Qwen model
        self.llm = Ollama(
            base_url=ollama_base_url,
            model="qwen2.5:latest",
            temperature=0.1,  # Low temperature for factual data collection
        )

        # Define the tools available to this agent
        self.tools = self._create_tools()

        # Create the agent prompt
        self.prompt = self._create_prompt()

        # Create the agent
        self.agent = create_react_agent(self.llm, self.tools, self.prompt)
        self.agent_executor = AgentExecutor(
            agent=self.agent,
            tools=self.tools,
            verbose=True,
            max_iterations=10,
            handle_parsing_errors=True,
        )

    def _create_tools(self) -> List[Tool]:
        """Create the tools available to the Data Collection Agent."""
        return [
            Tool(
                name="query_internal_database",
                func=self._query_internal_database,
                description=(
                    "Query the internal PostgreSQL database for customer information. "
                    "Input should be a customer_id (string). "
                    "Returns: JSON with customer details including name, contact, "
                    "existing policies, claims history, and payment history."
                ),
            ),
            Tool(
                name="query_data_lake",
                func=self._query_data_lake,
                description=(
                    "Query the data lake (Delta Lake) for historical and analytical data. "
                    "Input should be a SQL-like query string. "
                    "Returns: JSON with query results."
                ),
            ),
            Tool(
                name="verify_nin",
                func=self._verify_nin,
                description=(
                    "Verify a Nigerian National Identification Number (NIN) with NIMC. "
                    "Input should be an 11-digit NIN (string). "
                    "Returns: JSON with verification status, full name, date of birth, "
                    "gender, and address."
                ),
            ),
            Tool(
                name="get_credit_history",
                func=self._get_credit_history,
                description=(
                    "Retrieve credit history from credit bureaus using BVN. "
                    "Input should be an 11-digit BVN (string). "
                    "Returns: JSON with credit score, loan history, and payment behavior."
                ),
            ),
            Tool(
                name="web_search",
                func=self._web_search,
                description=(
                    "Perform a web search for public information about the applicant. "
                    "Input should be a search query (string). "
                    "Returns: JSON with search results including titles, URLs, and snippets."
                ),
            ),
            Tool(
                name="analyze_social_media",
                func=self._analyze_social_media,
                description=(
                    "Analyze public social media profiles for lifestyle indicators. "
                    "Input should be a social media handle or name (string). "
                    "Returns: JSON with lifestyle indicators, risk factors, and activity summary."
                ),
            ),
        ]

    def _create_prompt(self) -> PromptTemplate:
        """Create the prompt template for the Data Collection Agent."""
        template = """You are a professional insurance data collection specialist. Your job is to gather ALL necessary information about a policy applicant to enable accurate underwriting.

You have access to the following tools:

{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now have all the necessary information
Final Answer: a comprehensive JSON object containing all collected data with sources cited

Begin! Remember to be thorough and gather data from multiple sources.

Question: {input}
Thought:{agent_scratchpad}"""

        return PromptTemplate(
            template=template,
            input_variables=["input", "agent_scratchpad"],
            partial_variables={
                "tools": "\n".join([f"{tool.name}: {tool.description}" for tool in self.tools]),
                "tool_names": ", ".join([tool.name for tool in self.tools]),
            },
        )

    async def _query_internal_database(self, customer_id: str) -> str:
        """Query internal database for customer information."""
        try:
            result = await query_customer_data(customer_id)
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e), "source": "internal_database"})

    async def _query_data_lake(self, query: str) -> str:
        """Query the data lake for historical data."""
        try:
            result = await query_data_lake(query)
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e), "source": "data_lake"})

    async def _verify_nin(self, nin: str) -> str:
        """Verify NIN with NIMC."""
        try:
            result = await verify_nin_with_nimc(nin)
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e), "source": "nimc_api"})

    async def _get_credit_history(self, bvn: str) -> str:
        """Get credit history from credit bureaus."""
        try:
            result = await get_credit_history(bvn)
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e), "source": "credit_bureau"})

    async def _web_search(self, query: str) -> str:
        """Perform web search."""
        try:
            result = await search_web(query)
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e), "source": "web_search"})

    async def _analyze_social_media(self, handle: str) -> str:
        """Analyze social media profiles."""
        try:
            result = await analyze_social_media(handle)
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e), "source": "social_media"})

    async def collect_data(self, application_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Collect all necessary data for underwriting.

        Args:
            application_data: The initial policy application data

        Returns:
            A comprehensive dictionary containing all collected data
        """
        # Prepare the input for the agent
        input_text = f"""
        Collect comprehensive data for the following policy application:
        
        Application ID: {application_data.get('application_id')}
        Applicant Name: {application_data.get('full_name')}
        NIN: {application_data.get('nin')}
        BVN: {application_data.get('bvn')}
        Customer ID: {application_data.get('customer_id')}
        Policy Type: {application_data.get('policy_type')}
        Sum Assured: ₦{application_data.get('sum_assured')}
        
        Please gather:
        1. Internal customer history (if existing customer)
        2. NIN verification from NIMC
        3. Credit history from credit bureaus
        4. Any relevant public information
        5. Social media lifestyle indicators (if available)
        
        Return a structured JSON object with all findings and cite your sources.
        """

        # Execute the agent
        try:
            result = await asyncio.to_thread(
                self.agent_executor.invoke,
                {"input": input_text}
            )

            # Parse the agent's output
            collected_data = self._parse_agent_output(result["output"])

            # Add metadata
            collected_data["collection_timestamp"] = datetime.utcnow().isoformat()
            collected_data["agent_version"] = "1.0"
            collected_data["llm_model"] = "qwen2.5:latest"

            return collected_data

        except Exception as e:
            return {
                "error": str(e),
                "status": "failed",
                "collection_timestamp": datetime.utcnow().isoformat(),
            }

    def _parse_agent_output(self, output: str) -> Dict[str, Any]:
        """Parse the agent's final answer into a structured dictionary."""
        try:
            # Try to extract JSON from the output
            start_idx = output.find("{")
            end_idx = output.rfind("}") + 1
            if start_idx != -1 and end_idx > start_idx:
                json_str = output[start_idx:end_idx]
                return json.loads(json_str)
            else:
                # If no JSON found, return the raw output
                return {"raw_output": output, "parsed": False}
        except json.JSONDecodeError:
            return {"raw_output": output, "parsed": False}


# Temporal Activity Wrapper
async def data_collection_activity(application_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Temporal activity that wraps the Data Collection Agent.

    This function is called by the Temporal workflow.
    """
    agent = DataCollectionAgent()
    result = await agent.collect_data(application_data)
    return result

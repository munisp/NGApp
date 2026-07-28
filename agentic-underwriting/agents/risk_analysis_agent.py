"""
Risk Analysis Agent - "The Analyst"

This agent analyzes collected data and assesses the overall risk profile
of the applicant using ML models and geospatial analysis.
"""

import json
from typing import Dict, Any, List
from datetime import datetime

from langchain.agents import AgentExecutor, create_react_agent
from langchain.tools import Tool
from langchain_community.llms import Ollama
from langchain.prompts import PromptTemplate

from tools.ml_tools import run_fraud_detection, calculate_risk_score
from tools.geospatial_tools import analyze_location_risk
from tools.health_tools import analyze_health_data


class RiskAnalysisAgent:
    """
    The Risk Analysis Agent uses Qwen via Ollama to analyze data and
    assess risk using various ML models and analytical tools.
    """

    def __init__(self, ollama_base_url: str = "http://localhost:11434"):
        self.llm = Ollama(
            base_url=ollama_base_url,
            model="qwen2.5:latest",
            temperature=0.2,  # Slightly higher for analytical reasoning
        )

        self.tools = self._create_tools()
        self.prompt = self._create_prompt()
        self.agent = create_react_agent(self.llm, self.tools, self.prompt)
        self.agent_executor = AgentExecutor(
            agent=self.agent,
            tools=self.tools,
            verbose=True,
            max_iterations=15,
            handle_parsing_errors=True,
        )

    def _create_tools(self) -> List[Tool]:
        return [
            Tool(
                name="run_fraud_detection",
                func=self._run_fraud_detection,
                description=(
                    "Run the ML fraud detection model on applicant data. "
                    "Input: JSON string with applicant data. "
                    "Returns: fraud_score (0-100), fraud_indicators, and risk_level."
                ),
            ),
            Tool(
                name="analyze_geospatial_risk",
                func=self._analyze_geospatial_risk,
                description=(
                    "Analyze location-based risks using Apache Sedona. "
                    "Input: address string or coordinates. "
                    "Returns: flood_risk, crime_rate, proximity_to_hospitals, risk_score."
                ),
            ),
            Tool(
                name="analyze_health_data",
                func=self._analyze_health_data,
                description=(
                    "Analyze health records for pre-existing conditions. "
                    "Input: JSON string with health data. "
                    "Returns: identified_conditions, severity_scores, recommendations."
                ),
            ),
            Tool(
                name="calculate_comprehensive_risk_score",
                func=self._calculate_risk_score,
                description=(
                    "Calculate a comprehensive risk score using weighted factors. "
                    "Input: JSON with all risk factors. "
                    "Returns: overall_risk_score (0-100), risk_category, confidence."
                ),
            ),
        ]

    def _create_prompt(self) -> PromptTemplate:
        template = """You are an expert insurance risk analyst with deep knowledge of actuarial science, fraud detection, and risk assessment.

Your task is to analyze the provided applicant data and produce a comprehensive risk assessment report.

You have access to the following tools:

{tools}

Use this format:

Question: the analysis task
Thought: analyze what needs to be done
Action: the action to take, one of [{tool_names}]
Action Input: the input to the action
Observation: the result
... (repeat as needed)
Thought: I have completed the risk analysis
Final Answer: a comprehensive JSON risk report with risk_score, risk_factors, fraud_assessment, and recommendations

Begin!

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

    async def _run_fraud_detection(self, data: str) -> str:
        try:
            data_dict = json.loads(data)
            result = await run_fraud_detection(data_dict)
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _analyze_geospatial_risk(self, address: str) -> str:
        try:
            result = await analyze_location_risk(address)
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _analyze_health_data(self, data: str) -> str:
        try:
            data_dict = json.loads(data)
            result = await analyze_health_data(data_dict)
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _calculate_risk_score(self, factors: str) -> str:
        try:
            factors_dict = json.loads(factors)
            result = await calculate_risk_score(factors_dict)
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    async def analyze_risk(self, collected_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze risk based on collected data.

        Args:
            collected_data: Data collected by the Data Collection Agent

        Returns:
            Comprehensive risk assessment report
        """
        input_text = f"""
        Analyze the risk profile for the following applicant data:
        
        {json.dumps(collected_data, indent=2)}
        
        Please:
        1. Run fraud detection analysis
        2. Analyze geospatial risks based on address
        3. Analyze any health data if available
        4. Calculate a comprehensive risk score
        5. Identify all major risk factors
        6. Provide recommendations for underwriting
        
        Return a structured JSON report with your complete analysis.
        """

        try:
            import asyncio
            result = await asyncio.to_thread(
                self.agent_executor.invoke,
                {"input": input_text}
            )

            risk_report = self._parse_agent_output(result["output"])
            risk_report["analysis_timestamp"] = datetime.utcnow().isoformat()
            risk_report["agent_version"] = "1.0"

            return risk_report

        except Exception as e:
            return {
                "error": str(e),
                "status": "failed",
                "analysis_timestamp": datetime.utcnow().isoformat(),
            }

    def _parse_agent_output(self, output: str) -> Dict[str, Any]:
        try:
            start_idx = output.find("{")
            end_idx = output.rfind("}") + 1
            if start_idx != -1 and end_idx > start_idx:
                return json.loads(output[start_idx:end_idx])
            return {"raw_output": output, "parsed": False}
        except json.JSONDecodeError:
            return {"raw_output": output, "parsed": False}


# Temporal Activity
async def risk_analysis_activity(collected_data: Dict[str, Any]) -> Dict[str, Any]:
    agent = RiskAnalysisAgent()
    return await agent.analyze_risk(collected_data)

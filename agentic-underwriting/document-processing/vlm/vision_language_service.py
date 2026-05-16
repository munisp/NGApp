"""
Vision Language Model Service for Document Understanding

This service uses VLMs (via Ollama with vision-capable models like LLaVA)
to understand and analyze document images beyond just text extraction.
"""

import os
import base64
from typing import Dict, Any, List, Optional
from pathlib import Path
import json
import asyncio
from datetime import datetime

from PIL import Image
import ollama


class VisionLanguageService:
    """
    Service for understanding documents using Vision Language Models.
    Uses Ollama with vision-capable models like LLaVA or Qwen-VL.
    """

    def __init__(
        self,
        model: str = "llava:latest",
        ollama_base_url: str = "http://localhost:11434",
    ):
        """
        Initialize VLM service.

        Args:
            model: Vision-capable model name (llava, qwen-vl, etc.)
            ollama_base_url: Base URL for Ollama API
        """
        self.model = model
        self.ollama_base_url = ollama_base_url
        self.client = ollama.Client(host=ollama_base_url)

    async def analyze_document(
        self, image_path: str, prompt: str
    ) -> Dict[str, Any]:
        """
        Analyze a document image using VLM.

        Args:
            image_path: Path to the document image
            prompt: Question or instruction for the VLM

        Returns:
            Analysis result from the VLM
        """
        try:
            # Read and encode image
            with open(image_path, "rb") as f:
                image_data = f.read()

            # Call Ollama VLM
            response = await asyncio.to_thread(
                self.client.generate,
                model=self.model,
                prompt=prompt,
                images=[image_data],
            )

            return {
                "success": True,
                "image_path": image_path,
                "prompt": prompt,
                "analysis": response["response"],
                "model": self.model,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "image_path": image_path,
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def verify_document_authenticity(
        self, image_path: str, document_type: str
    ) -> Dict[str, Any]:
        """
        Verify if a document appears authentic using VLM.

        Args:
            image_path: Path to the document image
            document_type: Type of document (nin_card, passport, etc.)

        Returns:
            Authenticity assessment
        """
        prompt = f"""
        Analyze this {document_type} image and assess its authenticity.
        
        Look for:
        1. Security features (holograms, watermarks, microprinting)
        2. Print quality and resolution
        3. Signs of tampering or forgery
        4. Consistency of fonts and layout
        5. Photo quality and alignment
        
        Provide a detailed assessment with:
        - Authenticity score (0-100)
        - Identified security features
        - Any red flags or concerns
        - Overall recommendation (ACCEPT, REJECT, MANUAL_REVIEW)
        
        Format your response as JSON.
        """

        result = await self.analyze_document(image_path, prompt)

        if result.get("success"):
            # Parse VLM response
            try:
                analysis_text = result["analysis"]
                # Extract JSON from response
                import re

                json_match = re.search(r"\{.*\}", analysis_text, re.DOTALL)
                if json_match:
                    authenticity_data = json.loads(json_match.group(0))
                else:
                    authenticity_data = {"raw_analysis": analysis_text}

                result["authenticity_assessment"] = authenticity_data
            except Exception as e:
                result["authenticity_assessment"] = {
                    "raw_analysis": result["analysis"]
                }

        return result

    async def extract_document_fields(
        self, image_path: str, fields: List[str]
    ) -> Dict[str, Any]:
        """
        Extract specific fields from a document using VLM.

        Args:
            image_path: Path to the document image
            fields: List of field names to extract

        Returns:
            Extracted field values
        """
        fields_str = ", ".join(fields)
        prompt = f"""
        Extract the following fields from this document image:
        {fields_str}
        
        Return the results as a JSON object with the field names as keys.
        If a field is not found, use null as the value.
        
        Example format:
        {{
            "field1": "value1",
            "field2": "value2",
            "field3": null
        }}
        """

        result = await self.analyze_document(image_path, prompt)

        if result.get("success"):
            try:
                analysis_text = result["analysis"]
                import re

                json_match = re.search(r"\{.*\}", analysis_text, re.DOTALL)
                if json_match:
                    extracted_fields = json.loads(json_match.group(0))
                    result["extracted_fields"] = extracted_fields
                else:
                    result["extracted_fields"] = {}
            except Exception as e:
                result["extracted_fields"] = {}

        return result

    async def compare_documents(
        self, image_path1: str, image_path2: str, comparison_type: str
    ) -> Dict[str, Any]:
        """
        Compare two document images using VLM.

        Args:
            image_path1: Path to first document
            image_path2: Path to second document
            comparison_type: Type of comparison (face_match, signature_match, etc.)

        Returns:
            Comparison result
        """
        if comparison_type == "face_match":
            prompt = """
            Compare the faces in these two images.
            
            Assess:
            1. Are they the same person?
            2. Similarity score (0-100)
            3. Key matching features
            4. Any concerns or discrepancies
            
            Return as JSON with keys: is_match, similarity_score, confidence, reasoning
            """
        elif comparison_type == "signature_match":
            prompt = """
            Compare the signatures in these two images.
            
            Assess:
            1. Are they from the same person?
            2. Similarity score (0-100)
            3. Matching characteristics
            4. Any signs of forgery
            
            Return as JSON with keys: is_match, similarity_score, confidence, reasoning
            """
        else:
            prompt = f"""
            Compare these two document images for {comparison_type}.
            Provide a detailed comparison and similarity assessment.
            Return as JSON.
            """

        try:
            # Read both images
            with open(image_path1, "rb") as f1, open(image_path2, "rb") as f2:
                image_data1 = f1.read()
                image_data2 = f2.read()

            # Call Ollama VLM with both images
            response = await asyncio.to_thread(
                self.client.generate,
                model=self.model,
                prompt=prompt,
                images=[image_data1, image_data2],
            )

            # Parse response
            import re

            json_match = re.search(r"\{.*\}", response["response"], re.DOTALL)
            comparison_result = {}
            if json_match:
                try:
                    comparison_result = json.loads(json_match.group(0))
                except:
                    comparison_result = {"raw_analysis": response["response"]}
            else:
                comparison_result = {"raw_analysis": response["response"]}

            return {
                "success": True,
                "comparison_type": comparison_type,
                "comparison_result": comparison_result,
                "model": self.model,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def analyze_medical_document(
        self, image_path: str
    ) -> Dict[str, Any]:
        """
        Analyze a medical document (lab report, prescription, etc.).

        Args:
            image_path: Path to the medical document

        Returns:
            Medical document analysis
        """
        prompt = """
        Analyze this medical document and extract key information.
        
        Identify and extract:
        1. Document type (lab report, prescription, medical certificate, etc.)
        2. Patient name
        3. Date of document
        4. Medical conditions or diagnoses mentioned
        5. Test results or vital signs
        6. Medications prescribed
        7. Doctor/facility name
        8. Any critical findings or red flags
        
        Return as structured JSON.
        """

        result = await self.analyze_document(image_path, prompt)

        if result.get("success"):
            try:
                analysis_text = result["analysis"]
                import re

                json_match = re.search(r"\{.*\}", analysis_text, re.DOTALL)
                if json_match:
                    medical_data = json.loads(json_match.group(0))
                    result["medical_analysis"] = medical_data
                else:
                    result["medical_analysis"] = {
                        "raw_analysis": analysis_text
                    }
            except Exception as e:
                result["medical_analysis"] = {"raw_analysis": result["analysis"]}

        return result

    async def analyze_financial_document(
        self, image_path: str
    ) -> Dict[str, Any]:
        """
        Analyze a financial document (bank statement, payslip, etc.).

        Args:
            image_path: Path to the financial document

        Returns:
            Financial document analysis
        """
        prompt = """
        Analyze this financial document and extract key information.
        
        Identify and extract:
        1. Document type (bank statement, payslip, tax return, etc.)
        2. Account holder name
        3. Account number (if applicable)
        4. Period covered
        5. Income/salary amounts
        6. Major transactions or expenses
        7. Current balance or net worth indicators
        8. Any red flags (overdrafts, bounced checks, etc.)
        
        Return as structured JSON with clear field names.
        """

        result = await self.analyze_document(image_path, prompt)

        if result.get("success"):
            try:
                analysis_text = result["analysis"]
                import re

                json_match = re.search(r"\{.*\}", analysis_text, re.DOTALL)
                if json_match:
                    financial_data = json.loads(json_match.group(0))
                    result["financial_analysis"] = financial_data
                else:
                    result["financial_analysis"] = {
                        "raw_analysis": analysis_text
                    }
            except Exception as e:
                result["financial_analysis"] = {
                    "raw_analysis": result["analysis"]
                }

        return result


# Example usage
async def main():
    """Example usage of VLM service."""
    service = VisionLanguageService(model="llava:latest")

    # Example: Verify document authenticity
    result = await service.verify_document_authenticity(
        "/path/to/nin_card.jpg", "nin_card"
    )
    print(json.dumps(result, indent=2))

    # Example: Extract specific fields
    fields_result = await service.extract_document_fields(
        "/path/to/document.jpg", ["name", "date_of_birth", "nin"]
    )
    print(json.dumps(fields_result, indent=2))

    # Example: Compare faces
    comparison_result = await service.compare_documents(
        "/path/to/id_photo.jpg", "/path/to/selfie.jpg", "face_match"
    )
    print(json.dumps(comparison_result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())

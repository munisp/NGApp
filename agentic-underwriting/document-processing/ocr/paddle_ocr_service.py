"""
PaddleOCR Service for Document Text Extraction

This service uses PaddleOCR to extract text from various document types
including scanned documents, photos, and PDFs.
"""

import os
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import json
import asyncio
from datetime import datetime

import cv2
import numpy as np
from paddleocr import PaddleOCR, draw_ocr
from PIL import Image


class PaddleOCRService:
    """
    Service for extracting text from documents using PaddleOCR.
    Supports multiple languages and provides structured output.
    """

    def __init__(
        self,
        lang: str = "en",
        use_angle_cls: bool = True,
        use_gpu: bool = False,
        show_log: bool = False,
    ):
        """
        Initialize PaddleOCR service.

        Args:
            lang: Language code (en, ch, fr, etc.)
            use_angle_cls: Whether to use angle classification
            use_gpu: Whether to use GPU acceleration
            show_log: Whether to show detailed logs
        """
        self.ocr = PaddleOCR(
            lang=lang,
            use_angle_cls=use_angle_cls,
            use_gpu=use_gpu,
            show_log=show_log,
        )
        self.lang = lang

    async def extract_text_from_image(
        self, image_path: str
    ) -> Dict[str, Any]:
        """
        Extract text from a single image file.

        Args:
            image_path: Path to the image file

        Returns:
            Dictionary containing extracted text and metadata
        """
        try:
            # Run OCR in thread pool to avoid blocking
            result = await asyncio.to_thread(self.ocr.ocr, image_path, cls=True)

            if not result or not result[0]:
                return {
                    "success": False,
                    "error": "No text detected in image",
                    "image_path": image_path,
                }

            # Parse OCR results
            extracted_data = self._parse_ocr_result(result[0])

            return {
                "success": True,
                "image_path": image_path,
                "text": extracted_data["full_text"],
                "lines": extracted_data["lines"],
                "boxes": extracted_data["boxes"],
                "confidence": extracted_data["avg_confidence"],
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "image_path": image_path,
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def extract_text_from_pdf(
        self, pdf_path: str, output_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract text from a PDF file by converting pages to images.

        Args:
            pdf_path: Path to the PDF file
            output_dir: Directory to save intermediate images

        Returns:
            Dictionary containing extracted text from all pages
        """
        try:
            from pdf2image import convert_from_path

            # Convert PDF to images
            images = await asyncio.to_thread(convert_from_path, pdf_path)

            pages_data = []
            for page_num, image in enumerate(images, start=1):
                # Save image temporarily
                if output_dir:
                    os.makedirs(output_dir, exist_ok=True)
                    image_path = os.path.join(
                        output_dir, f"page_{page_num}.jpg"
                    )
                    image.save(image_path)
                else:
                    image_path = f"/tmp/page_{page_num}.jpg"
                    image.save(image_path)

                # Extract text from page
                page_result = await self.extract_text_from_image(image_path)
                page_result["page_number"] = page_num
                pages_data.append(page_result)

                # Clean up temporary file if not saving
                if not output_dir:
                    os.remove(image_path)

            # Combine all pages
            full_text = "\n\n".join(
                [
                    page["text"]
                    for page in pages_data
                    if page.get("success") and page.get("text")
                ]
            )

            return {
                "success": True,
                "pdf_path": pdf_path,
                "total_pages": len(images),
                "full_text": full_text,
                "pages": pages_data,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "pdf_path": pdf_path,
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def extract_structured_data(
        self, image_path: str, document_type: str
    ) -> Dict[str, Any]:
        """
        Extract structured data from specific document types.

        Args:
            image_path: Path to the document image
            document_type: Type of document (id_card, passport, driver_license, etc.)

        Returns:
            Structured data extracted from the document
        """
        # First extract all text
        ocr_result = await self.extract_text_from_image(image_path)

        if not ocr_result.get("success"):
            return ocr_result

        # Parse based on document type
        structured_data = {}

        if document_type == "nin_card":
            structured_data = self._parse_nin_card(ocr_result)
        elif document_type == "passport":
            structured_data = self._parse_passport(ocr_result)
        elif document_type == "driver_license":
            structured_data = self._parse_driver_license(ocr_result)
        elif document_type == "bank_statement":
            structured_data = self._parse_bank_statement(ocr_result)
        elif document_type == "medical_report":
            structured_data = self._parse_medical_report(ocr_result)
        else:
            structured_data = {"raw_text": ocr_result["text"]}

        return {
            "success": True,
            "document_type": document_type,
            "structured_data": structured_data,
            "raw_ocr": ocr_result,
            "timestamp": datetime.utcnow().isoformat(),
        }

    def _parse_ocr_result(self, ocr_result: List) -> Dict[str, Any]:
        """Parse raw OCR result into structured format."""
        lines = []
        boxes = []
        confidences = []
        full_text_parts = []

        for line in ocr_result:
            box = line[0]
            text_info = line[1]
            text = text_info[0]
            confidence = text_info[1]

            lines.append(text)
            boxes.append(box)
            confidences.append(confidence)
            full_text_parts.append(text)

        return {
            "full_text": "\n".join(full_text_parts),
            "lines": lines,
            "boxes": boxes,
            "avg_confidence": (
                sum(confidences) / len(confidences) if confidences else 0
            ),
        }

    def _parse_nin_card(self, ocr_result: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Nigerian National ID card."""
        import re

        text = ocr_result.get("text", "")
        lines = ocr_result.get("lines", [])

        # Extract NIN (11 digits)
        nin_pattern = r"\b\d{11}\b"
        nin_match = re.search(nin_pattern, text)

        # Extract name (usually after "Name" or "SURNAME")
        name = ""
        for i, line in enumerate(lines):
            if "NAME" in line.upper() or "SURNAME" in line.upper():
                if i + 1 < len(lines):
                    name = lines[i + 1]
                break

        # Extract date of birth
        dob_pattern = r"\b\d{2}[-/]\d{2}[-/]\d{4}\b"
        dob_match = re.search(dob_pattern, text)

        return {
            "nin": nin_match.group(0) if nin_match else None,
            "full_name": name,
            "date_of_birth": dob_match.group(0) if dob_match else None,
            "raw_text": text,
        }

    def _parse_passport(self, ocr_result: Dict[str, Any]) -> Dict[str, Any]:
        """Parse passport document."""
        import re

        text = ocr_result.get("text", "")

        # Extract passport number (format varies by country)
        passport_pattern = r"[A-Z]\d{8}"
        passport_match = re.search(passport_pattern, text)

        # Extract MRZ (Machine Readable Zone) if present
        mrz_pattern = r"[A-Z0-9<]{44}"
        mrz_matches = re.findall(mrz_pattern, text)

        return {
            "passport_number": (
                passport_match.group(0) if passport_match else None
            ),
            "mrz_lines": mrz_matches,
            "raw_text": text,
        }

    def _parse_driver_license(
        self, ocr_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Parse driver's license."""
        text = ocr_result.get("text", "")

        return {
            "raw_text": text,
            # Add specific parsing logic based on Nigerian driver's license format
        }

    def _parse_bank_statement(
        self, ocr_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Parse bank statement."""
        import re

        text = ocr_result.get("text", "")
        lines = ocr_result.get("lines", [])

        # Extract account number
        account_pattern = r"\b\d{10}\b"
        account_matches = re.findall(account_pattern, text)

        # Extract amounts (Nigerian Naira)
        amount_pattern = r"₦?\s*[\d,]+\.\d{2}"
        amounts = re.findall(amount_pattern, text)

        return {
            "account_numbers": account_matches,
            "amounts_found": amounts,
            "raw_text": text,
        }

    def _parse_medical_report(
        self, ocr_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Parse medical report."""
        text = ocr_result.get("text", "")

        # This would require more sophisticated NLP/NER
        # For now, return raw text
        return {
            "raw_text": text,
            "requires_manual_review": True,
        }

    async def visualize_ocr_result(
        self, image_path: str, output_path: str
    ) -> str:
        """
        Create a visualization of OCR results with bounding boxes.

        Args:
            image_path: Path to the original image
            output_path: Path to save the visualization

        Returns:
            Path to the saved visualization
        """
        try:
            # Run OCR
            result = await asyncio.to_thread(self.ocr.ocr, image_path, cls=True)

            if not result or not result[0]:
                return None

            # Load image
            image = Image.open(image_path).convert("RGB")

            # Extract boxes and texts
            boxes = [line[0] for line in result[0]]
            texts = [line[1][0] for line in result[0]]
            scores = [line[1][1] for line in result[0]]

            # Draw OCR results
            im_show = draw_ocr(
                image, boxes, texts, scores, font_path=None
            )
            im_show = Image.fromarray(im_show)

            # Save visualization
            im_show.save(output_path)

            return output_path

        except Exception as e:
            print(f"Error creating visualization: {e}")
            return None


# Example usage and testing
async def main():
    """Example usage of PaddleOCR service."""
    service = PaddleOCRService(lang="en", use_gpu=False)

    # Example: Extract text from an ID card
    result = await service.extract_structured_data(
        "/path/to/nin_card.jpg", "nin_card"
    )
    print(json.dumps(result, indent=2))

    # Example: Extract text from a PDF
    pdf_result = await service.extract_text_from_pdf(
        "/path/to/document.pdf", output_dir="/tmp/pdf_pages"
    )
    print(json.dumps(pdf_result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())

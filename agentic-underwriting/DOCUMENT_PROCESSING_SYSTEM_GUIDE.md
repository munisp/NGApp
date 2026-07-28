# Document Processing System for Agentic AI Underwriting

**Author**: Manus AI  
**Date**: January 28, 2026

## 1. Introduction

This document provides a comprehensive overview of the document processing and analysis system designed for the agentic AI underwriting platform. The system leverages a multi-modal approach, combining state-of-the-art OCR, Vision Language Models (VLMs), and document parsing technologies to achieve high accuracy and automation in underwriting.

## 2. System Architecture

The system is built on a microservices architecture with three core components:

1. **PaddleOCR Service**: For high-performance text extraction from images and scanned documents.
2. **Vision Language Model (VLM) Service**: For visual understanding, authenticity verification, and structured data extraction using Ollama with LLaVA.
3. **Docling Service**: For advanced parsing of complex documents like PDFs and Word documents into structured data.

These services are orchestrated by a **Document Analysis Agent**, which is a LangChain agent that uses these services as tools to perform comprehensive document analysis.

### 2.1. Architectural Diagram

```mermaid
graph TD
    A[Underwriting Workflow] --> B(DocumentAnalysisAgent);
    B --> C{PaddleOCR Service};
    B --> D{VLM Service (LLaVA)};
    B --> E{Docling Service};
    C --> F[Text Extraction];
    D --> G[Visual Understanding & Authenticity];
    E --> H[Structured Parsing];
    F & G & H --> B;
    B --> I[Comprehensive Analysis];
    I --> A;
```

## 3. Core Components

### 3.1. PaddleOCR Service

The PaddleOCR service provides robust text extraction capabilities with support for multiple languages. It can handle various document types, including scanned documents, photos, and PDFs. The service is designed for high accuracy and performance, with options for GPU acceleration.

**Key Features:**
- Text extraction from images and PDFs
- Bounding box and confidence score for each detected text block
- Pre-processing for image enhancement
- Structured data parsing for common document types (NIN cards, passports, etc.)

### 3.2. Vision Language Model (VLM) Service

The VLM service uses Ollama with the LLaVA model to perform visual understanding tasks that go beyond simple text extraction. This allows the system to analyze the visual aspects of a document, such as security features, layout, and image quality.

**Key Features:**
- **Document Authenticity Verification**: Detects signs of tampering, forgery, and inconsistencies.
- **Structured Data Extraction**: Extracts specific fields from documents using natural language prompts.
- **Document Comparison**: Performs face matching, signature matching, and other comparisons.
- **Medical & Financial Document Analysis**: Extracts key information from complex documents.

### 3.3. Docling Service

The Docling service provides advanced document parsing capabilities for complex, multi-page documents. It can handle PDFs, Word documents, and other formats, converting them into structured data with sections, tables, and metadata.

**Key Features:**
- **Structured Parsing**: Converts documents into a hierarchical structure with sections, paragraphs, and tables.
- **Table Extraction**: Accurately extracts tables and their contents.
- **Metadata Extraction**: Retrieves document metadata such as title, author, and creation date.
- **Specialized Parsers**: Includes specialized parsers for medical reports, financial statements, and insurance applications.

## 4. Document Analysis Agent

The Document Analysis Agent is a LangChain agent that orchestrates the use of the three core services. It receives a set of documents for an underwriting application and uses its tools to perform a comprehensive analysis.

### 4.1. Agent Tools

The agent has access to the following tools:

- `extract_text_ocr`: Extracts text from a document image.
- `verify_document_authenticity`: Verifies the authenticity of a document.
- `extract_structured_fields`: Extracts specific fields from a document.
- `parse_document_structure`: Parses a document into structured format.
- `compare_documents`: Compares two documents.
- `analyze_medical_document`: Analyzes a medical document.
- `analyze_financial_document`: Analyzes a financial document.

### 4.2. Agent Workflow

1. **Receive Documents**: The agent receives a list of documents for an underwriting application.
2. **Analyze Each Document**: For each document, the agent determines the document type and chooses the appropriate tools for analysis.
3. **Extract Information**: The agent extracts all relevant information, including text, structured data, and visual features.
4. **Verify Authenticity**: The agent verifies the authenticity of each document and flags any concerns.
5. **Generate Overall Assessment**: After analyzing all documents, the agent generates a comprehensive assessment with an overall authenticity score, key risk factors, and a recommendation for the underwriter.

## 5. Integration with Underwriting Workflow

The document processing system is integrated into the agentic AI underwriting workflow as the first step. The `EnhancedUnderwritingSaga` workflow executes the `ProcessDocuments` activity, which calls the Document Analysis Agent.

### 5.1. Workflow Logic

1. **Document Analysis**: The workflow starts by analyzing all submitted documents.
2. **Authenticity Check**: If the authenticity score is below a certain threshold (e.g., 70%), the application is automatically flagged for manual review.
3. **Red Flag Detection**: If any red flags are detected (e.g., signs of tampering, inconsistent information), the application is flagged for manual review.
4. **Data Enrichment**: The extracted document data is used to enrich the customer profile and inform the subsequent data collection and risk analysis steps.
5. **Decision Making**: The final underwriting decision is based on a combination of the document analysis results, risk analysis, and pricing calculation.

## 6. Deployment and Configuration

The document processing system is deployed as a set of microservices alongside the main underwriting platform. The services are containerized and can be deployed on Kubernetes.

### 6.1. Ollama with LLaVA

The VLM service requires Ollama to be running with the LLaVA model pulled:

```bash
ollama run llava
```

### 6.2. PaddleOCR

The PaddleOCR service uses the `paddleocr` and `paddlepaddle` Python packages. For optimal performance, it is recommended to run this service on a machine with a GPU.

### 6.3. Docling

The Docling service uses the `docling` Python package and its dependencies. It is a CPU-bound service and can be deployed on standard instances.

## 7. Conclusion

This document processing system provides a powerful and flexible solution for automating document analysis in insurance underwriting. By combining OCR, VLM, and advanced document parsing, the system can achieve a high degree of accuracy and automation, freeing up human underwriters to focus on complex, high-value cases. The integration with the agentic AI underwriting workflow ensures that document analysis is a seamless and integral part of the end-to-end underwriting process.

# DeepSeek-OCR Research Findings

## Overview
DeepSeek-OCR is a vision-language model designed for optical character recognition and document understanding from an LLM-centric viewpoint. It focuses on "Contexts Optical Compression" to efficiently process visual documents.

## Key Capabilities

### Supported Modes
1. **Native Resolution Options:**
   - Tiny: 512×512 (64 vision tokens)
   - Small: 640×640 (100 vision tokens)
   - Base: 1024×1024 (256 vision tokens)
   - Large: 1280×1280 (400 vision tokens)

2. **Dynamic Resolution:**
   - Gundam: n×640×640 + 1×1024×1024

### Supported Document Types
Based on prompt examples, DeepSeek-OCR can handle:
- **Documents**: Convert to markdown format
- **General images**: OCR text extraction
- **Figures in documents**: Parse figures
- **Tables**: Extract table data (special tokens for <td>, </td>)
- **General vision**: Detailed image description
- **Recognition tasks**: Locate specific text in images

## Technical Implementation

### Installation Requirements
- CUDA 11.8+ with PyTorch 2.6.0
- Python 3.12.9
- vLLM 0.8.5 or upstream vLLM (v0.11.1+)
- Flash Attention 2.7.3
- Transformers 4.51.1+

### Inference Options

#### 1. vLLM Inference (Recommended for Scale)
- **Performance**: ~2500 tokens/s on A100-40G for PDF processing
- **Features**: 
  - Streaming output for images
  - Batch processing for benchmarks
  - Concurrency support
  - NGram logit processor for improved output quality

#### 2. Transformers Inference
- Standard HuggingFace transformers interface
- Flash Attention 2 support
- Crop mode for large documents
- Result compression options

### Prompt Templates
```python
# Document to markdown
"<image>\n<|grounding|>Convert the document to markdown."

# General OCR
"<image>\n<|grounding|>OCR this image."

# Free OCR (without layouts)
"<image>\nFree OCR."

# Parse figures
"<image>\nParse the figure."

# Detailed description
"<image>\nDescribe this image in detail."

# Text recognition/location
"<image>\nLocate <|ref|>xxxx<|/ref|> in the image."
```

## Model Access
- **HuggingFace**: deepseek-ai/DeepSeek-OCR
- **License**: MIT
- **Paper**: Available on ArXiv (arXiv:2510.18234)
- **GitHub**: https://github.com/deepseek-ai/DeepSeek-OCR

## Acknowledgements
Built upon: Vary, GOT-OCR2.0, MinerU, PaddleOCR, OneChart, Slow Perception

## Relevance to Document List
DeepSeek-OCR can process all 7 categories of documents from the Health Insurance Marketplace list:
1. ✅ Citizenship and Identity Documentation (passports, certificates, IDs)
2. ✅ Immigration Status Documentation (green cards, visas, I-94 forms)
3. ✅ Income and Employment Documentation (tax returns, W-2, pay stubs, 1099 forms)
4. ✅ Tribal and AI/AN Documentation (enrollment cards, BIA documents)
5. ✅ Employer and Health Coverage Documentation (letters, insurance documents)
6. ✅ Change of Name or Address Documentation (court orders, bills, leases)
7. ✅ Documentation for Proving Loss of Coverage (insurance letters, discharge documents)

The model supports:
- Multi-format documents (images, PDFs)
- Structured data extraction (tables, forms)
- Text recognition from various document types
- Layout understanding and markdown conversion
- Batch processing at scale

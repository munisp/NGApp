#!/usr/bin/env bash
# Install OLMOCR for production GPU server
# Requirements: NVIDIA GPU with 12GB+ RAM, CUDA 11.8+

set -e

echo "=== OLMOCR Installation Script ==="

# Requirements check
if ! command -v nvidia-smi &> /dev/null; then
    echo "Error: NVIDIA GPU not found. OLMOCR requires NVIDIA GPU with CUDA support."
    exit 1
fi

# Check GPU RAM
GPU_RAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -n 1)
echo "Detected GPU RAM: ${GPU_RAM}MB"

if [ "$GPU_RAM" -lt 12000 ]; then
    echo "Warning: OLMOCR requires at least 12GB GPU RAM (found ${GPU_RAM}MB)"
    echo "Performance may be degraded or installation may fail."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install system dependencies
echo "Installing system dependencies..."
sudo DEBIAN_FRONTEND=noninteractive apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    poppler-utils \
    fonts-crosextra-caladea \
    fonts-crosextra-carlito \
    gsfonts \
    lcdf-typetools

# Accept Microsoft fonts EULA automatically
echo ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true | sudo debconf-set-selections
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ttf-mscorefonts-installer

# Install OLMOCR with GPU support
echo "Installing OLMOCR with GPU support..."
sudo pip3 install olmocr[gpu] --extra-index-url https://download.pytorch.org/whl/cu128

# Install flash-attention for faster inference (optional but recommended)
echo "Installing Flash-Attention for faster inference..."
sudo pip3 install flash-attn --no-build-isolation || echo "Flash-Attention installation failed (optional)"

echo ""
echo "=== OLMOCR Installation Complete! ==="
echo ""
echo "Test with:"
echo "  python3 -c 'from olmocr import OCRModel; print(\"OLMOCR installed successfully!\")'"
echo ""
echo "Start OLMOCR service:"
echo "  python3 python-services/ocr/olmocr_service.py"
echo ""

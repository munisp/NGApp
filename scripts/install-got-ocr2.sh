#!/usr/bin/env bash
# Install GOT-OCR2.0 for production GPU server
# Requirements: NVIDIA GPU with 8GB+ RAM, CUDA 11.8+

set -e

echo "=== GOT-OCR2.0 Installation Script ==="

# Requirements check
if ! command -v nvidia-smi &> /dev/null; then
    echo "Error: NVIDIA GPU not found. GOT-OCR2.0 requires NVIDIA GPU with CUDA support."
    exit 1
fi

# Check GPU RAM
GPU_RAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -n 1)
echo "Detected GPU RAM: ${GPU_RAM}MB"

if [ "$GPU_RAM" -lt 8000 ]; then
    echo "Warning: GOT-OCR2.0 requires at least 8GB GPU RAM (found ${GPU_RAM}MB)"
    echo "Performance may be degraded or installation may fail."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Clone repository
echo "Cloning GOT-OCR2.0 repository..."
cd /opt
if [ -d "GOT-OCR2.0" ]; then
    echo "GOT-OCR2.0 directory already exists, pulling latest changes..."
    cd GOT-OCR2.0
    git pull
else
    git clone https://github.com/Ucas-HaoranWei/GOT-OCR2.0.git
    cd GOT-OCR2.0
fi

# Install Python dependencies
echo "Installing Python dependencies..."
sudo pip3 install -e .

# Install Flash-Attention
echo "Installing Flash-Attention..."
sudo pip3 install ninja
sudo pip3 install flash-attn --no-build-isolation

# Download model weights
echo "Downloading model weights (this may take a while)..."
mkdir -p models
cd models

if [ ! -f "model.safetensors" ]; then
    wget https://huggingface.co/stepfun-ai/GOT-OCR2_0/resolve/main/model.safetensors
else
    echo "Model weights already downloaded"
fi

echo ""
echo "=== GOT-OCR2.0 Installation Complete! ==="
echo ""
echo "Model location: /opt/GOT-OCR2.0/models/model.safetensors"
echo ""
echo "Test with:"
echo "  cd /opt/GOT-OCR2.0"
echo "  python3 demo.py --model-path models/model.safetensors --image test.jpg"
echo ""
echo "Start GOT-OCR2.0 service:"
echo "  python3 /home/ubuntu/fintech-mobile-app/python-services/ocr/got_ocr_service.py"
echo ""

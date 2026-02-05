#!/usr/bin/env python3
"""
Ollama Service Wrapper for Local ML Inference
Provides unified interface for Qwen models running on Ollama
"""

import os
import sys
import json
import requests
from typing import Dict, List, Any, Optional
from flask import Flask, request, jsonify
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Ollama configuration
OLLAMA_BASE_URL = os.environ.get('OLLAMA_BASE_URL', 'http://127.0.0.1:11434')
DEFAULT_MODEL = os.environ.get('OLLAMA_MODEL', 'qwen2.5:7b')

class OllamaClient:
    """Client for interacting with Ollama API"""
    
    def __init__(self, base_url: str = OLLAMA_BASE_URL):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
    
    def generate(
        self,
        model: str,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        stream: bool = False
    ) -> Dict[str, Any]:
        """Generate text completion using Ollama"""
        
        payload = {
            'model': model,
            'prompt': prompt,
            'stream': stream,
            'options': {
                'temperature': temperature,
                'num_predict': max_tokens,
            }
        }
        
        if system:
            payload['system'] = system
        
        try:
            response = self.session.post(
                f'{self.base_url}/api/generate',
                json=payload,
                timeout=120
            )
            response.raise_for_status()
            
            if stream:
                return {'response': response.iter_lines()}
            else:
                return response.json()
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ollama API error: {str(e)}")
    
    def chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2048
    ) -> Dict[str, Any]:
        """Chat completion using Ollama"""
        
        payload = {
            'model': model,
            'messages': messages,
            'stream': False,
            'options': {
                'temperature': temperature,
                'num_predict': max_tokens,
            }
        }
        
        try:
            response = self.session.post(
                f'{self.base_url}/api/chat',
                json=payload,
                timeout=120
            )
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ollama API error: {str(e)}")
    
    def embeddings(self, model: str, text: str) -> List[float]:
        """Generate embeddings using Ollama"""
        
        payload = {
            'model': model,
            'prompt': text
        }
        
        try:
            response = self.session.post(
                f'{self.base_url}/api/embeddings',
                json=payload,
                timeout=60
            )
            response.raise_for_status()
            result = response.json()
            return result.get('embedding', [])
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ollama embeddings error: {str(e)}")
    
    def list_models(self) -> List[Dict[str, Any]]:
        """List available models"""
        
        try:
            response = self.session.get(f'{self.base_url}/api/tags', timeout=10)
            response.raise_for_status()
            result = response.json()
            return result.get('models', [])
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ollama list models error: {str(e)}")
    
    def pull_model(self, model: str) -> Dict[str, Any]:
        """Pull/download a model"""
        
        payload = {'name': model, 'stream': False}
        
        try:
            response = self.session.post(
                f'{self.base_url}/api/pull',
                json=payload,
                timeout=3600  # 1 hour for large models
            )
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ollama pull model error: {str(e)}")

# Global client instance
ollama_client = OllamaClient()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        models = ollama_client.list_models()
        return jsonify({
            'status': 'healthy',
            'service': 'ollama-service',
            'ollama_url': OLLAMA_BASE_URL,
            'available_models': [m['name'] for m in models],
            'default_model': DEFAULT_MODEL
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

@app.route('/generate', methods=['POST'])
def generate():
    """Generate text completion"""
    try:
        data = request.get_json()
        
        if not data or 'prompt' not in data:
            return jsonify({'error': 'Prompt is required'}), 400
        
        model = data.get('model', DEFAULT_MODEL)
        prompt = data['prompt']
        system = data.get('system')
        temperature = data.get('temperature', 0.7)
        max_tokens = data.get('max_tokens', 2048)
        
        result = ollama_client.generate(
            model=model,
            prompt=prompt,
            system=system,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in generate: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    """Chat completion"""
    try:
        data = request.get_json()
        
        if not data or 'messages' not in data:
            return jsonify({'error': 'Messages are required'}), 400
        
        model = data.get('model', DEFAULT_MODEL)
        messages = data['messages']
        temperature = data.get('temperature', 0.7)
        max_tokens = data.get('max_tokens', 2048)
        
        result = ollama_client.chat(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in chat: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/embeddings', methods=['POST'])
def embeddings():
    """Generate embeddings"""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Text is required'}), 400
        
        model = data.get('model', DEFAULT_MODEL)
        text = data['text']
        
        embedding = ollama_client.embeddings(model=model, text=text)
        
        return jsonify({'embedding': embedding})
        
    except Exception as e:
        print(f"Error in embeddings: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/models', methods=['GET'])
def list_models():
    """List available models"""
    try:
        models = ollama_client.list_models()
        return jsonify({'models': models})
        
    except Exception as e:
        print(f"Error listing models: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/pull', methods=['POST'])
def pull_model():
    """Pull/download a model"""
    try:
        data = request.get_json()
        
        if not data or 'model' not in data:
            return jsonify({'error': 'Model name is required'}), 400
        
        model = data['model']
        result = ollama_client.pull_model(model)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error pulling model: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('OLLAMA_SERVICE_PORT', 5002))
    print(f"Starting Ollama Service on port {port}...")
    print(f"Ollama URL: {OLLAMA_BASE_URL}")
    print(f"Default Model: {DEFAULT_MODEL}")
    
    # Check Ollama availability
    try:
        models = ollama_client.list_models()
        print(f"✓ Connected to Ollama successfully")
        print(f"✓ Available models: {[m['name'] for m in models]}")
    except Exception as e:
        print(f"✗ Warning: Could not connect to Ollama: {e}")
        print(f"  Make sure Ollama is running: ollama serve")
    
    print("Ollama Service ready!")
    app.run(host='0.0.0.0', port=port, debug=False)

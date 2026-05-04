#!/usr/bin/env python3
"""
Ollama Client for Banking AI Telephony
Provides a client for interacting with Ollama LLM API
Supports chat completions, embeddings, and other LLM operations
"""

import asyncio
import json
import logging
import os
import time
from typing import Dict, List, Optional, Any, Union
import aiohttp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OllamaClient:
    """
    Asynchronous client for Ollama API
    Provides methods for chat completions, embeddings, and other LLM operations
    """
    
    def __init__(self, base_url: str = None):
        """
        Initialize Ollama client
        
        Args:
            base_url: Base URL for Ollama API, defaults to http://localhost:11434
        """
        self.base_url = base_url or os.getenv("OLLAMA_API_BASE", "http://localhost:11434")
        self.http_session = None
        self.logger = logging.getLogger(__name__)
        
        # Default models
        self.default_chat_model = os.getenv("OLLAMA_CHAT_MODEL", "llama3")
        self.default_embedding_model = os.getenv("OLLAMA_EMBEDDING_MODEL", "llama3")
        
        # Model configurations
        self.model_configs = {
            "llama3": {
                "temperature": 0.7,
                "top_p": 0.9,
                "top_k": 40,
                "max_tokens": 500,
                "context_window": 4096
            },
            "llama3:8b": {
                "temperature": 0.7,
                "top_p": 0.9,
                "top_k": 40,
                "max_tokens": 500,
                "context_window": 4096
            },
            "llama3:70b": {
                "temperature": 0.7,
                "top_p": 0.9,
                "top_k": 40,
                "max_tokens": 500,
                "context_window": 8192
            },
            "mistral": {
                "temperature": 0.7,
                "top_p": 0.9,
                "top_k": 40,
                "max_tokens": 500,
                "context_window": 8192
            }
        }
    
    async def initialize(self):
        """Initialize the Ollama client"""
        self.logger.info("Initializing Ollama client")
        
        # Initialize HTTP session
        self.http_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=120)  # 2 minute timeout for LLM operations
        )
        
        # Test connection to Ollama API
        await self._test_connection()
        
        self.logger.info("Ollama client initialized successfully")
    
    async def _test_connection(self):
        """Test connection to Ollama API"""
        try:
            async with self.http_session.get(f"{self.base_url}/api/tags") as response:
                if response.status == 200:
                    models = await response.json()
                    self.logger.info(f"Connected to Ollama API. Available models: {[m['name'] for m in models['models']]}")
                else:
                    error_text = await response.text()
                    self.logger.error(f"Failed to connect to Ollama API: {response.status} - {error_text}")
                    raise Exception(f"Ollama API connection failed with status {response.status}")
        except Exception as e:
            self.logger.error(f"Failed to connect to Ollama API: {e}")
            raise
    
    async def chat_completion(self, 
                             messages: List[Dict[str, str]], 
                             model: str = None,
                             temperature: float = None,
                             max_tokens: int = None,
                             stream: bool = False,
                             **kwargs) -> Dict[str, Any]:
        """
        Generate a chat completion using Ollama
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
            model: Model name to use, defaults to llama3
            temperature: Sampling temperature, defaults to model-specific value
            max_tokens: Maximum tokens to generate, defaults to model-specific value
            stream: Whether to stream the response, defaults to False
            **kwargs: Additional parameters to pass to Ollama API
            
        Returns:
            Chat completion response
        """
        model = model or self.default_chat_model
        
        # Get model config
        model_config = self.model_configs.get(model, self.model_configs["llama3"])
        
        # Build request payload
        payload = {
            "model": model,
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": temperature if temperature is not None else model_config["temperature"],
                "top_p": kwargs.get("top_p", model_config["top_p"]),
                "top_k": kwargs.get("top_k", model_config["top_k"]),
                "num_predict": max_tokens if max_tokens is not None else model_config["max_tokens"]
            }
        }
        
        try:
            if stream:
                return await self._stream_chat_completion(payload)
            else:
                return await self._send_chat_completion(payload)
        except Exception as e:
            self.logger.error(f"Error in chat completion: {e}")
            # Return a minimal response structure on error
            return {
                "error": str(e),
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": f"I apologize, but I'm experiencing technical difficulties. Error: {str(e)}"
                    },
                    "finish_reason": "error"
                }]
            }
    
    async def _send_chat_completion(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Send chat completion request to Ollama API"""
        start_time = time.time()
        
        async with self.http_session.post(
            f"{self.base_url}/api/chat",
            json=payload
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                self.logger.error(f"Ollama API error: {response.status} - {error_text}")
                raise Exception(f"Ollama API error: {response.status} - {error_text}")
            
            result = await response.json()
        
        # Format response to match OpenAI structure for compatibility
        elapsed_time = time.time() - start_time
        
        formatted_response = {
            "id": f"ollama-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": payload["model"],
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": result["message"]["content"]
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": result.get("prompt_eval_count", 0),
                "completion_tokens": result.get("eval_count", 0),
                "total_tokens": result.get("prompt_eval_count", 0) + result.get("eval_count", 0)
            },
            "response_time": elapsed_time
        }
        
        return formatted_response
    
    async def _stream_chat_completion(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Stream chat completion from Ollama API"""
        start_time = time.time()
        full_content = ""
        
        async with self.http_session.post(
            f"{self.base_url}/api/chat",
            json=payload,
            headers={"Accept": "application/x-ndjson"}
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                self.logger.error(f"Ollama API error: {response.status} - {error_text}")
                raise Exception(f"Ollama API error: {response.status} - {error_text}")
            
            # Process streaming response
            async for line in response.content:
                if not line.strip():
                    continue
                
                try:
                    chunk = json.loads(line)
                    if "message" in chunk and "content" in chunk["message"]:
                        content_chunk = chunk["message"]["content"]
                        full_content += content_chunk
                        yield {
                            "choices": [{
                                "delta": {
                                    "role": "assistant",
                                    "content": content_chunk
                                },
                                "finish_reason": None
                            }]
                        }
                except json.JSONDecodeError:
                    self.logger.warning(f"Failed to parse streaming response: {line}")
        
        # Send final chunk
        elapsed_time = time.time() - start_time
        yield {
            "id": f"ollama-{int(time.time())}",
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": payload["model"],
            "choices": [{
                "delta": {},
                "finish_reason": "stop",
                "index": 0
            }],
            "usage": {
                "completion_tokens": len(full_content.split()),
                "prompt_tokens": sum(len(m["content"].split()) for m in payload["messages"]),
                "total_tokens": len(full_content.split()) + sum(len(m["content"].split()) for m in payload["messages"])
            },
            "response_time": elapsed_time
        }
    
    async def get_embeddings(self, 
                            texts: Union[str, List[str]], 
                            model: str = None) -> Dict[str, Any]:
        """
        Generate embeddings for text using Ollama
        
        Args:
            texts: Text or list of texts to embed
            model: Model name to use, defaults to llama3
            
        Returns:
            Embeddings response
        """
        model = model or self.default_embedding_model
        
        # Convert single text to list
        if isinstance(texts, str):
            texts = [texts]
        
        try:
            embeddings = []
            
            for text in texts:
                payload = {
                    "model": model,
                    "prompt": text
                }
                
                async with self.http_session.post(
                    f"{self.base_url}/api/embeddings",
                    json=payload
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        self.logger.error(f"Ollama API error: {response.status} - {error_text}")
                        raise Exception(f"Ollama API error: {response.status} - {error_text}")
                    
                    result = await response.json()
                    embeddings.append(result["embedding"])
            
            # Format response to match OpenAI structure for compatibility
            formatted_response = {
                "object": "list",
                "data": [
                    {
                        "object": "embedding",
                        "embedding": embedding,
                        "index": i
                    }
                    for i, embedding in enumerate(embeddings)
                ],
                "model": model,
                "usage": {
                    "prompt_tokens": sum(len(text.split()) for text in texts),
                    "total_tokens": sum(len(text.split()) for text in texts)
                }
            }
            
            return formatted_response
            
        except Exception as e:
            self.logger.error(f"Error in embeddings: {e}")
            # Return a minimal response structure on error
            return {
                "error": str(e),
                "data": [{"embedding": [0.0] * 768, "index": 0}],
                "model": model
            }
    
    async def generate_text(self, 
                           prompt: str, 
                           model: str = None,
                           temperature: float = None,
                           max_tokens: int = None,
                           stream: bool = False,
                           **kwargs) -> Dict[str, Any]:
        """
        Generate text completion using Ollama
        
        Args:
            prompt: Text prompt
            model: Model name to use, defaults to llama3
            temperature: Sampling temperature, defaults to model-specific value
            max_tokens: Maximum tokens to generate, defaults to model-specific value
            stream: Whether to stream the response, defaults to False
            **kwargs: Additional parameters to pass to Ollama API
            
        Returns:
            Text completion response
        """
        model = model or self.default_chat_model
        
        # Get model config
        model_config = self.model_configs.get(model, self.model_configs["llama3"])
        
        # Build request payload
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": stream,
            "options": {
                "temperature": temperature if temperature is not None else model_config["temperature"],
                "top_p": kwargs.get("top_p", model_config["top_p"]),
                "top_k": kwargs.get("top_k", model_config["top_k"]),
                "num_predict": max_tokens if max_tokens is not None else model_config["max_tokens"]
            }
        }
        
        try:
            if stream:
                return await self._stream_text_completion(payload)
            else:
                return await self._send_text_completion(payload)
        except Exception as e:
            self.logger.error(f"Error in text completion: {e}")
            # Return a minimal response structure on error
            return {
                "error": str(e),
                "choices": [{
                    "text": f"I apologize, but I'm experiencing technical difficulties. Error: {str(e)}",
                    "finish_reason": "error"
                }]
            }
    
    async def _send_text_completion(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Send text completion request to Ollama API"""
        start_time = time.time()
        
        async with self.http_session.post(
            f"{self.base_url}/api/generate",
            json=payload
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                self.logger.error(f"Ollama API error: {response.status} - {error_text}")
                raise Exception(f"Ollama API error: {response.status} - {error_text}")
            
            result = await response.json()
        
        # Format response to match OpenAI structure for compatibility
        elapsed_time = time.time() - start_time
        
        formatted_response = {
            "id": f"ollama-{int(time.time())}",
            "object": "text_completion",
            "created": int(time.time()),
            "model": payload["model"],
            "choices": [{
                "text": result["response"],
                "index": 0,
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": result.get("prompt_eval_count", 0),
                "completion_tokens": result.get("eval_count", 0),
                "total_tokens": result.get("prompt_eval_count", 0) + result.get("eval_count", 0)
            },
            "response_time": elapsed_time
        }
        
        return formatted_response
    
    async def _stream_text_completion(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Stream text completion from Ollama API"""
        start_time = time.time()
        full_content = ""
        
        async with self.http_session.post(
            f"{self.base_url}/api/generate",
            json=payload,
            headers={"Accept": "application/x-ndjson"}
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                self.logger.error(f"Ollama API error: {response.status} - {error_text}")
                raise Exception(f"Ollama API error: {response.status} - {error_text}")
            
            # Process streaming response
            async for line in response.content:
                if not line.strip():
                    continue
                
                try:
                    chunk = json.loads(line)
                    if "response" in chunk:
                        content_chunk = chunk["response"]
                        full_content += content_chunk
                        yield {
                            "choices": [{
                                "text": content_chunk,
                                "index": 0,
                                "finish_reason": None
                            }]
                        }
                except json.JSONDecodeError:
                    self.logger.warning(f"Failed to parse streaming response: {line}")
        
        # Send final chunk
        elapsed_time = time.time() - start_time
        yield {
            "id": f"ollama-{int(time.time())}",
            "object": "text_completion",
            "created": int(time.time()),
            "model": payload["model"],
            "choices": [{
                "text": "",
                "index": 0,
                "finish_reason": "stop"
            }],
            "usage": {
                "completion_tokens": len(full_content.split()),
                "prompt_tokens": len(payload["prompt"].split()),
                "total_tokens": len(full_content.split()) + len(payload["prompt"].split())
            },
            "response_time": elapsed_time
        }
    
    async def get_available_models(self) -> List[Dict[str, Any]]:
        """Get list of available models from Ollama"""
        try:
            async with self.http_session.get(f"{self.base_url}/api/tags") as response:
                if response.status != 200:
                    error_text = await response.text()
                    self.logger.error(f"Ollama API error: {response.status} - {error_text}")
                    raise Exception(f"Ollama API error: {response.status} - {error_text}")
                
                result = await response.json()
                return result.get("models", [])
        except Exception as e:
            self.logger.error(f"Error getting available models: {e}")
            return []
    
    async def pull_model(self, model_name: str) -> Dict[str, Any]:
        """Pull a model from Ollama registry"""
        try:
            payload = {
                "name": model_name
            }
            
            async with self.http_session.post(
                f"{self.base_url}/api/pull",
                json=payload
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    self.logger.error(f"Ollama API error: {response.status} - {error_text}")
                    raise Exception(f"Ollama API error: {response.status} - {error_text}")
                
                # This is a streaming response with progress updates
                result = {"status": "success", "message": f"Model {model_name} pulled successfully"}
                return result
        except Exception as e:
            self.logger.error(f"Error pulling model {model_name}: {e}")
            return {"status": "error", "message": str(e)}
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.http_session:
            await self.http_session.close()
            self.logger.info("Ollama client HTTP session closed")

# Example usage
async def main():
    """Test Ollama client"""
    client = OllamaClient()
    await client.initialize()
    
    # Test chat completion
    response = await client.chat_completion([
        {"role": "system", "content": "You are a helpful banking assistant."},
        {"role": "user", "content": "What are the benefits of a savings account?"}
    ])
    
    print("Chat Completion Response:")
    print(json.dumps(response, indent=2))
    
    # Test embeddings
    embedding_response = await client.get_embeddings("What are the benefits of a savings account?")
    print("\nEmbedding Response (truncated):")
    print(f"Dimensions: {len(embedding_response['data'][0]['embedding'])}")
    print(f"First 5 values: {embedding_response['data'][0]['embedding'][:5]}")
    
    # Test text completion
    text_response = await client.generate_text("What are the benefits of a savings account?")
    print("\nText Completion Response:")
    print(json.dumps(text_response, indent=2))
    
    # Get available models
    models = await client.get_available_models()
    print("\nAvailable Models:")
    for model in models:
        print(f"- {model['name']}: {model.get('size', 'N/A')}")
    
    await client.cleanup()

if __name__ == "__main__":
    asyncio.run(main())


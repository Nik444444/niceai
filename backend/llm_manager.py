import os
import asyncio
import logging
from enum import Enum
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai
import openai
import anthropic
import httpx
from PIL import Image
import io

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

class ProviderStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    RATE_LIMITED = "rate_limited"

class LLMProvider:
    def __init__(self, name: str, api_key: str):
        self.name = name
        self.api_key = api_key
        self.config = self._create_config()
        self.last_request_time = None
        self.request_count = 0
        self.error_count = 0
        self.last_error = None
    
    def _create_config(self):
        class Config:
            def __init__(self):
                self.status = ProviderStatus.INACTIVE
                self.rate_limit = 60  # requests per minute
                self.max_tokens = 4000
                self.retry_after = timedelta(minutes=1)
        return Config()
    
    def can_make_request(self) -> bool:
        """Check if provider can make a request (rate limiting)"""
        if self.last_request_time and self.config.status == ProviderStatus.RATE_LIMITED:
            time_since_last = datetime.now() - self.last_request_time
            if time_since_last < self.config.retry_after:
                return False
        return True
    
    def record_request(self):
        """Record that a request was made"""
        self.last_request_time = datetime.now()
        self.request_count += 1
    
    def record_success(self):
        """Record successful request"""
        if self.config.status == ProviderStatus.ERROR:
            self.config.status = ProviderStatus.ACTIVE
            self.error_count = 0
            self.last_error = None
    
    def record_error(self, error: str):
        """Record failed request"""
        self.error_count += 1
        self.last_error = error
        logger.error(f"Error in {self.name}: {error}")
        
        if self.error_count >= 3:
            self.config.status = ProviderStatus.ERROR
        elif "rate limit" in error.lower():
            self.config.status = ProviderStatus.RATE_LIMITED
    
    async def generate_content(self, prompt: str) -> str:
        """Generate content using this provider"""
        raise NotImplementedError

class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str):
        super().__init__("Gemini", api_key)
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            self.config.status = ProviderStatus.ACTIVE
    
    async def generate_content(self, prompt: str, image_path: str = None) -> str:
        try:
            if image_path and os.path.exists(image_path):
                # Handle image analysis
                image = Image.open(image_path)
                response = await asyncio.get_event_loop().run_in_executor(
                    None, self.model.generate_content, [prompt, image]
                )
            else:
                # Handle text-only analysis
                response = await asyncio.get_event_loop().run_in_executor(
                    None, self.model.generate_content, prompt
                )
            
            return response.text
        except Exception as e:
            raise Exception(f"Gemini API error: {str(e)}")
    
    def generate_content_with_image(self, prompt: str, image_path: str) -> str:
        """Synchronous version for image analysis"""
        try:
            if os.path.exists(image_path):
                image = Image.open(image_path)
                response = self.model.generate_content([prompt, image])
                return response.text
            else:
                response = self.model.generate_content(prompt)
                return response.text
        except Exception as e:
            raise Exception(f"Gemini API error: {str(e)}")

class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str):
        super().__init__("OpenAI", api_key)
        if api_key:
            self.client = openai.AsyncOpenAI(api_key=api_key)
            self.config.status = ProviderStatus.ACTIVE
    
    async def generate_content(self, prompt: str) -> str:
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=self.config.max_tokens
            )
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")

class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str):
        super().__init__("Anthropic", api_key)
        if api_key:
            self.client = anthropic.AsyncAnthropic(api_key=api_key)
            self.config.status = ProviderStatus.ACTIVE
    
    async def generate_content(self, prompt: str) -> str:
        try:
            response = await self.client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=self.config.max_tokens,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        except Exception as e:
            raise Exception(f"Anthropic API error: {str(e)}")

class OpenRouterProvider(LLMProvider):
    def __init__(self, api_key: str):
        super().__init__("OpenRouter", api_key)
        if api_key:
            self.config.status = ProviderStatus.ACTIVE
    
    async def generate_content(self, prompt: str) -> str:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "meta-llama/llama-3.1-8b-instruct:free",
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": self.config.max_tokens
                    }
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            raise Exception(f"OpenRouter API error: {str(e)}")

class LLMManager:
    def __init__(self):
        self.providers: List[LLMProvider] = []
        self.load_providers()
    
    def load_providers(self):
        """Load providers from environment variables"""
        self.providers = []
        
        # Load from environment
        providers_config = [
            ("GEMINI_API_KEY", GeminiProvider),
            ("OPENAI_API_KEY", OpenAIProvider),
            ("ANTHROPIC_API_KEY", AnthropicProvider),
            ("OPENROUTER_API_KEY", OpenRouterProvider)
        ]
        
        for env_key, provider_class in providers_config:
            api_key = os.environ.get(env_key)
            if api_key:
                try:
                    provider = provider_class(api_key)
                    self.providers.append(provider)
                    logger.info(f"Loaded {provider.name} provider")
                except Exception as e:
                    logger.error(f"Failed to load {provider_class.__name__}: {e}")
    
    def get_provider_status(self) -> Dict[str, Dict]:
        """Get status of all providers"""
        status = {}
        for provider in self.providers:
            status[provider.name] = {
                "status": provider.config.status.value,
                "request_count": provider.request_count,
                "error_count": provider.error_count,
                "last_error": provider.last_error,
                "can_make_request": provider.can_make_request()
            }
        return status
    
    async def generate_content(self, prompt: str, image_path: str = None) -> Tuple[str, str]:
        """Generate content using the first available provider"""
        if not self.providers:
            raise Exception("No LLM providers configured")
        
        # Try providers in order
        for provider in self.providers:
            if not provider.can_make_request() or provider.config.status != ProviderStatus.ACTIVE:
                continue
            
            try:
                provider.record_request()
                
                if image_path and hasattr(provider, 'generate_content_with_image'):
                    # Use image-capable provider
                    content = await asyncio.get_event_loop().run_in_executor(
                        None, provider.generate_content_with_image, prompt, image_path
                    )
                else:
                    # Use regular text generation
                    content = await provider.generate_content(prompt)
                
                provider.record_success()
                return content, provider.name
                
            except Exception as e:
                provider.record_error(str(e))
                logger.warning(f"Provider {provider.name} failed: {e}")
                continue
        
        raise Exception("All LLM providers failed or are unavailable")

# Global instance
llm_manager = LLMManager()
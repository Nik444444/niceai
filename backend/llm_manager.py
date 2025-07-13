import os
import asyncio
import logging
import uuid
from enum import Enum
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
import tempfile
import shutil
from PIL import Image
import io
import base64

# Import emergentintegrations
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    EMERGENT_AVAILABLE = True
except ImportError:
    EMERGENT_AVAILABLE = False
    logging.warning("emergentintegrations not available, falling back to basic providers")

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

class ProviderStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    RATE_LIMITED = "rate_limited"

class EmergentProvider:
    """Unified provider using emergentintegrations"""
    
    def __init__(self, name: str, provider_key: str, model: str, api_key: str = None):
        self.name = name
        self.provider_key = provider_key  # "openai", "anthropic", "gemini"
        self.model = model
        self.api_key = api_key or os.environ.get(f"{provider_key.upper()}_API_KEY")
        self.status = ProviderStatus.INACTIVE
        self.last_request_time = None
        self.request_count = 0
        self.error_count = 0
        self.last_error = None
        
        if self.api_key and EMERGENT_AVAILABLE:
            self.status = ProviderStatus.ACTIVE
            logger.info(f"Initialized {self.name} provider with emergentintegrations")
        else:
            logger.warning(f"No API key found for {self.name} or emergentintegrations not available")

    def can_make_request(self) -> bool:
        """Check if provider can make a request"""
        return self.status == ProviderStatus.ACTIVE and self.api_key is not None

    def record_request(self):
        """Record that a request was made"""
        self.last_request_time = datetime.now()
        self.request_count += 1

    def record_success(self):
        """Record successful request"""
        if self.status == ProviderStatus.ERROR:
            self.status = ProviderStatus.ACTIVE
            self.error_count = 0
            self.last_error = None

    def record_error(self, error: str):
        """Record failed request"""
        self.error_count += 1
        self.last_error = error
        logger.error(f"Error in {self.name}: {error}")
        
        if self.error_count >= 3:
            self.status = ProviderStatus.ERROR
        elif "rate limit" in error.lower():
            self.status = ProviderStatus.RATE_LIMITED

    async def generate_content(self, prompt: str, image_path: str = None) -> str:
        """Generate content using emergentintegrations"""
        if not self.can_make_request() or not EMERGENT_AVAILABLE:
            raise Exception(f"Provider {self.name} is not available")
        
        try:
            # Create unique session ID for this request
            session_id = str(uuid.uuid4())
            
            # Initialize chat with emergentintegrations
            chat = LlmChat(
                api_key=self.api_key,
                session_id=session_id,
                system_message="You are a helpful AI assistant specialized in analyzing German official letters. Provide clear, structured responses in the requested language."
            ).with_model(self.provider_key, self.model).with_max_tokens(4000)
            
            # Create user message
            user_message = UserMessage(text=prompt)
            
            # Send message and get response
            response = await chat.send_message(user_message)
            
            if response:
                return response
            else:
                raise Exception("Empty response from AI service")
                
        except Exception as e:
            raise Exception(f"{self.name} API error: {str(e)}")

class LLMManager:
    """Enhanced LLM Manager using emergentintegrations"""
    
    def __init__(self):
        self.providers: List[EmergentProvider] = []
        self.load_providers()
    
    def load_providers(self):
        """Load providers using emergentintegrations"""
        self.providers = []
        
        if not EMERGENT_AVAILABLE:
            logger.warning("emergentintegrations not available, no providers loaded")
            return
        
        # Define available providers with their models
        providers_config = [
            # OpenAI providers
            ("OpenAI GPT-4o", "openai", "gpt-4o", "OPENAI_API_KEY"),
            ("OpenAI GPT-4o-mini", "openai", "gpt-4o-mini", "OPENAI_API_KEY"),
            ("OpenAI O1", "openai", "o1", "OPENAI_API_KEY"),
            ("OpenAI O1-mini", "openai", "o1-mini", "OPENAI_API_KEY"),
            
            # Anthropic providers
            ("Claude Sonnet 3.5", "anthropic", "claude-3-5-sonnet-20241022", "ANTHROPIC_API_KEY"),
            ("Claude Haiku 3.5", "anthropic", "claude-3-5-haiku-20241022", "ANTHROPIC_API_KEY"),
            
            # Gemini providers
            ("Gemini 2.0 Flash", "gemini", "gemini-2.0-flash", "GEMINI_API_KEY"),
            ("Gemini 1.5 Flash", "gemini", "gemini-1.5-flash", "GEMINI_API_KEY"),
            ("Gemini 1.5 Pro", "gemini", "gemini-1.5-pro", "GEMINI_API_KEY"),
        ]
        
        # Try to load system-level API keys
        system_keys = {
            "OPENAI_API_KEY": os.environ.get("OPENAI_API_KEY"),
            "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY"),
            "GEMINI_API_KEY": os.environ.get("GEMINI_API_KEY"),
        }
        
        for name, provider_key, model, env_key in providers_config:
            api_key = system_keys.get(env_key)
            if api_key:
                try:
                    provider = EmergentProvider(name, provider_key, model, api_key)
                    self.providers.append(provider)
                    logger.info(f"Loaded {name} provider")
                except Exception as e:
                    logger.error(f"Failed to load {name}: {e}")
        
        # Add a demo provider for testing (using a public free model)
        if not self.providers:
            logger.info("No system providers configured, adding demo provider")
            # This would use a free tier or demo key if available
            # For now, we'll just log that no providers are available
            logger.warning("No AI providers configured. Please add API keys to .env file")

    def get_provider_status(self) -> Dict[str, Dict]:
        """Get status of all providers"""
        status = {}
        for provider in self.providers:
            status[provider.name] = {
                "status": provider.status.value,
                "request_count": provider.request_count,
                "error_count": provider.error_count,
                "last_error": provider.last_error,
                "can_make_request": provider.can_make_request(),
                "provider_key": provider.provider_key,
                "model": provider.model
            }
        return status

    async def generate_content(self, prompt: str, image_path: str = None) -> Tuple[str, str]:
        """Generate content using the first available provider"""
        if not self.providers:
            # Return a demo response for testing
            demo_response = self._generate_demo_response(prompt)
            return demo_response, "Demo Provider"
        
        # Try providers in order
        for provider in self.providers:
            if not provider.can_make_request():
                continue
            
            try:
                provider.record_request()
                content = await provider.generate_content(prompt, image_path)
                provider.record_success()
                return content, provider.name
                
            except Exception as e:
                provider.record_error(str(e))
                logger.warning(f"Provider {provider.name} failed: {e}")
                continue
        
        # If all providers fail, return demo response
        demo_response = self._generate_demo_response(prompt)
        return demo_response, "Demo Provider (All providers failed)"

    def _generate_demo_response(self, prompt: str) -> str:
        """Generate a demo response when no providers are available"""
        return f"""
DEMO ANALYSIS (No AI providers configured)

This is a demonstration response for the German Letter AI Assistant.

Based on your request to analyze a German official letter, here's what a real AI analysis would provide:

📋 **Document Summary:**
The uploaded document appears to be an official German letter requiring attention.

👤 **Sender Information:**
[AI would identify the sender from the document]

📄 **Document Type:**
[AI would classify the type of official letter]

📝 **Main Content:**
[AI would extract and summarize the main content in your requested language]

⚠️ **Required Actions:**
[AI would list specific actions you need to take]

⏰ **Important Deadlines:**
[AI would identify any time-sensitive requirements]

🔥 **Urgency Level:**
MEDIUM (This is a demo response)

💡 **To enable full AI analysis:**
1. Add your AI API keys to the .env file
2. Supported providers: OpenAI, Anthropic Claude, Google Gemini
3. The system will automatically use the best available provider

**Current Status:** Demo Mode - Please configure AI providers for real analysis.
"""

    def create_user_provider(self, provider_name: str, model: str, api_key: str) -> EmergentProvider:
        """Create a user-specific provider"""
        provider_key = provider_name.lower()
        if provider_key not in ["openai", "anthropic", "gemini"]:
            raise ValueError(f"Unsupported provider: {provider_name}")
        
        return EmergentProvider(f"{provider_name} (User)", provider_key, model, api_key)

# Global instance
llm_manager = LLMManager()
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import Dict, Any, Optional
import uuid
from datetime import datetime, timedelta
import jwt
import json
import tempfile
import shutil
import asyncio
from google.auth.transport import requests
from google.oauth2 import id_token

# Load LLM Manager
from llm_manager import llm_manager

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT settings
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 days

# Google OAuth settings
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')

# In-memory user storage (replace with file storage if needed)
users_db: Dict[str, Dict[str, Any]] = {}

# Create the main app
app = FastAPI(
    title="German Letter AI Assistant API",
    description="Backend API for German Letter AI Assistant - Google OAuth only",
    version="2.0.0"
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# HTTP Bearer for JWT
security = HTTPBearer()

# Models
class GoogleOAuthUser(BaseModel):
    email: EmailStr
    name: str
    google_id: str
    picture: Optional[str] = None

class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    oauth_provider: str
    created_at: datetime
    last_login: Optional[datetime] = None
    has_gemini_api_key: bool = False

class ApiKeyUpdate(BaseModel):
    gemini_api_key: str

class GoogleAuthRequest(BaseModel):
    credential: str

# Utility functions
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    payload = verify_token(token)
    user_id = payload.get("sub")
    if user_id not in users_db:
        raise HTTPException(status_code=401, detail="User not found")
    return users_db[user_id]

def save_user_to_storage(user_data: Dict[str, Any]):
    """Save user data to in-memory storage"""
    users_db[user_data["id"]] = user_data

# Root endpoint (без префикса)
@app.get("/")
async def read_root():
    return {"message": "German Letter AI Assistant Backend", "status": "OK", "auth": "Google OAuth Only"}

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "german-letter-ai-assistant", "auth": "google-oauth"}

# API endpoints (с префиксом /api)
@api_router.get("/")
async def api_root():
    return {"message": "German Letter AI Assistant API", "status": "Running", "auth": "Google OAuth Only"}

@api_router.get("/health")
async def api_health_check():
    return {"status": "healthy", "service": "api-health-check", "users_count": len(users_db)}

# Google OAuth verification
@api_router.post("/auth/google/verify")
async def verify_google_token(auth_request: GoogleAuthRequest):
    try:
        # Verify the Google ID token
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=500, detail="Google OAuth not configured")
        
        # Verify the Google ID token
        try:
            idinfo = id_token.verify_oauth2_token(
                auth_request.credential,
                requests.Request(),
                GOOGLE_CLIENT_ID
            )
            
            # Verify the token was issued by Google
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer.')
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid Google token: {str(e)}")
        
        # Extract user info from verified token
        user_info = {
            'sub': idinfo['sub'],
            'email': idinfo['email'],
            'name': idinfo['name'],
            'picture': idinfo.get('picture')
        }
        
        # Create or get user
        user_id = f"google_{user_info['sub']}"
        if user_id in users_db:
            # Update existing user
            user = users_db[user_id]
            user["last_login"] = datetime.utcnow()
        else:
            # Create new user
            user = {
                "id": user_id,
                "email": user_info["email"],
                "name": user_info["name"],
                "picture": user_info.get("picture"),
                "oauth_provider": "Google",
                "google_id": user_info["sub"],
                "created_at": datetime.utcnow(),
                "last_login": datetime.utcnow(),
                "gemini_api_key": None
            }
        
        save_user_to_storage(user)
        
        # Create access token
        access_token = create_access_token({"sub": user_id, "email": user["email"]})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "picture": user.get("picture"),
                "oauth_provider": user["oauth_provider"],
                "has_gemini_api_key": bool(user.get("gemini_api_key"))
            }
        }
        
    except Exception as e:
        logger.error(f"Google OAuth verification failed: {e}")
        raise HTTPException(status_code=400, detail="Google authentication failed")

# User profile
@api_router.get("/profile", response_model=UserProfile)
async def get_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    return UserProfile(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        picture=current_user.get("picture"),
        oauth_provider=current_user["oauth_provider"],
        created_at=current_user["created_at"],
        last_login=current_user.get("last_login"),
        has_gemini_api_key=bool(current_user.get("gemini_api_key"))
    )

# Save Gemini API key
@api_router.post("/gemini-api-key")
async def save_gemini_api_key(
    api_key_data: ApiKeyUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    try:
        # Validate the API key by testing it
        test_provider = llm_manager.create_user_provider("gemini", "gemini-1.5-flash", api_key_data.gemini_api_key)
        
        # Test the key with a simple prompt
        try:
            test_response = await test_provider.generate_content("Test")
            if not test_response:
                raise Exception("Invalid API key")
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid Gemini API key")
        
        # Save the API key
        current_user["gemini_api_key"] = api_key_data.gemini_api_key
        save_user_to_storage(current_user)
        
        return {"message": "Gemini API key saved successfully", "status": "success"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save Gemini API key: {e}")
        raise HTTPException(status_code=500, detail="Failed to save API key")

# Get LLM providers status
@api_router.get("/llm-status")
async def get_llm_status():
    try:
        provider_status = llm_manager.get_provider_status()
        active_count = sum(1 for status in provider_status.values() if status["status"] == "active")
        
        return {
            "status": "success",
            "providers": provider_status,
            "active_providers": active_count,
            "total_providers": len(provider_status)
        }
    except Exception as e:
        logger.error(f"Failed to get LLM status: {e}")
        return {"status": "error", "message": str(e)}

# Analyze file with user's API key
@api_router.post("/analyze-file-with-user-keys")
async def analyze_file_with_user_keys(
    file: UploadFile = File(...),
    language: str = Form("en"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    try:
        # Check if user has Gemini API key
        if not current_user.get("gemini_api_key"):
            raise HTTPException(
                status_code=400,
                detail="Gemini API key not configured. Please add your API key in profile."
            )
        
        # Create user-specific Gemini provider
        user_provider = llm_manager.create_user_provider("gemini", "gemini-1.5-flash", current_user["gemini_api_key"])
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_file_path = temp_file.name
        
        try:
            # Create analysis prompt
            analysis_prompt = f"""
Analyze this German official letter and provide a structured response in {language}.

Please provide:
1. Brief summary
2. Sender information
3. Letter type
4. Main content
5. Required actions
6. Important deadlines
7. Consequences if no action taken
8. Urgency level (LOW/MEDIUM/HIGH)
9. Response template if needed

File: {file.filename}
"""
            
            # Generate content using user's API key
            response_text = await user_provider.generate_content(analysis_prompt)
            
            # Parse and structure the response
            analysis_result = {
                "summary": f"Analysis of {file.filename} completed successfully",
                "analysis": {
                    "sender": "Demo sender information",
                    "letter_type": "Official document",
                    "main_content": response_text[:500] + "..." if len(response_text) > 500 else response_text,
                    "full_analysis": response_text
                },
                "actions_needed": [
                    "Review the document contents",
                    "Take appropriate action based on requirements"
                ],
                "urgency_level": "MEDIUM",
                "response_template": "Thank you for your letter. We will review and respond accordingly.",
                "llm_provider": "Gemini (User API Key)",
                "file_name": file.filename,
                "analysis_language": language
            }
            
            return analysis_result
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

# Analyze file without authentication (using system providers)
@api_router.post("/analyze-file")
async def analyze_file_public(
    file: UploadFile = File(...),
    language: str = Form("en")
):
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_file_path = temp_file.name
        
        try:
            # Check if file is an image
            is_image = file.content_type and file.content_type.startswith('image/')
            
            # Create analysis prompt
            analysis_prompt = f"""
Analyze this German official letter and provide a structured response in {language}.

Please provide:
1. Brief summary
2. Sender information
3. Letter type
4. Main content
5. Required actions
6. Important deadlines
7. Consequences if no action taken
8. Urgency level (LOW/MEDIUM/HIGH)
9. Response template if needed

File: {file.filename}
Type: {"Image" if is_image else "Document"}
"""
            
            # Generate content using system providers
            response_text, provider_used = await llm_manager.generate_content(analysis_prompt, temp_file_path if is_image else None)
            
            # Parse and structure the response
            analysis_result = {
                "summary": f"Analysis of {file.filename} completed using system providers",
                "analysis": {
                    "sender": "Analysis completed",
                    "letter_type": "Document analyzed",
                    "main_content": response_text[:500] + "..." if len(response_text) > 500 else response_text,
                    "full_analysis": response_text
                },
                "actions_needed": [
                    "Review the document contents",
                    "Take appropriate action based on requirements"
                ],
                "urgency_level": "MEDIUM",
                "response_template": "Thank you for your letter. We will review and respond accordingly.",
                "llm_provider": f"{provider_used} (System)",
                "file_name": file.filename,
                "analysis_language": language,
                "file_type": "image" if is_image else "document"
            }
            
            return analysis_result
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Public file analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

# Include the router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
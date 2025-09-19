# backend/app/utils/security.py
from fastapi import HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import logging
import os
import re
import bcrypt
import threading

from ..database import get_db
from ..models.admin import Admin
from ..config import settings

logger = logging.getLogger(__name__)

# JWT token handling
security = HTTPBearer()

class SecurityManager:
    def __init__(self):
        self.secret_key = settings.secret_key
        self.algorithm = settings.jwt_algorithm
        self.access_token_expire_minutes = settings.jwt_expire_minutes
    
    def get_password_hash(self, password: str) -> str:
        """Hash a password using bcrypt"""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
        return hashed.decode("utf-8")
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash using bcrypt"""
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), 
            hashed_password.encode("utf-8")
        )
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None):
        """Create a JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[dict]:
        """Verify and decode a JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError as e:
            logger.warning(f"Token verification failed: {e}")
            return None

security_manager = SecurityManager()

def authenticate_admin(db: Session, username: str, password: str) -> Optional[Admin]:
    """Authenticate admin user"""
    admin = db.query(Admin).filter(Admin.username == username).first()
    if not admin:
        return None
    if not admin.is_active:
        return None
    
    # Use the admin model's check_password method for consistency
    if not admin.check_password(password):
        return None
    
    # Update last login
    admin.last_login = datetime.utcnow()
    db.commit()
    
    return admin

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
    optional: bool = False  # new parameter
) -> Optional[Admin]:
    """Get current authenticated admin from JWT token; can be optional for first admin"""

    if credentials is None:
        if optional:
            return None
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = security_manager.verify_token(credentials.credentials)
    if payload is None:
        if optional:
            return None
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username: str = payload.get("sub")
    if username is None:
        if optional:
            return None
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    admin = db.query(Admin).filter(Admin.username == username).first()
    if admin is None or not admin.is_active:
        if optional:
            return None
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return admin

async def require_admin(current_user: Admin = Depends(get_current_user)) -> Admin:
    """Require admin privileges"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account"
        )
    return current_user

def validate_file_upload(filename: str, file_size: int, allowed_extensions: list = None) -> bool:
    """Validate uploaded file"""
    if allowed_extensions is None:
        allowed_extensions = ['.docx', '.doc']
    
    # Check file extension
    file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
    if f'.{file_ext}' not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    # Check file size (10MB limit by default)
    if file_size > settings.max_upload_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {settings.max_upload_size // (1024*1024)}MB"
        )
    
    return True

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal attacks"""
    # Remove directory path components
    filename = os.path.basename(filename)
    
    # Remove or replace dangerous characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255-len(ext)] + ext
    
    return filename

class RateLimitStore:
    """Thread-safe in-memory rate limit store"""
    def __init__(self):
        self.store = {}
        self.lock = threading.Lock()

    def get(self, key: str) -> dict:
        """Get rate limit data for a key"""
        with self.lock:
            return self.store.get(key, {"count": 0, "reset_time": datetime.utcnow()})

    def set(self, key: str, value: dict):
        """Set rate limit data for a key"""
        with self.lock:
            self.store[key] = value

    def cleanup_expired(self):
        """Clean up expired entries"""
        with self.lock:
            now = datetime.utcnow()
            expired_keys = [
                key for key, value in self.store.items()
                if value["reset_time"] < now
            ]
            for key in expired_keys:
                del self.store[key]


rate_limit_store = RateLimitStore()


def get_client_ip(request: Request) -> str:
    """
    Extract client IP address considering proxy headers (e.g. Render, Vercel, Cloudflare).
    Falls back to direct connection IP.
    """
    forwarded_ips = [
        request.headers.get("X-Forwarded-For"),
        request.headers.get("X-Real-IP"),
        request.headers.get("CF-Connecting-IP"),  # Cloudflare
    ]

    for forwarded_ip in forwarded_ips:
        if forwarded_ip:
            # Take the first IP if multiple are present
            return forwarded_ip.split(",")[0].strip()

    return request.client.host  # fallback


def check_rate_limit(request: Request, limit: int, window_minutes: int = 1) -> bool:
    """
    Check if request is within rate limit.
    
    Args:
        request: FastAPI request object
        limit: Max number of requests allowed
        window_minutes: Time window in minutes
    """
    client_ip = get_client_ip(request)
    key = f"{client_ip}:{request.url.path}"

    now = datetime.utcnow()
    rate_data = rate_limit_store.get(key)

    # Reset counter if window expired
    if now > rate_data["reset_time"]:
        rate_data = {"count": 0, "reset_time": now + timedelta(minutes=window_minutes)}

    # Check limit
    if rate_data["count"] >= limit:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again later."
        )

    # Increment counter safely
    rate_data["count"] += 1
    rate_limit_store.set(key, rate_data)

    # Periodically cleanup expired entries
    rate_limit_store.cleanup_expired()

    return True

# backend/app/config.py
import os
from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database - defaults to SQLite for development, PostgreSQL for production
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./templates.db")
    
    # Google Drive
    google_drive_folder_id: str = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")
    google_credentials_path: str = os.getenv("GOOGLE_CREDENTIALS_PATH", "")
    
    # Email
    resend_api_key: str = os.getenv("RESEND_API_KEY", "")
    from_email: str = os.getenv("FROM_EMAIL", "noreply@yourdomain.com")
    admin_email: str = os.getenv("ADMIN_EMAIL", "admin@yourdomain.com")
    
    # PDF Generation
    enable_pdf_generation: bool = os.getenv("ENABLE_PDF_GENERATION", "false").lower() == "true"
    
    # Security
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", "30"))
    jwt_refresh_expire_days: int = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "7"))
    
    # CORS
    allowed_origins: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173")
    
    # File Upload
    max_upload_size: int = int(os.getenv("MAX_UPLOAD_SIZE", "10485760"))  # 10MB

    # Email retry + timeout
    email_max_retries: int = int(os.getenv("EMAIL_MAX_RETRIES", "3"))
    email_retry_delay: int = int(os.getenv("EMAIL_RETRY_DELAY", "2"))
    email_timeout: int = int(os.getenv("EMAIL_TIMEOUT", "10"))
    
    # Development
    debug: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    @model_validator(mode="after")
    def check_secret_key(self):
        """Ensure secret key is properly set in production mode"""
        if self.secret_key == "dev-secret-key-change-in-production" and not self.debug:
            raise ValueError("Must set SECRET_KEY in production")
        return self

    def get_allowed_origins(self) -> List[str]:
        """Get CORS allowed origins as a list"""
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]
    
    class Config:
        env_file = ".env"

settings = Settings()
print("CORS allowed origins:", settings.get_allowed_origins())
# backend/app/main.py
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
import os
import logging
from datetime import datetime
from contextlib import asynccontextmanager

# Local imports
from .database import engine, Base
from .config import settings
from .routers import students, admin, auth 
from .models.logging_config import setup_logging
from .utils.security import check_rate_limit
from .models.responses import HealthResponse, ConfigResponse, ErrorResponse

# Setup logging before anything else
setup_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    # Startup
    logger.info("University Letter Generator starting up...")
    
    # Create database tables
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise
    
    # Create necessary directories
    directories = ["templates", "temp", "generated_docs", "uploads", "exports", "logs"]
    for directory in directories:
        try:
            os.makedirs(directory, exist_ok=True)
            logger.debug(f"Directory ensured: {directory}")
        except Exception as e:
            logger.error(f"Failed to create directory {directory}: {e}")
    
    # Initialize services
    try:
        from .services.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        app.state.pdf_available = doc_gen.pdf_available
        logger.info(f"PDF Generation: {'Available' if app.state.pdf_available else 'Not Available'}")
    except Exception as e:
        logger.error(f"Document generator initialization failed: {e}")
        app.state.pdf_available = False
    
    # Log configuration status
    logger.info(f"Database: {'SQLite (Development)' if settings.database_url.startswith('sqlite') else 'PostgreSQL (Production)'}")
    logger.info(f"Google Drive: {'Configured' if settings.google_drive_folder_id else 'Not Configured'}")
    logger.info(f"Email Service: {'Configured' if settings.resend_api_key else 'Not Configured'}")
    logger.info(f"Debug Mode: {settings.debug}")
    logger.info("Startup complete!")
    
    yield
    
    # Shutdown
    logger.info("University Letter Generator shutting down...")
    
    # Cleanup temporary files
    import tempfile
    import glob
    
    temp_files = glob.glob("temp/*")
    for temp_file in temp_files:
        try:
            os.remove(temp_file)
        except Exception as e:
            logger.warning(f"Failed to remove temp file {temp_file}: {e}")
    
    logger.info("Shutdown complete!")

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="University Letter Generator",
    description="Automated letter generation system for universities",
    version="2.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan
)

# Security middleware
if not settings.debug:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["yourdomain.com", "*.yourdomain.com"]  # Configure for your domain
    )

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)     
app.include_router(students.router)
app.include_router(admin.router)

# Basic routes
@app.get("/", response_model=dict)
async def read_root(request: Request):
    """Root endpoint"""
    check_rate_limit(request, limit=10, window_minutes=1)
    return {
        "message": "University Letter Generator API",
        "version": "2.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "documentation": "/docs" if settings.debug else "Contact administrator"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check(request: Request):
    check_rate_limit(request, limit=30, window_minutes=1)
    """Health check endpoint"""
    
    services = {}
    
    # Check database
    try:
        from .database import SessionLocal
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        services["database"] = "connected"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        services["database"] = "error"
    
    # Check Google Drive
    if settings.google_drive_folder_id and settings.google_credentials_path:
        try:
            from .services.drive_uploader import DriveUploader
            drive_uploader = DriveUploader(
                settings.google_credentials_path,
                settings.google_drive_folder_id
            )
            services["google_drive"] = "configured" if drive_uploader.is_available() else "error"
        except Exception:
            services["google_drive"] = "error"
    else:
        services["google_drive"] = "not_configured"
    
    # Check email service
    if settings.resend_api_key:
        services["email"] = "configured"
    else:
        services["email"] = "not_configured"
    
    # Overall status
    status = "healthy" if services.get("database") == "connected" else "degraded"
    
    return HealthResponse(
        status=status,
        database=services["database"],
        timestamp=datetime.now().isoformat(),
        services=services
    )

@app.get("/config", response_model=ConfigResponse)
async def get_config(request: Request):
    check_rate_limit(request, limit=10, window_minutes=1)
    """Get public configuration information"""
    return ConfigResponse(
        features={
            "google_drive": bool(settings.google_drive_folder_id),
            "email_notifications": bool(settings.resend_api_key),
            "pdf_generation": getattr(app.state, 'pdf_available', False)
        },
        version="2.0.0",
        environment="development" if settings.debug else "production"
    )

# Global exception handlers
# 404 Not Found
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    logger.warning(f"404 error for {request.url.path} from {request.client.host if request.client else 'unknown'}")
    content = ErrorResponse(
        error="Not Found",
        details={"path": str(request.url.path)},
        timestamp=datetime.now()
    )
    return JSONResponse(
        status_code=404,
        content=jsonable_encoder(content)
    )

# 422 Validation Error
@app.exception_handler(422)
async def validation_error_handler(request: Request, exc):
    logger.warning(f"Validation error for {request.url.path}: {getattr(exc, 'detail', exc)}")
    content = ErrorResponse(
        error="Validation Error",
        details={"validation_errors": getattr(exc, 'detail', str(exc))},
        timestamp=datetime.now()
    )
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder(content)
    )

# 500 Internal Server Error
@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.error(f"Internal error for {request.url.path}: {exc}", exc_info=True)
    content = ErrorResponse(
        error="Internal Server Error",
        details={"message": "An unexpected error occurred"} if not settings.debug else {"error": str(exc)},
        timestamp=datetime.now()
    )
    return JSONResponse(
        status_code=500,
        content=jsonable_encoder(content)
    )

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests"""
    start_time = datetime.now()
    
    # Log request
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"{request.method} {request.url.path} from {client_ip}")
    
    # Process request
    response = await call_next(request)
    
    # Log response
    process_time = (datetime.now() - start_time).total_seconds()
    logger.info(f"Response {response.status_code} for {request.method} {request.url.path} in {process_time:.3f}s")
    
    # Add timing header
    response.headers["X-Process-Time"] = str(process_time)
    
    return response

@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Add security headers"""
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    if not settings.debug:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    return response

if __name__ == "__main__":
    import uvicorn
    
    # Development configuration
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        reload_dirs=["app"] if settings.debug else None,
        log_level="info" if settings.debug else "warning",
        access_log=settings.debug
    )
# backend/app/routers/auth.py
from fastapi import APIRouter, HTTPException, Depends, status, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from datetime import timedelta, datetime
import logging
from typing import Optional

from ..database import get_db
from ..models.admin import Admin
from ..utils.security import authenticate_admin, security_manager, get_current_user, check_rate_limit
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["authentication"])

class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

class AdminCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: str

class AdminResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    is_active: bool
    created_at: str
    last_login: str = None

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8)

class RefreshResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

@router.post("/login", response_model=Token)
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Authenticate an administrator and issue access/refresh tokens."""

    check_rate_limit(request, limit=5, window_minutes=1)

    try:
        admin = authenticate_admin(
            db,
            form_data.username,
            form_data.password
        )

        if not admin:
            logger.warning(
                "Failed login attempt for username: "
                f"{form_data.username} from {request.client.host}"
            )

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token = security_manager.create_access_token(
            data={"sub": admin.username}
        )

        refresh_token = security_manager.create_refresh_token(
            data={"sub": admin.username}
        )

        # HttpOnly prevents JavaScript from reading the refresh token.
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=not settings.debug,
            samesite="lax",
            max_age=settings.jwt_refresh_expire_days * 24 * 60 * 60,
            path="/api/auth",
        )

        admin.last_login = datetime.utcnow()
        db.commit()

        logger.info(f"Successful login for admin: {admin.username}")

        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.jwt_expire_minutes * 60
        )

    except HTTPException:
        raise

    except Exception as exc:
        logger.error(f"Login error: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Login failed"
        )
    
@router.post("/refresh", response_model=RefreshResponse)
async def refresh_access_token(
    request: Request,
    db: Session = Depends(get_db)
):
    """Issue a new access token using the refresh-token cookie."""

    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is missing"
        )

    payload = security_manager.verify_token(
        refresh_token,
        expected_type="refresh"
    )

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or expired"
        )

    username = payload.get("sub")

    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    admin = (
        db.query(Admin)
        .filter(Admin.username == username)
        .first()
    )

    if not admin or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Administrator not found or inactive"
        )

    access_token = security_manager.create_access_token(
        data={"sub": admin.username}
    )

    return RefreshResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.jwt_expire_minutes * 60
    )

@router.post("/register", response_model=AdminResponse)
async def register_admin(
    request: Request,
    admin_data: AdminCreate,
    db: Session = Depends(get_db),
    current_admin: Optional[Admin] = Depends(lambda: get_current_user(optional=True))
):
    check_rate_limit(request, limit=2, window_minutes=60)
    """Register new admin:
       - If no admin exists yet → open registration
       - Otherwise → only logged-in admins can register others
    """

    existing_admin_count = db.query(Admin).count()

    # If admins already exist, require login
    if existing_admin_count > 0 and not current_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authenticated admins can create new admins"
        )

    try:
        # Check if username or email already exists
        existing_admin = db.query(Admin).filter(
            (Admin.username == admin_data.username) | (Admin.email == admin_data.email)
        ).first()
        
        if existing_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already registered"
            )
        
        # Create new admin
        admin = Admin(
            username=admin_data.username,
            email=admin_data.email,
            full_name=admin_data.full_name
        )
        admin.set_password(admin_data.password)
        
        db.add(admin)
        db.commit()
        db.refresh(admin)
        
        logger.info(f"New admin registered: {admin.username}")
        
        return AdminResponse(
            id=admin.id,
            username=admin.username,
            email=admin.email,
            full_name=admin.full_name,
            is_active=admin.is_active,
            created_at=admin.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Admin registration error: {e}")
        raise HTTPException(500, "Registration failed")


@router.get("/me", response_model=AdminResponse)
async def get_current_admin(current_admin: Admin = Depends(get_current_user)):
    """Get current admin information"""
    return AdminResponse(
        id=current_admin.id,
        username=current_admin.username,
        email=current_admin.email,
        full_name=current_admin.full_name,
        is_active=current_admin.is_active,
        created_at=current_admin.created_at.isoformat(),
        last_login=current_admin.last_login.isoformat() if current_admin.last_login else None
    )

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(
        key="refresh_token",
        path="/api/auth",
        httponly=True,
        secure=not settings.debug,
        samesite="lax",
    )

    return {"message": "Successfully logged out"}
    
@router.post("/change-password")
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_user)
):
    check_rate_limit(request, limit=3, window_minutes=60)
    
    # Verify current password
    if not security_manager.verify_password(body.current_password, current_admin.password_hash):
        raise HTTPException(400, "Current password is incorrect")

    # Hash and update new password
    current_admin.password_hash = security_manager.get_password_hash(body.new_password)
    db.commit()
    db.refresh(current_admin)

    return {"message": "Password updated successfully"}
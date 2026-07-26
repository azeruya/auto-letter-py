# backend/app/models/admin.py
from sqlalchemy import Column, String, DateTime, Boolean
from ..database import Base
from datetime import datetime
import uuid

class Admin(Base):
    __tablename__ = "admins"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)
    
    def set_password(self, password: str):
        """Hash and set the admin's password"""
        from ..utils.security import security_manager
        self.password_hash = security_manager.get_password_hash(password)

    def check_password(self, password: str) -> bool:
        """Verify the admin's password"""
        from ..utils.security import security_manager
        return security_manager.verify_password(password, self.password_hash)
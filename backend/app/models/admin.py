# backend/app/models/admin.py
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from ..database import Base
from datetime import datetime
import uuid
import bcrypt

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
        """Hash and set password using bcrypt"""
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        self.password_hash = hashed.decode("utf-8")  # store as string
    
    def check_password(self, password: str) -> bool:
        """Verify password using bcrypt"""
        return bcrypt.checkpw(password.encode("utf-8"), self.password_hash.encode("utf-8"))

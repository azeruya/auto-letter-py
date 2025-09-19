# backend/app/models/student.py
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.orm import relationship
from ..database import Base
from datetime import datetime
import uuid

class Student(Base):
    __tablename__ = "students"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nama = Column(String, nullable=False)
    nim = Column(String, nullable=False, index=True)  # Add index for faster queries
    email = Column(String, nullable=False, index=True)
    program_studi = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    requests = relationship("LetterRequest", back_populates="student")
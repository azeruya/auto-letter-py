# backend/app/models/request.py
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from ..database import Base
from datetime import datetime
import uuid

class LetterRequest(Base):
    __tablename__ = "letter_requests"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    template_id = Column(String, ForeignKey("templates.id"), nullable=False)
    
    # Basic request info
    keperluan = Column(String, nullable=False)
    tracking_id = Column(String, unique=True, index=True)  # For student tracking
    
    # Form data (JSON fields)
    student_data = Column(JSON)  # Data filled by student
    admin_data = Column(JSON)    # Data filled by admin
    
    # Status tracking
    status = Column(String, default="pending")  # pending, in_progress, completed, rejected
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    processed_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Admin info
    processed_by = Column(String, ForeignKey("admins.id"))
    admin_notes = Column(Text)
    
    # Notification flags
    student_notified = Column(Boolean, default=False)
    pickup_notified = Column(Boolean, default=False)
    
    # Relationships
    student = relationship("Student", back_populates="requests")
    template = relationship("Template", back_populates="requests")
    documents = relationship("GeneratedDocument", back_populates="request")
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.tracking_id:
            # Generate tracking ID (e.g., "REQ240825001")
            from datetime import datetime
            date_part = datetime.now().strftime("%y%m%d")
            # You might want to implement a counter here for uniqueness
            import random
            number_part = f"{random.randint(100, 999):03d}"
            self.tracking_id = f"REQ{date_part}{number_part}"
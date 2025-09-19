# backend/app/models/document.py
from sqlalchemy import Column, String, DateTime, Integer, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base
from datetime import datetime
import uuid

class GeneratedDocument(Base):
    __tablename__ = "generated_documents"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String, ForeignKey("letter_requests.id"), nullable=False)
    
    # File information
    filename = Column(String, nullable=False)
    file_path = Column(String)  # Local storage path (temporary)
    drive_file_id = Column(String)  # Google Drive file ID
    drive_file_url = Column(String)  # Drive sharing URL
    
    # Document metadata
    document_type = Column(String, default="docx")  # docx, pdf
    file_size = Column(Integer)
    mime_type = Column(String)
    
    # Status
    created_at = Column(DateTime, default=datetime.utcnow)
    uploaded_to_drive = Column(Boolean, default=False)
    upload_error = Column(String)  # Store any upload errors
    
    # Relationship
    request = relationship("LetterRequest", back_populates="documents")
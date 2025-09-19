# backend/app/models/responses.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

# Base response models
class BaseResponse(BaseModel):
    success: bool
    message: str
    timestamp: datetime = Field(default_factory=datetime.now)

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.now)

# Template responses
class TemplateUploadResponse(BaseResponse):
    template_id: Optional[str] = None
    field_count: Optional[int] = None
    schema: Optional[Dict[str, Any]] = None
    field_assignments: Optional[Dict[str, List[str]]] = None

class TemplateListItem(BaseModel):
    id: str
    name: str
    category: str
    original_filename: str
    field_count: int
    usage_count: int
    created_at: Optional[str] = None

class TemplateListResponse(BaseResponse):
    templates: List[TemplateListItem]
    total_count: int

class TemplateDetailResponse(BaseModel):
    id: str
    name: str
    category: str
    original_filename: str
    schema: Dict[str, Any]
    placeholders: List[str]
    field_assignments: Optional[Dict[str, List[str]]] = None
    created_at: Optional[str] = None

# Student request responses
class StudentInfo(BaseModel):
    nama: str
    nim: str
    email: str
    program_studi: Optional[str] = None

class RequestSubmissionResponse(BaseResponse):
    data: Optional[Dict[str, Any]] = None

class TrackingResponse(BaseModel):
    tracking_id: str
    status: str
    status_description: str
    student_name: str
    template_name: str
    keperluan: str
    created_at: str
    processed_at: Optional[str] = None
    completed_at: Optional[str] = None
    admin_notes: Optional[str] = None

class DocumentInfo(BaseModel):
    id: str
    filename: str
    document_type: str
    file_size: int
    created_at: str
    drive_available: bool
    download_url: Optional[str] = None

class DocumentsResponse(BaseModel):
    tracking_id: str
    request_status: str
    documents: List[DocumentInfo]

# Admin responses
class AdminListResponse(BaseResponse):
    admins: List[dict]

class DashboardStats(BaseModel):
    status_counts: Dict[str, int]
    total_requests: int
    pending_requests: int
    recent_requests: List[Dict[str, Any]]
    popular_templates: List[Dict[str, Any]]

class RequestListItem(BaseModel):
    id: str
    tracking_id: str
    student: StudentInfo
    template: Dict[str, str]
    keperluan: str
    status: str
    created_at: str
    admin_notes: Optional[str] = None

class RequestListResponse(BaseModel):
    requests: List[RequestListItem]
    total_count: int
    has_more: bool

class RequestDetailResponse(BaseModel):
    request: Dict[str, Any]
    admin_form_schema: Dict[str, Any]

# Form validation models
class StudentFormData(BaseModel):
    nama: str = Field(..., min_length=2, max_length=100)
    nim: str = Field(..., min_length=8, max_length=20)
    email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
    program_studi: Optional[str] = Field(None, max_length=100)
    template_id: str = Field(..., min_length=1)
    keperluan: str = Field(..., min_length=10, max_length=500)
    form_data: Dict[str, Any]

    @validator('nim')
    def validate_nim(cls, v):
        if not v.isdigit():
            raise ValueError('NIM must contain only numbers')
        return v

    @validator('keperluan')
    def validate_keperluan(cls, v):
        if len(v.strip()) < 10:
            raise ValueError('Keperluan must be at least 10 characters')
        return v.strip()

class AdminFormData(BaseModel):
    form_data: Dict[str, Any] = Field(..., min_items=0)
    admin_notes: Optional[str] = Field(None, max_length=1000)

    @validator('admin_notes')
    def validate_admin_notes(cls, v):
        if v:
            return v.strip()
        return v

# File upload models
class FileUploadResponse(BaseResponse):
    filename: Optional[str] = None
    file_size: Optional[int] = None
    file_type: Optional[str] = None

class DocumentGenerationResponse(BaseResponse):
    generated_documents: List[Dict[str, Any]] = []
    completion_email_sent: Optional[bool] = None

# Validation models for common fields
class TrackingIdField(BaseModel):
    tracking_id: str = Field(..., pattern=r'^REQ\d{6}\d{3}$')

    @validator('tracking_id')
    def validate_tracking_id(cls, v):
        if not v.startswith('REQ'):
            raise ValueError('Invalid tracking ID format')
        return v

class FieldAssignmentUpdate(BaseModel):
    student_fields: List[str] = Field(default_factory=list)
    admin_fields: List[str] = Field(default_factory=list)
    auto_fields: List[str] = Field(default_factory=list)

    @validator('*', pre=True, each_item=True)
    def validate_field_names(cls, v):
        if isinstance(v, str) and v.strip():
            return v.strip()
        raise ValueError('Field names must be non-empty strings')

# Export request models
class ExportRequest(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    format: str = Field('excel', pattern=r'^(excel|csv)$')

    @validator('start_date', 'end_date')
    def validate_dates(cls, v):
        if v:
            try:
                datetime.fromisoformat(v)
                return v
            except ValueError:
                raise ValueError('Invalid date format. Use ISO format (YYYY-MM-DD)')
        return v

# Health check response
class HealthResponse(BaseModel):
    status: str
    database: str
    timestamp: str
    services: Dict[str, str] = Field(default_factory=dict)
    
# Configuration response
class ConfigResponse(BaseModel):
    features: Dict[str, bool]
    version: str
    environment: str = "development"
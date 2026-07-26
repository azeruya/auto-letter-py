# backend/app/routers/students.py
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import logging

from ..database import get_db
from ..models.student import Student
from ..models.template import Template
from ..models.request import LetterRequest
from ..models.responses import (
    StudentFormData, RequestSubmissionResponse, TrackingResponse, 
    DocumentsResponse, TemplateListResponse, BaseResponse, ErrorResponse
)
from ..services.field_assignment import FieldAssignmentService
from ..services.email_service import EmailService
from ..utils.security import validate_file_upload, sanitize_filename, check_rate_limit
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/student", tags=["student"])

field_service = FieldAssignmentService()
email_service = EmailService()

@router.get("/keperluan")
def get_keperluan_options(db: Session = Depends(get_db)):
    templates = db.query(Template).filter(Template.is_active == True).all()
    return [{"value": t.name, "key": str(t.id)} for t in templates]

@router.post("/submit-request", response_model=RequestSubmissionResponse)
async def submit_letter_request(
    request: Request,
    submission: StudentFormData,
    db: Session = Depends(get_db)
):
    check_rate_limit(request, limit=5, window_minutes=1)
    """Submit a complete letter request (no session needed)"""
    
    try:
        # 1. Get or create student record
        student = db.query(Student).filter(Student.nim == submission.nim).first()
        
        if student:
            # Update existing student info in case it changed
            student.nama = submission.nama
            student.email = submission.email
            student.program_studi = submission.program_studi
            db.commit()
            logger.info(f"Updated existing student record for NIM: {submission.nim}")
        else:
            # Create new student record
            student = Student(
                nama=submission.nama,
                nim=submission.nim,
                email=submission.email,
                program_studi=submission.program_studi
            )
            db.add(student)
            db.commit()
            db.refresh(student)
            logger.info(f"Created new student record for NIM: {submission.nim}")
        
        # 2. Get and validate template
        template = db.query(Template).filter(Template.id == submission.template_id).first()
        if not template or not template.is_active:
            raise HTTPException(404, "Template not found or inactive")
        
        # 3. Validate student form data
        logger.info(f"Template.schema: {getattr(template, 'schema', None)}")
        logger.info(f"Template.form_schema: {getattr(template, 'form_schema', None)}")
        validation = field_service.validate_required_fields(
            template, submission.form_data, "student"
        )
        
        if not validation["valid"]:
            logger.warning(f"Validation failed for student {submission.nim}: {validation['missing_fields']}")
            raise HTTPException(400, {
                "message": "Missing required fields",
                "missing_fields": validation["missing_fields"],
                "provided_fields": validation["provided_fields"]
            })
        
        # 4. Create letter request
        letter_request = LetterRequest(
            student_id=student.id,
            template_id=template.id,
            keperluan=submission.keperluan,
            student_data=submission.form_data,
            status="pending"
        )
        
        db.add(letter_request)
        db.commit()
        db.refresh(letter_request)
        
        # 5. Update template usage count
        template.usage_count = (template.usage_count or 0) + 1
        db.commit()
        
        # 6. Send notifications directly and wait for result
        student_status = None
        admin_status = None

        if email_service.is_available():
            student_status = await send_student_confirmation_async(
                student.email, 
                student.nama, 
                letter_request.tracking_id
            )

            admin_status = await send_admin_notification_async(
                settings.admin_email,
                student.nama,
                template.name,
                letter_request.tracking_id,
                student.nim
            )
        
        logger.info(f"Letter request submitted successfully: {letter_request.tracking_id}")
        
        return RequestSubmissionResponse(
            success=True,
            message="Letter request submitted successfully",
            data={
                "request_id": letter_request.id,
                "tracking_id": letter_request.tracking_id,
                "student_name": student.nama,
                "template_name": template.name,
                "status": letter_request.status,
                "created_at": letter_request.created_at.isoformat(),
                "student_email_sent": student_status,
                "admin_email_sent": admin_status
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Letter request submission failed for NIM {submission.nim}: {e}")
        raise HTTPException(500, f"Request submission failed: {str(e)}")

@router.get("/templates", response_model=TemplateListResponse)
async def list_available_templates(request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, limit=20, window_minutes=1)
    """Get all active templates available for students"""
    try:
        templates = db.query(Template).filter(Template.is_active == True).all()
        
        template_list = []
        for t in templates:
            student_fields_count = 0
            if t.field_assignments:
                student_fields_count = len(t.field_assignments.get("student_fields", []))
            
            template_list.append({
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "category": t.category,
                "original_filename": t.original_filename,   # ✅ required
                "field_count": len(t.placeholders or []),
                "student_fields_count": student_fields_count,
                "usage_count": t.usage_count or 0,
                "is_active": t.is_active,
                "created_at": t.created_at.isoformat() if t.created_at else None  # ✅ safe conversion
            })
        
        return jsonable_encoder(TemplateListResponse(
            success=True,
            message=f"Retrieved {len(template_list)} templates",
            templates=template_list,
            total_count=len(template_list)
        ))
        
    except Exception as e:
        logger.error(f"Template list retrieval failed: {e}")
        raise HTTPException(500, "Failed to retrieve templates")

import json

@router.get("/templates/{template_id}/form")
async def get_student_form(
    request: Request,
    template_id: str, 
    db: Session = Depends(get_db)
):
    check_rate_limit(request, limit=10, window_minutes=1)
    """Get form schema for student to fill"""
    try:
        template = db.query(Template).filter(
            Template.id == template_id, 
            Template.is_active == True
        ).first()
        
        if not template:
            raise HTTPException(404, "Template not found")

        # Ensure schema + field_assignments are parsed dicts
        if isinstance(template.schema, str):
            try:
                template.schema = json.loads(template.schema)
            except Exception as e:
                logger.error(f"Invalid schema JSON for template {template_id}: {e}")
                raise HTTPException(500, "Invalid template schema")

        if isinstance(template.field_assignments, str):
            try:
                template.field_assignments = json.loads(template.field_assignments)
            except Exception as e:
                logger.error(f"Invalid field_assignments JSON for template {template_id}: {e}")
                raise HTTPException(500, "Invalid field assignments")

        # Get student form schema
        student_schema = field_service.get_student_form_schema(template)
        
        return {
            "template": {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "category": template.category
            },
            "form_schema": student_schema,
            "total_student_fields": len(template.field_assignments.get("student_fields", []) if template.field_assignments else [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Student form retrieval failed for template {template_id}: {e}")
        raise HTTPException(500, "Failed to retrieve form")


@router.get("/track/{tracking_id}", response_model=TrackingResponse)
async def track_request_status(
    request: Request,
    tracking_id: str, 
    db: Session = Depends(get_db)
):
    check_rate_limit(request, limit=10, window_minutes=1)
    """Track letter request status using tracking ID"""
    try:
        # Validate tracking ID format
        if not tracking_id.startswith('REQ') or len(tracking_id) != 12:
            raise HTTPException(400, "Invalid tracking ID format")
        
        request_record = db.query(LetterRequest).filter(
            LetterRequest.tracking_id == tracking_id
        ).first()
        
        if not request_record:
            raise HTTPException(404, "Request not found with this tracking ID")
        
        status_descriptions = {
            "pending": "Pengajuan Anda sedang menunggu untuk diproses oleh admin",
            "in_progress": "Pengajuan Anda sedang diproses oleh admin",
            "completed": "Surat Anda sudah selesai dan siap diambil di kantor administrasi",
            "rejected": "Pengajuan Anda ditolak. Silakan hubungi admin untuk informasi lebih lanjut"
        }
        
        return TrackingResponse(
            tracking_id=request_record.tracking_id,
            status=request_record.status,
            status_description=status_descriptions.get(request_record.status, "Status tidak dikenal"),
            student_name=request_record.student.nama,
            template_name=request_record.template.name,
            keperluan=request_record.keperluan,
            created_at=request_record.created_at.isoformat(),
            processed_at=request_record.processed_at.isoformat() if request_record.processed_at else None,
            completed_at=request_record.completed_at.isoformat() if request_record.completed_at else None,
            admin_notes=request_record.admin_notes if request_record.status in ["completed", "rejected"] else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Tracking failed for ID {tracking_id}: {e}")
        raise HTTPException(500, "Failed to track request")

@router.get("/track/{tracking_id}/documents", response_model=DocumentsResponse)
async def get_request_documents(
    request: Request,
    tracking_id: str, 
    db: Session = Depends(get_db)
):
    check_rate_limit(request, limit=5, window_minutes=1)
    """Get generated documents for a request (if completed)"""
    try:
        request_record = db.query(LetterRequest).filter(
            LetterRequest.tracking_id == tracking_id
        ).first()
        
        if not request_record:
            raise HTTPException(404, "Request not found with this tracking ID")
        
        if request_record.status != "completed":
            raise HTTPException(400, "Documents are only available for completed requests")
        
        documents = []
        for doc in request_record.documents:
            documents.append({
                "id": doc.id,
                "filename": doc.filename,
                "document_type": doc.document_type,
                "file_size": doc.file_size,
                "created_at": doc.created_at.isoformat(),
                "drive_available": doc.uploaded_to_drive,
                "download_url": doc.drive_file_url if doc.uploaded_to_drive else None
            })
        
        return DocumentsResponse(
            tracking_id=tracking_id,
            request_status=request_record.status,
            documents=documents
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document retrieval failed for tracking ID {tracking_id}: {e}")
        raise HTTPException(500, "Failed to retrieve documents")

# Background task functions
async def send_student_confirmation_async(email: str, name: str, tracking_id: str) -> bool:
    """Background task to send student confirmation email"""
    try:
        success = email_service.send_student_confirmation(email, name, tracking_id)
        if success:
            logger.info(f"Student confirmation sent to {email}")
        else:
            logger.warning(f"Failed to send student confirmation to {email}")
        return success
    except Exception as e:
        logger.error(f"Student confirmation background task error: {e}")
        return False


async def send_admin_notification_async(admin_email: str, student_name: str, 
    template_name: str, tracking_id: str, student_nim: str) -> bool:
    """Background task to send admin notification email"""
    try:
        success = email_service.send_admin_notification(
            admin_email, student_name, template_name, tracking_id, student_nim
        )
        if success:
            logger.info(f"Admin notification sent to {admin_email}")
        else:
            logger.warning(f"Failed to send admin notification to {admin_email}")
        return success
    except Exception as e:
        logger.error(f"Admin notification background task error: {e}")
        return False
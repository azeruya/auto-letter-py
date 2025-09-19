# backend/app/routers/admin.py
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks, Request, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from typing import Dict, Any, List, Optional
import os
import logging
import uuid
import shutil
from datetime import datetime
from fastapi.encoders import jsonable_encoder

# Local imports
from ..database import get_db
from ..models.request import LetterRequest
from ..models.student import Student
from ..models.template import Template
from ..models.document import GeneratedDocument
from ..models.admin import Admin
from ..models.responses import (
    AdminFormData, DashboardStats, RequestListResponse, RequestDetailResponse,
    DocumentGenerationResponse, BaseResponse, ErrorResponse,
    TemplateUploadResponse, TemplateListResponse, AdminListResponse
)
from ..services.template_parser import TemplateParser
from ..services.field_assignment import FieldAssignmentService
from ..services.document_generator import DocumentGenerator
from ..services.drive_uploader import DriveUploader
from ..services.excel_exporter import ExcelExporter
from ..services.email_service import EmailService
from ..config import settings
from ..utils.security import require_admin, get_current_user, check_rate_limit, validate_file_upload, sanitize_filename

# ROUTE CATALOG (for redundancy checks)
# TEMPLATES (admin)
# POST /api/admin/templates/upload
# GET /api/admin/templates
# GET /api/admin/templates/{template_id}
# PUT /api/admin/templates/{template_id}
# PUT /api/admin/templates/{template_id}/field-assignments
# DELETE /api/admin/templates/{template_id}
# POST /api/admin/templates/{template_id}/preview
# STATS/DASHBOARD (admin)
# GET /api/admin/dashboard
# GET /api/admin/stats/monthly?year=YYYY
# GET /api/admin/templates/usage
# REQUESTS (admin)
# GET /api/admin/requests
# GET /api/admin/requests/{request_id}
# PUT /api/admin/requests/{request_id}/process
# POST /api/admin/requests/{request_id}/generate
# POST /api/admin/requests/{request_id}/reject
# GET /api/admin/export/requests
# POST /api/admin/export/requests/detailed
# DELETE /api/admin/requests/{request_id}

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Initialize services
template_parser = TemplateParser()
field_service = FieldAssignmentService()
document_generator = DocumentGenerator()
excel_exporter = ExcelExporter()
email_service = EmailService()

# Initialize Google Drive uploader if configured
drive_uploader = None
if settings.google_drive_folder_id and settings.google_credentials_path:
    try:
        drive_uploader = DriveUploader(
            settings.google_credentials_path,
            settings.google_drive_folder_id
        )
        logger.info("Google Drive uploader initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Drive uploader: {e}")

@router.get("/admins", response_model=AdminListResponse)
async def list_admins(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=30, window_minutes=1)

    try:
        admins = db.query(Admin).all()

        # Convert each admin to a safe dictionary
        admin_items = []
        for a in admins:
            admin_dict = {
                "id": a.id,
                "username": a.username,
                "email": a.email,
                "full_name": a.full_name,
                "is_active": a.is_active,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "last_login": a.last_login.isoformat() if a.last_login else None
            }
            admin_items.append(admin_dict)

        # DEBUG LOG: see what will be returned
        logger.info(f"Admin items ready for response: {admin_items}")

        return AdminListResponse(
            success=True,
            message=f"Retrieved {len(admin_items)} admins",
            admins=admin_items
        )

    except Exception as e:
        # DEBUG LOG: see the actual error
        logger.error(f"Admin list retrieval failed: {e}")
        raise HTTPException(500, "Failed to retrieve admins")


# TEMPLATES MANAGEMENT
@router.post("/templates/upload", response_model=TemplateUploadResponse)
async def upload_template(
    request: Request,
    file: UploadFile = File(...),
    name: str = Form(None),
    category: str = Form("general"),
    description: str = Form(""),
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=5, window_minutes=60)
    """Upload and parse a template file"""
    
    if not file.filename or not file.filename.lower().endswith('.docx'):
        raise HTTPException(400, "Only .docx files are supported")
    
    # Validate file
    file_size = 0
    content = await file.read()
    file_size = len(content)
    
    validate_file_upload(file.filename, file_size, ['.docx'])
    
    # Reset file position
    await file.seek(0)
    
    temp_file_path = None
    final_file_path = None
    
    try:
        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1]
        safe_filename = sanitize_filename(file.filename)
        stored_filename = f"{file_id}{file_extension}"
        
        # Ensure templates directory exists
        templates_dir = "templates"
        os.makedirs(templates_dir, exist_ok=True)
        
        final_file_path = os.path.join(templates_dir, stored_filename)
        
        # Save uploaded file
        with open(final_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Template file saved: {final_file_path}")
        
        # Parse template
        parse_result = template_parser.parse_template(final_file_path)
        
        if not parse_result["success"]:
            os.remove(final_file_path)
            raise HTTPException(400, f"Template parsing failed: {parse_result['error']}")
        
        # Create template record
        template_name = name or os.path.splitext(safe_filename)[0]
        template = Template(
            name=template_name,
            description=description,
            original_filename=safe_filename,
            category=category,
            schema=parse_result["schema"],
            placeholders=parse_result["placeholders"],
            file_path=final_file_path
        )
        
        db.add(template)
        db.commit()
        db.refresh(template)
        
        # Automatically assign fields
        field_assignments = field_service.assign_fields_automatically(template)
        field_service.update_field_assignments(db, template.id, field_assignments)
        
        logger.info(f"Template uploaded successfully: {template.name} by {current_user.username}")
        
        return TemplateUploadResponse(
            success=True,
            message=f"Template uploaded successfully with {parse_result['field_count']} fields detected",
            template_id=template.id,
            field_count=parse_result["field_count"],
            schema=parse_result["schema"],
            field_assignments=field_assignments
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # Cleanup files on error
        if final_file_path and os.path.exists(final_file_path):
            try:
                os.remove(final_file_path)
            except:
                pass
        
        logger.error(f"Template upload failed: {e}")
        raise HTTPException(500, f"Upload failed: {str(e)}")

@router.get("/templates", response_model=TemplateListResponse)
async def list_templates(
    request: Request, 
    db: Session = Depends(get_db), 
    current_user = Depends(require_admin)   # ✅ restrict to admins
):
    check_rate_limit(request, limit=60, window_minutes=1)  # admins can handle higher limits
    """Get all templates (active and inactive) for admin"""
    try:
        templates = db.query(Template).all()   # ✅ show everything, not just active
        
        template_items = []
        for t in templates:
            template_items.append({
                "id": t.id,
                "name": t.name,
                "category": t.category,
                "original_filename": t.original_filename,
                "field_count": len(t.placeholders or []),
                "usage_count": t.usage_count or 0,
                "is_active": t.is_active,      # ✅ include status (important for admin)
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "updated_at": t.updated_at.isoformat() if t.updated_at else None
            })
        
        return TemplateListResponse(
            success=True,
            message=f"Retrieved {len(template_items)} templates",
            templates=template_items,
            total_count=len(template_items)
        )
        
    except Exception as e:
        logger.error(f"Admin template list retrieval failed: {e}")
        raise HTTPException(500, "Failed to retrieve templates")


@router.get("/templates/{template_id}")
async def get_template(
    request: Request,
    template_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=20, window_minutes=1)
    """Get template details"""
    try:
        template = db.query(Template).filter(Template.id == template_id).first()
        
        if not template:
            raise HTTPException(404, "Template not found")
        
        return jsonable_encoder({
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "category": template.category,
            "original_filename": template.original_filename,
            "schema": template.schema,
            "placeholders": template.placeholders,
            "field_assignments": template.field_assignments,
            "is_active": template.is_active,
            "usage_count": template.usage_count or 0,
            "created_at": template.created_at.isoformat() if template.created_at else None,
            "updated_at": template.updated_at.isoformat() if template.updated_at else None
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Template detail retrieval failed for {template_id}: {e}")
        raise HTTPException(500, "Failed to retrieve template details")

@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    """Delete a template (soft delete)"""
    try:
        template = db.query(Template).filter(Template.id == template_id).first()
        
        if not template:
            raise HTTPException(404, "Template not found")
        
        # Check if template is being used in pending requests
        from ..models.request import LetterRequest
        active_requests = db.query(LetterRequest).filter(
            LetterRequest.template_id == template_id,
            LetterRequest.status.in_(["pending", "in_progress"])
        ).count()
        
        if active_requests > 0:
            raise HTTPException(400, f"Cannot delete template with {active_requests} active requests")
        
        # Soft delete (mark as inactive)
        template.is_active = False
        db.commit()
        
        logger.info(f"Template {template_id} deleted by {current_user.username}")
        
        return {"success": True, "message": "Template deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Template deletion failed for {template_id}: {e}")
        raise HTTPException(500, "Failed to delete template")

@router.put("/templates/{template_id}/field-assignments")
async def update_field_assignments(
    template_id: str,
    assignments: Dict[str, List[str]],
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    """Update field assignments for a template"""
    try:
        # Validate assignment structure
        required_keys = ["student_fields", "admin_fields", "auto_fields"]
        if not all(key in assignments for key in required_keys):
            raise HTTPException(400, f"Missing required keys. Required: {required_keys}")
        
        success = field_service.update_field_assignments(db, template_id, assignments)
        
        if not success:
            raise HTTPException(400, "Failed to update field assignments")
        
        logger.info(f"Field assignments updated for template {template_id} by {current_user.username}")
        
        return {"success": True, "message": "Field assignments updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Field assignment update failed for template {template_id}: {e}")
        raise HTTPException(500, "Failed to update field assignments")

@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    name: str = Form(None),
    description: str = Form(None),
    category: str = Form(None),
    is_active: bool = Form(None),
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    """Update template metadata"""
    try:
        template = db.query(Template).filter(Template.id == template_id).first()
        
        if not template:
            raise HTTPException(404, "Template not found")
        
        # Update fields if provided
        if name is not None:
            template.name = name
        if description is not None:
            template.description = description
        if category is not None:
            template.category = category
        if is_active is not None:
            template.is_active = is_active
        
        db.commit()
        
        logger.info(f"Template {template_id} updated by {current_user.username}")
        
        return {
            "success": True,
            "message": "Template updated successfully",
            "template": {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "category": template.category,
                "is_active": template.is_active
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Template update failed for {template_id}: {e}")
        raise HTTPException(500, "Failed to update template")

@router.post("/templates/{template_id}/preview")
async def preview_template_generation(
    template_id: str,
    sample_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    """Preview document generation with sample data"""
    try:
        template = db.query(Template).filter(Template.id == template_id).first()
        
        if not template:
            raise HTTPException(404, "Template not found")
        
        preview_result = document_generator.preview_replacements(template.file_path, sample_data)
        
        return {
            "success": preview_result["success"],
            "message": "Preview generated successfully" if preview_result["success"] else "Preview failed",
            "replacements": preview_result.get("replacements", []),
            "total_replacements": preview_result.get("total_replacements", 0),
            "error": preview_result.get("error"),
            "pdf_available": preview_result.get("pdf_available", False)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Template preview failed for {template_id}: {e}")
        raise HTTPException(500, "Failed to generate preview")


# STATS OR DASHBOARD
@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=10, window_minutes=1)
    """Get admin dashboard statistics"""
    try:
        # Count requests by status
        status_counts = db.query(
            LetterRequest.status,
            func.count(LetterRequest.id).label('count')
        ).group_by(LetterRequest.status).all()
        
        status_stats = {status: count for status, count in status_counts}
        
        # Recent requests
        recent_requests = db.query(LetterRequest)\
            .options(joinedload(LetterRequest.student), joinedload(LetterRequest.template))\
            .order_by(desc(LetterRequest.created_at))\
            .limit(10).all()
        
        # Template usage
        template_usage = db.query(
            Template.name,
            Template.usage_count
        ).filter(Template.is_active == True)\
        .order_by(desc(Template.usage_count))\
        .limit(5).all()
        
        dashboard_data = DashboardStats(
            status_counts=status_stats,
            total_requests=sum(status_stats.values()),
            pending_requests=status_stats.get("pending", 0),
            recent_requests=[
                {
                    "id": req.id,
                    "tracking_id": req.tracking_id,
                    "student_name": req.student.nama,
                    "template_name": req.template.name,
                    "status": req.status,
                    "created_at": req.created_at.isoformat()
                }
                for req in recent_requests
            ],
            popular_templates=[
                {"name": name, "usage_count": count}
                for name, count in template_usage
            ]
        )
        
        logger.info(f"Dashboard accessed by admin: {current_user.username}")
        return dashboard_data
        
    except Exception as e:
        logger.error(f"Dashboard error: {e}")
        raise HTTPException(500, "Failed to retrieve dashboard data")
    
@router.get("/stats/monthly")
async def get_monthly_stats(
    request: Request,
    year: int = Query(..., ge=2020, le=2030),
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=10, window_minutes=1)
    """Get monthly statistics for a specific year"""
    try:
        from sqlalchemy import extract
        
        monthly_stats = db.query(
            extract('month', LetterRequest.created_at).label('month'),
            LetterRequest.status,
            func.count(LetterRequest.id).label('count')
        ).filter(
            extract('year', LetterRequest.created_at) == year
        ).group_by(
            extract('month', LetterRequest.created_at),
            LetterRequest.status
        ).all()
        
        # Format data for chart
        result = {}
        for month, status, count in monthly_stats:
            month_key = f"month_{int(month)}"
            if month_key not in result:
                result[month_key] = {}
            result[month_key][status] = count
        
        return {
            "year": year,
            "monthly_data": result
        }
        
    except Exception as e:
        logger.error(f"Monthly stats error: {e}")
        raise HTTPException(500, "Failed to retrieve monthly statistics")
    
# Utility endpoints
@router.get("/templates/usage")
async def get_template_usage(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=10, window_minutes=1)
    """Get template usage statistics"""
    try:
        usage_stats = db.query(
            Template.id,
            Template.name,
            Template.category,
            Template.usage_count,
            func.count(LetterRequest.id).label('total_requests')
        ).outerjoin(
            LetterRequest, Template.id == LetterRequest.template_id
        ).group_by(
            Template.id, Template.name, Template.category, Template.usage_count
        ).filter(Template.is_active == True).all()
        
        return {
            "template_usage": [
                {
                    "template_id": stat.id,
                    "template_name": stat.name,
                    "category": stat.category,
                    "usage_count": stat.usage_count or 0,
                    "total_requests": stat.total_requests or 0
                }
                for stat in usage_stats
            ]
        }
        
    except Exception as e:
        logger.error(f"Template usage stats error: {e}")
        raise HTTPException(500, "Failed to retrieve template usage statistics")

# REQUEST MANAGEMENT
@router.get("/requests", response_model=RequestListResponse)
async def list_requests(
    request: Request,
    status: Optional[str] = Query(None, pattern=r'^(pending|in_progress|completed|rejected)$'),
    limit: int = Query(50, le=100, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=30, window_minutes=1)
    """List letter requests with filtering"""
    try:
        query = db.query(LetterRequest)\
            .options(joinedload(LetterRequest.student), joinedload(LetterRequest.template))
        
        if status:
            query = query.filter(LetterRequest.status == status)
        
        total_count = query.count()
        requests = query.order_by(desc(LetterRequest.created_at))\
            .offset(offset).limit(limit).all()
        
        return RequestListResponse(
            success=True,
            message=f"Retrieved {len(requests)} requests",
            requests=[
                {
                    "id": req.id,
                    "tracking_id": req.tracking_id,
                    "student": {
                        "nama": req.student.nama,
                        "nim": req.student.nim,
                        "email": req.student.email,
                        "program_studi": req.student.program_studi
                    },
                    "template": {
                        "id": req.template.id,
                        "name": req.template.name
                    },
                    "keperluan": req.keperluan,
                    "status": req.status,
                    "created_at": req.created_at.isoformat(),
                    "admin_notes": req.admin_notes
                }
                for req in requests
            ],
            total_count=total_count,
            has_more=offset + limit < total_count
        )
        
    except Exception as e:
        logger.error(f"List requests error: {e}")
        raise HTTPException(500, "Failed to retrieve requests")

import json

@router.get("/requests/{request_id}", response_model=RequestDetailResponse)
async def get_request_details(
    request_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=60, window_minutes=1) 
    """Get detailed request information"""
    try:
        letter_request = db.query(LetterRequest)\
            .options(joinedload(LetterRequest.student), joinedload(LetterRequest.template))\
            .filter(LetterRequest.id == request_id).first()
        
        if not letter_request:
            raise HTTPException(404, "Request not found")
        
        # --- DESERIALIZE JSON FIELDS ---
        template = letter_request.template
        if isinstance(template.schema, str):
            template.schema = json.loads(template.schema)
        if isinstance(template.field_assignments, str):
            template.field_assignments = json.loads(template.field_assignments)
        # --------------------------------

        # Get admin form schema
        logger.info(f"Template.id={template.id} schema type={type(template.schema)} field_assignments type={type(template.field_assignments)}")
        logger.info(f"Template.schema: {template.schema}")
        logger.info(f"Template.field_assignments: {template.field_assignments}")
        # Normalize schema fields
        for section in template.schema.get("sections", []):
            section["fields"] = [
                f if isinstance(f, dict) else {"name": f, "required": False}
                for f in section.get("fields", [])
            ]

        admin_schema = field_service.get_admin_form_schema(template)
        
        return RequestDetailResponse(
            request={
                "id": letter_request.id,
                "tracking_id": letter_request.tracking_id,
                "student": {
                    "nama": letter_request.student.nama,
                    "nim": letter_request.student.nim,
                    "email": letter_request.student.email,
                    "program_studi": letter_request.student.program_studi
                },
                "template": {
                    "id": template.id,
                    "name": template.name
                },
                "keperluan": letter_request.keperluan,
                "status": letter_request.status,
                "student_data": letter_request.student_data,
                "admin_data": letter_request.admin_data,
                "admin_notes": letter_request.admin_notes,
                "created_at": letter_request.created_at.isoformat()
            },
            admin_form_schema=admin_schema
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get request details error: {e}")
        raise HTTPException(500, "Failed to retrieve request details")

@router.put("/requests/{request_id}/process", response_model=BaseResponse)
async def process_request(
    request_id: str,
    admin_data: AdminFormData,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=20, window_minutes=1) 
    """Process a request by filling admin fields"""
    try:
        letter_request = db.query(LetterRequest).filter(LetterRequest.id == request_id).first()
        
        if not letter_request:
            raise HTTPException(404, "Request not found")
        
        if letter_request.status != "pending":
            raise HTTPException(400, "Request is not in pending status")
        
        # Validate admin form data
        validation = field_service.validate_required_fields(
            letter_request.template, admin_data.form_data, "admin"
        )
        
        if not validation["valid"]:
            raise HTTPException(400, {
                "message": "Missing required admin fields",
                "missing_fields": validation["missing_fields"]
            })
        
        # Update request
        letter_request.admin_data = admin_data.form_data
        letter_request.admin_notes = admin_data.admin_notes
        letter_request.status = "in_progress"
        letter_request.processed_at = datetime.utcnow()
        letter_request.processed_by = current_user.id
        
        db.commit()
        
        logger.info(f"Request {request_id} processed by admin {current_user.username}")
        
        return BaseResponse(
            success=True,
            message="Request processed successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Process request error: {e}")
        raise HTTPException(500, f"Processing failed: {str(e)}")

@router.post("/requests/{request_id}/generate", response_model=DocumentGenerationResponse)
async def generate_document(
    request_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=10, window_minutes=1)
    """Generate final document"""
    try:
        letter_request = db.query(LetterRequest)\
            .options(joinedload(LetterRequest.student), joinedload(LetterRequest.template))\
            .filter(LetterRequest.id == request_id).first()
        
        if not letter_request:
            raise HTTPException(404, "Request not found")
        
        if letter_request.status != "in_progress":
            raise HTTPException(400, "Request must be processed first")
        
        # Merge all field data
        merged_data = field_service.merge_all_field_data(
            letter_request.template,
            letter_request.student_data or {},
            letter_request.admin_data or {},
            {"request_id": letter_request.id, "tracking_id": letter_request.tracking_id}
        )
        
        # Generate documents
        results = document_generator.generate_both_formats(
            letter_request.template.file_path,
            merged_data
        )
        
        generated_docs = []
        
        # Process each format
        for format_type, result in results.items():
            if result["success"]:
                # Create document record
                doc = GeneratedDocument(
                    request_id=letter_request.id,
                    filename=f"{letter_request.student.nama}_{letter_request.template.name}_{format_type}",
                    file_path=result["file_path"],
                    document_type=format_type,
                    file_size=result["metadata"]["file_size"],
                    mime_type=result["metadata"]["mime_type"]
                )
                
                # Upload to Google Drive if configured
                if drive_uploader:
                    try:
                        drive_result = drive_uploader.upload_document(
                            result["file_path"],
                            letter_request.student.nama,
                            letter_request.template.name,
                            result["metadata"]["mime_type"]
                        )
                        
                        if drive_result:
                            doc.drive_file_id = drive_result["file_id"]
                            doc.drive_file_url = drive_result["view_link"]
                            doc.uploaded_to_drive = True
                    except Exception as upload_error:
                        logger.error(f"Drive upload failed: {upload_error}")
                        doc.upload_error = str(upload_error)
                
                db.add(doc)
                generated_docs.append({
                    "format": format_type,
                    "success": True,
                    "drive_uploaded": doc.uploaded_to_drive
                })
        
        # Update request status
        letter_request.status = "completed"
        letter_request.completed_at = datetime.utcnow()
        
        db.commit()
        
        # Send completion notification directly
        completion_status = None
        if email_service.is_available():
            completion_status = await send_completion_email(
                letter_request.student.email,
                letter_request.student.nama,
                letter_request.template.name,
                letter_request.tracking_id
            )
        
        logger.info(f"Documents generated for request {request_id} by admin {current_user.username}")
        
        upload_note = " (saved locally only)" if not drive_uploader else " (uploaded to Google Drive if successful)"

        return DocumentGenerationResponse(
            success=True,
            message=f"Documents generated successfully{upload_note}",
            generated_documents=generated_docs,
            completion_email_sent=completion_status
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Document generation error: {e}")
        raise HTTPException(500, f"Document generation failed: {str(e)}")

@router.post("/requests/{request_id}/reject", response_model=BaseResponse)
async def reject_request(
    request_id: str,
    rejection_reason: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=20, window_minutes=1)
    """Reject a request"""
    try:
        letter_request = db.query(LetterRequest)\
            .options(joinedload(LetterRequest.student))\
            .filter(LetterRequest.id == request_id).first()
        
        if not letter_request:
            raise HTTPException(404, "Request not found")
        
        if letter_request.status in ["completed", "rejected"]:
            raise HTTPException(400, f"Request already {letter_request.status}")
        
        letter_request.status = "rejected"
        letter_request.admin_notes = rejection_reason
        letter_request.processed_at = datetime.utcnow()
        letter_request.processed_by = current_user.id
        
        db.commit()
        
        logger.info(f"Request {request_id} rejected by admin {current_user.username}")
        
        return BaseResponse(
            success=True,
            message="Request rejected successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Reject request error: {e}")
        raise HTTPException(500, "Failed to reject request")

@router.get("/export/requests")
async def export_requests(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None, pattern=r'^(pending|in_progress|completed|rejected)$'),
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=5, window_minutes=1)
    """Export requests to Excel"""
    try:
        start_dt = datetime.fromisoformat(start_date) if start_date else None
        end_dt = datetime.fromisoformat(end_date) if end_date else None
        
        file_path = excel_exporter.export_requests(db, start_dt, end_dt, status)
        
        logger.info(f"Excel export generated by admin {current_user.username}")
        
        return FileResponse(
            file_path,
            filename=os.path.basename(file_path),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except ValueError as e:
        raise HTTPException(400, f"Invalid date format: {str(e)}")
    except Exception as e:
        logger.error(f"Export error: {e}")
        raise HTTPException(500, f"Export failed: {str(e)}")

@router.post("/export/requests/detailed")
async def export_detailed_requests(
    request: Request,
    request_ids: List[int],  # admin provides IDs in body
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=5, window_minutes=1)
    """Export detailed requests to Excel"""
    try:
        if not request_ids:
            raise HTTPException(400, "No request IDs provided")
        
        file_path = excel_exporter.export_detailed_requests(db, request_ids)
        
        logger.info(f"Detailed Excel export by admin {current_user.username} for IDs {request_ids}")
        
        return FileResponse(
            file_path,
            filename=os.path.basename(file_path),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        logger.error(f"Detailed export error: {e}")
        raise HTTPException(500, f"Detailed export failed: {str(e)}")


# Background task functions
async def send_completion_email(student_email: str, student_name: str, 
    template_name: str, tracking_id: str) -> bool:
    """Background task to send completion notification"""
    try:
        success = email_service.send_completion_notification(
            student_email,
            student_name,
            template_name,
            tracking_id
        )
        if success:
            logger.info(f"Completion email sent to {student_email}")
        else:
            logger.warning(f"Failed to send completion email to {student_email}")
        return success
    except Exception as e:
        logger.error(f"Failed to send completion email: {e}")
        return False


@router.delete("/requests/{request_id}")
async def delete_request(
    request_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    check_rate_limit(request, limit=10, window_minutes=1)
    """Delete a request (admin only, use with caution)"""
    try:
        letter_request = db.query(LetterRequest).filter(LetterRequest.id == request_id).first()
        
        if not letter_request:
            raise HTTPException(404, "Request not found")
        
        # Delete associated documents
        documents = db.query(GeneratedDocument).filter(GeneratedDocument.request_id == request_id).all()
        for doc in documents:
            # Clean up files
            if doc.file_path and os.path.exists(doc.file_path):
                try:
                    os.remove(doc.file_path)
                except Exception as e:
                    logger.warning(f"Failed to delete file {doc.file_path}: {e}")
            db.delete(doc)
        
        db.delete(letter_request)
        db.commit()
        
        logger.warning(f"Request {request_id} deleted by admin {current_user.username}")
        
        return BaseResponse(
            success=True,
            message="Request deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Delete request error: {e}")
        raise HTTPException(500, "Failed to delete request")
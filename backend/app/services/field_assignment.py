# backend/app/services/field_assignment.py
from typing import Dict, List, Any, Optional
from ..models.template import Template
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

class FieldAssignmentService:
    def __init__(self):
        # Default assignments based on field patterns
        self.default_student_patterns = [
            "nama", "name", "nim", "nip", "email", "program", "prodi", 
            "fakultas", "jurusan", "semester", "tahun_masuk", "alamat",
            "telepon", "hp", "nomor_hp", "kegiatan", "judul", "penelitian",
            "lokasi_penelitian", "waktu_penelitian", "durasi", "keperluan"
        ]
        
        self.default_admin_patterns = [
            "nomor", "number", "tanggal", "date", "perihal", "hal",
            "penandatangan", "signer", "jabatan", "position", "direktur",
            "kepala", "tembusan", "cc", "approval", "validasi", "stamp"
        ]
        
        self.auto_generate_patterns = [
            "tanggal_surat", "created_date", "current_date"
        ]
    
    def assign_fields_automatically(self, template: Template) -> Dict[str, List[str]]:
        """Automatically assign fields to student, admin, or auto-generate based on patterns"""
        if not template.placeholders:
            return {"student_fields": [], "admin_fields": [], "auto_fields": []}
        
        assignments = {
            "student_fields": [],
            "admin_fields": [],
            "auto_fields": []
        }
        
        for field in template.placeholders:
            field_lower = field.lower()
            
            # Check auto-generate patterns first
            if any(pattern in field_lower for pattern in self.auto_generate_patterns):
                assignments["auto_fields"].append(field)
            # Check student patterns
            elif any(pattern in field_lower for pattern in self.default_student_patterns):
                assignments["student_fields"].append(field)
            # Check admin patterns
            elif any(pattern in field_lower for pattern in self.default_admin_patterns):
                assignments["admin_fields"].append(field)
            # Default to admin for unknown fields
            else:
                assignments["admin_fields"].append(field)
        
        return assignments
    
    def update_field_assignments(self, db: Session, template_id: str, 
        assignments: Dict[str, List[str]]) -> bool:
        """Update field assignments for a template"""
        try:
            template = db.query(Template).filter(Template.id == template_id).first()
            if not template:
                logger.warning(f"Template not found: {template_id}")
                return False
            
            # Validate that all placeholders are assigned
            all_assigned = set()
            for field_list in assignments.values():
                all_assigned.update(field_list)
            
            template_fields = set(template.placeholders or [])
            if all_assigned != template_fields:
                missing = template_fields - all_assigned
                extra = all_assigned - template_fields
                raise ValueError(f"Field assignment mismatch. Missing: {missing}, Extra: {extra}")
            
            # Update template
            template.field_assignments = assignments
            db.commit()
            logger.info(f"Field assignments updated for template {template_id}")
            
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Field assignment update failed for template {template_id}: {e}")
            return False
    
    import json

    def get_student_form_schema(self, template: Template) -> Dict[str, Any]:
        """Generate form schema for student-fillable fields"""

        # --- Ensure JSON fields are parsed ---
        field_assignments = template.field_assignments
        if isinstance(field_assignments, str):
            try:
                field_assignments = json.loads(field_assignments)
            except Exception as e:
                logger.error(f"Failed to parse field_assignments for template {template.id}: {e}")
                field_assignments = {}

        schema = template.schema
        if isinstance(schema, str):
            try:
                schema = json.loads(schema)
            except Exception as e:
                logger.error(f"Failed to parse schema for template {template.id}: {e}")
                schema = {"sections": []}

        if not field_assignments or not schema:
            logger.warning(f"No field assignments or schema found for template {template.id}")
            return {"sections": []}

        student_fields = set(field_assignments.get("student_fields", []))

        # Debug logs
        logger.info(f"Schema for template {template.id}: {schema}")
        logger.info(f"Field assignments for template {template.id}: {field_assignments}")

        # --- Filter schema to only include student fields ---
        filtered_schema = {"sections": []}

        for section in schema.get("sections", []):
            logger.info(f"Processing section: {section} (type={type(section)})")
            student_section_fields = []

            for field in section.get("fields", []):
                logger.info(f"  Processing field: {field} (type={type(field)})")

                # If schema stores fields as strings
                if isinstance(field, str):
                    if field in student_fields:
                        student_section_fields.append({"name": field, "label": field.capitalize(), "type": "text", "required": True})
                # If schema stores fields as dicts
                elif isinstance(field, dict):
                    if field.get("name") in student_fields:
                        student_section_fields.append(field)

            if student_section_fields:
                filtered_schema["sections"].append({
                    "name": section.get("name"),
                    "title": section.get("title"),
                    "fields": student_section_fields
                })

        return filtered_schema
    
    def get_admin_form_schema(self, template: Template) -> Dict[str, Any]:
        """Generate form schema for admin-fillable fields"""
        if not template.field_assignments or not template.schema:
            return {"sections": []}
        
        admin_fields = set(template.field_assignments.get("admin_fields", []))
        
        # Filter schema to only include admin fields
        filtered_schema = {"sections": []}
        
        for section in template.schema.get("sections", []):
            admin_section_fields = []
            
            for field in section.get("fields", []):
                if field["name"] in admin_fields:
                    admin_section_fields.append(field)
            
            if admin_section_fields:
                filtered_schema["sections"].append({
                    "name": section["name"],
                    "title": section["title"],
                    "fields": admin_section_fields
                })
        
        return filtered_schema
    
    def generate_auto_fields(self, template: Template, request_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate values for auto-generate fields"""
        if not template.field_assignments:
            return {}
        
        auto_fields = template.field_assignments.get("auto_fields", [])
        auto_values = {}
        
        from datetime import datetime
        import random
        
        current_date = datetime.now()
        
        for field in auto_fields:
            field_lower = field.lower()
            
            if "nomor" in field_lower or "number" in field_lower:
                # Generate document number (you can customize this format)
                year = current_date.year
                month = current_date.month
                random_num = random.randint(1000, 9999)
                auto_values[field] = f"{random_num}/{month:02d}/{year}"
            
            elif "tanggal" in field_lower or "date" in field_lower:
                # Use current date in Indonesian format
                months = [
                    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
                ]
                auto_values[field] = f"{current_date.day} {months[current_date.month-1]} {current_date.year}"
            
            else:
                # Default placeholder
                auto_values[field] = f"[Auto: {field}]"
        
        return auto_values
    
    def merge_all_field_data(self, template: Template, student_data: Dict[str, Any],
        admin_data: Dict[str, Any], request_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Merge student data, admin data, and auto-generated data"""
        merged_data = {}
        
        # Add student data
        if student_data:
            merged_data.update(student_data)
        
        # Add admin data
        if admin_data:
            merged_data.update(admin_data)
        
        # Add auto-generated data
        auto_data = self.generate_auto_fields(template, request_data)
        merged_data.update(auto_data)
        
        return merged_data
    
    def validate_required_fields(self, template: Template, data: Dict[str, Any], 
        field_type: str = "all") -> Dict[str, Any]:
        """Validate that all required fields are present"""
        if not template.field_assignments or not template.schema:
            return {"valid": True, "missing_fields": []}
        
        # Get required fields based on type
        if field_type == "student":
            target_fields = set(template.field_assignments.get("student_fields", []))
        elif field_type == "admin":
            target_fields = set(template.field_assignments.get("admin_fields", []))
        else:
            target_fields = set(template.placeholders or [])
        
        # Find required fields from schema
        required_fields = set()
        for section in template.schema.get("sections", []):
            for field in section.get("fields", []):
                # field is a string like "alamat", not a dict
                if field in target_fields:
                    required_fields.add(field)

        # Check missing fields
        provided_fields = set(data.keys())
        missing_fields = required_fields - provided_fields
        
        return {
            "valid": len(missing_fields) == 0,
            "missing_fields": list(missing_fields),
            "provided_fields": list(provided_fields),
            "required_fields": list(required_fields)
        }
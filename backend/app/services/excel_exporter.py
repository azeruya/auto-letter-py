import os
from datetime import datetime, timedelta
from typing import List, Optional
import pandas as pd
from sqlalchemy.orm import Session, joinedload
from openpyxl import load_workbook
import logging
from sqlalchemy import and_

from ..models.request import LetterRequest
from ..models.student import Student
from ..models.template import Template

logger = logging.getLogger(__name__)

EXPORT_DIR = "exports"

class ExcelExporter:
    def __init__(self):
        os.makedirs(EXPORT_DIR, exist_ok=True)

    def _get_export_filename(self, prefix: str = "export") -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return os.path.join(EXPORT_DIR, f"{prefix}_{timestamp}.xlsx")

    def _auto_adjust_column_width(self, filepath: str):
        """Auto-adjust Excel column widths for readability"""
        wb = load_workbook(filepath)
        ws = wb.active
        for col in ws.columns:
            max_length = 0
            col_letter = col[0].column_letter
            for cell in col:
                try:
                    if cell.value:
                        max_length = max(max_length, len(str(cell.value)))
                except Exception:
                    pass
            ws.column_dimensions[col_letter].width = max_length + 2
        wb.save(filepath)

    def _cleanup_old_exports(self, days: int = 7):
        """Delete export files older than N days (default: 7)"""
        cutoff = datetime.now() - timedelta(days=days)
        for fname in os.listdir(EXPORT_DIR):
            fpath = os.path.join(EXPORT_DIR, fname)
            if os.path.isfile(fpath):
                mtime = datetime.fromtimestamp(os.path.getmtime(fpath))
                if mtime < cutoff:
                    try:
                        os.remove(fpath)
                        logger.info(f"Deleted old export file: {fname}")
                    except Exception as e:
                        logger.error(f"Failed to delete {fname}: {e}")

    def export_requests(
        self,
        db: Session,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[str] = None
    ) -> str:
        """Export filtered letter requests to Excel"""
        query = db.query(LetterRequest).join(Student).join(Template)

        filters = []
        if start_date:
            filters.append(LetterRequest.created_at >= start_date)
        if end_date:
            filters.append(LetterRequest.created_at <= end_date)
        if status:
            filters.append(LetterRequest.status == status)

        if filters:
            query = query.filter(and_(*filters))

        requests = query.options(
            joinedload(LetterRequest.student),
            joinedload(LetterRequest.template)
        ).all()

        data = []
        for req in requests:
            student = req.student
            template = req.template
            data.append({
                "ID Permintaan": req.id,
                "Tracking ID": req.tracking_id,
                "Tanggal Dibuat": req.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "Tanggal Update": req.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
                "Status": req.status,
                "Nama Mahasiswa": student.nama,
                "NIM": student.nim,
                "Email": student.email,
                "Program Studi": student.program_studi,
                "Template": template.name,
                "Kategori Template": template.category,
                "Keperluan": req.purpose,
                "Catatan Admin": req.admin_notes or ""
            })

        if not data:
            df = pd.DataFrame(columns=[
                'ID Permintaan', 'Tracking ID', 'Tanggal Dibuat', 'Tanggal Update',
                'Status', 'Nama Mahasiswa', 'NIM', 'Email', 'Program Studi',
                'Template', 'Kategori Template', 'Keperluan', 'Catatan Admin'
            ])
        else:
            df = pd.DataFrame(data)

        filepath = self._get_export_filename("requests")
        df.to_excel(filepath, index=False, engine="openpyxl")
        self._auto_adjust_column_width(filepath)
        self._cleanup_old_exports()

        logger.info(f"Requests exported to {filepath}")
        return filepath

    def export_detailed_requests(self, db: Session, request_ids: List[str]) -> str:
        """Export detailed requests with form data"""
        requests = db.query(LetterRequest).options(
            joinedload(LetterRequest.student),
            joinedload(LetterRequest.template)
        ).filter(LetterRequest.id.in_(request_ids)).all()

        data = []
        for req in requests:
            student = req.student
            template = req.template

            base_info = {
                "ID Permintaan": req.id,
                "Tracking ID": req.tracking_id,
                "Tanggal Dibuat": req.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "Tanggal Update": req.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
                "Status": req.status,
                "Nama Mahasiswa": student.nama,
                "NIM": student.nim,
                "Email": student.email,
                "Program Studi": student.program_studi,
                "Template": template.name,
                "Kategori Template": template.category,
                "Keperluan": req.purpose,
                "Catatan Admin": req.admin_notes or ""
            }

            student_data = req.student_form_data or {}
            for k, v in student_data.items():
                base_info[f"Data Mahasiswa - {k}"] = v

            admin_data = req.admin_form_data or {}
            for k, v in admin_data.items():
                base_info[f"Data Admin - {k}"] = v

            data.append(base_info)

        if not data:
            df = pd.DataFrame()
        else:
            df = pd.DataFrame(data)

        filepath = self._get_export_filename("detailed_requests")
        df.to_excel(filepath, index=False, engine="openpyxl")
        self._auto_adjust_column_width(filepath)
        self._cleanup_old_exports()

        logger.info(f"Detailed requests exported to {filepath}")
        return filepath

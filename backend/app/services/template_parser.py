# backend/app/services/template_parser.py
from docx import Document
import re
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class TemplateParser:
    def __init__(self):
        self.placeholder_pattern = r'\{\{(\w+)\}\}'
        
        # Indonesian-specific field patterns for better categorization
        self.field_groups = {
            "header": ["nomor", "number", "tanggal", "date", "lampiran", "attachment", "hal", "subject", "perihal"],
            "recipient": ["kepada", "recipient", "yth", "alamat", "address", "kota", "location", "tempat"],
            "personal": ["nama", "name", "nim", "id", "program", "student", "mahasiswa", "prodi"],
            "content": ["judul", "title", "kegiatan", "activity", "penelitian", "research", "lama", "duration", "waktu", "period", "lokasi", "isi"],
            "signature": ["penandatangan", "signer", "nip", "jabatan", "position", "direktur", "kepala"],
            "other": []
        }
    
    def parse_template(self, file_path: str) -> Dict[str, Any]:
        """Parse a DOCX template and extract field information"""
        try:
            doc = Document(file_path)
            placeholders = self._extract_placeholders(doc)
            schema = self._generate_schema(placeholders)

            logger.info(f"Template parsed successfully: {file_path} ({len(placeholders)} placeholders found)")
            
            return {
                "success": True,
                "placeholders": placeholders,
                "schema": schema,
                "field_count": len(placeholders)
            }
        except Exception as e:
            logger.error(f"Failed to parse template {file_path}: {e}")
            return {
                "success": False,
                "error": str(e),
                "placeholders": [],
                "schema": {"sections": []},
                "field_count": 0
            }
    
    def _extract_placeholders(self, doc: Document) -> List[str]:
        """Extract all placeholder fields from the document"""
        placeholders = set()
        try:
            # Extract from paragraphs
            for paragraph in doc.paragraphs:
                matches = re.findall(self.placeholder_pattern, paragraph.text)
                placeholders.update(matches)
            
            # Extract from tables
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        for paragraph in cell.paragraphs:
                            matches = re.findall(self.placeholder_pattern, paragraph.text)
                            placeholders.update(matches)
            
            # Extract from headers and footers
            for section in doc.sections:
                for paragraph in section.header.paragraphs:
                    matches = re.findall(self.placeholder_pattern, paragraph.text)
                    placeholders.update(matches)
                for paragraph in section.footer.paragraphs:
                    matches = re.findall(self.placeholder_pattern, paragraph.text)
                    placeholders.update(matches)
        except Exception as e:
            logger.warning(f"Error extracting placeholders: {e}")
        
        return sorted(list(placeholders))
    
    def _humanize_field(self, field_name: str) -> str:
        """Convert field name to human-readable format"""
        # Handle common Indonesian abbreviations
        replacements = {
            'nim': 'NIM',
            'nip': 'NIP',
            'nama': 'Nama',
            'tanggal': 'Tanggal',
            'nomor': 'Nomor',
            'hal': 'Hal',
            'prodi': 'Program Studi'
        }
        
        # Check if it's a known Indonesian term
        lower_name = field_name.lower()
        if lower_name in replacements:
            return replacements[lower_name]
        
        # Convert snake_case to Title Case
        return field_name.replace('_', ' ').title()
    
    def _infer_field_type(self, field_name: str) -> str:
        """Infer the appropriate input type for a field"""
        lower_name = field_name.lower()
        
        if any(word in lower_name for word in ['tanggal', 'date']):
            return 'date'
        elif any(word in lower_name for word in ['email', 'surel']):
            return 'email'
        elif any(word in lower_name for word in ['nomor', 'number', 'nim', 'nip']):
            return 'text'
        elif any(word in lower_name for word in ['judul', 'title', 'kegiatan', 'activity', 'deskripsi', 'description']):
            return 'textarea'
        elif any(word in lower_name for word in ['telepon', 'phone', 'hp']):
            return 'tel'
        else:
            return 'text'
    
    def _translate_section_name(self, section_name: str) -> str:
        """Translate section names to Indonesian"""
        translations = {
            "header": "Kop Surat",
            "recipient": "Penerima",
            "personal": "Data Pribadi",
            "content": "Isi Surat",
            "signature": "Penandatangan",
            "other": "Lainnya"
        }
        return translations.get(section_name, section_name.title())
    
    def _generate_schema(self, placeholders: list) -> dict:
        """
        Generate a simple schema for the template based on placeholders.
        """
        schema = {"sections": []}

        # Example: group fields by your predefined field_groups
        sections = {}
        for field in placeholders:
            added = False
            for section_name, keywords in self.field_groups.items():
                if any(k in field.lower() for k in keywords):
                    sections.setdefault(section_name, []).append(field)
                    added = True
                    break
            if not added:
                sections.setdefault("other", []).append(field)
        
        # Convert sections dict to list format
        for section_name, fields in sections.items():
            schema["sections"].append({
                "name": self._translate_section_name(section_name),
                "fields": fields
            })

        return schema
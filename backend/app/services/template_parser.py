# backend/app/services/template_parser.py
from docx import Document
import re
import json
from typing import List, Dict, Any

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
            
            return {
                "success": True,
                "placeholders": placeholders,
                "schema": schema,
                "field_count": len(placeholders)
            }
        except Exception as e:
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
            header = section.header
            footer = section.footer
            
            for paragraph in header.paragraphs:
                matches = re.findall(self.placeholder_pattern, paragraph.text)
                placeholders.update(matches)
                
            for paragraph in footer.paragraphs:
                matches = re.findall(self.placeholder_pattern, paragraph.text)
                placeholders.update(matches)
        
        return sorted(list(placeholders))
    
    def _generate_schema(self, placeholders: List[str]) -> Dict[str, Any]:
        """Generate form schema from placeholders"""
        schema = {"sections": []}
        used_fields = set()
        
        # Group fields into sections
        for section_name, keywords in self.field_groups.items():
            if section_name == "other":
                continue
                
            section_fields = []
            for placeholder in placeholders:
                if placeholder in used_fields:
                    continue
                    
                # Check if this field belongs to this section
                if any(keyword in placeholder.lower() for keyword in keywords):
                    field_config = {
                        "name": placeholder,
                        "label": self._humanize_field(placeholder),
                        "type": self._infer_field_type(placeholder),
                        "required": True,
                        "placeholder": f"Masukkan {self._humanize_field(placeholder).lower()}..."
                    }
                    section_fields.append(field_config)
                    used_fields.add(placeholder)
            
            if section_fields:
                schema["sections"].append({
                    "name": section_name,
                    "title": self._translate_section_name(section_name),
                    "fields": section_fields
                })
        
        # Add remaining fields to "other" section
        other_fields = []
        for placeholder in placeholders:
            if placeholder not in used_fields:
                field_config = {
                    "name": placeholder,
                    "label": self._humanize_field(placeholder),
                    "type": self._infer_field_type(placeholder),
                    "required": True,
                    "placeholder": f"Masukkan {self._humanize_field(placeholder).lower()}..."
                }
                other_fields.append(field_config)
        
        if other_fields:
            schema["sections"].append({
                "name": "other",
                "title": "Lainnya",
                "fields": other_fields
            })
        
        return schema
    
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
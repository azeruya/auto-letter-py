# backend/app/services/document_generator.py
from docx import Document
from jinja2 import Template
import tempfile
import os
import re
from typing import Dict, Any

class DocumentGenerator:
    def __init__(self):
        self.placeholder_pattern = r'\{\{(\w+)\}\}'
    
    def generate_document(self, template_path: str, user_data: Dict[str, Any]) -> str:
        """Generate a document from template and user data"""
        try:
            # Load the template document
            doc = Document(template_path)
            
            # Process all content
            self._process_paragraphs(doc.paragraphs, user_data)
            self._process_tables(doc.tables, user_data)
            self._process_headers_footers(doc.sections, user_data)
            
            # Save to temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.docx')
            doc.save(temp_file.name)
            temp_file.close()
            
            return temp_file.name
            
        except Exception as e:
            raise Exception(f"Document generation failed: {str(e)}")
    
    def _process_paragraphs(self, paragraphs, user_data: Dict[str, Any]):
        """Process paragraphs and replace placeholders"""
        for paragraph in paragraphs:
            if self._contains_placeholders(paragraph.text):
                # Handle paragraph-level replacement while preserving formatting
                self._replace_paragraph_placeholders(paragraph, user_data)
    
    def _process_tables(self, tables, user_data: Dict[str, Any]):
        """Process tables and replace placeholders"""
        for table in tables:
            for row in table.rows:
                for cell in row.cells:
                    self._process_paragraphs(cell.paragraphs, user_data)
    
    def _process_headers_footers(self, sections, user_data: Dict[str, Any]):
        """Process headers and footers"""
        for section in sections:
            # Process header
            if section.header:
                self._process_paragraphs(section.header.paragraphs, user_data)
            
            # Process footer  
            if section.footer:
                self._process_paragraphs(section.footer.paragraphs, user_data)
    
    def _contains_placeholders(self, text: str) -> bool:
        """Check if text contains placeholders"""
        return bool(re.search(self.placeholder_pattern, text))
    
    def _replace_paragraph_placeholders(self, paragraph, user_data: Dict[str, Any]):
        """Replace placeholders in a paragraph while preserving formatting"""
        full_text = paragraph.text
        
        if not self._contains_placeholders(full_text):
            return
        
        # Find all placeholders and their positions
        placeholders = list(re.finditer(self.placeholder_pattern, full_text))
        
        if not placeholders:
            return
        
        # Process each run in the paragraph
        for run in paragraph.runs:
            if self._contains_placeholders(run.text):
                # Simple replacement for runs containing placeholders
                run.text = self._render_text(run.text, user_data)
    
    def _render_text(self, text: str, user_data: Dict[str, Any]) -> str:
        """Render text with Jinja2 template engine"""
        try:
            template = Template(text)
            return template.render(**user_data)
        except Exception as e:
            # If Jinja2 fails, fall back to simple string replacement
            return self._simple_replace(text, user_data)
    
    def _simple_replace(self, text: str, user_data: Dict[str, Any]) -> str:
        """Simple placeholder replacement as fallback"""
        def replace_match(match):
            key = match.group(1)
            return str(user_data.get(key, f"{{{{ {key} }}}}"))  # Keep placeholder if key not found
        
        return re.sub(self.placeholder_pattern, replace_match, text)
    
    def preview_replacements(self, template_path: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Preview what replacements will be made (for debugging)"""
        try:
            doc = Document(template_path)
            replacements = []
            
            # Check paragraphs
            for i, paragraph in enumerate(doc.paragraphs):
                if self._contains_placeholders(paragraph.text):
                    original = paragraph.text
                    replaced = self._render_text(original, user_data)
                    if original != replaced:
                        replacements.append({
                            "type": "paragraph",
                            "index": i,
                            "original": original,
                            "replaced": replaced
                        })
            
            # Check tables
            for table_idx, table in enumerate(doc.tables):
                for row_idx, row in enumerate(table.rows):
                    for cell_idx, cell in enumerate(row.cells):
                        for para_idx, paragraph in enumerate(cell.paragraphs):
                            if self._contains_placeholders(paragraph.text):
                                original = paragraph.text
                                replaced = self._render_text(original, user_data)
                                if original != replaced:
                                    replacements.append({
                                        "type": "table_cell",
                                        "table": table_idx,
                                        "row": row_idx,
                                        "cell": cell_idx,
                                        "paragraph": para_idx,
                                        "original": original,
                                        "replaced": replaced
                                    })
            
            return {
                "success": True,
                "replacements": replacements,
                "total_replacements": len(replacements)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "replacements": [],
                "total_replacements": 0
            }
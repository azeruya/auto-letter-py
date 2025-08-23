# backend/app/services/document_generator.py
from docx import Document
import tempfile
import os
import re
from typing import Dict, Any, List

class DocumentGenerator:
    def __init__(self):
        self.placeholder_pattern = r'\{\{(\w+)\}\}'
    
    def generate_document(self, template_path: str, user_data: Dict[str, Any]) -> str:
        """Generate a document from template and user data"""
        try:
            # Load the template document
            doc = Document(template_path)
            
            # Process all content with improved placeholder handling
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
        """Process paragraphs and replace placeholders while preserving formatting"""
        for paragraph in paragraphs:
            # Get full paragraph text to check for placeholders
            full_text = paragraph.text
            if not self._contains_placeholders(full_text):
                continue
            
            # Use the new method to handle split placeholders
            self._replace_split_placeholders(paragraph, user_data)
    
    def _replace_split_placeholders(self, paragraph, user_data: Dict[str, Any]):
        """Replace placeholders that might be split across multiple runs"""
        full_text = paragraph.text
        
        # Find all placeholders in the complete text
        placeholders = list(re.finditer(self.placeholder_pattern, full_text))
        if not placeholders:
            return
        
        # Process placeholders from right to left to maintain positions
        for match in reversed(placeholders):
            placeholder_name = match.group(1)
            replacement_value = str(user_data.get(placeholder_name, f"{{{{{placeholder_name}}}}}"))
            start_pos, end_pos = match.span()
            
            # Replace the text across runs
            self._replace_text_across_runs(paragraph, start_pos, end_pos, replacement_value)
    
    def _replace_text_across_runs(self, paragraph, start_pos: int, end_pos: int, replacement_text: str):
        """Replace text that spans across multiple runs"""
        # Build a map of character positions to runs
        runs_info = []
        current_pos = 0
        
        for run_index, run in enumerate(paragraph.runs):
            run_length = len(run.text)
            runs_info.append({
                'run': run,
                'run_index': run_index,
                'start_pos': current_pos,
                'end_pos': current_pos + run_length,
                'original_text': run.text
            })
            current_pos += run_length
        
        # Find which runs are affected by the replacement
        affected_runs = []
        for run_info in runs_info:
            # Check if this run overlaps with the replacement range
            if run_info['start_pos'] < end_pos and run_info['end_pos'] > start_pos:
                affected_runs.append(run_info)
        
        if not affected_runs:
            return
        
        # Calculate what part of each run to keep/replace
        for i, run_info in enumerate(affected_runs):
            run = run_info['run']
            run_start = run_info['start_pos']
            run_end = run_info['end_pos']
            original_text = run_info['original_text']
            
            # Calculate the slice positions within this run
            slice_start = max(0, start_pos - run_start)
            slice_end = min(len(original_text), end_pos - run_start)
            
            if i == 0:
                # First affected run: keep text before placeholder + replacement
                new_text = original_text[:slice_start] + replacement_text + original_text[slice_end:]
                run.text = new_text
            else:
                # Other affected runs: keep text after placeholder (if any)
                if slice_end < len(original_text):
                    run.text = original_text[slice_end:]
                else:
                    run.text = ""
    
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
    
    def preview_replacements(self, template_path: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Preview what replacements will be made (for debugging)"""
        try:
            doc = Document(template_path)
            replacements = []
            
            # Check paragraphs
            for i, paragraph in enumerate(doc.paragraphs):
                original = paragraph.text
                if self._contains_placeholders(original):
                    # Simulate replacement
                    def replace_match(match):
                        key = match.group(1)
                        return str(user_data.get(key, f"{{{{ {key} }}}}"))
                    
                    replaced = re.sub(self.placeholder_pattern, replace_match, original)
                    if original != replaced:
                        replacements.append({
                            "type": "paragraph",
                            "index": i,
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
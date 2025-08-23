# backend/app/services/document_generator.py
from docx import Document
from docx.shared import RGBColor
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
            
            # Find all placeholders in the paragraph
            placeholders = list(re.finditer(self.placeholder_pattern, full_text))
            if not placeholders:
                continue
            
            # Process replacements from right to left to maintain positions
            for match in reversed(placeholders):
                placeholder_name = match.group(1)
                replacement_value = str(user_data.get(placeholder_name, f"{{{{{placeholder_name}}}}}"))
                start_pos, end_pos = match.span()
                
                # Replace the placeholder while preserving formatting
                self._replace_text_in_paragraph(paragraph, start_pos, end_pos, replacement_value)
    
    def _replace_text_in_paragraph(self, paragraph, start_pos: int, end_pos: int, replacement_text: str):
        """Replace text in paragraph while preserving as much formatting as possible"""
        # Build a list of all runs and their cumulative positions
        runs_info = []
        current_pos = 0
        
        for run in paragraph.runs:
            run_start = current_pos
            run_end = current_pos + len(run.text)
            runs_info.append({
                'run': run,
                'start': run_start,
                'end': run_end,
                'text': run.text
            })
            current_pos = run_end
        
        # Find which runs contain the placeholder
        affected_runs = []
        for run_info in runs_info:
            if (run_info['start'] < end_pos and run_info['end'] > start_pos):
                affected_runs.append(run_info)
        
        if not affected_runs:
            return
        
        # Calculate positions within runs
        first_run = affected_runs[0]
        last_run = affected_runs[-1]
        
        # Calculate the cut positions within the first and last runs
        cut_start = start_pos - first_run['start']
        cut_end = end_pos - last_run['start']
        
        # Preserve formatting from the first affected run
        template_run = first_run['run']
        
        if len(affected_runs) == 1:
            # Placeholder is within a single run
            original_text = first_run['text']
            new_text = original_text[:cut_start] + replacement_text + original_text[cut_end:]
            first_run['run'].text = new_text
        else:
            # Placeholder spans multiple runs
            # Clear middle runs
            for i in range(1, len(affected_runs) - 1):
                affected_runs[i]['run'].text = ""
            
            # Update first run
            first_run['run'].text = first_run['text'][:cut_start] + replacement_text
            
            # Update last run
            last_run['run'].text = last_run['text'][cut_end:]
    
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
                # Process header tables if any
                for table in section.header.tables:
                    self._process_tables([table], user_data)
            
            # Process footer  
            if section.footer:
                self._process_paragraphs(section.footer.paragraphs, user_data)
                # Process footer tables if any
                for table in section.footer.tables:
                    self._process_tables([table], user_data)
    
    def _contains_placeholders(self, text: str) -> bool:
        """Check if text contains placeholders"""
        return bool(re.search(self.placeholder_pattern, text))
    
    def get_template_placeholders(self, template_path: str) -> List[str]:
        """Extract all placeholders from template for debugging"""
        try:
            doc = Document(template_path)
            placeholders = set()
            
            # Get from paragraphs
            for paragraph in doc.paragraphs:
                matches = re.findall(self.placeholder_pattern, paragraph.text)
                placeholders.update(matches)
                print(f"Paragraph text: '{paragraph.text}'")  # Debug
                if matches:
                    print(f"Found placeholders: {matches}")  # Debug
            
            # Get from tables
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        for paragraph in cell.paragraphs:
                            matches = re.findall(self.placeholder_pattern, paragraph.text)
                            placeholders.update(matches)
                            if matches:
                                print(f"Table cell text: '{paragraph.text}', placeholders: {matches}")  # Debug
            
            # Get from headers/footers
            for section in doc.sections:
                for paragraph in section.header.paragraphs:
                    matches = re.findall(self.placeholder_pattern, paragraph.text)
                    placeholders.update(matches)
                
                for paragraph in section.footer.paragraphs:
                    matches = re.findall(self.placeholder_pattern, paragraph.text)
                    placeholders.update(matches)
            
            result = sorted(list(placeholders))
            print(f"All found placeholders: {result}")  # Debug
            return result
            
        except Exception as e:
            print(f"Error extracting placeholders: {e}")  # Debug
            return []
    
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
                            original = paragraph.text
                            if self._contains_placeholders(original):
                                def replace_match(match):
                                    key = match.group(1)
                                    return str(user_data.get(key, f"{{{{ {key} }}}}"))
                                
                                replaced = re.sub(self.placeholder_pattern, replace_match, original)
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
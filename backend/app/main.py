# backend/app/main.py
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import os
import shutil
import tempfile
import uuid
from datetime import datetime

# Local imports
from .database import engine, get_db, Base
from .models.template import Template
from .services.template_parser import TemplateParser
from .services.document_generator import DocumentGenerator

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Auto Letter Generator",
    description="Automatic letter generation system with template parsing",
    version="1.0.0"
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories
os.makedirs("templates", exist_ok=True)
os.makedirs("temp", exist_ok=True)

# Initialize services
template_parser = TemplateParser()
document_generator = DocumentGenerator()

# Basic routes
@app.get("/")
def read_root():
    return {"message": "Auto Letter Generator API", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Template routes
@app.post("/api/templates/upload")
async def upload_template(
    file: UploadFile = File(...),
    name: str = Form(None),
    category: str = Form("general"),
    db: Session = Depends(get_db)
):
    """Upload and parse a template file"""
    
    # Validate file type
    if not file.filename.lower().endswith('.docx'):
        raise HTTPException(400, "Only .docx files are supported")
    
    try:
        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1]
        stored_filename = f"{file_id}{file_extension}"
        file_path = f"templates/{stored_filename}"
        
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Parse template
        parse_result = template_parser.parse_template(file_path)
        
        if not parse_result["success"]:
            # Clean up failed file
            os.remove(file_path)
            raise HTTPException(400, f"Template parsing failed: {parse_result['error']}")
        
        # Save template to database
        template_name = name or os.path.splitext(file.filename)[0]
        template = Template(
            name=template_name,
            original_filename=file.filename,
            category=category,
            schema=parse_result["schema"],
            file_path=file_path
        )
        
        db.add(template)
        db.commit()
        db.refresh(template)
        
        return {
            "success": True,
            "template_id": template.id,
            "name": template.name,
            "field_count": parse_result["field_count"],
            "schema": parse_result["schema"],
            "message": f"Template uploaded successfully with {parse_result['field_count']} fields detected"
        }
        
    except Exception as e:
        # Clean up on error
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(500, f"Upload failed: {str(e)}")

@app.get("/api/templates")
def list_templates(db: Session = Depends(get_db)):
    """Get all templates"""
    templates = db.query(Template).all()
    return {
        "templates": [
            {
                "id": t.id,
                "name": t.name,
                "category": t.category,
                "original_filename": t.original_filename,
                "field_count": len(t.schema.get("sections", [])),
                "created_at": t.created_at.isoformat() if t.created_at else None
            }
            for t in templates
        ]
    }

@app.get("/api/templates/{template_id}")
def get_template(template_id: int, db: Session = Depends(get_db)):
    """Get template details and schema"""
    template = db.query(Template).filter(Template.id == template_id).first()
    
    if not template:
        raise HTTPException(404, "Template not found")
    
    return {
        "id": template.id,
        "name": template.name,
        "category": template.category,
        "original_filename": template.original_filename,
        "schema": template.schema,
        "created_at": template.created_at.isoformat() if template.created_at else None
    }

@app.post("/api/documents/generate/{template_id}")
async def generate_document(
    template_id: int,
    form_data: dict,
    db: Session = Depends(get_db)
):
    """Generate document from template and form data"""
    
    # Get template
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(404, "Template not found")
    
    try:
        # Generate document
        output_path = document_generator.generate_document(
            template.file_path, 
            form_data
        )
        
        # Return file for download
        filename = f"generated_{template.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        
        return FileResponse(
            output_path,
            filename=filename,
            media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            background=lambda: os.unlink(output_path) if os.path.exists(output_path) else None
        )
        
    except Exception as e:
        raise HTTPException(500, f"Document generation failed: {str(e)}")

@app.delete("/api/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    """Delete a template"""
    template = db.query(Template).filter(Template.id == template_id).first()
    
    if not template:
        raise HTTPException(404, "Template not found")
    
    # Delete file
    if os.path.exists(template.file_path):
        os.remove(template.file_path)
    
    # Delete from database
    db.delete(template)
    db.commit()
    
    return {"message": "Template deleted successfully"}

# Simple HTML interface for testing
@app.get("/test", response_class=HTMLResponse)
def test_interface():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Auto Letter Generator - Test</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .upload-area { border: 2px dashed #ccc; padding: 20px; margin: 20px 0; text-align: center; }
            button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #0056b3; }
            .result { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 4px; }
        </style>
    </head>
    <body>
        <h1>🚀 Auto Letter Generator - Test Interface</h1>
        <p>Upload a .docx template to test the parsing functionality</p>
        
        <form id="uploadForm" enctype="multipart/form-data">
            <div class="upload-area">
                <input type="file" name="file" accept=".docx" required>
                <br><br>
                <input type="text" name="name" placeholder="Template name (optional)">
                <br><br>
                <button type="submit">Upload & Parse Template</button>
            </div>
        </form>
        
        <div id="result" class="result" style="display: none;"></div>
        
        <script>
            document.getElementById('uploadForm').onsubmit = async function(e) {
                e.preventDefault();
                const formData = new FormData(this);
                const resultDiv = document.getElementById('result');
                
                try {
                    resultDiv.innerHTML = 'Uploading and parsing...';
                    resultDiv.style.display = 'block';
                    
                    const response = await fetch('/api/templates/upload', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        resultDiv.innerHTML = `
                            <h3>✅ Success!</h3>
                            <p><strong>Template ID:</strong> ${result.template_id}</p>
                            <p><strong>Fields detected:</strong> ${result.field_count}</p>
                            <p><strong>Message:</strong> ${result.message}</p>
                            <details>
                                <summary>Schema Details</summary>
                                <pre>${JSON.stringify(result.schema, null, 2)}</pre>
                            </details>
                        `;
                    } else {
                        resultDiv.innerHTML = `<h3>❌ Error:</h3><p>${result.error || 'Unknown error'}</p>`;
                    }
                } catch (error) {
                    resultDiv.innerHTML = `<h3>❌ Error:</h3><p>${error.message}</p>`;
                }
            };
        </script>
    </body>
    </html>
    """

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
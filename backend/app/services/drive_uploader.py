# backend/app/services/drive_uploader.py
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError
import os
from datetime import datetime
from typing import Optional, Dict, Any
import logging

# Configure logging
logger = logging.getLogger(__name__)

class DriveUploader:
    def __init__(self, credentials_path: str, folder_id: str):
        self.service = None
        self.folder_id = folder_id
        
        try:
            if not os.path.exists(credentials_path):
                logger.error(f"Google credentials file not found: {credentials_path}")
                return
                
            self.credentials = Credentials.from_service_account_file(
                credentials_path,
                scopes=['https://www.googleapis.com/auth/drive.file']
            )
            self.service = build('drive', 'v3', credentials=self.credentials)
            logger.info("Google Drive uploader initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Drive uploader: {e}")
            self.service = None
    
    def is_available(self) -> bool:
        """Check if Drive uploader is available"""
        return self.service is not None
    
    def upload_document(self, file_path: str, student_name: str, 
        template_name: str, mime_type: str = None) -> Optional[Dict[str, str]]:
        """Upload generated document to Google Drive"""
        if not self.service:
            logger.error("Drive service not available")
            return None
            
        try:
            # Create filename with timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            file_extension = os.path.splitext(file_path)[1]
            
            # Clean names for filename
            clean_student_name = "".join(c for c in student_name if c.isalnum() or c in (' ', '-', '_')).strip()
            clean_template_name = "".join(c for c in template_name if c.isalnum() or c in (' ', '-', '_')).strip()
            
            filename = f"{clean_student_name}_{clean_template_name}_{timestamp}{file_extension}"
            
            # Auto-detect MIME type if not provided
            if not mime_type:
                if file_extension.lower() == '.pdf':
                    mime_type = 'application/pdf'
                else:
                    mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            
            file_metadata = {
                'name': filename,
                'parents': [self.folder_id]
            }
            
            media = MediaFileUpload(
                file_path, 
                mimetype=mime_type,
                resumable=True
            )
            
            logger.info(f"Uploading {filename} to Google Drive...")
            
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, webViewLink, webContentLink, size'
            ).execute()
            
            logger.info(f"Successfully uploaded {filename}")
            
            return {
                'file_id': file.get('id'),
                'filename': file.get('name'),
                'view_link': file.get('webViewLink'),
                'download_link': file.get('webContentLink'),
                'file_size': file.get('size')
            }
            
        except HttpError as e:
            logger.error(f"Google Drive HTTP error: {e}")
            return None
        except Exception as e:
            logger.error(f"Drive upload error: {e}")
            return None
    
    def create_folder(self, folder_name: str, parent_folder_id: str = None) -> Optional[str]:
        """Create a new folder in Google Drive"""
        if not self.service:
            return None
            
        try:
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            
            if parent_folder_id:
                file_metadata['parents'] = [parent_folder_id]
            elif self.folder_id:
                file_metadata['parents'] = [self.folder_id]
            
            folder = self.service.files().create(
                body=file_metadata, 
                fields='id, name'
            ).execute()
            
            logger.info(f"Created folder: {folder.get('name')} ({folder.get('id')})")
            return folder.get('id')
            
        except HttpError as e:
            logger.error(f"Folder creation error: {e}")
            return None


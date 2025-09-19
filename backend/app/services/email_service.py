# backend/app/services/email_service.py
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import requests
import os
from datetime import datetime  
from ..config import settings

# Configure logging
logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.service_type = "resend" if settings.resend_api_key else None
        self.from_email = settings.from_email
        self.api_key = settings.resend_api_key
        
        if self.service_type:
            logger.info(f"Email service initialized: {self.service_type}")
        else:
            logger.warning("Email service not configured - notifications will be disabled")
    
    def is_available(self) -> bool:
        """Check if email service is available"""
        return self.service_type is not None and self.api_key is not None
    
    def send_student_confirmation(self, student_email: str, student_name: str, 
        tracking_id: str) -> bool:
        """Send confirmation email to student"""
        if not self.is_available():
            logger.info("Email service not available, skipping student confirmation")
            return False
            
        subject = "Konfirmasi Pengajuan Surat - Universitas"
        
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }}
                .tracking-id {{ background-color: #e7f3ff; padding: 10px; border-left: 4px solid #0066cc; margin: 15px 0; }}
                .footer {{ margin-top: 20px; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Pengajuan Surat Berhasil Diterima</h2>
                </div>
                <div class="content">
                    <p>Yth. <strong>{student_name}</strong>,</p>
                    
                    <p>Pengajuan surat Anda telah berhasil diterima dan akan segera diproses oleh tim administrasi.</p>
                    
                    <div class="tracking-id">
                        <strong>ID Tracking Anda:</strong><br>
                        <code style="font-size: 18px; font-weight: bold;">{tracking_id}</code>
                    </div>
                    
                    <p>Simpan ID tracking ini untuk melacak status pengajuan Anda.</p>
                    
                    <p>Anda akan mendapat email pemberitahuan ketika surat sudah siap untuk diambil di kantor administrasi.</p>
                    
                    <p>Terima kasih atas kesabaran Anda.</p>
                </div>
                <div class="footer">
                    <p><small>Email ini dikirim secara otomatis dari sistem pengajuan surat universitas. Mohon tidak membalas email ini.</small></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self._send_email(student_email, subject, html_content)
    
    def send_admin_notification(self, admin_email: str, student_name: str, 
        template_name: str, tracking_id: str, student_nim: str = "") -> bool:
        """Send notification to admin about new request"""
        if not self.is_available():
            logger.info("Email service not available, skipping admin notification")
            return False
            
        subject = f"Pengajuan Surat Baru - {template_name}"
        
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #ff6b35; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }}
                .details {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }}
                .action-button {{ display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 15px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Pengajuan Surat Baru</h2>
                </div>
                <div class="content">
                    <p>Ada pengajuan surat baru yang perlu diproses:</p>
                    
                    <div class="details">
                        <h3>Detail Pengajuan:</h3>
                        <ul>
                            <li><strong>Nama Mahasiswa:</strong> {student_name}</li>
                            {f'<li><strong>NIM:</strong> {student_nim}</li>' if student_nim else ''}
                            <li><strong>Jenis Surat:</strong> {template_name}</li>
                            <li><strong>ID Tracking:</strong> <code>{tracking_id}</code></li>
                            <li><strong>Waktu Pengajuan:</strong> {datetime.now().strftime('%d %B %Y, %H:%M WIB')}</li>
                        </ul>
                    </div>
                    
                    <p>Silakan login ke dashboard admin untuk memproses pengajuan ini.</p>
                    
                    <a href="#" class="action-button">Buka Dashboard Admin</a>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self._send_email(admin_email, subject, html_content)
    
    def send_completion_notification(self, student_email: str, student_name: str, 
        template_name: str = "", tracking_id: str = "") -> bool:
        """Notify student that letter is ready for pickup"""
        if not self.is_available():
            logger.info("Email service not available, skipping completion notification")
            return False
            
        subject = "Surat Siap Diambil - Universitas"
        
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }}
                .pickup-info {{ background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }}
                .requirements {{ background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin: 15px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Surat Siap Diambil!</h2>
                </div>
                <div class="content">
                    <p>Yth. <strong>{student_name}</strong>,</p>
                    
                    <p>Kabar baik! Surat yang Anda ajukan telah selesai diproses dan <strong>siap untuk diambil</strong> di kantor administrasi.</p>
                    
                    {f'<p><strong>Jenis Surat:</strong> {template_name}</p>' if template_name else ''}
                    {f'<p><strong>ID Tracking:</strong> <code>{tracking_id}</code></p>' if tracking_id else ''}
                    
                    <div class="pickup-info">
                        <h3>Informasi Pengambilan:</h3>
                        <ul>
                            <li><strong>Lokasi:</strong> Kantor Administrasi Akademik</li>
                            <li><strong>Jam Operasional:</strong> Senin - Jumat, 08:00 - 16:00 WIB</li>
                            <li><strong>Sabtu:</strong> 08:00 - 12:00 WIB</li>
                        </ul>
                    </div>
                    
                    <div class="requirements">
                        <h3>Yang Perlu Dibawa:</h3>
                        <ul>
                            <li>Kartu identitas mahasiswa (KTM)</li>
                            <li>KTP asli</li>
                            {f'<li>ID Tracking: <code>{tracking_id}</code></li>' if tracking_id else ''}
                        </ul>
                    </div>
                    
                    <p>Terima kasih telah menggunakan layanan administrasi kami.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self._send_email(student_email, subject, html_content)
    
    def _send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email using configured service"""
        try:
            if self.service_type == "resend":
                return self._send_via_resend(to_email, subject, html_content)
            else:
                logger.error(f"Email service {self.service_type} not implemented")
                return False
        except Exception as e:
            logger.error(f"Email sending failed to {to_email}: {e}")
            return False
    
    def _send_via_resend(self, to_email: str, subject: str, html_content: str) -> bool:
        if not self.is_available():
            return False

        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "from": f"{settings.email_from_name} <{settings.email_from_address}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }

        for attempt in range(settings.email_max_retries):
            try:
                response = requests.post(
                    url, json=data, headers=headers, timeout=settings.email_timeout
                )

                if response.status_code in (200, 202):
                    logger.info(f"Email sent successfully to {to_email}")
                    return True

                logger.error(
                    f"Email send failed (attempt {attempt+1}/{settings.email_max_retries}), "
                    f"status={response.status_code}, response={response.text}"
                )

            except requests.RequestException as e:
                logger.error(
                    f"Email request error (attempt {attempt+1}/{settings.email_max_retries}): {e}"
                )

            if attempt < settings.email_max_retries - 1:
                time.sleep(settings.email_retry_delay)

        # ---- fallback after all retries fail ----
        logger.error(
            f"Giving up after {settings.email_max_retries} retries. "
            f"Email to {to_email} with subject '{subject}' could not be sent."
        )
        return False


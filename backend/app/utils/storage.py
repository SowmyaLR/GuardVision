import os
import aiofiles
from pathlib import Path
from uuid import UUID
from fastapi import UploadFile
from app.core.config import settings

async def save_upload_file(job_id: UUID, file: UploadFile, unique_filename: str) -> str:
    # Use config setting or default to a safe local path
    base_upload_path = settings.UPLOAD_DIR
    
    # Handle absolute paths vs relative paths correctly. 
    # If the user provides an absolute Linux path like /data/uploads, 
    # we should handle mapped drives or local dev environment gracefully.
    # For now, we will treat it as relative to CWD if running locally on Windows without that root.
    
    job_dir = Path(base_upload_path) / str(job_id)
    
    # Create directory if it doesn't exist
    job_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = job_dir / unique_filename
    
    async with aiofiles.open(file_path, 'wb') as out_file:
        while content := await file.read(1024 * 1024):  # Read in 1MB chunks
            await out_file.write(content)
            
    return str(file_path)

def cleanup_failed_upload(file_path: str):
    path = Path(file_path)
    if path.exists():
        try:
            path.unlink()
        except Exception as e:
            print(f"Error cleaning up file {file_path}: {e}")

from typing import List
from uuid import UUID, uuid4
from fastapi import UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.job_repository import JobRepository
from app.repositories.file_repository import FileRepository
from app.services.queue_service import QueueService
from app.utils.file_validation import (
    validate_file_extension, 
    validate_file_size, 
    get_file_extension,
    MAX_FILES_PER_JOB,
    MAX_FILE_SIZE_MB,
    ALLOWED_EXTENSIONS
)
from app.utils.storage import save_upload_file, cleanup_failed_upload
from app.db.models import JobStatus, FileStatus, FileType

class UploadService:
    def __init__(self, db: AsyncSession):
        self.job_repo = JobRepository(db)
        self.file_repo = FileRepository(db)
        self.queue_service = QueueService()

    async def process_uploads(self, job_id: UUID, files: List[UploadFile]):
        # 1. Validate Job Exists and Lock
        job = await self.job_repo.get_job_for_update(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
            
        if job.status != JobStatus.CREATED:
             raise HTTPException(status_code=400, detail="Job already queued or processed")

        # 2. Validate Constraints
        if len(files) > MAX_FILES_PER_JOB:
            raise HTTPException(status_code=400, detail=f"Max {MAX_FILES_PER_JOB} files allowed per job")

        if len(files) == 0:
            raise HTTPException(status_code=400, detail="No files provided")

        validated_files_data = []
        uploaded_paths = []

        try:
            # 3. Validate & Save Files
            for file in files:
                # Type validation
                if not validate_file_extension(file.filename):
                    raise HTTPException(
                        status_code=400, 
                        detail={
                            "error": "Invalid file type", 
                            "allowed_types": list(ALLOWED_EXTENSIONS)
                        }
                    )
                
                # Size validation: enforce max size while streaming from the upload.
                # We avoid relying on `UploadFile.size`, which is not reliably set across FastAPI/Starlette versions.
                max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
                total_bytes = 0
                chunk_size = 1024 * 1024  # 1MB
                while True:
                    chunk = await file.read(chunk_size)
                    if not chunk:
                        break
                    total_bytes += len(chunk)
                    if total_bytes > max_bytes:
                        await file.close()
                        raise HTTPException(
                            status_code=400,
                            detail=f"File {file.filename} exceeds {MAX_FILE_SIZE_MB}MB"
                        )
                # Reset the stream position so downstream code can read the full content.
                await file.seek(0)

                # Generate unique filename
                ext = get_file_extension(file.filename)
                unique_name = f"{uuid4()}.{ext}"
                
                # Save to disk
                stored_path = await save_upload_file(job_id, file, unique_name)
                uploaded_paths.append(stored_path)
                
                # Determine FileType enum
                f_type = FileType.DICOM if ext == "dcm" else FileType.IMAGE

                validated_files_data.append({
                    "job_id": job_id,
                    "original_filename": file.filename,
                    "stored_path": stored_path,
                    "file_type": f_type,
                    "status": FileStatus.QUEUED,
                    "retry_count": 0
                })

            # 4. Update Database (Atomic)
            await self.file_repo.add_files(validated_files_data)
            await self.job_repo.update_job_status(job_id, JobStatus.QUEUED, total_files=len(files))
            
            await self.job_repo.session.commit()

            # 5. Push to Queue (only after commit success)
            await self.queue_service.enqueue_job(job_id)
            
            return {
                "job_id": job_id,
                "files_received": len(files),
                "status": "queued"
            }

        except Exception as e:
            await self.job_repo.session.rollback()
            # Cleanup files on failure
            for path in uploaded_paths:
                cleanup_failed_upload(path)
            raise

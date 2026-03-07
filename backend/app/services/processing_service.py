from uuid import UUID
from app.repositories.file_repository import FileRepository
from app.repositories.job_repository import JobRepository
from app.repositories.result_repository import ResultRepository
from app.repositories.audit_repository import AuditRepository
from app.services.metadata_service import MetadataService
from app.processors.image_redactor import image_processor
from app.processors.dicom_processor import dicom_processor
from app.db.models.tables import FileStatus, JobStatus, FileType
from typing import Optional, Dict, Any, List
import logging
import os

logger = logging.getLogger(__name__)

class ProcessingService:
    def __init__(
        self, 
        file_repo: FileRepository, 
        job_repo: JobRepository, 
        result_repo: ResultRepository, 
        audit_repo: AuditRepository,
        metadata_service: MetadataService
    ):
        self.file_repo = file_repo
        self.job_repo = job_repo
        self.result_repo = result_repo
        self.audit_repo = audit_repo
        self.metadata_service = metadata_service

    async def process_file(self, file_id: UUID, job_id: UUID) -> bool:
        # Fetch file info
        file_record = await self.file_repo.get_file(file_id)
        if not file_record:
            logger.error(f"File {file_id} not found")
            return False

        # Update status processing
        await self.file_repo.update_file_status(file_id, FileStatus.PROCESSING, retry_count=file_record.retry_count)

        try:
             # Determine output path
             base, ext = os.path.splitext(file_record.stored_path)
             output_path = f"{base}_redacted{ext}"

             # Process
             entities = []
             duration_ms = 0
             
             if file_record.file_type == FileType.IMAGE:
                 entities, duration_ms = image_processor.process(file_record.stored_path, output_path)
             elif file_record.file_type == FileType.DICOM:
                 entities, duration_ms = dicom_processor.process_dicom(file_record.stored_path, output_path)
             else:
                 # Should not happen if type is enum constrained
                 logger.warning(f"Unknown file type {file_record.file_type}")
                 
             # Save Result
             await self.metadata_service.save_processing_result(job_id, file_id, output_path, entities, duration_ms)

             
             # Update status completed
             await self.file_repo.update_file_status(file_id, FileStatus.COMPLETED)
             
             # Atomic increment job progress
             await self.job_repo.increment_processed(job_id)
             
             # Check Job Completion
             # Ideally we check if processed_files == total_files.
             # The increment_processed handles that logic or returns updated job.
             # If completely done, we can update status to COMPLETED?
             # Or let separate check do it.
             # Given "Mark job completed when all files processed".
             job = await self.job_repo.get_job(job_id)
             if job and job.processed_files >= job.total_files:
                  # Check if any failed?
                  # If any files are FAILED (final state), job might be FAILED or PARTIAL_SUCCESS.
                  # Logic: "After 3 failures -> mark failed". (File failed).
                  # "Continue remaining files".
                  # "Job marked completed when all files processed".
                  # If some failed, job status? usually COMPLETED (with errors) or FAILED.
                  # Let's check if any file is failed.
                  files = await self.file_repo.get_files_by_job(job_id)
                  any_failed = any(f.status == FileStatus.FAILED for f in files)
                  
                  new_status = JobStatus.COMPLETED
                  if any_failed:
                       # If all failed? Or just some.
                       # Simple logic: if any failed, maybe mark failed or completed with error note.
                       # Issue doesn't specify partial success behavior explicitly other than "Failures do not stop job".
                       # Let's stick to COMPLETED but maybe add error message if failures exist?
                       # Or keep passing.
                       pass
                  
                  await self.job_repo.update_job_status(job_id, new_status)

             return True
        except Exception as e:
            logger.error(f"Error processing file {file_id}: {e}")
            # Handle failure
            retry = file_record.retry_count + 1
            status = FileStatus.FAILED if retry >= 3 else FileStatus.QUEUED
            
            error_msg = str(e)
            await self.file_repo.update_file_status(file_id, status, retry_count=retry, error_message=error_msg)
            
            if status == FileStatus.FAILED:
                 # Increment processed count because this file is done (failed).
                 await self.job_repo.increment_processed(job_id)
                 
                 # Check completion
                 job = await self.job_repo.get_job(job_id)
                 if job and job.processed_files >= job.total_files:
                      await self.job_repo.update_job_status(job_id, JobStatus.COMPLETED) # Or FAILED if strictly all must pass.

            raise e 

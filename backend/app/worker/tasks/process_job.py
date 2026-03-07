from celery import shared_task
from app.worker.celery_app import celery_app
from app.db.base import AsyncSessionLocal
from app.repositories.job_repository import JobRepository
from app.repositories.file_repository import FileRepository
from uuid import UUID
import asyncio
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=3)
def process_job_task(self, job_id_str: str):
    job_id = UUID(job_id_str)
    
    async def _process():
        async with AsyncSessionLocal() as session:
             job_repo = JobRepository(session)
             file_repo = FileRepository(session)
             
             # Fetch pending files
             files = await file_repo.get_pending_files_for_job(job_id)
             
             if not files:
                 logger.info(f"No pending files for job {job_id}")
                 return

             # Update job status to processing
             from app.db.models import JobStatus
             await job_repo.update_job_status(job_id, JobStatus.PROCESSING)
             await session.commit()
             
             # Enqueue tasks for each file
             # Import effectively inside task to avoid circular imports at module level if any
             from app.worker.tasks.process_file import process_file_task
             for file in files:
                 process_file_task.delay(str(file.id), str(job_id))
                 logger.info(f"Enqueued file {file.id} for job {job_id}")

    try:
        asyncio.run(_process())
    except Exception as exc:
        logger.error(f"Error processing job {job_id}: {exc}")
        raise self.retry(exc=exc, countdown=10)

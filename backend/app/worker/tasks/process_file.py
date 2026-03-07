import asyncio
from celery.exceptions import Retry
from app.worker.celery_app import celery_app
from app.db.base import AsyncSessionLocal
from app.repositories.file_repository import FileRepository
from app.repositories.job_repository import JobRepository
from app.repositories.result_repository import ResultRepository
from app.repositories.audit_repository import AuditRepository
from app.services.processing_service import ProcessingService
from app.services.metadata_service import MetadataService
from uuid import UUID
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def process_file_task(self, file_id_str: str, job_id_str: str):
    file_id = UUID(file_id_str)
    job_id = UUID(job_id_str)
    
    async def _process():
        async with AsyncSessionLocal() as session:
            file_repo = FileRepository(session)
            job_repo = JobRepository(session)
            result_repo = ResultRepository(session)
            audit_repo = AuditRepository(session)
            metadata_service = MetadataService(result_repo, audit_repo)
            
            service = ProcessingService(
                file_repo, job_repo, result_repo, audit_repo, metadata_service
            )
            
            try:
                await service.process_file(file_id, job_id)
                await session.commit()
            except Exception as e:
                await session.rollback()
                logger.error(f"Error processing file {file_id}: {e}")
                raise e

    try:
        asyncio.run(_process())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime
from app.db.models import Job, JobStatus, AuditLog

class JobRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_job(self) -> Job:
        job = Job(status=JobStatus.CREATED)
        self.session.add(job)
        await self.session.flush()
        
        # Add Audit Log
        audit = AuditLog(
            job_id=job.id,
            event_type="CREATED",
            details={"message": "Job created"}
        )
        self.session.add(audit)
        
        return job

    async def get_job(self, job_id: UUID) -> Job:
        query = select(Job).where(Job.id == job_id)
        result = await self.session.execute(query)
        return result.scalars().first()

    async def get_job_for_update(self, job_id: UUID) -> Job:
        query = select(Job).where(Job.id == job_id).with_for_update()
        result = await self.session.execute(query)
        return result.scalars().first()

    async def update_job_status(self, job_id: UUID, status: JobStatus, total_files: int = 0):
        # We also need to update total_files when moving to QUEUED
        update_values = {"status": status, "updated_at": func.now()}
        if total_files > 0:
            update_values["total_files"] = total_files
            
        stmt = (
            update(Job)
            .where(Job.id == job_id)
            .values(**update_values)
            .execution_options(synchronize_session="fetch")
        )
        await self.session.execute(stmt)

    async def increment_processed(self, job_id: UUID, count: int = 1) -> Job:
        # Atomic update of processed_files + update progress
        # Since calculation of progress depends on existing total_files, 
        # using explicit GET then UPDATE inside transaction is usually safer if we use row locking.
        # But we can try to do in one UPDATE if we rely on stored total_files?
        # Update jobs set processed_files = processed_files + 1, progress = ((processed_files + 1) * 100) / total_files 
        # But total_files can be 0 (rarely, if valid job). Handle divisor 0.

        # Let's lock row first.
        stmt_lock = select(Job).where(Job.id == job_id).with_for_update()
        res = await self.session.execute(stmt_lock)
        job = res.scalars().first()
        
        if job:
            job.processed_files += count
            if job.total_files > 0:
                job.progress = int((job.processed_files / job.total_files) * 100)
            else:
                job.progress = 100 # Or 0?
            
            # Check completion logic if needed here or outside.
            if job.processed_files >= job.total_files:
                # Potential completion? Status update managed by caller or here?
                pass
            
            await self.session.flush()
        return job

    async def get_job_file_counts(self, job_id: UUID):
         # Helper to check if completely done including failures
         pass

        
        # Add Audit Log
        audit = AuditLog(
            job_id=job_id,
            event_type=status.value.upper(),
            details={"total_files": total_files}
        )
        self.session.add(audit)

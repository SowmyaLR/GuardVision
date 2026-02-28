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
        
        # Add Audit Log
        audit = AuditLog(
            job_id=job_id,
            event_type=status.value.upper(),
            details={"total_files": total_files}
        )
        self.session.add(audit)

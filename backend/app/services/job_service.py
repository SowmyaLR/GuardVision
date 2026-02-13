from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.repositories.job_repository import JobRepository
from app.schemas.job import JobResponse
from app.db.models import JobStatus

class JobService:
    def __init__(self, db: AsyncSession):
        self.repository = JobRepository(db)

    async def create_job(self) -> JobResponse:
        job = await self.repository.create_job()
        await self.repository.session.commit()
        return JobResponse.model_validate(job)

    async def get_job_status(self, job_id: UUID) -> JobResponse:
        job = await self.repository.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return JobResponse.model_validate(job)

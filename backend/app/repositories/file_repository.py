from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List
from app.db.models import JobFile, FileStatus, FileType

class FileRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add_files(self, files_data: List[dict]):
        """
        Bulk insert files.
        files_data expected to be a list of dicts matching JobFile model fields.
        """
        # SQLAlchemy async bulk insert is often done by adding objects
        new_files = [JobFile(**data) for data in files_data]
        self.session.add_all(new_files)
        # Flush to check for constraints (though bulk insert might be faster if purely core, 
        # ORM add_all is fine for batches of ~20)
        await self.session.flush()
        return new_files

    async def get_file(self, file_id: UUID) -> JobFile:
        from sqlalchemy import select
        stmt = select(JobFile).where(JobFile.id == file_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def update_file_status(self, file_id: UUID, status: FileStatus, retry_count: int = None, error_message: str = None):
        from sqlalchemy import update
        values = {"status": status}
        if retry_count is not None:
            values["retry_count"] = retry_count
        # error_message usually goes to Job or separate log, File doesn't have error_message column in schema provided earlier.
        # Check schema again. No error_message in JobFile. Job has error_message.
        # Assuming we just log the error or store it in AuditLog.
        
        stmt = (
            update(JobFile)
            .where(JobFile.id == file_id)
            .values(**values)
            .execution_options(synchronize_session="fetch")
        )
        await self.session.execute(stmt)

    async def get_files_by_job(self, job_id: UUID) -> List[JobFile]:
        from sqlalchemy import select
        stmt = select(JobFile).where(JobFile.job_id == job_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_pending_files_for_job(self, job_id: UUID) -> List[JobFile]:
        from sqlalchemy import select
        stmt = select(JobFile).where(JobFile.job_id == job_id, JobFile.status == FileStatus.QUEUED).with_for_update(skip_locked=True)
        result = await self.session.execute(stmt)
        return result.scalars().all()


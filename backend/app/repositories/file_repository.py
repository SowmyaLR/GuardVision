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

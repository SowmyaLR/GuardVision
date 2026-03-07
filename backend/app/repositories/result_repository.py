from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import Dict, Any, List
from app.db.models.tables import ProcessingResult

class ResultRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_result(self, file_id: UUID, redacted_file_path: str, entities_detected: List[Dict[str, Any]], processing_time_ms: int) -> ProcessingResult:
        result = ProcessingResult(
            file_id=file_id,
            redacted_file_path=redacted_file_path,
            entities_detected=entities_detected,
            processing_time_ms=processing_time_ms
        )
        self.session.add(result)
        await self.session.flush()
        return result
    
    async def get_result_by_file_id(self, file_id: UUID) -> ProcessingResult:
        stmt = select(ProcessingResult).where(ProcessingResult.file_id == file_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

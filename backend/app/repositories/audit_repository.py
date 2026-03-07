from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Dict, Any, Optional
from app.db.models.tables import AuditLog

class AuditRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_audit_log(self, job_id: UUID, event_type: str, details: Dict[str, Any], file_id: Optional[UUID] = None) -> AuditLog:
        audit = AuditLog(
            job_id=job_id,
            file_id=file_id,
            event_type=event_type,
            details=details
        )
        self.session.add(audit)
        await self.session.flush()
        return audit

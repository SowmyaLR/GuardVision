from app.repositories.result_repository import ResultRepository
from app.repositories.audit_repository import AuditRepository
from uuid import UUID
from typing import List, Dict, Any

class MetadataService:
    def __init__(self, result_repo: ResultRepository, audit_repo: AuditRepository):
        self.result_repo = result_repo
        self.audit_repo = audit_repo

    async def save_processing_result(self, job_id: UUID, file_id: UUID, redacted_path: str, entities: List[Dict[str, Any]], duration_ms: int):
        # Save result
        await self.result_repo.create_result(file_id, redacted_path, entities, duration_ms)
        
        # Audit
        await self.audit_repo.create_audit_log(
            job_id=job_id,
            file_id=file_id,
            event_type="PROCESSING_COMPLETE",
            details={
                "duration_ms": duration_ms,
                "entities_count": len(entities)
            }
        )


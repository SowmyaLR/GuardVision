from uuid import UUID
from datetime import datetime
from typing import List
from pydantic import BaseModel, ConfigDict
from app.db.models import FileStatus

class FileResponse(BaseModel):
    job_id: UUID
    files_received: int
    status: str 

class FileErrorResponse(BaseModel):
    error: str
    allowed_types: List[str]

    model_config = ConfigDict(from_attributes=True)

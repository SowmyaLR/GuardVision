from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.db.models import JobStatus

class JobBase(BaseModel):
    pass

class JobCreate(JobBase):
    pass

class JobResponse(BaseModel):
    id: UUID
    status: JobStatus
    created_at: datetime
    progress: Optional[int] = 0
    total_files: Optional[int] = 0
    processed_files: Optional[int] = 0
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class JobStatusResponse(BaseModel):
    id: UUID
    status: JobStatus
    progress: int
    total_files: int
    processed_files: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

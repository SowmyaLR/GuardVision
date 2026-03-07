from pydantic import BaseModel, ConfigDict
from uuid import UUID
from typing import Dict, Any, List, Optional
from datetime import datetime

class EntityDetected(BaseModel):
    type: str # e.g. "NAME", "DOB"
    score: float
    start: Optional[int] = None
    end: Optional[int] = None
    # For images, we might have bounding boxes instead of start/end
    box: Optional[List[int]] = None # [left, top, width, height]

class ProcessingResultBase(BaseModel):
    processing_time_ms: int
    entities_detected: List[EntityDetected]
    redacted_file_path: Optional[str] = None 
    # Use Optional because sometimes maybe no file generated if failure, but this is Result schema.
    # The DB schema has redacted_file_path as NOT NULL. So it must be there on success.
    
class ProcessingResultCreate(ProcessingResultBase):
    file_id: UUID
    redacted_file_path: str

class ProcessingResultRead(ProcessingResultBase):
    id: UUID
    file_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class FileStatusUpdate(BaseModel):
    status: str
    retry_count: int
    error_message: Optional[str] = None

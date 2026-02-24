from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, UploadFile, File, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.job import JobResponse
from app.schemas.file import FileResponse, FileErrorResponse
from app.services.job_service import JobService
from app.services.upload_service import UploadService

router = APIRouter()

@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(db: AsyncSession = Depends(get_db)):
    service = JobService(db)
    return await service.create_job()

@router.post(
    "/jobs/{job_id}/files", 
    response_model=FileResponse, 
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        400: {"model": FileErrorResponse},
        404: {"description": "Job not found"}
    }
)
async def upload_files(
    job_id: UUID, 
    files: List[UploadFile] = File(...), 
    db: AsyncSession = Depends(get_db)
):
    service = UploadService(db)
    try:
        return await service.process_uploads(job_id, files)
    except HTTPException as he:
        # Pass through HTTP exceptions (validation/not found)
        raise he
    except Exception as e:
        # Internal server error for other failures
        # Ideally log the error here: logger.error(e)
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job_status(job_id: UUID, db: AsyncSession = Depends(get_db)):
    service = JobService(db)
    return await service.get_job_status(job_id)

import asyncio
import sys
import os

# Add parent directory to path so we can import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.base import AsyncSessionLocal, engine
from app.db.models import Job, JobFile, ProcessingResult, JobStatus, FileStatus, FileType, Base

async def create_seed_data():
    async with AsyncSessionLocal() as session:
        print("Creating seed data...")
        
        # 1. Create Job
        job = Job(
            status=JobStatus.COMPLETED,
            progress=100,
            total_files=2,
            processed_files=2
        )
        session.add(job)
        await session.flush() # flush to get job.id

        print(f"Created Job: {job.id}")

        # 2. Create 2 Files
        file1 = JobFile(
            job_id=job.id,
            original_filename="patient_scan_001.dcm",
            stored_path="/manual_uploads/2026/02/13/scan1.dcm",
            file_type=FileType.DICOM,
            status=FileStatus.COMPLETED,
            retry_count=0
        )
        
        file2 = JobFile(
            job_id=job.id,
            original_filename="lab_result.jpg",
            stored_path="/manual_uploads/2026/02/13/lab.jpg",
            file_type=FileType.IMAGE,
            status=FileStatus.COMPLETED,
            retry_count=1
        )

        session.add(file1)
        session.add(file2)
        await session.flush()
        
        print(f"Created Files: {file1.id}, {file2.id}")

        # 3. Create 1 Completed Result (for file1)
        result = ProcessingResult(
            file_id=file1.id,
            redacted_file_path="/redacted/2026/02/13/scan1_redacted.dcm",
            entities_detected={"PERSON": 1, "DATE": 1},
            processing_time_ms=1250
        )
        session.add(result)
        
        await session.commit()
        print("Seed data committed successfully.")

async def main():
    # Helper to clean up DB tables for testing (optional, usually handled by migration)
    # async with engine.begin() as conn:
    #     await conn.run_sync(Base.metadata.drop_all)
    #     await conn.run_sync(Base.metadata.create_all)
    
    await create_seed_data()
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())

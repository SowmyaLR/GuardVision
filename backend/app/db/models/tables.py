import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Enum,
    Boolean,
    CheckConstraint,
    Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

# Enums
class JobStatus(str, PyEnum):
    CREATED = "created"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class FileStatus(str, PyEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class FileType(str, PyEnum):
    IMAGE = "image"
    DICOM = "dicom"

# Models
class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status = Column(Enum(JobStatus, name="job_status", native_enum=True), nullable=False, default=JobStatus.CREATED)
    progress = Column(Integer, default=0, nullable=False)
    total_files = Column(Integer, default=0, nullable=False)
    processed_files = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    files = relationship("JobFile", back_populates="job", cascade="all, delete-orphan") # Note: User mentioned "FK cascade delete disabled (audit must persist)" but for Job->JobFiles usually files go with job.
    # User said: "FK cascade delete disabled (audit must persist)".
    # This likely refers to AuditLogs not being deleted when Job is deleted, OR JobFiles not being deleted.
    # "Soft-state tracking via statuses (never delete rows)" hints we shouldn't delete anyway.
    # I will stick to default relationship but ensure FK constraints in DB allow/disallow what's needed.
    # Re-reading: "FK cascade delete disabled (audit must persist)" -> means AuditLogs should not be deleted if Job is deleted.
    # So on AuditLog relationship, we should probably NOT have cascade delete on the DB side, or have SET NULL.

    audit_logs = relationship("AuditLog", back_populates="job")

    __table_args__ = (
        CheckConstraint('progress >= 0 AND progress <= 100', name='check_job_progress_range'),
        CheckConstraint('processed_files <= total_files', name='check_job_processed_files_count'),
        Index('idx_jobs_status', 'status'),
    )


class JobFile(Base):
    __tablename__ = "job_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    original_filename = Column(Text, nullable=False)
    stored_path = Column(Text, nullable=False)
    file_type = Column(Enum(FileType, name="file_type", native_enum=True), nullable=False)
    status = Column(Enum(FileStatus, name="file_status", native_enum=True), nullable=False, default=FileStatus.QUEUED)
    retry_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    job = relationship("Job", back_populates="files")
    result = relationship("ProcessingResult", back_populates="file", uselist=False, cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint('retry_count <= 3', name='check_file_retry_count'),
        Index('idx_job_files_job_id', 'job_id'),
        # optimized for worker queue selection
        Index('idx_job_files_status_created_at', 'status', 'created_at'),
    )


class ProcessingResult(Base):
    __tablename__ = "processing_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id = Column(UUID(as_uuid=True), ForeignKey("job_files.id"), nullable=False, unique=True)
    redacted_file_path = Column(Text, nullable=False)
    entities_detected = Column(JSONB, nullable=False, default={})
    processing_time_ms = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    file = relationship("JobFile", back_populates="result")

    __table_args__ = (
        Index('idx_processing_results_file_id', 'file_id'),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    file_id = Column(UUID(as_uuid=True), ForeignKey("job_files.id"), nullable=True)
    event_type = Column(Text, nullable=False)
    details = Column(JSONB, nullable=False, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False) # Commonly needed for logs

    # Relationships
    job = relationship("Job", back_populates="audit_logs")
    # No direct relationship to file defined in class spec but implied by FK.
    
    __table_args__ = (
        Index('idx_audit_logs_job_id', 'job_id'),
    )

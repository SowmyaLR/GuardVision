from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "guardvision_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.worker.tasks.process_job", "app.worker.tasks.process_file"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_concurrency=4, # "Parallel processing supported"
)

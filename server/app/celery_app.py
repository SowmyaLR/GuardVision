import os

from celery import Celery

broker_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
result_backend = os.getenv("CELERY_RESULT_BACKEND", broker_url)

celery_app = Celery(
    "guardvision",
    broker=broker_url,
    backend=result_backend,
)

celery_app.conf.broker_connection_retry_on_startup = True

celery_app.autodiscover_tasks(["app"])

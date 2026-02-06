from app.celery_app import celery_app


@celery_app.task
def health_ping() -> str:
    return "OK"

from app.celery_app import celery_app


# Placeholder task to confirm Celery/Redis wiring during infra setup.
@celery_app.task
def health_ping() -> str:
    return "OK"

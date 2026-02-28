from uuid import UUID
import redis.asyncio as redis
from app.core.config import settings

class QueueService:
    def __init__(self):
        # In a real app, create pool at startup. For now, we connect on demand or use a global.
        # Ideally, this should be dependency injected.
        self.redis_url = settings.REDIS_URL

    async def enqueue_job(self, job_id: UUID):
        """
        Push job_id to the 'processing_queue' list in Redis.
        """
        try:
            r = redis.from_url(self.redis_url, encoding="utf-8", decode_responses=True)
            async with r:
                # We can replicate standard queue behavior like RPUSH
                await r.rpush("processing_queue", str(job_id))
        except Exception as e:
            # If Redis is down, log the error but do not fail the HTTP request.
            # This matches the robustness requirement: state is already committed,
            # and enqueue can be retried or handled out-of-band.
            print(f"Failed to enqueue job {job_id} to Redis: {e}")

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="GuardVision API")

allowed_origins = [
    origin.strip() for origin in os.getenv("CORS_ALLOW_ORIGINS", "*").split(",")
]

# Avoid credentialed requests when using wildcard origins.
allow_creds = "*" not in allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict:
    return {"status": "OK"}

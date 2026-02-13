from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import jobs

app = FastAPI(
    title="GuardVision API",
    description="Privacy Intelligence for Everyone",
    version="1.0.0",
)

# CORS (Allow frontend if needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(jobs.router, prefix="/api/v1", tags=["Jobs"])

@app.get("/")
def read_root():
    return {"message": "GuardVision API is running"}

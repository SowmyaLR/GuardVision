from fastapi import FastAPI

app = FastAPI(title="GuardVision API")


@app.get("/health")
def health_check() -> dict:
    return {"status": "OK"}

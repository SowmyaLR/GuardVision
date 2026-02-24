import asyncio
import httpx
import os
from uuid import uuid4

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
TEST_FILES_DIR = "test_data"
OS_UPLOAD_DIR = "data/uploads" # Ensure this matches .env

async def run_verification():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        print("\n🔍 Starting Job Lifecycle Verification...\n")

        # 1. Create Job
        print("1️⃣  Creating Job...")
        resp = await client.post("/jobs")
        assert resp.status_code == 201
        job_data = resp.json()
        job_id = job_data["id"]
        print(f"   ✅ Job Created: {job_id} (Status: {job_data['status']})")

        # 2. Prepare Test Files
        os.makedirs(TEST_FILES_DIR, exist_ok=True)
        
        # Valid files
        with open(f"{TEST_FILES_DIR}/valid.dcm", "wb") as f: f.write(b"fake_dicom_content")
        with open(f"{TEST_FILES_DIR}/valid.jpg", "wb") as f: f.write(b"fake_image_content")
        
        # Invalid file (wrong extension)
        with open(f"{TEST_FILES_DIR}/invalid.txt", "wb") as f: f.write(b"text_content")
        
        # Invalid file (too large - assume limit is 20MB, write 21MB dummy)
        # Skipping large file creation to save time/disk, relying on small config for test if possible
        # or just testing extension validation.

        # 3. Upload Files (Multiple & Validation)
        print("\n2️⃣  Uploading Files...")
        
        # Case A: Valid Upload (Multiple files)
        files = [
            ("files", ("scan1.dcm", open(f"{TEST_FILES_DIR}/valid.dcm", "rb"), "application/dicom")),
            ("files", ("photo.jpg", open(f"{TEST_FILES_DIR}/valid.jpg", "rb"), "image/jpeg")),
        ]
        resp = await client.post(f"/jobs/{job_id}/files", files=files)
        assert resp.status_code == 202
        file_resp = resp.json()
        print(f"   ✅ Uploaded 2 files successfully. Status: {file_resp['status']}")

        # Case B: Invalid Extension
        print("   🔸 Testing Invalid Extension...")
        new_job = await client.post("/jobs")
        bad_job_id = new_job.json()["id"]
        bad_files = [("files", ("doc.txt", open(f"{TEST_FILES_DIR}/invalid.txt", "rb"), "text/plain"))]
        resp = await client.post(f"/jobs/{bad_job_id}/files", files=bad_files)
        assert resp.status_code == 400
        print(f"   ✅ Invalid extension rejected: {resp.json()['detail']}")

        # 4. Poll Status (Persistence Check)
        print(f"\n3️⃣  Polling Job Status for {job_id}...")
        resp = await client.get(f"/jobs/{job_id}")
        assert resp.status_code == 200
        status_data = resp.json()
        print(f"   ✅ Current Status: {status_data['status']}")
        print(f"   ✅ Files Processed: {status_data['processed_files']}/{status_data['total_files']}")
        
        assert status_data['total_files'] == 2
        print("\n🎉 Verification Complete! The API is behaving as expected.")

        # Cleanup
        for f in os.listdir(TEST_FILES_DIR):
            os.remove(os.path.join(TEST_FILES_DIR, f))
        os.rmdir(TEST_FILES_DIR)

if __name__ == "__main__":
    try:
        asyncio.run(run_verification())
    except Exception as e:
        print(f"\n❌ Verification Failed: {e}")
        print("Make sure the backend server consists of redis and postgres is running on port 8000!")

from typing import Set

ALLOWED_EXTENSIONS: Set[str] = {"png", "jpg", "jpeg", "dcm"}
MAX_FILE_SIZE_MB: int = 20
MAX_FILE_SIZE_BYTES: int = MAX_FILE_SIZE_MB * 1024 * 1024
MAX_FILES_PER_JOB: int = 20

def validate_file_extension(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS

def validate_file_size(size: int) -> bool:
    return 0 < size <= MAX_FILE_SIZE_BYTES

def get_file_extension(filename: str) -> str:
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()

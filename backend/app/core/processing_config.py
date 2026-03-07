from pydantic_settings import BaseSettings
from typing import List

class ProcessingSettings(BaseSettings):
    PHI_ENTITIES_STR: str = "PERSON,DATE_TIME,PHONE_NUMBER,EMAIL_ADDRESS,LOCATION,US_PASSPORT,US_DRIVER_LICENSE"
    REDACTION_MODE: str = "blur" # blur | blackbox
    MAX_RETRY: int = 3
    
    @property
    def PHI_ENTITIES(self) -> List[str]:
        return [e.strip() for e in self.PHI_ENTITIES_STR.split(",") if e.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"

processing_settings = ProcessingSettings()

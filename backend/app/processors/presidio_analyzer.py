from presidio_analyzer import AnalyzerEngine
from typing import List, Optional
from app.core.processing_config import processing_settings

class TextAnalyzer:
    def __init__(self):
        self.analyzer = AnalyzerEngine()
        self.entities = processing_settings.PHI_ENTITIES

    def analyze(self, text: str) -> List[dict]:
        results = self.analyzer.analyze(text=text, entities=self.entities, language='en')
        return [r.to_dict() for r in results]

# Singleton-like instance if needed, or instantiate per worker
text_analyzer = TextAnalyzer()

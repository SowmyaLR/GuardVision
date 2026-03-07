from presidio_image_redactor import ImageRedactorEngine, ImageAnalyzerEngine
from PIL import Image
from typing import Tuple, List, Dict, Any
import time
from app.core.processing_config import processing_settings

class ImageProcessor:
    def __init__(self):
        self.image_analyzer = ImageAnalyzerEngine()
        self.redactor = ImageRedactorEngine(image_analyzer_engine=self.image_analyzer)
        self.entities = processing_settings.PHI_ENTITIES
        # Use simple color mapping for now. "blur" is handled differently in Presidio?
        # Presidio image redactor usually uses fill color. Blur might need custom implementation or check if supported.
        # "blackbox" -> fill="black".
        # If mode is "blur", we might need to implement blur manually using the bounding boxes from analysis.
        
    def process(self, image_path: str, output_path: str) -> Tuple[List[Dict[str, Any]], int]:
        start_time = time.time()
        
        image = Image.open(image_path)
        
        # 1. Analyze
        # Helper to get entities.
        # Note: image_analyzer.analyze returns List[ImageRecognizerResult]
        bboxes = self.image_analyzer.analyze(image, entities=self.entities)
        
        # 2. Redact
        # If mode is blur, we iterate bboxes and blur.
        # If mode is blackbox, we use redactor.redact with bboxes?
        
        if processing_settings.REDACTION_MODE == "blur":
             # Custom blur logic using bboxes
             # Not implemented in basic presidio-image-redactor as a simple mode string usually.
             # We can do it manually with PIL.
             self._blur_image(image, bboxes)
             image.save(output_path)
        else:
             # Default to black box
             # redactor.redact can take custom logic but simpler to just let it do its thing if we didn't have bboxes.
             # But we have bboxes. Presidio redactor.redact doesn't explicitly take 'bboxes' as list of results to apply?
             # Actually, looking at common usage, one can pass 'ocr_results' but typically it runs analyze internally if not mocked.
             # For efficiency and consistency, if we manually blur, we use bboxes.
             # If we use redactor.redact, we might analyze again.
             # Let's assume we use our `bboxes` and apply rectangles manually to ensure consistent behavior with "blur" vs "black".
             self._fill_image(image, bboxes, fill_color="black")
             image.save(output_path)

        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Convert bboxes to serializable format
        entities_detected = []
        for bbox in bboxes:
            entities_detected.append({
                "type": bbox.entity_type,
                "score": bbox.score,
                "start": bbox.start,
                "end": bbox.end,
                "box": [bbox.left, bbox.top, bbox.width, bbox.height]
            })
            
        return entities_detected, processing_time_ms

    def _blur_image(self, image: Image.Image, bboxes):
        from PIL import ImageFilter
        
        # For each bbox, crop, blur, paste back.
        for bbox in bboxes:
            box = (bbox.left, bbox.top, bbox.left + bbox.width, bbox.top + bbox.height)
            # Validate box is within image
            # ...
            region = image.crop(box)
            blurred_region = region.filter(ImageFilter.GaussianBlur(radius=15))
            image.paste(blurred_region, box)

    def _fill_image(self, image: Image.Image, bboxes, fill_color):
        from PIL import ImageDraw
        draw = ImageDraw.Draw(image)
        for bbox in bboxes:
            box = [bbox.left, bbox.top, bbox.left + bbox.width, bbox.top + bbox.height]
            draw.rectangle(box, fill=fill_color)

image_processor = ImageProcessor()

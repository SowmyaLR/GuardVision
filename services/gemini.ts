
import { GoogleGenAI, Type } from "@google/genai";
import { Detection } from "../types";

// Using Flash for significantly faster inference in real-time redaction tasks
const MODEL_NAME = 'gemini-3-flash-preview';

// Retry configuration for handling API overload
const MAX_RETRIES = 3;
const INITIAL_DELAY = 2000; // 2 seconds

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Applies a small safety margin (padding) to the bounding box to ensure 
 * complete coverage of the PII, especially for text where character 
 * descenders/ascenders might be close to the edges.
 */
const applySafetyBuffer = (box: [number, number, number, number], bufferPercent: number = 0.015): [number, number, number, number] => {
  const [ymin, xmin, ymax, xmax] = box;
  const height = ymax - ymin;
  const width = xmax - xmin;
  
  return [
    Math.max(0, ymin - (height * bufferPercent)),
    Math.max(0, xmin - (width * bufferPercent)),
    Math.min(1000, ymax + (height * bufferPercent)),
    Math.min(1000, xmax + (width * bufferPercent))
  ];
};

export const analyzeImageForPII = async (base64Data: string): Promise<Detection[]> => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined. Make sure it is set in your .env file and that the dev server has been restarted.");
    throw new Error("Missing GEMINI_API_KEY configuration");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    ACT AS A HIGH-PRECISION SECURITY AUDITOR.
    Perform an exhaustive neural scan of the provided image to identify all Personally Identifiable Information (PII) and sensitive data markers.
    
    SPATIAL ACCURACY IS CRITICAL:
    - Return precise bounding boxes [ymin, xmin, ymax, xmax] mapped to a 0-1000 coordinate system.
    - Ensure boxes encompass the FULL EXTENT of the target.
    
    SPECIAL INSTRUCTION FOR ID CARDS/DOCUMENTS:
    - DO NOT redact the entire frame of an ID card, passport, or driver's license.
    - INSTEAD, detect and redact specific PII FIELDS WITHIN the document, such as the person's photo, the unique ID number, full name, date of birth, and address.
    
    DETECTABLE CATEGORIES:
    - "Face": Human faces (including photos on IDs).
    - "Name": Printed or handwritten full names.
    - "ID Number": Specific identifier strings (Passport No, License No, SSN).
    - "QR Code": Any matrix barcodes or standard barcodes that may contain data.
    - "Phone Number": Contact numbers.
    - "Email": Digital mail addresses.
    - "Address": Physical locations.
    - "Credit Card": Card numbers, CVVs, or expiry dates.
    - "Signature": Handwritten signatures.
    - "Sensitive Text": Contextually private data or medical notes.
    
    OUTPUT FORMAT: Return ONLY a valid JSON array of objects.
  `;

  let lastError: any;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
            { text: prompt }
          ]
        },
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                box_2d: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                  minItems: 4,
                  maxItems: 4
                }
              },
              required: ["label", "confidence", "box_2d"]
            }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from neural engine.");

      const rawDetections = JSON.parse(text);
      
      return rawDetections.map((d: any, index: number) => {
        const bufferedBox = applySafetyBuffer(d.box_2d, 0.015);
        
        return {
          ...d,
          id: `det-${index}-${Date.now()}`,
          box_2d: bufferedBox,
          selected: true
        };
      });
    } catch (error: any) {
      lastError = error;
      const isOverloaded = error?.error?.code === 503 || error?.message?.includes('overloaded');
      
      if (isOverloaded && attempt < MAX_RETRIES - 1) {
        const waitTime = INITIAL_DELAY * Math.pow(2, attempt);
        console.warn(`API overloaded. Retrying in ${waitTime}ms... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
        await delay(waitTime);
      } else {
        break;
      }
    }
    
  }
  
  console.error("AI Analysis failed after retries:", lastError?.message ?? "Unknown error");
  throw lastError;
};

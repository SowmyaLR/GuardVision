
import { GoogleGenAI, Type } from "@google/genai";
import { Detection } from "../types";

// Using Flash for significantly faster inference in real-time redaction tasks
const MODEL_NAME = 'gemini-3-flash-preview';

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

export const analyzeImageForPII = async (base64Image: string): Promise<Detection[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
    
    HIPAA-SPECIFIC CATEGORIES (Healthcare Contexts):
    - "Date": Date of birth, admission dates, discharge dates, prescription dates, or any healthcare-related dates.
    - "Medical Record Number": Patient MRN or medical record identifiers.
    - "Health Plan ID": Insurance policy numbers, member IDs, or health plan identifiers.
    - "Account Number": Healthcare billing numbers or account identifiers.
    - "Device Identifier": Medical device serial numbers, implant identifiers, or equipment IDs.
    - "Biometric Identifier": Fingerprints, retinal scans, iris scans, or other biometric markers beyond facial recognition.
    
    OUTPUT FORMAT: Return ONLY a valid JSON array of objects.
  `;

  try {
    // Extract base64 payload without creating an intermediate array (avoid .split())
    const base64Start = base64Image.indexOf(',');
    const base64Data = base64Start !== -1 ? base64Image.substring(base64Start + 1) : base64Image;

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
      // Post-processing: Apply a 1.5% buffer to ensure the redaction is slightly larger than the PII
      const bufferedBox = applySafetyBuffer(d.box_2d, 0.015);
      
      return {
        ...d,
        id: `det-${index}-${Date.now()}`,
        box_2d: bufferedBox,
        selected: true
      };
    });
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    console.error("AI Analysis failed:", safeMessage);
    throw error;
  }
};

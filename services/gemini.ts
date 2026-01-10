
import { GoogleGenAI, Type } from "@google/genai";
import { Detection } from "../types";

// Using Gemini 3 Flash for the fastest possible inference latency (usually < 3s)
const MODEL_NAME = 'gemini-3-flash-preview';

export const analyzeImageForPII = async (base64Image: string): Promise<Detection[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `
    Find all PII/sensitive data in this image.
    
    RULES:
    - Use [ymin, xmin, ymax, xmax] coordinates (0-1000).
    - Tight bounding boxes.
    - Labels: "Face", "Name", "ID Card", "Phone Number", "Email", "Address", "Credit Card", "Signature", "Sensitive Text".
    
    Output JSON array: [{"label": string, "confidence": number, "box_2d": [n,n,n,n]}]
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/jpeg' } },
          { text: prompt }
        ]
      },
      config: {
        // Thinking budget 0 and Flash model minimize wait time significantly
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
    if (!text) throw new Error("No response from AI model.");

    const rawDetections = JSON.parse(text);
    return rawDetections.map((d: any, index: number) => ({
      ...d,
      id: `det-${index}-${Date.now()}`,
      selected: true
    }));
  } catch (error) {
    console.error("AI Analysis failed:", error);
    throw error;
  }
};

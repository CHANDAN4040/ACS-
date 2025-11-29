import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
// NOTE: In a production app, never expose keys on the client. 
// For this demo structure, we use process.env.
const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

export const performOCR = async (imageBase64: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your configuration.");
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            text: "Extract all text from this image. Keep the formatting as close as possible to the original. If there is a table, try to represent it in Markdown.",
          },
        ],
      },
    });

    return response.text || "No text could be extracted.";
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to perform OCR. Please try again.");
  }
};

export const removeImageBackground = async (imageBase64: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  try {
    // We use gemini-2.5-flash-image for image editing tasks
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            text: "Remove the background from this image. Return the main subject on a solid white background. Ensure high precision for edges.",
          },
        ],
      },
    });

    // Check for image part in response
    const candidates = response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    
    throw new Error("No image generated.");
  } catch (error) {
    console.error("BG Removal Error:", error);
    throw new Error("Failed to remove background.");
  }
};
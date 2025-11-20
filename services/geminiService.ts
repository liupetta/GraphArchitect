import { GoogleGenAI, Type } from "@google/genai";
import { NodeType } from "../types";

const GEMINI_MODEL = "gemini-2.5-flash";

export const extractGraphFromImage = async (
  base64Image: string,
  mimeType: string,
  floorLevel: number
): Promise<any> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Analyze this floor plan image. 
    I need you to identify rooms, corridors, and staircases as nodes in a graph.
    
    For each element, provide:
    1. A label (e.g., "Room 101", "Corridor A", "Stairs").
    2. The type (classroom, corridor, stairs, outdoor, office, service).
    3. A bounding box in the format [ymin, xmin, ymax, xmax] using a 0-1000 scale relative to the image dimensions.
    
    Also, estimate connectivity (edges) between these nodes if they are adjacent.
    
    Return the response in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  type: { type: Type.STRING }, // We will map this to Enum later
                  box_2d: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                    description: "ymin, xmin, ymax, xmax in 0-1000 coordinates",
                  },
                },
                required: ["label", "type", "box_2d"],
              },
            },
            connections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source_label: { type: Type.STRING },
                  target_label: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};

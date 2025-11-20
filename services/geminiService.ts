
import { GoogleGenAI, Modality } from "@google/genai";
import type { UploadedFile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const fileToGenerativePart = (file: UploadedFile) => {
  return {
    inlineData: {
      data: file.base64,
      mimeType: file.mimeType,
    },
  };
};

export const generateAutomaticPrompt = async (
  basePrompt: string,
  options: any
): Promise<string> => {
  const model = "gemini-2.5-flash";
  const fullPrompt = `Based on the following user request and options, generate a detailed, descriptive, and inspiring prompt for an architectural rendering AI. The prompt should be in Vietnamese.
  
  User Request: "${basePrompt}"
  Options: ${JSON.stringify(options, null, 2)}
  
  Generated Prompt:`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating automatic prompt:", error);
    throw new Error("Failed to generate prompt.");
  }
};

const generateImageFromImage = async (
  inputFile: UploadedFile,
  prompt: string
): Promise<string> => {
  const model = "gemini-2.5-flash-image";
  const imagePart = fileToGenerativePart(inputFile);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [imagePart, { text: prompt }],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    throw new Error("No image data returned from API.");
  } catch (error) {
    console.error(`Error generating image with prompt "${prompt}":`, error);
    throw new Error("Failed to generate image from source.");
  }
};

export const generateRenderWithReference = async (
  styleReferenceFile: UploadedFile,
  sketchFile: UploadedFile,
  prompt: string
): Promise<string> => {
  const model = "gemini-2.5-flash-image";
  const referencePart = fileToGenerativePart(styleReferenceFile);
  const sketchPart = fileToGenerativePart(sketchFile);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          referencePart,
          sketchPart,
          { text: prompt },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    throw new Error("No image data returned from API with style reference.");
  } catch (error) {
    console.error(`Error generating image with style reference:`, error);
    throw new Error("Failed to generate image from source with style reference.");
  }
};


export const generateSketch = async (inputFile: UploadedFile): Promise<string> => {
  const prompt =
    "Convert this architectural photo into a clean, black and white line art sketch. Focus on the main structural lines and contours. Remove all color, textures, and background elements like sky or trees. The output should be a simple and clear architectural drawing.";
  return generateImageFromImage(inputFile, prompt);
};

export const generateRender = async (
  sketchFile: UploadedFile,
  fullPrompt: string
): Promise<string> => {
  return generateImageFromImage(sketchFile, fullPrompt);
};

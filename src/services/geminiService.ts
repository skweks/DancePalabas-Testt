import { GoogleGenAI } from "@google/genai";
import { Landmark, landmarksToText } from "../lib/poseUtils";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getDanceInstruction(landmarks: Landmark[]): Promise<string> {
  const model = "gemini-3-flash-preview";
  const landmarkText = landmarksToText(landmarks);
  
  const prompt = `
    You are an expert dance coach. Based on these 3D coordinates (landmarks) of a dancer's body, 
    describe the current dance pose or move in one short, punchy sentence (max 10 words).
    Focus on the most dynamic part of the body.
    
    Coordinates: {landmarkText}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        maxOutputTokens: 50,
      }
    });
    
    return response.text?.trim() || "Analyzing move...";
  } catch (error) {
    console.error("Gemini instruction error:", error);
    return "Keep moving!";
  }
}

export async function explainDifferences(diffScore: number, refLandmarks: Landmark[], userLandmarks: Landmark[]): Promise<string> {
  const model = "gemini-3-flash-preview";
  const refText = landmarksToText(refLandmarks);
  const userText = landmarksToText(userLandmarks);
  
  const prompt = `
    A student is practicing a dance move. Their similarity score is ${diffScore.toFixed(0)}%.
    Compare the student's landmarks to the reference landmarks and give 1 specific tip to improve.
    Example: "Raise your right arm higher" or "Bend your knees more".
    
    Reference: {refText}
    Student: {userText}
    
    Tip (max 15 words):
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    return response.text?.trim() || "Try to match the silhouette closer!";
  } catch (error) {
    return "Focus on your posture!";
  }
}

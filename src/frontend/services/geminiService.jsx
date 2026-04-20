import { GoogleGenAI } from "@google/genai";
import { landmarksToText } from "../lib/poseUtils.jsx";

let genAI = null;
let initAttempted = false;
let initError = null;

function initGenAI() {
  if (!genAI && !initAttempted) {
    initAttempted = true;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      initError = "No API key found";
      console.warn("Gemini API key not found. Set VITE_GEMINI_API_KEY in .env");
      return null;
    }
    
    try {
      genAI = new GoogleGenAI({ apiKey });
      console.log("✓ Gemini API initialized successfully");
    } catch (error) {
      initError = error.message;
      console.error("✗ Failed to initialize Gemini:", error);
      return null;
    }
  }
  return genAI;
}

export async function getDanceInstruction(landmarks) {
  const ai = initGenAI();
  if (!ai) {
    console.warn("AI not available:", initError);
    return "Analyzing move...";
  }
  
  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const landmarkText = landmarksToText(landmarks);
    
    const prompt = `
      You are an expert dance coach. Based on these 3D coordinates (landmarks) of a dancer's body, 
      describe the current dance pose or move in one short, punchy sentence (max 10 words).
      Focus on the most dynamic part of the body.
      
      Coordinates: ${landmarkText}
    `;

    console.log("📤 Sending to Gemini...");
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    console.log("📥 Gemini response:", text);
    return text || "Analyzing move...";
  } catch (error) {
    console.error("✗ Gemini instruction error:", error.message);
    return "Keep moving!";
  }
}

export async function explainDifferences(diffScore, refLandmarks, userLandmarks) {
  const ai = initGenAI();
  if (!ai) {
    return "Unable to connect to AI service.";
  }
  
  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const refText = landmarksToText(refLandmarks);
    const userText = landmarksToText(userLandmarks);
    
    const prompt = `
      A student is practicing a dance move. Their similarity score is ${diffScore.toFixed(0)}%.
      Compare the student's landmarks to the reference landmarks and give 1 specific tip to improve.
      Example: "Raise your right arm higher" or "Bend your knees more".
      
      Reference: ${refText}
      Student: ${userText}
      
      Tip (max 15 words):
    `;

    const result = await model.generateContent(prompt);
    return result.response.text().trim() || "Try to match the silhouette closer!";
  } catch (error) {
    console.error("Gemini differences error:", error);
    return "Focus on your posture!";
  }
}
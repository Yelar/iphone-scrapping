import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the GoogleGenerativeAI with your API key
const gemini = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

export default gemini;
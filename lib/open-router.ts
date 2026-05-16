import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const createOpenRouterProvider = () =>
  createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: {
      "HTTP-Referer": "http://localhost:8081", // Replace with your actual app URL
      "X-Title": "Declutter App", // Replace with your actual app name
    },
  });

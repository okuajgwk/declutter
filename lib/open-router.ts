import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const getOpenRouterApiKey = () => {
  const raw = process.env.OPENROUTER_API_KEY ?? "";
  return raw.trim().replace(/^['"]|['"]$/g, "");
};

export const createOpenRouterProvider = () =>
  createOpenRouter({
    apiKey: getOpenRouterApiKey(),
    headers: {
      "HTTP-Referer": "http://localhost:8081", // Replace with your actual app URL
      "X-Title": "Declutter App", // Replace with your actual app name
    },
  });

export const hasOpenRouterApiKey = () => Boolean(getOpenRouterApiKey());

import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "../../lib/ai-gateway";

const COACH_SYSTEM = (node: any) => `You are a calm, empathetic cognitive behavioral coach. The user has surfaced this thought:

Title: "${node.title}"
Original: "${node.original_thought}"
Category: ${node.category}
Current mental weight: ${node.mental_weight}/10

Your job:
- Ask Socratic, grounding questions. Do NOT generate to-do lists.
- Challenge catastrophizing language gently. Help them separate what is in their control vs external.
- Keep replies short (1-3 sentences). One question at a time.
- When the user has a real reframe, breakthrough, or rationalization that genuinely lowers the felt weight, call the updateNodeWeight tool with the new weight (integer 1-10) and a one-line reason. Only call it when warranted — not on every message.`;

export async function POST(req: Request) {
  try {
    const { node, messages } = await req.json();

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return new Response("LOVABLE_API_KEY missing", { status: 500 });

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const result = streamText({
      model,
      system: COACH_SYSTEM(node),
      messages,
      stopWhen: stepCountIs(50),
      tools: {
        updateNodeWeight: tool({
          description: "Update the mental weight of the current thought when the user reaches a genuine reframe.",
          inputSchema: z.object({
            newWeight: z.number().int().min(1).max(10),
            reason: z.string().max(160),
          }),
          execute: async ({ newWeight, reason }) => ({ ok: true, newWeight, reason }),
        }),
      },
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of result.fullStream) {
            if (part.type === "text-delta") {
              const data = JSON.stringify({ type: "delta", text: part.text ?? "" });
              controller.enqueue(new TextEncoder().encode("data: " + data + "\n\n"));
            } else if (part.type === "tool-call" && part.toolName === "updateNodeWeight") {
              const data = JSON.stringify({ type: "tool", name: "updateNodeWeight", args: part.input });
              controller.enqueue(new TextEncoder().encode("data: " + data + "\n\n"));
            } else if (part.type === "error") {
              const data = JSON.stringify({ type: "error", message: String((part as any).error) });
              controller.enqueue(new TextEncoder().encode("data: " + data + "\n\n"));
            }
          }
          controller.close();
        } catch (err) {
          const data = JSON.stringify({ type: "error", message: String(err) });
          controller.enqueue(new TextEncoder().encode("data: " + data + "\n\n"));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (error) {
    console.error("coach API error:", error);
    return new Response(String(error), { status: 500 });
  }
}

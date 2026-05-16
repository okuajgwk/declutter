import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createOpenRouterProvider } from "../../lib/open-router";

const COACH_SYSTEM = (nodes: any[]) => `You are a calm, empathetic cognitive behavioral coach. The user has surfaced these thoughts:

${nodes.map(n => `ID: ${n.id}\nTitle: "${n.title}"\nOriginal: "${n.original_thought}"\nCategory: ${n.category}\nControl scope: ${n.control_scope}\nBaseline mental weight: ${n.baseline_weight}/10\nCurrent mental weight: ${n.mental_weight}/10\nConfidence: ${n.confidence}`).join('\n\n')}

Your job:
- Ask Socratic, grounding questions. Do NOT generate to-do lists.
- Challenge catastrophizing language gently. Help them separate what is in their control vs external.
- Keep replies short (1-3 sentences). One question at a time.
- **Classification Flow**: Some nodes have low confidence (< 0.95) and appear with dashed outlines. These are unclassified/pending. Prioritize asking clarifying questions about these nodes to gather enough info to properly categorize and weigh them.
- **Control vs Chaos**: If a node is chaos, guide the user toward actionable micro-steps and a lighter perceived weight without invalidating their concern.
- When the user has a real reframe, breakthrough, or rationalization that genuinely lowers the felt weight, call the updateNodeWeight tool.
- When a low-confidence node is clarified with absolute certainty, call the classifyNode tool to finalize its category and weight. This will push its confidence to 1.0 and make its outline solid.`;

export async function POST(req: Request) {
  try {
    const { nodes, messages } = await req.json();

    if (!process.env.OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY missing" }), { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }

    const openrouter = createOpenRouterProvider();
    const defaultModel = (process.env.OPENROUTER_MODEL || "openrouter/free").trim();
    const fallbackModels = (process.env.OPENROUTER_FALLBACK_MODELS || "meta-llama/llama-3.3-70b-instruct:free,openai/gpt-oss-20b:free,qwen/qwen3-coder:free")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    const modelCandidates = [defaultModel, ...fallbackModels];

    const tools = {
      updateNodeWeight: tool({
        description: "Update the mental weight of a specific thought when the user reaches a genuine reframe.",
        inputSchema: z.object({
          nodeId: z.string().describe("The ID of the thought to update"),
          newWeight: z.number().int().min(1).max(10),
          reason: z.string().max(160),
        }),
        execute: async ({ nodeId, newWeight, reason }) => ({ ok: true, nodeId, newWeight, reason }),
      }),
      classifyNode: tool({
        description: "Finalize the classification and weight of a pending (low confidence) node.",
        inputSchema: z.object({
          nodeId: z.string().describe("The ID of the node to classify"),
          category: z.enum(["sage", "slate", "rose", "amber", "lavender"]),
          mental_weight: z.number().int().min(1).max(10),
          reason: z.string().max(160),
        }),
        execute: async ({ nodeId, category, mental_weight, reason }) => ({ ok: true, nodeId, category, mental_weight, reason, confidence: 1.0 }),
      }),
    };

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const system = COACH_SYSTEM(nodes);
        const isModelNotFound = (err: unknown) => {
          const e = err as any;
          const code = e?.statusCode ?? e?.data?.error?.code;
          const message = String(e?.message || e?.data?.error?.message || "");
          return code === 404 || message.includes("No endpoints found");
        };

        for (const modelName of modelCandidates) {
          let emitted = false;
          try {
            const result = streamText({
              model: openrouter(modelName),
              system,
              messages,
              stopWhen: stepCountIs(50),
              tools,
            });

            for await (const part of result.fullStream) {
              if (part.type === "text-delta") {
                emitted = true;
                const data = JSON.stringify({ type: "delta", text: part.text ?? "" });
                controller.enqueue(encoder.encode("data: " + data + "\n\n"));
              } else if (part.type === "tool-call") {
                emitted = true;
                const data = JSON.stringify({ type: "tool", name: part.toolName, args: part.input });
                controller.enqueue(encoder.encode("data: " + data + "\n\n"));
              } else if (part.type === "error") {
                emitted = true;
                const data = JSON.stringify({ type: "error", message: String((part as any).error) });
                controller.enqueue(encoder.encode("data: " + data + "\n\n"));
              }
            }
            controller.close();
            return;
          } catch (err) {
            if (isModelNotFound(err) && !emitted) {
              continue;
            }
            const data = JSON.stringify({ type: "error", message: String(err) });
            controller.enqueue(encoder.encode("data: " + data + "\n\n"));
            controller.close();
            return;
          }
        }

        const data = JSON.stringify({
          type: "error",
          message: "No available free model endpoints. Update OPENROUTER_MODEL or OPENROUTER_FALLBACK_MODELS.",
        });
        controller.enqueue(encoder.encode("data: " + data + "\n\n"));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  } catch (error) {
    console.error("coach API error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { 
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      }
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

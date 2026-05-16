import { generateText, Output } from "ai";
import { z } from "zod";
import { createOpenRouterProvider, hasOpenRouterApiKey } from "../../lib/open-router";

const CategoryEnum = z.enum(["sage", "slate", "rose", "amber", "lavender"]);

const ControlScopeEnum = z.enum(["control", "influence", "chaos"]);

const NodeSchema = z.object({
  title: z.string().min(1).max(60),
  original_thought: z.string().min(1).max(500),
  category: CategoryEnum,
  mental_weight: z.number().int().min(1).max(10),
  baseline_weight: z.number().int().min(1).max(10),
  control_scope: ControlScopeEnum,
});

const SiftSchema = z.object({
  nodes: z.array(NodeSchema).min(0).max(20),
});

const SIFT_SYSTEM = `You are a calm cognitive coach helping someone unload mental clutter.
Read the user's brain dump and extract distinct "cognitive nodes" — separate worries, tasks, feelings, decisions.

**Control Scope Rules:**
- control: directly actionable by the user right now.
- influence: can shape but not fully control.
- chaos: external macro forces beyond control (economy, AI/robotics trends, other people).

**Output Schema Rules:**
- title: 2-4 word label
- original_thought: short snippet from their text (≤120 chars)
- category: sage=errands/personal-life-tasks, slate=work, rose=internal-feelings/anxiety, amber=relationships/social, lavender=ideas/decisions/unclear
- mental_weight: 1-10 integer.
- baseline_weight: the raw initial weight before any demotion or deflation.
- control_scope: one of control, influence, chaos.

Return only the structured nodes. Do not invent thoughts not present in the text.`;

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    
    if (!hasOpenRouterApiKey()) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY missing or empty" }), { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }

    const openrouter = createOpenRouterProvider();
    const model = openrouter((process.env.OPENROUTER_MODEL || "openrouter/free").trim());

    const { experimental_output } = await generateText({
      model,
      system: SIFT_SYSTEM,
      prompt: text,
      experimental_output: Output.object({ schema: SiftSchema }),
    });

    return Response.json(experimental_output, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      }
    });
  } catch (error) {
    console.error("sift API error:", error);
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

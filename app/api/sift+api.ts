import { generateText, Output } from "ai";
import { z } from "zod";
import { createOpenRouterProvider } from "../../lib/open-router";

const CategoryEnum = z.enum(["sage", "slate", "rose", "amber", "lavender"]);

const ControlScopeEnum = z.enum(["control", "influence", "chaos"]);

const NodeSchema = z.object({
  title: z.string().min(1).max(60),
  original_thought: z.string().min(1).max(500),
  category: CategoryEnum,
  mental_weight: z.number().int().min(1).max(10),
  baseline_weight: z.number().int().min(1).max(10),
  confidence: z.number().min(0).max(1),
  control_scope: ControlScopeEnum,
  clarifying_questions: z.array(z.string()).optional(),
});

const SiftSchema = z.object({
  nodes: z.array(NodeSchema).min(0).max(20),
});

const SIFT_SYSTEM = `You are a calm cognitive coach helping someone unload mental clutter.
Read the user's brain dump and extract distinct "cognitive nodes" — separate worries, tasks, feelings, decisions.
For each node, you must determine a confidence score based on how explicit, clear, and unambiguous the user's thought is.

**High Confidence Flow (>= 0.95):**
- If the user explicitly states the task/feeling and its weight or impact clearly, assign a confidence score between 0.95 and 1.0.
- For these nodes, the 'clarifying_questions' field should be empty or omitted.

**Low Confidence Flow (< 0.95):**
- If the thought is vague, ambiguous, or lacks context (e.g., "that thing," "I feel weird"), assign a confidence score between 0.5 and 0.8.
- For these nodes, you MUST generate 1-2 specific, open-ended Socratic questions to help the user clarify the thought.
- Return these questions in the 'clarifying_questions' array. The questions should not be yes/no questions.

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
- confidence: 0.0-1.0 float.
- control_scope: one of control, influence, chaos.
- clarifying_questions: An array of strings containing questions, ONLY for low-confidence nodes.

Return only the structured nodes. Do not invent thoughts not present in the text.`;

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    
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

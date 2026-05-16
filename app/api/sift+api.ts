import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "../../lib/ai-gateway";

const CategoryEnum = z.enum(["sage", "slate", "rose", "amber", "lavender"]);

const NodeSchema = z.object({
  title: z.string().min(1).max(60),
  original_thought: z.string().min(1).max(500),
  category: CategoryEnum,
  mental_weight: z.number().int().min(1).max(10),
});

const SiftSchema = z.object({
  nodes: z.array(NodeSchema).min(0).max(20),
});

const SIFT_SYSTEM = `You are a calm cognitive coach helping someone unload mental clutter.
Read the user's brain dump and extract distinct "cognitive nodes" — separate worries, tasks, feelings, decisions.
For each node:
- title: 2-4 word label
- original_thought: short snippet from their text (≤120 chars)
- category: sage=errands/personal-life-tasks, slate=work, rose=internal-feelings/anxiety, amber=relationships/social, lavender=ideas/decisions/unclear
- mental_weight: 1-10 integer. Tone signals matter: catastrophizing, "always/never", urgency words, emotional intensity → high. Mundane tasks → low.
Return only the structured nodes. Do not invent thoughts not present in the text.`;

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return new Response("LOVABLE_API_KEY missing", { status: 500 });

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const { experimental_output } = await generateText({
      model,
      system: SIFT_SYSTEM,
      prompt: text,
      experimental_output: Output.object({ schema: SiftSchema }),
    });

    return Response.json(experimental_output);
  } catch (error) {
    console.error("sift API error:", error);
    return new Response(String(error), { status: 500 });
  }
}

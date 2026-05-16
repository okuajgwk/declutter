import type { Category } from "./categorize";

export type CognitiveNode = {
  id: string;
  title: string;
  original_thought: string;
  category: Category;
  mental_weight: number; // 1..10
  baseline_weight: number; // 1..10 (pre-demotion, pre-deflation)
  confidence: number; // 0.0 to 1.0
  control_scope: "control" | "influence" | "chaos";
  clarifying_questions?: string[];
  status: "active" | "pending" | "deflated" | "archived";
  // physics
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  createdAt: number;
};

export type CoachMessage = {
  role: "user" | "assistant";
  content: string;
};

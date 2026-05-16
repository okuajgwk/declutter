import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BubbleField } from "../../components/BubbleField";
import { ThoughtInput } from "../../components/ThoughtInput";
import { CoachSheet } from "../../components/CoachSheet";
import { categorize, type Category } from "../../lib/categorize";
import type { CognitiveNode } from "../../lib/types";
import { StatusBar } from "expo-status-bar";
import { MessageCircle } from "lucide-react-native";

function makeNode(partial: {
  title: string;
  original_thought: string;
  category: Category;
  mental_weight: number;
  baseline_weight: number;
  confidence: number;
  control_scope: "control" | "influence" | "chaos";
  clarifying_questions?: string[];
}): CognitiveNode {
  const spawnX = 200;
  const spawnY = 400;
  const targetX = 80 + Math.random() * 200;
  const targetY = 120 + Math.random() * 200;
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2),
    title: partial.title,
    original_thought: partial.original_thought,
    category: partial.category,
    mental_weight: partial.mental_weight,
    baseline_weight: partial.baseline_weight,
    confidence: partial.confidence,
    control_scope: partial.control_scope,
    clarifying_questions: partial.clarifying_questions,
    status: partial.confidence < 0.95 ? "pending" : "active",
    x: spawnX,
    y: spawnY,
    vx: (targetX - spawnX) * 0.012,
    vy: (targetY - spawnY) * 0.012,
    phase: Math.random() * Math.PI * 2,
    createdAt: performance.now(),
  };
}

export default function Index() {
  const [bubbles, setBubbles] = useState<CognitiveNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [aqScore, setAqScore] = useState(50);
  const [pivotCompleted, setPivotCompleted] = useState(false);

const addSingle = (text: string) => {
  const cat = categorize(text);
  const weight = 5;
  setBubbles((prev) => [
    ...prev,
    makeNode({
      title: text.length > 36 ? text.slice(0, 34) + "…" : text,
      original_thought: text,
      category: cat,
      mental_weight: weight,
      baseline_weight: weight,
      confidence: 1.0, // Manual entries are certain
      control_scope: "control",
    }),
  ]);
};

const addSifted = (nodes: { title: string; original_thought: string; category: Category; mental_weight: number; baseline_weight: number; confidence: number; control_scope: "control" | "influence" | "chaos"; clarifying_questions?: string[] }[]) => {
  setBubbles((prev) => [
    ...prev,
    ...nodes.map((n) => {
      const baseline = n.baseline_weight || n.mental_weight;
      const demotedWeight = n.control_scope === "chaos" ? Math.max(1, baseline - 2) : n.mental_weight;
      return makeNode({
        ...n,
        baseline_weight: baseline,
        mental_weight: demotedWeight,
      });
    }),
  ]);
};

  const updateWeight = (id: string, newWeight: number) => {
    setBubbles((prev) => prev.map((b) => {
      if (b.id !== id) return b;
      const nextWeight = Math.max(1, Math.min(10, newWeight));
      if (b.baseline_weight - nextWeight >= 2) {
        setAqScore((prevScore) => Math.min(100, prevScore + 1));
      }
      return { ...b, mental_weight: nextWeight };
    }));
  };

  const classifyNode = (id: string, category: Category, mental_weight: number, confidence: number) => {
    setBubbles((prev) => prev.map((b) => (
      b.id === id ? { ...b, category, mental_weight, confidence, status: confidence >= 0.95 ? "active" : b.status } : b
    )));
  };

  const toggleSelect = (node: CognitiveNode) => {
    setSelectedIds((prev) => 
      prev.includes(node.id) ? prev.filter(id => id !== node.id) : [...prev, node.id]
    );
  };

  const openCoach = () => setIsCoachOpen(true);
  
  const closeCoach = () => {
    setIsCoachOpen(false);
    setSelectedIds([]); // Optionally clear selection when closing coach
  };

  const selectedNodes = bubbles.filter(b => selectedIds.includes(b.id));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header} pointerEvents="none">
        <Text style={styles.headerTitle}>THE MENTAL LOAD MAP</Text>
        <View style={styles.aqBadge}>
          <Text style={styles.aqLabel}>AQ</Text>
          <Text style={styles.aqValue}>{aqScore}</Text>
        </View>
        {bubbles.length === 0 && (
          <Text style={styles.headerSubtitle}>
            Place a thought into the box below.{"\n"}Watch it leave your head.
          </Text>
        )}
      </View>

      <BubbleField
        bubbles={bubbles}
        setBubbles={setBubbles}
        bottomInset={140}
        selectedIds={selectedIds}
        onSelect={toggleSelect}
      />

      <ThoughtInput onSingleThought={addSingle} onSifted={addSifted} />

      <View style={styles.pivotContainer} pointerEvents="box-none">
        <Pressable
          style={[styles.pivotCard, pivotCompleted && styles.pivotCardDone]}
          onPress={() => {
            if (!pivotCompleted) {
              setPivotCompleted(true);
              setAqScore((prevScore) => Math.min(100, prevScore + 1));
            }
          }}
        >
          <Text style={styles.pivotTitle}>Daily micro-pivot</Text>
          <Text style={styles.pivotText}>Take a different route for one errand today.</Text>
          <Text style={styles.pivotAction}>{pivotCompleted ? "Completed" : "Tap to complete"}</Text>
        </Pressable>
      </View>

      {selectedIds.length > 0 && !isCoachOpen && (
        <View style={styles.floatingActionContainer} pointerEvents="box-none">
          <Pressable style={styles.discussButton} onPress={openCoach}>
            <MessageCircle color="#FFF" size={20} />
            <Text style={styles.discussButtonText}>
              Discuss {selectedIds.length} thought{selectedIds.length !== 1 ? 's' : ''}
            </Text>
          </Pressable>
        </View>
      )}

      {isCoachOpen && (
        <CoachSheet
          nodes={selectedNodes}
          onClose={closeCoach}
          onWeightChange={updateWeight}
          onClassify={classifyNode}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  aqBadge: {
    position: 'absolute',
    right: 24,
    top: -6,
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  aqLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  aqValue: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3.5,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  headerSubtitle: {
    marginTop: 120,
    fontSize: 15,
    lineHeight: 24,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 250,
  },
  floatingActionContainer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  discussButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  discussButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  }
  ,
  pivotContainer: {
    position: 'absolute',
    bottom: 190,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  pivotCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '88%',
    maxWidth: 420,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  pivotCardDone: {
    backgroundColor: '#ECFDF3',
    borderColor: '#A7F3D0',
  },
  pivotTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#6B7280',
  },
  pivotText: {
    fontSize: 14,
    color: '#111827',
  },
  pivotAction: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
});

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
    status: "active",
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

  const addSingle = (text: string) => {
    const cat = categorize(text);
    setBubbles((prev) => [
      ...prev,
      makeNode({
        title: text.length > 36 ? text.slice(0, 34) + "…" : text,
        original_thought: text,
        category: cat,
        mental_weight: 5,
      }),
    ]);
  };

  const addSifted = (nodes: { title: string; original_thought: string; category: Category; mental_weight: number }[]) => {
    setBubbles((prev) => [...prev, ...nodes.map((n) => makeNode(n))]);
  };

  const updateWeight = (id: string, newWeight: number) => {
    setBubbles((prev) => prev.map((b) => (b.id === id ? { ...b, mental_weight: newWeight } : b)));
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
});

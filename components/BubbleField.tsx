import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent, PanResponder } from "react-native";
import { CATEGORY_BG, CATEGORY_FG } from "../lib/categorize";
import type { CognitiveNode } from "../lib/types";

export function bubbleSize(weight: number): number {
  const w = Math.max(1, Math.min(10, weight));
  return 44 + w * 14;
}

const CONTROL_OPACITY = {
  control: 1,
  influence: 0.92,
  chaos: 0.82,
} as const;

const CALM_FG: Record<string, string> = {
  sage: "#5D9E9A",
  slate: "#6B7A90",
  rose: "#B77A8E",
  amber: "#B7945B",
  lavender: "#8B7BB5",
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
};

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixColor = (from: string, to: string, t: number) => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const mix = (start: number, end: number) => Math.round(start + (end - start) * t);
  return rgbToHex(mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b));
};

type Props = {
  bubbles: CognitiveNode[];
  setBubbles: React.Dispatch<React.SetStateAction<CognitiveNode[]>>;
  bottomInset: number;
  selectedIds: string[];
  onSelect: (node: CognitiveNode) => void;
};

export function BubbleField({ bubbles, setBubbles, bottomInset, selectedIds, onSelect }: Props) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const rafRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(performance.now());
  const dragState = useRef<Record<string, { startX: number, startY: number, curX: number, curY: number, isDragging: boolean }>>({});

  useEffect(() => {
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      
      if (layout.width === 0 || layout.height === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const w = layout.width;
      const h = layout.height - bottomInset;

      setBubbles((prev) => {
        const next = prev.map((b) => ({ ...b }));

        for (const b of next) {
          const drag = dragState.current[b.id];
          if (drag && drag.isDragging) {
            b.x = drag.curX;
            b.y = drag.curY;
            b.vx = 0;
            b.vy = 0;
            continue;
          }

          const r = bubbleSize(b.mental_weight) / 2;
          b.phase += dt * 0.3;
          b.vx += Math.sin(b.phase + b.x * 0.001) * 0.6 * dt;
          b.vy += Math.cos(b.phase * 0.8 + b.y * 0.001) * 0.6 * dt;
          b.vx *= 0.92;
          b.vy *= 0.92;
          const sp = Math.hypot(b.vx, b.vy);
          const maxSp = 0.35;
          if (sp > maxSp) { b.vx = (b.vx / sp) * maxSp; b.vy = (b.vy / sp) * maxSp; }
          b.x += b.vx * dt * 30;
          b.y += b.vy * dt * 30;

          if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx) * 0.4; }
          if (b.x > w - r) { b.x = w - r; b.vx = -Math.abs(b.vx) * 0.4; }
          if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy) * 0.4; }
          if (b.y > h - r) { b.y = h - r; b.vy = -Math.abs(b.vy) * 0.4; }
        }

        // Collision logic
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i], c = next[j];
            const dragA = dragState.current[a.id]?.isDragging;
            const dragC = dragState.current[c.id]?.isDragging;
            
            const dx = c.x - a.x;
            const dy = c.y - a.y;
            const dist = Math.hypot(dx, dy) || 0.001;
            const min = bubbleSize(a.mental_weight) / 2 + bubbleSize(c.mental_weight) / 2 + 6;
            
            if (dist < min) {
              const overlap = (min - dist) / 2;
              const nx = dx / dist;
              const ny = dy / dist;
              
              if (!dragA) {
                a.x -= nx * overlap;
                a.y -= ny * overlap;
                a.vx -= nx * 0.3;
                a.vy -= ny * 0.3;
              }
              if (!dragC) {
                c.x += nx * overlap;
                c.y += ny * overlap;
                c.vx += nx * 0.3;
                c.vy += ny * 0.3;
              }
            }
          }
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [setBubbles, bottomInset, layout.width, layout.height]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  return (
    <View style={styles.container} onLayout={onLayout} accessible accessibilityLabel="Cognitive load map">
      {bubbles.map((b) => (
        <BubbleItem 
          key={b.id}
          node={b}
          isSelected={selectedIds.includes(b.id)}
          onSelect={onSelect}
          dragState={dragState}
        />
      ))}
    </View>
  );
}

function BubbleItem({ 
  node, 
  isSelected, 
  onSelect, 
  dragState 
}: { 
  node: CognitiveNode; 
  isSelected: boolean; 
  onSelect: (n: CognitiveNode) => void;
  dragState: React.MutableRefObject<Record<string, { startX: number, startY: number, curX: number, curY: number, isDragging: boolean }>>
}) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 5,
      onPanResponderGrant: () => {
        dragState.current[node.id] = {
          startX: node.x,
          startY: node.y,
          curX: node.x,
          curY: node.y,
          isDragging: true
        };
      },
      onPanResponderMove: (_, g) => {
        const state = dragState.current[node.id];
        if (state) {
          state.curX = state.startX + g.dx;
          state.curY = state.startY + g.dy;
        }
      },
      onPanResponderRelease: (_, g) => {
        if (dragState.current[node.id]) {
          dragState.current[node.id].isDragging = false;
        }
        // If it was a small movement, consider it a tap
        if (Math.hypot(g.dx, g.dy) < 5) {
          onSelect(node);
        }
      },
      onPanResponderTerminate: () => {
        if (dragState.current[node.id]) {
          dragState.current[node.id].isDragging = false;
        }
      }
    })
  ).current;

  const size = bubbleSize(node.mental_weight);
  const heavy = node.mental_weight >= 7;
  const calmTarget = CALM_FG[node.category] || CATEGORY_FG[node.category];
  const deflationProgress = clamp(1 - node.mental_weight / Math.max(1, node.baseline_weight));
  const borderTone = mixColor(CATEGORY_FG[node.category], calmTarget, deflationProgress);

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.bubbleBase,
        {
          left: node.x - size / 2,
          top: node.y - size / 2,
          width: size,
          height: size,
          backgroundColor: isSelected ? 'rgba(0,0,0,0.05)' : 'transparent',
          borderColor: borderTone,
          borderWidth: 2,
          borderStyle: 'solid',
          opacity: CONTROL_OPACITY[node.control_scope],
           shadowColor: heavy ? borderTone : "#000",
          shadowOffset: { width: 0, height: heavy ? 6 : 4 },
          shadowOpacity: heavy ? 0.3 : 0.15,
          shadowRadius: heavy ? 12 : 8,
          elevation: heavy ? 10 : 5,
        }
      ]}
    >
      {isSelected && (
          <View style={[
            styles.selectionRing,
            {
              width: size + 10,
              height: size + 10,
              borderRadius: (size + 10) / 2,
              borderColor: borderTone,
              shadowColor: borderTone,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 6,
            }
          ]} />
      )}
      <View style={styles.innerBubble}>
        <Text 
          numberOfLines={4} 
          style={[
            styles.bubbleText, 
            { 
              color: borderTone,
              fontSize: Math.max(10, Math.min(14, size / 11)),
              fontWeight: isSelected ? '700' : '500'
            }
          ]}
        >
          {node.title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bubbleBase: {
    position: 'absolute',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerBubble: {
    width: '100%',
    height: '100%',
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionRing: {
    position: 'absolute',
    borderWidth: 2,
    opacity: 0.5,
  },
  bubbleText: {
    textAlign: 'center',
  }
});

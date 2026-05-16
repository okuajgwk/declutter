import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from "react-native";
import { CATEGORY_BG, CATEGORY_FG } from "../lib/categorize";
import type { CognitiveNode } from "../lib/types";

export function bubbleSize(weight: number): number {
  const w = Math.max(1, Math.min(10, weight));
  return 44 + w * 14;
}

type Props = {
  bubbles: CognitiveNode[];
  setBubbles: React.Dispatch<React.SetStateAction<CognitiveNode[]>>;
  bottomInset: number;
  onSelect?: (node: CognitiveNode) => void;
};

export function BubbleField({ bubbles, setBubbles, bottomInset, onSelect }: Props) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const rafRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(performance.now());

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

        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i], c = next[j];
            const dx = c.x - a.x;
            const dy = c.y - a.y;
            const dist = Math.hypot(dx, dy) || 0.001;
            const min = bubbleSize(a.mental_weight) / 2 + bubbleSize(c.mental_weight) / 2 + 6;
            if (dist < min) {
              const overlap = (min - dist) / 2;
              const nx = dx / dist;
              const ny = dy / dist;
              a.x -= nx * overlap;
              a.y -= ny * overlap;
              c.x += nx * overlap;
              c.y += ny * overlap;
              const push = 0.3;
              a.vx -= nx * push;
              a.vy -= ny * push;
              c.vx += nx * push;
              c.vy += ny * push;
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
      {bubbles.map((b) => {
        const size = bubbleSize(b.mental_weight);
        const heavy = b.mental_weight >= 7;
        
        return (
          <Pressable
            key={b.id}
            onPress={() => onSelect?.(b)}
            style={[
              styles.bubbleBase,
              {
                left: b.x - size / 2,
                top: b.y - size / 2,
                width: size,
                height: size,
                backgroundColor: CATEGORY_BG[b.category],
                borderColor: CATEGORY_FG[b.category],
                borderWidth: 1.5,
                borderStyle: 'dashed',
                shadowColor: heavy ? CATEGORY_FG[b.category] : "#000",
                shadowOffset: { width: 0, height: heavy ? 6 : 4 },
                shadowOpacity: heavy ? 0.3 : 0.15,
                shadowRadius: heavy ? 12 : 8,
                elevation: heavy ? 10 : 5,
              }
            ]}
            accessibilityLabel={`Open coach for ${b.title}`}
          >
            <View style={styles.innerBubble}>
              <Text 
                numberOfLines={4} 
                style={[
                  styles.bubbleText, 
                  { 
                    color: CATEGORY_FG[b.category],
                    fontSize: Math.max(10, Math.min(14, size / 11))
                  }
                ]}
              >
                {b.title}
              </Text>
            </View>
          </Pressable>
        );
      })}
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
  bubbleText: {
    textAlign: 'center',
    fontWeight: '500',
  }
});

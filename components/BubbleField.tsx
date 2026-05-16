import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent, PanResponder, Animated } from "react-native";
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

const PROCESSING_FG = "#5B6B7A";
const PROCESSING_BG = "rgba(91, 107, 122, 0.12)";

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
  onPop?: (id: string) => void;
};

export function BubbleField({ bubbles, setBubbles, bottomInset, selectedIds, onSelect, onPop }: Props) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const rafRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(performance.now());
  const dragState = useRef<Record<string, { startX: number, startY: number, curX: number, curY: number, isDragging: boolean }>>({});
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

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
          const isSel = selectedIdsRef.current.includes(b.id);
          const drag = dragState.current[b.id];
          if (drag && drag.isDragging) {
            b.x = drag.curX;
            b.y = drag.curY;
            b.vx = 0;
            b.vy = 0;
            continue;
          }
          if (isSel) {
            b.vx = 0;
            b.vy = 0;
            continue;
          }

          const r = bubbleSize(b.mental_weight) / 2;
          b.phase += dt * 0.5;
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
            const dragA = dragState.current[a.id]?.isDragging || selectedIdsRef.current.includes(a.id);
            const dragC = dragState.current[c.id]?.isDragging || selectedIdsRef.current.includes(c.id);
            
            const dx = c.x - a.x;
            const dy = c.y - a.y;
            const dist = Math.hypot(dx, dy);
            const minDist = bubbleSize(a.mental_weight)/2 + bubbleSize(c.mental_weight)/2 + 4; // added 4px padding
            
            if (dist < minDist && dist > 0) {
              const overlap = minDist - dist;
              const bounce = 0.5;
              
              const nx = dx / dist;
              const ny = dy / dist;
              
              if (!dragA && !dragC) {
                a.x -= nx * overlap * 0.5;
                a.y -= ny * overlap * 0.5;
                c.x += nx * overlap * 0.5;
                c.y += ny * overlap * 0.5;
                
                a.vx -= nx * bounce;
                a.vy -= ny * bounce;
                c.vx += nx * bounce;
                c.vy += ny * bounce;
              } else if (!dragA && dragC) {
                a.x -= nx * overlap;
                a.y -= ny * overlap;
                a.vx -= nx * bounce * 2;
                a.vy -= ny * bounce * 2;
              } else if (dragA && !dragC) {
                c.x += nx * overlap;
                c.y += ny * overlap;
                c.vx += nx * bounce * 2;
                c.vy += ny * bounce * 2;
              } else {
                a.x -= nx * overlap * 0.5;
                a.y -= ny * overlap * 0.5;
                c.x += nx * overlap * 0.5;
                c.y += ny * overlap * 0.5;
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
          onPop={onPop}
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
  onPop,
  dragState 
}: { 
  node: CognitiveNode; 
  isSelected: boolean; 
  onSelect: (n: CognitiveNode) => void;
  onPop?: (id: string) => void;
  dragState: React.MutableRefObject<Record<string, { startX: number, startY: number, curX: number, curY: number, isDragging: boolean }>>
}) {
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  const isSelectedRef = useRef(isSelected);
  isSelectedRef.current = isSelected;
  const nodeRef = useRef(node);
  nodeRef.current = node;

  const clearPopTimer = () => {
    if (popTimer.current) {
      clearTimeout(popTimer.current);
      popTimer.current = null;
      if (popAnimRef.current) {
        popAnimRef.current.stop();
        popAnimRef.current = null;
      }
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
      shakeAnim.setValue(0);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 5,
      onPanResponderGrant: () => {
        if (!isSelectedRef.current) {
          dragState.current[node.id] = {
            startX: nodeRef.current.x,
            startY: nodeRef.current.y,
            curX: nodeRef.current.x,
            curY: nodeRef.current.y,
            isDragging: true
          };
        }
        if (onPop) {
          popAnimRef.current = Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 1.5,
              duration: 3000,
              useNativeDriver: true,
            }),
            Animated.loop(
              Animated.sequence([
                Animated.timing(shakeAnim, { toValue: 1, duration: 40, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
              ])
            )
          ]);
          popAnimRef.current.start();

          popTimer.current = setTimeout(() => {
            onPop(node.id);
          }, 3000);
        }
      },
      onPanResponderMove: (_, g) => {
        if (Math.hypot(g.dx, g.dy) > 10) {
          clearPopTimer();
        }
        if (!isSelectedRef.current) {
          const state = dragState.current[node.id];
          if (state) {
            state.curX = state.startX + g.dx;
            state.curY = state.startY + g.dy;
          }
        }
      },
      onPanResponderRelease: (_, g) => {
        clearPopTimer();
        if (dragState.current[node.id]) {
          dragState.current[node.id].isDragging = false;
        }
        // If it was a small movement, consider it a tap
        if (Math.hypot(g.dx, g.dy) < 5) {
          onSelect(nodeRef.current);
        }
      },
      onPanResponderTerminate: () => {
        clearPopTimer();
        if (dragState.current[node.id]) {
          dragState.current[node.id].isDragging = false;
        }
      }
    })
  ).current;

  useEffect(() => {
    return clearPopTimer;
  }, []);

  const size = bubbleSize(node.mental_weight);
  const heavy = node.mental_weight >= 7;
  const calmTarget = CALM_FG[node.category] || CATEGORY_FG[node.category];
  const deflationProgress = clamp(1 - node.mental_weight / Math.max(1, node.baseline_weight));
  const baseTone = mixColor(CATEGORY_FG[node.category], calmTarget, deflationProgress);
  const isProcessing = node.processing_state === "pending";
  const isFailed = node.processing_state === "failed";
  const borderTone = isProcessing ? PROCESSING_FG : baseTone;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.bubbleBase,
        {
          left: node.x - size / 2,
          top: node.y - size / 2,
          width: size,
          height: size,
          backgroundColor: isProcessing ? PROCESSING_BG : (isSelected ? 'rgba(0,0,0,0.05)' : 'transparent'),
          borderColor: borderTone,
          borderWidth: 2,
          borderStyle: 'solid',
          opacity: isFailed ? 0.7 : CONTROL_OPACITY[node.control_scope],
          shadowColor: heavy ? borderTone : "#000",
          shadowOffset: { width: 0, height: heavy ? 6 : 4 },
          shadowOpacity: heavy ? 0.3 : 0.15,
          shadowRadius: heavy ? 12 : 8,
          elevation: heavy ? 10 : 5,
          transform: [
            { scale: scaleAnim },
            { 
              translateX: shakeAnim.interpolate({ 
                inputRange: [-1, 1], 
                outputRange: [-3, 3] 
              }) 
            }
          ]
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
    </Animated.View>
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

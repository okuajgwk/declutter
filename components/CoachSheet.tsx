import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Modal, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Send, Sparkles } from "lucide-react-native";
import EventSource from "react-native-sse";
import { CATEGORY_BG, CATEGORY_FG } from "../lib/categorize";
import type { CognitiveNode, CoachMessage } from "../lib/types";

type Props = {
  nodes: CognitiveNode[];
  onClose: () => void;
  onWeightChange: (id: string, newWeight: number) => void;
};

export function CoachSheet({ nodes, onClose, onWeightChange }: Props) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (nodes.length > 0) {
      const titles = nodes.map(n => `"${n.title}"`).join(", ");
      setMessages([
        {
          role: "assistant",
          content: `Let's sit with ${nodes.length === 1 ? 'this thought' : 'these thoughts'} for a moment: ${titles}. What about ${nodes.length === 1 ? 'it is' : 'them is'} taking up the most space right now?`,
        },
      ]);
      setInput("");
    } else {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    }
  }, [nodes]);

  const send = async () => {
    const t = input.trim();
    if (!t || streaming || nodes.length === 0) return;
    
    const next: CoachMessage[] = [...messages, { role: "user", content: t }, { role: "assistant", content: "" }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
    
    const es = new EventSource(`${apiUrl}/api/coach`, {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({
        nodes: nodes.map(node => ({
          id: node.id,
          title: node.title,
          original_thought: node.original_thought,
          mental_weight: node.mental_weight,
          category: node.category,
        })),
        messages: next.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    
    esRef.current = es;

    es.addEventListener("message", (event) => {
      if (!event.data) return;
      try {
        const chunk = JSON.parse(event.data);
        if (chunk.type === "delta") {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, content: last.content + chunk.text };
            return copy;
          });
        } else if (chunk.type === "tool" && chunk.name === "updateNodeWeight") {
          const w = chunk.args.newWeight;
          const id = chunk.args.nodeId;
          onWeightChange(id, w);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `✦ Weight reframed to ${w}/10 — ${chunk.args.reason}` },
          ]);
        } else if (chunk.type === "error") {
          console.error("Coach error:", chunk.message);
          es.close();
          setStreaming(false);
        }
      } catch (e) {
        // ignore JSON parse error on chunk
      }
    });

    es.addEventListener("error", (err) => {
      console.error("SSE Error:", err);
      es.close();
      setStreaming(false);
    });

    es.addEventListener("close", () => {
      setStreaming(false);
    });
  };

  if (nodes.length === 0) return null;

  return (
    <Modal visible={nodes.length > 0} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView 
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheetContent}>
          <View style={styles.header}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesScroll} contentContainerStyle={styles.badgesContainer}>
              {nodes.map(node => (
                <View key={node.id} style={[styles.weightBadge, { 
                  backgroundColor: CATEGORY_BG[node.category],
                  borderColor: CATEGORY_FG[node.category],
                }]}>
                  <Text style={[styles.weightText, { color: CATEGORY_FG[node.category] }]}>
                    {node.mental_weight}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {nodes.length === 1 ? nodes[0].title : `${nodes.length} Thoughts Selected`}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {nodes.length === 1 ? nodes[0].original_thought : nodes.map(n => n.title).join(", ")}
              </Text>
            </View>
          </View>

          <ScrollView 
            ref={scrollRef} 
            style={styles.chatArea} 
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((m, i) => (
              <View 
                key={i} 
                style={[
                  styles.messageBubble, 
                  m.role === "user" ? styles.messageUser : styles.messageAssistant
                ]}
              >
                {m.content ? (
                  <Text style={[styles.messageText, m.role === "user" ? styles.messageTextUser : styles.messageTextAssistant]}>
                    {m.content}
                  </Text>
                ) : (
                  streaming && i === messages.length - 1 && (
                    <ActivityIndicator size="small" color="#6B7280" />
                  )
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.inputArea}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Reply to the coach…"
              placeholderTextColor="#9CA3AF"
              editable={!streaming}
              onSubmitEditing={send}
            />
            <Pressable 
              style={[styles.sendButton, (streaming || !input.trim()) && styles.sendButtonDisabled]} 
              onPress={send}
              disabled={streaming || !input.trim()}
            >
              {streaming ? <Sparkles size={18} color="#FFF" /> : <Send size={18} color="#FFF" />}
            </Pressable>
          </View>
          <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFF' }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  badgesScroll: {
    flexGrow: 0,
    maxWidth: 120,
  },
  badgesContainer: {
    gap: 4,
    paddingRight: 8,
  },
  weightBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weightText: {
    fontWeight: '600',
    fontSize: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  chatContent: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  messageUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#111827',
    borderBottomRightRadius: 4,
  },
  messageAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextUser: {
    color: '#FFF',
  },
  messageTextAssistant: {
    color: '#111827',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  }
});

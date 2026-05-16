import React, { useState } from "react";
import { View, TextInput, Pressable, StyleSheet, Text, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { Sparkles, X, ArrowUp } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Category } from "../lib/categorize";

type SiftedNode = {
  title: string;
  original_thought: string;
  category: Category;
  mental_weight: number;
};

type Props = {
  onSingleThought: (text: string) => void;
  onSifted: (nodes: SiftedNode[]) => void;
};

export function ThoughtInput({ onSingleThought, onSifted }: Props) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<"quick" | "dump">("quick");
  const [loading, setLoading] = useState(false);

  const handleQuick = () => {
    const t = value.trim();
    if (!t) return;
    onSingleThought(t);
    setValue("");
  };

  const handleDump = async () => {
    const t = value.trim();
    if (!t) return;
    setLoading(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
      
      const res = await fetch(`${apiUrl}/api/sift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (!res.ok) throw new Error("Failed to sift");
      const result = await res.json();
      
      if (!result?.nodes?.length) {
        Alert.alert("Nothing to surface", "Try writing a bit more about what's on your mind.");
      } else {
        onSifted(result.nodes as SiftedNode[]);
        setValue("");
        setMode("quick");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Couldn't process that right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.wrapper}
      pointerEvents="box-none"
    >
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,1)']}
        style={styles.gradient}
        pointerEvents="none"
      />
      <View style={styles.container}>
        {mode === "quick" ? (
          <View style={styles.quickRow}>
            <TextInput
              style={styles.quickInput}
              value={value}
              onChangeText={setValue}
              placeholder="What's on your mind?"
              placeholderTextColor="#9CA3AF"
              onSubmitEditing={handleQuick}
              returnKeyType="send"
            />
            <Pressable
              style={styles.sparkleButton}
              onPress={() => setMode("dump")}
            >
              <Sparkles size={20} color="#6B7280" />
            </Pressable>
            <Pressable
              style={[styles.sparkleButton, !value.trim() && { opacity: 0.5 }]}
              onPress={handleQuick}
              disabled={!value.trim()}
            >
              <ArrowUp size={20} color="#6B7280" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.dumpContainer}>
            <View style={styles.dumpHeader}>
              <Text style={styles.dumpTitle}>BRAIN DUMP</Text>
              <Pressable onPress={() => setMode("quick")}>
                <X size={18} color="#6B7280" />
              </Pressable>
            </View>
            <TextInput
              style={styles.dumpInput}
              value={value}
              onChangeText={setValue}
              placeholder="Pour it out — every worry, task, feeling. AI will sort and weigh them."
              placeholderTextColor="#9CA3AF"
              multiline
              autoFocus
              textAlignVertical="top"
            />
            <View style={styles.dumpFooter}>
              <Text style={styles.charCount}>{value.length}/4000</Text>
              <Pressable
                style={[styles.submitButton, (!value.trim() || loading) && styles.submitButtonDisabled]}
                onPress={handleDump}
                disabled={loading || !value.trim()}
              >
                {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Sparkles size={16} color="#FFF" />}
                <Text style={styles.submitText}>{loading ? "Sifting…" : "Process map"}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    height: 200,
    bottom: 0,
    top: undefined,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 500,
  },
  quickInput: {
    flex: 1,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingHorizontal: 20,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sparkleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dumpContainer: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  dumpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dumpTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    color: '#6B7280',
  },
  dumpInput: {
    height: 120,
    fontSize: 16,
    lineHeight: 24,
    color: '#111827',
  },
  dumpFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  }
});

import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type QuestionType = "text" | "phone" | "textarea" | "boolean" | "line_items";

type Question = {
  id: string;
  key: string;
  label: string;
  type: QuestionType;
  required: boolean;
  order: number;
  config: Record<string, any>;
};

type Form = { questions: Question[] };

type Product = {
  id: string;
  name: string;
  default_mrp: number;
  default_selling_price: number;
  stock: number;
  active: boolean;
};

type LineItem = {
  product: string;
  quantity: string;
  mrp: string | number;
  selling_price: string | number;
  can_fulfill: boolean;
};

const GREEN = "#16A34A";
const GREEN_DARK = "#0B3D1A";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function http<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function requiredMissing(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const sortedQuestions = useMemo(() => {
    const q = form?.questions ? [...form.questions] : [];
    q.sort((a, b) => a.order - b.order);
    return q;
  }, [form]);

  async function loadForm() {
    setLoading(true);
    try {
      const [f, prods] = await Promise.all([
        http<Form>("/api/form", token),
        http<Product[]>("/api/products", token),
      ]);
      setForm(f);
      setProducts(prods);

      const init: Record<string, any> = {};
      for (const q of f.questions) {
        if (q.type === "boolean") init[q.key] = false;
        if (q.type === "line_items")
          init[q.key] = [
            { product: "", quantity: "", mrp: "", selling_price: "", can_fulfill: false } satisfies LineItem,
          ];
      }
      setAnswers((prev) => ({ ...init, ...prev }));
    } catch (e: any) {
      Alert.alert("Failed to load form", e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const t = await SecureStore.getItemAsync("khettak_token");
        if (t) setToken(t);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (token) loadForm();
  }, [token]);

  function setAnswer(key: string, value: any) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function validateLocally(): string | null {
    if (!form) return "Form not loaded";
    for (const q of form.questions) {
      const value = answers[q.key];
      if (q.required && requiredMissing(value)) {
        return `Please fill: ${q.label}`;
      }
      if (q.type === "line_items" && Array.isArray(value)) {
        for (const item of value as LineItem[]) {
          if (!(item.product ?? "").toString().trim() || !(item.quantity ?? "").toString().trim())
            return `Please complete all items in: ${q.label}`;
          const m = Number(item.mrp);
          const s = Number(item.selling_price);
          if (Number.isNaN(m) || m < 0 || Number.isNaN(s) || s < 0)
            return `Each item needs valid MRP and selling price`;
        }
      }
    }
    return null;
  }

  async function submit() {
    const err = validateLocally();
    if (err) {
      Alert.alert("Validation", err);
      return;
    }
    setSubmitting(true);
    try {
      await http("/api/submissions", token, { method: "POST", body: JSON.stringify({ answers }) });
      Alert.alert("Saved", "Customer data saved successfully.");
      setAnswers({});
      await loadForm();
    } catch (e: any) {
      Alert.alert("Submit failed", e?.message || "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function login() {
    setLoggingIn(true);
    try {
      const res = await http<{ access_token: string; token_type: string }>(
        "/api/auth/login",
        null,
        {
          method: "POST",
          body: JSON.stringify({ username: username.trim(), password }),
        },
      );
      await SecureStore.setItemAsync("khettak_token", res.access_token);
      setToken(res.access_token);
      setPassword("");
    } catch (e: any) {
      Alert.alert("Login failed", e?.message || "Invalid credentials");
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    await SecureStore.deleteItemAsync("khettak_token");
    setToken(null);
    setForm(null);
    setAnswers({});
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={[styles.header, { justifyContent: "center" }]}>
          <Text style={styles.h1}>KhetTak</Text>
        </View>
        <View style={[styles.body, { padding: 16 }]}>
          <View style={styles.card}>
            <Text style={styles.muted}>Starting…</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>KhetTak</Text>
            <Text style={styles.h2}>Staff login</Text>
          </View>
        </View>

        <View style={[styles.body, { padding: 16, gap: 12 }]}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Login</Text>
            <Text style={styles.cardSubtitle}>API: {apiBaseUrl}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Username</Text>
            <TextInput value={username} onChangeText={setUsername} style={styles.input} autoCapitalize="none" />
            <View style={{ height: 10 }} />
            <Text style={styles.label}>Password</Text>
            <TextInput value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />
            <View style={{ height: 12 }} />
            <TouchableOpacity
              style={styles.submit}
              onPress={login}
              disabled={loggingIn || !username.trim() || !password}
            >
              <Text style={styles.submitText}>{loggingIn ? "Signing in…" : "Sign in"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>KhetTak</Text>
          <Text style={styles.h2}>Customer data capture</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadForm} disabled={loading || submitting}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshBtn} onPress={logout} disabled={loading || submitting}>
            <Text style={styles.refreshText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.body}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Form</Text>
            <Text style={styles.cardSubtitle}>API: {apiBaseUrl}</Text>
          </View>

          {loading ? (
            <View style={styles.card}>
              <Text style={styles.muted}>Loading…</Text>
            </View>
          ) : null}

          {!loading &&
            sortedQuestions.map((q) => (
              <View key={q.id} style={styles.card}>
                <Text style={styles.label}>
                  {q.label} {q.required ? <Text style={styles.req}>*</Text> : null}
                </Text>

                {q.type === "text" || q.type === "phone" ? (
                  <TextInput
                    value={(answers[q.key] ?? "") as string}
                    onChangeText={(t) => setAnswer(q.key, t)}
                    placeholder={q.config?.placeholder || ""}
                    keyboardType={q.type === "phone" ? "phone-pad" : "default"}
                    style={styles.input}
                  />
                ) : null}

                {q.type === "textarea" ? (
                  <TextInput
                    value={(answers[q.key] ?? "") as string}
                    onChangeText={(t) => setAnswer(q.key, t)}
                    placeholder={q.config?.placeholder || ""}
                    multiline
                    style={[styles.input, styles.textarea]}
                  />
                ) : null}

                {q.type === "boolean" ? (
                  <View style={styles.booleanRow}>
                    <Text style={styles.muted}>
                      {(answers[q.key] ? q.config?.true_label : q.config?.false_label) || ""}
                    </Text>
                    <Switch value={!!answers[q.key]} onValueChange={(v) => setAnswer(q.key, v)} />
                  </View>
                ) : null}

                {q.type === "line_items" ? (
                  <View style={{ gap: 10 }}>
                    <FlatList
                      data={(answers[q.key] ?? []) as LineItem[]}
                      keyExtractor={(_, idx) => `${q.key}-${idx}`}
                      scrollEnabled={false}
                      renderItem={({ item, index }) => (
                        <View style={{ gap: 8 }}>
                          <Text style={styles.muted}>Product (with stock)</Text>
                          <View style={styles.row}>
                            {products.map((opt) => (
                              <TouchableOpacity
                                key={opt.id}
                                style={[
                                  styles.smallBtn,
                                  (item.product ?? "") === opt.name && { backgroundColor: "#DCFCE7", borderColor: GREEN },
                                ]}
                                onPress={() => {
                                  const next = [...((answers[q.key] ?? []) as LineItem[])];
                                  next[index] = {
                                    ...next[index],
                                    product: opt.name,
                                    mrp: opt.default_mrp,
                                    selling_price: opt.default_selling_price,
                                  };
                                  setAnswer(q.key, next);
                                }}
                                >
                                <Text style={styles.smallBtnText}>
                                  {opt.name}
                                  {typeof opt.stock === "number" ? ` (stock: ${opt.stock})` : ""}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <View style={styles.lineItemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.muted}>Qty</Text>
                              <TextInput
                                value={(item.quantity ?? "").toString()}
                                onChangeText={(t) => {
                                  const next = [...((answers[q.key] ?? []) as LineItem[])];
                                  next[index] = { ...next[index], quantity: t };
                                  setAnswer(q.key, next);
                                }}
                                placeholder="e.g. 5"
                                keyboardType="numeric"
                                style={styles.input}
                              />
                            </View>
                            <View style={{ width: 90 }}>
                              <Text style={styles.muted}>MRP</Text>
                              <TextInput
                                value={(item.mrp ?? "").toString()}
                                onChangeText={(t) => {
                                  const next = [...((answers[q.key] ?? []) as LineItem[])];
                                  next[index] = { ...next[index], mrp: t === "" ? "" : Number(t) };
                                  setAnswer(q.key, next);
                                }}
                                placeholder="0"
                                keyboardType="decimal-pad"
                                style={styles.input}
                              />
                            </View>
                            <View style={{ width: 90 }}>
                              <Text style={styles.muted}>Sell price</Text>
                              <TextInput
                                value={(item.selling_price ?? "").toString()}
                                onChangeText={(t) => {
                                  const next = [...((answers[q.key] ?? []) as LineItem[])];
                                  next[index] = { ...next[index], selling_price: t === "" ? "" : Number(t) };
                                  setAnswer(q.key, next);
                                }}
                                placeholder="0"
                                keyboardType="decimal-pad"
                                style={styles.input}
                              />
                            </View>
                          </View>
                          <View style={styles.booleanRow}>
                            <Text style={styles.muted}>Fulfill this item?</Text>
                            <Switch
                              value={!!item.can_fulfill}
                              onValueChange={(v) => {
                                const next = [...((answers[q.key] ?? []) as LineItem[])];
                                next[index] = { ...next[index], can_fulfill: v };
                                setAnswer(q.key, next);
                              }}
                            />
                          </View>
                        </View>
                      )}
                    />

                    <View style={styles.row}>
                      <TouchableOpacity
                        style={[styles.smallBtn, { borderColor: "#D7E7DC" }]}
                        onPress={() => {
                          const next = [
                            ...((answers[q.key] ?? []) as LineItem[]),
                            { product: "", quantity: "", mrp: "", selling_price: "", can_fulfill: false },
                          ];
                          setAnswer(q.key, next);
                        }}
                      >
                        <Text style={styles.smallBtnText}>+ Add product</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallBtn, { borderColor: "#FECACA", backgroundColor: "#FFF1F2" }]}
                        onPress={() => {
                          const cur = (answers[q.key] ?? []) as LineItem[];
                          if (cur.length <= 1) return;
                          setAnswer(q.key, cur.slice(0, -1));
                        }}
                      >
                        <Text style={[styles.smallBtnText, { color: "#9F1239" }]}>Remove last</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            ))}

          <TouchableOpacity style={styles.submit} onPress={submit} disabled={submitting || loading}>
            <Text style={styles.submitText}>{submitting ? "Saving…" : "Save customer details"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN_DARK },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: GREEN_DARK,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  h1: { color: "white", fontSize: 20, fontWeight: "800", letterSpacing: 0.4 },
  h2: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  refreshBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  refreshText: { color: "white", fontWeight: "700" },
  body: { flex: 1, backgroundColor: "#F4FBF6" },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7E7DC",
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  cardTitle: { fontWeight: "800", color: GREEN_DARK, fontSize: 14 },
  cardSubtitle: { marginTop: 4, color: "#475569", fontSize: 12 },
  label: { fontWeight: "800", marginBottom: 8, color: "#0F172A" },
  req: { color: "#B91C1C" },
  input: {
    borderWidth: 1,
    borderColor: "#D7E7DC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "white",
  },
  textarea: { minHeight: 90, textAlignVertical: "top" },
  muted: { color: "#475569", fontSize: 12, fontWeight: "600" },
  booleanRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lineItemRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "white",
  },
  smallBtnText: { fontWeight: "800", color: GREEN_DARK },
  submit: {
    marginTop: 6,
    backgroundColor: GREEN,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0F5A26",
  },
  submitText: { color: "white", fontWeight: "900", letterSpacing: 0.2 },
});


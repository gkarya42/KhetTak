import React, { useEffect, useMemo, useState } from "react";
import { api, type Question } from "../api";

type LineItem = { name: string; quantity: string; can_fulfill: boolean };

function requiredMissing(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function CaptureScreen() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => (a.order - b.order) || a.created_at.localeCompare(b.created_at)),
    [questions],
  );

  async function load() {
    setLoading(true);
    setError(null);
    setOkMsg(null);
    try {
      const f = await api.getForm();
      setQuestions(f.questions);
      const init: Record<string, any> = {};
      for (const q of f.questions) {
        if (q.type === "boolean") init[q.key] = false;
        if (q.type === "line_items") init[q.key] = [{ name: "", quantity: "", can_fulfill: false } satisfies LineItem];
      }
      setAnswers((prev) => ({ ...init, ...prev }));
    } catch (e: any) {
      setError(e?.message || "Failed to load form");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setAnswer(key: string, value: any) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    for (const q of questions) {
      const value = answers[q.key];
      if (q.required && requiredMissing(value)) return `Please fill: ${q.label}`;
      if (q.type === "line_items" && Array.isArray(value)) {
        for (const item of value as LineItem[]) {
          if (!item.name?.trim() || !item.quantity?.trim()) return `Please complete all items in: ${q.label}`;
        }
      }
    }
    return null;
  }

  async function submit() {
    const v = validate();
    if (v) {
      setOkMsg(null);
      setError(v);
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      await api.submitAnswers(answers);
      setOkMsg("Saved successfully.");
      setAnswers({});
      await load();
    } catch (e: any) {
      setError(e?.message || "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo" />
          <div className="title">
            <h1>Customer Entry</h1>
            <p>This is the homepage. Fill and submit customer details.</p>
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={load} disabled={loading || saving}>
            Refresh form
          </button>
          <button className="btn btnPrimary" onClick={submit} disabled={loading || saving}>
            {saving ? "Saving…" : "Submit"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="card error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}
      {okMsg ? (
        <div className="card" style={{ marginBottom: 12, borderColor: "#86efac", background: "#f0fdf4" }}>
          <b style={{ color: "#0b3d1a" }}>{okMsg}</b>
        </div>
      ) : null}

      {loading ? (
        <div className="card">
          <div className="muted">Loading…</div>
        </div>
      ) : null}

      <div className="card">
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Details</div>
        <div className="muted" style={{ marginBottom: 14 }}>
          Fields with <span className="error">*</span> are mandatory.
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {sortedQuestions.map((q) => (
            <div key={q.id}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                {q.label} {q.required ? <span className="error">*</span> : null}
              </div>

              {q.type === "text" || q.type === "phone" ? (
                <input
                  className="input"
                  value={(answers[q.key] ?? "") as string}
                  onChange={(e) => setAnswer(q.key, e.target.value)}
                  placeholder={(q.config as any)?.placeholder || ""}
                />
              ) : null}

              {q.type === "textarea" ? (
                <textarea
                  className="textarea"
                  value={(answers[q.key] ?? "") as string}
                  onChange={(e) => setAnswer(q.key, e.target.value)}
                  placeholder={(q.config as any)?.placeholder || ""}
                />
              ) : null}

              {q.type === "boolean" ? (
                <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={!!answers[q.key]}
                    onChange={(e) => setAnswer(q.key, e.target.checked)}
                  />
                  <span className="muted">
                    {(answers[q.key] ? (q.config as any)?.true_label : (q.config as any)?.false_label) || ""}
                  </span>
                </label>
              ) : null}

              {q.type === "line_items" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {(((answers[q.key] ?? []) as LineItem[]) || []).map((item, idx) => (
                    <div key={idx} className="row">
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div className="muted" style={{ marginBottom: 6 }}>
                          Product name
                        </div>
                        <input
                          className="input"
                          value={item.name}
                          onChange={(e) => {
                            const cur = [...(((answers[q.key] ?? []) as LineItem[]) || [])];
                            cur[idx] = { ...cur[idx], name: e.target.value };
                            setAnswer(q.key, cur);
                          }}
                          placeholder="e.g. Wheat seed"
                        />
                      </div>
                      <div style={{ width: 180, minWidth: 160 }}>
                        <div className="muted" style={{ marginBottom: 6 }}>
                          Quantity
                        </div>
                        <input
                          className="input"
                          value={item.quantity}
                          onChange={(e) => {
                            const cur = [...(((answers[q.key] ?? []) as LineItem[]) || [])];
                            cur[idx] = { ...cur[idx], quantity: e.target.value };
                            setAnswer(q.key, cur);
                          }}
                          placeholder="e.g. 5 kg"
                        />
                      </div>
                      <div style={{ minWidth: 170 }}>
                        <div className="muted" style={{ marginBottom: 6 }}>
                          Fulfill?
                        </div>
                        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={!!item.can_fulfill}
                            onChange={(e) => {
                              const cur = [...(((answers[q.key] ?? []) as LineItem[]) || [])];
                              cur[idx] = { ...cur[idx], can_fulfill: e.target.checked };
                              setAnswer(q.key, cur);
                            }}
                          />
                          <span className="muted">{item.can_fulfill ? "Yes" : "No"}</span>
                        </label>
                      </div>
                    </div>
                  ))}

                  <div className="row">
                    <button
                      className="btn"
                      type="button"
                      onClick={() =>
                        setAnswer(q.key, [
                          ...(((answers[q.key] ?? []) as LineItem[]) || []),
                          { name: "", quantity: "", can_fulfill: false },
                        ])
                      }
                    >
                      + Add product
                    </button>
                    <button
                      className="btn btnDanger"
                      type="button"
                      onClick={() => {
                        const cur = (((answers[q.key] ?? []) as LineItem[]) || []);
                        if (cur.length <= 1) return;
                        setAnswer(q.key, cur.slice(0, -1));
                      }}
                    >
                      Remove last
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


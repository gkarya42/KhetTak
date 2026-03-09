import React, { useEffect, useMemo, useState } from "react";
import { api, type Question, type QuestionType } from "../api";

type Draft = {
  key: string;
  label: string;
  type: QuestionType;
  required: boolean;
  order: number;
  configJson: string;
};

function defaultDraft(): Draft {
  return { key: "", label: "", type: "text", required: false, order: 100, configJson: "{}" };
}

function safeJsonParse(text: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Invalid JSON" };
  }
}

export function QuestionsScreen() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(defaultDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => (a.order - b.order) || a.created_at.localeCompare(b.created_at)),
    [questions],
  );

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listQuestions();
      setQuestions(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startCreate() {
    setEditingId(null);
    setDraft(defaultDraft());
  }

  function startEdit(q: Question) {
    setEditingId(q.id);
    setDraft({
      key: q.key,
      label: q.label,
      type: q.type,
      required: q.required,
      order: q.order,
      configJson: JSON.stringify(q.config ?? {}, null, 2),
    });
  }

  async function save() {
    const parsed = safeJsonParse(draft.configJson);
    if (!parsed.ok) {
      setError(`Config JSON error: ${parsed.error}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await api.updateQuestion(editingId, {
          label: draft.label,
          type: draft.type,
          required: draft.required,
          order: draft.order,
          config: parsed.value,
        } as any);
        setQuestions((prev) => prev.map((q) => (q.id === editingId ? updated : q)));
      } else {
        const created = await api.createQuestion({
          key: draft.key,
          label: draft.label,
          type: draft.type,
          required: draft.required,
          order: draft.order,
          config: parsed.value,
        } as any);
        setQuestions((prev) => [...prev, created]);
        startCreate();
      }
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this question?")) return;
    setSaving(true);
    setError(null);
    try {
      await api.deleteQuestion(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      if (editingId === id) startCreate();
    } catch (e: any) {
      setError(e?.message || "Delete failed");
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
            <h1>Questions</h1>
            <p>Changes reflect in the capture form immediately.</p>
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={refresh} disabled={loading || saving}>
            Refresh
          </button>
          <button className="btn btnPrimary" onClick={startCreate} disabled={saving}>
            New question
          </button>
        </div>
      </div>

      {error ? (
        <div className="card error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div className="grid">
        <div className="card">
          <div className="row" style={{ alignItems: "baseline", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 800 }}>All questions</div>
              <div className="muted">These are what the Android/web capture screens render.</div>
            </div>
            {loading ? <div className="muted">Loading…</div> : <div className="muted">{questions.length} total</div>}
          </div>
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Key</th>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedQuestions.map((q) => (
                  <tr key={q.id}>
                    <td>{q.order}</td>
                    <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                      {q.key}
                    </td>
                    <td>{q.label}</td>
                    <td>{q.type}</td>
                    <td>{q.required ? "Yes" : "No"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn" onClick={() => startEdit(q)} disabled={saving}>
                        Edit
                      </button>{" "}
                      <button className="btn btnDanger" onClick={() => remove(q.id)} disabled={saving}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {sortedQuestions.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No questions yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{editingId ? "Edit question" : "Create question"}</div>
          <div className="muted" style={{ marginBottom: 12 }}>
            Tip: for the product list use type <b>line_items</b> and keep <b>config</b> as JSON.
          </div>

          {!editingId ? (
            <div style={{ marginBottom: 10 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                Key (unique, stable)
              </div>
              <input
                className="input"
                value={draft.key}
                onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
                placeholder="e.g. customer_name"
              />
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                Key
              </div>
              <div className="pill" style={{ background: "#fff", fontFamily: "ui-monospace, monospace" }}>
                {draft.key}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              Label
            </div>
            <input
              className="input"
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="Question shown to the staff"
            />
          </div>

          <div className="row" style={{ marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 170 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                Type
              </div>
              <select
                className="select"
                value={draft.type}
                onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as QuestionType }))}
              >
                <option value="text">text</option>
                <option value="phone">phone</option>
                <option value="textarea">textarea</option>
                <option value="boolean">boolean</option>
                <option value="line_items">line_items</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 170 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                Order
              </div>
              <input
                className="input"
                value={draft.order}
                onChange={(e) => setDraft((d) => ({ ...d, order: Number(e.target.value || 0) }))}
                type="number"
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                checked={draft.required}
                onChange={(e) => setDraft((d) => ({ ...d, required: e.target.checked }))}
                type="checkbox"
              />
              <span style={{ fontWeight: 700 }}>Required</span>
            </label>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              Config (JSON)
            </div>
            <textarea
              className="textarea"
              value={draft.configJson}
              onChange={(e) => setDraft((d) => ({ ...d, configJson: e.target.value }))}
            />
          </div>

          <div className="row">
            <button
              className="btn btnPrimary"
              onClick={save}
              disabled={saving || loading || (!draft.label.trim() || (!editingId && !draft.key.trim()))}
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Create question"}
            </button>
            <button className="btn" onClick={startCreate} disabled={saving}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


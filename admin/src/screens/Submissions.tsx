import React, { useEffect, useMemo, useState } from "react";
import { api, type Submission } from "../api";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SubmissionsScreen() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => items, [items]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listSubmissions();
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo" />
          <div className="title">
            <h1>All Entries</h1>
            <p>Every customer submission stored in Postgres.</p>
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="card error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div className="card">
        <div className="row" style={{ alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Submissions</div>
            <div className="muted">Newest first.</div>
          </div>
          <div className="pill">{rows.length} total</div>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Village</th>
                <th>Products</th>
                <th>Fulfill?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const a = s.answers || {};
                const products = Array.isArray(a.products) ? a.products : [];
                const productsText = products
                  .map((p: any) => {
                    const name = `${p?.name || ""}`.trim();
                    const qty = p?.quantity ? ` (${p.quantity})` : "";
                    const fulfill = p?.can_fulfill === true ? "Yes" : p?.can_fulfill === false ? "No" : "";
                    const f = fulfill ? ` - Fulfill: ${fulfill}` : "";
                    return `${name}${qty}${f}`.trim();
                  })
                  .filter(Boolean)
                  .join(", ");
                return (
                  <tr key={s.id}>
                    <td>{formatDate(s.created_at)}</td>
                    <td>{a.customer_name || ""}</td>
                    <td>{a.customer_phone || ""}</td>
                    <td>{a.customer_village || ""}</td>
                    <td style={{ maxWidth: 360 }}>{productsText}</td>
                    <td className="muted">Per product</td>
                  </tr>
                );
              })}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No entries yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


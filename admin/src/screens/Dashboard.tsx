import React, { useEffect, useState } from "react";
import { api } from "../api";

type Analytics = {
  total_submissions: number;
  fulfill_yes: number;
  fulfill_no: number;
  top_villages: { village: string; count: number }[];
  top_products: { product: string; count: number }[];
  product_fulfillment_qty: { product: string; fulfilled_qty: number; unfulfilled_qty: number; total_qty: number }[];
  orders_with_totals: { order_id: string; total_amount: number }[];
};

export function DashboardScreen() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const a = (await api.analytics()) as Analytics;
      setData(a);
    } catch (e: any) {
      setError(e?.message || "Failed to load analytics");
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
            <h1>Analytics Dashboard</h1>
            <p>Quick insights from collected customer data.</p>
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

      {loading ? (
        <div className="card">
          <div className="muted">Loading…</div>
        </div>
      ) : null}

      {data ? (
        <div className="grid">
          <div className="card">
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Summary</div>
            <div className="row">
              <span className="pill">Total entries: {data.total_submissions}</span>
              <span className="pill">Fulfill: Yes {data.fulfill_yes}</span>
              <span className="pill">Fulfill: No {data.fulfill_no}</span>
            </div>
            <div className="muted" style={{ marginTop: 10 }}>
              This dashboard is intentionally simple (no heavy chart libraries) to keep v1 fast and stable.
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Top villages</div>
            <table className="table">
              <thead>
                <tr>
                  <th>Village</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {data.top_villages.map((v) => (
                  <tr key={v.village}>
                    <td>{v.village}</td>
                    <td>{v.count}</td>
                  </tr>
                ))}
                {data.top_villages.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="muted">
                      Not enough data yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Orders (Order ID &amp; total amount)</div>
            <table className="table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Total amount</th>
                </tr>
              </thead>
              <tbody>
                {(data.orders_with_totals || []).map((o) => (
                  <tr key={o.order_id}>
                    <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{o.order_id}</td>
                    <td style={{ fontWeight: 700 }}>{o.total_amount}</td>
                  </tr>
                ))}
                {(!data.orders_with_totals || data.orders_with_totals.length === 0) ? (
                  <tr>
                    <td colSpan={2} className="muted">No orders yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Product quantities (fulfilled vs not fulfilled)</div>
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Fulfilled qty</th>
                  <th>Not fulfilled qty</th>
                  <th>Total qty</th>
                </tr>
              </thead>
              <tbody>
                {data.product_fulfillment_qty.map((p) => (
                  <tr key={p.product}>
                    <td>{p.product}</td>
                    <td>{p.fulfilled_qty}</td>
                    <td>{p.unfulfilled_qty}</td>
                    <td style={{ fontWeight: 900 }}>{p.total_qty}</td>
                  </tr>
                ))}
                {data.product_fulfillment_qty.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Not enough data yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}


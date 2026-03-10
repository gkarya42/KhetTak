import React, { useEffect, useMemo, useState } from "react";
import { api, type Product, type Submission } from "../api";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SubmissionsScreen() {
  const [items, setItems] = useState<Submission[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => items, [items]);

  const productStockByName = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      map[p.name] = p.stock;
    }
    return map;
  }, [products]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [subs, prods] = await Promise.all([api.listSubmissions(), api.listProductsAdmin()]);
      setItems(subs);
      setProducts(prods);
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
                <th>Order ID</th>
                <th>Time</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>State</th>
                <th>District</th>
                <th>City</th>
                <th>Village</th>
                <th>Products (with stock)</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const a = s.answers || {};
                const productsArr = Array.isArray(a.products) ? a.products : [];
                const productsText = productsArr
                  .map((p: any) => {
                    const name = `${p?.product || p?.name || ""}`.trim();
                    const requested = p?.quantity != null ? ` req:${p.quantity}` : "";
                    const fulfilled = p?.fulfilled_quantity != null ? ` full:${p.fulfilled_quantity}` : "";
                    const unfulfilled = p?.unfulfilled_quantity != null ? ` unfull:${p.unfulfilled_quantity}` : "";
                    const status = p?.fulfillment_status ? ` status:${p.fulfillment_status}` : "";
                    const mrp = p?.mrp != null ? ` MRP:${p.mrp}` : "";
                    const sp = p?.selling_price != null ? ` SP:${p.selling_price}` : "";
                    const stock =
                      name && Object.prototype.hasOwnProperty.call(productStockByName, name)
                        ? ` stock:${productStockByName[name]}`
                        : "";
                    return `${name}${requested}${fulfilled}${unfulfilled}${status}${mrp}${sp}${stock}`.trim();
                  })
                  .filter(Boolean)
                  .join("; ");
                return (
                  <tr key={s.id}>
                    <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{s.order_id || "—"}</td>
                    <td>{formatDate(s.created_at)}</td>
                    <td>{a.customer_name || ""}</td>
                    <td>{a.customer_phone || ""}</td>
                    <td>{a.state || ""}</td>
                    <td>{a.district || ""}</td>
                    <td>{a.city || ""}</td>
                    <td>{a.village || ""}</td>
                    <td style={{ maxWidth: 360 }}>{productsText}</td>
                    <td style={{ fontWeight: 700 }}>{s.total_amount != null ? s.total_amount : "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={10} className="muted">
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


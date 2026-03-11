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
  const [statusFilter, setStatusFilter] = useState<"all" | "In Progress" | "Completed" | "Failed">("all");
  const [sortField, setSortField] = useState<keyof Submission | "customer_name" | "total_amount">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    let data = [...items];
    if (statusFilter !== "all") {
      data = data.filter((s) => s.status === statusFilter);
    }
    data.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "created_at") {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
      if (sortField === "order_id") {
        return ((a.order_id || "").localeCompare(b.order_id || "")) * dir;
      }
      if (sortField === "total_amount") {
        const av = a.total_amount ?? 0;
        const bv = b.total_amount ?? 0;
        return (av - bv) * dir;
      }
      if (sortField === "customer_name") {
        const an = (a.answers?.customer_name || "") as string;
        const bn = (b.answers?.customer_name || "") as string;
        return an.localeCompare(bn) * dir;
      }
      return 0;
    });
    return data;
  }, [items, statusFilter, sortField, sortDir]);

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

  function toggleSort(field: typeof sortField) {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevField;
      }
      setSortDir("asc");
      return field;
    });
  }

  async function updateStatus(id: string, status: "In Progress" | "Completed" | "Failed") {
    try {
      const updated = await api.updateSubmissionStatus(id, status);
      setItems((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (e: any) {
      setError(e?.message || "Failed to update status");
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo" />
          <div className="title">
            <h1>All Orders</h1>
            <p>Every order captured from KhetTak app.</p>
          </div>
        </div>
        <div className="row">
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ maxWidth: 180 }}
          >
            <option value="all">All statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Failed">Failed</option>
          </select>
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
            <div style={{ fontWeight: 900 }}>Orders</div>
            <div className="muted">Filter by status, sort on any column.</div>
          </div>
          <div className="pill">{rows.length} total</div>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th onClick={() => toggleSort("order_id")} style={{ cursor: "pointer" }}>
                  Order ID
                </th>
                <th onClick={() => toggleSort("created_at")} style={{ cursor: "pointer" }}>
                  Time
                </th>
                <th onClick={() => toggleSort("customer_name")} style={{ cursor: "pointer" }}>
                  Customer
                </th>
                <th>Phone</th>
                <th>State</th>
                <th>District</th>
                <th>City</th>
                <th>Village</th>
                <th>Products (with stock)</th>
                <th onClick={() => toggleSort("total_amount")} style={{ cursor: "pointer" }}>
                  Total
                </th>
                <th>Order status</th>
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
                    <td>
                      <select
                        className="input"
                        value={s.status}
                        onChange={(e) =>
                          updateStatus(s.id, e.target.value as "In Progress" | "Completed" | "Failed")
                        }
                      >
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Failed">Failed</option>
                      </select>
                    </td>
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


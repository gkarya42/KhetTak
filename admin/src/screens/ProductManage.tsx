import React, { useEffect, useState } from "react";
import { api, type Product } from "../api";

export function ProductsScreen() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [defaultMrp, setDefaultMrp] = useState("");
  const [defaultSellingPrice, setDefaultSellingPrice] = useState("");
  const [order, setOrder] = useState("");
  const [active, setActive] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listProductsAdmin();
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(p: Product) {
    setEditingId(p.id);
    setName(p.name);
    setDefaultMrp(String(p.default_mrp));
    setDefaultSellingPrice(String(p.default_selling_price));
    setOrder(String(p.order));
    setActive(p.active);
    setShowNew(false);
  }

  function startNew() {
    setEditingId(null);
    setName("");
    setDefaultMrp("");
    setDefaultSellingPrice("");
    setOrder("");
    setActive(true);
    setShowNew(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setShowNew(false);
  }

  async function save() {
    const mrp = parseFloat(defaultMrp);
    const sp = parseFloat(defaultSellingPrice);
    const ord = parseInt(order, 10);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (Number.isNaN(mrp) || mrp < 0 || Number.isNaN(sp) || sp < 0) {
      setError("MRP and selling price must be non-negative numbers");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api.updateProduct(editingId, {
          name: name.trim(),
          default_mrp: mrp,
          default_selling_price: sp,
          order: Number.isNaN(ord) ? 0 : ord,
          active,
        });
        setItems((prev) => prev.map((p) => (p.id === editingId ? { ...p, name: name.trim(), default_mrp: mrp, default_selling_price: sp, order: Number.isNaN(ord) ? 0 : ord, active } : p)));
        cancelEdit();
      } else {
        const created = await api.createProduct({
          name: name.trim(),
          default_mrp: mrp,
          default_selling_price: sp,
          order: Number.isNaN(ord) ? 0 : ord,
          active,
        });
        setItems((prev) => [...prev, created]);
        cancelEdit();
      }
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this product? It will no longer appear in the capture form.")) return;
    setSaving(true);
    setError(null);
    try {
      await api.deleteProduct(id);
      setItems((prev) => prev.filter((p) => p.id !== id));
      if (editingId === id) cancelEdit();
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
            <h1>Products</h1>
            <p>Manage products for the capture form (name, default MRP, selling price).</p>
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={load} disabled={loading || saving}>
            Refresh
          </button>
          <button className="btn btnPrimary" onClick={startNew} disabled={saving}>
            Add product
          </button>
        </div>
      </div>

      {error ? (
        <div className="card error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {(showNew || editingId) ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>{editingId ? "Edit product" : "New product"}</div>
          <div style={{ display: "grid", gap: 10, maxWidth: 400 }}>
            <div>
              <div className="muted" style={{ marginBottom: 4 }}>Name</div>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wheat Seeds" />
            </div>
            <div className="row">
              <div>
                <div className="muted" style={{ marginBottom: 4 }}>Default MRP</div>
                <input className="input" type="number" min={0} step={0.01} value={defaultMrp} onChange={(e) => setDefaultMrp(e.target.value)} />
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 4 }}>Default selling price</div>
                <input className="input" type="number" min={0} step={0.01} value={defaultSellingPrice} onChange={(e) => setDefaultSellingPrice(e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div>
                <div className="muted" style={{ marginBottom: 4 }}>Order</div>
                <input className="input" type="number" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="0" />
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <span className="muted">Active (show in form)</span>
              </label>
            </div>
            <div className="row">
              <button className="btn btnPrimary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button className="btn" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="row" style={{ alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 900 }}>All products</div>
            <div className="muted">These appear in the Customer Entry dropdown. Default MRP/selling price pre-fill when selected.</div>
          </div>
          <div className="pill">{items.length} total</div>
        </div>
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Name</th>
                <th>Default MRP</th>
                <th>Default selling price</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>{p.order}</td>
                  <td style={{ fontWeight: 700 }}>{p.name}</td>
                  <td>{p.default_mrp}</td>
                  <td>{p.default_selling_price}</td>
                  <td>{p.active ? "Yes" : "No"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn" onClick={() => startEdit(p)} disabled={saving}>
                      Edit
                    </button>{" "}
                    <button className="btn btnDanger" onClick={() => remove(p.id)} disabled={saving}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No products yet. Add one to show in the capture form.
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

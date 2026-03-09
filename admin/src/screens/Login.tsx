import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export function LoginScreen() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.login(username.trim(), password);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div className="card" style={{ width: "min(520px, 100%)" }}>
        <div className="brand" style={{ marginBottom: 12 }}>
          <div className="logo" />
          <div className="title">
            <h1>KhetTak</h1>
            <p>Login to capture & manage data</p>
          </div>
        </div>

        {error ? (
          <div className="card error" style={{ padding: 12, marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        <form onSubmit={submit} className="grid" style={{ gridTemplateColumns: "1fr", gap: 10 }}>
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Username
            </div>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Password
            </div>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btnPrimary" disabled={loading || !username.trim() || !password}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <div className="muted">
            API: <b>{import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}</b>
          </div>
        </form>
      </div>
    </div>
  );
}


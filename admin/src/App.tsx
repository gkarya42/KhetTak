import React, { useMemo } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api } from "./api";
import { CaptureScreen } from "./screens/Capture";
import { DashboardScreen } from "./screens/Dashboard";
import { LoginScreen } from "./screens/Login";
import { QuestionsScreen } from "./screens/Questions";
import { SubmissionsScreen } from "./screens/Submissions";

function Nav() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const active = useMemo(
    () => ({
      capture: path === "/" || path.startsWith("/capture"),
      submissions: path.startsWith("/submissions"),
      dashboard: path.startsWith("/dashboard"),
      questions: path.startsWith("/questions"),
    }),
    [path],
  );

  return (
    <div className="container" style={{ paddingBottom: 0 }}>
      <div className="header" style={{ marginBottom: 12 }}>
        <div className="brand">
          <div className="logo" />
          <div className="title">
            <h1>KhetTak</h1>
            <p>Capture + admin + analytics</p>
          </div>
        </div>
        <div className="row">
          <span className="pill">API: {import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}</span>
          <button
            className="btn"
            onClick={() => {
              api.logout();
              navigate("/login", { replace: true });
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 10, marginBottom: 12 }}>
        <div className="row">
          <Link className={`btn ${active.capture ? "btnPrimary" : ""}`} to="/">
            Customer Entry
          </Link>
          <Link className={`btn ${active.submissions ? "btnPrimary" : ""}`} to="/submissions">
            All Entries
          </Link>
          <Link className={`btn ${active.dashboard ? "btnPrimary" : ""}`} to="/dashboard">
            Dashboard
          </Link>
          <Link className={`btn ${active.questions ? "btnPrimary" : ""}`} to="/questions">
            Questions
          </Link>
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!api.hasToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <Nav />
            <CaptureScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/submissions"
        element={
          <RequireAuth>
            <Nav />
            <SubmissionsScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Nav />
            <DashboardScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/questions"
        element={
          <RequireAuth>
            <Nav />
            <QuestionsScreen />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

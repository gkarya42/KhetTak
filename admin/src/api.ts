export type QuestionType = "text" | "phone" | "textarea" | "boolean" | "line_items";

export type Question = {
  id: string;
  key: string;
  label: string;
  type: QuestionType;
  required: boolean;
  order: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at?: string | null;
};

function resolveBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.trim();

  // Dev: UI runs on :5173, API on :8000
  if (typeof window !== "undefined" && window.location.port === "5173") {
    return "http://localhost:8000";
  }

  // Deployed: UI is served by the same FastAPI host
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:8000";
}

const baseUrl = resolveBaseUrl();

function getToken(): string | null {
  return localStorage.getItem("khettak_token");
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export type Submission = {
  id: string;
  order_id?: string | null;
  answers: Record<string, any>;
  created_at: string;
  total_amount?: number | null;
};

export const api = {
  async login(username: string, password: string): Promise<string> {
    const data = await http<{ access_token: string; token_type: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      headers: {},
    });
    localStorage.setItem("khettak_token", data.access_token);
    return data.access_token;
  },
  logout() {
    localStorage.removeItem("khettak_token");
  },
  hasToken(): boolean {
    return !!getToken();
  },
  listQuestions(): Promise<Question[]> {
    return http<Question[]>("/api/admin/questions");
  },
  createQuestion(q: Omit<Question, "id" | "created_at" | "updated_at">): Promise<Question> {
    return http<Question>("/api/admin/questions", { method: "POST", body: JSON.stringify(q) });
  },
  updateQuestion(id: string, patch: Partial<Question>): Promise<Question> {
    return http<Question>(`/api/admin/questions/${id}`, { method: "PUT", body: JSON.stringify(patch) });
  },
  deleteQuestion(id: string): Promise<{ deleted: boolean }> {
    return http<{ deleted: boolean }>(`/api/admin/questions/${id}`, { method: "DELETE" });
  },
  getForm(): Promise<{ questions: Question[] }> {
    return http<{ questions: Question[] }>("/api/form");
  },
  submitAnswers(answers: Record<string, any>): Promise<Submission> {
    return http<Submission>("/api/submissions", { method: "POST", body: JSON.stringify({ answers }) });
  },
  listSubmissions(): Promise<Submission[]> {
    return http<Submission[]>("/api/admin/submissions");
  },
  analytics(): Promise<any> {
    return http<any>("/api/admin/analytics");
  },
};


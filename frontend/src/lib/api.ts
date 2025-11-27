type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  token?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function smartFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail ?? "요청에 실패했습니다.");
  }

  return (await response.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    smartFetch<{ access_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: { email, password }
    }),
  register: (params: { email: string; password: string; full_name?: string }) =>
    smartFetch("/auth/register", { method: "POST", body: params }),
  quickAddContent: (params: {
    title: string;
    url?: string;
    raw_content?: string;
    content_type: string;
    is_public: boolean;
    token: string;
  }) =>
    smartFetch("/contents/", {
      method: "POST",
      token: params.token,
      body: {
        title: params.title,
        url: params.url,
        raw_content: params.raw_content,
        content_type: params.content_type,
        is_public: params.is_public
      }
    })
};





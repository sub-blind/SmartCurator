import type { ChatAnswer, ContentItem, SemanticSearchResponse } from "@/types/content";

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown> | FormData;
  token?: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "");

async function smartFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
      cache: "no-store"
    });
  } catch (err) {
    throw new Error("백엔드에 연결할 수 없습니다. 네트워크 연결과 API 서버(Cloudflare Tunnel) 상태를 확인해 주세요.");
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    if (response.status === 401) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("smartcurator_token");
        window.localStorage.removeItem("smartcurator_email");
        window.dispatchEvent(new Event("auth:expired"));
      }
      throw new Error("로그인 세션(30분)이 만료되었습니다. 다시 로그인해 주세요.");
    }
    if (response.status >= 502 && response.status <= 504) {
      throw new Error("백엔드에 연결할 수 없습니다. API 서버와 Cloudflare Tunnel 상태를 확인해 주세요.");
    }
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
  logout: (token: string) =>
    smartFetch<{ message: string; user_id: number }>("/auth/logout", {
      method: "POST",
      token
    }),
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
    }),
  uploadContentFile: (params: {
    file: File;
    title?: string;
    is_public: boolean;
    token: string;
  }) => {
    const formData = new FormData();
    formData.append("file", params.file);
    if (params.title?.trim()) {
      formData.append("title", params.title.trim());
    }
    formData.append("is_public", String(params.is_public));
    return smartFetch<ContentItem>("/contents/upload", {
      method: "POST",
      token: params.token,
      body: formData
    });
  },
  getMyContents: (token: string) =>
    smartFetch<ContentItem[]>("/contents/my?skip=0&limit=50", {
      method: "GET",
      token
    }),
  deleteContent: (id: number, token: string) =>
    smartFetch<{ message: string }>(`/contents/${id}`, {
      method: "DELETE",
      token
    }),
  reprocessContent: (id: number, token: string) =>
    smartFetch<{ message: string }>(`/contents/${id}/reprocess`, {
      method: "POST",
      token
    }),
  semanticSearch: (
    query: string,
    token: string,
    options?: { limit?: number; score_threshold?: number },
  ) => {
    const limit = options?.limit ?? 6;
    const scoreThreshold = options?.score_threshold;
    const thresholdQuery =
      typeof scoreThreshold === "number"
        ? `&score_threshold=${encodeURIComponent(scoreThreshold)}`
        : "";
    return smartFetch<SemanticSearchResponse>(
      `/search/semantic?q=${encodeURIComponent(query)}&limit=${limit}${thresholdQuery}`,
      {
        method: "GET",
        token,
      },
    );
  },
  askAssistant: (question: string, token: string) =>
    smartFetch<ChatAnswer>("/chat/ask", {
      method: "POST",
      token,
      body: { question }
    })
};





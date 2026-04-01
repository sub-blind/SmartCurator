import type { ChatAnswer, ContentItem, SemanticSearchResponse } from "@/types/content";

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown> | FormData;
  token?: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const TOKEN_KEY = "smartcurator_token";
const EMAIL_KEY = "smartcurator_email";
const REFRESH_TOKEN_KEY = "smartcurator_refresh_token";

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
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(EMAIL_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
        window.dispatchEvent(new Event("auth:expired"));
      }
      throw new Error("로그인 세션(30분)이 만료되었습니다. 다시 로그인해 주세요.");
    }
    if (response.status >= 502 && response.status <= 504) {
      throw new Error("백엔드에 연결할 수 없습니다. API 서버와 Cloudflare Tunnel 상태를 확인해 주세요.");
    }
    const detail = errorBody?.detail;
    if (typeof detail === "string" && detail.trim()) {
      throw new Error(detail);
    }
    if (detail && typeof detail === "object") {
      const message = (detail as { message?: string }).message;
      const contentId = (detail as { content_id?: number }).content_id;
      if (message && contentId) {
        throw new Error(`${message} (콘텐츠 #${contentId})`);
      }
      if (message) {
        throw new Error(message);
      }
    }
    throw new Error("요청에 실패했습니다.");
  }

  return (await response.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    smartFetch<{ access_token: string; refresh_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: { email, password }
    }),
  refresh: (refreshToken: string) =>
    smartFetch<{ access_token: string; refresh_token: string; token_type: string }>("/auth/refresh", {
      method: "POST",
      body: { refresh_token: refreshToken }
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
    thumbnail_url?: string;
    raw_content?: string;
    content_type: string;
    is_public: boolean;
    token: string;
  }) =>
    smartFetch<ContentItem>("/contents/", {
      method: "POST",
      token: params.token,
      body: {
        title: params.title,
        url: params.url,
        thumbnail_url: params.thumbnail_url,
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
  getContent: (id: number, token: string) =>
    smartFetch<ContentItem>(`/contents/${id}`, {
      method: "GET",
      token,
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
  updateContent: (
    id: number,
    payload: { title?: string; is_public?: boolean },
    token: string,
  ) =>
    smartFetch<ContentItem>(`/contents/${id}`, {
      method: "PUT",
      token,
      body: payload,
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
  publicSemanticSearch: (
    query: string,
    options?: { limit?: number; score_threshold?: number },
  ) => {
    const limit = options?.limit ?? 6;
    const scoreThreshold = options?.score_threshold;
    const thresholdQuery =
      typeof scoreThreshold === "number"
        ? `&score_threshold=${encodeURIComponent(scoreThreshold)}`
        : "";
    return smartFetch<SemanticSearchResponse>(
      `/search/public?q=${encodeURIComponent(query)}&limit=${limit}${thresholdQuery}`,
      {
        method: "GET",
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





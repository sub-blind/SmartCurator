export type ContentType = "url" | "pdf" | "text";

export type ContentSummary = {
  id: number;
  title: string;
  summary: string;
  tags: string[];
  status: "pending" | "processed" | "failed";
  updated_at: string;
};




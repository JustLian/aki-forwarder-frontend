const apiBase =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  "https://aki-api.rian.moe";

export const API_BASE = apiBase.replace(/\/+$/, "");

export const httpUrl = (path: string) => `${API_BASE}${path}`;
export const wsUrl = (path: string) => {
  if (API_BASE.startsWith("https://")) {
    return `wss://${API_BASE.slice("https://".length)}${path}`;
  }
  if (API_BASE.startsWith("http://")) {
    return `ws://${API_BASE.slice("http://".length)}${path}`;
  }
  return `wss://${API_BASE}${path}`;
};
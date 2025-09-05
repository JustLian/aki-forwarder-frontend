const apiBase =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  "http://localhost:8000";


export const API_BASE = apiBase;
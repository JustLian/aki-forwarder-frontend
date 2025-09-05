const apiBase =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  "https://aki-api.rian.moe";


export const API_BASE = apiBase;
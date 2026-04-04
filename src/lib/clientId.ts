const KEY = "dialed-tab-client-id";

export function getClientId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

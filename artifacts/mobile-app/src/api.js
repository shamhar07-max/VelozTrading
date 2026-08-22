// ── VelozTrade mobile API layer ─────────────────────────────
// Same-origin as the platform → Clerk session cookies flow
// automatically on every request. No tokens to manage.

const API = import.meta.env.VITE_API_URL ?? "";

async function req(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (res.status === 401) throw new Error("AUTH");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const getInstruments = () => req("/api/instruments");
export const getAccount = () => req("/api/account");
export const getPositions = () => req("/api/positions");
export const closePosition = (id) =>
  req(`/api/positions/${id}`, { method: "DELETE", body: JSON.stringify({}) });
export const openPosition = (body) =>
  req("/api/positions", { method: "POST", body: JSON.stringify(body) });
export const getOrders = () => req("/api/orders");
export const getFundsHistory = () => req("/api/funds-history");
export const getIbPanel = () => req("/api/ib/me");

export function wsUrl() {
  const host = API ? API.replace(/^http/, "ws") : window.location.origin.replace(/^http/, "ws");
  return `${host}/ws`;
}

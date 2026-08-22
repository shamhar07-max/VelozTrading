// ── VelozTrade mobile API layer ─────────────────────────────
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
export const patchAccount = (body) => req("/api/account", { method: "PATCH", body: JSON.stringify(body) });
export const getDashboardSummary = () => req("/api/dashboard/summary");
export const getDashboardActivity = () => req("/api/dashboard/activity");
export const getPositions = () => req("/api/positions");
export const openPosition = (body) => req("/api/positions", { method: "POST", body: JSON.stringify(body) });
export const closePosition = (id, body = {}) =>
  req(`/api/positions/${id}`, { method: "DELETE", body: JSON.stringify(body) });
export const getPendingOrders = () => req("/api/pending-orders");
export const cancelPendingOrder = (id) => req(`/api/pending-orders/${id}`, { method: "DELETE" });
export const getOrders = () => req("/api/orders");
export const getFundsHistory = () => req("/api/funds-history");
export const getWatchlist = () => req("/api/watchlist");
export const addToWatchlist = (symbol) => req("/api/watchlist", { method: "POST", body: JSON.stringify({ symbol }) });
export const removeFromWatchlist = (symbol) => req(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" });
export const getNotifications = () => req("/api/my-notifications");
export const getLeaderboard = () => req("/api/leaderboard");
export const getCalendar = () => req("/api/calendar");
export const getIbPanel = () => req("/api/ib/me");
export const createWithdrawal = (body) => req("/api/account/withdrawal-request", { method: "POST", body: JSON.stringify(body) });
export const createDepositRequest = (body) => req("/api/account/deposit-request", { method: "POST", body: JSON.stringify(body) });

export function wsUrl() {
  const host = API ? API.replace(/^http/, "ws") : window.location.origin.replace(/^http/, "ws");
  return `${host}/ws`;
}

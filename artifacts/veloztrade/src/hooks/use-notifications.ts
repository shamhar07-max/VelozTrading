import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const STORAGE_KEY = "vt_seen_notif_v1";

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

function markSeen(ids: string[]) {
  try {
    const seen = getSeenIds();
    ids.forEach(id => seen.add(id));
    const arr = [...seen];
    if (arr.length > 500) arr.splice(0, arr.length - 500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {}
}

interface FundsNotification {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  status: string;
  method: string;
  reviewedAt: string | null;
}

async function fetchNotifications(): Promise<FundsNotification[]> {
  const res = await fetch(`${BASE}/api/my-notifications`);
  if (!res.ok) return [];
  return res.json();
}

export function useNotificationPolling() {
  const { isSignedIn } = useAuth();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = async () => {
    try {
      const notifications = await fetchNotifications();
      const seen = getSeenIds();
      const fresh = notifications.filter(n => !seen.has(n.id));
      if (fresh.length === 0) return;

      markSeen(fresh.map(n => n.id));

      for (const n of fresh) {
        const label = n.type === "deposit" ? "Deposit" : "Withdrawal";
        const amt = `$${n.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (n.status === "approved") {
          toast.success(`${label} Approved ✓`, {
            description: `Your ${label.toLowerCase()} of ${amt} via ${n.method} has been approved and credited.`,
            duration: 8000,
          });
        } else {
          toast.error(`${label} Not Approved`, {
            description: `Your ${label.toLowerCase()} of ${amt} via ${n.method} was not approved. Contact support for details.`,
            duration: 8000,
          });
        }
      }
    } catch {}
  };

  useEffect(() => {
    if (!isSignedIn) return;
    check();
    timerRef.current = setInterval(check, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isSignedIn]);
}

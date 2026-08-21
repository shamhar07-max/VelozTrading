import { useEffect, useRef, useMemo } from "react";
import { useAuth } from "@clerk/react";
import { useListAlerts, useTriggerAlert, getListAlertsQueryKey } from "@workspace/api-client-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useQueryClient } from "@tanstack/react-query";
import { toKey, formatPrice } from "@/lib/symbol";
import { toast } from "sonner";

// FIX: Persist triggered alert IDs to sessionStorage so they don't re-fire on page refresh
function loadTriggered(): Set<number> {
  try {
    const raw = sessionStorage.getItem("triggered_alerts");
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function saveTriggered(ids: Set<number>) {
  try {
    sessionStorage.setItem("triggered_alerts", JSON.stringify([...ids]));
  } catch { /* non-critical */ }
}

export function AlertMonitor() {
  const { isSignedIn } = useAuth();
  const { prices } = useWebSocket();
  const queryClient = useQueryClient();
  const triggerAlert = useTriggerAlert();
  // FIX: initialise from sessionStorage so refreshes don't re-trigger already-fired alerts
  const triggeredRef = useRef<Set<number>>(loadTriggered());
  // FIX: throttle — only run the check every 2 s, not on every 500 ms price tick
  const lastCheckRef = useRef<number>(0);

  const { data: alerts } = useListAlerts({
    query: { enabled: !!isSignedIn, refetchInterval: 30_000, queryKey: getListAlertsQueryKey() },
  });

  // FIX: Memoize active alerts so the effect dependency is stable
  const activeAlerts = useMemo(
    () => (Array.isArray(alerts) ? alerts : []).filter((a) => a.status === "active"),
    [alerts]
  );

  useEffect(() => {
    if (!isSignedIn || activeAlerts.length === 0) return;

    // FIX: Throttle to 2 s intervals — previously ran on every 500 ms WebSocket tick
    const now = Date.now();
    if (now - lastCheckRef.current < 2_000) return;
    lastCheckRef.current = now;

    for (const alert of activeAlerts) {
      if (triggeredRef.current.has(alert.id)) continue;

      const key = toKey(alert.symbol);
      const quote = prices[key];
      if (!quote) continue;

      const crossed =
        alert.condition === "above"
          ? quote.price >= alert.targetPrice
          : quote.price <= alert.targetPrice;

      if (crossed) {
        triggeredRef.current.add(alert.id);
        saveTriggered(triggeredRef.current); // FIX: persist across refreshes

        const dirLabel = alert.condition === "above" ? "above" : "below";
        const priceStr = formatPrice(alert.targetPrice, alert.symbol);

        toast.success(`Price alert triggered: ${alert.symbol}`, {
          description: `${alert.symbol} is now ${dirLabel} ${priceStr}${alert.note ? ` · ${alert.note}` : ""}`,
          duration: 8000,
        });

        triggerAlert.mutate(
          { id: alert.id },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
            },
            onError: () => {
              // Roll back in-memory and storage if the server call fails
              triggeredRef.current.delete(alert.id);
              saveTriggered(triggeredRef.current);
            },
          }
        );
      }
    }
  }, [prices, activeAlerts, isSignedIn, triggerAlert, queryClient]);

  return null;
}

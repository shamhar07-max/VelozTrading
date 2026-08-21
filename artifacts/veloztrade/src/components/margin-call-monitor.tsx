import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";
import { useGetAccount, getGetAccountQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";

const MARGIN_CALL_THRESHOLD = 100;
const STOP_OUT_THRESHOLD = 50;
const CLEAR_THRESHOLD = 150;

export function MarginCallMonitor() {
  const { isSignedIn } = useAuth();
  const { data: account } = useGetAccount({
    query: { enabled: !!isSignedIn, refetchInterval: 5000, queryKey: getGetAccountQueryKey() },
  });

  const marginCallFiredRef = useRef(false);
  const stopOutFiredRef = useRef(false);
  const prevMarginLevelRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isSignedIn || account == null) return;

    const marginLevel = account.marginLevel ?? 0;

    if (marginLevel === 0) {
      prevMarginLevelRef.current = marginLevel;
      return;
    }

    const prev = prevMarginLevelRef.current;
    prevMarginLevelRef.current = marginLevel;

    if (marginLevel >= CLEAR_THRESHOLD) {
      marginCallFiredRef.current = false;
      stopOutFiredRef.current = false;
      return;
    }

    if (marginLevel < STOP_OUT_THRESHOLD && !stopOutFiredRef.current) {
      stopOutFiredRef.current = true;
      marginCallFiredRef.current = true;
      toast.error("Stop-out imminent — position being closed", {
        description: `Margin Level is ${marginLevel.toFixed(1)}% (below 50%). Your most-losing position will be closed automatically.`,
        duration: 15_000,
        id: "stop-out-warning",
      });
      return;
    }

    if (
      marginLevel < MARGIN_CALL_THRESHOLD &&
      (prev === null || prev >= MARGIN_CALL_THRESHOLD) &&
      !marginCallFiredRef.current
    ) {
      marginCallFiredRef.current = true;
      toast.warning("Margin call — add funds or reduce exposure", {
        description: `Margin Level is ${marginLevel.toFixed(1)}%. Below 100% your account is at risk of stop-out. Deposit funds or close positions to restore margin.`,
        duration: 12_000,
        id: "margin-call-warning",
      });
    }
  }, [account, isSignedIn]);

  return null;
}

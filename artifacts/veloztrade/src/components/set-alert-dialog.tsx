import { useState } from "react";
import { useCreateAlert, getListAlertsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { toKey, formatPrice } from "@/lib/symbol";
import { Input } from "@/components/ui/input";
import { X, Bell } from "lucide-react";

interface SetAlertDialogProps {
  symbol: string;
  onClose: () => void;
}

export function SetAlertDialog({ symbol, onClose }: SetAlertDialogProps) {
  const { prices } = useWebSocket();
  const queryClient = useQueryClient();
  const createAlert = useCreateAlert();

  const key = toKey(symbol);
  const quote = prices[key];
  const currentPrice = quote?.price;

  const [targetPrice, setTargetPrice] = useState(
    currentPrice != null ? String(parseFloat(currentPrice.toPrecision(8))) : ""
  );
  const [condition, setCondition] = useState<"above" | "below">(
    currentPrice != null && currentPrice > 0 ? "above" : "above"
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const tp = parseFloat(targetPrice);
    if (!targetPrice || isNaN(tp) || tp <= 0) {
      setError("Enter a valid target price");
      return;
    }
    setError("");
    createAlert.mutate(
      { data: { symbol, targetPrice: tp, condition, note: note || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
          onClose();
        },
        onError: () => {
          setError("Failed to create alert. Please try again.");
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-[calc(100vw-2rem)] max-w-xs shadow-2xl border border-border">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary"/>
            <h3 className="font-bold text-lg">Set Price Alert</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4"/>
          </button>
        </div>

        <div className="mb-4">
          <div className="text-sm font-semibold text-foreground mb-1">{symbol}</div>
          {currentPrice != null && (
            <div className="text-xs text-muted-foreground">
              Current price: <span className="font-mono text-foreground">{formatPrice(currentPrice, symbol)}</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Condition</label>
            <div className="flex p-1 bg-muted rounded-xl gap-1">
              <button
                onClick={() => setCondition("above")}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${condition === "above" ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
              >
                Price Above
              </button>
              <button
                onClick={() => setCondition("below")}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${condition === "below" ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
              >
                Price Below
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Target Price</label>
            <Input
              type="number"
              step="any"
              min="0"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="Enter target price"
              className="font-mono"
              data-testid="input-alert-price"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
              Note <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Buy signal"
              maxLength={100}
            />
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={createAlert.isPending}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              data-testid="button-create-alert"
            >
              {createAlert.isPending ? "Creating…" : "Set Alert"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

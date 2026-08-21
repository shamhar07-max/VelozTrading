import { useState } from "react";
import { useListAlerts, useDeleteAlert, getListAlertsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { toKey, formatPrice } from "@/lib/symbol";
import { InstrumentIcon } from "@/components/instrument-icon";
import { Bell, BellOff, Trash2, Plus } from "lucide-react";
import { SetAlertDialog } from "@/components/set-alert-dialog";

interface AlertsPanelProps {
  defaultSymbol?: string;
}

export function AlertsPanel({ defaultSymbol }: AlertsPanelProps) {
  const queryClient = useQueryClient();
  const { data: alerts, isLoading } = useListAlerts();
  const deleteAlert = useDeleteAlert();
  const { prices } = useWebSocket();
  const [addingForSymbol, setAddingForSymbol] = useState<string | null>(null);

  const handleDelete = (id: number) => {
    deleteAlert.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() }),
    });
  };

  const activeAlerts = alerts?.filter((a) => a.status === "active") ?? [];
  const triggeredAlerts = alerts?.filter((a) => a.status === "triggered") ?? [];

  return (
    <>
      {addingForSymbol && (
        <SetAlertDialog
          symbol={addingForSymbol}
          onClose={() => setAddingForSymbol(null)}
        />
      )}

      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
          <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5"/> Price Alerts ({activeAlerts.length} active)
          </span>
          {defaultSymbol && (
            <button
              onClick={() => setAddingForSymbol(defaultSymbol)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
              data-testid="button-add-alert"
            >
              <Plus className="w-3.5 h-3.5"/> Add Alert
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 text-xs text-muted-foreground text-center">Loading alerts…</div>
          ) : alerts?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-6 gap-2">
              <BellOff className="w-6 h-6 text-muted-foreground/40"/>
              <p className="text-xs text-muted-foreground">No alerts set</p>
              {defaultSymbol && (
                <button
                  onClick={() => setAddingForSymbol(defaultSymbol)}
                  className="text-xs text-primary font-semibold hover:text-primary/80 transition-colors"
                >
                  + Set an alert
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {activeAlerts.map((alert) => {
                const key = toKey(alert.symbol);
                const currentPrice = prices[key]?.price;
                const priceDiff = currentPrice != null
                  ? ((currentPrice - alert.targetPrice) / alert.targetPrice) * 100
                  : null;

                return (
                  <div key={alert.id} className="px-4 py-2.5 flex items-center gap-2 group hover:bg-muted/20 transition-colors">
                    <InstrumentIcon symbol={alert.symbol} size={22} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs">{alert.symbol}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${alert.condition === "above" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                          {alert.condition === "above" ? "↑ above" : "↓ below"}
                        </span>
                        <span className="font-mono text-xs font-semibold">{formatPrice(alert.targetPrice, alert.symbol)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {currentPrice != null && priceDiff != null && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Now: {formatPrice(currentPrice, alert.symbol)}
                            <span className={`ml-1 ${Math.abs(priceDiff) < 1 ? "text-warning" : "text-muted-foreground"}`}>
                              ({priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(2)}%)
                            </span>
                          </span>
                        )}
                        {alert.note && (
                          <span className="text-[10px] text-muted-foreground truncate">{alert.note}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(alert.id)}
                      disabled={deleteAlert.isPending}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
                      title="Delete alert"
                    >
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                );
              })}

              {triggeredAlerts.length > 0 && (
                <>
                  <div className="px-4 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/20">
                    Triggered
                  </div>
                  {triggeredAlerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="px-4 py-2.5 flex items-center gap-2 group hover:bg-muted/20 transition-colors opacity-60">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs line-through text-muted-foreground">{alert.symbol}</span>
                          <span className="font-mono text-xs text-muted-foreground">{formatPrice(alert.targetPrice, alert.symbol)}</span>
                        </div>
                        {alert.triggeredAt && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Triggered {new Date(alert.triggeredAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        disabled={deleteAlert.isPending}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

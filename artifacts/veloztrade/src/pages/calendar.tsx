import { useEffect, useState, useMemo } from "react";
import { Calendar, Filter, TrendingUp, Clock, Globe } from "lucide-react";

interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
}

const CURRENCIES = ["All", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];
const IMPACTS    = ["All", "High", "Medium", "Low"];

const IMPACT: Record<string, { color: string; dot: string }> = {
  High:   { color: "bg-red-500/15 text-red-400 border-red-500/30",          dot: "bg-red-400"             },
  Medium: { color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-400"          },
  Low:    { color: "bg-muted/50 text-muted-foreground border-border",        dot: "bg-muted-foreground"    },
};

const FLAG: Record<string, string> = {
  USD:"🇺🇸", EUR:"🇪🇺", GBP:"🇬🇧", JPY:"🇯🇵",
  AUD:"🇦🇺", CAD:"🇨🇦", CHF:"🇨🇭", NZD:"🇳🇿", CNY:"🇨🇳",
};

function groupByDay(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = new Date(e.date).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries());
}

function dayLabel(dayStr: string) {
  const d = new Date(dayStr);
  const today    = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString())    return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function timeLabel(iso: string) {
  try { return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }); }
  catch { return "—"; }
}

export function CalendarPage() {
  useEffect(() => { document.title = "Economic Calendar | VelozTrade"; }, []);

  const [events,  setEvents]  = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cur,     setCur]     = useState("All");
  const [imp,     setImp]     = useState("All");

  useEffect(() => {
    fetch("/api/calendar")
      .then(r => r.json() as Promise<CalendarEvent[]>)
      .then(d => { setEvents(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    events.filter(e =>
      (cur === "All" || e.country === cur) &&
      (imp === "All" || e.impact  === imp)
    ), [events, cur, imp]);

  const grouped   = useMemo(() => groupByDay(filtered), [filtered]);
  const highCount = events.filter(e => e.impact === "High").length;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-20">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <Calendar className="w-7 h-7 text-primary"/> Economic Calendar
        </h1>
        <p className="text-muted-foreground">Upcoming economic events and data releases that move markets.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "This Week",    value: events.length, sub: "events",  color: "" },
          { label: "High Impact",  value: highCount,     sub: "events",  color: "text-red-400" },
          { label: "Currencies",   value: new Set(events.map(e => e.country)).size, sub: "tracked", color: "" },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">{c.label}</div>
            <div className={`text-2xl font-bold ${c.color}`}>{loading ? "—" : c.value}</div>
            <div className="text-xs text-muted-foreground">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-muted-foreground"/>
          <span className="text-xs text-muted-foreground font-semibold">FILTER</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0"/>
          {CURRENCIES.map(c => (
            <button key={c} onClick={() => setCur(c)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${cur === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >{c}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground shrink-0"/>
          {IMPACTS.map(i => (
            <button key={i} onClick={() => setImp(i)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${imp === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >{i}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3"/>
          <p className="font-semibold">No events match your filters</p>
          <p className="text-sm text-muted-foreground mt-1">Try clearing the filters to see all events.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, dayEvts]) => (
            <div key={day} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground"/>
                <span className="font-semibold text-sm">{dayLabel(day)}</span>
                <span className="ml-auto text-xs text-muted-foreground">{dayEvts.length} event{dayEvts.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="divide-y divide-border/50">
                {dayEvts.map((event, i) => {
                  const cfg = IMPACT[event.impact] ?? IMPACT.Low;
                  return (
                    <div key={i} className="px-4 py-3 hover:bg-muted/20 transition-colors text-sm">
                      {/* Mobile layout */}
                      <div className="sm:hidden">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}/>
                          <span className="font-medium truncate flex-1">{event.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cfg.color}`}>{event.impact}</span>
                        </div>
                        <div className="text-xs text-muted-foreground pl-4 mb-2">
                          {FLAG[event.country] ?? "🌐"} {event.country} · {timeLabel(event.date)}
                        </div>
                        <div className="flex gap-4 pl-4 text-xs">
                          <div><span className="text-muted-foreground">Actual: </span><span className="font-mono text-emerald-400 font-bold">{event.actual != null ? event.actual : "—"}</span></div>
                          <div><span className="text-muted-foreground">Fcst: </span><span className="font-mono">{event.forecast ?? "—"}</span></div>
                          <div><span className="text-muted-foreground">Prev: </span><span className="font-mono text-muted-foreground">{event.previous ?? "—"}</span></div>
                        </div>
                      </div>
                      {/* Desktop layout */}
                      <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}/>
                            <span className="font-medium truncate">{event.title}</span>
                          </div>
                          <div className="text-xs text-muted-foreground pl-4">
                            {FLAG[event.country] ?? "🌐"} {event.country} · {timeLabel(event.date)}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cfg.color}`}>{event.impact}</span>
                        <div className="text-right min-w-[60px]">
                          {event.actual != null ? <span className="font-mono text-emerald-400 font-bold">{event.actual}</span> : <span className="text-muted-foreground text-xs">—</span>}
                          <div className="text-[10px] text-muted-foreground">Actual</div>
                        </div>
                        <div className="text-right min-w-[60px]">
                          <span className="font-mono">{event.forecast ?? "—"}</span>
                          <div className="text-[10px] text-muted-foreground">Forecast</div>
                        </div>
                        <div className="text-right min-w-[60px]">
                          <span className="font-mono text-muted-foreground">{event.previous ?? "—"}</span>
                          <div className="text-[10px] text-muted-foreground">Previous</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

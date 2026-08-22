import { useEffect, useState } from "react";
import { getCalendar } from "../api";
import { Empty } from "../components";

const IMPACT = { high: "impact-high", medium: "impact-medium", low: "impact-low" };

export default function Calendar() {
  const [events, setEvents] = useState(null);
  useEffect(() => {
    getCalendar().then((c) => setEvents(Array.isArray(c) ? c : c?.events ?? [])).catch(() => setEvents([]));
  }, []);
  if (events == null) return <div className="spinner" />;
  return (
    <div>
      <div className="card-title">Economic calendar · this week</div>
      {events.length === 0 && <Empty>No events this week.</Empty>}
      {events.map((e, i) => (
        <div key={i} className="cal-row">
          <div>
            <div className="num" style={{ fontWeight: 700 }}>{e.date ? new Date(e.date).toLocaleDateString(undefined, { weekday: "short" }) : "—"}</div>
            <div className="tiny">{e.time ?? e.time_label ?? ""}</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{e.title ?? e.event ?? "Event"}</div>
            <div className="tiny">{e.country ?? e.currency ?? ""} {e.impact ? `· ${e.impact}` : ""}</div>
          </div>
          <span className={"cal-impact " + (IMPACT[(e.impact ?? "").toLowerCase()] ?? "impact-low")}>{(e.impact ?? "low").toUpperCase()}</span>
        </div>
      ))}
      <p className="tiny" style={{ textAlign: "center", marginTop: 12 }}>Source: ForexFactory weekly feed</p>
    </div>
  );
}

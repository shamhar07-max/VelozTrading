import { useEffect, useState } from "react";
import { getLeaderboard } from "../api";
import { Empty, fmt } from "../components";

export default function Leaderboard() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    getLeaderboard().then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  }, []);
  if (rows == null) return <div className="spinner" />;
  return (
    <div>
      <div className="card-title">Top traders this month</div>
      {rows.length === 0 && <Empty>Leaderboard is warming up — be the first.</Empty>}
      {rows.map((u, i) => (
        <div className="lb-row" key={i}>
          <div className={"lb-rank r" + (i + 1)}>{i + 1}</div>
          <div className="grow">
            <div className="t1">{u.name ?? u.clerkUserId?.slice(0, 12) ?? "Trader"}</div>
            <div className="t2">{u.trades ?? u.orderCount ?? ""} trades</div>
          </div>
          <div className="right num up" style={{ fontWeight: 800 }}>
            ${fmt(u.profit ?? u.totalProfit ?? 0)}
          </div>
        </div>
      ))}
    </div>
  );
}

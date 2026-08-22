import { useEffect, useState } from "react";
import { getNotifications } from "../api";
import { Empty } from "../components";

export default function Notifications() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    getNotifications().then((r) => setItems(Array.isArray(r) ? r : [])).catch(() => setItems([]));
  }, []);
  if (items == null) return <div className="spinner" />;
  return (
    <div>
      {items.length === 0 && <Empty>No notifications yet.</Empty>}
      {items.map((n, i) => (
        <div key={n.id ?? i} className="notif">
          <div className="h">{n.title ?? n.subject ?? "Notification"}</div>
          <div className="b">{n.body ?? n.message ?? ""}</div>
          {n.createdAt && <div className="tiny" style={{ marginTop: 6 }}>{new Date(n.createdAt).toLocaleString()}</div>}
        </div>
      ))}
    </div>
  );
}

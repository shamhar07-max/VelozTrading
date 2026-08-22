import { IconBack } from "./icons";

export function ScreenHeader({ title, onBack, right }) {
  return (
    <div className="apphead">
      <button className="iconbtn" onClick={onBack} aria-label="Back"><IconBack /></button>
      <div className="ttl">{title}</div>
      {right}
    </div>
  );
}

export function Seg({ options, value, onChange }) {
  return (
    <div className="seg3">
      {options.map((o) => (
        <button key={o.id} className={"chip" + (value === o.id ? " on" : "")}
          style={{ textAlign: "center" }} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Empty({ children }) { return <div className="empty">{children}</div>; }

export function fmt(n, d = 2) {
  if (n == null || isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function pnlCls(v) { return Number(v) >= 0 ? "up" : "down"; }

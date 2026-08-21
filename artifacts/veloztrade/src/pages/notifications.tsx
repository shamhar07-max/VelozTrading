import { useEffect, useState } from "react";
import { Bell, TrendingUp, DollarSign, Copy, AlertTriangle, Info, CheckCircle, X, Settings, Filter } from "lucide-react";
import { InstrumentIcon } from "@/components/instrument-icon";

type NotifType = "price_alert"|"deposit"|"copy"|"system"|"trade"|"promo";

interface Notif {
  id:number; type:NotifType; title:string; body:string; time:string; read:boolean; icon:any; color:string;
}

const ICON_MAP: Record<NotifType,{icon:any,color:string}> = {
  price_alert: { icon:TrendingUp, color:"text-primary bg-primary/10" },
  deposit: { icon:DollarSign, color:"text-success bg-success/10" },
  copy: { icon:Copy, color:"text-violet-400 bg-violet-500/10" },
  system: { icon:Info, color:"text-blue-400 bg-blue-500/10" },
  trade: { icon:CheckCircle, color:"text-amber-400 bg-amber-500/10" },
  promo: { icon:Bell, color:"text-rose-400 bg-rose-500/10" },
};

const INITIAL: Notif[] = [
  { id:1, type:"price_alert", title:"Price Alert: XAU/USD", body:"Gold hit your alert level of $2,320.00. Current price: $2,323.40", time:"2m ago", read:false, ...ICON_MAP.price_alert },
  { id:2, type:"deposit", title:"Deposit Approved", body:"Your deposit of $500.00 via Easypaisa has been approved and credited to your account.", time:"1h ago", read:false, ...ICON_MAP.deposit },
  { id:3, type:"copy", title:"Copy Trade Opened", body:"Marcus Reynolds opened a BUY on EUR/USD — your copy position has been opened at 1.08742.", time:"2h ago", read:false, ...ICON_MAP.copy },
  { id:4, type:"trade", title:"Trade Closed — Profit", body:"Your BTC/USD buy position closed at $68,240. P&L: +$142.80", time:"3h ago", read:true, ...ICON_MAP.trade },
  { id:5, type:"system", title:"KYC Reminder", body:"Complete your identity verification to unlock full withdrawal access. Upload your documents in Profile.", time:"5h ago", read:true, ...ICON_MAP.system },
  { id:6, type:"copy", title:"Copy Trade Closed", body:"Sofia Chen closed ETH/USD position. Copy P&L: +$38.40. Performance fee: $7.68", time:"6h ago", read:true, ...ICON_MAP.copy },
  { id:7, type:"price_alert", title:"Price Alert: BTC/USD", body:"Bitcoin reached your target of $67,000. It's now trading at $67,420.", time:"8h ago", read:true, ...ICON_MAP.price_alert },
  { id:8, type:"promo", title:"New Contest Available", body:"Monthly Trading Championship is now open. $10,000 prize pool — join before June 30th!", time:"1d ago", read:true, ...ICON_MAP.promo },
  { id:9, type:"deposit", title:"Withdrawal Processed", body:"Your withdrawal request of $200.00 has been processed. Allow 1–3 business days.", time:"2d ago", read:true, ...ICON_MAP.deposit },
  { id:10, type:"system", title:"Welcome to VelozTrade!", body:"Your account has been set up successfully. Start with our demo account or make your first deposit.", time:"3d ago", read:true, ...ICON_MAP.system },
];

const FILTER_TABS: { label:string; type:NotifType|"all" }[] = [
  { label:"All", type:"all" },
  { label:"Price Alerts", type:"price_alert" },
  { label:"Trades", type:"trade" },
  { label:"Deposits", type:"deposit" },
  { label:"Copy Trading", type:"copy" },
  { label:"System", type:"system" },
];

export function Notifications() {
  useEffect(() => { document.title = "Notifications | VelozTrade"; }, []);
  const [notifs, setNotifs] = useState(INITIAL);
  const [filter, setFilter] = useState<NotifType|"all">("all");

  const unread = notifs.filter(n => !n.read).length;
  const filtered = notifs.filter(n => filter === "all" || n.type === filter);

  const markAll = () => setNotifs(ns => ns.map(n => ({...n, read:true})));
  const markRead = (id:number) => setNotifs(ns => ns.map(n => n.id===id ? {...n, read:true} : n));
  const dismiss = (id:number) => setNotifs(ns => ns.filter(n => n.id !== id));

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-7 h-7 text-primary"/>
            Notifications
            {unread > 0 && <span className="w-6 h-6 rounded-full bg-destructive text-white text-xs font-bold flex items-center justify-center">{unread}</span>}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{unread} unread · {notifs.length} total</p>
        </div>
        {unread > 0 && <button onClick={markAll} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">Mark all read</button>}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {FILTER_TABS.map(f => (
          <button key={f.type} onClick={() => setFilter(f.type)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${filter===f.type?"bg-primary/15 text-primary border border-primary/30":"bg-muted text-muted-foreground border border-transparent hover:bg-muted/80"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="space-y-2">
        {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground">No notifications in this category.</div>}
        {filtered.map(n => (
          <div
            key={n.id}
            onClick={() => markRead(n.id)}
            className={`glass-card rounded-2xl border ${!n.read ? "border-primary/20 bg-primary/2" : "border-border"} p-4 flex gap-3 cursor-pointer hover:border-border/80 transition-all`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.color}`}>
              <n.icon className="w-4.5 h-4.5"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-sm flex items-center gap-2">
                  {n.title}
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0"/>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{n.time}</span>
                  <button onClick={e => { e.stopPropagation(); dismiss(n.id); }} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3 h-3"/>
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{n.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl border border-border p-4 flex items-center gap-3">
        <Settings className="w-5 h-5 text-muted-foreground shrink-0"/>
        <div className="flex-1">
          <div className="text-sm font-semibold">Notification Preferences</div>
          <div className="text-xs text-muted-foreground">Manage email, push, and in-app alerts in Profile → Notifications</div>
        </div>
        <a href="/profile" className="text-xs font-bold text-primary hover:underline">Settings →</a>
      </div>
    </div>
  );
}

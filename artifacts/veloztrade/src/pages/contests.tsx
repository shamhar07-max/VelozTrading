import { useEffect, useState } from "react";
import { Trophy, Clock, Users, DollarSign, TrendingUp, Award, Star, Timer, ChevronRight } from "lucide-react";

function seeded(seed: number, max: number) { return Math.abs(Math.sin(seed * 9301 + 49297) * 233280) % max; }
const NAMES = ["Marcus R.","Sofia C.","Ahmed A.","Isabella M.","James O.","Yuki T.","Priya S.","Carlos M.","Elena V.","David K.","Sarah L.","Mohammed H."];

function genLeaderboard(seed: number) {
  return Array.from({length:10},(_,i) => ({
    rank:i+1,
    name:NAMES[Math.floor(seeded(seed+i,NAMES.length))],
    country:["🇬🇧","🇺🇸","🇦🇪","🇩🇪","🇳🇬","🇯🇵","🇮🇳","🇧🇷","🇷🇺","🇰🇷","🇸🇬","🇦🇺"][Math.floor(seeded(seed+i+5,12))],
    return:+(15+seeded(seed+i+10,85)).toFixed(2),
    trades:Math.floor(20+seeded(seed+i+15,180)),
    prize:i===0?"$5,000":i===1?"$2,500":i===2?"$1,000":i<5?`$${500-i*50}`:"-",
  })).sort((a,b)=>b.return-a.return).map((e,i)=>({...e,rank:i+1}));
}

const CONTESTS = [
  { id:1, name:"Monthly Trading Championship", type:"Live", status:"active", prize:"$10,000 Prize Pool", end:"Jun 30, 2026", participants:847, minDeposit:250, desc:"Compete for the top monthly return. Real accounts only. Top 10 traders share the prize pool.", highlight:true },
  { id:2, name:"Crypto Battle — June 2026", type:"Live", status:"active", prize:"$5,000 Prize Pool", end:"Jun 30, 2026", participants:312, minDeposit:100, desc:"Best return on cryptocurrency CFDs this month. Any crypto instrument counts.", highlight:false },
  { id:3, name:"Demo Trading Championship", type:"Demo", status:"active", prize:"$500 Cash + VIP Upgrade", end:"Jun 30, 2026", participants:1205, minDeposit:0, desc:"Practice contest on demo accounts. No deposit required. Perfect for new traders.", highlight:false },
  { id:4, name:"Gold & Commodities Cup", type:"Live", status:"upcoming", prize:"$3,000 Prize Pool", end:"Jul 31, 2026", participants:0, minDeposit:500, desc:"Best return trading gold, silver, and oil CFDs. Starting July 1st.", highlight:false },
  { id:5, name:"Forex Masters — May 2026", type:"Live", status:"ended", prize:"$8,000 — Distributed", end:"May 31, 2026", participants:634, minDeposit:250, desc:"Monthly forex championship — completed.", highlight:false },
];

export function Contests() {
  useEffect(() => { document.title = "Contests | VelozTrade"; }, []);
  const [tab, setTab] = useState<"active"|"upcoming"|"ended">("active");
  const [joined, setJoined] = useState<Set<number>>(new Set());
  const [viewLeader, setViewLeader] = useState<number|null>(null);
  const epoch = Math.floor(Date.now() / 60000);
  const leaderboard = genLeaderboard(epoch);

  const filtered = CONTESTS.filter(c => c.status === tab);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {viewLeader !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={()=>setViewLeader(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="p-4 border-b border-border font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400"/> Live Leaderboard — {CONTESTS.find(c=>c.id===viewLeader)?.name}
            </div>
            <div className="divide-y divide-border/40 max-h-80 overflow-y-auto">
              {leaderboard.map(e => (
                <div key={e.rank} className="px-4 py-2.5 flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${e.rank===1?"bg-yellow-400/20 text-yellow-400":e.rank===2?"bg-slate-300/20 text-slate-300":e.rank===3?"bg-amber-700/20 text-amber-600":"bg-muted text-muted-foreground"}`}>
                    {e.rank===1?"🥇":e.rank===2?"🥈":e.rank===3?"🥉":`#${e.rank}`}
                  </div>
                  <span className="text-sm">{e.country}</span>
                  <span className="font-semibold text-sm flex-1">{e.name}</span>
                  <span className="text-success font-mono text-sm font-bold">+{e.return}%</span>
                  <span className="text-xs text-muted-foreground">{e.trades}t</span>
                  <span className={`text-xs font-bold ${e.prize!=="-"?"text-amber-400":"text-muted-foreground"}`}>{e.prize}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Trophy className="w-7 h-7 text-yellow-400"/> Trading Contests</h1>
        <p className="text-muted-foreground mt-1 text-sm">Compete with traders worldwide and win real cash prizes.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:"Total Prize Pool", value:"$18,500", icon:DollarSign, color:"text-success" },
          { label:"Active Contests", value:CONTESTS.filter(c=>c.status==="active").length, icon:Trophy, color:"text-primary" },
          { label:"Total Participants", value:"2,364", icon:Users, color:"text-amber-400" },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-4 border border-border text-center">
            <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-1.5`}/>
            <div className={`font-black text-xl ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {(["active","upcoming","ended"] as const).map(t => (
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all ${tab===t?"bg-card text-foreground shadow":"text-muted-foreground"}`}>
            {t==="active"?"🔴 Active":t==="upcoming"?"⏳ Upcoming":"✅ Ended"}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map(contest => (
          <div key={contest.id} className={`glass-card rounded-2xl border ${contest.highlight?"border-primary/40":"border-border"} p-5`}>
            {contest.highlight && <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1"><Star className="w-3 h-3 fill-primary"/> Featured Contest</div>}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg mb-1">{contest.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{contest.desc}</p>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-success"/><span className="text-success font-bold">{contest.prize}</span></span>
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5"/>{contest.participants.toLocaleString()} participants</span>
                  <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5"/>Ends {contest.end}</span>
                  <span className={`flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${contest.type==="Demo"?"bg-amber-400/10 text-amber-400":"bg-primary/10 text-primary"}`}>{contest.type}</span>
                  {contest.minDeposit > 0 && <span className="flex items-center gap-1">Min. deposit: ${contest.minDeposit}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {contest.status === "active" && (
                  <button onClick={()=>setViewLeader(contest.id)} className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted transition-all">
                    Leaderboard
                  </button>
                )}
                {contest.status !== "ended" && (
                  <button
                    onClick={() => setJoined(j => { const n=new Set(j); n.has(contest.id)?n.delete(contest.id):n.add(contest.id); return n; })}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${joined.has(contest.id)?"bg-success/15 text-success border border-success/30":"bg-primary text-primary-foreground hover:bg-primary/90"}`}
                  >
                    {joined.has(contest.id) ? "✓ Joined" : contest.status==="upcoming" ? "Register" : "Join Now"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center text-muted-foreground py-12">No {tab} contests right now.</div>}
      </div>
    </div>
  );
}

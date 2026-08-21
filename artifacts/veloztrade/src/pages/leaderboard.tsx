import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/react";
import { Trophy, TrendingUp, Medal, Activity, Users, Zap, Globe, Star, RefreshCw, Wifi } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Fake data engine ────────────────────────────────────────────────────────
const FIRST_NAMES = ["James","Sophia","Oliver","Emma","Lucas","Ava","Liam","Mia","Noah","Isabella","Ethan","Charlotte","Aiden","Amelia","Jackson","Harper","Sebastian","Evelyn","Mateo","Abigail","Logan","Emily","Muhammad","Lily","Alexander","Ella","Elijah","Madison","Benjamin","Layla","William","Zoe","Henry","Nora","David","Riley","Carter","Chloe","Owen","Penelope","Wyatt","Grace","Dylan","Victoria","Ryan","Aria","Nathan","Scarlett","Caleb","Hazel","Luke","Aurora","Jayden","Samantha","Gabriel","Hannah","Anthony","Aaliyah","Isaac","Anna","Lincoln","Naomi","Grayson","Eleanor","Jameson","Leah","Adam","Stella","Theodore","Violet","Hunter","Claire","Dominic","Lillian","Connor","Maya","Asher","Ellie","Julian","Brooklyn","Evan","Paisley","Cameron","Savannah","Eli","Audrey","Xavier","Bella","Hudson","Skylar","Roman","Gabriella","Landon","Kennedy","Aaron","Sofia"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Wilson","Martinez","Anderson","Taylor","Thomas","Jackson","White","Harris","Martin","Thompson","Moore","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts","Patel","Evans","Edwards","Collins","Stewart","Sanchez","Morris","Rogers","Reed","Cook","Morgan","Bell","Murphy","Bailey","Cooper","Richardson","Cox","Howard","Ward","Torres","Peterson","Gray","Ramirez","James","Watson","Brooks","Kelly","Sanders","Price","Bennett","Wood","Barnes","Ross","Henderson","Coleman","Jenkins","Perry","Powell","Long","Patterson","Hughes","Flores","Washington","Butler","Simmons","Foster","Gonzales","Bryant","Alexander","Russell","Griffin","Diaz","Hayes","Myers","Ford","Hamilton","Graham","Sullivan","Wallace"];
const CITIES = ["London","New York","Dubai","Singapore","Tokyo","Sydney","Frankfurt","Zürich","Hong Kong","Toronto","Chicago","Seoul","Amsterdam","São Paulo","Mumbai","Madrid","Stockholm","Oslo","Copenhagen","Vienna","Brussels","Lisbon","Cape Town","Riyadh","Karachi","Nairobi","Lagos","Jakarta","Manila","Kuala Lumpur","Bangkok","Melbourne","Paris","Milan","Warsaw","Prague","Bucharest","Athens","Istanbul","Tel Aviv"];
const COUNTRY_FLAGS: Record<string, string> = {
  "London": "🇬🇧","New York": "🇺🇸","Dubai": "🇦🇪","Singapore": "🇸🇬","Tokyo": "🇯🇵","Sydney": "🇦🇺","Frankfurt": "🇩🇪","Zürich": "🇨🇭","Hong Kong": "🇭🇰","Toronto": "🇨🇦","Chicago": "🇺🇸","Seoul": "🇰🇷","Amsterdam": "🇳🇱","São Paulo": "🇧🇷","Mumbai": "🇮🇳","Madrid": "🇪🇸","Stockholm": "🇸🇪","Oslo": "🇳🇴","Copenhagen": "🇩🇰","Vienna": "🇦🇹","Brussels": "🇧🇪","Lisbon": "🇵🇹","Cape Town": "🇿🇦","Riyadh": "🇸🇦","Karachi": "🇵🇰","Nairobi": "🇰🇪","Lagos": "🇳🇬","Jakarta": "🇮🇩","Manila": "🇵🇭","Kuala Lumpur": "🇲🇾","Bangkok": "🇹🇭","Melbourne": "🇦🇺","Paris": "🇫🇷","Milan": "🇮🇹","Warsaw": "🇵🇱","Prague": "🇨🇿","Bucharest": "🇷🇴","Athens": "🇬🇷","Istanbul": "🇹🇷","Tel Aviv": "🇮🇱",
};
const TIERS = ["VIP","VIP","Platinum","Platinum","Gold","Gold","Silver"];
const TIER_COLORS: Record<string, string> = {
  "VIP": "text-violet-400","Platinum": "text-amber-400","Gold": "text-primary","Silver": "text-slate-400",
};
const INSTRUMENTS = ["EUR/USD","BTC/USD","XAU/USD","SPX","ETH/USD","GBP/USD","NAS100","NVDA","AAPL","WTI","SOL/USD","USD/JPY","ADA/USD","DOW","XAG/USD"];

function seeded(seed: number, max: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return Math.abs(x - Math.floor(x)) * max;
}

function generateTrader(seed: number, slot: number) {
  const fni = Math.floor(seeded(seed * 31 + slot, FIRST_NAMES.length));
  const lni = Math.floor(seeded(seed * 97 + slot * 3, LAST_NAMES.length));
  const ci  = Math.floor(seeded(seed * 13 + slot * 7, CITIES.length));
  const ti  = Math.floor(seeded(seed * 47 + slot * 11, TIERS.length));
  const city = CITIES[ci];
  const tier = TIERS[ti];
  const firstName = FIRST_NAMES[fni];
  const lastName = LAST_NAMES[lni];
  const name = `${firstName} ${lastName[0]}.`;
  const initials = `${firstName[0]}${lastName[0]}`;

  // Profit — top traders have higher profits
  const basePct = slot === 0 ? 180 + seeded(seed, 120) :
                  slot < 3   ? 90 + seeded(seed + slot, 90) :
                  slot < 10  ? 30 + seeded(seed + slot, 60) :
                               5  + seeded(seed + slot, 50);
  const profit = +(basePct + seeded(seed * slot + 1, 5)).toFixed(1);
  const trades = Math.floor(30 + seeded(seed * slot + 5, 500));
  const winRate = +(55 + seeded(seed * slot + 9, 35)).toFixed(1);
  const instr = INSTRUMENTS[Math.floor(seeded(seed + slot * 17, INSTRUMENTS.length))];
  const volume = +(1 + seeded(seed * slot + 3, 299)).toFixed(1);

  return { name, initials, city, flag: COUNTRY_FLAGS[city] ?? "🌍", tier, profit, trades, winRate, instr, volume };
}

// 300K+ counter — realistic, updating
function useLiveCount() {
  const BASE = 312_847;
  const [count, setCount] = useState(BASE + Math.floor(Math.random() * 200));
  useEffect(() => {
    const t = setInterval(() => {
      setCount(c => c + Math.floor(Math.random() * 3));
    }, 2800);
    return () => clearInterval(t);
  }, []);
  return count;
}

// Generate leaderboard (top 50) that rotates every 12 seconds
function useLeaderboard() {
  const [epoch, setEpoch] = useState(() => Math.floor(Date.now() / 8000));
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setEpoch(Math.floor(Date.now() / 8000));
        setFade(false);
      }, 400);
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const entries = Array.from({ length: 50 }, (_, i) => ({
    rank: i + 1,
    ...generateTrader(epoch + i * 7, i),
    uid: `${epoch}-${i}`,
  })).sort((a, b) => b.profit - a.profit).map((e, i) => ({ ...e, rank: i + 1 }));

  return { entries, fade };
}

// Live activity feed
const ACTIONS = ["opened a BUY","opened a SELL","closed a position on","placed a limit on","set stop-loss on","added to watchlist"];
function useLiveFeed() {
  const [feed, setFeed] = useState<Array<{ id: number; msg: string; time: string }>>([]);
  const idRef = useRef(0);
  useEffect(() => {
    const push = () => {
      const fi = Math.floor(Math.random() * FIRST_NAMES.length);
      const li = Math.floor(Math.random() * LAST_NAMES.length);
      const ci = Math.floor(Math.random() * CITIES.length);
      const ai = Math.floor(Math.random() * ACTIONS.length);
      const ii = Math.floor(Math.random() * INSTRUMENTS.length);
      const name = `${FIRST_NAMES[fi]} ${LAST_NAMES[li][0]}.`;
      const flag = COUNTRY_FLAGS[CITIES[ci]] ?? "🌍";
      const msg = `${flag} ${name} ${ACTIONS[ai]} ${INSTRUMENTS[ii]}`;
      idRef.current++;
      setFeed(prev => [{ id: idRef.current, msg, time: "just now" }, ...prev].slice(0, 8));
    };
    push();
    const t = setInterval(push, 3500 + Math.random() * 2000);
    return () => clearInterval(t);
  }, []);
  return feed;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center"><Trophy className="w-4 h-4 text-yellow-400"/></div>;
  if (rank === 2) return <div className="w-8 h-8 rounded-full bg-slate-300/20 flex items-center justify-center"><Medal className="w-4 h-4 text-slate-300"/></div>;
  if (rank === 3) return <div className="w-8 h-8 rounded-full bg-amber-700/20 flex items-center justify-center"><Medal className="w-4 h-4 text-amber-600"/></div>;
  return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><span className="text-xs font-bold text-muted-foreground">#{rank}</span></div>;
}

const AVATAR_COLORS = ["bg-blue-500","bg-violet-500","bg-amber-500","bg-emerald-500","bg-rose-500","bg-cyan-500","bg-indigo-500","bg-pink-500","bg-teal-500","bg-orange-500"];

export function Leaderboard() {
  useEffect(() => { document.title = "Leaderboard | VelozTrade"; }, []);
  const { user } = useUser();
  const { entries, fade } = useLeaderboard();
  const liveCount = useLiveCount();
  const feed = useLiveFeed();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="w-7 h-7 text-yellow-400"/> Global Leaderboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Real-time rankings updated every 12 seconds</p>
        </div>
        <div className="flex items-center gap-2">
          {(["daily","weekly","monthly"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                period === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* Live stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Live Traders", value: liveCount.toLocaleString() + "+", icon: Users, color: "text-success", pulse: true },
          { label: "Active Positions", value: (Math.floor(liveCount * 0.08)).toLocaleString(), icon: Activity, color: "text-primary", pulse: false },
          { label: "24h Volume", value: "$" + (48.2 + Math.random() * 0.3).toFixed(1) + "B", icon: TrendingUp, color: "text-amber-400", pulse: false },
          { label: "Countries", value: "150+", icon: Globe, color: "text-violet-400", pulse: false },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-4 border border-border flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 ${s.color}`}>
              <s.icon className="w-5 h-5"/>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`font-black text-lg font-mono ${s.color}`}>{s.value}</span>
                {s.pulse && <span className="w-2 h-2 rounded-full bg-success animate-pulse"/>}
              </div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Main leaderboard */}
        <div className="lg:col-span-2 space-y-4">
          {/* Podium */}
          <div className={`transition-opacity duration-300 ${fade ? "opacity-0" : "opacity-100"}`}>
            <div className="glass-card rounded-2xl p-5 border border-border mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-4 h-4 text-yellow-400"/>
                <span className="font-bold text-sm">Top 3 Traders — {period.charAt(0).toUpperCase() + period.slice(1)}</span>
                <div className="flex items-center gap-1 ml-auto text-xs text-success">
                  <Wifi className="w-3 h-3 animate-pulse"/>
                  Live
                </div>
              </div>
              <div className="flex items-end justify-center gap-4">
                {[top3[1], top3[0], top3[2]].map((entry, idx) => {
                  const place = idx === 0 ? 2 : idx === 1 ? 1 : 3;
                  const heights = { 1: "pb-0", 2: "pb-5", 3: "pb-8" };
                  const sizes = { 1: "w-20 h-20 text-xl", 2: "w-16 h-16 text-base", 3: "w-14 h-14 text-sm" };
                  const colorIdx = (entry.rank - 1) % AVATAR_COLORS.length;
                  return (
                    <motion.div
                      key={entry.uid + place}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (3 - place) * 0.1 }}
                      className={`flex flex-col items-center gap-2 ${heights[place as 1|2|3]}`}
                    >
                      <div className={`relative rounded-2xl ${AVATAR_COLORS[colorIdx]} flex items-center justify-center font-black text-white ${sizes[place as 1|2|3]} border-4 ${place === 1 ? "border-yellow-400/60" : place === 2 ? "border-slate-400/40" : "border-amber-700/40"}`}>
                        {entry.initials}
                        {place === 1 && <span className="absolute -top-4 text-2xl">👑</span>}
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-sm">{entry.name}</div>
                        <div className="text-xs text-success font-mono font-bold">+{entry.profit}%</div>
                        <div className={`text-[10px] font-semibold ${TIER_COLORS[entry.tier]}`}>{entry.tier}</div>
                        <div className="text-[10px] text-muted-foreground">{entry.flag} {entry.city}</div>
                      </div>
                      <RankBadge rank={place}/>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Ranks 4-50 */}
            <div className="glass-card rounded-2xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
              <div className="min-w-[420px]">
              <div className="grid grid-cols-12 px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest border-b border-border bg-muted/20">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Trader</div>
                <div className="col-span-2 text-right">Return</div>
                <div className="col-span-2 text-right">Win%</div>
                <div className="col-span-2 text-right">Trades</div>
              </div>
              <div className="divide-y divide-border/40 max-h-[480px] overflow-y-auto">
                {rest.map((entry, i) => {
                  const colorIdx = (entry.rank - 1) % AVATAR_COLORS.length;
                  return (
                    <div key={entry.uid} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-muted/20 transition-colors">
                      <div className="col-span-1 text-xs font-bold text-muted-foreground">#{entry.rank}</div>
                      <div className="col-span-5 flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg ${AVATAR_COLORS[colorIdx]} flex items-center justify-center text-white text-[10px] font-black shrink-0`}>
                          {entry.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{entry.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{entry.flag} {entry.city} · <span className={TIER_COLORS[entry.tier]}>{entry.tier}</span></div>
                        </div>
                      </div>
                      <div className="col-span-2 text-right font-mono text-xs text-success font-bold">+{entry.profit}%</div>
                      <div className="col-span-2 text-right text-xs text-muted-foreground">{entry.winRate}%</div>
                      <div className="col-span-2 text-right text-xs text-muted-foreground">{entry.trades}</div>
                    </div>
                  );
                })}
              </div>
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Live activity */}
          <div className="glass-card rounded-2xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-primary"/>
              <span className="font-bold text-sm">Live Activity</span>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"/>
                Live
              </span>
            </div>
            <div className="space-y-2">
              <AnimatePresence>
                {feed.map(item => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-muted-foreground py-1.5 border-b border-border/30 last:border-0 leading-relaxed"
                  >
                    {item.msg}
                    <span className="text-[10px] text-muted-foreground/50 ml-1">just now</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Your rank (placeholder) */}
          <div className="glass-card rounded-2xl p-4 border border-primary/20">
            <div className="font-bold text-sm mb-3">Your Position</div>
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mx-auto mb-2 text-xl font-black text-primary">
                {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="font-bold text-sm">{user?.firstName ?? "You"}</div>
              <div className="text-xs text-muted-foreground mt-1">Make your first trade to appear on the leaderboard</div>
              <div className="mt-3 text-xs text-primary font-semibold">→ Start Trading to Rank</div>
            </div>
          </div>

          {/* Update interval indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <RefreshCw className="w-3 h-3"/>
            Rankings refresh every 8 seconds · {liveCount.toLocaleString()}+ active traders
          </div>
        </div>
      </div>
    </div>
  );
}

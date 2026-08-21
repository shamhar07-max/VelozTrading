import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { Heart, MessageCircle, Share2, TrendingUp, TrendingDown, Image, Send, MoreHorizontal, Bookmark, Repeat2, BadgeCheck, Users, Zap, X, Loader2 } from "lucide-react";
import { InstrumentIcon } from "@/components/instrument-icon";
import { formatPrice } from "@/lib/symbol";
import { useWebSocket } from "@/hooks/use-websocket";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateSocialPost, useListSocialPosts, getListSocialPostsQueryKey } from "@workspace/api-client-react";
import type { SocialPost } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

// ── Seed-based fake social data ──────────────────────────────────────────────
const TRADERS = [
  { id:"t1", name:"Marcus Reynolds", handle:"marcusfx", tier:"VIP", flag:"🇬🇧", avatar:"MR", color:"bg-violet-600", verified:true, followers:"12.4K", winRate:87, copied:834 },
  { id:"t2", name:"Sofia Chen", handle:"sofiacrypto", tier:"Platinum", flag:"🇸🇬", avatar:"SC", color:"bg-emerald-600", verified:true, followers:"9.1K", winRate:82, copied:601 },
  { id:"t3", name:"Ahmed Al-Rashid", handle:"ahmedtrades", tier:"Gold", flag:"🇦🇪", avatar:"AA", color:"bg-amber-600", verified:false, followers:"4.8K", winRate:74, copied:312 },
  { id:"t4", name:"Isabella Müller", handle:"isabellafx", tier:"Platinum", flag:"🇩🇪", avatar:"IM", color:"bg-blue-600", verified:true, followers:"7.3K", winRate:79, copied:488 },
  { id:"t5", name:"James Okonkwo", handle:"jamesgold", tier:"VIP", flag:"🇳🇬", avatar:"JO", color:"bg-rose-600", verified:true, followers:"18.2K", winRate:91, copied:1204 },
  { id:"t6", name:"Yuki Tanaka", handle:"yukitrader", tier:"Gold", flag:"🇯🇵", avatar:"YT", color:"bg-cyan-600", verified:false, followers:"3.2K", winRate:71, copied:198 },
];

const SYMBOLS = ["EUR/USD","BTC/USD","XAU/USD","SPX","ETH/USD","GBP/USD","AAPL","NVDA","SOL/USD","NAS100"];

// Dynamic time labels that update
function timeAgo(minutesAgo: number): string {
  const now = Date.now();
  const offset = (Math.floor(now / 30000) % 5) * 2; // shifts every 30s
  const mins = minutesAgo + offset;
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

const SAMPLE_POSTS = [
  { traderId:"t1", symbol:"XAU/USD", direction:"buy" as const, entry:2318.40, tp:2345.00, sl:2305.00, text:"Gold breaking above key resistance. Fed dovish signals + geopolitical risk = classic flight-to-safety setup. Targeting 2345 with tight SL at 2305. R:R is almost 2:1 here. 🥇", likes:247, comments:38, time:timeAgo(4), pnl:+1.8 },
  { traderId:"t5", symbol:"BTC/USD", direction:"buy" as const, entry:67420, tp:71000, sl:65500, text:"Bitcoin consolidating above 67K — this is the launchpad. ETF inflows still strong, halving supply shock playing out. Long with conviction. 🚀 #Bitcoin #Crypto", likes:412, comments:67, time:timeAgo(12), pnl:+3.2 },
  { traderId:"t2", symbol:"EUR/USD", direction:"sell" as const, entry:1.08750, tp:1.08200, sl:1.09100, text:"ECB still dovish vs Fed. EUR/USD rejecting 1.088 resistance for the third time this week. Selling the retest. My target: 1.082. Watch CPI Friday.", likes:183, comments:29, time:timeAgo(31), pnl:-0.4 },
  { traderId:"t4", symbol:"NVDA", direction:"buy" as const, entry:875.40, tp:920.00, sl:850.00, text:"NVIDIA earnings beat expectations by 20%. AI spending cycle is nowhere near done. Adding to my position on the dip. 🤖📈 #NVDA #AI", likes:334, comments:52, time:timeAgo(65), pnl:+5.1 },
  { traderId:"t3", symbol:"GBP/USD", direction:"sell" as const, entry:1.27320, tp:1.26800, sl:1.27700, text:"Cable looking heavy after UK CPI miss. BoE less hawkish than market expected. Short setup with 38-pip target. Will close before NFP Friday.", likes:96, comments:14, time:timeAgo(125), pnl:+0.9 },
  { traderId:"t6", symbol:"ETH/USD", direction:"buy" as const, entry:3480, tp:3700, sl:3350, text:"Ethereum spot ETF speculation heating up again. On-chain activity picking up. ETH/BTC ratio starting to recover. Taking a swing here. 🔷", likes:157, comments:23, time:timeAgo(180), pnl:+2.3 },
  { traderId:"t1", symbol:"SPX", direction:"sell" as const, entry:5218, tp:5150, sl:5260, text:"S&P 500 overbought on weekly RSI. Earnings season priced in. Taking short exposure via index with SL above this week's high. Cautious sizing.", likes:201, comments:31, time:timeAgo(300), pnl:-1.1 },
];

const NEWS_FEED = [
  { source:"Reuters", headline:"Federal Reserve holds rates steady, signals 2 cuts in 2026", time:"8m ago", tag:"Forex", sentiment:"neutral" },
  { source:"Bloomberg", headline:"Bitcoin surges past $68,000 as ETF inflows hit monthly high", time:"22m ago", tag:"Crypto", sentiment:"bullish" },
  { source:"CNBC", headline:"NVIDIA reports record quarterly revenue driven by AI chip demand", time:"45m ago", tag:"Stocks", sentiment:"bullish" },
  { source:"FT", headline:"ECB minutes reveal split on pace of rate cuts this year", time:timeAgo(65), tag:"Forex", sentiment:"bearish" },
  { source:"Reuters", headline:"Gold climbs as geopolitical tensions in Middle East intensify", time:timeAgo(125), tag:"Commodities", sentiment:"bullish" },
  { source:"Bloomberg", headline:"UK GDP contracts 0.1% in Q1 — recession fears resurface", time:timeAgo(180), tag:"Forex", sentiment:"bearish" },
];

const TIER_COLORS: Record<string,string> = { VIP:"text-violet-400", Platinum:"text-amber-400", Gold:"text-primary", Silver:"text-slate-400" };

function TraderAvatar({ t, size=36 }: { t: typeof TRADERS[0]; size?: number }) {
  return (
    <div className={`${t.color} rounded-full flex items-center justify-center text-white font-black shrink-0`} style={{ width:size, height:size, fontSize:size*0.33 }}>
      {t.avatar}
    </div>
  );
}

function PostCard({ post, prices }: { post: typeof SAMPLE_POSTS[0]; prices: Record<string,any> }) {
  const trader = TRADERS.find(t => t.id === post.traderId)!;
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(post.likes);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const liveKey = post.symbol.replace("/","");
  const livePrice = prices[liveKey]?.price;
  const livePnl = livePrice ? (post.direction === "buy" ? (livePrice - post.entry) / post.entry * 100 : (post.entry - livePrice) / post.entry * 100) : post.pnl;
  const isProfit = livePnl >= 0;

  return (
    <motion.div
      initial={{ opacity:0, y:16 }}
      animate={{ opacity:1, y:0 }}
      className="glass-card rounded-2xl border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <TraderAvatar t={trader} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sm">{trader.name}</span>
            {trader.verified && <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0"/>}
            <span className="text-xs text-muted-foreground">@{trader.handle}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 ${TIER_COLORS[trader.tier]}`}>{trader.tier}</span>
            <span className="text-xs text-muted-foreground ml-auto">{post.time}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
            <span>Win {trader.winRate}%</span>
            <span>·</span>
            <span>{trader.followers} followers</span>
            <span>·</span>
            <span>{trader.copied} copying</span>
          </div>
        </div>
        <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <MoreHorizontal className="w-4 h-4"/>
        </button>
      </div>

      {/* Trade card */}
      <div className="mx-4 mb-3 p-3 rounded-xl bg-muted/30 border border-border/50">
        <div className="flex items-center gap-3 mb-2">
          <InstrumentIcon symbol={post.symbol} size={28}/>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{post.symbol}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${post.direction==="buy" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                {post.direction.toUpperCase()}
              </span>
              <span className={`text-xs font-mono font-bold ml-auto ${isProfit ? "text-success" : "text-destructive"}`}>
                {isProfit ? "+" : ""}{livePnl.toFixed(2)}%
              </span>
            </div>
            <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground font-mono">
              <span>Entry: {formatPrice(post.entry, post.symbol)}</span>
              <span className="text-success">TP: {formatPrice(post.tp, post.symbol)}</span>
              <span className="text-destructive">SL: {formatPrice(post.sl, post.symbol)}</span>
            </div>
          </div>
        </div>
        {livePrice && (
          <div className="text-[10px] text-muted-foreground font-mono">
            Live: <span className="font-bold text-foreground">{formatPrice(livePrice, post.symbol)}</span>
          </div>
        )}
      </div>

      {/* Post text */}
      <div className="px-4 mb-3 text-sm text-foreground/90 leading-relaxed">{post.text}</div>

      {/* Actions */}
      <div className="px-4 pb-3 flex items-center gap-1 border-t border-border/30 pt-3">
        <button
          onClick={() => { setLiked(!liked); setLikes(l => liked ? l-1 : l+1); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:bg-muted ${liked ? "text-rose-500" : "text-muted-foreground"}`}
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-rose-500" : ""}`}/> {likes.toLocaleString()}
        </button>
        <button
          onClick={() => setShowComment(!showComment)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
        >
          <MessageCircle className="w-4 h-4"/> {post.comments}
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
          <Repeat2 className="w-4 h-4"/>
        </button>
        <button
          onClick={() => setSaved(!saved)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:bg-muted ml-auto ${saved ? "text-primary" : "text-muted-foreground"}`}
        >
          <Bookmark className={`w-4 h-4 ${saved ? "fill-primary" : ""}`}/>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
          <Share2 className="w-4 h-4"/>
        </button>
      </div>

      {showComment && (
        <div className="px-4 pb-4 flex gap-2">
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary"
          />
          <button
            onClick={() => setComment("")}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90"
          >
            <Send className="w-3.5 h-3.5"/>
          </button>
        </div>
      )}
    </motion.div>
  );
}

export function SocialFeed() {
  useEffect(() => { document.title = "Social Feed | VelozTrade"; }, []);
  const { user } = useUser();
  const { prices } = useWebSocket();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"feed"|"news">("feed");
  const [modalOpen, setModalOpen] = useState(false);
  const [postText, setPostText] = useState("");
  const [symbol, setSymbol] = useState("EUR/USD");
  const [myPosts, setMyPosts] = useState<SocialPost[]>([]);
  const createPost = useCreateSocialPost();
  const { data: fetchedMyPosts } = useListSocialPosts();

  useEffect(() => {
    if (Array.isArray(fetchedMyPosts)) setMyPosts(fetchedMyPosts);
  }, [fetchedMyPosts]);

  function handlePost() {
    if (!postText.trim() || createPost.isPending) return;
    createPost.mutate(
      { data: { content: postText.trim(), symbol: symbol || null } },
      {
        onSuccess: (newPost) => {
          setMyPosts(prev => [newPost, ...prev]);
          setPostText("");
          setModalOpen(false);
          queryClient.invalidateQueries({ queryKey: getListSocialPostsQueryKey() });
        },
      }
    );
  }

  function openModal() { setPostText(""); setSymbol("EUR/USD"); setModalOpen(true); }

  return (
    <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-5">
      {/* Main feed */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Social Feed</h1>
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            {(["feed","news"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${tab===t ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>{t==="feed" ? "📊 Trades" : "📰 News"}</button>
            ))}
          </div>
        </div>

        {tab === "feed" && (
          <>
            {/* Post Trade Idea trigger */}
            <div className="glass-card rounded-2xl border border-border p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shrink-0">
                {(user?.firstName?.[0] ?? "U").toUpperCase()}
              </div>
              <button
                onClick={openModal}
                className="flex-1 text-left text-sm text-muted-foreground bg-muted/40 border border-border rounded-xl px-4 py-2.5 hover:border-primary/50 hover:bg-muted/60 transition-all"
              >
                Share a trade idea, analysis, or market outlook…
              </button>
              <button
                onClick={openModal}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                Post Trade Idea
              </button>
            </div>

            {/* Compose Modal */}
            <AnimatePresence>
              {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl"
                  >
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                      <h3 className="font-bold text-base">Post Trade Idea</h3>
                      <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                        <X className="w-4 h-4"/>
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Symbol</label>
                        <select
                          value={symbol}
                          onChange={e => setSymbol(e.target.value)}
                          className="w-full text-sm bg-muted/40 border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary"
                        >
                          {SYMBOLS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                          Your Analysis <span className="font-normal normal-case">(max 500 chars)</span>
                        </label>
                        <textarea
                          value={postText}
                          onChange={e => setPostText(e.target.value)}
                          placeholder="Share your trade idea, market analysis, or outlook…"
                          rows={5}
                          maxLength={500}
                          className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-primary"
                          autoFocus
                        />
                        <div className="text-right text-[10px] text-muted-foreground mt-1">{postText.length}/500</div>
                      </div>
                    </div>
                    <div className="flex gap-2 px-5 pb-5">
                      <button
                        onClick={() => setModalOpen(false)}
                        className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/40 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={!postText.trim() || createPost.isPending}
                        onClick={handlePost}
                        className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {createPost.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/> Publishing…</> : "Publish"}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {myPosts.length > 0 && (
              <div className="space-y-4">
                {myPosts.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card rounded-2xl border border-primary/30 overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shrink-0">
                          {(user?.firstName?.[0] ?? "U").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-sm">{user?.fullName ?? "You"}</span>
                          {p.symbol && (
                            <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p.symbol}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">{p.content}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="space-y-4">
              {SAMPLE_POSTS.map((post, i) => <PostCard key={i} post={post} prices={prices}/>)}
            </div>
          </>
        )}

        {tab === "news" && (
          <div className="space-y-3">
            {NEWS_FEED.map((n, i) => (
              <div key={i} className="glass-card rounded-2xl border border-border p-4 hover:border-primary/30 transition-all cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 mt-0.5 ${n.sentiment==="bullish" ? "bg-success/10 text-success" : n.sentiment==="bearish" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                    {n.sentiment === "bullish" ? "📈" : n.sentiment === "bearish" ? "📉" : "📊"} {n.tag}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-snug">{n.headline}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span className="font-bold">{n.source}</span>
                      <span>·</span>
                      <span>{n.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div className="space-y-4">
        {/* Top Traders */}
        <div className="glass-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-bold text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary"/> Top Traders to Follow
          </div>
          <div className="divide-y divide-border/40">
            {TRADERS.slice(0, 5).map(t => (
              <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                <TraderAvatar t={t} size={32}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-xs truncate">{t.name}</span>
                    {t.verified && <BadgeCheck className="w-3 h-3 text-primary shrink-0"/>}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{t.flag} Win {t.winRate}% · {t.followers} followers</div>
                </div>
                <button className="text-xs font-bold px-3 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all shrink-0">
                  Follow
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live market snapshot */}
        <div className="glass-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-bold text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-primary"/> Market Buzz
          </div>
          <div className="p-4 space-y-2">
            {[{ sym:"EUR/USD",key:"EURUSD" },{ sym:"BTC/USD",key:"BTCUSD" },{ sym:"XAU/USD",key:"XAUUSD" },{ sym:"SPX",key:"SPX" }].map(m => {
              const q = prices[m.key];
              return (
                <div key={m.key} className="flex items-center gap-2">
                  <InstrumentIcon symbol={m.sym} size={20}/>
                  <span className="text-xs font-semibold flex-1">{m.sym}</span>
                  <span className="text-xs font-mono">{q ? formatPrice(q.price, m.sym) : "—"}</span>
                  <span className={`text-[10px] font-bold ${q?.changePercent >= 0 ? "text-success" : "text-destructive"}`}>
                    {q ? `${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

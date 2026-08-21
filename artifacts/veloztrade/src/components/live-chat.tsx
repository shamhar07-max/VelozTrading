import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, Minimize2, User, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Message { role: "user"|"bot"; text: string; time: string; }

function now() { return new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" }); }

const QUICK_REPLIES = [
  "How do I deposit?",
  "How does AutoCopy work?",
  "What leverage is available?",
  "How to complete KYC?",
  "What is the minimum deposit?",
  "How do I switch to demo account?",
];

const STATIC_ANSWERS: Record<string, string> = {
  deposit: "To deposit: go to **Deposit** in the left nav → choose a payment method (Easypaisa, USDT, etc.) → scan the QR code → send payment → submit your transaction details. Deposits are credited after verification, usually within 1–24 hours. 💳",
  autocopy: "AutoCopy lets you mirror top traders automatically! Go to **AutoCopy** in the nav → browse traders by win rate, return, and risk score → click **AutoCopy** → set your copy amount and max loss limit → their trades will open in your account. A 20% performance fee applies only on profits. 🔁",
  leverage: "Leverage is fixed by asset class:\n• Forex: **1:1000**\n• Commodities: **1:100**\n• Stocks: **1:10**\n• Indices: **1:10**\n• Crypto: **1:5**\n\nThis is consistent across all account types. ⚡",
  kyc: "For KYC verification: go to **Profile** → click **Verify Identity** → upload your government-issued ID (front) + proof of address + a selfie with your ID. Verification usually takes 1–3 business days. 🪪",
  minimum: "Minimum deposits by account tier:\n• **Silver**: $250\n• **Gold**: $2,500\n• **Platinum**: $10,000\n• **VIP**: $50,000\n\nDemo account: FREE with $10,000 virtual funds. 💰",
  demo: "To switch to demo: go to **Profile** → toggle **Account Mode** to Demo. Switching is instant — no KYC required. Your demo balance is **$10,000 virtual funds**. Switch back to Live anytime with one click. 🔄",
  withdrawal: "Withdrawals: go to **Withdraw** in the nav → enter amount and select method → submit. Minimum $10. Processed in 1–3 business days. Your KYC must be completed first. 📤",
  support: "You can reach our team via:\n• **Email**: support@veloztrade.com\n• **Telegram**: @VelozTrade\n• **Contact Form**: Help & Support page\n\nWe respond within 24 hours. ⚡",
};

function getBotReply(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("deposit") || lower.includes("fund")) return STATIC_ANSWERS.deposit;
  if (lower.includes("autocopy") || lower.includes("copy trad") || lower.includes("copy trader")) return STATIC_ANSWERS.autocopy;
  if (lower.includes("leverage") || lower.includes("margin")) return STATIC_ANSWERS.leverage;
  if (lower.includes("kyc") || lower.includes("verif") || lower.includes("document")) return STATIC_ANSWERS.kyc;
  if (lower.includes("minimum") || lower.includes("min deposit")) return STATIC_ANSWERS.minimum;
  if (lower.includes("demo") || lower.includes("switch") || lower.includes("virtual")) return STATIC_ANSWERS.demo;
  if (lower.includes("withdraw") || lower.includes("cashout") || lower.includes("cash out")) return STATIC_ANSWERS.withdrawal;
  if (lower.includes("support") || lower.includes("help") || lower.includes("contact") || lower.includes("email")) return STATIC_ANSWERS.support;
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) return "Hello! 👋 I'm VelozBot, your trading assistant. How can I help you today? You can ask about deposits, withdrawals, leverage, KYC, AutoCopy, or anything else!";
  if (lower.includes("thank")) return "You're welcome! Is there anything else I can help you with? 😊";
  if (lower.includes("spread") || lower.includes("fee") || lower.includes("commission")) return "**Fees at VelozTrade:**\n• Silver: 0.5–0.7 pip spreads, $0 commission\n• Gold: raw spreads + $3/lot commission\n• Platinum: from 0.1 pips + $1.50/lot\n• VIP: 0.0 pips, volume-based\n• Inactivity: $10/month after 12 months\n\nPlatform deposit/withdrawal fee: **$0** 🎉";
  // Fallback to AI
  return "__AI__";
}

async function getAIReply(messages: Message[]): Promise<string> {
  try {
    const res = await fetch(`${BASE_PATH}/api/anthropic/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: "You are VelozBot, the helpful support assistant for VelozTrade, a professional CFD trading platform. Be concise, friendly, and helpful. Answer only trading and platform-related questions. If asked about specifics: leverage is Forex 1:1000, Crypto 1:5, Stocks 1:10, Indices 1:10, Commodities 1:100. Min deposit Silver $250, Gold $2,500, Platinum $10,000, VIP $50,000. Demo has $10,000 virtual. Keep replies under 100 words. Use simple markdown like **bold**.",
        messages: messages.filter(m => m.role !== "bot" || m.text !== "__AI__").map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.content?.[0]?.text ?? "I'm having trouble connecting. Please try again or contact support@veloztrade.com 🙏";
  } catch {
    return "I'm having trouble connecting right now. Please contact our team at support@veloztrade.com or use the Help & Support page. 🙏";
  }
}

function formatText(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <span key={i}>
        {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
        {i < text.split('\n').length - 1 && <br/>}
      </span>
    );
  });
}

export function LiveChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role:"bot", text:"Hi! 👋 I'm **VelozBot**, your 24/7 trading assistant. I can help with deposits, withdrawals, AutoCopy, leverage, KYC, and more. What would you like to know?", time:now() },
  ]);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setUnread(0); bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }
  }, [open, messages]);

  // Register global open function
  useEffect(() => { (window as any).__openLiveChat = () => setOpen(true); return () => { delete (window as any).__openLiveChat; }; }, []);

  const send = async (text: string) => {
    if (!text.trim() || thinking) return;
    const userMsg: Message = { role:"user", text, time:now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    const staticReply = getBotReply(text);
    if (staticReply !== "__AI__") {
      await new Promise(r => setTimeout(r, 600));
      const botMsg: Message = { role:"bot", text:staticReply, time:now() };
      setMessages(prev => [...prev, botMsg]);
      if (!open) setUnread(u => u+1);
    } else {
      const allMsgs = [...messages, userMsg];
      const reply = await getAIReply(allMsgs);
      const botMsg: Message = { role:"bot", text:reply, time:now() };
      setMessages(prev => [...prev, botMsg]);
      if (!open) setUnread(u => u+1);
    }
    setThinking(false);
    setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, 100);
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale:0, opacity:0 }}
            animate={{ scale:1, opacity:1 }}
            exit={{ scale:0, opacity:0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 w-14 h-14 rounded-full bg-primary shadow-[0_0_24px_rgba(0,114,255,0.4)] flex items-center justify-center hover:bg-primary/90 transition-all"
          >
            <MessageCircle className="w-6 h-6 text-white"/>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white text-[10px] font-black flex items-center justify-center">{unread}</span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity:0, y:20, scale:0.95 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:20, scale:0.95 }}
            className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 w-[calc(100vw-2rem)] sm:w-96 flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-border"
            style={{ maxHeight: minimized ? "auto" : "min(600px, calc(100vh - 120px))" }}
          >
            {/* Header */}
            <div className="bg-primary px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm">VelozBot Support</div>
                <div className="text-[11px] text-white/70 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse"/> Online 24/7</div>
              </div>
              <button onClick={() => setMinimized(!minimized)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 transition-colors">
                {minimized ? <ChevronDown className="w-4 h-4"/> : <Minimize2 className="w-4 h-4"/>}
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 transition-colors">
                <X className="w-4 h-4"/>
              </button>
            </div>

            {!minimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-card min-h-0">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-primary" : "bg-muted border border-border"}`}>
                        {msg.role === "user" ? <User className="w-3.5 h-3.5 text-white"/> : <Bot className="w-3.5 h-3.5 text-muted-foreground"/>}
                      </div>
                      <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                        <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${msg.role === "user" ? "bg-primary text-white rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"}`}>
                          {formatText(msg.text)}
                        </div>
                        <span className="text-[10px] text-muted-foreground px-1">{msg.time}</span>
                      </div>
                    </div>
                  ))}
                  {thinking && (
                    <div className="flex gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5 text-muted-foreground"/>
                      </div>
                      <div className="px-3 py-2 bg-muted rounded-2xl rounded-tl-sm flex items-center gap-1">
                        {[0,1,2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay:`${i*0.15}s`}}/>
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef}/>
                </div>

                {/* Quick replies */}
                {messages.length <= 2 && (
                  <div className="px-4 py-2 bg-card border-t border-border flex gap-1.5 overflow-x-auto scrollbar-none shrink-0">
                    {QUICK_REPLIES.map(qr => (
                      <button key={qr} onClick={() => send(qr)} className="px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-[10px] font-semibold whitespace-nowrap hover:bg-primary/10 transition-all shrink-0">
                        {qr}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="p-3 bg-card border-t border-border flex gap-2 shrink-0">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if(e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    placeholder="Ask anything…"
                    className="flex-1 bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary"
                    disabled={thinking}
                  />
                  <button
                    onClick={() => send(input)}
                    disabled={!input.trim() || thinking}
                    className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-40"
                  >
                    <Send className="w-4 h-4 text-white"/>
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

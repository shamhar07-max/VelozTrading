import { useEffect, useState } from "react";
import { MessageCircle, Mail, Phone, Clock, Send, CheckCircle, HelpCircle, Search, ChevronDown, ChevronUp, FileText, Globe, Shield } from "lucide-react";

const FAQ = [
  { q:"How do I deposit funds?", a:"Go to Deposit in the left navigation. Choose your preferred payment method — Easypaisa, USDT (ERC-20 or Solana), or other available options. Scan the QR code and send the payment, then fill in your transaction details. Your deposit will be credited after admin verification, typically within 1–24 hours." },
  { q:"How long does withdrawal take?", a:"Withdrawals are processed within 1–3 business days. E-wallets may be faster (24 hours). Ensure your KYC is complete — withdrawals are only processed for verified accounts. Minimum withdrawal is $10 USD." },
  { q:"How do I switch between Demo and Live accounts?", a:"Go to Profile → Account Mode and toggle the switch. Switching is instant — no KYC required to switch back to live. Your demo account has a $10,000 virtual balance. Live accounts use real funds." },
  { q:"What leverage does VelozTrade offer?", a:"Leverage is fixed by asset class: Forex 1:1000, Commodities 1:100, Stocks 1:10, Indices 1:10, Cryptocurrency 1:5. This is consistent across all account types and is not user-adjustable." },
  { q:"How does AutoCopy trading work?", a:"Go to AutoCopy in the navigation. Browse the top traders, review their performance stats, win rate, and risk score. Click AutoCopy, set your copy amount and stop-loss percentage. Their trades will automatically mirror in your account. A performance fee of 20% applies on profitable copied trades only." },
  { q:"What documents do I need for KYC?", a:"You need a valid government-issued photo ID (passport, national ID, or driver's license) and proof of address (utility bill or bank statement dated within 3 months). A selfie holding your ID is also required. Upload in Profile → Identity Verification." },
  { q:"Is my money safe?", a:"Yes. Client funds are held in segregated bank accounts completely separate from company operational funds. VelozTrade is regulated by the FSCA (License No. 51748). We provide negative balance protection to all retail clients." },
  { q:"Can I use VelozTrade on mobile?", a:"Yes. VelozTrade is fully responsive and works on all mobile browsers on iOS and Android. Simply navigate to the site on your phone's browser. No app download is required." },
  { q:"What is the minimum deposit?", a:"Silver accounts require a minimum of $250. Gold: $2,500. Platinum: $10,000. VIP: $50,000. A demo account requires no deposit and comes with $10,000 virtual funds." },
  { q:"How do trading signals work?", a:"Trading signals are AI-generated buy/sell recommendations based on technical analysis patterns. They refresh every 30 seconds and show confidence level, risk:reward ratio, timeframe, and the strategy that triggered them. Signals are for educational purposes — always conduct your own analysis." },
];

type Priority = "low"|"medium"|"high";
type Category = "general"|"deposit"|"withdrawal"|"trading"|"technical"|"kyc"|"account";

export function Support() {
  useEffect(() => { document.title = "Support | VelozTrade"; }, []);
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number|null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", category:"general" as Category, priority:"medium" as Priority, subject:"", message:"" });

  const filteredFaq = FAQ.filter(f => !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.message) return;
    setSubmitting(true);
    // Simulate API call
    setTimeout(() => { setSubmitting(false); setSubmitted(true); }, 1500);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><HelpCircle className="w-7 h-7 text-primary"/> Help & Support</h1>
        <p className="text-muted-foreground mt-1 text-sm">We're here to help 24/7. Browse FAQs or contact our support team.</p>
      </div>

      {/* Contact options */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon:MessageCircle, title:"Live Chat", desc:"Chat with our support team in real-time. Usually replies in under 2 minutes.", action:"Start Chat", onClick:() => (window as any).__openLiveChat?.(), color:"text-primary bg-primary/10" },
          { icon:Mail, title:"Email Support", desc:"Send us an email and we'll respond within 24 hours.", action:"support@veloztrade.com", onClick:()=>window.open("mailto:support@veloztrade.com"), color:"text-success bg-success/10" },
          { icon:Globe, title:"Telegram", desc:"Join our community for support, news, and trading discussions.", action:"Join @VelozTrade", onClick:()=>window.open("https://t.me/veloztrade","_blank"), color:"text-blue-400 bg-blue-500/10" },
        ].map(c => (
          <div key={c.title} className="glass-card rounded-2xl border border-border p-5 flex flex-col">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${c.color}`}><c.icon className="w-5 h-5"/></div>
            <div className="font-bold mb-1">{c.title}</div>
            <p className="text-xs text-muted-foreground flex-1 leading-relaxed mb-3">{c.desc}</p>
            <button onClick={c.onClick} className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1">{c.action} →</button>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Contact form */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Send className="w-5 h-5 text-primary"/> Contact Form</h2>
          {submitted ? (
            <div className="glass-card rounded-2xl border border-success/30 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-success"/></div>
              <h3 className="font-bold text-lg mb-2">Ticket Submitted!</h3>
              <p className="text-sm text-muted-foreground mb-4">We've received your message and will respond to <span className="font-semibold text-foreground">{form.email}</span> within 24 hours.</p>
              <p className="text-xs text-muted-foreground mb-6">Ticket reference: <span className="font-mono font-bold">VT-{Date.now().toString().slice(-6)}</span></p>
              <button onClick={() => { setSubmitted(false); setForm({name:"",email:"",category:"general",priority:"medium",subject:"",message:""}); }} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90">Submit Another</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="glass-card rounded-2xl border border-border p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Full Name *</label>
                  <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name" className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email Address *</label>
                  <input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com" className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"/>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Category *</label>
                  <select value={form.category} onChange={e=>setForm({...form,category:e.target.value as Category})} className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                    <option value="general">General Enquiry</option>
                    <option value="deposit">Deposit Issue</option>
                    <option value="withdrawal">Withdrawal Issue</option>
                    <option value="trading">Trading Problem</option>
                    <option value="technical">Technical Issue</option>
                    <option value="kyc">KYC / Verification</option>
                    <option value="account">Account Management</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Priority</label>
                  <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Priority})} className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                    <option value="low">Low — General question</option>
                    <option value="medium">Medium — Account issue</option>
                    <option value="high">High — Urgent / Funds affected</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Subject *</label>
                <input required value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Brief description of your issue" className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"/>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Message *</label>
                <textarea required rows={5} value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="Please describe your issue in detail. Include account email, transaction IDs, and screenshots if relevant." className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:border-primary resize-none"/>
              </div>
              <button type="submit" disabled={submitting} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? "Submitting…" : <><Send className="w-4 h-4"/> Submit Support Ticket</>}
              </button>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Shield className="w-3 h-3 shrink-0"/>
                Response within 24 hours. High-priority tickets addressed first.
              </div>
            </form>
          )}
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-primary"/> Frequently Asked Questions</h2>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search FAQs…" className="w-full pl-9 pr-3 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"/>
          </div>
          <div className="space-y-2">
            {filteredFaq.map((f,i) => (
              <div key={i} className="glass-card rounded-xl border border-border overflow-hidden">
                <button onClick={()=>setOpenFaq(openFaq===i?null:i)} className="w-full text-left px-4 py-3.5 flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm leading-snug">{f.q}</span>
                  {openFaq===i ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5"/> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5"/>}
                </button>
                {openFaq===i && <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-3">{f.a}</div>}
              </div>
            ))}
            {filteredFaq.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">No FAQs match your search.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

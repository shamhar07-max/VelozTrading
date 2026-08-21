import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { Gift, Copy, Check, DollarSign, Facebook, Mail, Twitter, Share2, Loader2, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ReferralStats {
  isPartner: boolean;
  referralCode: string;
  referralLink: string;
  referredCount: number;
}

export function Referral() {
  useEffect(() => { document.title = "Refer a Friend | VelozTrade"; }, []);
  const [copied, setCopied] = useState(false);

  const { data: stats, isLoading } = useQuery<ReferralStats>({
    queryKey: ["referral-stats"],
    queryFn: async () => {
      const res = await fetch("/api/referral/stats");
      if (!res.ok) throw new Error("Failed to load referral stats");
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground"/>
      </div>
    );
  }

  if (stats?.isPartner) {
    return <Redirect to="/partner" />;
  }

  const refLink = stats?.referralLink ?? "";
  const refCode = stats?.referralCode ?? "";
  const referredCount = stats?.referredCount ?? 0;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Gift className="w-7 h-7 text-primary"/> Refer a Friend</h1>
        <p className="text-muted-foreground mt-1 text-sm">Share your link and earn rewards when friends deposit.</p>
      </div>

      {/* Live stat */}
      <div className="glass-card rounded-2xl border border-border p-5 flex items-center gap-5">
        <div className="p-3 rounded-xl bg-primary/10">
          <Users className="w-6 h-6 text-primary"/>
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Friends Referred</div>
          {isLoading ? <Skeleton className="h-8 w-16"/> : (
            <div className="text-3xl font-black font-mono text-primary">{referredCount}</div>
          )}
        </div>
        <div className="ml-auto text-xs text-muted-foreground text-right hidden sm:block">
          <p>Your code: <span className="font-mono font-bold text-foreground">{refCode}</span></p>
          <p className="mt-0.5">Counts confirmed sign-ups via your link</p>
        </div>
      </div>

      {/* How it works */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { step:"1", icon:"🔗", title:"Share your link", desc:"Copy your unique referral link and share it with friends via any channel." },
          { step:"2", icon:"👤", title:"Friend signs up", desc:"Your friend registers using your link and verifies their account." },
          { step:"3", icon:"💰", title:"Both earn rewards", desc:"When your friend deposits $25+, you both receive a bonus credited to your accounts." },
        ].map(s => (
          <div key={s.step} className="glass-card rounded-2xl border border-border p-5 text-center">
            <div className="text-3xl mb-3">{s.icon}</div>
            <div className="font-bold mb-1">{s.title}</div>
            <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="glass-card rounded-2xl border border-primary/20 p-6 space-y-4">
        <h2 className="font-bold text-lg">Your Referral Link</h2>
        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-muted-foreground font-semibold mb-0.5">Referral Link</div>
            {isLoading ? <Skeleton className="h-4 w-full mt-1"/> : (
              <div className="font-mono text-sm text-primary truncate">{refLink}</div>
            )}
          </div>
          <button
            onClick={() => handleCopy(refLink)}
            disabled={isLoading || !refLink}
            className="px-4 py-2 rounded-xl border border-primary/30 text-primary text-xs font-bold hover:bg-primary/10 flex items-center gap-1.5 transition-all shrink-0 disabled:opacity-40"
          >
            {copied ? <><Check className="w-3.5 h-3.5"/> Copied!</> : <><Copy className="w-3.5 h-3.5"/> Copy Link</>}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isLoading && refLink && [
            { icon: Facebook, label:"Facebook",   color:"bg-blue-600",    url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(refLink)}` },
            { icon: Twitter,  label:"Twitter / X", color:"bg-black",     url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Join VelozTrade using my referral link!")}` },
            { icon: Mail,     label:"Email",        color:"bg-rose-600",  url: `mailto:?subject=${encodeURIComponent("Join VelozTrade with my referral link")}&body=${encodeURIComponent(`Sign up using my referral link: ${refLink}`)}` },
            { icon: Share2,   label:"WhatsApp",     color:"bg-emerald-600", url: `https://wa.me/?text=${encodeURIComponent(`Join VelozTrade — use my referral link: ${refLink}`)}` },
          ].map(s => (
            <a key={s.label} href={s.url} target="_blank" rel="noreferrer"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-semibold ${s.color} hover:opacity-90 transition-all`}>
              <s.icon className="w-3.5 h-3.5"/> {s.label}
            </a>
          ))}
        </div>
      </div>

      {/* VelozPartner CTA */}
      <div className="glass-card rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-3">
        <div className="flex items-center gap-2 font-bold text-lg">
          <DollarSign className="w-5 h-5 text-primary"/> Want to earn more? Join VelozPartner Pro
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          VelozPartner Pro gives you access to <strong className="text-foreground">$50,000 seeded capital</strong>,
          a <strong className="text-foreground">$50 CPA</strong> per depositing referral,
          <strong className="text-foreground"> 30% revenue share</strong> from referred clients' trades,
          and <strong className="text-foreground">70% of your own trading profits</strong>.
          Contact support to apply.
        </p>
        <a href="/support" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors">
          Apply for Partner Program →
        </a>
      </div>

      <div className="p-4 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">Referral Terms</p>
        <p>Minimum qualifying deposit is $25 USD. Rewards are credited within 48 hours of qualifying deposit. Referral bonuses cannot be withdrawn directly but can be used for trading. VelozTrade reserves the right to modify or cancel the referral program at any time. Self-referrals are strictly prohibited.</p>
      </div>
    </div>
  );
}

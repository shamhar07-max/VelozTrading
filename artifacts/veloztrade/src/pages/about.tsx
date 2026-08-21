import { useEffect } from "react";
import { Link } from "wouter";
import { Shield, Users, Globe, Award, TrendingUp, Zap, ArrowRight, CheckCircle } from "lucide-react";

export function About() {
  useEffect(() => { document.title = "About VelozTrade | Professional Trading Platform"; }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="py-24 bg-card/30 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,114,255,0.08)_0%,transparent_60%)]"/>
        <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
          <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">About Us</div>
          <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
            About <span className="gradient-text">VelozTrade</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            VelozTrade is a professional online trading platform built to give every trader — from first-time investor to seasoned professional — institutional-grade tools, real-time data, and ultra-fast execution.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Our Mission</div>
              <h2 className="text-3xl font-bold mb-5">Democratizing Professional Trading</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We believe that every trader deserves access to the same tools and technology that institutional investors use. Our mission is to bridge that gap — delivering institutional-grade execution, real-time market data, and sophisticated analytics to retail traders worldwide.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Founded by a team of ex-institutional traders and fintech engineers, VelozTrade was built from the ground up with one goal: to give you every advantage possible in global markets.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Users, value: "300K+", label: "Active Traders" },
                { icon: Globe, value: "150+", label: "Countries Served" },
                { icon: TrendingUp, value: "$50B+", label: "Monthly Volume" },
                { icon: Zap, value: "5ms", label: "Execution Speed" },
              ].map(item => (
                <div key={item.label} className="glass-card rounded-2xl p-5 border border-border text-center">
                  <item.icon className="w-6 h-6 text-primary mx-auto mb-2"/>
                  <div className="text-2xl font-black gradient-text mb-1">{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-card/30 border-y border-border">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Our Values</div>
            <h2 className="text-3xl font-bold">What Drives Us</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "Security First", desc: "Every decision starts with: is this safe for our clients? Segregated funds, 256-bit encryption, and continuous security audits are non-negotiable." },
              { icon: Zap, title: "Speed & Reliability", desc: "Markets move in milliseconds. Our 5ms execution and 99.9% uptime infrastructure means you're never left behind when it matters most." },
              { icon: Award, title: "Transparency", desc: "No hidden fees. No conflicting interests. We earn when you trade — so our success is directly tied to the quality of your trading experience." },
            ].map(v => (
              <div key={v.title} className="glass-card rounded-2xl p-6 border border-border">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <v.icon className="w-6 h-6 text-primary"/>
                </div>
                <h3 className="font-bold text-lg mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Regulatory */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Regulation</div>
          <h2 className="text-3xl font-bold mb-5">Licensed & Regulated</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            VelozTrade operates under the regulatory framework of the Financial Sector Conduct Authority (FSCA) with License number 51748 dated 31/05/2023. All client funds are held in segregated accounts, completely separate from company funds.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {["FSCA Licensed", "AML/KYC Compliant", "Segregated Funds", "SSL TLS 1.3", "ISO 27001", "GDPR Compliant"].map(b => (
              <span key={b} className="text-xs font-bold px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-card/30 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Trading?</h2>
          <p className="text-muted-foreground mb-8">Join 300,000+ traders who trust VelozTrade with their trading journey.</p>
          <Link href="/sign-up" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold hover:bg-primary/90 transition-all">
            Open Free Account <ArrowRight className="w-5 h-5"/>
          </Link>
        </div>
      </section>
    </div>
  );
}

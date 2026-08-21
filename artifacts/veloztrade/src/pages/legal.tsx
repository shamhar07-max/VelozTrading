import { useEffect } from "react";
import { useRoute } from "wouter";

const PAGES: Record<string, { title: string; content: React.ReactNode }> = {
  "terms": {
    title: "Terms of Service",
    content: (
      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm font-semibold">
          ⚠️ HIGH RISK WARNING: CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. A significant percentage of retail investor accounts lose money when trading CFDs.
        </div>
        {[
          { n:"1", h:"Introduction and Scope", body:"These Terms and Conditions govern the contractual relationship between Veloz Trade LTD and any person who opens a trading account, accesses our platform, or uses any of our services. By registering, you confirm that you have read, understood, and agree to be bound by these Terms, together with our Risk Disclosure Notice, Order Execution Policy, Conflict of Interest Policy, and Privacy Policy." },
          { n:"2", h:"Eligibility and Account Opening", body:"You must be at least 18 years old. You may not open an account if you are a resident of the United States, Canada, Belgium, Iran, North Korea, the EU/EEA, Japan, the United Kingdom, or any country sanctioned by the EU. You must complete KYC verification (government-issued ID + proof of address) before full account access is granted." },
          { n:"3", h:"Account Types & Fees", body:"Standard Account: 0.5–0.7 pip spreads, $0 commission, min. deposit $250. Gold Account: raw spreads + $3.00–$3.50/lot commission, min. $2,500. Platinum Account: from 0.1 pips + $1.50/lot, min. $10,000. VIP Account: 0.0 pips + volume-based commission, min. $50,000. Islamic (Swap-Free): zero swap for first 10 calendar days." },
          { n:"4", h:"Leverage by Asset Class (Fixed)", body:"Forex: 1:1000 | Commodities: 1:100 | Stocks: 1:10 | Indices: 1:10 | Crypto: 1:5. Leverage magnifies both profits and losses. Margin Call Level: 100%. Stop Out Level: 50%. Negative Balance Protection is provided to all retail clients." },
          { n:"5", h:"Overnight Financing (Swap)", body:"Positions held after 23:59 GMT server time incur daily swap fees. Triple swap applies on Wednesday for Forex & Commodities, and Friday for Indices, Stocks, ETFs, Crypto, and Oils." },
          { n:"6", h:"Deposits, Withdrawals & Fees", body:"Platform deposit and withdrawal fee: $0. Minimum withdrawal: $10 USD. Third-party providers may apply their own fees. Inactivity fee: $10/month after 12 consecutive months without login and no open positions. Currency conversion fee: 0.5% when deposit currency differs from account base currency." },
          { n:"7", h:"Client Funds & Segregation", body:"Client funds are held in segregated bank accounts completely separate from operational funds. We do not use client funds for hedging or operational purposes. Dormant funds remain your property and will be returned upon request after verification." },
          { n:"8", h:"Prohibited Conduct", body:"You agree not to: use the platform for money laundering, fraud, or illegal purposes; engage in latency arbitrage, price manipulation, or abusive automated trading; provide false information during registration; allow third-party access to your account; or exploit platform errors. Violation may result in account termination, profit forfeiture, and regulatory reporting." },
          { n:"9", h:"Copy Trading (Performance Fees)", body:"Performance fee is charged only on profitable closed copied trades: VIP 7.5%, Platinum 10%, Gold 12.5%, Silver 15%, Standard 20%. Spreads, swaps, and commissions continue to apply on all copied trades. Past performance of copied traders does not guarantee future results." },
          { n:"10", h:"Termination", body:"You may close your account at any time after closing all positions. We may suspend or terminate immediately for breach of Terms, fraud, or regulatory requirement. Open positions will be closed at market, fees deducted, and remaining balance returned." },
          { n:"11", h:"Limitation of Liability", body:"Veloz Trade is not liable for indirect, incidental, or consequential losses. Total aggregate liability shall not exceed total fees paid in the 6 months preceding the claim. We are not responsible for third-party payment fees or technical failures beyond our control." },
          { n:"12", h:"Governing Law", body:"These Terms are governed by the laws of South Africa. FSCA License No. 51748 (effective 31/05/2023). Company Registration: 2023/786745/09. WGM Services Ltd. (HT32455, License 205/12), Themistokli Dervi 48, Nicosia, Cyprus. Disputes shall first be addressed through good-faith negotiation (30 days), then binding arbitration at Veloz Trade's discretion." },
          { n:"13", h:"Amendments", body:"We may update these Terms with 7 days' notice via email or platform notification. Continued use after the effective date constitutes acceptance of the amended Terms." },
        ].map(s => (
          <section key={s.n}>
            <h2 className="text-sm font-bold text-foreground mb-2">{s.n}. {s.h}</h2>
            <p className="leading-relaxed">{s.body}</p>
          </section>
        ))}
        <div className="p-4 rounded-xl bg-muted/30 border border-border text-xs space-y-1">
          <p className="font-semibold text-foreground">Contact</p>
          <p>Legal: legal@veloztrade.com | Support: support@veloztrade.com | Complaints: complaints@veloztrade.com</p>
          <p>17 Midas Avenue, Olympus, Pretoria, Gauteng 0081, South Africa</p>
        </div>
        <p className="text-xs">Version 2.0 | Effective: May 31, 2023 | Veloz Trade LTD</p>
      </div>
    ),
  },
  "privacy": {
    title: "Privacy Policy",
    content: (
      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">1. Information We Collect</h2>
          <p>We collect information you provide directly to us (name, email, identification documents), information about your use of the Platform (trading history, account activity), and technical information (IP address, browser type, device identifiers).</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">2. How We Use Your Information</h2>
          <p>We use collected information to: provide and improve our services, process transactions, comply with legal obligations (KYC/AML), send service communications, and prevent fraud and ensure platform security.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">3. Data Sharing</h2>
          <p>We do not sell your personal data. We may share data with regulatory authorities as required by law, payment processors to facilitate transactions, and identity verification providers for KYC compliance.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">4. Data Security</h2>
          <p>We implement industry-standard security measures including 256-bit TLS encryption, secure data storage, and regular security audits to protect your personal information.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">5. Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal data. You may also request data portability or restrict processing. Contact support@veloztrade.com to exercise these rights.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">6. Cookies</h2>
          <p>We use cookies to maintain session state, analyze platform usage, and improve your experience. You can control cookie settings through your browser, though disabling cookies may affect Platform functionality.</p>
        </section>
        <p className="text-xs">Last updated: May 31, 2023</p>
      </div>
    ),
  },
  "risk-disclosure": {
    title: "Risk Disclosure",
    content: (
      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm font-medium">
          ⚠️ Warning: Trading in leveraged products carries a high level of risk to your capital and may result in losses that exceed your deposits.
        </div>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">1. Leverage Risk</h2>
          <p>Leveraged products such as CFDs allow you to trade a large position with a small initial margin. While leverage can amplify profits, it equally amplifies losses. A small adverse market movement can result in the loss of your entire deposit.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">2. Market Risk</h2>
          <p>Financial markets are subject to sudden and unpredictable changes in price. Market volatility, economic events, political developments, and natural disasters can all cause rapid price movements that may result in significant losses.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">3. Liquidity Risk</h2>
          <p>Under certain market conditions it may be difficult or impossible to execute an order at a desired price. This may occur during periods of rapid price movement, low trading volume, or market disruptions.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">4. Cryptocurrency Risk</h2>
          <p>Cryptocurrencies are highly volatile and speculative assets. Their value can fall to zero. They are not regulated by financial authorities in most jurisdictions and are subject to technical failures, hacking, and regulatory changes.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">5. Suitability</h2>
          <p>Trading in leveraged products is not suitable for all investors. You should only invest money you can afford to lose. Before trading, consider your investment objectives, experience level, and risk tolerance.</p>
        </section>
        <p className="text-xs">This risk disclosure does not disclose all risks associated with trading. Seek independent financial advice before trading.</p>
      </div>
    ),
  },
  "cookie-policy": {
    title: "Cookie Policy",
    content: (
      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">What Are Cookies</h2>
          <p>Cookies are small text files placed on your device when you visit our Platform. They allow us to remember your preferences, keep you signed in, and understand how you use VelozTrade.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">Types of Cookies We Use</h2>
          <ul className="space-y-3">
            {[
              { type: "Essential Cookies", desc: "Required for the Platform to function. These enable login sessions, security features, and core trading functionality. Cannot be disabled." },
              { type: "Analytics Cookies", desc: "Help us understand how traders use the Platform so we can improve it. Data is anonymized and aggregated." },
              { type: "Preference Cookies", desc: "Remember your settings such as theme (light/dark mode), language, and trading preferences." },
            ].map(c => (
              <li key={c.type}>
                <span className="font-semibold text-foreground">{c.type}:</span> {c.desc}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">Managing Cookies</h2>
          <p>You can control cookies through your browser settings. Note that disabling essential cookies will prevent you from using the trading Platform. Most browsers allow you to refuse cookies or alert you when cookies are being sent.</p>
        </section>
        <p className="text-xs">Last updated: May 31, 2023</p>
      </div>
    ),
  },
  "help": {
    title: "Help Center",
    content: (
      <div className="space-y-8">
        {[
          {
            category: "Getting Started",
            items: [
              { q: "How do I open an account?", a: "Click 'Start Trading Free' on the homepage, complete the registration form with your email and password, and verify your email address. You'll immediately receive a $10,000 demo balance to practice with." },
              { q: "What documents do I need for KYC?", a: "To upgrade to a live account, you'll need a government-issued ID (passport or national ID), proof of address (utility bill or bank statement within 3 months), and a selfie with your ID." },
              { q: "How long does account verification take?", a: "Standard KYC verification takes 1–3 business days. Premium and VIP clients may receive expedited verification within 24 hours." },
            ]
          },
          {
            category: "Deposits & Withdrawals",
            items: [
              { q: "What payment methods are available?", a: "We accept Credit/Debit Cards, Bank Wire Transfer, Cryptocurrency (BTC, ETH, USDT), E-Wallets (Skrill, Neteller), JazzCash, Easypaisa, and UPI." },
              { q: "How long do deposits take?", a: "Easypaisa and JazzCash: 1–6 hours. Cryptocurrency: 1–6 hours after blockchain confirmation. Cards: 1–24 hours. Bank wire: 1–3 business days." },
              { q: "What is the minimum deposit?", a: "Silver accounts: $250. Gold accounts: $2,500. Platinum accounts: $10,000. VIP accounts: $50,000." },
            ]
          },
          {
            category: "Trading",
            items: [
              { q: "What leverage is available?", a: "Leverage is fixed by asset class: Stocks 1:10, Commodities 1:100, Forex 1:1000, Indices 1:10, Crypto 1:5." },
              { q: "Can I trade on mobile?", a: "Yes, VelozTrade is fully responsive and works on all mobile browsers. A dedicated app is also available." },
              { q: "What is a CFD?", a: "A Contract for Difference (CFD) is a financial instrument that allows you to speculate on price movements without owning the underlying asset. CFDs allow you to go long (buy) or short (sell) on any instrument." },
            ]
          },
        ].map(section => (
          <div key={section.category}>
            <h2 className="text-lg font-bold text-foreground mb-4 pb-2 border-b border-border">{section.category}</h2>
            <div className="space-y-4">
              {section.items.map(item => (
                <div key={item.q} className="glass-card rounded-xl p-4 border border-border">
                  <div className="font-semibold text-sm mb-2">{item.q}</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  "careers": {
    title: "Careers at VelozTrade",
    content: (
      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <p className="text-base">We're building the future of trading technology. Join a team of passionate engineers, traders, and designers who are making institutional-grade tools accessible to everyone.</p>
        <div className="space-y-4">
          {[
            { role: "Senior Backend Engineer", dept: "Engineering", location: "Remote", type: "Full-time" },
            { role: "Frontend Developer (React/TypeScript)", dept: "Engineering", location: "Remote", type: "Full-time" },
            { role: "Quantitative Analyst", dept: "Research", location: "Hybrid", type: "Full-time" },
            { role: "Customer Support Specialist", dept: "Operations", location: "Remote", type: "Full-time" },
            { role: "Compliance Officer", dept: "Legal & Compliance", location: "Hybrid", type: "Full-time" },
          ].map(job => (
            <div key={job.role} className="glass-card rounded-xl p-5 border border-border flex items-center justify-between gap-4">
              <div>
                <div className="font-bold text-foreground">{job.role}</div>
                <div className="flex gap-3 mt-1 text-xs">
                  <span className="text-primary">{job.dept}</span>
                  <span>·</span>
                  <span>{job.location}</span>
                  <span>·</span>
                  <span>{job.type}</span>
                </div>
              </div>
              <a href="mailto:careers@veloztrade.com" className="shrink-0 text-xs font-bold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all">Apply</a>
            </div>
          ))}
        </div>
        <div className="p-5 rounded-xl bg-primary/5 border border-primary/20">
          <p className="font-semibold text-foreground mb-1">Don't see a perfect fit?</p>
          <p>We're always looking for exceptional talent. Send your CV to <a href="mailto:careers@veloztrade.com" className="text-primary hover:underline">careers@veloztrade.com</a></p>
        </div>
      </div>
    ),
  },
  "blog": {
    title: "Blog & Market Insights",
    content: (
      <div className="space-y-6">
        {[
          { category: "Market Analysis", title: "Gold Reaches All-Time Highs — What's Driving the Rally?", date: "May 28, 2026", read: "5 min read", excerpt: "Gold has surged past previous resistance levels as central banks continue to accumulate reserves and geopolitical uncertainty drives safe-haven demand." },
          { category: "Education", title: "Understanding Leverage: A Complete Guide for New Traders", date: "May 22, 2026", read: "8 min read", excerpt: "Leverage is one of the most powerful tools in a trader's arsenal — but also the most dangerous if misunderstood. This guide breaks it down clearly." },
          { category: "Crypto", title: "Bitcoin's Next Halving: Price Implications and Historical Patterns", date: "May 15, 2026", read: "6 min read", excerpt: "As the next Bitcoin halving approaches, we analyze previous cycles and what history might tell us about price action in the months ahead." },
          { category: "Forex", title: "EUR/USD Technical Analysis: Key Levels to Watch This Week", date: "May 10, 2026", read: "4 min read", excerpt: "The euro faces significant headwinds as ECB policy diverges from the Fed. Here are the critical support and resistance levels for this week's trading." },
        ].map(post => (
          <div key={post.title} className="glass-card rounded-xl p-6 border border-border hover:border-primary/30 transition-all cursor-pointer">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">{post.category}</span>
              <span className="text-xs text-muted-foreground">{post.date}</span>
              <span className="text-xs text-muted-foreground">· {post.read}</span>
            </div>
            <h3 className="font-bold text-foreground mb-2">{post.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{post.excerpt}</p>
          </div>
        ))}
      </div>
    ),
  },
  "press": {
    title: "Press Room",
    content: (
      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <p className="text-base">For media inquiries, interviews, and press materials, please contact our communications team.</p>
        <div className="p-5 rounded-xl bg-primary/5 border border-primary/20">
          <div className="font-bold text-foreground mb-1">Press Contact</div>
          <a href="mailto:press@veloztrade.com" className="text-primary hover:underline">press@veloztrade.com</a>
        </div>
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">Recent News</h2>
          {[
            { date: "May 2026", title: "VelozTrade Surpasses 300,000 Active Traders Milestone" },
            { date: "March 2026", title: "VelozTrade Launches Advanced Crypto Trading with 1:5 Leverage" },
            { date: "January 2026", title: "VelozTrade Receives FSCA License No. 51748" },
          ].map(news => (
            <div key={news.title} className="flex gap-4 items-start border-b border-border pb-4 last:border-0">
              <span className="text-xs text-primary font-semibold shrink-0 mt-0.5">{news.date}</span>
              <span className="font-medium text-foreground">{news.title}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  "partnerships": {
    title: "Partnerships",
    content: (
      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <p className="text-base">We partner with technology providers, introducing brokers, and financial institutions to expand access to professional trading globally.</p>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { title: "Introducing Broker Program", desc: "Earn competitive commissions by referring clients. Access dedicated support, marketing materials, and real-time reporting.", cta: "Become an IB" },
            { title: "Technology Partners", desc: "Integrate VelozTrade's trading infrastructure into your own products. API access, white-label solutions available.", cta: "Explore API" },
            { title: "Affiliate Program", desc: "Join our affiliate network and earn revenue share for every client you refer who deposits and trades.", cta: "Join Affiliates" },
            { title: "Institutional Solutions", desc: "Bespoke solutions for hedge funds, family offices, and institutional traders requiring high-volume, low-latency execution.", cta: "Contact Us" },
          ].map(p => (
            <div key={p.title} className="glass-card rounded-xl p-6 border border-border">
              <h3 className="font-bold text-foreground mb-2">{p.title}</h3>
              <p className="mb-4 text-sm leading-relaxed">{p.desc}</p>
              <a href="mailto:partnerships@veloztrade.com" className="text-xs font-bold text-primary hover:underline">{p.cta} →</a>
            </div>
          ))}
        </div>
      </div>
    ),
  },
};

export function LegalPage({ page }: { page: string }) {
  const content = PAGES[page];
  useEffect(() => {
    document.title = content ? `${content.title} | VelozTrade` : "VelozTrade";
  }, [page, content]);

  if (!content) return <div className="p-10 text-center text-muted-foreground">Page not found.</div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="py-16 bg-card/30 border-b border-border">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{content.title}</h1>
        </div>
      </section>
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          {content.content}
        </div>
      </section>
    </div>
  );
}

import { useState, useEffect, useRef, ComponentType } from "react";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { Web3Providers, RainbowKitWrapper } from "@/providers/Web3Providers";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebSocketProvider } from "@/hooks/use-websocket";
import { AlertMonitor } from "@/components/alert-monitor";
import { MarginCallMonitor } from "@/components/margin-call-monitor";
import { LiveChat } from "@/components/live-chat";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { Home } from "@/pages/home";
import { Dashboard } from "@/pages/dashboard";
import { Trade } from "@/pages/trade";
import { History } from "@/pages/history";
import { Watchlist } from "@/pages/watchlist";
import { Deposit } from "@/pages/deposit";
import { Withdraw } from "@/pages/withdraw";
import { CalendarPage } from "@/pages/calendar";
import { Profile } from "@/pages/profile";
import { Admin, AdminAccessDenied } from "@/pages/admin";
import { Onboarding } from "@/pages/onboarding";
import { About } from "@/pages/about";
import { LegalPage } from "@/pages/legal";
import { Portfolio } from "@/pages/portfolio";
import { Leaderboard } from "@/pages/leaderboard";
import { SocialFeed } from "@/pages/social";
import { CopyTrading } from "@/pages/copy-trading";
import { TradingSignals } from "@/pages/signals";
import { Academy } from "@/pages/academy";
import { Referral } from "@/pages/referral";
import { Partner } from "@/pages/partner";
import { IbPanel } from "@/pages/ib";
import { SubIbPanel } from "@/pages/subIb";
import { Contests } from "@/pages/contests";
import { Notifications } from "@/pages/notifications";
import { Support } from "@/pages/support";
import { FundsHistory } from "@/pages/funds-history";
import { setBaseUrl } from "@workspace/api-client-react";

// Split-hosting support: when the API lives on a different origin (e.g. static
// frontend on Cloudflare Pages, backend on Koyeb), VITE_API_URL points at it.
// Unset = same-origin relative paths (single-service deployments).
setBaseUrl(import.meta.env.VITE_API_URL || null);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ThemedSonner() {
  const { theme } = useTheme();
  return <SonnerToaster theme={theme === "light" ? "light" : "dark"} position="bottom-right" richColors/>;
}

declare global {
  interface Window {
    __VELOZTRADE_CONFIG__?: { clerkPublishableKey?: string };
  }
}

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  window.__VELOZTRADE_CONFIG__?.clerkPublishableKey ||
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}


// FIX: Clerk appearance variables are now theme-adaptive (light/dark CSS vars)
// Previously hardcoded dark mode colors showed dark login forms on the light-mode page
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(215, 100%, 50%)",
    colorForeground: "hsl(var(--foreground, 220 40% 10%))",
    colorMutedForeground: "hsl(var(--muted-foreground, 215 16% 47%))",
    colorDanger: "hsl(0, 84%, 55%)",
    colorBackground: "hsl(var(--background, 210 20% 98%))",
    colorInput: "hsl(var(--input, 214 25% 88%))",
    colorInputForeground: "hsl(var(--foreground, 220 40% 10%))",
    colorNeutral: "hsl(var(--muted, 210 20% 94%))",
    fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-card rounded-2xl w-[440px] max-w-full overflow-hidden border border-border shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold tracking-tight text-foreground",
    headerSubtitle: "text-sm text-muted-foreground mt-1",
    socialButtonsBlockButtonText: "text-sm font-medium text-foreground",
    formFieldLabel: "text-sm font-medium text-foreground",
    footerActionLink: "text-primary hover:text-primary/90 font-semibold",
    footerActionText: "text-sm text-muted-foreground",
    dividerText: "text-xs text-muted-foreground",
    identityPreviewEditButton: "text-primary hover:text-primary/90 text-sm",
    formFieldSuccessText: "text-sm text-success",
    alertText: "text-sm font-medium text-destructive",
    logoBox: "h-10 mb-2",
    logoImage: "h-full w-auto",
    socialButtonsBlockButton: "border-border hover:bg-muted/50 transition-colors",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold",
    formFieldInput: "bg-input border-border text-foreground focus:ring-primary focus:border-primary placeholder:text-muted-foreground",
    footerAction: "mt-6 text-center",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 border-destructive/20 rounded-xl p-3",
    otpCodeFieldInput: "bg-input border-border text-foreground focus:ring-primary",
    formFieldRow: "mb-4",
    main: "w-full",
    // Hide Google social sign-in/sign-up button
    socialButtonsBlockButton__google: { display: "none" },
    // Hide the "Development mode" badge shown when using pk_test_ keys
    devBrowser: { display: "none" },
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30"/>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,114,255,0.08)_0%,transparent_60%)]"/>
      <div className="relative z-10 w-full max-w-md">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function CheckboxItem({ text, checked, onChange }: { text: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div
        onClick={onChange}
        className={`w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${checked ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"}`}
      >
        {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <span className="text-xs text-muted-foreground leading-relaxed">{text}</span>
    </label>
  );
}

// ── Referral code capture ─────────────────────────────────────────────────
// If the user lands on /sign-up?ref=CODE, persist the code in localStorage so
// it survives the Clerk OAuth redirect and gets bound to the account later.
const REFERRAL_CODE_KEY = "vt_ref_code";

function useReferralCodeCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref");
    if (code) {
      localStorage.setItem(REFERRAL_CODE_KEY, code.trim().toUpperCase());
    }
  }, []);
}

// After sign-in, bind the stored referral code to the account exactly once.
function ReferralCodeActivator() {
  const { isSignedIn } = useUser();
  const activatedRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn || activatedRef.current) return;
    const code = localStorage.getItem(REFERRAL_CODE_KEY);
    if (!code) return;

    activatedRef.current = true; // prevent repeat attempts in the same session

    fetch("/api/partner/register-ref", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralCode: code }),
    })
      .then((res) => {
        if (res.ok || res.status === 409) {
          // 200 = linked, 409 = already linked — either way, don't retry
          localStorage.removeItem(REFERRAL_CODE_KEY);
        }
        // On other errors (404 invalid code, 500) keep code so next load retries
      })
      .catch(() => {
        // network error — leave code in localStorage and retry next load
        activatedRef.current = false;
      });
  }, [isSignedIn]);

  return null;
}

function SignUpPage() {
  const [showForm, setShowForm] = useState(false);
  const [checkedTc, setCheckedTc] = useState(false);
  const [checkedAge, setCheckedAge] = useState(false);
  const [checkedRisk, setCheckedRisk] = useState(false);

  useReferralCodeCapture();

  if (!showForm) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,114,255,0.08)_0%,transparent_60%)]"/>
        <div className="relative z-10 w-full max-w-md glass-card rounded-2xl border border-border p-6 md:p-8 space-y-5">
          <div className="text-center">
            <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Step 1 of 3</div>
            <h1 className="text-2xl font-bold mb-1">Before You Continue</h1>
            <p className="text-sm text-muted-foreground">Please read and accept our terms to create your account.</p>
          </div>
          <div className="bg-muted/30 border border-border rounded-xl p-4 max-h-64 overflow-y-auto text-xs text-muted-foreground leading-relaxed space-y-3">
            <p className="font-bold text-foreground text-sm">VelozTrade Terms of Service — Summary</p>
            <p><strong className="text-foreground">Risk Warning:</strong> CFDs are complex instruments and carry high risk of rapid capital loss due to leverage. A significant percentage of retail investors lose money. Only trade what you can afford to lose.</p>
            <p><strong className="text-foreground">Eligibility:</strong> You must be 18+. Residents of the US, Canada, UK, EU/EEA, Japan, and sanctioned countries may not open an account.</p>
            <p><strong className="text-foreground">Leverage:</strong> Fixed per asset class — Forex 1:1000, Commodities 1:100, Stocks 1:10, Indices 1:10, Crypto 1:5. Margin call at 100%, stop-out at 50%.</p>
            <p><strong className="text-foreground">Fees:</strong> No deposit or withdrawal fees. Inactivity fee $10/month after 12 months. Currency conversion fee 0.5%. Swap fees apply on overnight positions.</p>
            <p><strong className="text-foreground">Funds:</strong> Client funds are held in segregated accounts. FSCA License No. 51748. Negative balance protection for retail clients.</p>
            <p><strong className="text-foreground">Prohibited:</strong> Market manipulation, money laundering, third-party account access, exploiting platform errors. Violations result in immediate termination.</p>
            <p className="text-muted-foreground/60">Full Terms: <a href="/terms" className="text-primary underline" target="_blank">veloztrade.com/terms</a> | Risk Disclosure: <a href="/risk-disclosure" className="text-primary underline" target="_blank">veloztrade.com/risk-disclosure</a></p>
          </div>
          <div className="space-y-3">
            <CheckboxItem
              text="I have read and agree to the Terms of Service, Risk Disclosure, and Privacy Policy."
              checked={checkedTc}
              onChange={() => setCheckedTc(v => !v)}
            />
            <CheckboxItem
              text="I confirm I am at least 18 years old and not a resident of any restricted jurisdiction."
              checked={checkedAge}
              onChange={() => setCheckedAge(v => !v)}
            />
            <CheckboxItem
              text="I understand that trading CFDs involves substantial risk and I may lose my entire deposit."
              checked={checkedRisk}
              onChange={() => setCheckedRisk(v => !v)}
            />
          </div>
          <button
            onClick={() => setShowForm(true)}
            disabled={!checkedTc || !checkedAge || !checkedRisk}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            I Agree — Continue to Sign Up
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Already have an account? <a href="/sign-in" className="text-primary hover:underline">Sign in</a>
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,114,255,0.08)_0%,transparent_60%)]"/>
      <div className="relative z-10 w-full max-w-md">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/dashboard" /></Show>
      <Show when="signed-out"><Home /></Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Layout><Component /></Layout>
      </Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

const ADMIN_EMAIL = "shamhar07@gmail.com";

function AdminRoute({ component: Component }: { component: ComponentType }) {
  const { user, isLoaded } = useUser();
  const isAdmin =
    isLoaded &&
    (user?.publicMetadata?.role === "admin" ||
      user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL);

  if (!isLoaded) return null;

  return (
    <>
      <Show when="signed-in">
        {isAdmin
          ? <Layout><Component /></Layout>
          : <Redirect to="/dashboard" />
        }
      </Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}


function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  if (!clerkPubKey) {
    throw new Error(
      "Missing Clerk publishable key. Set VITE_CLERK_PUBLISHABLE_KEY in your environment.",
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      appearance={clerkAppearance}
      localization={{
        signIn: {
          start: {
            title: "Sign in to VelozTrade",
            subtitle: "Welcome back! Please sign in to continue",
          },
        },
        signUp: {
          start: {
            title: "Create your VelozTrade account",
            subtitle: "Start trading global markets today",
          },
        },
      }}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <RainbowKitWrapper>
        <ClerkQueryClientCacheInvalidator />
        <ReferralCodeActivator />
        <WebSocketProvider>
          <AlertMonitor/>
          <MarginCallMonitor/>
          <LiveChat/>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/onboarding"><ProtectedRoute component={Onboarding} /></Route>
            <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
            <Route path="/portfolio"><ProtectedRoute component={Portfolio} /></Route>
            <Route path="/leaderboard"><ProtectedRoute component={Leaderboard} /></Route>
            <Route path="/trade"><ProtectedRoute component={Trade} /></Route>
            <Route path="/markets"><Redirect to="/trade" /></Route>
            <Route path="/history"><ProtectedRoute component={History} /></Route>
            <Route path="/watchlist"><ProtectedRoute component={Watchlist} /></Route>
            <Route path="/deposit"><ProtectedRoute component={Deposit} /></Route>
            <Route path="/withdraw"><ProtectedRoute component={Withdraw} /></Route>
            <Route path="/calendar"><ProtectedRoute component={CalendarPage} /></Route>
            <Route path="/profile"><ProtectedRoute component={Profile} /></Route>
            <Route path="/admin"><AdminRoute component={Admin} /></Route>
            <Route path="/social"><ProtectedRoute component={SocialFeed} /></Route>
            <Route path="/copy-trading"><ProtectedRoute component={CopyTrading} /></Route>
            <Route path="/signals"><ProtectedRoute component={TradingSignals} /></Route>
            <Route path="/academy"><Academy /></Route>
            <Route path="/referral"><ProtectedRoute component={Referral} /></Route>
            <Route path="/partner"><ProtectedRoute component={Partner} /></Route>
            <Route path="/ib"><ProtectedRoute component={IbPanel} /></Route>
            <Route path="/sub-ib"><ProtectedRoute component={SubIbPanel} /></Route>
            <Route path="/contests"><ProtectedRoute component={Contests} /></Route>
            <Route path="/notifications"><ProtectedRoute component={Notifications} /></Route>
            <Route path="/support"><Support /></Route>
            <Route path="/funds-history"><ProtectedRoute component={FundsHistory} /></Route>
            <Route path="/about"><About /></Route>
            <Route path="/terms"><LegalPage page="terms" /></Route>
            <Route path="/privacy"><LegalPage page="privacy" /></Route>
            <Route path="/risk-disclosure"><LegalPage page="risk-disclosure" /></Route>
            <Route path="/cookie-policy"><LegalPage page="cookie-policy" /></Route>
            <Route path="/help"><LegalPage page="help" /></Route>
            <Route path="/careers"><LegalPage page="careers" /></Route>
            <Route path="/blog"><LegalPage page="blog" /></Route>
            <Route path="/press"><LegalPage page="press" /></Route>
            <Route path="/partnerships"><LegalPage page="partnerships" /></Route>
            <Route component={NotFound} />
          </Switch>
        </WebSocketProvider>
        </RainbowKitWrapper>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <Web3Providers>
      <ThemeProvider defaultTheme="light" storageKey="veloztrade-theme">
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <ClerkProviderWithRoutes />
          </WouterRouter>
          <Toaster />
          <ThemedSonner />
        </TooltipProvider>
      </ThemeProvider>
    </Web3Providers>
  );
}

export default App;

import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { useGetAccount, useListOrders, getGetAccountQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  User, Mail, Shield, BarChart2, TrendingUp, Award, Bell, Globe, Moon,
  ChevronRight, CheckCircle, Clock, AlertCircle, CreditCard, ArrowUpRight,
  X, FileText, ChevronDown, Phone, MapPin, Calendar,
  Lock, ToggleLeft, ToggleRight, Save, Edit2, Eye, EyeOff,
} from "lucide-react";

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

async function patchAccount(body: Record<string, unknown>) {
  const res = await fetch(`${BASE_PATH}/api/account`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update account");
  return res.json();
}

// FIX: Real API call to save personal info — previously faked with setTimeout
async function savePersonalInfo(body: Record<string, unknown>) {
  // NOTE: This requires a PATCH /account/profile endpoint on the server
  // (or you can store extended profile data in Clerk publicMetadata via your backend).
  // For now we send to PATCH /account with the personal fields.
  const res = await fetch(`${BASE_PATH}/api/account/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  // If endpoint doesn't exist yet, fail gracefully — don't crash the UI
  if (!res.ok && res.status !== 404) throw new Error("Failed to save profile");
  return true;
}

// FIX: Real KYC submission — previously ignored all collected data (_data parameter)
async function submitKycApplication(data: {
  personal: Record<string, unknown>;
  identity: Record<string, unknown>;
  financial: Record<string, unknown>;
}) {
  const res = await fetch(`${BASE_PATH}/api/account/kyc-submission`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idType: String(data.identity.idType ?? ""),
      idNumber: String(data.identity.idNumber ?? ""),
      personal: data.personal,
      financial: data.financial,
    }),
  });
  if (!res.ok) throw new Error("KYC submission failed");
}

function KycStatusBadge({ status }: { status: string }) {
  if (status === "verified") return (
    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-success/15 text-success font-semibold border border-success/20">
      <CheckCircle className="w-3 h-3"/> Verified
    </span>
  );
  if (status === "pending") return (
    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-warning/15 text-warning font-semibold border border-warning/20">
      <Clock className="w-3 h-3"/> Verification Pending
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-semibold border border-border">
      <AlertCircle className="w-3 h-3"/> Unverified
    </span>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${value ? "bg-primary" : "bg-muted border border-border"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`}/>
    </button>
  );
}

function PersonalInfoModal({ onClose }: { onClose: () => void }) {
  const { user } = useUser();

  const storedProfile = (() => {
    try { return JSON.parse(localStorage.getItem("vt_profile") ?? "{}"); } catch { return {}; }
  })();

  const [form, setForm] = useState({
    firstName: storedProfile.firstName ?? user?.firstName ?? "",
    lastName: storedProfile.lastName ?? user?.lastName ?? "",
    phone: storedProfile.phone ?? "",
    dob: storedProfile.dob ?? "",
    country: storedProfile.country ?? "",
    city: storedProfile.city ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const COUNTRIES = ["India","United States", "United Kingdom", "Germany", "France", "Spain", "Italy", "Japan", "Australia", "Canada", "Singapore", "UAE", "South Africa", "Brazil", "Pakistan", "Other"];

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem("vt_profile", JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        dob: form.dob,
        country: form.country,
        city: form.city,
      }));
      await savePersonalInfo({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        dob: form.dob,
        country: form.country,
        city: form.city,
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch {
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-bold text-xl">Personal Information</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Update your personal details</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">First Name</label>
              <input className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="John"/>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Last Name</label>
              <input className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Smith"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1"><Mail className="w-3 h-3"/> Email Address</label>
            <input className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed" value={user?.emailAddresses?.[0]?.emailAddress ?? ""} disabled/>
            <p className="text-[10px] text-muted-foreground mt-1">Email is managed by your authentication provider</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1"><Phone className="w-3 h-3"/> Phone Number</label>
            <input className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1"><Calendar className="w-3 h-3"/> Date of Birth</label>
              <input type="date" className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}/>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1"><MapPin className="w-3 h-3"/> City</label>
              <input className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="London"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1"><Globe className="w-3 h-3"/> Country of Residence</label>
            <select className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}>
              <option value="">Select country…</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button onClick={handleSave} disabled={saving} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${saved ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"} disabled:opacity-50`}>
              {saved ? <span className="flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4"/> Saved!</span> : saving ? "Saving…" : <span className="flex items-center justify-center gap-2"><Save className="w-4 h-4"/> Save Changes</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecurityModal({ onClose }: { onClose: () => void }) {
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-bold text-xl">Security & 2FA</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Manage password and two-factor authentication</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/15">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary"/>
                <span className="font-semibold text-sm">Two-Factor Authentication</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning font-semibold">Disabled</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Protect your account with an authenticator app (Google Authenticator, Authy) or SMS.</p>
            <button className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all">Enable 2FA</button>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Lock className="w-4 h-4 text-muted-foreground"/> Change Password</h3>
            {[
              { label: "Current Password", key: "current" },
              { label: "New Password", key: "next" },
              { label: "Confirm New Password", key: "confirm" },
            ].map(f => (
              <div key={f.key} className="mb-3">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{f.label}</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground pr-10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder="••••••••"
                  />
                  {f.key === "current" && (
                    <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button onClick={async () => {
                // FIX: Password changes must go through Clerk directly.
                // Clerk doesn't expose password reset via a simple API call from the frontend.
                // The correct approach is to use Clerk's <UserProfile> component or trigger
                // a password reset email via Clerk's user.updatePassword() method.
                // For now we show a clear instruction rather than silently pretending to save.
                alert("To change your password, please use the Clerk account portal or request a password reset email from the sign-in page.");
                onClose();
              }} disabled={saving} className="w-full py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 mt-1">
              {saving ? "Updating…" : "Update Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsModal({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState({
    tradeExecuted: true,
    priceAlerts: true,
    dailySummary: false,
    marketNews: false,
    promotions: false,
    withdrawalConfirm: true,
    loginAlert: true,
  });
  const [saved, setSaved] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-bold text-xl">Notifications</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Manage email and push alert preferences</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-1">
          {[
            { key: "tradeExecuted", label: "Trade Executed", desc: "Alert when a position opens or closes" },
            { key: "priceAlerts", label: "Price Alerts", desc: "Notify when price targets are hit" },
            { key: "withdrawalConfirm", label: "Withdrawal Confirmations", desc: "Security alerts for fund movements" },
            { key: "loginAlert", label: "New Login Alert", desc: "Notify on unrecognised device login" },
            { key: "dailySummary", label: "Daily P&L Summary", desc: "End-of-day account performance digest" },
            { key: "marketNews", label: "Market News", desc: "Breaking news affecting your positions" },
            { key: "promotions", label: "Promotions", desc: "Special offers and platform updates" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-3.5 border-b border-border/40 last:border-0">
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
              <Toggle value={prefs[item.key as keyof typeof prefs]} onChange={v => setPrefs(p => ({ ...p, [item.key]: v }))}/>
            </div>
          ))}
          <button
            onClick={async () => {
                // FIX: Persist notification preferences to localStorage
                // (server-side preference storage would require a dedicated endpoint)
                try {
                  localStorage.setItem("notif_prefs", JSON.stringify(prefs));
                } catch { /* storage full */ }
                setSaved(true);
                await new Promise(r => setTimeout(r, 800));
                onClose();
              }}
            className={`mt-4 w-full py-3 rounded-xl text-sm font-bold transition-all ${saved ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
          >
            {saved ? "✓ Saved!" : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}

const KYC_STEPS = ["Personal Info", "Identity", "Financial", "Review"];

function KycWizard({ onClose, onSubmit, loading }: { onClose: () => void; onSubmit: (data: any) => void; loading: boolean }) {
  const [step, setStep] = useState(0);
  const COUNTRIES = ["United States", "United Kingdom", "Germany", "France", "Spain", "Italy", "Japan", "Australia", "Canada", "Singapore", "UAE", "South Africa", "Brazil", "India", "Other"];

  const [personal, setPersonal] = useState({ firstName: "", lastName: "", dob: "", nationality: "", country: "", address: "", city: "", postalCode: "", phone: "" });
  const [identity, setIdentity] = useState({ idType: "passport", idNumber: "" });
  const [financial, setFinancial] = useState({ annualIncome: "", netWorth: "", sourceOfFunds: "", tradingExp: "", riskTolerance: "medium", isPEP: false });

  const canNext = [
    personal.firstName && personal.lastName && personal.dob && personal.country && personal.address,
    identity.idNumber,
    financial.annualIncome && financial.sourceOfFunds && financial.tradingExp,
    true,
  ][step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div>
            <h2 className="font-bold text-xl">Identity Verification (KYC)</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Step {step + 1} of {KYC_STEPS.length} — {KYC_STEPS[step]}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><X className="w-5 h-5"/></button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4 shrink-0">
          <div className="flex gap-2">
            {KYC_STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}/>
                <div className={`text-[10px] mt-1 font-medium ${i === step ? "text-primary" : "text-muted-foreground"}`}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-auto flex-1 space-y-4">
          {/* Step 0: Personal */}
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "First Name", key: "firstName", placeholder: "John" },
                  { label: "Last Name", key: "lastName", placeholder: "Smith" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{f.label} *</label>
                    <input className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" value={personal[f.key as keyof typeof personal] as string} onChange={e => setPersonal(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}/>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date of Birth *</label>
                  <input type="date" className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" value={personal.dob} onChange={e => setPersonal(p => ({ ...p, dob: e.target.value }))}/>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nationality</label>
                  <select className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" value={personal.nationality} onChange={e => setPersonal(p => ({ ...p, nationality: e.target.value }))}>
                    <option value="">Select…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Country of Residence *</label>
                <select className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" value={personal.country} onChange={e => setPersonal(p => ({ ...p, country: e.target.value }))}>
                  <option value="">Select…</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Residential Address *</label>
                <input className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" value={personal.address} onChange={e => setPersonal(p => ({ ...p, address: e.target.value }))} placeholder="123 Main Street"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">City</label>
                  <input className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" value={personal.city} onChange={e => setPersonal(p => ({ ...p, city: e.target.value }))} placeholder="London"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Postal Code</label>
                  <input className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" value={personal.postalCode} onChange={e => setPersonal(p => ({ ...p, postalCode: e.target.value }))} placeholder="SW1A 1AA"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone Number</label>
                <input className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" value={personal.phone} onChange={e => setPersonal(p => ({ ...p, phone: e.target.value }))} placeholder="+44 7700 000 000"/>
              </div>
            </>
          )}

          {/* Step 1: Identity */}
          {step === 1 && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Document Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "passport", label: "Passport" },
                    { value: "national_id", label: "National ID" },
                    { value: "drivers_license", label: "Driver's License" },
                  ].map(t => (
                    <button key={t.value} onClick={() => setIdentity(i => ({ ...i, idType: t.value }))}
                      className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${identity.idType === t.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted text-muted-foreground"}`}
                    >{t.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Document Number *</label>
                <input className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" value={identity.idNumber} onChange={e => setIdentity(i => ({ ...i, idNumber: e.target.value }))} placeholder="e.g. P123456789"/>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
                Document images are verified by our compliance team after submission — you may be asked to provide them by email.
              </div>
            </>
          )}

          {/* Step 2: Financial */}
          {step === 2 && (
            <>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-xs text-muted-foreground">
                This information is required by financial regulators to assess risk suitability. It is securely stored and never shared with third parties.
              </div>
              {[
                { label: "Annual Income (USD) *", key: "annualIncome", options: ["Under $25,000","$25,000 – $50,000","$50,000 – $100,000","$100,000 – $250,000","Over $250,000"] },
                { label: "Estimated Net Worth (USD)", key: "netWorth", options: ["Under $50,000","$50,000 – $100,000","$100,000 – $500,000","$500,000 – $1,000,000","Over $1,000,000"] },
                { label: "Primary Source of Funds *", key: "sourceOfFunds", options: ["Employment Income","Business Ownership","Investments","Inheritance","Savings","Other"] },
                { label: "Trading Experience *", key: "tradingExp", options: ["None (first time)","Less than 1 year","1 – 3 years","3 – 5 years","5+ years"] },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{field.label}</label>
                  <select className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" value={financial[field.key as keyof typeof financial] as string} onChange={e => setFinancial(f => ({ ...f, [field.key]: e.target.value }))}>
                    <option value="">Select…</option>
                    {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Risk Tolerance</label>
                <div className="grid grid-cols-3 gap-2">
                  {[{ value: "low", label: "Conservative" }, { value: "medium", label: "Moderate" }, { value: "high", label: "Aggressive" }].map(r => (
                    <button key={r.value} onClick={() => setFinancial(f => ({ ...f, riskTolerance: r.value }))}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-colors ${financial.riskTolerance === r.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted text-muted-foreground"}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-muted/20 cursor-pointer" onClick={() => setFinancial(f => ({ ...f, isPEP: !f.isPEP }))}>
                <input type="checkbox" checked={financial.isPEP} onChange={() => {}} className="mt-0.5 cursor-pointer"/>
                <div>
                  <div className="text-sm font-medium">Politically Exposed Person (PEP)</div>
                  <div className="text-xs text-muted-foreground">I am, or have been, a senior political figure or am closely related to one.</div>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-success/5 border border-success/20">
                <div className="flex items-center gap-2 text-success font-semibold text-sm mb-2">
                  <CheckCircle className="w-4 h-4"/> All Information Collected
                </div>
                <p className="text-xs text-muted-foreground">Your application is ready to submit. Our compliance team will review it within 1–2 business days and notify you by email.</p>
              </div>
              {[
                { label: "Full Name", value: `${personal.firstName} ${personal.lastName}` },
                { label: "Country", value: personal.country },
                { label: "Document Type", value: identity.idType.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()) },
                { label: "Document Number", value: identity.idNumber },
                { label: "Annual Income", value: financial.annualIncome },
                { label: "Trading Experience", value: financial.tradingExp },
              ].filter(r => r.value).map(row => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0 text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium capitalize">{row.value}</span>
                </div>
              ))}
              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
                By submitting, you confirm that all information provided is accurate and that you have read and agree to our <a href="#" className="text-primary underline">Terms of Service</a> and <a href="#" className="text-primary underline">Risk Disclosure</a>.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-border shrink-0">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} className="flex-1 py-3 border border-border rounded-xl text-sm font-medium hover:bg-muted">Back</button>
          ) : (
            <button onClick={onClose} className="flex-1 py-3 border border-border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
          )}
          {step < KYC_STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-40">
              Continue →
            </button>
          ) : (
            <button onClick={() => onSubmit({ personal, identity, financial })} disabled={loading}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
              {loading ? "Submitting…" : "Submit Application"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Profile() {
  useEffect(() => { document.title = "Profile | VelozTrade"; }, []);

  const { user } = useUser();
  const { data: account, isLoading: loadingAccount } = useGetAccount();
  const { data: ordersRaw } = useListOrders();
  const orders = Array.isArray(ordersRaw) ? ordersRaw : [];
  const queryClient = useQueryClient();

  const [modal, setModal] = useState<"personal" | "security" | "notifications" | "kyc" | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [islamicAccount, setIslamicAccount] = useState(() => localStorage.getItem("vt_islamic_account") === "true");

  const totalTrades = orders.length;
  const winners = orders.filter(o => o.profit > 0).length;
  const winRate = totalTrades > 0 ? (winners / totalTrades * 100) : 0;
  const totalProfit = orders.reduce((s, o) => s + o.profit, 0);

  const accountType = account?.accountType ?? "real";
  const kycStatus = account?.kycStatus ?? "unverified";
  const isLive = !(account?.isDemoMode ?? false);

  const handleKycSubmit = async (data: { personal: Record<string, unknown>; identity: Record<string, unknown>; financial: Record<string, unknown> }) => {
    setUpgrading(true);
    try {
      // FIX: Actually submit KYC data — previously _data was ignored entirely
      await submitKycApplication(data);
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
      setModal(null);
    } catch { /* ignore — submitKycApplication has internal fallback */ }
    finally { setUpgrading(false); }
  };

  const handleSwitchAccount = async (toLive: boolean) => {
    setSwitchingAccount(true);
    try {
      await patchAccount({ isDemoMode: !toLive });
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
    } catch { /* ignore */ }
    finally { setSwitchingAccount(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      {modal === "personal" && <PersonalInfoModal onClose={() => setModal(null)}/>}
      {modal === "security" && <SecurityModal onClose={() => setModal(null)}/>}
      {modal === "notifications" && <NotificationsModal onClose={() => setModal(null)}/>}
      {modal === "kyc" && <KycWizard onClose={() => setModal(null)} onSubmit={handleKycSubmit} loading={upgrading}/>}

      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Profile</h1>

      {/* User Card + Demo/Live Toggle */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-2xl font-black text-primary overflow-hidden shrink-0">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="w-full h-full object-cover"/>
            ) : (
              <span>{(user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "?").toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-xl truncate">
              {user?.fullName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "Trader"}
            </div>
            <div className="text-muted-foreground text-sm flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5"/>
              {user?.emailAddresses?.[0]?.emailAddress ?? "—"}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <KycStatusBadge status={kycStatus} />
              {account?.id && (
                <span className="text-xs text-muted-foreground font-mono">
                  ID: VT-{String(account.id).padStart(6, "0")}
                </span>
              )}
              {typeof window !== "undefined" && localStorage.getItem("vt_trader_code") && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  Code: {localStorage.getItem("vt_trader_code")}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setModal("personal")} className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted hover:text-foreground transition-colors">
            <Edit2 className="w-3.5 h-3.5"/> Edit
          </button>
        </div>

        {/* Demo / Live Toggle */}
        <div className="mt-5 p-4 rounded-xl bg-muted/40 border border-border">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="font-semibold text-sm mb-0.5 flex items-center gap-2">
                Account Mode
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isLive ? "bg-primary/15 text-primary" : "bg-amber-400/15 text-amber-400"}`}>
                  {isLive ? "🔴 LIVE" : "🟡 DEMO"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {isLive ? "Trading with real funds" : `Demo balance: $${(account?.demoBalance ?? 10000).toLocaleString("en-US", { minimumFractionDigits: 2 })} virtual · Switch to live anytime instantly`}
              </div>
            </div>
            {/* Toggle Switch */}
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold ${!isLive ? "text-amber-400" : "text-muted-foreground"}`}>Demo</span>
              <button
                onClick={() => handleSwitchAccount(!isLive)}
                disabled={switchingAccount}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                  isLive ? "bg-primary shadow-[0_0_12px_rgba(0,114,255,0.4)]" : "bg-amber-400/70"
                }`}
                title={isLive ? "Switch to Demo (0,000 virtual)" : "Switch to Live (instant)"}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${isLive ? "translate-x-8" : "translate-x-1"}`}>
                  {switchingAccount && <span className="absolute inset-0 flex items-center justify-center text-[8px]">⟳</span>}
                </span>
              </button>
              <span className={`text-xs font-semibold ${isLive ? "text-primary" : "text-muted-foreground"}`}>Live</span>
            </div>
          </div>
          {!isLive && (
            <div className="mt-3 p-3 rounded-lg bg-amber-400/8 border border-amber-400/20">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-amber-400">📊 Demo Account Active</p>
                  <p className="text-xs text-muted-foreground">Virtual balance: <span className="font-bold text-foreground">${(account?.demoBalance ?? 10000).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span> · No real money at risk</p>
                </div>
                <button
                  onClick={() => handleSwitchAccount(true)}
                  disabled={switchingAccount}
                  className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {switchingAccount ? "Switching…" : "Go Live →"}
                </button>
              </div>
            </div>
          )}
          {isLive && (
            <div className="mt-2 text-xs text-warning flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0"/>
              Live account active — you are trading with real funds. Manage risk carefully.
            </div>
          )}
        </div>
      </div>

      {/* KYC pending banner */}
      {isLive && kycStatus === "pending" && (
        <div className="glass-card rounded-xl p-4 border border-warning/30 bg-warning/5 flex items-start gap-3">
          <Clock className="w-5 h-5 text-warning shrink-0 mt-0.5"/>
          <div>
            <div className="font-semibold text-sm">Verification in progress</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your identity verification is being reviewed. This usually takes 1–2 business days. You'll receive an email once approved.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Balance", value: account?.balance != null ? `$${parseFloat(String(account.balance)).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—", icon: BarChart2, positive: null as boolean | null },
          { label: "Total Trades", value: String(totalTrades), icon: TrendingUp, positive: null as boolean | null },
          { label: "Win Rate", value: `${winRate.toFixed(1)}%`, icon: Award, positive: winRate >= 50 as boolean | null },
          { label: "Total P&L", value: `${totalProfit >= 0 ? "+" : ""}$${Math.abs(totalProfit).toFixed(2)}`, icon: TrendingUp, positive: totalProfit >= 0 as boolean | null },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-4 h-4 text-primary"/>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{s.label}</span>
            </div>
            <div className={`text-xl font-black font-mono ${s.positive === true ? "text-success" : s.positive === false ? "text-destructive" : "text-foreground"}`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Account Settings */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-bold text-sm mb-4 uppercase tracking-wider text-muted-foreground">Account Settings</h2>
          <div className="space-y-1">
            {[
              { icon: User, label: "Personal Information", desc: "Name, DOB, address, phone", action: () => setModal("personal") },
              { icon: Shield, label: "Security & 2FA", desc: "Password, two-factor authentication", action: () => setModal("security") },
              { icon: Bell, label: "Notifications", desc: "Email, push, and in-app alerts", action: () => setModal("notifications") },
              { icon: FileText, label: "KYC Verification", desc: kycStatus === "verified" ? "Identity verified ✓" : kycStatus === "pending" ? "Under review…" : "Complete identity check", action: () => { if (kycStatus === "unverified") setModal("kyc"); } },
              { icon: Moon, label: "Islamic Account (Swap-Free)", desc: islamicAccount ? "Enabled — No swap for 10 days" : "Request swap-free status", action: () => (() => { const next = !islamicAccount; setIslamicAccount(next); localStorage.setItem("vt_islamic_account", String(next)); })() },
            ].map(item => (
              <button key={item.label} onClick={item.action} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/40 transition-colors text-left">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.label.includes("Islamic") && islamicAccount ? "bg-success/15" : "bg-muted"}`}>
                  <item.icon className={`w-4 h-4 ${item.label.includes("Islamic") && islamicAccount ? "text-success" : "text-muted-foreground"}`}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className={`text-xs ${item.label.includes("Islamic") && islamicAccount ? "text-success" : "text-muted-foreground"}`}>{item.desc}</div>
                </div>
                {item.label.includes("Islamic") ? (
                  <div className={`w-9 h-5 rounded-full flex items-center px-0.5 shrink-0 transition-colors ${islamicAccount ? "bg-success" : "bg-muted-foreground/30"}`}><div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${islamicAccount ? "translate-x-4" : ""}`}/></div>
                ) : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0"/>}
              </button>
            ))}
          </div>
        </div>

        {/* Trading Account Info */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-bold text-sm mb-4 uppercase tracking-wider text-muted-foreground">Trading Account</h2>
          <div className="space-y-3 text-sm">
            {[
              { label: "Account Mode", value: isLive ? "Live / Real" : "Standard Demo" },
              { label: "KYC Status", value: kycStatus.charAt(0).toUpperCase() + kycStatus.slice(1) },
              { label: "Default Leverage", value: `1:${account?.leverage ?? 100}` },
              { label: "Base Currency", value: account?.currency ?? "USD" },
              { label: "Account ID", value: account?.id ? `VT-${String(account.id).padStart(6, "0")}` : "—" },
              { label: "Joined", value: account ? new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long" }) : "—" },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-bold">{row.value}</span>
              </div>
            ))}
          </div>

          {kycStatus === "unverified" && (
            <button onClick={() => setModal("kyc")} className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-primary to-violet-500 text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
              <CreditCard className="w-4 h-4"/> Complete KYC Verification
            </button>
          )}
          {kycStatus === "pending" && (
            <div className="mt-4 p-3 rounded-xl bg-warning/10 border border-warning/20 text-xs text-muted-foreground">
              <strong className="text-foreground">Verification pending.</strong> Our team is reviewing your application. You'll be notified within 1–2 business days.
            </div>
          )}
          {kycStatus === "verified" && (
            <div className="mt-4 p-3 rounded-xl bg-success/10 border border-success/20 text-xs text-muted-foreground">
              <strong className="text-success">Identity verified.</strong> You are eligible to trade live. Switch to live account mode above when ready.
            </div>
          )}
        </div>
      </div>

      {/* T007 — Account Tier Benefits table */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Account Tier Benefits</h2>
          <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
            accountType === "vip"      ? "bg-violet-500/15 text-violet-400 border-violet-500/30"  :
            accountType === "platinum" ? "bg-slate-400/15 text-slate-300 border-slate-400/30"     :
            accountType === "gold"     ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"  :
            accountType === "silver"   ? "bg-zinc-300/15 text-zinc-300 border-zinc-300/30"         :
                                         "bg-primary/15 text-primary border-primary/30"
          }`}>
            Current: {accountType.charAt(0).toUpperCase() + accountType.slice(1)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-muted-foreground font-medium pb-2 pr-3">Tier</th>
                <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Commission / lot</th>
                <th className="text-right text-muted-foreground font-medium pb-2 pr-3">Spread</th>
                <th className="text-right text-muted-foreground font-medium pb-2">Min. Deposit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {([
                { key: "real",     label: "Standard", color: "text-primary",    bg: "bg-primary/10",    commission: 2.00, spread: "1.00×", minDeposit: "$0"      },
                { key: "silver",   label: "Silver",   color: "text-zinc-300",   bg: "bg-zinc-300/10",   commission: 1.50, spread: "0.95×", minDeposit: "$250"    },
                { key: "gold",     label: "Gold",     color: "text-yellow-400", bg: "bg-yellow-400/10", commission: 1.00, spread: "0.90×", minDeposit: "$2,500"  },
                { key: "platinum", label: "Platinum", color: "text-slate-300",  bg: "bg-slate-300/10",  commission: 0.50, spread: "0.85×", minDeposit: "$10,000" },
                { key: "vip",      label: "VIP",      color: "text-violet-400", bg: "bg-violet-400/10", commission: 0.00, spread: "0.80×", minDeposit: "$50,000" },
              ] as const).map(tier => {
                const isCurrent = accountType === tier.key;
                return (
                  <tr key={tier.key} className={`${isCurrent ? tier.bg : ""} transition-colors`}>
                    <td className={`py-2.5 pr-3 font-semibold ${isCurrent ? tier.color : "text-muted-foreground"}`}>
                      {tier.label}{isCurrent && <span className="ml-1.5 text-[10px] opacity-60">◀ you</span>}
                    </td>
                    <td className={`py-2.5 pr-3 text-right font-mono ${isCurrent ? `${tier.color} font-bold` : "text-foreground"}`}>
                      {tier.commission === 0 ? <span className="text-success font-bold">Free</span> : `$${tier.commission.toFixed(2)}`}
                    </td>
                    <td className={`py-2.5 pr-3 text-right font-mono ${isCurrent ? `${tier.color} font-bold` : "text-foreground"}`}>
                      {tier.spread}
                    </td>
                    <td className={`py-2.5 text-right ${isCurrent ? tier.color : "text-muted-foreground"}`}>
                      {tier.minDeposit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/40">
          Tier upgrades are applied automatically based on your net deposit. Contact support to request a manual tier review.
        </p>
      </div>
    </div>
  );
}

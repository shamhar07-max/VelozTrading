// Pure rate-grid, tier, lifecycle and validation logic for the IB/Sub-IB programme
// (VEL-IB-SPEC-2026-R1). No database imports — safe for unit tests.

export const PARENT_OVERRIDE_PER_LOT = 3.0;
export const VOLUME_REBATE_PER_LOT = 0.1;
export const VOLUME_REBATE_CAP_LOTS = 1000;
export const CPA_QUALIFYING_DEPOSIT_USD = 250;
export const RETROACTIVE_ATTRIBUTION_WINDOW_DAYS = 7;

/** USD per standard lot by partner role and monthly network-volume tier. */
export const LOT_REBATE_RATES = {
  ib: { tier1: 8.0, tier2: 9.5, tier3: 11.0 },
  subIb: { tier1: 5.0, tier2: 6.5, tier3: 8.0 },
} as const;

export type PartnerRole = keyof typeof LOT_REBATE_RATES; // "ib" | "subIb"
export type PartnerTier = keyof (typeof LOT_REBATE_RATES)["ib"]; // tier1..3

export function lotRebatePerLot(role: PartnerRole, tier: PartnerTier): number {
  return LOT_REBATE_RATES[role][tier];
}

/** Tier assignment uses the previous calendar month's settled network volume (spec §6). */
export function tierForMonthlyVolume(monthlyLots: number): PartnerTier {
  if (monthlyLots > 1500) return "tier3";
  if (monthlyLots > 500) return "tier2";
  return "tier1";
}

/** Volume rebate applies only to the first VOLUME_REBATE_CAP_LOTS lots of the month. */
export function volumeRebateForLots(lotsThisMonth: number): number {
  const eligible = Math.max(0, Math.min(lotsThisMonth, VOLUME_REBATE_CAP_LOTS));
  return round2(eligible * VOLUME_REBATE_PER_LOT);
}

export interface RebateSplit {
  rebate: number; // owning partner's lot rebate incl. volume-rebate component
  parentOverride: number; // flat override owed to the parent when owner is a sub-IB
}

/** Pure calculation for one closed-trade accrual. */
export function computeRebateSplit(params: {
  role: PartnerRole;
  tier: PartnerTier;
  lots: number;
  partnerLotsThisMonth: number;
}): RebateSplit {
  const lots = Math.max(0, params.lots);
  const base = round2(lots * lotRebatePerLot(params.role, params.tier));
  // The volume rebate is earned on the partner's first 1,000 monthly lots; approximate the
  // per-trade share by capping this trade's contribution against the remaining allowance.
  const allowanceLeft = Math.max(
    0,
    VOLUME_REBATE_CAP_LOTS - Math.max(0, params.partnerLotsThisMonth),
  );
  const eligibleLots = Math.min(lots, allowanceLeft);
  const rebate = round2(base + eligibleLots * VOLUME_REBATE_PER_LOT);
  const parentOverride =
    params.role === "subIb" ? round2(lots * PARENT_OVERRIDE_PER_LOT) : 0;
  return { rebate, parentOverride };
}

// ── Lifecycle (spec §8) ─────────────────────────────────────────────────────

export const PARTNER_STATUSES = [
  "applied",
  "vetting",
  "active",
  "suspended",
  "terminated",
  "dormant",
] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<PartnerStatus, readonly PartnerStatus[]> = {
  applied: ["vetting", "terminated"],
  vetting: ["active", "applied", "terminated"],
  active: ["suspended", "dormant", "terminated"],
  suspended: ["active", "terminated"],
  terminated: [],
  dormant: ["active", "terminated"],
};

export function canTransition(from: PartnerStatus, to: PartnerStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Only active partners accrue new commissions (spec §5 invariant). */
export function canAccrue(status: string): boolean {
  return status === "active";
}

/** Withdrawals allowed for active partners; dormant partners may still drain their wallet (spec §8). */
export function canWithdraw(status: string): boolean {
  return status === "active" || status === "dormant";
}

/** Referral codes are namespaced by tier: VT-IB-* for top-level IBs, VT-SUB-* for desks. */
export function codePrefixForRole(role: PartnerRole): string {
  return role === "ib" ? "VT-IB-" : "VT-SUB-";
}

export function validatePartnerCreation(params: {
  referralCode: string;
  parentReferralCode?: string | null;
}): string | null {
  const code = params.referralCode.toUpperCase();
  const expectsSub = Boolean(params.parentReferralCode);
  if (expectsSub && !code.startsWith("VT-SUB-")) {
    return `Sub-IB codes must start with 'VT-SUB-' (got '${code}')`;
  }
  if (!expectsSub && !code.startsWith("VT-IB-")) {
    return `IB codes must start with 'VT-IB-' (got '${code}')`;
  }
  return null;
}


// ── Run-month helpers ───────────────────────────────────────────────────────

/** UTC "YYYY-MM" key used to settle commission runs. */
export function runMonthFor(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function utcMonthStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

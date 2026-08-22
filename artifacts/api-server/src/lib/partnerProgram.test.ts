import { describe, expect, it } from "vitest";
import {
  LOT_REBATE_RATES,
  PARENT_OVERRIDE_PER_LOT,
  VOLUME_REBATE_CAP_LOTS,
  canAccrue,
  canTransition,
  canWithdraw,
  codePrefixForRole,
  computeRebateSplit,
  lotRebatePerLot,
  runMonthFor,
  tierForMonthlyVolume,
  validatePartnerCreation,
  volumeRebateForLots,
} from "./partnerProgramMath";

describe("lot rebate grid (spec §3)", () => {
  it("matches the published IB rate card", () => {
    expect(lotRebatePerLot("ib", "tier1")).toBe(8);
    expect(lotRebatePerLot("ib", "tier2")).toBe(9.5);
    expect(lotRebatePerLot("ib", "tier3")).toBe(11);
  });

  it("matches the published sub-IB rate card", () => {
    expect(LOT_REBATE_RATES.subIb).toEqual({ tier1: 5, tier2: 6.5, tier3: 8 });
  });
});

describe("tier assignment", () => {
  it("assigns tiers by monthly network volume boundaries", () => {
    expect(tierForMonthlyVolume(0)).toBe("tier1");
    expect(tierForMonthlyVolume(500)).toBe("tier1");
    expect(tierForMonthlyVolume(501)).toBe("tier2");
    expect(tierForMonthlyVolume(1500)).toBe("tier2");
    expect(tierForMonthlyVolume(1501)).toBe("tier3");
  });
});

describe("rebate split per closed trade", () => {
  it("pays tier rate plus volume rebate within the allowance", () => {
    const split = computeRebateSplit({
      role: "ib",
      tier: "tier1",
      lots: 10,
      partnerLotsThisMonth: 100,
    });
    expect(split.rebate).toBeCloseTo(10 * 8 + 10 * 0.1, 2);
    expect(split.parentOverride).toBe(0); // top-level IB has no parent
  });

  it("stops the volume rebate once the 1,000-lot cap is consumed", () => {
    const inside = computeRebateSplit({
      role: "ib",
      tier: "tier1",
      lots: 5,
      partnerLotsThisMonth: VOLUME_REBATE_CAP_LOTS - 3,
    });
    expect(inside.rebate).toBeCloseTo(5 * 8 + 3 * 0.1, 2);

    const outside = computeRebateSplit({
      role: "ib",
      tier: "tier1",
      lots: 4,
      partnerLotsThisMonth: VOLUME_REBATE_CAP_LOTS,
    });
    expect(outside.rebate).toBeCloseTo(4 * 8, 2);
  });

  it("owes a flat $3/lot parent override for sub-IB volume at any tier", () => {
    for (const tier of ["tier1", "tier2", "tier3"] as const) {
      const split = computeRebateSplit({
        role: "subIb",
        tier,
        lots: 12,
        partnerLotsThisMonth: 0,
      });
      expect(split.parentOverride).toBeCloseTo(12 * PARENT_OVERRIDE_PER_LOT, 2);
      expect(split.rebate).toBeCloseTo(12 * LOT_REBATE_RATES.subIb[tier] + 12 * 0.1, 2);
    }
  });
});

describe("volume rebate helper", () => {
  it("caps eligible lots and rounds to cents", () => {
    expect(volumeRebateForLots(250)).toBeCloseTo(25.0, 2);
    expect(volumeRebateForLots(50_000)).toBeCloseTo(VOLUME_REBATE_CAP_LOTS * 0.1, 2);
    expect(volumeRebateForLots(-5)).toBe(0);
  });
});

describe("lifecycle transitions (spec §8)", () => {
  it("allows the documented happy path", () => {
    expect(canTransition("applied", "vetting")).toBe(true);
    expect(canTransition("vetting", "active")).toBe(true);
    expect(canTransition("active", "suspended")).toBe(true);
    expect(canTransition("suspended", "active")).toBe(true);
    expect(canTransition("active", "dormant")).toBe(true);
    expect(canTransition("dormant", "active")).toBe(true);
  });

  it("permits termination from every live state but never out of terminated", () => {
    for (const s of ["applied", "vetting", "active", "suspended", "dormant"] as const) {
      expect(canTransition(s, "terminated")).toBe(true);
    }
    expect(canTransition("terminated", "active")).toBe(false);
  });

  it("never reactivates directly from applied or jumps vetting", () => {
    expect(canTransition("applied", "active")).toBe(false);
    expect(canTransition("suspended", "dormant")).toBe(false);
  });

  it("accrues and withdraws only per spec", () => {
    expect(canAccrue("active")).toBe(true);
    expect(canAccrue("suspended")).toBe(false);
    expect(canWithdraw("active")).toBe(true);
    expect(canWithdraw("dormant")).toBe(true); // wallet drain allowed
    expect(canWithdraw("terminated")).toBe(false);
  });
});

describe("referral-code namespaces", () => {
  it("enforces VT-IB- vs VT-SUB- prefixes by role", () => {
    expect(codePrefixForRole("ib")).toBe("VT-IB-");
    expect(codePrefixForRole("subIb")).toBe("VT-SUB-");

    expect(validatePartnerCreation({ referralCode: "VT-IB-IN-001" })).toBeNull();
    expect(validatePartnerCreation({ referralCode: "VT-SUB-IN-001", parentReferralCode: "VT-IB-IN-001" })).toBeNull();
    expect(validatePartnerCreation({ referralCode: "VT-IB-IN-001", parentReferralCode: "VT-IB-UK-002" })).toMatch(
      /VT-SUB-/,
    );
    expect(validatePartnerCreation({ referralCode: "ROHIT" })).toMatch(/VT-IB-/);
  });
});

describe("run month keying", () => {
  it("formats UTC YYYY-MM keys", () => {
    expect(runMonthFor(new Date(Date.UTC(2026, 7, 23)))).toBe("2026-08");
    expect(runMonthFor(new Date(Date.UTC(2026, 0, 1)))).toBe("2026-01");
  });
});

import { logger } from "./logger";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const APP_URL = process.env.APP_URL ?? "https://veloztrade.com";
const SUPPORT_EMAIL = "support@veloztrade.com";

// Email is sent directly through the Resend API. Without RESEND_API_KEY,
// email sends are skipped with a warning (alerts, admin notifications).
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";

async function resendSend(payload: object): Promise<void> {
  if (!RESEND_API_KEY) {
    logger.warn({ to: (payload as { to: unknown }).to }, "RESEND_API_KEY not set — email skipped");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const status = res.status;
    const body = await res.json().catch(() => null);
    if (status >= 400) {
      logger.error({ status, body }, "Resend email failed");
    } else {
      logger.info({ to: (payload as { to: unknown }).to }, "Email sent via Resend");
    }
  } catch (err) {
    logger.error({ err }, "Resend request failed");
  }
}

export async function sendPushNotification(token: string, title: string, body: string): Promise<void> {
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: token, title, body, sound: "default", priority: "high" }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    logger.warn({ err }, "Push notification failed");
  }
}

export async function sendAdminNotification(subject: string, html: string): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) {
    logger.warn("Admin email skipped: ADMIN_NOTIFICATION_EMAIL not set");
    return;
  }
  await resendSend({
    from: `VelozTrade <${FROM_EMAIL}>`,
    to: [adminEmail],
    subject,
    html,
  });
}

export async function sendUserNotification(toEmail: string, subject: string, html: string): Promise<void> {
  await resendSend({
    from: `VelozTrade <${FROM_EMAIL}>`,
    to: [toEmail],
    subject,
    html,
  });
}

// ── Shared layout ─────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtUsd(amount: number): string {
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(): string {
  return new Date().toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "long", timeStyle: "short" }) + " UTC";
}

interface LayoutOpts {
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  headerIcon: string;
  badgeText: string;
  title: string;
  body: string;
  isAdmin?: boolean;
}

function layout(opts: LayoutOpts): string {
  const { accentColor, accentBg, accentBorder, headerIcon, badgeText, title, body, isAdmin } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#060d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#060d1a;">
  <tr>
    <td align="center" style="padding:32px 16px 24px;">

      <!-- Header brand bar -->
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="padding-bottom:24px;" align="center">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);border-radius:10px;padding:1px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background:#060d1a;border-radius:9px;padding:8px 18px;">
                        <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#f1f5f9;">Veloz<span style="color:#0ea5e9;">Trade</span></span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Main card -->
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#0d1525;border:1px solid #1e2d45;border-radius:16px;overflow:hidden;">

        <!-- Card accent top bar -->
        <tr>
          <td style="height:4px;background:linear-gradient(90deg,${accentColor},${accentColor}88,transparent);"></td>
        </tr>

        <!-- Card header -->
        <tr>
          <td style="padding:32px 36px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                    <tr>
                      <td style="width:52px;height:52px;background-color:${accentBg};border:1px solid ${accentBorder};border-radius:14px;text-align:center;vertical-align:middle;font-size:24px;line-height:52px;">
                        ${headerIcon}
                      </td>
                    </tr>
                  </table>
                  <div style="display:inline-block;background-color:${accentBg};border:1px solid ${accentBorder};border-radius:20px;padding:4px 14px;margin-bottom:14px;">
                    <span style="font-size:11px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:0.08em;">${esc(badgeText)}</span>
                  </div>
                  <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#f1f5f9;letter-spacing:-0.3px;">${esc(title)}</h1>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card body -->
        <tr>
          <td style="padding:0 36px 36px;">
            ${body}
          </td>
        </tr>

      </table>

      <!-- Footer -->
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;margin-top:24px;">
        <tr>
          <td style="padding:0 8px;text-align:center;">
            <p style="margin:0 0 10px;font-size:12px;color:#475569;">
              <strong style="color:#64748b;">VelozTrade</strong> · Professional CFD &amp; Forex Trading Platform
            </p>
            ${isAdmin
              ? `<p style="margin:0 0 8px;font-size:11px;color:#1e3a5f;">This is an automated admin notification.</p>`
              : `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 10px;">
                  <tr>
                    <td style="padding:0 8px;">
                      <a href="https://t.me/veloztrade" style="font-size:11px;color:#0ea5e9;text-decoration:none;">Telegram</a>
                    </td>
                    <td style="padding:0 8px;color:#1e2d45;">|</td>
                    <td style="padding:0 8px;">
                      <a href="https://x.com/veloztrade" style="font-size:11px;color:#0ea5e9;text-decoration:none;">X / Twitter</a>
                    </td>
                    <td style="padding:0 8px;color:#1e2d45;">|</td>
                    <td style="padding:0 8px;">
                      <a href="mailto:${SUPPORT_EMAIL}" style="font-size:11px;color:#0ea5e9;text-decoration:none;">${SUPPORT_EMAIL}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:10px;color:#334155;line-height:1.5;">
                  You are receiving this email because you have an account at VelozTrade.<br>
                  <a href="${APP_URL}/profile" style="color:#475569;text-decoration:underline;">Manage email preferences</a> · VelozTrade, veloztrade.com
                </p>`}
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

// ── Reusable partial builders ─────────────────────────────────────────────────

function fieldRow(label: string, value: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
    <tr>
      <td style="background-color:#111d2e;border:1px solid #1e2d45;border-radius:8px;padding:12px 16px;">
        <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">${label}</div>
        <div style="font-size:14px;color:#cbd5e1;font-weight:600;">${value}</div>
      </td>
    </tr>
  </table>`;
}

function amountBlock(amount: string, color: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
    <tr>
      <td style="background-color:#0a1628;border:1px solid #1e2d45;border-radius:12px;padding:20px 24px;text-align:center;">
        <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Amount</div>
        <div style="font-size:40px;font-weight:900;color:${color};font-variant-numeric:tabular-nums;letter-spacing:-1px;">${amount}</div>
      </td>
    </tr>
  </table>`;
}

function infoBox(text: string, color: string, bgColor: string, borderColor: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <tr>
      <td style="background-color:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:14px 18px;">
        <span style="font-size:13px;color:${color};line-height:1.6;">${text}</span>
      </td>
    </tr>
  </table>`;
}

function ctaButton(text: string, href: string, color: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
    <tr>
      <td style="background-color:${color};border-radius:10px;padding:14px 28px;text-align:center;">
        <a href="${href}" style="font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;display:inline-block;">${text}</a>
      </td>
    </tr>
  </table>`;
}

function divider(): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
    <tr><td style="height:1px;background-color:#1e2d45;"></td></tr>
  </table>`;
}

function bodyText(text: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;color:#94a3b8;line-height:1.7;">${text}</p>`;
}

// ── Admin notification templates ───────────────────────────────────────────────

export function kycSubmittedHtml(userEmail: string, userName: string, accountType: string): string {
  const body = `
    ${bodyText(`A trader has submitted their identity documents for KYC verification. Please review the application in the admin panel.`)}
    ${fieldRow("Full Name", esc(userName !== "—" ? userName : "Not provided"))}
    ${fieldRow("Email Address", esc(userEmail))}
    ${fieldRow("Account Tier", esc(accountType.charAt(0).toUpperCase() + accountType.slice(1)))}
    ${fieldRow("Submitted At", fmtDate())}
    ${divider()}
    ${bodyText(`Log in to the admin panel to review the uploaded documents and approve or reject this application.`)}
    ${ctaButton("Review KYC Application →", `${APP_URL}/admin`, "#f59e0b")}
  `;
  return layout({
    accentColor: "#f59e0b",
    accentBg: "#f59e0b15",
    accentBorder: "#f59e0b30",
    headerIcon: "⏳",
    badgeText: "KYC Application",
    title: "New KYC Verification Request",
    body,
    isAdmin: true,
  });
}

export function depositRequestedHtml(
  userEmail: string,
  userName: string,
  amount: number,
  method: string
): string {
  const body = `
    ${bodyText(`A trader has submitted a deposit request. Review the payment proof and approve or reject it from the admin panel.`)}
    ${amountBlock(fmtUsd(amount), "#10b981")}
    ${fieldRow("Trader", esc(userName !== "—" ? userName : userEmail))}
    ${fieldRow("Email", esc(userEmail))}
    ${fieldRow("Payment Method", esc(method.charAt(0).toUpperCase() + method.slice(1)))}
    ${fieldRow("Submitted At", fmtDate())}
    ${divider()}
    ${ctaButton("Review Deposit →", `${APP_URL}/admin`, "#10b981")}
  `;
  return layout({
    accentColor: "#10b981",
    accentBg: "#10b98115",
    accentBorder: "#10b98130",
    headerIcon: "💰",
    badgeText: "Deposit Request",
    title: "New Deposit Request",
    body,
    isAdmin: true,
  });
}

export function withdrawalRequestedHtml(
  userEmail: string,
  userName: string,
  amount: number,
  method: string,
  balance: number
): string {
  const body = `
    ${bodyText(`A verified trader has submitted a withdrawal request. The funds have been held from their balance pending your review.`)}
    ${amountBlock(fmtUsd(amount), "#818cf8")}
    ${fieldRow("Trader", esc(userName !== "—" ? userName : userEmail))}
    ${fieldRow("Email", esc(userEmail))}
    ${fieldRow("Withdrawal Method", esc(method.charAt(0).toUpperCase() + method.slice(1)))}
    ${fieldRow("Balance Before Withdrawal", fmtUsd(balance))}
    ${fieldRow("Submitted At", fmtDate())}
    ${divider()}
    ${ctaButton("Review Withdrawal →", `${APP_URL}/admin`, "#6366f1")}
  `;
  return layout({
    accentColor: "#818cf8",
    accentBg: "#6366f115",
    accentBorder: "#6366f130",
    headerIcon: "🏦",
    badgeText: "Withdrawal Request",
    title: "New Withdrawal Request",
    body,
    isAdmin: true,
  });
}

// ── User notification templates ────────────────────────────────────────────────

export function welcomeHtml(userName: string): string {
  const body = `
    ${bodyText(`Hi ${esc(userName)},`)}
    ${bodyText(`Welcome to VelozTrade — a professional CFD and Forex trading platform. Your account has been created and is ready to use.`)}
    ${infoBox(
      `🎯 <strong style="color:#f1f5f9;">Start with a Demo Account</strong><br>
      <span style="color:#94a3b8;">Practice trading with $10,000 virtual funds before going live. Zero risk, full experience.</span>`,
      "#6ee7b7", "#0a2318", "#10b98130"
    )}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
      <tr>
        <td width="48%" style="padding-right:6px;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background-color:#111d2e;border:1px solid #1e2d45;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:22px;margin-bottom:8px;">📈</div>
                <div style="font-size:13px;font-weight:700;color:#f1f5f9;margin-bottom:4px;">Live Markets</div>
                <div style="font-size:12px;color:#64748b;">Forex, Crypto, Stocks &amp; more</div>
              </td>
            </tr>
          </table>
        </td>
        <td width="4%"></td>
        <td width="48%" style="padding-left:6px;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background-color:#111d2e;border:1px solid #1e2d45;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:22px;margin-bottom:8px;">🛡️</div>
                <div style="font-size:13px;font-weight:700;color:#f1f5f9;margin-bottom:4px;">Risk Tools</div>
                <div style="font-size:12px;color:#64748b;">Stop Loss, Take Profit, Alerts</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${divider()}
    ${bodyText(`Complete KYC verification in your profile to unlock withdrawals and full leverage access.`)}
    ${ctaButton("Go to Dashboard →", APP_URL, "#0ea5e9")}
  `;
  return layout({
    accentColor: "#0ea5e9",
    accentBg: "#0ea5e915",
    accentBorder: "#0ea5e930",
    headerIcon: "🚀",
    badgeText: "Welcome to VelozTrade",
    title: `Welcome, ${userName}!`,
    body,
  });
}

export function tierUpgradeHtml(userName: string, newTier: string, totalDeposited: number): string {
  const TIER_COLORS: Record<string, string> = {
    silver: "#94a3b8",
    gold: "#f59e0b",
    platinum: "#818cf8",
    vip: "#ec4899",
  };
  const TIER_PERKS: Record<string, string[]> = {
    silver:   ["95% spread multiplier", "$0.50/lot commission", "Access to silver instruments"],
    gold:     ["90% spread multiplier", "$0.40/lot commission", "Priority customer support"],
    platinum: ["85% spread multiplier", "$0.30/lot commission", "Dedicated account manager"],
    vip:      ["80% spread multiplier", "$0.20/lot commission", "Exclusive VIP events &amp; signals"],
  };
  const tierColor = TIER_COLORS[newTier] ?? "#94a3b8";
  const perks = TIER_PERKS[newTier] ?? [];
  const tierLabel = newTier.charAt(0).toUpperCase() + newTier.slice(1);

  const perksHtml = perks.map(p =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #1e2d45;font-size:13px;color:#cbd5e1;">✦ ${p}</td></tr>`
  ).join("");

  const body = `
    ${bodyText(`Hi ${esc(userName)},`)}
    ${bodyText(`Congratulations! Your trading account has been upgraded based on your cumulative deposits.`)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr>
        <td style="background:linear-gradient(135deg,${tierColor}22,${tierColor}08);border:1px solid ${tierColor}44;border-radius:14px;padding:24px;text-align:center;">
          <div style="font-size:32px;margin-bottom:10px;">
            ${newTier === "silver" ? "🥈" : newTier === "gold" ? "🥇" : newTier === "platinum" ? "💎" : "👑"}
          </div>
          <div style="font-size:11px;font-weight:700;color:${tierColor};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Account Tier</div>
          <div style="font-size:28px;font-weight:900;color:${tierColor};">${tierLabel}</div>
        </td>
      </tr>
    </table>
    ${fieldRow("Total Deposited", fmtUsd(totalDeposited))}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
      <tr>
        <td style="background-color:#111d2e;border:1px solid #1e2d45;border-radius:10px;padding:16px 20px;">
          <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Your New Benefits</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${perksHtml}
          </table>
        </td>
      </tr>
    </table>
    ${divider()}
    ${ctaButton("Go to Dashboard →", APP_URL, tierColor)}
  `;
  return layout({
    accentColor: tierColor,
    accentBg: `${tierColor}15`,
    accentBorder: `${tierColor}30`,
    headerIcon: newTier === "silver" ? "🥈" : newTier === "gold" ? "🥇" : newTier === "platinum" ? "💎" : "👑",
    badgeText: "Account Upgrade",
    title: `You've Reached ${tierLabel} Tier!`,
    body,
  });
}

export function depositApprovedHtml(userName: string, amount: number): string {
  const body = `
    ${bodyText(`Hi ${esc(userName)},`)}
    ${bodyText(`Great news — your deposit has been reviewed and approved. Your VelozTrade account has been credited and your funds are ready for trading.`)}
    ${amountBlock(fmtUsd(amount), "#10b981")}
    ${infoBox(
      "💹 Your funds are now live in your account. Head to the dashboard to start trading immediately.",
      "#6ee7b7", "#071a0f", "#10b98130"
    )}
    ${divider()}
    ${ctaButton("Start Trading →", APP_URL, "#10b981")}
  `;
  return layout({
    accentColor: "#10b981",
    accentBg: "#10b98115",
    accentBorder: "#10b98130",
    headerIcon: "✅",
    badgeText: "Deposit Approved",
    title: "Your Deposit Has Been Approved!",
    body,
  });
}

export function depositRejectedHtml(userName: string, amount: number, reason?: string): string {
  const body = `
    ${bodyText(`Hi ${esc(userName)},`)}
    ${bodyText(`Unfortunately, your deposit request could not be approved at this time.`)}
    ${amountBlock(fmtUsd(amount), "#ef5350")}
    ${reason
      ? infoBox(`<strong style="color:#f1f5f9;">Reason:</strong><br><span style="color:#fca5a5;">${esc(reason)}</span>`, "#fca5a5", "#1f0a0a", "#ef535030")
      : ""}
    ${bodyText(`Please try submitting a new deposit with the correct payment details, or contact our support team for assistance.`)}
    ${divider()}
    ${ctaButton("Submit a New Deposit →", `${APP_URL}/deposit`, "#0ea5e9")}
  `;
  return layout({
    accentColor: "#ef5350",
    accentBg: "#ef535015",
    accentBorder: "#ef535030",
    headerIcon: "❌",
    badgeText: "Deposit Not Approved",
    title: "Deposit Request Unsuccessful",
    body,
  });
}

export function withdrawalApprovedHtml(userName: string, amount: number): string {
  const body = `
    ${bodyText(`Hi ${esc(userName)},`)}
    ${bodyText(`Your withdrawal request has been approved and is currently being processed.`)}
    ${amountBlock(fmtUsd(amount), "#818cf8")}
    ${infoBox(
      "⏱ Funds are typically received within <strong style=\"color:#f1f5f9;\">1–3 business days</strong> depending on your selected payment method.",
      "#a5b4fc", "#0e0e2a", "#6366f130"
    )}
    ${divider()}
    ${ctaButton("View Account →", APP_URL, "#6366f1")}
  `;
  return layout({
    accentColor: "#818cf8",
    accentBg: "#6366f115",
    accentBorder: "#6366f130",
    headerIcon: "🏦",
    badgeText: "Withdrawal Approved",
    title: "Your Withdrawal Is Being Processed",
    body,
  });
}

export function withdrawalRejectedHtml(userName: string, amount: number, reason?: string): string {
  const body = `
    ${bodyText(`Hi ${esc(userName)},`)}
    ${bodyText(`Your withdrawal request was not approved. Your funds have been returned to your account balance.`)}
    ${amountBlock(fmtUsd(amount), "#ef5350")}
    ${reason
      ? infoBox(`<strong style="color:#f1f5f9;">Reason:</strong><br><span style="color:#fca5a5;">${esc(reason)}</span>`, "#fca5a5", "#1f0a0a", "#ef535030")
      : ""}
    ${infoBox(
      "✅ Your balance has been fully restored. You can submit a new withdrawal request at any time.",
      "#6ee7b7", "#071a0f", "#10b98130"
    )}
    ${divider()}
    ${ctaButton("View Account →", APP_URL, "#0ea5e9")}
  `;
  return layout({
    accentColor: "#ef5350",
    accentBg: "#ef535015",
    accentBorder: "#ef535030",
    headerIcon: "⚠️",
    badgeText: "Withdrawal Not Processed",
    title: "Withdrawal Request Unsuccessful",
    body,
  });
}

export function kycApprovedHtml(userName: string): string {
  const body = `
    ${bodyText(`Hi ${esc(userName)},`)}
    ${bodyText(`Your identity has been successfully verified. Your VelozTrade account is now fully unlocked.`)}
    ${infoBox(
      "✅ <strong style=\"color:#f1f5f9;\">Verified Account</strong>",
      "#6ee7b7", "#071a0f", "#10b98130"
    )}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
      <tr>
        <td style="background-color:#111d2e;border:1px solid #1e2d45;border-radius:10px;padding:16px 20px;">
          <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Now Unlocked</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:8px 0;border-bottom:1px solid #1e2d45;font-size:13px;color:#cbd5e1;">🏦 Withdrawals enabled</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #1e2d45;font-size:13px;color:#cbd5e1;">💹 Full leverage access</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#cbd5e1;">📈 Live real money trading</td></tr>
          </table>
        </td>
      </tr>
    </table>
    ${divider()}
    ${ctaButton("Start Trading →", APP_URL, "#10b981")}
  `;
  return layout({
    accentColor: "#10b981",
    accentBg: "#10b98115",
    accentBorder: "#10b98130",
    headerIcon: "🪪",
    badgeText: "Identity Verified",
    title: "KYC Verification Approved!",
    body,
  });
}

export function kycRejectedHtml(userName: string, reason?: string): string {
  const body = `
    ${bodyText(`Hi ${esc(userName)},`)}
    ${bodyText(`Unfortunately we were unable to verify your identity with the documents provided.`)}
    ${reason
      ? infoBox(`<strong style="color:#f1f5f9;">Reason:</strong><br><span style="color:#fca5a5;">${esc(reason)}</span>`, "#fca5a5", "#1f0a0a", "#ef535030")
      : ""}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
      <tr>
        <td style="background-color:#111d2e;border:1px solid #1e2d45;border-radius:10px;padding:16px 20px;">
          <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Common Reasons for Rejection</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:6px 0;border-bottom:1px solid #1e2d45;font-size:13px;color:#94a3b8;">• Expired or damaged ID document</td></tr>
            <tr><td style="padding:6px 0;border-bottom:1px solid #1e2d45;font-size:13px;color:#94a3b8;">• Blurry or unreadable photos</td></tr>
            <tr><td style="padding:6px 0;font-size:13px;color:#94a3b8;">• Selfie doesn't match ID photo</td></tr>
          </table>
        </td>
      </tr>
    </table>
    ${bodyText(`Please re-submit with clear, valid government-issued ID and ensure all details are fully visible.`)}
    ${divider()}
    ${ctaButton("Re-submit KYC →", `${APP_URL}/profile`, "#0ea5e9")}
  `;
  return layout({
    accentColor: "#ef5350",
    accentBg: "#ef535015",
    accentBorder: "#ef535030",
    headerIcon: "❌",
    badgeText: "Verification Unsuccessful",
    title: "KYC Verification Failed",
    body,
  });
}

export function cryptoDepositConfirmedHtml(userName: string, amountUsdt: number, txHash: string, network: string): string {
  const short = txHash.length > 16 ? `${txHash.slice(0, 8)}…${txHash.slice(-8)}` : txHash;
  const body = `
    ${bodyText(`Hi ${esc(userName)},`)}
    ${bodyText(`Your on-chain USDT deposit has been detected and confirmed. Your account balance has been credited.`)}
    ${amountBlock(`${amountUsdt.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDT`, "#10b981")}
    ${fieldRow("Network", esc(network))}
    ${fieldRow("Transaction Hash", esc(short))}
    ${fieldRow("Credited At", fmtDate())}
    ${infoBox(
      "💹 Your USDT has been converted to USD and is live in your trading account.",
      "#6ee7b7", "#071a0f", "#10b98130"
    )}
    ${divider()}
    ${ctaButton("Start Trading →", APP_URL, "#10b981")}
  `;
  return layout({
    accentColor: "#10b981",
    accentBg: "#10b98115",
    accentBorder: "#10b98130",
    headerIcon: "⛓️",
    badgeText: "Crypto Deposit Confirmed",
    title: "On-Chain Deposit Received!",
    body,
  });
}

export function partnerNewReferralSignupHtml(
  partnerName: string,
  newUserEmail: string,
  totalReferrals: number,
): string {
  const body = `
    ${bodyText(`Hi ${esc(partnerName)},`)}
    ${bodyText(`Great news — someone just signed up through your referral link. The new user has been linked to your partner account.`)}
    ${fieldRow("New Sign-Up Email", esc(newUserEmail))}
    ${fieldRow("Total Referrals (All Time)", String(totalReferrals))}
    ${fieldRow("Registered At", fmtDate())}
    ${infoBox(
      `🎯 <strong style="color:#f1f5f9;">CPA Bonus Pending</strong><br>
      <span style="color:#94a3b8;">You'll earn your CPA commission once this user makes their first qualifying deposit of $250 or more.</span>`,
      "#93c5fd", "#0a1628", "#3b82f630"
    )}
    ${divider()}
    ${ctaButton("View Partner Dashboard →", `${APP_URL}/partner`, "#0ea5e9")}
  `;
  return layout({
    accentColor: "#0ea5e9",
    accentBg: "#0ea5e915",
    accentBorder: "#0ea5e930",
    headerIcon: "🙋",
    badgeText: "New Referral Sign-Up",
    title: "Someone Joined via Your Link!",
    body,
  });
}

export function partnerCpaEarnedHtml(
  partnerName: string,
  newUserEmail: string,
  cpaAmount: number,
  totalReferrals: number,
  depositingReferrals: number,
): string {
  const body = `
    ${bodyText(`Hi ${esc(partnerName)},`)}
    ${bodyText(`Your referred user just made their first qualifying deposit — your CPA bonus has been credited to your account!`)}
    ${amountBlock(fmtUsd(cpaAmount), "#10b981")}
    ${fieldRow("Referred User", esc(newUserEmail))}
    ${fieldRow("Total Referrals", String(totalReferrals))}
    ${fieldRow("Depositing Referrals", String(depositingReferrals))}
    ${fieldRow("Credited At", fmtDate())}
    ${infoBox(
      `✅ <strong style="color:#f1f5f9;">CPA Bonus Credited</strong><br>
      <span style="color:#94a3b8;">The CPA commission has been added directly to your withdrawable balance.</span>`,
      "#6ee7b7", "#071a0f", "#10b98130"
    )}
    ${divider()}
    ${ctaButton("View Partner Dashboard →", `${APP_URL}/partner`, "#10b981")}
  `;
  return layout({
    accentColor: "#10b981",
    accentBg: "#10b98115",
    accentBorder: "#10b98130",
    headerIcon: "💸",
    badgeText: "CPA Bonus Earned",
    title: `You Earned ${fmtUsd(cpaAmount)} CPA!`,
    body,
  });
}

export function priceAlertHtml(userName: string, symbol: string, direction: "above" | "below", targetPrice: number, currentPrice: number): string {
  const isAbove = direction === "above";
  const color = isAbove ? "#10b981" : "#ef5350";
  const body = `
    ${bodyText(`Hi ${esc(userName)},`)}
    ${bodyText(`Your price alert for <strong style="color:#f1f5f9;">${esc(symbol)}</strong> has been triggered.`)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr>
        <td style="background-color:#0a1628;border:1px solid #1e2d45;border-radius:12px;padding:20px 24px;text-align:center;">
          <div style="font-size:14px;font-weight:700;color:#475569;margin-bottom:12px;">${esc(symbol)}</div>
          <div style="font-size:36px;font-weight:900;color:${color};font-variant-numeric:tabular-nums;">${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
          <div style="font-size:12px;color:#64748b;margin-top:8px;">
            Alert: price went ${isAbove ? "above" : "below"} ${targetPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
          </div>
        </td>
      </tr>
    </table>
    ${fieldRow("Symbol", esc(symbol))}
    ${fieldRow("Condition", `Price ${isAbove ? "above" : "below"} ${targetPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`)}
    ${fieldRow("Triggered At", fmtDate())}
    ${divider()}
    ${ctaButton(`Trade ${esc(symbol)} Now →`, `${APP_URL}/trade`, color)}
  `;
  return layout({
    accentColor: color,
    accentBg: `${color}15`,
    accentBorder: `${color}30`,
    headerIcon: isAbove ? "📈" : "📉",
    badgeText: "Price Alert Triggered",
    title: `${esc(symbol)} Alert: Price ${isAbove ? "Above" : "Below"} Target`,
    body,
  });
}

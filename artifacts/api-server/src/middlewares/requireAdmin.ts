import { clerkClient, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

// Admins are identified by EITHER:
//  1. Clerk publicMetadata: { role: "admin" }  — what /admin/bootstrap and
//     /admin/users/:id/set-admin actually grant, and what the Clerk Dashboard
//     metadata flow sets, OR
//  2. An email in ADMIN_EMAILS (comma-separated env var).
// Previously this middleware only checked a hardcoded email address while the
// bootstrap endpoint granted role metadata — meaning self-service admin grants
// never worked and the real admin list was invisible in config.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    req.log.warn({ path: req.path }, "admin route: unauthenticated request");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const user = await clerkClient.users.getUser(userId);
    const hasAdminRole = user.publicMetadata?.role === "admin";
    const isAllowlistedEmail = user.emailAddresses.some((e) =>
      ADMIN_EMAILS.includes(e.emailAddress.toLowerCase())
    );
    if (!hasAdminRole && !isAllowlistedEmail) {
      req.log.warn({ userId, path: req.path }, "admin route: forbidden — insufficient role");
      res.status(403).json({ error: "Forbidden: admin access required" });
      return;
    }
    (req as Request & { userId: string }).userId = userId;
    next();
  } catch {
    req.log.warn({ userId, path: req.path }, "admin route: forbidden — clerk lookup failed");
    res.status(403).json({ error: "Forbidden" });
  }
}

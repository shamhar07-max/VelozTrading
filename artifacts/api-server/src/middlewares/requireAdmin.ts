import { clerkClient, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

const ADMIN_EMAIL = "shamhar07@gmail.com";

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
    const isAdmin =
      user.emailAddresses.some((e) => e.emailAddress === ADMIN_EMAIL);
    if (!isAdmin) {
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

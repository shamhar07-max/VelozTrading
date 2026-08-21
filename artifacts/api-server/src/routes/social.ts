import { Router, type IRouter, type Request } from "express";
import { eq, desc } from "drizzle-orm";
import { db, socialPostsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { tradingRateLimit } from "../middlewares/rateLimit";

const router: IRouter = Router();

router.get("/social/posts", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const posts = await db
    .select()
    .from(socialPostsTable)
    .where(eq(socialPostsTable.clerkUserId, userId))
    .orderBy(desc(socialPostsTable.createdAt))
    .limit(50);

  res.json(posts.map(p => ({
    id: p.id,
    clerkUserId: p.clerkUserId,
    content: p.content,
    symbol: p.symbol ?? null,
    createdAt: p.createdAt.toISOString(),
  })));
});

router.post("/social/posts", requireAuth, tradingRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const { content, symbol } = req.body as { content?: string; symbol?: string };

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "content is required" });
    return;
  }
  if (content.trim().length > 500) {
    res.status(400).json({ error: "content must be 500 characters or fewer" });
    return;
  }

  const [post] = await db
    .insert(socialPostsTable)
    .values({
      clerkUserId: userId,
      content: content.trim(),
      symbol: symbol && typeof symbol === "string" && symbol.trim() ? symbol.trim() : null,
    })
    .returning();

  res.status(201).json({
    id: post!.id,
    clerkUserId: post!.clerkUserId,
    content: post!.content,
    symbol: post!.symbol ?? null,
    createdAt: post!.createdAt.toISOString(),
  });
});

export default router;

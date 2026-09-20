import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findingState } from "./schema";

const HISTORY_LIMIT = 300;

// Live state for one project: every finding's state and the most recent events.
// Public by design — the dashboard is readable by anyone with the link.
export const board = query({
  args: { projectKey: v.string() },
  handler: async (ctx, { projectKey }) => {
    const findings = await ctx.db
      .query("findings")
      .withIndex("by_project", (q) => q.eq("projectKey", projectKey))
      .collect();
    const events = await ctx.db
      .query("events")
      .withIndex("by_project_at", (q) => q.eq("projectKey", projectKey))
      .order("desc")
      .take(HISTORY_LIMIT);
    return {
      findings: findings.map((f) => ({
        key: f.key,
        state: f.state,
        updatedBy: f.updatedBy ?? null,
        updatedAt: f.updatedAt ?? null,
      })),
      events: events.map((e) => ({ findingKey: e.findingKey, to: e.to, author: e.author, at: e.at })),
    };
  },
});

// Tick or untick a task. Open to anyone with the link (decision 2026-09-15), so
// the only guards are: the task must exist, and a name must be given.
export const setState = mutation({
  args: { projectKey: v.string(), key: v.string(), state: findingState, author: v.string() },
  handler: async (ctx, { projectKey, key, state, author }) => {
    const name = author.trim().replace(/\s+/g, " ");
    if (name.length < 1 || name.length > 40) {
      throw new ConvexError("Enter your name (1–40 characters) before ticking.");
    }
    const finding = await ctx.db
      .query("findings")
      .withIndex("by_project_key", (q) => q.eq("projectKey", projectKey).eq("key", key))
      .unique();
    if (!finding) throw new ConvexError("That task does not exist.");
    if (finding.state === state) return { changed: false };

    const at = Date.now();
    await ctx.db.patch(finding._id, { state, updatedBy: name, updatedAt: at });
    await ctx.db.insert("events", { projectKey, findingKey: key, to: state, author: name, at });
    return { changed: true };
  },
});

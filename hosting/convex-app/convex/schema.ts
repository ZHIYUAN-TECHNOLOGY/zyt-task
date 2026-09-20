import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Only live state lives here. Titles, details, repairs and the flow stay in
// tracker/seed/*.json and ship inside the static page. Table names follow the
// ZYT Delivery v0 plan so that app can take this data over.
export const findingState = v.union(v.literal("open"), v.literal("done"));

export default defineSchema({
  findings: defineTable({
    projectKey: v.string(),
    key: v.string(),
    workstreamKey: v.optional(v.string()),
    state: findingState,
    updatedBy: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectKey"])
    .index("by_project_key", ["projectKey", "key"]),

  // One row per tick or untick, never edited.
  events: defineTable({
    projectKey: v.string(),
    findingKey: v.string(),
    to: findingState,
    author: v.string(),
    at: v.number(),
  })
    .index("by_project_at", ["projectKey", "at"])
    .index("by_finding_at", ["projectKey", "findingKey", "at"]),
});

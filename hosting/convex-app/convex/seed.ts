import { internalMutation } from "./_generated/server";
import tasks from "../../../tracker/seed/tasks-nct.json";
import workstreams from "../../../tracker/seed/client-tasks-nct.json";
import runbook from "../../../tracker/seed/runbook-nct.json";

type SeedTask = { id: string; state: string };
type SeedWorkstream = { id: string; covers: string[] };
type SeedRunbook = { stages: { id: string; steps: { id: string }[] }[] };

// Creates a findings row for every NCT task and runbook step that doesn't have one yet.
// Existing rows are left alone, so re-running never undoes anyone's ticks.
//   npx convex run seed:nct          (dev)
//   npx convex run --prod seed:nct   (prod)
export const nct = internalMutation({
  args: {},
  handler: async (ctx) => {
    const projectKey = "nct";
    const workstreamOf = new Map<string, string>();
    for (const w of workstreams as SeedWorkstream[]) {
      for (const key of w.covers) workstreamOf.set(key, w.id);
    }

    // Runbook steps tick like tasks; their stage stands in for the workstream.
    const rows: SeedTask[] = [...(tasks as SeedTask[])];
    for (const stage of (runbook as SeedRunbook).stages) {
      for (const step of stage.steps) {
        rows.push({ id: step.id, state: "open" });
        workstreamOf.set(step.id, stage.id);
      }
    }

    let inserted = 0;
    for (const t of rows) {
      const existing = await ctx.db
        .query("findings")
        .withIndex("by_project_key", (q) => q.eq("projectKey", projectKey).eq("key", t.id))
        .unique();
      if (existing) continue;
      await ctx.db.insert("findings", {
        projectKey,
        key: t.id,
        workstreamKey: workstreamOf.get(t.id),
        state: t.state === "done" ? "done" : "open",
      });
      inserted++;
    }
    return { inserted, total: rows.length };
  },
});

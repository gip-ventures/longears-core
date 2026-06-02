import * as fs from "fs";
import type { TriggerEvent } from "./config/types";

/**
 * Runtime context describing how the action was invoked, derived from the
 * GitHub Actions environment. Kept separate from {@link resolveTriggerEvent}
 * so the resolution logic stays pure and testable.
 */
export interface TriggerContext {
  eventName?: string;
  ref?: string;
  defaultBranch?: string;
}

/**
 * Reads the trigger context from the GitHub Actions environment variables and
 * the event payload file. Returns best-effort values; missing pieces are left
 * undefined (e.g. when run locally outside Actions).
 */
export function readTriggerContext(): TriggerContext {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const ref = process.env.GITHUB_REF;

  let defaultBranch: string | undefined;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath) {
    try {
      const payload = JSON.parse(fs.readFileSync(eventPath, "utf8")) as {
        repository?: { default_branch?: string };
      };
      defaultBranch = payload.repository?.default_branch;
    } catch {
      // Ignore — defaultBranch stays undefined.
    }
  }

  return { eventName, ref, defaultBranch };
}

/**
 * Maps a GitHub event to one of Longears' trigger categories.
 * - schedule / workflow_dispatch  -> "schedule"
 * - pull_request(_target)         -> "pull_request"
 * - push to the default branch     -> "push_default" (other branches -> null)
 * - no event name (local run)      -> "schedule"
 * - anything else                  -> null (unsupported; the caller skips)
 */
export function resolveTriggerEvent(ctx: TriggerContext): TriggerEvent | null {
  const { eventName, ref, defaultBranch } = ctx;

  if (!eventName) return "schedule";

  switch (eventName) {
    case "schedule":
    case "workflow_dispatch":
      return "schedule";

    case "pull_request":
    case "pull_request_target":
      return "pull_request";

    case "push": {
      const branch = ref?.replace(/^refs\/heads\//, "");
      if (defaultBranch && branch === defaultBranch) return "push_default";
      return null;
    }

    default:
      return null;
  }
}

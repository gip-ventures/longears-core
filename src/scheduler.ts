import type {
  LongearsConfig,
  Schedule,
  UpdateConfig,
  DayOfWeek,
} from "./config/types";

const DAY_INDEX: Record<DayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/** Returns true if |now| falls within ±30 min of the configured schedule time. */
function isWithinTimeWindow(schedule: Schedule, now: Date): boolean {
  const [schedHour, schedMin] = (schedule.time ?? "00:00")
    .split(":")
    .map(Number);

  const schedTotalMin = schedHour * 60 + schedMin;
  const nowTotalMin = now.getUTCHours() * 60 + now.getUTCMinutes();

  const diff = Math.abs(nowTotalMin - schedTotalMin);
  // Handle midnight wrap-around (e.g., 23:50 vs 00:10)
  const wrappedDiff = Math.min(diff, 24 * 60 - diff);

  return wrappedDiff <= 30;
}

function isScheduleDue(schedule: Schedule, now: Date): boolean {
  switch (schedule.interval) {
    case "daily":
      return isWithinTimeWindow(schedule, now);

    case "weekly": {
      const configuredDay = schedule.day ?? "monday";
      const configuredDayIndex = DAY_INDEX[configuredDay];
      const todayIndex = now.getUTCDay();
      return todayIndex === configuredDayIndex && isWithinTimeWindow(schedule, now);
    }

    case "monthly": {
      const todayDayOfMonth = now.getUTCDate();
      return todayDayOfMonth === 1 && isWithinTimeWindow(schedule, now);
    }
  }
}

/**
 * Resolves the effective schedule for an UpdateConfig.
 * If the config belongs to a multi-ecosystem-group, that group's schedule is used.
 * Falls back to the config's own schedule, or a default daily schedule.
 */
export function resolveSchedule(
  config: UpdateConfig,
  longearsConfig: LongearsConfig
): Schedule {
  const groupKey = config["multi-ecosystem-group"];
  if (groupKey) {
    const group = longearsConfig["multi-ecosystem-groups"]?.[groupKey];
    if (group) {
      return group.schedule;
    }
  }

  return config.schedule ?? { interval: "daily", time: "00:00" };
}

/**
 * Returns true if the given UpdateConfig should be executed now.
 * When force=true, always returns true regardless of schedule.
 */
export function isUpdateDue(
  config: UpdateConfig,
  longearsConfig: LongearsConfig,
  now: Date,
  force: boolean
): boolean {
  if (force) return true;

  const schedule = resolveSchedule(config, longearsConfig);
  return isScheduleDue(schedule, now);
}

/**
 * Resolves the list of directories to scan for a given UpdateConfig.
 * Accepts both singular `directory` and plural `directories` keys.
 */
export function resolveDirectories(config: UpdateConfig): string[] {
  if (config.directories && config.directories.length > 0) {
    return config.directories;
  }
  return [config.directory ?? "/"];
}

import { resolveTriggerEvent } from "../trigger";

describe("resolveTriggerEvent", () => {
  it("maps scheduled and manual runs to schedule", () => {
    expect(resolveTriggerEvent({ eventName: "schedule" })).toBe("schedule");
    expect(resolveTriggerEvent({ eventName: "workflow_dispatch" })).toBe("schedule");
  });

  it("treats a local run (no event name) as schedule", () => {
    expect(resolveTriggerEvent({})).toBe("schedule");
  });

  it("maps pull_request events", () => {
    expect(resolveTriggerEvent({ eventName: "pull_request" })).toBe("pull_request");
    expect(resolveTriggerEvent({ eventName: "pull_request_target" })).toBe("pull_request");
  });

  it("maps a push to the default branch to push_default", () => {
    expect(
      resolveTriggerEvent({
        eventName: "push",
        ref: "refs/heads/main",
        defaultBranch: "main",
      })
    ).toBe("push_default");
  });

  it("ignores a push to a non-default branch", () => {
    expect(
      resolveTriggerEvent({
        eventName: "push",
        ref: "refs/heads/feature",
        defaultBranch: "main",
      })
    ).toBeNull();
  });

  it("returns null for unsupported events", () => {
    expect(resolveTriggerEvent({ eventName: "release" })).toBeNull();
  });
});

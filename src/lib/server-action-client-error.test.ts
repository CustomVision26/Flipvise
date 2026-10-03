import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isNextControlFlowError,
  isProductionOmittedServerError,
  isStaleServerActionError,
  STALE_SERVER_ACTION_MESSAGE,
  userFacingServerActionError,
} from "./server-action-client-error";

describe("userFacingServerActionError", () => {
  it("keeps a normal Error message", () => {
    assert.equal(
      userFacingServerActionError(new Error("Page not found (404)."), "fallback"),
      "Page not found (404).",
    );
  });

  it("replaces the production-omitted Server Components message", () => {
    const omitted =
      "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.";
    assert.equal(isProductionOmittedServerError(omitted), true);
    assert.equal(userFacingServerActionError(new Error(omitted), "Try again."), "Try again.");
  });

  it("detects Next.js control-flow errors", () => {
    assert.equal(isNextControlFlowError({ digest: "NEXT_REDIRECT" }), true);
    assert.equal(isNextControlFlowError(new Error("boom")), false);
  });

  it("replaces a missing Server Action id with a refresh prompt", () => {
    const missing =
      'Server Action "4003cf2de0eaaa80a67653529eeef5f210dbcb367a" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action';
    assert.equal(isStaleServerActionError(missing), true);
    assert.equal(
      userFacingServerActionError(new Error(missing), "Link failed."),
      STALE_SERVER_ACTION_MESSAGE,
    );
  });
});

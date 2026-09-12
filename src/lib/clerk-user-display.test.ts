import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatClerkPublicActorName,
  looksLikeClerkUserId,
} from "./clerk-user-display";

describe("looksLikeClerkUserId", () => {
  it("matches Clerk user ids only", () => {
    assert.equal(looksLikeClerkUserId("user_3CN0UZ4CeNvVG0Hh3VsyLO8tHf"), true);
    assert.equal(looksLikeClerkUserId("jason@example.com"), false);
    assert.equal(looksLikeClerkUserId("Jason Pottinger"), false);
  });
});

describe("formatClerkPublicActorName", () => {
  it("prefers full name, then username, then email", () => {
    assert.equal(
      formatClerkPublicActorName({
        fullName: "Jason Pottinger",
        username: "jason",
        primaryEmailAddress: { emailAddress: "jason@example.com" },
      }),
      "Jason Pottinger",
    );
    assert.equal(
      formatClerkPublicActorName({
        fullName: null,
        firstName: null,
        lastName: null,
        username: "jason",
        primaryEmailAddress: { emailAddress: "jason@example.com" },
      }),
      "jason",
    );
    assert.equal(
      formatClerkPublicActorName({
        fullName: null,
        firstName: null,
        lastName: null,
        username: null,
        primaryEmailAddress: { emailAddress: "jason@example.com" },
      }),
      "jason@example.com",
    );
  });

  it("never returns a Clerk user id", () => {
    assert.equal(
      formatClerkPublicActorName({
        fullName: "user_abc123",
        username: null,
        primaryEmailAddress: { emailAddress: "admin@flipvise.com" },
      }),
      "admin@flipvise.com",
    );
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLATFORM_COMPANY_ADDRESS,
  formatPlatformCompanyAddressInvoiceLines,
  formatPlatformCompanyAddressLines,
} from "./platform-company-address";

describe("formatPlatformCompanyAddressLines", () => {
  it("includes street, apartment, city, state, postal, and country", () => {
    assert.deepEqual(formatPlatformCompanyAddressLines(DEFAULT_PLATFORM_COMPANY_ADDRESS), [
      "Flipvise Studio LLC",
      "6450 Aragon Way",
      "apt 205",
      "Fort Myers, Florida 33966",
      "United States",
    ]);
  });
});

describe("formatPlatformCompanyAddressInvoiceLines", () => {
  it("uses the Contact Us address including apartment and phone", () => {
    assert.deepEqual(
      formatPlatformCompanyAddressInvoiceLines(
        DEFAULT_PLATFORM_COMPANY_ADDRESS,
        "+1 (555) 000-0000",
      ),
      [
        "Flipvise Studio LLC",
        "6450 Aragon Way",
        "apt 205",
        "Fort Myers, Florida 33966",
        "United States",
        "+1 (555) 000-0000",
      ],
    );
  });
});

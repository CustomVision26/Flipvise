import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLATFORM_COMPANY_ADDRESS,
  formatPlatformCompanyAddressInvoiceLines,
  formatPlatformCompanyAddressLines,
} from "./platform-company-address";

describe("formatPlatformCompanyAddressLines", () => {
  it("includes street, city, state, postal, and country without an apartment", () => {
    assert.deepEqual(formatPlatformCompanyAddressLines(DEFAULT_PLATFORM_COMPANY_ADDRESS), [
      "Flipvise Studio LLC",
      "6450 Aragon Way",
      "Fort Myers, Florida 33966",
      "United States",
    ]);
  });

  it("omits the retired apt 205 line even when it is still stored", () => {
    assert.deepEqual(
      formatPlatformCompanyAddressLines({
        ...DEFAULT_PLATFORM_COMPANY_ADDRESS,
        line2: "apt 205",
      }),
      [
        "Flipvise Studio LLC",
        "6450 Aragon Way",
        "Fort Myers, Florida 33966",
        "United States",
      ],
    );
  });
});

describe("formatPlatformCompanyAddressInvoiceLines", () => {
  it("uses the Contact Us street address and phone without an apartment", () => {
    assert.deepEqual(
      formatPlatformCompanyAddressInvoiceLines(
        DEFAULT_PLATFORM_COMPANY_ADDRESS,
        "+1 (555) 000-0000",
      ),
      [
        "Flipvise Studio LLC",
        "6450 Aragon Way",
        "Fort Myers, Florida 33966",
        "United States",
        "+1 (555) 000-0000",
      ],
    );
  });
});

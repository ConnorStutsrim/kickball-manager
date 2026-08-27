import { describe, expect, it } from "vitest";
import { describeGoogleSheetsError } from "../sheet-error";

describe("describeGoogleSheetsError", () => {
  it("gives an actionable message for an expired/revoked refresh token", () => {
    const err = {
      response: { data: { error: "invalid_grant", error_description: "Token has been expired or revoked." } },
    };
    expect(describeGoogleSheetsError(err)).toBe(
      "Your Google connection has expired — reconnect at /settings/google.",
    );
  });

  it("falls back to the error's own message for other API errors", () => {
    const err = new Error("Requested entity was not found.");
    expect(describeGoogleSheetsError(err)).toBe("Requested entity was not found.");
  });

  it("falls back to a generic message for a non-Error throw", () => {
    expect(describeGoogleSheetsError("some string")).toBe("Google Sheets error.");
    expect(describeGoogleSheetsError(null)).toBe("Google Sheets error.");
  });

  it("doesn't misfire on an unrelated response.data.error shape", () => {
    const err = { response: { data: { error: "something_else" } } };
    expect(describeGoogleSheetsError(err)).toBe("Google Sheets error.");
  });
});

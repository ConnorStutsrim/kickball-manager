import { describe, expect, it, vi } from "vitest";
import { GoogleSheetsUserError, describeGoogleSheetsError } from "../sheet-error";

describe("describeGoogleSheetsError", () => {
  it("gives an actionable message for an expired/revoked refresh token", () => {
    const err = {
      response: { data: { error: "invalid_grant", error_description: "Token has been expired or revoked." } },
    };
    expect(describeGoogleSheetsError(err)).toBe(
      "Your Google connection has expired — reconnect at /settings/google.",
    );
  });

  it("surfaces a GoogleSheetsUserError's own message — it's written by this app, safe to show", () => {
    const err = new GoogleSheetsUserError("Google account not connected. Connect it at /settings/google.");
    expect(describeGoogleSheetsError(err)).toBe(
      "Google account not connected. Connect it at /settings/google.",
    );
  });

  it("never surfaces a plain Error's message verbatim — it could be a raw DB/API error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("relation \"games\" does not exist");
    expect(describeGoogleSheetsError(err)).toBe(
      "Something went wrong generating the sheet. Check the server logs if this keeps happening.",
    );
    expect(spy).toHaveBeenCalledWith("Unexpected error generating Google Sheet:", err);
    spy.mockRestore();
  });

  it("falls back to the generic message for an empty GoogleSheetsUserError message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(describeGoogleSheetsError(new GoogleSheetsUserError(""))).toBe(
      "Something went wrong generating the sheet. Check the server logs if this keeps happening.",
    );
    spy.mockRestore();
  });

  it("falls back to the generic message for a non-Error throw", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(describeGoogleSheetsError("some string")).toBe(
      "Something went wrong generating the sheet. Check the server logs if this keeps happening.",
    );
    expect(describeGoogleSheetsError(null)).toBe(
      "Something went wrong generating the sheet. Check the server logs if this keeps happening.",
    );
    spy.mockRestore();
  });

  it("doesn't misfire on an unrelated response.data.error shape", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = { response: { data: { error: "something_else" } } };
    expect(describeGoogleSheetsError(err)).toBe(
      "Something went wrong generating the sheet. Check the server logs if this keeps happening.",
    );
    spy.mockRestore();
  });
});

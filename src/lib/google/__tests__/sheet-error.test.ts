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
    expect(spy).toHaveBeenCalledWith("Unexpected error generating Google Sheet:", expect.any(String));
    spy.mockRestore();
  });

  it("never logs the raw error object — a real Gaxios error's nested request config can carry the refresh token itself", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Shaped like the real error this file was written to handle: a plain
    // `message` alongside a nested config carrying sensitive request data,
    // exactly what a raw Gaxios error looks like.
    const err = Object.assign(new Error("invalid_grant"), {
      config: { data: { refresh_token: "SECRET_TOKEN_VALUE" } },
    });
    describeGoogleSheetsError(err);
    const loggedArgs = spy.mock.calls[0];
    expect(loggedArgs.some((arg) => JSON.stringify(arg).includes("SECRET_TOKEN_VALUE"))).toBe(false);
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

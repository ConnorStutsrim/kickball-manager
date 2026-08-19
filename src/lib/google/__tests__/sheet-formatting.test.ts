import { describe, expect, it } from "vitest";
import { buildFormatRequests } from "../sheet-formatting";
import { buildGameSheetGrid, type GameSheetInput } from "../sheet-layout";
import { BENCH } from "@/lib/lineup/fielding-solver";

function baseInput(): GameSheetInput {
  return {
    gameHeader: "2026-08-20 vs Riverside",
    positions: ["P", "C"],
    innings: 2,
    fielding: [
      { inning: 1, position: "P", playerName: "Alice" },
      { inning: 1, position: "C", playerName: "Bob" },
      { inning: 1, position: BENCH, playerName: "Carol" },
      { inning: 2, position: "P", playerName: "Bob" },
      { inning: 2, position: "C", playerName: "Alice" },
      { inning: 2, position: BENCH, playerName: "Carol" },
    ],
    battingOrder: [
      { battingPosition: 1, playerName: "Alice", gender: "F", inningsFielded: 2 },
      { battingPosition: 2, playerName: "Bob", gender: "M", inningsFielded: 2 },
      { battingPosition: 3, playerName: "Carol", gender: "F", inningsFielded: 0 },
    ],
  };
}

const SHEET_ID = 12345;

function repeatCellRequests(requests: ReturnType<typeof buildFormatRequests>) {
  return requests.filter((r) => "repeatCell" in r).map((r) => r.repeatCell!);
}

describe("buildFormatRequests", () => {
  it("threads the given sheetId through every range", () => {
    const { sections } = buildGameSheetGrid(baseInput());
    const requests = buildFormatRequests(SHEET_ID, sections);
    for (const request of requests) {
      const id =
        request.repeatCell?.range?.sheetId ??
        request.updateSheetProperties?.properties?.sheetId ??
        request.updateDimensionProperties?.range?.sheetId;
      expect(id).toBe(SHEET_ID);
    }
  });

  it("gives the fielding position rows a teal fill", () => {
    const { sections } = buildGameSheetGrid(baseInput());
    const cells = repeatCellRequests(buildFormatRequests(SHEET_ID, sections));
    const [start, end] = sections.fieldingPositionRows;
    const match = cells.find(
      (c) => c.range?.startRowIndex === start && c.range?.endRowIndex === end + 1,
    );
    expect(match?.cell?.userEnteredFormat?.backgroundColor).toEqual({
      red: 0.631,
      green: 0.749,
      blue: 0.804,
    });
    expect(match?.cell?.userEnteredFormat?.textFormat?.bold).toBe(true);
  });

  it("gives bench rows and batting-order data rows a pink fill", () => {
    const { sections } = buildGameSheetGrid(baseInput());
    const cells = repeatCellRequests(buildFormatRequests(SHEET_ID, sections));
    const pink = { red: 1, green: 0.8, blue: 1 };

    const [benchStart, benchEnd] = sections.benchRows!;
    const benchMatch = cells.find(
      (c) => c.range?.startRowIndex === benchStart && c.range?.endRowIndex === benchEnd + 1,
    );
    expect(benchMatch?.cell?.userEnteredFormat?.backgroundColor).toEqual(pink);

    const [battingStart, battingEnd] = sections.battingDataRows;
    const battingMatch = cells.find(
      (c) => c.range?.startRowIndex === battingStart && c.range?.endRowIndex === battingEnd + 1,
    );
    expect(battingMatch?.cell?.userEnteredFormat?.backgroundColor).toEqual(pink);
  });

  it("skips a bench-fill request when there is no bench that game", () => {
    const noBenchInput: GameSheetInput = {
      ...baseInput(),
      fielding: baseInput().fielding.filter((f) => f.position !== BENCH),
    };
    const { sections } = buildGameSheetGrid(noBenchInput);
    expect(sections.benchRows).toBeNull();
    const cells = repeatCellRequests(buildFormatRequests(SHEET_ID, sections));
    const pink = { red: 1, green: 0.8, blue: 1 };
    const pinkFills = cells.filter(
      (c) => JSON.stringify(c.cell?.userEnteredFormat?.backgroundColor) === JSON.stringify(pink),
    );
    // Only the batting-order rows should be pink, not a bench section.
    expect(pinkFills).toHaveLength(1);
  });

  it("gives header rows bold text and a border but no fill", () => {
    const { sections } = buildGameSheetGrid(baseInput());
    const cells = repeatCellRequests(buildFormatRequests(SHEET_ID, sections));
    const headerMatch = cells.find(
      (c) =>
        c.range?.startRowIndex === sections.fieldingHeaderRow &&
        c.range?.endRowIndex === sections.fieldingHeaderRow + 1,
    );
    expect(headerMatch?.cell?.userEnteredFormat?.backgroundColor).toBeUndefined();
    expect(headerMatch?.cell?.userEnteredFormat?.textFormat?.bold).toBe(true);
    expect(headerMatch?.cell?.userEnteredFormat?.borders).toBeDefined();
  });

  it("leaves scoring data rows border-only, no fill or bold", () => {
    const { sections } = buildGameSheetGrid(baseInput());
    const cells = repeatCellRequests(buildFormatRequests(SHEET_ID, sections));
    const [start, end] = sections.scoringDataRows;
    const match = cells.find(
      (c) => c.range?.startRowIndex === start && c.range?.endRowIndex === end + 1,
    );
    expect(match?.cell?.userEnteredFormat?.backgroundColor).toBeUndefined();
    expect(match?.cell?.userEnteredFormat?.textFormat?.bold).toBeUndefined();
    expect(match?.cell?.userEnteredFormat?.borders).toBeDefined();
  });

  it("freezes the header row and label column", () => {
    const { sections } = buildGameSheetGrid(baseInput());
    const requests = buildFormatRequests(SHEET_ID, sections);
    const freeze = requests.find((r) => "updateSheetProperties" in r);
    expect(freeze?.updateSheetProperties?.properties?.gridProperties?.frozenRowCount).toBe(
      sections.fieldingHeaderRow + 1,
    );
    expect(freeze?.updateSheetProperties?.properties?.gridProperties?.frozenColumnCount).toBe(1);
  });

  it("widens the label column", () => {
    const { sections } = buildGameSheetGrid(baseInput());
    const requests = buildFormatRequests(SHEET_ID, sections);
    const widen = requests.find((r) => "updateDimensionProperties" in r);
    expect(widen?.updateDimensionProperties?.range).toEqual({
      sheetId: SHEET_ID,
      dimension: "COLUMNS",
      startIndex: 0,
      endIndex: 1,
    });
    expect(widen?.updateDimensionProperties?.properties?.pixelSize).toBeGreaterThan(0);
  });
});

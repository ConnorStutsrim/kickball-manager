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

function fullPositionsInput(): GameSheetInput {
  return {
    gameHeader: "2026-08-20 vs Riverside",
    positions: ["P", "C", "1st", "2nd", "3rd", "Float", "Outfield 1"],
    innings: 1,
    fielding: [],
    battingOrder: [],
  };
}

const SHEET_ID = 12345;
const WHITE = { red: 1, green: 1, blue: 1 };
const GREY = { red: 0.851, green: 0.851, blue: 0.851 };

function repeatCellRequests(requests: ReturnType<typeof buildFormatRequests>) {
  return requests.filter((r) => "repeatCell" in r).map((r) => r.repeatCell!);
}

function formatAtRow(cells: ReturnType<typeof repeatCellRequests>, rowIndex: number) {
  const match = cells.find((c) => {
    const start = c.range?.startRowIndex;
    const end = c.range?.endRowIndex;
    return start != null && end != null && start <= rowIndex && rowIndex < end;
  });
  return match?.cell?.userEnteredFormat;
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

  it("greys the infield fielding positions (1st/2nd/3rd/Float) and leaves the rest white", () => {
    const { sections } = buildGameSheetGrid(fullPositionsInput());
    const cells = repeatCellRequests(buildFormatRequests(SHEET_ID, sections));

    for (const name of ["P", "C", "Outfield 1"]) {
      const row = sections.fieldingPositionRowByName[name];
      expect(formatAtRow(cells, row)?.backgroundColor).toEqual(WHITE);
    }
    for (const name of ["1st", "2nd", "3rd", "Float"]) {
      const row = sections.fieldingPositionRowByName[name];
      expect(formatAtRow(cells, row)?.backgroundColor).toEqual(GREY);
    }
  });

  it("gives bench rows a grey fill", () => {
    const { sections } = buildGameSheetGrid(baseInput());
    const cells = repeatCellRequests(buildFormatRequests(SHEET_ID, sections));
    const [benchStart, benchEnd] = sections.benchRows!;
    const benchMatch = cells.find(
      (c) => c.range?.startRowIndex === benchStart && c.range?.endRowIndex === benchEnd + 1,
    );
    expect(benchMatch?.cell?.userEnteredFormat?.backgroundColor).toEqual(GREY);
  });

  it("greys female batting-order rows and leaves male rows white", () => {
    const { sections } = buildGameSheetGrid(baseInput());
    const cells = repeatCellRequests(buildFormatRequests(SHEET_ID, sections));
    for (const [rowIndex, gender] of Object.entries(sections.battingRowGenders)) {
      const format = formatAtRow(cells, Number(rowIndex));
      if (gender === "F") {
        expect(format?.backgroundColor).toEqual(GREY);
      } else {
        expect(format?.backgroundColor).toBeUndefined();
      }
      expect(format?.textFormat?.bold).toBe(true);
    }
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

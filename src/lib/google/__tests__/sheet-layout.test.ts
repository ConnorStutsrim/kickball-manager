import { describe, expect, it } from "vitest";
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

describe("buildGameSheetGrid", () => {
  it("starts with the game header", () => {
    const { grid } = buildGameSheetGrid(baseInput());
    expect(grid[0]).toEqual(["2026-08-20 vs Riverside"]);
  });

  it("places each position's per-inning assignment in the right row/column", () => {
    const { grid } = buildGameSheetGrid(baseInput());
    expect(grid[3]).toEqual(["P", "Alice", "Bob", ""]);
    expect(grid[4]).toEqual(["C", "Bob", "Alice", ""]);
  });

  it("appends one spare tie-breaker inning column beyond the planned innings", () => {
    const { grid, sections } = buildGameSheetGrid(baseInput());
    expect(grid[sections.fieldingHeaderRow]).toEqual([
      "Position",
      "Inning 1",
      "Inning 2",
      "Inning 3",
    ]);
  });

  it("lists bench players in a Bench row per inning", () => {
    const { grid } = buildGameSheetGrid(baseInput());
    expect(grid[5]).toEqual(["Bench", "Carol", "Carol", ""]);
  });

  it("adds one bench row per bench slot when more than one player sits", () => {
    const input = baseInput();
    input.fielding.push(
      { inning: 1, position: BENCH, playerName: "Dana" },
      { inning: 2, position: BENCH, playerName: "Dana" },
    );
    const { grid } = buildGameSheetGrid(input);
    expect(grid[5]).toEqual(["Bench", "Carol", "Carol", ""]);
    expect(grid[6]).toEqual(["Bench", "Dana", "Dana", ""]);
  });

  it("includes the batting order with correct name/gender/order/innings", () => {
    const { grid } = buildGameSheetGrid(baseInput());
    const headerIndex = grid.findIndex((row) => row[0] === "Batting Order");
    expect(grid[headerIndex + 1]).toEqual(["Order", "Name", "Gender", "Innings Fielded", "Ups"]);
    expect(grid[headerIndex + 2]).toEqual([1, "Alice", "F", 2, ""]);
    expect(grid[headerIndex + 3]).toEqual([2, "Bob", "M", 2, ""]);
    expect(grid[headerIndex + 4]).toEqual([3, "Carol", "F", 0, ""]);
  });

  it("leaves the scoring section blank with away on top, home below", () => {
    const { grid } = baseInputGrid();
    const awayOuts = grid.find((row) => row[0] === "Away — Outs")!;
    const awayScore = grid.find((row) => row[0] === "Away — Score")!;
    const homeScore = grid.find((row) => row[0] === "Home — Score")!;
    const homeOuts = grid.find((row) => row[0] === "Home — Outs")!;

    expect(awayOuts.slice(1, -1).every((c) => c === "")).toBe(true);
    expect(homeOuts.slice(1, -1).every((c) => c === "")).toBe(true);
    expect(awayScore.slice(1, -2).every((c) => c === "")).toBe(true);
    expect(homeScore.slice(1, -2).every((c) => c === "")).toBe(true);

    // Away appears before home.
    expect(grid.indexOf(awayOuts)).toBeLessThan(grid.indexOf(homeScore));
  });

  it("gives each side's score row a SUM formula over its inning cells", () => {
    const { grid } = baseInputGrid();
    const awayScore = grid.find((row) => row[0] === "Away — Score")!;
    const homeScore = grid.find((row) => row[0] === "Home — Score")!;
    expect(String(awayScore.at(-1))).toMatch(/^=SUM\(B\d+:D\d+\)$/);
    expect(String(homeScore.at(-1))).toMatch(/^=SUM\(B\d+:D\d+\)$/);
  });

  describe("sections", () => {
    it("bounds the fielding header and position rows correctly", () => {
      const { grid, sections } = baseInputGrid();
      expect(grid[sections.fieldingHeaderRow]).toEqual([
        "Position",
        "Inning 1",
        "Inning 2",
        "Inning 3",
      ]);
      const [start, end] = sections.fieldingPositionRows;
      expect(grid[start]).toEqual(["P", "Alice", "Bob", ""]);
      expect(grid[end]).toEqual(["C", "Bob", "Alice", ""]);
      expect(sections.fieldingColumnCount).toBe(4); // label + 2 innings + 1 tie-breaker
    });

    it("bounds bench rows correctly, and reports null when there's no bench", () => {
      const { sections } = baseInputGrid();
      expect(sections.benchRows).toEqual([5, 5]);

      const noBenchInput: GameSheetInput = {
        ...baseInput(),
        fielding: baseInput().fielding.filter((f) => f.position !== BENCH),
      };
      const { sections: noBenchSections } = buildGameSheetGrid(noBenchInput);
      expect(noBenchSections.benchRows).toBeNull();
    });

    it("bounds the batting order title/header/data rows correctly", () => {
      const { grid, sections } = baseInputGrid();
      expect(grid[sections.battingTitleRow]).toEqual(["Batting Order"]);
      expect(grid[sections.battingHeaderRow]).toEqual([
        "Order",
        "Name",
        "Gender",
        "Innings Fielded",
        "Ups",
      ]);
      const [start, end] = sections.battingDataRows;
      expect(end - start + 1).toBe(3); // 3 players
      expect(grid[start][1]).toBe("Alice");
      expect(sections.battingColumnCount).toBe(5);
    });

    it("bounds the scoring title/header/data rows correctly", () => {
      const { grid, sections } = baseInputGrid();
      expect(grid[sections.scoringTitleRow]).toEqual(["Scoring (fill in by hand)"]);
      expect(grid[sections.scoringHeaderRow][0]).toBe("");
      const [start, end] = sections.scoringDataRows;
      expect(grid[start][0]).toBe("Away — Outs");
      expect(grid[end][0]).toBe("Home — Outs");
      expect(sections.scoringColumnCount).toBe(5); // label + 2 innings + 1 tie-breaker + total
    });
  });

  function baseInputGrid() {
    return buildGameSheetGrid(baseInput());
  }
});

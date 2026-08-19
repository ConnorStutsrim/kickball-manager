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
    const grid = buildGameSheetGrid(baseInput());
    expect(grid[0]).toEqual(["2026-08-20 vs Riverside"]);
  });

  it("places each position's per-inning assignment in the right row/column", () => {
    const grid = buildGameSheetGrid(baseInput());
    expect(grid[3]).toEqual(["P", "Alice", "Bob"]);
    expect(grid[4]).toEqual(["C", "Bob", "Alice"]);
  });

  it("lists bench players in a Bench row per inning", () => {
    const grid = buildGameSheetGrid(baseInput());
    expect(grid[5]).toEqual(["Bench", "Carol", "Carol"]);
  });

  it("adds one bench row per bench slot when more than one player sits", () => {
    const input = baseInput();
    input.fielding.push(
      { inning: 1, position: BENCH, playerName: "Dana" },
      { inning: 2, position: BENCH, playerName: "Dana" },
    );
    const grid = buildGameSheetGrid(input);
    expect(grid[5]).toEqual(["Bench", "Carol", "Carol"]);
    expect(grid[6]).toEqual(["Bench", "Dana", "Dana"]);
  });

  it("includes the batting order with correct name/gender/order/innings", () => {
    const grid = buildGameSheetGrid(baseInput());
    const headerIndex = grid.findIndex((row) => row[0] === "Batting Order");
    expect(grid[headerIndex + 1]).toEqual(["Order", "Name", "Gender", "Innings Fielded", "Ups"]);
    expect(grid[headerIndex + 2]).toEqual([1, "Alice", "F", 2, ""]);
    expect(grid[headerIndex + 3]).toEqual([2, "Bob", "M", 2, ""]);
    expect(grid[headerIndex + 4]).toEqual([3, "Carol", "F", 0, ""]);
  });

  it("leaves the scoring section blank with away on top, home below", () => {
    const grid = baseInputGrid();
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
    const grid = baseInputGrid();
    const awayScore = grid.find((row) => row[0] === "Away — Score")!;
    const homeScore = grid.find((row) => row[0] === "Home — Score")!;
    expect(String(awayScore.at(-1))).toMatch(/^=SUM\(B\d+:C\d+\)$/);
    expect(String(homeScore.at(-1))).toMatch(/^=SUM\(B\d+:C\d+\)$/);
  });

  function baseInputGrid() {
    return buildGameSheetGrid(baseInput());
  }
});

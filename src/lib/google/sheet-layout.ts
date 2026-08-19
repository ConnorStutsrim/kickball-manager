import { BENCH } from "@/lib/lineup/fielding-solver";

export type SheetCell = string | number;
export type SheetGrid = SheetCell[][];

export interface SheetFieldingEntry {
  inning: number;
  position: string;
  playerName: string;
}

export interface SheetBattingOrderEntry {
  battingPosition: number;
  playerName: string;
  gender: string;
  inningsFielded: number;
}

export interface GameSheetInput {
  gameHeader: string;
  positions: string[];
  innings: number;
  fielding: SheetFieldingEntry[];
  battingOrder: SheetBattingOrderEntry[];
}

const BLANK = "";

function colLetter(index0: number): string {
  // 0 -> A, 1 -> B, ...
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Builds the full contents of a per-game spreadsheet as a single 2D grid,
 * starting at A1, ready to write via `spreadsheets.values.update` with
 * valueInputOption "USER_ENTERED" (so the SUM formula strings are
 * interpreted as formulas, not literal text).
 *
 * Layout, roughly matching the team's existing manual spreadsheet:
 *   - header row
 *   - fielding grid: one row per position, one column per inning, plus
 *     bench rows below (bench size is constant across innings for a
 *     given lineup, since roster/field size don't change mid-game)
 *   - batting order table: order, name, gender, innings fielded, and a
 *     blank "Ups" column left for a manual in-game tally
 *   - scoring section: away (outs, score) on top, home (score, outs)
 *     below, per the team's convention — left blank for manual live use,
 *     with a running-total formula per side
 */
export function buildGameSheetGrid(input: GameSheetInput): SheetGrid {
  const { gameHeader, positions, innings, fielding, battingOrder } = input;
  const grid: SheetGrid = [];

  grid.push([gameHeader]);
  grid.push([]);

  // Fielding grid
  const fieldingHeaderRow = ["Position"];
  for (let inning = 1; inning <= innings; inning++) fieldingHeaderRow.push(`Inning ${inning}`);
  grid.push(fieldingHeaderRow);

  const fieldingByPositionAndInning = new Map<string, string>();
  for (const entry of fielding) {
    fieldingByPositionAndInning.set(`${entry.position}:${entry.inning}`, entry.playerName);
  }

  for (const position of positions) {
    const row: SheetCell[] = [position];
    for (let inning = 1; inning <= innings; inning++) {
      row.push(fieldingByPositionAndInning.get(`${position}:${inning}`) ?? BLANK);
    }
    grid.push(row);
  }

  const benchCountInInning1 = fielding.filter(
    (f) => f.position === BENCH && f.inning === 1,
  ).length;
  const benchByInning = new Map<number, string[]>();
  for (const entry of fielding) {
    if (entry.position !== BENCH) continue;
    if (!benchByInning.has(entry.inning)) benchByInning.set(entry.inning, []);
    benchByInning.get(entry.inning)!.push(entry.playerName);
  }
  for (let benchSlot = 0; benchSlot < benchCountInInning1; benchSlot++) {
    const row: SheetCell[] = ["Bench"];
    for (let inning = 1; inning <= innings; inning++) {
      row.push(benchByInning.get(inning)?.[benchSlot] ?? BLANK);
    }
    grid.push(row);
  }

  grid.push([]);

  // Batting order
  grid.push(["Batting Order"]);
  grid.push(["Order", "Name", "Gender", "Innings Fielded", "Ups"]);
  for (const entry of battingOrder) {
    grid.push([entry.battingPosition, entry.playerName, entry.gender, entry.inningsFielded, BLANK]);
  }

  grid.push([]);

  // Scoring section (blank, filled in by hand during the game)
  grid.push(["Scoring (fill in by hand)"]);
  const scoringHeaderRow = [""];
  for (let inning = 1; inning <= innings; inning++) scoringHeaderRow.push(String(inning));
  scoringHeaderRow.push("Total");
  grid.push(scoringHeaderRow);

  const firstInningCol = colLetter(1);
  const lastInningCol = colLetter(innings);

  const awayOutsRow: SheetCell[] = ["Away — Outs"];
  for (let i = 0; i < innings; i++) awayOutsRow.push(BLANK);
  awayOutsRow.push(BLANK);
  grid.push(awayOutsRow);

  const awayScoreRowIndex = grid.length;
  const awayScoreRow: SheetCell[] = ["Away — Score"];
  for (let i = 0; i < innings; i++) awayScoreRow.push(BLANK);
  awayScoreRow.push(`=SUM(${firstInningCol}${awayScoreRowIndex + 1}:${lastInningCol}${awayScoreRowIndex + 1})`);
  grid.push(awayScoreRow);

  grid.push([]);

  const homeScoreRowIndex = grid.length + 1;
  const homeScoreRow: SheetCell[] = ["Home — Score"];
  for (let i = 0; i < innings; i++) homeScoreRow.push(BLANK);
  homeScoreRow.push(`=SUM(${firstInningCol}${homeScoreRowIndex}:${lastInningCol}${homeScoreRowIndex})`);
  grid.push(homeScoreRow);

  const homeOutsRow: SheetCell[] = ["Home — Outs"];
  for (let i = 0; i < innings; i++) homeOutsRow.push(BLANK);
  homeOutsRow.push(BLANK);
  grid.push(homeOutsRow);

  return grid;
}

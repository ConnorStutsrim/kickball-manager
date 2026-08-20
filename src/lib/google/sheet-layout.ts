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

/** 0-indexed row/column boundaries of each section, for building matching
 * visual-formatting requests without re-deriving the row math a second time. */
export interface GameSheetSections {
  fieldingHeaderRow: number;
  fieldingPositionRows: [start: number, end: number];
  fieldingPositionRowByName: Record<string, number>; // position name -> absolute row index
  fieldingColumnCount: number; // label column + one per inning (incl. the spare tie-breaker inning)
  benchRows: [start: number, end: number] | null;
  battingTitleRow: number;
  battingHeaderRow: number;
  battingDataRows: [start: number, end: number];
  battingRowGenders: Record<number, string>; // absolute row index -> that row's player's gender
  battingColumnCount: number;
  scoringTitleRow: number;
  scoringHeaderRow: number;
  scoringDataRows: [start: number, end: number];
  scoringColumnCount: number; // label column + one per inning (incl. tie-breaker) + total
}

export interface GameSheetBuild {
  grid: SheetGrid;
  sections: GameSheetSections;
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
 * interpreted as formulas, not literal text) — plus the row/column
 * boundaries of each section, so matching visual formatting can be applied
 * without re-deriving this layout math a second time (see
 * sheet-formatting.ts).
 *
 * Layout, roughly matching the team's existing manual spreadsheet:
 *   - header row
 *   - fielding grid: one row per position, one column per inning (plus one
 *     spare tie-breaker inning beyond `innings`, for the extra inning
 *     played when the score is still tied after the last regular inning —
 *     left blank since the lineup engine only plans the regular innings),
 *     plus bench rows below (bench size is constant across innings for a
 *     given lineup, since roster/field size don't change mid-game)
 *   - batting order table: order, name, gender, innings fielded, and a
 *     blank "Ups" column left for a manual in-game tally
 *   - scoring section: away (outs, score) on top, home (score, outs)
 *     below, per the team's convention — left blank for manual live use,
 *     with a running-total formula per side, spanning the tie-breaker
 *     column too
 */
export function buildGameSheetGrid(input: GameSheetInput): GameSheetBuild {
  const { gameHeader, positions, innings, fielding, battingOrder } = input;
  const sheetInnings = innings + 1; // regular innings + one spare tie-breaker column
  const grid: SheetGrid = [];

  grid.push([gameHeader]);
  grid.push([]);

  // Fielding grid
  const fieldingHeaderRow = grid.length;
  const fieldingHeaderRowValues = ["Position"];
  for (let inning = 1; inning <= sheetInnings; inning++)
    fieldingHeaderRowValues.push(`Inning ${inning}`);
  grid.push(fieldingHeaderRowValues);

  const fieldingByPositionAndInning = new Map<string, string>();
  for (const entry of fielding) {
    fieldingByPositionAndInning.set(`${entry.position}:${entry.inning}`, entry.playerName);
  }

  const fieldingPositionStart = grid.length;
  const fieldingPositionRowByName: Record<string, number> = {};
  for (const position of positions) {
    fieldingPositionRowByName[position] = grid.length;
    const row: SheetCell[] = [position];
    for (let inning = 1; inning <= sheetInnings; inning++) {
      row.push(fieldingByPositionAndInning.get(`${position}:${inning}`) ?? BLANK);
    }
    grid.push(row);
  }
  const fieldingPositionEnd = grid.length - 1;

  const benchCountInInning1 = fielding.filter(
    (f) => f.position === BENCH && f.inning === 1,
  ).length;
  const benchByInning = new Map<number, string[]>();
  for (const entry of fielding) {
    if (entry.position !== BENCH) continue;
    if (!benchByInning.has(entry.inning)) benchByInning.set(entry.inning, []);
    benchByInning.get(entry.inning)!.push(entry.playerName);
  }
  const benchStart = grid.length;
  for (let benchSlot = 0; benchSlot < benchCountInInning1; benchSlot++) {
    const row: SheetCell[] = ["Bench"];
    for (let inning = 1; inning <= sheetInnings; inning++) {
      row.push(benchByInning.get(inning)?.[benchSlot] ?? BLANK);
    }
    grid.push(row);
  }
  const benchRows: [number, number] | null =
    benchCountInInning1 > 0 ? [benchStart, grid.length - 1] : null;

  grid.push([]);

  // Batting order
  const battingTitleRow = grid.length;
  grid.push(["Batting Order"]);
  const battingHeaderRow = grid.length;
  grid.push(["Order", "Name", "Gender", "Innings Fielded", "Ups"]);
  const battingDataStart = grid.length;
  const battingRowGenders: Record<number, string> = {};
  for (const entry of battingOrder) {
    battingRowGenders[grid.length] = entry.gender;
    grid.push([entry.battingPosition, entry.playerName, entry.gender, entry.inningsFielded, BLANK]);
  }
  const battingDataEnd = grid.length - 1;

  grid.push([]);

  // Scoring section (blank, filled in by hand during the game)
  const scoringTitleRow = grid.length;
  grid.push(["Scoring (fill in by hand)"]);
  const scoringHeaderRow = grid.length;
  const scoringHeaderRowValues = [""];
  for (let inning = 1; inning <= sheetInnings; inning++)
    scoringHeaderRowValues.push(String(inning));
  scoringHeaderRowValues.push("Total");
  grid.push(scoringHeaderRowValues);

  const firstInningCol = colLetter(1);
  const lastInningCol = colLetter(sheetInnings);

  const scoringDataStart = grid.length;
  const awayOutsRow: SheetCell[] = ["Away — Outs"];
  for (let i = 0; i < sheetInnings; i++) awayOutsRow.push(BLANK);
  awayOutsRow.push(BLANK);
  grid.push(awayOutsRow);

  const awayScoreRowIndex = grid.length;
  const awayScoreRow: SheetCell[] = ["Away — Score"];
  for (let i = 0; i < sheetInnings; i++) awayScoreRow.push(BLANK);
  awayScoreRow.push(`=SUM(${firstInningCol}${awayScoreRowIndex + 1}:${lastInningCol}${awayScoreRowIndex + 1})`);
  grid.push(awayScoreRow);

  grid.push([]);

  const homeScoreRowIndex = grid.length + 1;
  const homeScoreRow: SheetCell[] = ["Home — Score"];
  for (let i = 0; i < sheetInnings; i++) homeScoreRow.push(BLANK);
  homeScoreRow.push(`=SUM(${firstInningCol}${homeScoreRowIndex}:${lastInningCol}${homeScoreRowIndex})`);
  grid.push(homeScoreRow);

  const homeOutsRow: SheetCell[] = ["Home — Outs"];
  for (let i = 0; i < sheetInnings; i++) homeOutsRow.push(BLANK);
  homeOutsRow.push(BLANK);
  grid.push(homeOutsRow);
  const scoringDataEnd = grid.length - 1;

  return {
    grid,
    sections: {
      fieldingHeaderRow,
      fieldingPositionRows: [fieldingPositionStart, fieldingPositionEnd],
      fieldingPositionRowByName,
      fieldingColumnCount: sheetInnings + 1,
      benchRows,
      battingTitleRow,
      battingHeaderRow,
      battingDataRows: [battingDataStart, battingDataEnd],
      battingRowGenders,
      battingColumnCount: 5,
      scoringTitleRow,
      scoringHeaderRow,
      scoringDataRows: [scoringDataStart, scoringDataEnd],
      scoringColumnCount: sheetInnings + 2,
    },
  };
}

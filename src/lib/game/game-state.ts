import type { BaserunningEventType, PlateAppearanceResult } from "@/db/schema";

const OUT_RESULTS = new Set<PlateAppearanceResult>(["out", "fielders_choice", "sac"]);
const OUTS_PER_HALF = 3;

export interface GameStateBattingOrderEntry {
  playerId: string;
  battingPosition: number;
}

export interface GameStatePlateAppearance {
  inning: number;
  playerId: string;
  result: PlateAppearanceResult;
  runsScored: boolean;
}

export interface GameStateBaserunningEvent {
  inning: number;
  eventType: BaserunningEventType;
}

export interface GameStateOpponentInningRuns {
  inning: number;
  runs: number;
}

export interface GameStateInput {
  battingOrder: GameStateBattingOrderEntry[];
  plateAppearances: GameStatePlateAppearance[];
  baserunningEvents: GameStateBaserunningEvent[];
  opponentInningRuns: GameStateOpponentInningRuns[];
  inningsPlanned: number;
}

export type GameHalf = "us" | "them" | "game_over";

export interface GameStateResult {
  currentInning: number;
  half: GameHalf;
  outsThisHalf: number;
  nextBatter: GameStateBattingOrderEntry | null;
  ourRunsByInning: Record<number, number>;
  theirRunsByInning: Record<number, number>;
  ourTotalRuns: number;
  theirTotalRuns: number;
}

function outsInInning(plateAppearances: GameStatePlateAppearance[], inning: number): number {
  return plateAppearances.filter((pa) => pa.inning === inning && OUT_RESULTS.has(pa.result))
    .length;
}

export function computeGameState(input: GameStateInput): GameStateResult {
  const { battingOrder, plateAppearances, baserunningEvents, opponentInningRuns, inningsPlanned } =
    input;

  const ourRunsByInning: Record<number, number> = {};
  const theirRunsByInning: Record<number, number> = {};
  for (const pa of plateAppearances) {
    if (pa.runsScored) {
      ourRunsByInning[pa.inning] = (ourRunsByInning[pa.inning] ?? 0) + 1;
    }
  }
  for (const ev of baserunningEvents) {
    if (ev.eventType === "scored") {
      ourRunsByInning[ev.inning] = (ourRunsByInning[ev.inning] ?? 0) + 1;
    }
  }
  for (const r of opponentInningRuns) {
    theirRunsByInning[r.inning] = (theirRunsByInning[r.inning] ?? 0) + r.runs;
  }

  const ourTotalRuns = Object.values(ourRunsByInning).reduce((a, b) => a + b, 0);
  const theirTotalRuns = Object.values(theirRunsByInning).reduce((a, b) => a + b, 0);

  let currentInning = inningsPlanned;
  let half: GameHalf = "game_over";
  let outsThisHalf = 0;

  for (let inning = 1; inning <= inningsPlanned; inning++) {
    const outs = outsInInning(plateAppearances, inning);
    if (outs < OUTS_PER_HALF) {
      currentInning = inning;
      half = "us";
      outsThisHalf = outs;
      break;
    }

    const opponentRecorded = opponentInningRuns.some((r) => r.inning === inning);
    if (!opponentRecorded) {
      currentInning = inning;
      half = "them";
      outsThisHalf = 0;
      break;
    }
    // Both halves of this inning are complete; continue to the next inning.
  }

  const nextBatter =
    half === "us" && battingOrder.length > 0
      ? (battingOrder[plateAppearances.length % battingOrder.length] ?? null)
      : null;

  return {
    currentInning,
    half,
    outsThisHalf,
    nextBatter,
    ourRunsByInning,
    theirRunsByInning,
    ourTotalRuns,
    theirTotalRuns,
  };
}

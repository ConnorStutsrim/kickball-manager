"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getGame } from "@/lib/data/games";
import { getGameLineup } from "@/lib/data/lineups";
import { getPositions } from "@/lib/data/positions";
import { getPlayers } from "@/lib/data/players";
import { getSheetsClient } from "@/lib/google/client";
import { buildGameSheetGrid } from "@/lib/google/sheet-layout";
import { buildFormatRequests } from "@/lib/google/sheet-formatting";
import { BENCH } from "@/lib/lineup/fielding-solver";

export interface GenerateSheetResult {
  url?: string;
  error?: string;
}

function extractSpreadsheetId(url: string): string | undefined {
  return url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
}

export async function generateGameSheet(gameId: string): Promise<GenerateSheetResult> {
  await requireUser();

  const [row, lineup, positions, players] = await Promise.all([
    getGame(gameId),
    getGameLineup(gameId),
    getPositions(),
    getPlayers(),
  ]);

  if (!row) return { error: "Game not found." };
  if (!lineup) return { error: "Generate a lineup first." };

  const { game } = row;

  const genderByPlayerId = new Map(players.map((p) => [p.id, p.gender]));
  const inningsFieldedByPlayerId = new Map<string, number>();
  for (const entry of lineup.fielding) {
    if (entry.position === BENCH) continue;
    inningsFieldedByPlayerId.set(
      entry.playerId,
      (inningsFieldedByPlayerId.get(entry.playerId) ?? 0) + 1,
    );
  }

  const gameHeader = [
    game.date,
    game.opponent ? `vs ${game.opponent}` : undefined,
    game.location ? `@ ${game.location}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  const { grid, sections } = buildGameSheetGrid({
    gameHeader,
    positions: positions.map((p) => p.name),
    innings: game.inningsPlanned,
    fielding: lineup.fielding.map((f) => ({
      inning: f.inning,
      position: f.position,
      playerName: f.playerName,
    })),
    battingOrder: lineup.battingOrder.map((b) => ({
      battingPosition: b.battingPosition,
      playerName: b.playerName,
      gender: genderByPlayerId.get(b.playerId) ?? "",
      inningsFielded: inningsFieldedByPlayerId.get(b.playerId) ?? 0,
    })),
  });

  let sheets;
  try {
    sheets = await getSheetsClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google Sheets error.";
    return { error: message };
  }

  let spreadsheetId: string;
  let sheetId: number;
  let url: string;

  const existingId = game.sheetUrl ? extractSpreadsheetId(game.sheetUrl) : undefined;
  if (existingId) {
    spreadsheetId = existingId;
    url = game.sheetUrl!;
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: "A1:Z200" });
    const existing = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties.sheetId",
    });
    sheetId = existing.data.sheets![0].properties!.sheetId!;
  } else {
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: `vs ${game.opponent ?? "Game"} - ${game.date}` },
      },
    });
    spreadsheetId = created.data.spreadsheetId!;
    sheetId = created.data.sheets![0].properties!.sheetId!;
    url = created.data.spreadsheetUrl!;
    await db.update(games).set({ sheetUrl: url }).where(eq(games.id, gameId));
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: grid },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: buildFormatRequests(sheetId, sections) },
  });

  revalidatePath(`/games/${gameId}`);
  return { url };
}

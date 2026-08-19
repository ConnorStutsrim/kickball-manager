"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  battingOrderEntries,
  fieldingAssignments,
  games,
  lineups,
  positions,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { solveFielding } from "@/lib/lineup/fielding-solver";
import { buildBattingOrder } from "@/lib/lineup/batting-order";

export type GenerateLineupState = { error?: string; warnings?: string[] };

export async function generateLineup(
  gameId: string,
  _prevState: GenerateLineupState,
  formData: FormData,
): Promise<GenerateLineupState> {
  await requireUser();

  const presentIds = formData.getAll("presentPlayerIds").map(String);
  if (presentIds.length === 0) {
    return { error: "Select at least one player who is present." };
  }

  const [game, rules, positionProfiles, allPlayers] = await Promise.all([
    db.query.games.findFirst({ where: eq(games.id, gameId) }),
    db.query.leagueRules.findFirst(),
    db.query.positions.findMany({ orderBy: [asc(positions.displayOrder)] }),
    db.query.players.findMany(),
  ]);

  if (!game) return { error: "Game not found." };
  if (!rules) {
    return { error: "Set up league rules before generating a lineup." };
  }
  if (positionProfiles.length === 0) {
    return { error: "Set up positions before generating a lineup." };
  }

  const roster = allPlayers.filter((p) => presentIds.includes(p.id));
  if (roster.length === 0) {
    return { error: "Select at least one player who is present." };
  }

  const fieldingResult = solveFielding({
    players: roster.map((p) => ({
      id: p.id,
      gender: p.gender,
      speed: p.ratingSpeed,
      catching: p.ratingCatching,
      throwing: p.ratingThrowing,
      gameSense: p.ratingGameSense,
    })),
    positions: positionProfiles,
    innings: game.inningsPlanned,
    genderMinimums: rules.genderMinimums,
  });

  const battingOrder = buildBattingOrder({
    players: roster.map((p) => ({
      id: p.id,
      ratingContact: p.ratingContact,
      ratingPower: p.ratingPower,
      ratingSpeed: p.ratingSpeed,
      ratingPlateDiscipline: p.ratingPlateDiscipline,
    })),
  });

  await db.transaction(async (tx) => {
    const existing = await tx.query.lineups.findFirst({
      where: eq(lineups.gameId, gameId),
    });

    let lineupId: string;
    if (existing) {
      lineupId = existing.id;
      await tx
        .delete(battingOrderEntries)
        .where(eq(battingOrderEntries.lineupId, lineupId));
      await tx
        .delete(fieldingAssignments)
        .where(eq(fieldingAssignments.lineupId, lineupId));
    } else {
      const [created] = await tx.insert(lineups).values({ gameId }).returning();
      lineupId = created.id;
    }

    await tx.insert(battingOrderEntries).values(
      battingOrder.map((b) => ({
        lineupId,
        playerId: b.playerId,
        battingPosition: b.battingPosition,
      })),
    );
    await tx.insert(fieldingAssignments).values(
      fieldingResult.assignments.map((a) => ({
        lineupId,
        inning: a.inning,
        playerId: a.playerId,
        position: a.position,
      })),
    );
  });

  revalidatePath(`/games/${gameId}`);
  return { warnings: fieldingResult.warnings };
}

export async function moveBattingOrder(
  gameId: string,
  lineupId: string,
  playerId: string,
  direction: "up" | "down",
) {
  await requireUser();

  const entries = await db.query.battingOrderEntries.findMany({
    where: eq(battingOrderEntries.lineupId, lineupId),
    orderBy: [asc(battingOrderEntries.battingPosition)],
  });

  const index = entries.findIndex((e) => e.playerId === playerId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= entries.length) return;

  const a = entries[index];
  const b = entries[swapIndex];

  await db.transaction(async (tx) => {
    await tx
      .update(battingOrderEntries)
      .set({ battingPosition: b.battingPosition })
      .where(eq(battingOrderEntries.id, a.id));
    await tx
      .update(battingOrderEntries)
      .set({ battingPosition: a.battingPosition })
      .where(eq(battingOrderEntries.id, b.id));
  });

  revalidatePath(`/games/${gameId}`);
}

// Swaps playerId into (inning, position) and the position's previous
// occupant takes over whatever spot the incoming player previously held
// that inning (another position, or bench) — keeps exactly one row per
// player per inning intact rather than creating a duplicate/orphan row.
export async function setFieldingAssignment(
  gameId: string,
  lineupId: string,
  inning: number,
  position: string,
  newPlayerId: string,
) {
  await requireUser();

  const [rowAtPosition, rowForPlayer] = await Promise.all([
    db.query.fieldingAssignments.findFirst({
      where: and(
        eq(fieldingAssignments.lineupId, lineupId),
        eq(fieldingAssignments.inning, inning),
        eq(fieldingAssignments.position, position),
      ),
    }),
    db.query.fieldingAssignments.findFirst({
      where: and(
        eq(fieldingAssignments.lineupId, lineupId),
        eq(fieldingAssignments.inning, inning),
        eq(fieldingAssignments.playerId, newPlayerId),
      ),
    }),
  ]);

  if (!rowAtPosition || !rowForPlayer || rowAtPosition.id === rowForPlayer.id) {
    return;
  }

  const oldPlayerId = rowAtPosition.playerId;

  await db.transaction(async (tx) => {
    await tx
      .update(fieldingAssignments)
      .set({ playerId: newPlayerId })
      .where(eq(fieldingAssignments.id, rowAtPosition.id));
    await tx
      .update(fieldingAssignments)
      .set({ playerId: oldPlayerId })
      .where(eq(fieldingAssignments.id, rowForPlayer.id));
  });

  revalidatePath(`/games/${gameId}`);
}

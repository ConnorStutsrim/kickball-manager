"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
import { computeGenderShortfalls, solveFielding } from "@/lib/lineup/fielding-solver";
import { buildBattingOrder } from "@/lib/lineup/batting-order";
import { computeBattingStats } from "@/lib/stats/batting-stats";
import { blendRating, statToRating } from "@/lib/stats/stat-scaling";
import {
  getSeasonBaserunningEvents,
  getSeasonPlateAppearances,
} from "@/lib/data/season-batting-stats";
import { getAllPlayerPositionRatings } from "@/lib/data/position-ratings";
import { getPositionShoreUpWeights } from "@/lib/data/position-shore-up-weights";

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

  const [game, rules, positionProfiles, archetypes, allPlayers, ratingRows, shoreUpRows] =
    await Promise.all([
      db.query.games.findFirst({ where: eq(games.id, gameId) }),
      db.query.leagueRules.findFirst(),
      db.query.positions.findMany({ orderBy: [asc(positions.displayOrder)] }),
      db.query.battingSlotArchetypes.findMany(),
      db.query.players.findMany(),
      getAllPlayerPositionRatings(),
      getPositionShoreUpWeights(),
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

  // A gender more than 2 short of the league minimum can't play without
  // dropping more positions than the league's shorthanded rule allows for
  // (Float, then Outfield 4) — block rather than silently degrading further.
  const shortfalls = computeGenderShortfalls(
    roster.map((p) => ({ id: p.id, gender: p.gender })),
    rules.genderMinimums,
  );
  const tooShort = shortfalls.find((s) => s.shortfall >= 3);
  if (tooShort) {
    const genderWord =
      tooShort.gender === "M" ? (tooShort.total === 1 ? "man" : "men") : tooShort.total === 1 ? "woman" : "women";
    return {
      error: `Only ${tooShort.total} ${genderWord} are present; at least ${
        tooShort.min - 2
      } are needed to generate a lineup.`,
    };
  }

  const positionNameById = new Map(positionProfiles.map((p) => [p.id, p.name]));
  const ratings = ratingRows.map((r) => ({
    playerId: r.playerId,
    positionName: positionNameById.get(r.positionId)!,
    rating: r.rating,
  }));
  const shoreUpWeights = shoreUpRows.map((r) => ({
    helperPositionName: positionNameById.get(r.helperPositionId)!,
    helpedPositionName: positionNameById.get(r.helpedPositionId)!,
    weight: r.weight,
  }));

  const fieldingResult = await solveFielding({
    players: roster.map((p) => ({
      id: p.id,
      gender: p.gender,
    })),
    positions: positionProfiles,
    innings: game.inningsPlanned,
    genderMinimums: rules.genderMinimums,
    ratings,
    shoreUpWeights,
  });

  // Blend each player's manual scouting ratings with real season stats
  // (weighted by how much evidence exists for each stat) before building
  // the batting order — buildBattingOrder itself doesn't know or care
  // whether a rating is pure qualitative or partly stat-derived.
  const [seasonPAs, seasonEvents] = await Promise.all([
    getSeasonPlateAppearances(game.seasonId),
    getSeasonBaserunningEvents(game.seasonId),
  ]);
  const rosterIds = roster.map((p) => p.id);
  const battingStats = computeBattingStats(rosterIds, seasonPAs, seasonEvents);
  const statsByPlayerId = new Map(battingStats.map((s) => [s.playerId, s]));

  const allTotalBasesPerPA = battingStats.map((s) => s.totalBasesPerPA);
  const allRbiPerPA = battingStats.map((s) => s.rbiPerPA);
  const allHitRate = battingStats.map((s) => s.hitRateExcludingWalks);
  const allAdvancementRate = battingStats.map((s) => s.advancementRate);
  const allBuntSuccessRates = battingStats
    .map((s) => s.buntSuccessRate)
    .filter((rate): rate is number => rate !== null);

  const battingOrder = buildBattingOrder({
    players: roster.map((p) => {
      const stats = statsByPlayerId.get(p.id)!;
      const powerStatRating =
        (statToRating(stats.totalBasesPerPA, allTotalBasesPerPA) +
          statToRating(stats.rbiPerPA, allRbiPerPA)) /
        2;
      const placementStatRating = statToRating(stats.hitRateExcludingWalks, allHitRate);
      const baserunningStatRating = statToRating(stats.advancementRate, allAdvancementRate);
      const buntStatRating =
        stats.buntSuccessRate !== null
          ? statToRating(stats.buntSuccessRate, allBuntSuccessRates)
          : null;

      return {
        id: p.id,
        power: blendRating(p.ratingPower, powerStatRating, stats.plateAppearances),
        placement: blendRating(p.ratingPlacement, placementStatRating, stats.plateAppearances),
        bunting: blendRating(p.ratingBunting, buntStatRating, stats.buntAttempts),
        baserunning: blendRating(
          p.ratingBaserunning,
          baserunningStatRating,
          stats.timesReachedBase,
        ),
      };
    }),
    archetypes,
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

export async function deleteGame(gameId: string) {
  await requireUser();
  await db.delete(games).where(eq(games.id, gameId));
  revalidatePath("/games");
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/games/${gameId}/live`);
  redirect("/games");
}

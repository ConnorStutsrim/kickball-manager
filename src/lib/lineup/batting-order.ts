const NEUTRAL_RATING = 3;

export interface BattingOrderPlayer {
  id: string;
  ratingContact: number | null;
  ratingPower: number | null;
  ratingSpeed: number | null;
  ratingPlateDiscipline: number | null;
}

export interface BattingOrderEntry {
  playerId: string;
  battingPosition: number;
}

function rating(value: number | null): number {
  return value ?? NEUTRAL_RATING;
}

function overallScore(p: BattingOrderPlayer): number {
  return (
    (rating(p.ratingContact) +
      rating(p.ratingPower) +
      rating(p.ratingSpeed) +
      rating(p.ratingPlateDiscipline)) /
    4
  );
}

function leadoffScore(p: BattingOrderPlayer): number {
  return (rating(p.ratingSpeed) + rating(p.ratingPlateDiscipline)) / 2;
}

function powerContactBlend(p: BattingOrderPlayer): number {
  return (rating(p.ratingPower) + rating(p.ratingContact)) / 2;
}

// Classic lineup construction: leadoff gets on base and runs, #2 moves them
// over, #3 is the best all-around hitter, #4/#5 drive runners in, everyone
// else fills out the order by overall strength.
const SLOT_SCORERS: ((p: BattingOrderPlayer) => number)[] = [
  leadoffScore,
  (p) => rating(p.ratingContact),
  overallScore,
  (p) => rating(p.ratingPower),
  powerContactBlend,
];

export function buildBattingOrder(input: {
  players: BattingOrderPlayer[];
}): BattingOrderEntry[] {
  const remaining = [...input.players];
  const order: BattingOrderPlayer[] = [];

  function takeBest(
    scoreFn: (p: BattingOrderPlayer) => number,
  ): BattingOrderPlayer | undefined {
    if (remaining.length === 0) return undefined;
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const score = scoreFn(remaining[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    return remaining.splice(bestIndex, 1)[0];
  }

  for (const scoreFn of SLOT_SCORERS) {
    const player = takeBest(scoreFn);
    if (player) order.push(player);
  }

  remaining.sort((a, b) => overallScore(b) - overallScore(a));
  order.push(...remaining);

  return order.map((p, i) => ({ playerId: p.id, battingPosition: i + 1 }));
}

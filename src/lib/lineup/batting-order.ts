import {
  battingAptitude,
  type BatterSkills,
  type BattingSlotArchetype,
} from "./batting-aptitude";

export interface BattingOrderPlayer extends BatterSkills {
  id: string;
}

export interface BattingOrderEntry {
  playerId: string;
  battingPosition: number;
}

// Classic lineup construction, expressed as a slot -> archetype mapping
// rather than a hardcoded formula per slot: Leadoff gets on base and runs,
// Connector moves them over, the two Cleanup slots drive runners in, every
// slot after that is Balanced (no particular specialty), and the very last
// batter is Leadoff again — a "second leadoff" who bats right before the
// order turns back over to the real leadoff. Archetype weights themselves
// are configurable (see /settings/batting-slots) — this mapping only
// decides which archetype applies to which slot number.
function archetypeNameForSlot(slotNumber: number, totalSlots: number): string {
  if (slotNumber === totalSlots) return "Leadoff";
  switch (slotNumber) {
    case 1:
      return "Leadoff";
    case 2:
      return "Connector";
    case 3:
    case 4:
      return "Cleanup";
    default:
      return "Balanced";
  }
}

const FALLBACK_ARCHETYPE: BattingSlotArchetype = {
  name: "Balanced",
  weightPower: 0,
  weightPlacement: 0,
  weightBunting: 0,
  weightBaserunning: 0,
};

export function buildBattingOrder(input: {
  players: BattingOrderPlayer[];
  archetypes: BattingSlotArchetype[];
}): BattingOrderEntry[] {
  const archetypeByName = new Map(input.archetypes.map((a) => [a.name, a]));
  const remaining = [...input.players];
  const order: BattingOrderPlayer[] = [];

  const totalSlots = input.players.length;
  for (let slot = 1; slot <= totalSlots; slot++) {
    const archetype =
      archetypeByName.get(archetypeNameForSlot(slot, totalSlots)) ?? FALLBACK_ARCHETYPE;

    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const score = battingAptitude(remaining[i], archetype);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    order.push(remaining.splice(bestIndex, 1)[0]);
  }

  return order.map((p, i) => ({ playerId: p.id, battingPosition: i + 1 }));
}

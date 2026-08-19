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

// Classic lineup construction, now expressed as a slot -> archetype mapping
// rather than a hardcoded formula per slot: leadoff gets on base and runs,
// the table setter moves them over, the middle-order archetypes drive runners
// in, and everyone past #5 (including the #3 "best all-around" slot) uses the
// same "Balanced" archetype. Archetype weights themselves are configurable
// (see /settings/batting-slots) — this mapping only decides which archetype
// applies to which slot number.
const SLOT_ARCHETYPE_NAMES = ["Leadoff", "Table Setter", "Balanced", "Cleanup", "RBI"] as const;

function archetypeNameForSlot(slotNumber: number): string {
  return SLOT_ARCHETYPE_NAMES[slotNumber - 1] ?? "Balanced";
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

  for (let slot = 1; slot <= input.players.length; slot++) {
    const archetype = archetypeByName.get(archetypeNameForSlot(slot)) ?? FALLBACK_ARCHETYPE;

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

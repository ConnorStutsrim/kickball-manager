import type { BaserunningEventType, DefensiveNoteTag, PlateAppearanceResult } from "@/db/schema";

export const RESULT_OPTIONS: { value: PlateAppearanceResult; label: string }[] = [
  { value: "single", label: "1B" },
  { value: "double", label: "2B" },
  { value: "triple", label: "3B" },
  { value: "home_run", label: "HR" },
  { value: "walk", label: "BB" },
  { value: "out", label: "Out" },
  { value: "fielders_choice", label: "FC" },
  { value: "sac", label: "Sac" },
  { value: "reached_on_error", label: "ROE" },
];

export const RESULT_LABELS: Record<PlateAppearanceResult, string> = Object.fromEntries(
  RESULT_OPTIONS.map((r) => [r.value, r.label]),
) as Record<PlateAppearanceResult, string>;

export const BASERUNNING_EVENT_OPTIONS: { value: BaserunningEventType; label: string }[] = [
  { value: "steal", label: "Steal" },
  { value: "caught_stealing", label: "Caught stealing" },
  { value: "advanced", label: "Advanced" },
  { value: "scored", label: "Scored" },
];

export const DEFENSIVE_NOTE_TAG_OPTIONS: { value: DefensiveNoteTag; label: string }[] = [
  { value: "great_play", label: "Great play" },
  { value: "error", label: "Error" },
  { value: "assist", label: "Assist" },
];

import { createPlayer } from "../actions";
import { PlayerForm } from "../player-form";

export default function NewPlayerPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Add player</h1>
      <PlayerForm action={createPlayer} submitLabel="Add player" />
    </div>
  );
}

import { isGoogleConnected } from "@/lib/google/client";
import { Button } from "@/components/ui/button";

export default async function GoogleSettingsPage(
  props: PageProps<"/settings/google">,
) {
  const searchParams = await props.searchParams;
  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const justConnected = searchParams.connected === "1";
  const connected = await isGoogleConnected();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Google Sheets</h1>
        <p className="text-sm text-muted-foreground">
          Connect your Google account so a game&apos;s lineup can be exported to
          a Sheet for game-day use.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {justConnected && !error && (
        <p className="text-sm text-success">
          Connected successfully.
        </p>
      )}

      <p className="text-sm">
        Status:{" "}
        <span className={connected ? "text-success" : "text-muted-foreground"}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </p>

      <Button render={<a href="/api/google/connect" />} className="self-start">
        {connected ? "Reconnect Google Account" : "Connect Google Account"}
      </Button>
    </div>
  );
}

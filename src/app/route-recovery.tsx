import { Link, useRouteError } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "../components/button";
import { Surface } from "../components/surface";

export function NotFoundPage() {
  return (
    <main
      className="route-recovery"
      style={{ padding: "var(--space-xl)", maxWidth: 640, margin: "0 auto" }}
    >
      <h1>Page not found</h1>
      <p>This arcade page is unavailable. Choose a game to continue.</p>
      <Link to="/games">Back to Games</Link>
    </main>
  );
}

export function RouteRecovery() {
  const error = useRouteError();
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const unavailable = error instanceof Error && /fetch|import|chunk|network/i.test(error.message);
  return (
    <main
      className="route-recovery"
      style={{ padding: "var(--space-xl)", maxWidth: 640, margin: "0 auto" }}
    >
      <Surface variant="card" padding="lg" radius="lg">
        <h1>{offline ? "Reconnect to open this page" : "This page could not open"}</h1>
        <p role="alert">
          {offline || unavailable
            ? "Connect to the internet and retry. Your accepted game progress is saved."
            : "Your accepted game progress is saved. Retry this page or return to Games."}
        </p>
        <Button disabled={offline} onClick={() => window.location.reload()}>
          Retry page
        </Button>
        <p>
          <Link to="/games">Back to Games</Link>
        </p>
      </Surface>
    </main>
  );
}

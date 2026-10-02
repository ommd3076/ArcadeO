import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { NavTabs } from "../components/nav-tabs";

export function Shell() {
  const location = useLocation();

  // Show bottom NavTabs only on primary shell routes (Home, Games list, Us)
  const isMainTab =
    location.pathname === "/" || location.pathname === "/games" || location.pathname === "/us";

  return (
    <div
      className="app-shell"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-canvas)",
        color: "var(--color-text)",
      }}
    >
      {isMainTab && (
        <a className="skip-to-content" href="#main-content">
          Skip to content
        </a>
      )}
      <main id="main-content" className="app-shell__outlet" tabIndex={-1}>
        <Outlet />
      </main>

      <ScrollRestoration />

      {isMainTab && <NavTabs />}
    </div>
  );
}

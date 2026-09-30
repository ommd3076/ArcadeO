import { Outlet, useLocation } from "react-router-dom";
import { NavTabs } from "../components/nav-tabs";

export function Shell() {
  const location = useLocation();

  // Show bottom NavTabs only on primary shell routes (Home, Games list, Us)
  const isMainTab =
    location.pathname === "/" || location.pathname === "/games" || location.pathname === "/us";

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-canvas)",
        color: "var(--color-text)",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Outlet />
      </div>

      {isMainTab && <NavTabs />}
    </div>
  );
}

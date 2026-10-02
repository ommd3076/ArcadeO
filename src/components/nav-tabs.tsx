import { NavLink } from "react-router-dom";
import { Home, Gamepad2 } from "lucide-react";
import { UsCoupleIcon } from "./icons/us-couple-icon";

export function NavTabs() {
  const tabs = [
    { to: "/", label: "Home", icon: <Home size={18} /> },
    { to: "/games", label: "Games", icon: <Gamepad2 size={18} /> },
    { to: "/us", label: "Us", icon: <UsCoupleIcon size={18} /> },
  ];

  return (
    <nav className="arcade-nav-tabs" aria-label="Main Navigation">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === "/"}
          className={({ isActive }) =>
            `arcade-nav-item ${isActive ? "arcade-nav-item--active" : ""}`
          }
        >
          <span className="arcade-nav-icon-wrapper">{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

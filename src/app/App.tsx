import React from "react";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider, useTheme } from "../theme";
import { AuthProvider, useAuth } from "./auth";
import { router } from "./router";
import "../theme/theme.css";

function AccountAppearance() {
  const { session } = useAuth();
  const { setFamily, setPlayerAccent, setMode } = useTheme();
  React.useEffect(() => {
    if (!session) return;
    setFamily(session.profile.paletteFamily);
    setPlayerAccent(session.profile.accentFamily);
    const mode = localStorage.getItem("pa_theme_mode_" + session.profile.id);
    setMode(mode === "light" || mode === "system" ? mode : "dark");
  }, [session?.profile.id]);
  return null;
}
export function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AccountAppearance />
        <RouterProvider router={router} />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;

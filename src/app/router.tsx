import { createBrowserRouter } from "react-router-dom";
import { RequireAuth } from "./auth";
import { Shell } from "./shell";
import { LoginPage } from "./pages/login-page";
import { NotFoundPage, RouteRecovery } from "./route-recovery";
import { rememberAppLocation } from "./navigation-history";

export const router = createBrowserRouter([
  {
    element: <RequireAuth />,
    errorElement: <RouteRecovery />,
    children: [
      {
        path: "/",
        element: <Shell />,
        children: [
          {
            index: true,
            lazy: async () => ({ Component: (await import("./pages/home-page")).HomePage }),
          },
          {
            path: "games",
            lazy: async () => ({ Component: (await import("./pages/games-page")).GamesPage }),
          },
          {
            path: "games/:gameId",
            lazy: async () => ({
              Component: (await import("./pages/game-detail-page")).GameDetailPage,
            }),
          },
          {
            path: "matches/:matchId",
            lazy: async () => ({ Component: (await import("./pages/match-page")).MatchPage }),
          },
          {
            path: "sudoku",
            lazy: async () => ({
              Component: (await import("../screens/sudoku-list")).SudokuListScreen,
            }),
          },
          {
            path: "us",
            lazy: async () => ({ Component: (await import("./pages/us-page")).UsPage }),
          },
        ],
      },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteRecovery />,
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

rememberAppLocation();
router.subscribe((state) => {
  if (state.navigation.state === "idle") rememberAppLocation();
});

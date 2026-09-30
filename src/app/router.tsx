import { createBrowserRouter, Navigate } from "react-router-dom";
import { Shell } from "./shell";
import { HomePage } from "./pages/home-page";
import { GamesPage } from "./pages/games-page";
import { GameDetailPage } from "./pages/game-detail-page";
import { MatchPage } from "./pages/match-page";
import { UsPage } from "./pages/us-page";
import { LoginPage } from "./pages/login-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "games",
        element: <GamesPage />,
      },
      {
        path: "games/:gameId",
        element: <GameDetailPage />,
      },
      {
        path: "matches/:matchId",
        element: <MatchPage />,
      },
      {
        path: "us",
        element: <UsPage />,
      },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

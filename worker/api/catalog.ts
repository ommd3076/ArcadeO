import { GameId } from "../../shared/protocol/types";
import catalogData from "../../content/sudoku/catalog.json";

export interface GameMetadata {
  id: GameId;
  title: string;
  subtitle: string;
  modes: string[];
  description: string;
  tactilePawn: string;
  accent: string;
}

export const ARCADE_GAMES: GameMetadata[] = [
  {
    id: "connect-four",
    title: "Connect Four",
    subtitle: "7x6 Vertical Gravity Grid",
    modes: ["remote", "together"],
    description:
      "Drop tokens into seven vertical columns to connect four of your color in a row before your opponent.",
    tactilePawn: "disc",
    accent: "teal",
  },
  {
    id: "rock-paper-scissors",
    title: "Rock Paper Scissors",
    subtitle: "Simultaneous Secret Hand Play",
    modes: ["remote", "together"],
    description:
      "Classic simultaneous decision game with best-of-3, 5, or 7 series and private phone handoffs.",
    tactilePawn: "fist",
    accent: "cyan",
  },
  {
    id: "ludo",
    title: "Ludo",
    subtitle: "52-Square Shared Track & Yard",
    modes: ["remote", "together"],
    description:
      "Race four tokens around the perimeter from your yard into home lane. Capture unsafe opponent tokens with exact entry rolls.",
    tactilePawn: "pawn",
    accent: "yellow",
  },
  {
    id: "snakes-and-ladders",
    title: "Snakes & Ladders",
    subtitle: "10x10 Serpentine Board",
    modes: ["remote", "together"],
    description:
      "Climb 7 ladders and avoid 7 snakes on your journey to square 100 with exact finish rolls.",
    tactilePawn: "die",
    accent: "mint",
  },
  {
    id: "dots-boxes",
    title: "Dots & Boxes",
    subtitle: "5x5 Grid / 16 Territory Boxes",
    modes: ["remote", "together"],
    description:
      "Take turns drawing orthogonal edges. Closing a box scores a point and awards another move.",
    tactilePawn: "square",
    accent: "violet",
  },
  {
    id: "sos",
    title: "SOS",
    subtitle: "5x5 Tactical Letter Grid",
    modes: ["remote", "together"],
    description:
      "Place S or O in empty cells to form straight S-O-S sequences in any direction and retain turns.",
    tactilePawn: "circle",
    accent: "pink",
  },
  {
    id: "hand-cricket",
    title: "Hand Cricket",
    subtitle: "Secret numbers · Bat and bowl",
    modes: ["remote", "together"],
    description:
      "Toss for bat or bowl. Secretly choose 1 to 10. Different numbers add the batter's number; equal numbers mean OUT and a change of roles. Together, both bat until OUT, then compare totals.",
    tactilePawn: "bat",
    accent: "teal",
  },
  {
    id: "sudoku",
    title: "Sudoku",
    subtitle: "1,000 Verified Launch Puzzles",
    modes: ["practice", "duel", "challenge"],
    description:
      "Classic 9x9 logic puzzle across 4 difficulty tiers. Solo practice with notes and Check, live head-to-head duels, or async challenges.",
    tactilePawn: "grid",
    accent: "violet",
  },
];

export async function handleCatalogRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method !== "GET")
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET" } });

  // GET /api/v1/games
  if (path === "/api/v1/games" || path === "/api/games") {
    return new Response(JSON.stringify({ games: ARCADE_GAMES }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // GET /api/v1/sudoku/catalog
  if (path === "/api/v1/sudoku/catalog" || path === "/api/sudoku/catalog") {
    const bucket = url.searchParams.get("bucket");
    const limit = Number(url.searchParams.get("limit") || "50");
    const offset = Number(url.searchParams.get("offset") || "0");
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 250 ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      (bucket && !["easy", "medium", "hard", "expert"].includes(bucket.toLowerCase()))
    ) {
      return new Response(JSON.stringify({ error: "Invalid catalog pagination or difficulty" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const random = url.searchParams.get("random") === "true";

    let puzzles = (
      catalogData as Array<{
        puzzleId: string;
        bucket: string;
        number: number;
        rating: number;
        givens: string;
      }>
    ).map(({ givens: _givens, ...metadata }) => metadata);

    if (bucket && ["easy", "medium", "hard", "expert"].includes(bucket.toLowerCase())) {
      puzzles = puzzles.filter((p) => p.bucket.toLowerCase() === bucket.toLowerCase());
    }

    if (random) {
      const randomIndex = Math.floor(Math.random() * puzzles.length);
      return new Response(JSON.stringify({ puzzle: puzzles[randomIndex] }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const total = puzzles.length;
    const paginated = puzzles.slice(offset, offset + limit);

    return new Response(
      JSON.stringify({
        total,
        offset,
        limit,
        puzzles: paginated,
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=1800",
        },
      },
    );
  }

  return null;
}

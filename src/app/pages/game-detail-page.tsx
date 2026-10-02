import { useParams } from "react-router-dom";
import { GameDetailScreen } from "../../screens/game-detail";
import { SudokuListScreen } from "../../screens/sudoku-list";

export function GameDetailPage() {
  const { gameId = "connect-four" } = useParams<{ gameId: string }>();

  if (gameId === "sudoku") {
    return <SudokuListScreen />;
  }

  return <GameDetailScreen />;
}

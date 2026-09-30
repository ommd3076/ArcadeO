class TTTEngine {
  constructor() {
    this.board = Array(9).fill(null);
    this.currentTurn = 'X';
    this.winner = null;
  }

  initialize() {
    this.board = Array(9).fill(null);
    this.currentTurn = 'X';
    this.winner = null;
  }

  placeMark(index) {
    if (this.winner || this.board[index]) {
      return { success: false };
    }

    this.board[index] = this.currentTurn;
    const result = { success: true, mark: this.currentTurn };

    // Check win
    const winLines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    for (const [a, b, c] of winLines) {
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        this.winner = this.board[a];
        result.gameOver = true;
        result.winner = this.winner;
        return result;
      }
    }

    // Check draw
    if (this.board.every(cell => cell !== null)) {
      this.winner = 'DRAW';
      result.gameOver = true;
      result.winner = 'DRAW';
      return result;
    }

    this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
    return result;
  }

  getState() {
    return {
      board: this.board,
      currentTurn: this.currentTurn,
      winner: this.winner
    };
  }
}

module.exports = TTTEngine;

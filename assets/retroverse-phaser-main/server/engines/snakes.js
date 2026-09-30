class SnakesEngine {
  constructor() {
    this.SNAKES = {
      17: 7, 54: 34, 62: 19, 64: 60,
      87: 24, 92: 73, 95: 75, 98: 79
    };

    this.LADDERS = {
      1: 38, 4: 14, 9: 31, 21: 42,
      28: 84, 51: 67, 71: 91, 80: 100
    };

    this.players = [];
    this.currentTurnIndex = 0;
    this.winnerId = null;
  }

  initialize(players) {
    this.players = players.slice(0, 2).map((p, idx) => ({
      id: p.id,
      position: 0,
      color: idx === 0 ? 'cyan' : 'magenta'
    }));
  }

  rollDice() {
    if (this.winnerId) return { dice: 0 };

    const roll = Math.floor(Math.random() * 6) + 1;
    const currentPlayer = this.players[this.currentTurnIndex];
    let newPos = currentPlayer.position + roll;

    const result = { dice: roll };

    // Exact 100 rule
    if (newPos > 100) {
      this.nextTurn();
      return result;
    }

    // Check snakes
    if (this.SNAKES[newPos]) {
      result.snakeHit = { from: newPos, to: this.SNAKES[newPos] };
      newPos = this.SNAKES[newPos];
    }
    // Check ladders
    else if (this.LADDERS[newPos]) {
      result.ladderClimbed = { from: newPos, to: this.LADDERS[newPos] };
      newPos = this.LADDERS[newPos];
    }

    currentPlayer.position = newPos;
    result.playerMoved = { playerId: currentPlayer.id, position: newPos };

    if (newPos === 100) {
      this.winnerId = currentPlayer.id;
      result.winner = currentPlayer.id;
    } else {
      this.nextTurn();
    }

    return result;
  }

  nextTurn() {
    this.currentTurnIndex = 1 - this.currentTurnIndex;
  }

  getState() {
    return {
      players: this.players,
      currentTurnIndex: this.currentTurnIndex,
      winnerId: this.winnerId
    };
  }
}

module.exports = SnakesEngine;

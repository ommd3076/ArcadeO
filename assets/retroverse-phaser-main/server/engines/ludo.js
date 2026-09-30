class LudoEngine {
  constructor() {
    this.pieces = [];
    this.currentTurnIndex = 0;
    this.diceValue = null;
    this.consecutiveSixes = 0;
    this.canRoll = true;
    this.winners = [];
  }

  initialize(players) {
    this.pieces = [];
    this.players = players.slice(0, 4);
    
    players.forEach((player, pIdx) => {
      for (let i = 0; i < 4; i++) {
        this.pieces.push({
          id: `${player.id}-piece-${i}`,
          playerId: player.id,
          color: player.color,
          position: -1 - i,
          isHome: false
        });
      }
    });
  }

  rollDice() {
    if (!this.canRoll) return 0;

    const roll = Math.floor(Math.random() * 6) + 1;
    this.diceValue = roll;

    if (roll === 6) {
      this.consecutiveSixes++;
    } else {
      this.consecutiveSixes = 0;
    }

    // Three 6s = forfeit
    if (this.consecutiveSixes >= 3) {
      this.diceValue = 0;
      this.consecutiveSixes = 0;
      this.nextTurn();
      return 0;
    }

    this.canRoll = false;
    return roll;
  }

  movePiece(pieceId) {
    const piece = this.pieces.find(p => p.id === pieceId);
    if (!piece || !this.diceValue) return false;

    let newPos = piece.position;
    
    if (newPos < 0) {
      if (this.diceValue !== 6) return false;
      newPos = 0;
    } else {
      newPos += this.diceValue;
    }

    if (newPos > 57) return false;

    piece.position = newPos;
    piece.isHome = newPos === 57;

    const bonusTurn = this.diceValue === 6;
    
    if (!bonusTurn) {
      this.nextTurn();
    } else {
      this.canRoll = true;
    }

    this.diceValue = 0;
    return true;
  }

  nextTurn() {
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    this.canRoll = true;
    this.consecutiveSixes = 0;
  }

  getState() {
    return {
      pieces: this.pieces,
      currentTurnIndex: this.currentTurnIndex,
      diceValue: this.diceValue,
      canRoll: this.canRoll,
      winners: this.winners
    };
  }
}

module.exports = LudoEngine;

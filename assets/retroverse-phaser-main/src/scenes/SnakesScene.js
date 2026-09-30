export default class SnakesScene extends Phaser.Scene {
  constructor() {
    super('SnakesScene');
  }

  init(data) {
    this.socket = data.socket;
    this.isHost = data.isHost;
    this.tokens = {};
  }

  create() {
    const { width, height } = this.cameras.main;

    this.add.rectangle(0, 0, width, height, 0x0d1729).setOrigin(0);

    this.add.text(width / 2, 30, 'SNAKES & LADDERS', {
      fontSize: '36px',
      color: '#10b981',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const backBtn = this.add.text(30, 30, '← Back', {
      fontSize: '20px',
      color: '#ffffff'
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.scene.start('LobbyScene', { socket: this.socket, isHost: this.isHost });
    });

    this.createBoard();

    // Dice button
    this.diceButton = this.add.rectangle(width - 100, height - 100, 80, 80, 0x10b981)
      .setInteractive({ useHandCursor: true });

    this.diceText = this.add.text(width - 100, height - 100, '🎲', {
      fontSize: '40px'
    }).setOrigin(0.5);

    this.diceButton.on('pointerdown', () => {
      if (this.isHost) {
        this.socket.emit('rollDice', 'SNAKES');
      }
    });

    this.turnText = this.add.text(width / 2, height - 50, 'Roll to start!', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Socket listeners
    this.socket.on('gameStateUpdate', (state) => {
      this.updateGame(state);
    });

    this.socket.on('diceRolled', (data) => {
      this.showDiceRoll(data.value);
    });

    this.socket.on('playerMoved', (data) => {
      this.animateToken(data.playerId, data.position);
    });

    this.socket.on('snakeHit', (data) => {
      this.showSnake(data.from, data.to);
    });

    this.socket.on('ladderClimbed', (data) => {
      this.showLadder(data.from, data.to);
    });
  }

  createBoard() {
    const boardSize = 500;
    const cellSize = boardSize / 10;
    const startX = (this.cameras.main.width - boardSize) / 2;
    const startY = 100;

    // Draw 10x10 grid (100 cells)
    for (let i = 0; i < 100; i++) {
      const num = 100 - i;
      const row = Math.floor(i / 10);
      const col = i % 10;

      const posX = startX + col * cellSize;
      const posY = startY + row * cellSize;

      // Alternate colors
      const color = row % 2 === 0 ? 0x1e293b : 0x334155;

      const cell = this.add.rectangle(posX, posY, cellSize - 2, cellSize - 2, color);
      
      this.add.text(posX, posY, num.toString(), {
        fontSize: '16px',
        color: '#94a3b8'
      }).setOrigin(0.5);
    }

    this.boardStartX = startX;
    this.boardStartY = startY;
    this.cellSize = cellSize;
  }

  showDiceRoll(value) {
    this.diceText.setText(value.toString());
    
    this.tweens.add({
      targets: this.diceButton,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 100,
      yoyo: true,
      repeat: 2
    });
  }

  animateToken(playerId, position) {
    const coords = this.getCellCoords(position);
    const targetX = this.boardStartX + coords.x * this.cellSize;
    const targetY = this.boardStartY + coords.y * this.cellSize;

    if (!this.tokens[playerId]) {
      // Create token
      this.tokens[playerId] = this.add.circle(targetX, targetY, 15, 0x22d3ee);
    } else {
      this.tweens.add({
        targets: this.tokens[playerId],
        x: targetX,
        y: targetY,
        duration: 800,
        ease: 'Power2'
      });
    }
  }

  getCellCoords(pos) {
    if (pos === 0) return { x: 0, y: 9 };
    
    const adjusted = pos - 1;
    const row = Math.floor(adjusted / 10);
    const col = adjusted % 10;
    
    return { x: col, y: 9 - row };
  }

  showSnake(from, to) {
    this.turnText.setText(`🐍 Snake! ${from} → ${to}`);
  }

  showLadder(from, to) {
    this.turnText.setText(`🪜 Ladder! ${from} → ${to}`);
  }

  updateGame(state) {
    if (state.currentTurnIndex !== undefined) {
      this.turnText.setText(`Turn: Player ${state.currentTurnIndex + 1}`);
    }
  }
}

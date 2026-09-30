export default class LudoScene extends Phaser.Scene {
  constructor() {
    super('LudoScene');
  }

  init(data) {
    this.socket = data.socket;
    this.isHost = data.isHost;
    this.pieces = [];
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background
    this.add.rectangle(0, 0, width, height, 0x0d1729).setOrigin(0);

    // Title
    this.add.text(width / 2, 30, 'LUDO', {
      fontSize: '36px',
      color: '#22d3ee',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Back button
    const backBtn = this.add.text(30, 30, '← Back', {
      fontSize: '20px',
      color: '#ffffff'
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.scene.start('LobbyScene', { socket: this.socket, isHost: this.isHost });
    });

    // Create Ludo board
    this.createBoard();

    // Dice button
    this.diceButton = this.add.rectangle(width - 100, height - 100, 80, 80, 0x22d3ee)
      .setInteractive({ useHandCursor: true });

    this.diceText = this.add.text(width - 100, height - 100, '🎲', {
      fontSize: '40px'
    }).setOrigin(0.5);

    this.diceButton.on('pointerdown', () => {
      if (this.isHost) {
        this.socket.emit('rollDice', 'LUDO');
      }
    });

    // Turn indicator
    this.turnText = this.add.text(width / 2, height - 50, 'Waiting...', {
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

    this.socket.on('pieceMoved', (data) => {
      this.animatePiece(data.pieceId, data.newPosition);
    });

    this.socket.on('pieceCaptured', (data) => {
      this.showCapture(data.pieceId);
    });
  }

  createBoard() {
    const boardSize = 600;
    const cellSize = boardSize / 15;
    const startX = (this.cameras.main.width - boardSize) / 2;
    const startY = 100;

    // Draw 15x15 grid
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        const posX = startX + x * cellSize;
        const posY = startY + y * cellSize;

        let color = 0x1e293b;

        // Home yards
        if (x < 6 && y < 6) color = 0x0891b2; // Cyan
        else if (x >= 9 && y < 6) color = 0xa21caf; // Magenta  
        else if (x >= 9 && y >= 9) color = 0x65a30d; // Lime
        else if (x < 6 && y >= 9) color = 0xca8a04; // Yellow
        else if (x >= 6 && x <= 8 && y >= 6 && y <= 8) color = 0xfbbf24; // Center

        this.add.rectangle(posX, posY, cellSize - 2, cellSize - 2, color);
      }
    }

    this.boardStartX = startX;
    this.boardStartY = startY;
    this.cellSize = cellSize;
  }

  showDiceRoll(value) {
    this.diceText.setText(value.toString());
    
    // Animate dice
    this.tweens.add({
      targets: this.diceButton,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 100,
      yoyo: true,
      repeat: 2
    });

    // Add particles
    const particles = this.add.particles(this.diceButton.x, this.diceButton.y, 'particle', {
      speed: { min: 100, max: 200 },
      scale: { start: 0.5, end: 0 },
      lifespan: 600,
      quantity: 10,
      tint: 0x22d3ee
    });

    this.time.delayedCall(600, () => particles.destroy());
  }

  animatePiece(pieceId, newPosition) {
    // Find piece sprite and animate to new position
    const piece = this.pieces.find(p => p.id === pieceId);
    if (!piece) return;

    const coords = this.getPositionCoords(newPosition, piece.color);
    const targetX = this.boardStartX + coords.x * this.cellSize;
    const targetY = this.boardStartY + coords.y * this.cellSize;

    this.tweens.add({
      targets: piece.sprite,
      x: targetX,
      y: targetY,
      duration: 300,
      ease: 'Power2'
    });
  }

  getPositionCoords(pos, color) {
    // Simplified - return center for now
    return { x: 7, y: 7 };
  }

  showCapture(pieceId) {
    console.log('Piece captured:', pieceId);
    // Add capture animation
  }

  updateGame(state) {
    // Update game state
    if (state.currentTurnIndex !== undefined) {
      this.turnText.setText(`Turn: Player ${state.currentTurnIndex + 1}`);
    }
  }
}

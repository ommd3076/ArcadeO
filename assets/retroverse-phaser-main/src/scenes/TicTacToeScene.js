export default class TicTacToeScene extends Phaser.Scene {
  constructor() {
    super('TicTacToeScene');
  }

  init(data) {
    this.socket = data.socket;
    this.isHost = data.isHost;
    this.cells = [];
  }

  create() {
    const { width, height } = this.cameras.main;

    this.add.rectangle(0, 0, width, height, 0x0d1729).setOrigin(0);

    this.add.text(width / 2, 30, 'TIC-TAC-TOE', {
      fontSize: '36px',
      color: '#a855f7',
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

    this.turnText = this.add.text(width / 2, height - 50, "X's turn", {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Socket listeners
    this.socket.on('gameStateUpdate', (state) => {
      this.updateGame(state);
    });

    this.socket.on('markPlaced', (data) => {
      this.placeMarkVisual(data.index, data.mark);
    });

    this.socket.on('gameOver', (data) => {
      this.showGameOver(data.winner);
    });
  }

  createBoard() {
    const cellSize = 120;
    const boardSize = cellSize * 3;
    const startX = (this.cameras.main.width - boardSize) / 2;
    const startY = 150;

    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;

      const x = startX + col * cellSize + cellSize / 2;
      const y = startY + row * cellSize + cellSize / 2;

      const cell = this.add.rectangle(x, y, cellSize - 4, cellSize - 4, 0x1e293b)
        .setInteractive({ useHandCursor: true });

      const text = this.add.text(x, y, '', {
        fontSize: '64px',
        color: '#ffffff'
      }).setOrigin(0.5);

      cell.on('pointerdown', () => {
        if (this.isHost) {
          this.socket.emit('placeMark', i);
        }
      });

      cell.on('pointerover', () => {
        cell.setFillStyle(0x334155);
      });

      cell.on('pointerout', () => {
        cell.setFillStyle(0x1e293b);
      });

      this.cells.push({ cell, text });
    }
  }

  placeMarkVisual(index, mark) {
    this.cells[index].text.setText(mark);
    this.cells[index].cell.disableInteractive();

    // Animate mark placement
    this.tweens.add({
      targets: this.cells[index].text,
      scale: { from: 0, to: 1 },
      duration: 200,
      ease: 'Back.easeOut'
    });
  }

  showGameOver(winner) {
    if (winner === 'DRAW') {
      this.turnText.setText('DRAW!');
    } else {
      this.turnText.setText(`${winner} WINS!`);
    }

    // Disable all cells
    this.cells.forEach(({ cell }) => cell.disableInteractive());
  }

  updateGame(state) {
    if (state.currentTurn) {
      this.turnText.setText(`${state.currentTurn}'s turn`);
    }
  }
}

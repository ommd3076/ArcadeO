export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super('LobbyScene');
  }

  init(data) {
    this.socket = data.socket;
    this.isHost = data.isHost;
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background
    this.add.rectangle(0, 0, width, height, 0x0d1729).setOrigin(0);

    // Title
    this.add.text(width / 2, 80, 'GAME LOBBY', {
      fontSize: '48px',
      fontFamily: 'Arial',
      color: '#22d3ee',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Game selection buttons
    const games = [
      { name: 'Ludo', scene: 'LudoScene', color: 0x22d3ee },
      { name: 'Snakes & Ladders', scene: 'SnakesScene', color: 0x10b981 },
      { name: 'Tic-Tac-Toe', scene: 'TicTacToeScene', color: 0xa855f7 }
    ];

    games.forEach((game, index) => {
      const btn = this.add.rectangle(
        width / 2,
        200 + index * 100,
        400,
        70,
        game.color
      ).setInteractive({ useHandCursor: true });

      const text = this.add.text(width / 2, 200 + index * 100, game.name, {
        fontSize: '32px',
        color: '#ffffff',
        fontFamily: 'Arial'
      }).setOrigin(0.5);

      btn.on('pointerdown', () => {
        if (this.isHost) {
          this.socket.emit('switchGame', game.scene);
        }
      });

      btn.on('pointerover', () => {
        btn.setFillStyle(game.color, 0.8);
      });

      btn.on('pointerout', () => {
        btn.setFillStyle(game.color, 1);
      });
    });

    // Players list
    this.playersText = this.add.text(width - 250, 100, 'Players:', {
      fontSize: '24px',
      color: '#ffffff'
    });

    // Listen for game switch
    this.socket.on('gameStarted', (data) => {
      this.scene.start(data.gameScene, {
        socket: this.socket,
        isHost: this.isHost,
        gameState: data.gameState
      });
    });

    // Update players list
    this.socket.on('playerJoined', (data) => {
      this.updatePlayersList(data.players);
    });
  }

  updatePlayersList(players) {
    const { width } = this.cameras.main;
    
    if (this.playersText) {
      this.playersText.destroy();
    }

    let text = 'Players:\n';
    players.forEach((player, i) => {
      text += `${i + 1}. ${player.name}\n`;
    });

    this.playersText = this.add.text(width - 250, 100, text, {
      fontSize: '20px',
      color: '#ffffff',
      lineSpacing: 10
    });
  }
}

import Phaser from 'phaser';
import { io } from 'socket.io-client';
import MenuScene from './scenes/MenuScene';
import LudoScene from './scenes/LudoScene';
import SnakesScene from './scenes/SnakesScene';
import TicTacToeScene from './scenes/TicTacToeScene';
import LobbyScene from './scenes/LobbyScene';

// Socket connection - works on Vercel!
const socket = io({
  path: '/api/socket',
  autoConnect: false
});

window.gameSocket = socket;

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game-container',
  backgroundColor: '#0d1729',
  scene: [MenuScene, LobbyScene, LudoScene, SnakesScene, TicTacToeScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  }
};

const game = new Phaser.Game(config);

// UI handlers
const menu = document.getElementById('menu');
const hostBtn = document.getElementById('hostBtn');
const joinBtn = document.getElementById('joinBtn');
const playerNameInput = document.getElementById('playerName');
const roomInput = document.getElementById('roomInput');
const withBotCheckbox = document.getElementById('withBot');

hostBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim() || 'Player';
  const withBot = withBotCheckbox.checked;
  
  socket.connect();
  
  socket.on('connect', () => {
    socket.emit('hostGame', { playerName, withBot });
    menu.classList.add('hidden');
    game.scene.start('LobbyScene', { socket, isHost: true });
  });
});

joinBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim() || 'Player';
  const roomCode = roomInput.value.trim();
  
  if (!roomCode) {
    alert('Please enter a room code');
    return;
  }
  
  socket.connect();
  
  socket.on('connect', () => {
    socket.emit('joinGame', { playerName, roomCode });
    menu.classList.add('hidden');
    game.scene.start('LobbyScene', { socket, isHost: false });
  });
});

// Update UI overlay
socket.on('roomCreated', (data) => {
  document.getElementById('room-code').textContent = `Room: ${data.roomCode}`;
  document.getElementById('ui-overlay').classList.remove('hidden');
});

socket.on('playerJoined', (data) => {
  document.getElementById('player-count').textContent = `Players: ${data.players.length}`;
});

socket.on('connectionStatus', (status) => {
  document.getElementById('connection-status').textContent = status;
});

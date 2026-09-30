const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const LudoEngine = require('./engines/ludo');
const SnakesEngine = require('./engines/snakes');
const TTTEngine = require('./engines/ttt');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('hostGame', ({ playerName, withBot }) => {
    const roomCode = generateRoomCode();
    
    const room = {
      code: roomCode,
      host: socket.id,
      players: [{
        id: socket.id,
        name: playerName,
        color: 'cyan',
        isReady: true
      }],
      currentGame: 'LUDO',
      ludoEngine: new LudoEngine(),
      snakesEngine: new SnakesEngine(),
      tttEngine: new TTTEngine(),
      withBot
    };

    if (withBot) {
      room.players.push({
        id: 'BOT',
        name: 'BOT',
        color: 'magenta',
        isReady: true
      });
    }

    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('roomCreated', { roomCode, players: room.players });
    
    // Initialize engines
    room.ludoEngine.initialize(room.players);
    room.snakesEngine.initialize(room.players);
    room.tttEngine.initialize();

    console.log(`Room ${roomCode} created by ${playerName}`);
  });

  socket.on('joinGame', ({ playerName, roomCode }) => {
    const room = rooms.get(roomCode.toUpperCase());
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.players.length >= 4) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    const colors = ['cyan', 'magenta', 'lime', 'yellow'];
    const usedColors = room.players.map(p => p.color);
    const availableColor = colors.find(c => !usedColors.includes(c)) || 'yellow';

    const player = {
      id: socket.id,
      name: playerName,
      color: availableColor,
      isReady: true
    };

    room.players.push(player);
    socket.join(roomCode);
    socket.roomCode = roomCode.toUpperCase();

    io.to(roomCode).emit('playerJoined', { players: room.players });
    
    console.log(`${playerName} joined room ${roomCode}`);
  });

  socket.on('switchGame', (gameScene) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id) return;

    room.currentGame = gameScene;
    
    let gameState = {};
    if (gameScene === 'LudoScene') {
      gameState = room.ludoEngine.getState();
    } else if (gameScene === 'SnakesScene') {
      gameState = room.snakesEngine.getState();
    } else if (gameScene === 'TicTacToeScene') {
      gameState = room.tttEngine.getState();
    }

    io.to(socket.roomCode).emit('gameStarted', { gameScene, gameState });
  });

  socket.on('rollDice', (game) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    if (game === 'LUDO') {
      const result = room.ludoEngine.rollDice();
      io.to(socket.roomCode).emit('diceRolled', { value: result });
      io.to(socket.roomCode).emit('gameStateUpdate', room.ludoEngine.getState());
    } else if (game === 'SNAKES') {
      const result = room.snakesEngine.rollDice();
      io.to(socket.roomCode).emit('diceRolled', { value: result.dice });
      
      if (result.playerMoved) {
        io.to(socket.roomCode).emit('playerMoved', result.playerMoved);
      }
      
      if (result.snakeHit) {
        io.to(socket.roomCode).emit('snakeHit', result.snakeHit);
      }
      
      if (result.ladderClimbed) {
        io.to(socket.roomCode).emit('ladderClimbed', result.ladderClimbed);
      }
      
      io.to(socket.roomCode).emit('gameStateUpdate', room.snakesEngine.getState());
    }
  });

  socket.on('placeMark', (index) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    const result = room.tttEngine.placeMark(index);
    
    if (result.success) {
      io.to(socket.roomCode).emit('markPlaced', { index, mark: result.mark });
      io.to(socket.roomCode).emit('gameStateUpdate', room.tttEngine.getState());
      
      if (result.gameOver) {
        io.to(socket.roomCode).emit('gameOver', { winner: result.winner });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    if (socket.roomCode) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        
        if (room.players.length === 0) {
          rooms.delete(socket.roomCode);
          console.log(`Room ${socket.roomCode} deleted`);
        } else {
          io.to(socket.roomCode).emit('playerJoined', { players: room.players });
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✨ Server running on port ${PORT}`);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const BOARD_SIZE = 15;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Room management
const rooms = new Map();

class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];
    this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    this.currentTurn = 0; // 0 for player 1 (black), 1 for player 2 (white)
    this.gameStarted = false;
    this.gameOver = false;
    this.winner = null;
  }

  addPlayer(socketId, playerName) {
    if (this.players.length >= 2) {
      return false;
    }
    this.players.push({
      socketId,
      playerName,
      ready: false,
      pieceColor: this.players.length === 0 ? 'black' : 'white'
    });
    return true;
  }

  removePlayer(socketId) {
    const index = this.players.findIndex(p => p.socketId === socketId);
    if (index !== -1) {
      this.players.splice(index, 1);
      return true;
    }
    return false;
  }

  setPlayerReady(socketId, ready) {
    const player = this.players.find(p => p.socketId === socketId);
    if (player) {
      player.ready = ready;
      return true;
    }
    return false;
  }

  canStartGame() {
    return this.players.length === 2 && this.players.every(p => p.ready);
  }

  startGame() {
    this.gameStarted = true;
    this.gameOver = false;
    this.currentTurn = 0;
    this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    this.winner = null;
  }

  resetGame() {
    this.gameStarted = false;
    this.gameOver = false;
    this.currentTurn = 0;
    this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    this.winner = null;
    this.players.forEach(p => p.ready = false);
  }

  makeMove(socketId, row, col) {
    // Validate it's the player's turn
    const playerIndex = this.players.findIndex(p => p.socketId === socketId);
    if (playerIndex !== this.currentTurn) {
      return { success: false, error: 'Not your turn' };
    }

    // Validate position
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
      return { success: false, error: 'Invalid position' };
    }

    // Check if position is empty
    if (this.board[row][col] !== null) {
      return { success: false, error: 'Position already occupied' };
    }

    // Place the piece
    const pieceColor = this.players[playerIndex].pieceColor;
    this.board[row][col] = pieceColor;

    // Check for win
    if (this.checkWin(row, col, pieceColor)) {
      this.gameOver = true;
      this.winner = pieceColor;
      return { success: true, gameOver: true, winner: pieceColor };
    }

    // Check for draw
    if (this.checkDraw()) {
      this.gameOver = true;
      return { success: true, gameOver: true, winner: 'draw' };
    }

    // Switch turn
    this.currentTurn = 1 - this.currentTurn;

    return { success: true };
  }

  checkWin(row, col, color) {
    const directions = [
      [[0, 1], [0, -1]],   // horizontal
      [[1, 0], [-1, 0]],   // vertical
      [[1, 1], [-1, -1]],  // diagonal \
      [[1, -1], [-1, 1]]   // diagonal /
    ];

    for (const [dir1, dir2] of directions) {
      let count = 1; // count the placed piece
      
      // Count in first direction
      count += this.countDirection(row, col, dir1[0], dir1[1], color);
      
      // Count in opposite direction
      count += this.countDirection(row, col, dir2[0], dir2[1], color);

      if (count >= 5) {
        return true;
      }
    }

    return false;
  }

  countDirection(row, col, dRow, dCol, color) {
    let count = 0;
    let r = row + dRow;
    let c = col + dCol;

    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && this.board[r][c] === color) {
      count++;
      r += dRow;
      c += dCol;
    }

    return count;
  }

  checkDraw() {
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (this.board[i][j] === null) {
          return false;
        }
      }
    }
    return true;
  }

  getState() {
    return {
      roomId: this.roomId,
      players: this.players.map(p => ({
        playerName: p.playerName,
        pieceColor: p.pieceColor,
        ready: p.ready
      })),
      board: this.board,
      currentTurn: this.currentTurn,
      gameStarted: this.gameStarted,
      gameOver: this.gameOver,
      winner: this.winner
    };
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', (data) => {
    const roomId = data.roomId || generateRoomId();
    const playerName = data.playerName || 'Player';

    if (rooms.has(roomId)) {
      socket.emit('error', { message: 'Room already exists' });
      return;
    }

    const room = new GameRoom(roomId);
    room.addPlayer(socket.id, playerName);
    rooms.set(roomId, room);

    socket.join(roomId);
    socket.emit('roomCreated', { roomId, playerColor: 'black' });
    io.to(roomId).emit('gameState', room.getState());

    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  socket.on('joinRoom', (data) => {
    const { roomId, playerName = 'Player' } = data;

    if (!rooms.has(roomId)) {
      socket.emit('error', { message: 'Room does not exist' });
      return;
    }

    const room = rooms.get(roomId);

    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    const success = room.addPlayer(socket.id, playerName);
    if (success) {
      socket.join(roomId);
      const playerColor = room.players.find(p => p.socketId === socket.id).pieceColor;
      socket.emit('roomJoined', { roomId, playerColor });
      io.to(roomId).emit('gameState', room.getState());
      console.log(`${socket.id} joined room ${roomId}`);
    } else {
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('playerReady', (data) => {
    const { roomId } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    room.setPlayerReady(socket.id, true);

    if (room.canStartGame()) {
      room.startGame();
      io.to(roomId).emit('gameStart');
    }

    io.to(roomId).emit('gameState', room.getState());
  });

  socket.on('makeMove', (data) => {
    const { roomId, row, col } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (!room.gameStarted || room.gameOver) {
      socket.emit('error', { message: 'Game not in progress' });
      return;
    }

    const result = room.makeMove(socket.id, row, col);

    if (result.success) {
      io.to(roomId).emit('moveMade', { row, col, color: room.board[row][col] });
      io.to(roomId).emit('gameState', room.getState());

      if (result.gameOver) {
        io.to(roomId).emit('gameOver', { winner: result.winner });
      }
    } else {
      socket.emit('error', { message: result.error });
    }
  });

  socket.on('resetGame', (data) => {
    const { roomId } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    room.resetGame();
    io.to(roomId).emit('gameReset');
    io.to(roomId).emit('gameState', room.getState());
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Find and remove player from any room
    for (const [roomId, room] of rooms.entries()) {
      if (room.removePlayer(socket.id)) {
        if (room.players.length === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        } else {
          room.resetGame();
          io.to(roomId).emit('playerLeft');
          io.to(roomId).emit('gameState', room.getState());
        }
        break;
      }
    }
  });
});

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

server.listen(PORT, () => {
  console.log(`Gomoku server running on http://localhost:${PORT}`);
});

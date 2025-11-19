const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const BOARD_SIZE = 15;
const DISCONNECT_TIMEOUT = 120000; // 2 minutes in milliseconds

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Game storage
const games = new Map();
const playerSockets = new Map(); // socketId -> gameId mapping
const waitingPlayers = []; // Queue for auto-matching

/**
 * Game state structure:
 * {
 *   id: string,
 *   players: [{ id: socketId, color: 'black'|'white', disconnectTimer: null }, ...],
 *   board: 2D array,
 *   currentTurn: 'black'|'white',
 *   status: 'waiting'|'playing'|'finished',
 *   winner: null|'black'|'white',
 *   winningLine: null|[{row, col}, ...],
 *   createdAt: timestamp
 * }
 */

/**
 * Create a new game
 */
function createGame(creatorSocketId) {
  const gameId = generateGameId();
  const game = {
    id: gameId,
    players: [
      { id: creatorSocketId, color: 'black', disconnectTimer: null }
    ],
    board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
    currentTurn: 'black',
    status: 'waiting',
    winner: null,
    winningLine: null,
    createdAt: Date.now()
  };
  games.set(gameId, game);
  playerSockets.set(creatorSocketId, gameId);
  return game;
}

/**
 * Join an existing game
 */
function joinGame(gameId, joinerSocketId) {
  const game = games.get(gameId);
  if (!game) {
    return { success: false, error: 'Game not found' };
  }
  if (game.status !== 'waiting') {
    return { success: false, error: 'Game already started or finished' };
  }
  if (game.players.length >= 2) {
    return { success: false, error: 'Game is full' };
  }
  
  game.players.push({ id: joinerSocketId, color: 'white', disconnectTimer: null });
  game.status = 'playing';
  playerSockets.set(joinerSocketId, gameId);
  
  return { success: true, game };
}

/**
 * Generate a unique game ID
 */
function generateGameId() {
  return Math.random().toString(36).substr(2, 9).toUpperCase();
}

/**
 * Validate move
 */
function isValidMove(game, row, col, playerId) {
  // Check if it's player's turn
  const player = game.players.find(p => p.id === playerId);
  if (!player || player.color !== game.currentTurn) {
    return { valid: false, error: 'Not your turn' };
  }
  
  // Check bounds
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return { valid: false, error: 'Move out of bounds' };
  }
  
  // Check if cell is empty
  if (game.board[row][col] !== null) {
    return { valid: false, error: 'Cell already occupied' };
  }
  
  return { valid: true };
}

/**
 * Make a move
 */
function makeMove(game, row, col, playerId) {
  const validation = isValidMove(game, row, col, playerId);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  const player = game.players.find(p => p.id === playerId);
  game.board[row][col] = player.color;
  
  // Check for win
  const winResult = checkWin(game.board, row, col, player.color);
  if (winResult.hasWin) {
    game.status = 'finished';
    game.winner = player.color;
    game.winningLine = winResult.line;
    return { success: true, gameOver: true, winner: player.color, winningLine: winResult.line };
  }
  
  // Check for draw (board full)
  if (isBoardFull(game.board)) {
    game.status = 'finished';
    return { success: true, gameOver: true, winner: 'draw' };
  }
  
  // Switch turn
  game.currentTurn = game.currentTurn === 'black' ? 'white' : 'black';
  
  return { success: true, gameOver: false };
}

/**
 * Check if a move creates five in a row
 */
function checkWin(board, row, col, color) {
  const directions = [
    { dr: 0, dc: 1 },  // horizontal
    { dr: 1, dc: 0 },  // vertical
    { dr: 1, dc: 1 },  // diagonal \
    { dr: 1, dc: -1 }  // diagonal /
  ];
  
  for (const { dr, dc } of directions) {
    const line = [];
    
    // Count in positive direction
    let r = row;
    let c = col;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === color) {
      line.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    
    // Count in negative direction (excluding center)
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === color) {
      line.unshift({ row: r, col: c });
      r -= dr;
      c -= dc;
    }
    
    if (line.length >= 5) {
      return { hasWin: true, line };
    }
  }
  
  return { hasWin: false };
}

/**
 * Check if board is full
 */
function isBoardFull(board) {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === null) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Get game state for a player
 */
function getGameState(game, playerId) {
  const player = game.players.find(p => p.id === playerId);
  const opponent = game.players.find(p => p.id !== playerId);
  
  return {
    gameId: game.id,
    board: game.board,
    currentTurn: game.currentTurn,
    status: game.status,
    yourColor: player ? player.color : null,
    opponentColor: opponent ? opponent.color : null,
    winner: game.winner,
    winningLine: game.winningLine,
    players: game.players.map(p => ({ color: p.color, connected: true }))
  };
}

/**
 * Handle player disconnect
 */
function handleDisconnect(socketId) {
  const gameId = playerSockets.get(socketId);
  if (!gameId) return;
  
  const game = games.get(gameId);
  if (!game) return;
  
  const player = game.players.find(p => p.id === socketId);
  if (!player) return;
  
  // If game is waiting or finished, just remove the game
  if (game.status === 'waiting' || game.status === 'finished') {
    games.delete(gameId);
    game.players.forEach(p => playerSockets.delete(p.id));
    return;
  }
  
  // Set disconnect timer for playing game
  player.disconnectTimer = setTimeout(() => {
    // End game if player doesn't reconnect
    game.status = 'finished';
    game.winner = player.color === 'black' ? 'white' : 'black';
    
    // Notify other player
    const otherPlayer = game.players.find(p => p.id !== socketId);
    if (otherPlayer) {
      io.to(otherPlayer.id).emit('game-over', {
        winner: game.winner,
        reason: 'opponent-disconnect'
      });
    }
    
    // Clean up
    games.delete(gameId);
    game.players.forEach(p => playerSockets.delete(p.id));
  }, DISCONNECT_TIMEOUT);
  
  // Notify other player about disconnect
  const otherPlayer = game.players.find(p => p.id !== socketId);
  if (otherPlayer) {
    io.to(otherPlayer.id).emit('player-disconnected', {
      color: player.color,
      timeout: DISCONNECT_TIMEOUT
    });
  }
}

/**
 * Socket.IO event handlers
 */
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Create a new game
  socket.on('create-game', () => {
    const game = createGame(socket.id);
    socket.emit('game-created', {
      gameId: game.id,
      state: getGameState(game, socket.id)
    });
    console.log('Game created:', game.id);
  });
  
  // Join a specific game by ID
  socket.on('join-game', (gameId) => {
    const result = joinGame(gameId, socket.id);
    if (result.success) {
      const game = result.game;
      
      // Notify both players
      game.players.forEach(player => {
        io.to(player.id).emit('game-started', {
          state: getGameState(game, player.id)
        });
      });
      
      console.log('Player joined game:', gameId);
    } else {
      socket.emit('error', { message: result.error });
    }
  });
  
  // Auto-match with a waiting player
  socket.on('auto-match', () => {
    if (waitingPlayers.length > 0) {
      // Match with first waiting player
      const waitingSocketId = waitingPlayers.shift();
      const gameId = playerSockets.get(waitingSocketId);
      
      if (gameId) {
        const result = joinGame(gameId, socket.id);
        if (result.success) {
          const game = result.game;
          
          // Notify both players
          game.players.forEach(player => {
            io.to(player.id).emit('game-started', {
              state: getGameState(game, player.id)
            });
          });
          
          console.log('Auto-matched game:', gameId);
        } else {
          // If join failed, create a new game for this player
          const game = createGame(socket.id);
          waitingPlayers.push(socket.id);
          socket.emit('waiting-for-opponent', {
            gameId: game.id
          });
        }
      } else {
        // Waiting player's game no longer exists, create new game
        const game = createGame(socket.id);
        waitingPlayers.push(socket.id);
        socket.emit('waiting-for-opponent', {
          gameId: game.id
        });
      }
    } else {
      // No waiting players, create a game and wait
      const game = createGame(socket.id);
      waitingPlayers.push(socket.id);
      socket.emit('waiting-for-opponent', {
        gameId: game.id
      });
      console.log('Player waiting for opponent:', game.id);
    }
  });
  
  // Make a move
  socket.on('move', ({ row, col }) => {
    const gameId = playerSockets.get(socket.id);
    if (!gameId) {
      socket.emit('error', { message: 'You are not in a game' });
      return;
    }
    
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    if (game.status !== 'playing') {
      socket.emit('error', { message: 'Game is not in progress' });
      return;
    }
    
    const result = makeMove(game, row, col, socket.id);
    if (result.success) {
      // Broadcast move to both players
      game.players.forEach(player => {
        io.to(player.id).emit('move-made', {
          row,
          col,
          color: game.board[row][col],
          currentTurn: game.currentTurn
        });
      });
      
      // If game over, send game-over event
      if (result.gameOver) {
        game.players.forEach(player => {
          io.to(player.id).emit('game-over', {
            winner: result.winner,
            winningLine: result.winningLine
          });
        });
        console.log('Game finished:', gameId, 'Winner:', result.winner);
      }
    } else {
      socket.emit('error', { message: result.error });
    }
  });
  
  // Leave game
  socket.on('leave-game', () => {
    handleDisconnect(socket.id);
    socket.emit('left-game');
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    // Remove from waiting queue
    const waitingIndex = waitingPlayers.indexOf(socket.id);
    if (waitingIndex > -1) {
      waitingPlayers.splice(waitingIndex, 1);
    }
    
    handleDisconnect(socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Gomoku server running on http://localhost:${PORT}`);
});

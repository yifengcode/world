// Socket.IO connection
const socket = io();

// Game configuration
const BOARD_SIZE = 15;
const CELL_SIZE = 40;
const STONE_RADIUS = 15;

// Game state
let gameState = {
  board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
  currentTurn: 'black',
  myColor: null,
  gameId: null,
  status: 'menu', // menu, waiting, playing, finished
  winner: null,
  winningLine: []
};

// DOM elements
const menuScreen = document.getElementById('menu-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over-screen');

const createGameBtn = document.getElementById('create-game-btn');
const autoMatchBtn = document.getElementById('auto-match-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const gameIdInput = document.getElementById('game-id-input');
const cancelWaitingBtn = document.getElementById('cancel-waiting-btn');
const leaveGameBtn = document.getElementById('leave-game-btn');
const playAgainBtn = document.getElementById('play-again-btn');

const waitingGameId = document.getElementById('waiting-game-id');
const turnIndicator = document.getElementById('turn-indicator');
const gameIdDisplay = document.getElementById('game-id-display');
const messageArea = document.getElementById('message-area');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverMessage = document.getElementById('game-over-message');

const playerBlack = document.getElementById('player-black');
const playerWhite = document.getElementById('player-white');

// Canvas
const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');

/**
 * Initialize the game
 */
function init() {
  // Set up event listeners
  createGameBtn.addEventListener('click', createGame);
  autoMatchBtn.addEventListener('click', autoMatch);
  joinGameBtn.addEventListener('click', joinGame);
  cancelWaitingBtn.addEventListener('click', cancelWaiting);
  leaveGameBtn.addEventListener('click', leaveGame);
  playAgainBtn.addEventListener('click', playAgain);
  canvas.addEventListener('click', handleCanvasClick);
  
  // Initialize canvas
  drawBoard();
  
  // Socket.IO event listeners
  setupSocketListeners();
}

/**
 * Set up Socket.IO event listeners
 */
function setupSocketListeners() {
  socket.on('game-created', (data) => {
    gameState.gameId = data.gameId;
    gameState.myColor = data.state.yourColor;
    gameState.status = 'waiting';
    
    showScreen('waiting');
    waitingGameId.textContent = data.gameId;
  });
  
  socket.on('waiting-for-opponent', (data) => {
    gameState.gameId = data.gameId;
    gameState.status = 'waiting';
    
    showScreen('waiting');
    waitingGameId.textContent = data.gameId;
  });
  
  socket.on('game-started', (data) => {
    gameState.status = 'playing';
    gameState.gameId = data.state.gameId;
    gameState.myColor = data.state.yourColor;
    gameState.board = data.state.board;
    gameState.currentTurn = data.state.currentTurn;
    
    showScreen('game');
    gameIdDisplay.textContent = `Game ID: ${gameState.gameId}`;
    updateBoard();
    updateTurnIndicator();
    showMessage(`Game started! You are ${gameState.myColor}.`, 'success');
  });
  
  socket.on('move-made', (data) => {
    gameState.board[data.row][data.col] = data.color;
    gameState.currentTurn = data.currentTurn;
    
    updateBoard();
    updateTurnIndicator();
    hideMessage();
  });
  
  socket.on('game-over', (data) => {
    gameState.status = 'finished';
    gameState.winner = data.winner;
    gameState.winningLine = data.winningLine || [];
    
    // Draw winning line if available
    if (data.winningLine && data.winningLine.length > 0) {
      drawWinningLine(data.winningLine);
    }
    
    // Show game over screen
    setTimeout(() => {
      showGameOver(data);
    }, 1000);
  });
  
  socket.on('player-disconnected', (data) => {
    showMessage(`${data.color} player disconnected. Waiting for reconnection...`, 'warning');
  });
  
  socket.on('left-game', () => {
    resetGame();
    showScreen('menu');
  });
  
  socket.on('error', (data) => {
    showMessage(data.message, 'error');
    console.error('Server error:', data.message);
  });
}

/**
 * Create a new game
 */
function createGame() {
  socket.emit('create-game');
}

/**
 * Auto match with another player
 */
function autoMatch() {
  socket.emit('auto-match');
}

/**
 * Join an existing game
 */
function joinGame() {
  const gameId = gameIdInput.value.trim().toUpperCase();
  if (!gameId) {
    alert('Please enter a game ID');
    return;
  }
  
  socket.emit('join-game', gameId);
  gameIdInput.value = '';
}

/**
 * Cancel waiting for opponent
 */
function cancelWaiting() {
  socket.emit('leave-game');
  resetGame();
  showScreen('menu');
}

/**
 * Leave current game
 */
function leaveGame() {
  if (confirm('Are you sure you want to leave the game?')) {
    socket.emit('leave-game');
    resetGame();
    showScreen('menu');
  }
}

/**
 * Play again
 */
function playAgain() {
  resetGame();
  showScreen('menu');
}

/**
 * Handle canvas click
 */
function handleCanvasClick(event) {
  if (gameState.status !== 'playing') return;
  if (gameState.currentTurn !== gameState.myColor) return;
  
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  
  // Calculate board position
  const col = Math.round(x / CELL_SIZE) - 1;
  const row = Math.round(y / CELL_SIZE) - 1;
  
  // Validate position
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return;
  }
  
  // Check if cell is empty
  if (gameState.board[row][col] !== null) {
    showMessage('Cell already occupied!', 'error');
    return;
  }
  
  // Send move to server
  socket.emit('move', { row, col });
}

/**
 * Draw the game board
 */
function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw background
  ctx.fillStyle = '#daa520';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw grid lines
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  
  for (let i = 0; i < BOARD_SIZE; i++) {
    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(CELL_SIZE + i * CELL_SIZE, CELL_SIZE);
    ctx.lineTo(CELL_SIZE + i * CELL_SIZE, CELL_SIZE * BOARD_SIZE);
    ctx.stroke();
    
    // Horizontal lines
    ctx.beginPath();
    ctx.moveTo(CELL_SIZE, CELL_SIZE + i * CELL_SIZE);
    ctx.lineTo(CELL_SIZE * BOARD_SIZE, CELL_SIZE + i * CELL_SIZE);
    ctx.stroke();
  }
  
  // Draw star points (optional decorative dots)
  const starPoints = [
    [3, 3], [3, 11], [7, 7], [11, 3], [11, 11]
  ];
  
  ctx.fillStyle = '#000';
  starPoints.forEach(([row, col]) => {
    ctx.beginPath();
    ctx.arc(CELL_SIZE + col * CELL_SIZE, CELL_SIZE + row * CELL_SIZE, 4, 0, 2 * Math.PI);
    ctx.fill();
  });
}

/**
 * Update board with stones
 */
function updateBoard() {
  drawBoard();
  
  // Draw stones
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const stone = gameState.board[row][col];
      if (stone) {
        drawStone(row, col, stone);
      }
    }
  }
}

/**
 * Draw a stone at position
 */
function drawStone(row, col, color) {
  const x = CELL_SIZE + col * CELL_SIZE;
  const y = CELL_SIZE + row * CELL_SIZE;
  
  ctx.save();
  
  // Draw shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  // Draw stone
  ctx.beginPath();
  ctx.arc(x, y, STONE_RADIUS, 0, 2 * Math.PI);
  ctx.fillStyle = color === 'black' ? '#000' : '#fff';
  ctx.fill();
  
  // Draw stone border
  if (color === 'white') {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * Draw winning line
 */
function drawWinningLine(line) {
  if (!line || line.length < 2) return;
  
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  
  ctx.beginPath();
  const firstPoint = line[0];
  ctx.moveTo(
    CELL_SIZE + firstPoint.col * CELL_SIZE,
    CELL_SIZE + firstPoint.row * CELL_SIZE
  );
  
  const lastPoint = line[line.length - 1];
  ctx.lineTo(
    CELL_SIZE + lastPoint.col * CELL_SIZE,
    CELL_SIZE + lastPoint.row * CELL_SIZE
  );
  
  ctx.stroke();
  ctx.restore();
}

/**
 * Update turn indicator
 */
function updateTurnIndicator() {
  turnIndicator.textContent = `${gameState.currentTurn === 'black' ? 'Black' : 'White'}'s Turn`;
  
  // Highlight active player
  playerBlack.classList.toggle('active', gameState.currentTurn === 'black');
  playerWhite.classList.toggle('active', gameState.currentTurn === 'white');
  
  // Update status indicators
  if (gameState.myColor === 'black') {
    document.getElementById('black-status').textContent = '(You)';
  } else if (gameState.myColor === 'white') {
    document.getElementById('white-status').textContent = '(You)';
  }
}

/**
 * Show message
 */
function showMessage(text, type = 'info') {
  messageArea.textContent = text;
  messageArea.className = 'message-area show';
  
  if (type === 'error') {
    messageArea.style.background = '#f8d7da';
    messageArea.style.borderColor = '#dc3545';
    messageArea.style.color = '#721c24';
  } else if (type === 'success') {
    messageArea.style.background = '#d4edda';
    messageArea.style.borderColor = '#28a745';
    messageArea.style.color = '#155724';
  } else if (type === 'warning') {
    messageArea.style.background = '#fff3cd';
    messageArea.style.borderColor = '#ffc107';
    messageArea.style.color = '#856404';
  }
  
  // Auto-hide after 5 seconds for non-error messages
  if (type !== 'error') {
    setTimeout(hideMessage, 5000);
  }
}

/**
 * Hide message
 */
function hideMessage() {
  messageArea.classList.remove('show');
}

/**
 * Show game over screen
 */
function showGameOver(data) {
  if (data.winner === 'draw') {
    gameOverTitle.textContent = "It's a Draw!";
    gameOverMessage.textContent = 'The board is full with no winner.';
  } else if (data.reason === 'opponent-disconnect') {
    gameOverTitle.textContent = 'You Win!';
    gameOverMessage.textContent = 'Your opponent disconnected.';
  } else {
    const didIWin = data.winner === gameState.myColor;
    gameOverTitle.textContent = didIWin ? 'You Win! 🎉' : 'You Lose';
    gameOverMessage.textContent = `${data.winner === 'black' ? 'Black' : 'White'} wins with five in a row!`;
  }
  
  showScreen('game-over');
}

/**
 * Show a specific screen
 */
function showScreen(screenName) {
  menuScreen.classList.remove('active');
  waitingScreen.classList.remove('active');
  gameScreen.classList.remove('active');
  gameOverScreen.classList.remove('active');
  
  switch (screenName) {
    case 'menu':
      menuScreen.classList.add('active');
      break;
    case 'waiting':
      waitingScreen.classList.add('active');
      break;
    case 'game':
      gameScreen.classList.add('active');
      break;
    case 'game-over':
      gameOverScreen.classList.add('active');
      break;
  }
}

/**
 * Reset game state
 */
function resetGame() {
  gameState = {
    board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
    currentTurn: 'black',
    myColor: null,
    gameId: null,
    status: 'menu',
    winner: null,
    winningLine: []
  };
  
  drawBoard();
  hideMessage();
}

// Initialize the game when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

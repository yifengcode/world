// Socket.io connection
const socket = io();

// Game state
let currentRoom = null;
let myColor = null;
let gameState = null;

// DOM elements
const menu = document.getElementById('menu');
const waitingRoom = document.getElementById('waitingRoom');
const gameArea = document.getElementById('gameArea');
const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');

// Constants
const BOARD_SIZE = 15;
const CELL_SIZE = canvas.width / BOARD_SIZE;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    drawBoard();
});

function setupEventListeners() {
    // Menu buttons
    document.getElementById('createRoomBtn').addEventListener('click', createRoom);
    document.getElementById('joinRoomBtn').addEventListener('click', joinRoom);
    
    // Waiting room buttons
    document.getElementById('readyBtn').addEventListener('click', playerReady);
    document.getElementById('leaveRoomBtn').addEventListener('click', leaveRoom);
    
    // Game buttons
    document.getElementById('resetBtn').addEventListener('click', resetGame);
    document.getElementById('exitBtn').addEventListener('click', leaveRoom);
    
    // Canvas click
    canvas.addEventListener('click', handleCanvasClick);
    
    // Socket events
    socket.on('roomCreated', handleRoomCreated);
    socket.on('roomJoined', handleRoomJoined);
    socket.on('gameState', handleGameState);
    socket.on('gameStart', handleGameStart);
    socket.on('moveMade', handleMoveMade);
    socket.on('gameOver', handleGameOver);
    socket.on('gameReset', handleGameReset);
    socket.on('playerLeft', handlePlayerLeft);
    socket.on('error', handleError);
}

function createRoom() {
    const playerName = document.getElementById('playerName').value.trim() || 'Player';
    socket.emit('createRoom', { playerName });
}

function joinRoom() {
    const roomId = document.getElementById('roomIdInput').value.trim().toUpperCase();
    const playerName = document.getElementById('playerName').value.trim() || 'Player';
    
    if (!roomId) {
        showMessage('Please enter a room ID', 'error');
        return;
    }
    
    socket.emit('joinRoom', { roomId, playerName });
}

function playerReady() {
    if (!currentRoom) return;
    socket.emit('playerReady', { roomId: currentRoom });
    document.getElementById('readyBtn').disabled = true;
}

function leaveRoom() {
    location.reload();
}

function resetGame() {
    if (!currentRoom) return;
    socket.emit('resetGame', { roomId: currentRoom });
}

function handleRoomCreated(data) {
    currentRoom = data.roomId;
    myColor = data.playerColor;
    showWaitingRoom();
    document.getElementById('currentRoomId').textContent = data.roomId;
    document.getElementById('yourColor').textContent = data.playerColor;
    showMessage(`Room created! ID: ${data.roomId}`, 'success');
}

function handleRoomJoined(data) {
    currentRoom = data.roomId;
    myColor = data.playerColor;
    showWaitingRoom();
    document.getElementById('currentRoomId').textContent = data.roomId;
    document.getElementById('yourColor').textContent = data.playerColor;
    showMessage('Joined room successfully!', 'success');
}

function handleGameState(state) {
    gameState = state;
    
    if (state.gameStarted) {
        updateGameInfo(state);
    } else {
        updatePlayersList(state);
    }
}

function handleGameStart() {
    showGameArea();
    showMessage('Game started!', 'success');
    drawBoard();
}

function handleMoveMade(data) {
    // Move will be reflected in gameState update
    drawBoard();
}

function handleGameOver(data) {
    let message = '';
    if (data.winner === 'draw') {
        message = 'Game Over - Draw!';
    } else if (data.winner === myColor) {
        message = 'You Win! 🎉';
    } else {
        message = 'You Lose!';
    }
    
    document.getElementById('gameStatus').textContent = message;
    showMessage(message, 'info');
}

function handleGameReset() {
    showWaitingRoom();
    document.getElementById('readyBtn').disabled = false;
    drawBoard();
    showMessage('Game reset', 'info');
}

function handlePlayerLeft() {
    showMessage('Opponent left the room', 'info');
    document.getElementById('readyBtn').disabled = false;
}

function handleError(data) {
    showMessage(data.message, 'error');
}

function showWaitingRoom() {
    menu.style.display = 'none';
    waitingRoom.style.display = 'block';
    gameArea.style.display = 'none';
}

function showGameArea() {
    menu.style.display = 'none';
    waitingRoom.style.display = 'none';
    gameArea.style.display = 'block';
    document.getElementById('gameRoomId').textContent = currentRoom;
}

function updatePlayersList(state) {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '<h3>Players:</h3>';
    
    state.players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item' + (player.ready ? ' player-ready' : '');
        div.innerHTML = `
            <span>${player.playerName} (${player.pieceColor})</span>
            <span>${player.ready ? '✓ Ready' : 'Not Ready'}</span>
        `;
        playersList.appendChild(div);
    });
    
    // Add waiting message if only one player
    if (state.players.length < 2) {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = '<span>Waiting for opponent...</span>';
        playersList.appendChild(div);
    }
}

function updateGameInfo(state) {
    const currentPlayer = state.players[state.currentTurn];
    const turnColor = currentPlayer ? currentPlayer.pieceColor : '';
    
    document.getElementById('currentTurnColor').textContent = turnColor;
    document.getElementById('currentTurnColor').style.color = turnColor === 'black' ? '#000' : '#fff';
    document.getElementById('currentTurnColor').style.textShadow = turnColor === 'white' ? '1px 1px 2px #000' : 'none';
    
    const isMyTurn = turnColor === myColor;
    document.getElementById('gameStatus').textContent = isMyTurn ? 'Your turn!' : "Opponent's turn";
}

function handleCanvasClick(event) {
    if (!gameState || !gameState.gameStarted || gameState.gameOver) {
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);
    
    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
        socket.emit('makeMove', { roomId: currentRoom, row, col });
    }
}

function drawBoard() {
    // Clear canvas
    ctx.fillStyle = '#daa520';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < BOARD_SIZE; i++) {
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(CELL_SIZE * (i + 0.5), CELL_SIZE * 0.5);
        ctx.lineTo(CELL_SIZE * (i + 0.5), canvas.height - CELL_SIZE * 0.5);
        ctx.stroke();
        
        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(CELL_SIZE * 0.5, CELL_SIZE * (i + 0.5));
        ctx.lineTo(canvas.width - CELL_SIZE * 0.5, CELL_SIZE * (i + 0.5));
        ctx.stroke();
    }
    
    // Draw star points (5 points for a 15x15 board)
    const starPoints = [
        [3, 3], [3, 11], [7, 7], [11, 3], [11, 11]
    ];
    
    ctx.fillStyle = '#000';
    starPoints.forEach(([row, col]) => {
        ctx.beginPath();
        ctx.arc(
            CELL_SIZE * (col + 0.5),
            CELL_SIZE * (row + 0.5),
            3,
            0,
            Math.PI * 2
        );
        ctx.fill();
    });
    
    // Draw pieces if game state exists
    if (gameState && gameState.board) {
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = gameState.board[row][col];
                if (piece) {
                    drawPiece(row, col, piece);
                }
            }
        }
    }
}

function drawPiece(row, col, color) {
    const x = CELL_SIZE * (col + 0.5);
    const y = CELL_SIZE * (row + 0.5);
    const radius = CELL_SIZE * 0.4;
    
    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw piece
    ctx.fillStyle = color === 'black' ? '#000' : '#fff';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw border
    ctx.strokeStyle = color === 'black' ? '#333' : '#ccc';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function showMessage(text, type = 'info') {
    const messageArea = document.getElementById('messageArea');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    
    messageArea.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.opacity = '0';
        messageDiv.style.transition = 'opacity 0.3s';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

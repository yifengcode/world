# Gomoku (五子棋) - Multiplayer Web Game

A real-time multiplayer implementation of Gomoku (also known as Five in a Row or Gobang) built with Node.js, Express, and Socket.IO.

## 🎮 About the Game

Gomoku is a classic strategy board game played on a 15×15 grid. Two players take turns placing black and white stones on the board. The first player to get exactly five stones in a row (horizontally, vertically, or diagonally) wins the game!

## ✨ Features

- **Real-time Multiplayer**: Play against other players in real-time using WebSockets (Socket.IO)
- **Multiple Game Modes**:
  - Create a new game and share the Game ID with a friend
  - Auto-match with a waiting player
  - Join an existing game by entering a Game ID
- **Server-Authoritative Game Logic**: All game rules enforced on the server
- **Move Validation**: Prevents illegal moves (occupied cells, out-of-turn moves)
- **Win Detection**: Automatically detects five-in-a-row in any direction
- **Reconnection Support**: Players can reconnect within 2 minutes if disconnected
- **Clean UI**: Responsive design that works on desktop and mobile browsers

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm (comes with Node.js)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yifengcode/world.git
cd world
```

2. Install dependencies:
```bash
npm install
```

### Running the Game

Start the server:
```bash
npm start
```

Or for development with auto-restart on file changes:
```bash
npm run dev
```

The server will start on `http://localhost:3000` by default.

## 🎯 How to Play

### Starting a Game

1. Open your browser and navigate to `http://localhost:3000`
2. Choose one of three options:
   - **Create New Game**: Start a new game and share the generated Game ID with a friend
   - **Auto Match**: Automatically pair with another waiting player
   - **Join Game**: Enter a Game ID to join an existing game

### Playing

1. Black always goes first
2. Click on any empty intersection on the board to place your stone
3. Players alternate turns
4. The first player to get five stones in a row (horizontally, vertically, or diagonally) wins
5. If the board fills up with no winner, the game is a draw

### Game Controls

- **Leave Game**: Exit the current game (your opponent will be notified)
- **Play Again**: Return to the main menu after a game ends

## 🧪 Manual Testing

To test the multiplayer functionality locally:

1. Start the server with `npm start`
2. Open two browser windows/tabs:
   - Window 1: Navigate to `http://localhost:3000`
   - Window 2: Navigate to `http://localhost:3000`
3. In Window 1: Click "Create New Game"
4. Copy the Game ID displayed
5. In Window 2: Enter the Game ID and click "Join Game"
6. Play the game by alternating clicks between the two windows

### Test Scenarios

- **Valid Move**: Click on an empty cell during your turn → Stone should be placed
- **Invalid Move (Occupied Cell)**: Click on a cell with a stone → Error message appears
- **Invalid Move (Wrong Turn)**: Try to move when it's not your turn → No action taken
- **Win Condition**: Create five in a row → Game over screen with winner announcement
- **Disconnect**: Close one browser window → Other player notified of disconnect
- **Auto-Match**: Use "Auto Match" in both windows → Players should be paired automatically

## 📁 Project Structure

```
.
├── server.js              # Express + Socket.IO server, game logic
├── package.json           # Dependencies and scripts
├── public/
│   ├── index.html        # Single-page frontend
│   ├── style.css         # Styles for board and UI
│   └── main.js           # Client-side game logic and Socket.IO client
└── README.md             # This file
```

## 🔧 Configuration

You can customize the following settings:

### Server Configuration (server.js)

- `PORT`: Server port (default: 3000, can be set via environment variable)
- `BOARD_SIZE`: Board dimensions (default: 15×15)
- `DISCONNECT_TIMEOUT`: Grace period for reconnection (default: 120000ms / 2 minutes)

### Client Configuration (public/main.js)

- `BOARD_SIZE`: Board dimensions (must match server)
- `CELL_SIZE`: Size of each board cell in pixels (default: 40)
- `STONE_RADIUS`: Radius of game stones (default: 15)

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.IO
- **Frontend**: Vanilla JavaScript, HTML5 Canvas, CSS3
- **No build step required**: Uses plain JavaScript for simplicity

## 📋 Socket.IO Events

### Client → Server

- `create-game`: Create a new game
- `join-game(gameId)`: Join a specific game
- `auto-match`: Find and join a waiting game
- `move({row, col})`: Make a move
- `leave-game`: Leave the current game

### Server → Client

- `game-created({gameId, state})`: Game created successfully
- `waiting-for-opponent({gameId})`: Waiting for second player
- `game-started({state})`: Game has started
- `move-made({row, col, color, currentTurn})`: Move was made
- `game-over({winner, winningLine})`: Game ended
- `player-disconnected({color, timeout})`: Opponent disconnected
- `error({message})`: Error occurred

## 🐛 Known Limitations

- No game history or replay functionality
- No chat feature between players
- No ranking or matchmaking system
- No persistent storage (games are lost on server restart)
- Maximum 2 players per game

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

---

Built with ❤️ using Node.js, Express, and Socket.IO

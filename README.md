# Gomoku Multiplayer Game

A real-time multiplayer web-based Gomoku (Five in a Row / 五子棋) game built with Node.js, Express, and Socket.io.

## Features

- **Real-time multiplayer**: Two players can compete in real-time
- **Room system**: Create or join game rooms with custom or random room IDs
- **15x15 game board**: Traditional Gomoku board size
- **Win detection**: Automatic detection of 5-in-a-row (horizontal, vertical, diagonal)
- **Draw detection**: Game ends when the board is full with no winner
- **Player ready system**: Both players must ready up before the game starts
- **Turn-based gameplay**: Players alternate turns with visual indicators
- **Responsive design**: Works on desktop and mobile devices

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yifengcode/world.git
cd world
```

2. Install dependencies:
```bash
npm install
```

## Running the Game

### Production Mode
```bash
npm start
```

### Development Mode (with auto-restart)
```bash
npm run dev
```

The server will start on **port 3000** by default. Open your browser and navigate to:
```
http://localhost:3000
```

To use a different port, set the `PORT` environment variable:
```bash
PORT=8080 npm start
```

## How to Play

### Creating a Room

1. Enter your player name (optional)
2. Click **"Create Room"**
3. Share the generated Room ID with another player
4. Wait for the opponent to join
5. Click **"Ready"** when both players are in the room
6. The game starts automatically when both players are ready

### Joining a Room

1. Enter your player name (optional)
2. Enter the Room ID provided by the room creator
3. Click **"Join Room"**
4. Click **"Ready"** when you're ready to play
5. The game starts automatically when both players are ready

### Gameplay

- The first player (creator) plays with **black** pieces
- The second player plays with **white** pieces
- Click on any empty intersection on the board to place your piece
- Players alternate turns
- First player to get **5 pieces in a row** (horizontal, vertical, or diagonal) wins
- If the board fills up with no winner, the game ends in a draw

### Game Controls

- **Reset Game**: Starts a new game (both players return to ready state)
- **Exit Room**: Leaves the current room and returns to the main menu

## Project Structure

```
world/
├── server/
│   └── index.js          # Backend server with Socket.io and game logic
├── public/
│   ├── index.html        # Main HTML page
│   ├── style.css         # Styles
│   └── client.js         # Frontend JavaScript and Socket.io client
├── package.json          # Project configuration and dependencies
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## Technology Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: HTML5, CSS3, Vanilla JavaScript, Socket.io Client
- **Game Logic**: Custom implementation with win detection algorithm

## Game Rules

Gomoku (五子棋) is a traditional abstract strategy board game:

1. Two players alternate turns placing pieces on empty intersections
2. Black plays first
3. The winner is the first player to form an unbroken chain of five pieces horizontally, vertically, or diagonally
4. If the board is filled with no winner, the game is a draw

## License

ISC

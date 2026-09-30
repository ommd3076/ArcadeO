# 🎮 Retroverse - Multiplayer Board Games

**Play classic board games with friends online!** Built with Phaser 3 + Socket.io.

## 🎯 Games

- **🎲 Ludo** - Roll dice, move pieces, capture opponents
- **🐍 Snakes & Ladders** - Climb ladders, avoid snakes, reach 100
- **❌ Tic-Tac-Toe** - Get 3 in a row

## ✨ Features

✅ Real-time multiplayer
✅ Play with AI bot
✅ Smooth animations & particle effects
✅ Room-based matchmaking
✅ Up to 4 players
✅ Mobile-friendly

## 🚀 Deploy to Vercel (ONE CLICK)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/johnicjio/retroverse-phaser)

**That's it!** Everything (frontend + backend) deploys to Vercel.

### Manual Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## 🎮 How to Play

1. Visit your Vercel URL
2. Enter your name
3. Click "Host Game" (you get a room code)
4. Share room code with friends
5. They enter code and click "Join"
6. Select a game and play!

## 🛠️ Run Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:3000
```

**Note:** Multiplayer works locally too! Open multiple browser tabs.

## 🎮 Game Rules

### Ludo

- Roll 6 to exit yard
- Land on opponent = capture (they go back)
- Roll 6 or capture = bonus turn
- Get all 4 pieces home to win

### Snakes & Ladders

- Roll dice to move forward
- Land on ladder = climb up 🎉
- Land on snake = slide down 😢
- Exact roll to reach 100

### Tic-Tac-Toe

- X goes first
- Click empty cell to place mark
- Get 3 in a row to win

## 🛠️ Tech Stack

- **Frontend**: Phaser 3 (game engine) + Vite
- **Backend**: Socket.io (runs on Vercel Serverless)
- **Deploy**: Vercel (everything in one place)

## 📁 Project Structure

```
src/
├── main.js           # Entry point + socket setup
├── scenes/
│   ├── LobbyScene.js # Game selection
│   ├── LudoScene.js  # Ludo board + UI
│   ├── SnakesScene.js # Snakes board + UI
│   └── TicTacToeScene.js # TTT board + UI

api/
└── socket.js         # Socket.io serverless function

server/engines/
├── ludo.js           # Ludo game logic
├── snakes.js         # Snakes game logic
└── ttt.js            # TTT game logic
```

## 🎨 Customization

### Change Colors

Edit `index.html` CSS gradients and Phaser scene colors.

### Add Sounds

1. Add `.mp3` files to `public/sounds/`
2. Load in Phaser: `this.load.audio('dice', 'sounds/dice.mp3')`
3. Play: `this.sound.play('dice')`

## 🐛 Troubleshooting

**"Cannot connect to server"**
- Vercel serverless functions take 5-10 seconds to cold start
- Refresh the page and try again

**"Room not found"**
- Room codes are case-sensitive
- Rooms expire when all players leave

## 📝 License

MIT - Free to use and modify!

## 🤝 Contributing

Pull requests welcome! Ideas:
- Add sound effects
- Improve AI bot
- Add particle effects on captures
- Add chat feature
- Mobile touch controls
- More games (Chess, Checkers, etc.)

---

Built with ❤️ using Phaser 3

# Briefly — NLP Summarizer

A streaming text and video summarizer powered by **Groq AI** (free tier, no credit card).  
Uses `llama-3.3-70b-versatile` — a large, capable open-source model served at high speed.

---

## Project Structure

```
briefly/
├── index.html          # App markup
├── css/styles.css      # All styles (light + dark mode)
├── js/app.js           # Frontend — calls /api/summarize
├── server.js           # Express backend — proxies requests to Groq
├── package.json
├── .env.example        # Copy to .env and add your key
├── .gitignore          # Keeps .env and node_modules/ out of git
└── README.md
```

---

## Get a Free Groq API Key (30 seconds)

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up — no credit card needed
3. Click **API Keys** → **Create API Key**
4. Copy the key — you'll need it in the next step

---

## Run Locally (5 steps)

**1. Clone or download the project**
```bash
git clone https://github.com/YOUR_USERNAME/briefly.git
cd briefly
```

**2. Install dependencies**
```bash
npm install
```

**3. Create your `.env` file**
```bash
cp .env.example .env
```
Open `.env` and paste your key:
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
```

**4. Start the server**
```bash
npm start
```

**5. Open the app**

Visit [http://localhost:3000](http://localhost:3000)

> To stop: press `Ctrl + C` in the terminal.

---

## Deploy to Railway (free, live on the internet)

1. Push your repo to GitHub (make sure `.env` is NOT committed — `.gitignore` handles this)
2. Go to [railway.app](https://railway.app) → sign in with GitHub
3. **New Project** → **Deploy from GitHub repo** → select `briefly`
4. Click your service → **Variables** tab → **New Variable**
   - Name: `GROQ_API_KEY`
   - Value: your key from [console.groq.com](https://console.groq.com)
5. Railway redeploys automatically — your public URL appears in the dashboard

---

## How It Works

```
Browser               server.js (Express)          Groq API (free)
   │                        │                            │
   │─ POST /api/summarize ─>│                            │
   │  { prompt: "..." }     │─ stream chat completion ──>│
   │                        │<─ SSE text deltas ─────────│
   │<─ SSE text deltas ─────│                            │
   │  (renders live in UI)  │                            │
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ERROR: GROQ_API_KEY is not set` | `.env` file is missing or key is misspelled |
| `Cannot find module 'groq-sdk'` | Run `npm install` |
| Port 3000 in use | Add `PORT=3001` to `.env`, visit `localhost:3001` |
| Summarize button fails silently | Open browser DevTools → Console for the error |

---

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Backend  | Node.js, Express, dotenv |
| AI       | [Groq](https://groq.com) — `llama-3.3-70b-versatile` (free tier) |
| Fonts    | DM Serif Display, Sora, DM Mono (Google Fonts) |

---

## License

MIT

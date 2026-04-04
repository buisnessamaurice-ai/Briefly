# Briefly — NLP Summarizer

A streaming text and video summarizer powered by the Claude AI API.
The API key lives securely on the backend — never exposed to the browser.

---

## Features

- **Text summarization** — paste any article, transcript, report, or meeting notes
- **Video file upload** — drag-and-drop support (audio transcription ready for extension)
- **6 summary styles** — concise recap, bullet points, detailed, ELI5, executive briefing, key takeaways
- **4 length options** — short to comprehensive
- **Live streaming** — output streams token-by-token as the model responds
- **Dark mode** — automatic via `prefers-color-scheme`

---

## Project Structure

```
briefly/
├── index.html          # App markup
├── css/
│   └── styles.css      # All styles (light + dark mode)
├── js/
│   └── app.js          # Frontend logic — calls /api/summarize
├── server.js           # Express backend — holds the API key, proxies to Anthropic
├── package.json
├── .env.example        # Copy to .env and add your key
├── .gitignore          # Ignores node_modules/ and .env
└── README.md
```

---

## Quick Start (3 steps)

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/briefly.git
cd briefly
npm install
```

### 2. Add your API key

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder:

```
ANTHROPIC_API_KEY=sk-ant-...your-real-key-here...
```

Get a key at [console.anthropic.com](https://console.anthropic.com).

### 3. Start the server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) — that's it.

> **For development** use `npm run dev` to auto-restart on file changes (requires Node 18+).

---

## How It Works

```
Browser                    Express server (server.js)        Anthropic API
  │                                │                               │
  │── POST /api/summarize ────────>│                               │
  │   { prompt: "..." }            │── stream messages ──────────>│
  │                                │<── SSE text deltas ──────────│
  │<── SSE text deltas ────────────│                               │
  │  (renders live in UI)          │                               │
```

1. The frontend sends the prompt to `/api/summarize` on the local Express server
2. The server calls the Anthropic API using the key stored in `.env`
3. Streamed tokens are forwarded to the browser as Server-Sent Events (SSE)
4. The frontend appends each delta to the result in real time

---

## Deploying to Production

Any Node-hosting platform works. Here are the two easiest options:

### Railway (recommended — free tier available)

1. Push your repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add `ANTHROPIC_API_KEY` in **Variables**
4. Railway auto-detects `npm start` — done

### Render

1. New Web Service → connect your GitHub repo
2. Build command: `npm install`
3. Start command: `npm start`
4. Add `ANTHROPIC_API_KEY` in **Environment**

---

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Backend  | Node.js + Express |
| AI       | [Anthropic Claude API](https://docs.anthropic.com) (`claude-sonnet-4-20250514`) |
| Fonts    | DM Serif Display, Sora, DM Mono (Google Fonts) |

---

## License

MIT

import 'dotenv/config';
import express from 'express';
import Groq from 'groq-sdk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app  = express();
const port = process.env.PORT || 3000;

// ── Validate API key on startup ─────────────────────────────────────────────
if (!process.env.GROQ_API_KEY) {
  console.error('ERROR: GROQ_API_KEY is not set.');
  console.error('  1. Sign up free at https://console.groq.com');
  console.error('  2. Go to API Keys → Create API Key');
  console.error('  3. Paste it into your .env file as GROQ_API_KEY=...');
  process.exit(1);
}

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

// ── Groq client ─────────────────────────────────────────────────────────────
const groq = new Groq();  // auto-reads GROQ_API_KEY from process.env

// ── POST /api/summarize  (streaming) ────────────────────────────────────────
app.post('/api/summarize', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "prompt" field.' });
  }

  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  try {
    const stream = await groq.chat.completions.create({
      model:    'llama-3.3-70b-versatile',   // best free model on Groq
      messages: [{ role: 'user', content: prompt }],
      stream:   true,
      max_tokens: 1000,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('Groq API error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`✦ Briefly running at http://localhost:${port}`);
});

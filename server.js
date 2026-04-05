import 'dotenv/config';
import express from 'express';
import Groq from 'groq-sdk';
import multer from 'multer';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { YoutubeTranscript } from 'youtube-transcript';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app    = express();
const port   = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Validate API key ─────────────────────────────────────────────────────────
if (!process.env.GROQ_API_KEY) {
  console.error('ERROR: GROQ_API_KEY is not set. See README.');
  process.exit(1);
}

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '4mb' }));
app.use(express.static(__dirname));

const groq = new Groq();

// ── SSE stream helper ────────────────────────────────────────────────────────
function sseHeaders(res) {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();
}

async function streamGroq(messages, res) {
  const stream = await groq.chat.completions.create({
    model:      'llama-3.3-70b-versatile',
    messages,
    stream:     true,
    max_tokens: 1000,
  });
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
}

// ── POST /api/summarize ──────────────────────────────────────────────────────
app.post('/api/summarize', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt.' });
  sseHeaders(res);
  try {
    await streamGroq([{ role: 'user', content: prompt }], res);
  } catch (err) {
    console.error('Summarize error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── POST /api/qa ─────────────────────────────────────────────────────────────
app.post('/api/qa', async (req, res) => {
  const { context, history } = req.body;
  if (!context || !history) return res.status(400).json({ error: 'Missing context or history.' });
  sseHeaders(res);
  try {
    const messages = [
      { role: 'system', content: context },
      ...history,
    ];
    await streamGroq(messages, res);
  } catch (err) {
    console.error('Q&A error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── POST /api/youtube ────────────────────────────────────────────────────────
app.post('/api/youtube', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing URL.' });
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    const text = transcript.map(t => t.text).join(' ');
    if (!text) return res.status(422).json({ error: 'No transcript found. The video may have captions disabled.' });
    res.json({ transcript: text });
  } catch (err) {
    console.error('YouTube error:', err.message);
    res.status(500).json({ error: 'Could not fetch transcript: ' + err.message });
  }
});

// ── POST /api/pdf ─────────────────────────────────────────────────────────────
app.post('/api/pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  try {
    const data = await pdfParse(req.file.buffer);
    const text = data.text.trim();
    if (!text) return res.status(422).json({ error: 'Could not extract text. The PDF may be scanned/image-based.' });
    res.json({ text });
  } catch (err) {
    console.error('PDF error:', err.message);
    res.status(500).json({ error: 'PDF parsing failed: ' + err.message });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`✦ Briefly running at http://localhost:${port}`);
});

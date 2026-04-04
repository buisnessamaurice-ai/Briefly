import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app  = express();
const port = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));          // serves index.html, css/, js/

// ── Anthropic client (reads ANTHROPIC_API_KEY from environment) ─────────────
const anthropic = new Anthropic();           // auto-reads process.env.ANTHROPIC_API_KEY

// ── POST /api/summarize  (streaming) ────────────────────────────────────────
app.post('/api/summarize', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "prompt" field.' });
  }

  // Set SSE headers so the browser can read the stream
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  try {
    const stream = anthropic.messages.stream({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages:   [{ role: 'user', content: prompt }],
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta?.type === 'text_delta'
      ) {
        // Forward each text delta as an SSE event
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('Anthropic API error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`✦ Briefly running at http://localhost:${port}`);
});

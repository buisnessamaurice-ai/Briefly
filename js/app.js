/**
 * Briefly — NLP Summarizer
 * Calls the Anthropic API (claude-sonnet-4-20250514) with streaming.
 *
 * ⚠️  IMPORTANT: This app calls the Anthropic API directly from the browser.
 *     This is fine for local development or demos, but for production you should
 *     proxy requests through your own backend to keep your API key secret.
 *
 * To run locally:
 *   1. Open index.html in a browser (or serve via `npx serve .`)
 *   2. The API key is handled server-side if you use a proxy.
 *      For a quick local test you can temporarily hardcode it below (never commit it).
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Replace with your Anthropic API key for local testing.
// In production, proxy requests through your own backend.
const ANTHROPIC_API_KEY = 'YOUR_API_KEY_HERE';

const API_URL  = 'https://api.anthropic.com/v1/messages';
const MODEL    = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentTab     = 'text';
let selectedFile   = null;
let lastResult     = '';

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('panel-text').classList.toggle('active', tab === 'text');
  document.getElementById('panel-video').classList.toggle('active', tab === 'video');
  document.getElementById('tab-text').classList.toggle('active', tab === 'text');
  document.getElementById('tab-video').classList.toggle('active', tab === 'video');
  hideError();
  document.getElementById('result-section').classList.remove('show');
}

// ---------------------------------------------------------------------------
// Character / word counter
// ---------------------------------------------------------------------------

function updateCharCount() {
  const text  = document.getElementById('text-input').value;
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  document.getElementById('char-count').textContent = chars.toLocaleString();
  document.getElementById('word-count').textContent = words.toLocaleString();
}

// ---------------------------------------------------------------------------
// Drag-and-drop / file upload
// ---------------------------------------------------------------------------

function onDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('dragover');
}

function onDragLeave() {
  document.getElementById('upload-zone').classList.remove('dragover');
}

function onDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('video/')) {
    handleFile(file);
  } else {
    showError('Please drop a valid video file.');
  }
}

function handleFile(file) {
  if (!file) return;
  selectedFile = file;
  document.getElementById('file-name').textContent = file.name;
  document.getElementById('file-size').textContent = formatBytes(file.size);
  document.getElementById('file-info').classList.add('show');
}

function removeFile() {
  selectedFile = null;
  document.getElementById('file-input').value = '';
  document.getElementById('file-info').classList.remove('show');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes) {
  if (bytes < 1024)    return bytes + ' B';
  if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function showError(msg) {
  const box = document.getElementById('error-box');
  box.textContent = msg;
  box.classList.add('show');
}

function hideError() {
  document.getElementById('error-box').classList.remove('show');
}

function setLoading(loading) {
  const btn     = document.getElementById('btn-summarize');
  const spinner = document.getElementById('spinner');
  const btnText = document.getElementById('btn-text');
  btn.disabled              = loading;
  spinner.style.display     = loading ? 'block' : 'none';
  btnText.textContent       = loading ? 'Analysing…' : '✦ Summarize now';
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(inputText, style, length) {
  const styleInstructions = {
    concise:   'Write a concise, flowing prose recap.',
    bullet:    'Write as a structured bullet-point list with clear, scannable points.',
    detailed:  'Write a detailed prose overview covering all main themes and arguments.',
    eli5:      'Explain this as if to someone with no prior knowledge. Use simple language and relatable analogies.',
    executive: 'Write a professional executive briefing: context, key findings, and implications.',
    keypoints: 'Extract only the most critical takeaways as a tight numbered list.',
  };

  const lengthInstructions = {
    short:         'Keep it to 1–2 sentences maximum.',
    medium:        'Aim for one solid paragraph (4–6 sentences).',
    long:          'Write 2–3 paragraphs with good depth.',
    comprehensive: 'Be comprehensive — cover all significant points thoroughly.',
  };

  return `You are an expert NLP summarization assistant. Summarize the following content.

Style: ${styleInstructions[style] || styleInstructions.concise}
Length: ${lengthInstructions[length] || lengthInstructions.medium}

Respond with ONLY the summary — no preamble, no "Here is a summary", no meta-commentary. Just the summary itself.

Content to summarize:
---
${inputText}
---`;
}

// ---------------------------------------------------------------------------
// Main summarize function (streaming)
// ---------------------------------------------------------------------------

async function summarize() {
  hideError();

  const style  = document.getElementById('style-select').value;
  const length = document.getElementById('length-select').value;
  let inputText       = '';
  let originalWordCount = 0;

  // ── Gather input ──
  if (currentTab === 'text') {
    inputText = document.getElementById('text-input').value.trim();
    if (!inputText) {
      showError('Please paste some text to summarize.');
      return;
    }
    if (inputText.split(/\s+/).length < 30) {
      showError('Text is too short. Please paste at least 30 words for a meaningful summary.');
      return;
    }
    originalWordCount = inputText.split(/\s+/).length;

  } else {
    // Video tab — in a real app you would extract + transcribe the audio here.
    // For the browser demo we pass a descriptive placeholder.
    if (!selectedFile) {
      showError('Please upload a video file first.');
      return;
    }
    inputText = `[Video file: "${selectedFile.name}" (${formatBytes(selectedFile.size)})]

Note: In a production environment the audio track would be extracted and transcribed before being sent here.
For this browser demo, summarize the content a video with this filename might contain, noting it is an estimate.`;
    originalWordCount = 500; // assumed average
  }

  setLoading(true);

  // ── Prepare result area ──
  const resultSection = document.getElementById('result-section');
  const resultText    = document.getElementById('result-text');
  resultSection.classList.add('show');
  resultText.className   = 'result-text streaming';
  resultText.textContent = '';
  document.getElementById('stats-row').innerHTML        = '';
  document.getElementById('reduction-badge').textContent = '';

  // ── Call Anthropic API (streaming) ──
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        stream:     true,
        messages: [{ role: 'user', content: buildPrompt(inputText, style, length) }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    // ── Stream the response ──
    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullText           += parsed.delta.text;
            resultText.textContent = fullText;
          }
        } catch {
          // partial JSON chunk — skip
        }
      }
    }

    // ── Finalise ──
    lastResult           = fullText;
    resultText.className = 'result-text';

    const summaryWords = fullText.trim().split(/\s+/).length;
    const reduction    = originalWordCount > 0
      ? Math.round((1 - summaryWords / originalWordCount) * 100)
      : 0;

    if (reduction > 0) {
      document.getElementById('reduction-badge').textContent = reduction + '% shorter';
    }

    document.getElementById('stats-row').innerHTML = `
      <span class="stat-chip">📄 ${originalWordCount.toLocaleString()} words in</span>
      <span class="stat-chip">✦ ${summaryWords} words out</span>
      <span class="stat-chip">🔤 ${fullText.length.toLocaleString()} chars</span>
      <span class="stat-chip">📐 ${style}</span>
    `;

  } catch (err) {
    resultSection.classList.remove('show');
    showError('Summarization failed: ' + err.message);
  } finally {
    setLoading(false);
  }
}

// ---------------------------------------------------------------------------
// Copy to clipboard
// ---------------------------------------------------------------------------

function copyResult() {
  if (!lastResult) return;
  navigator.clipboard.writeText(lastResult).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.innerHTML = '<span>✓</span> Copied!';
    setTimeout(() => { btn.innerHTML = '<span>⎘</span> Copy'; }, 2000);
  });
}

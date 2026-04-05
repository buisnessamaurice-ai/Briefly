/**
 * Briefly — NLP Summarizer (frontend)
 * Calls /api/summarize and /api/youtube on the Express backend.
 * History is stored in localStorage — never leaves the browser.
 */

// ─── State ───────────────────────────────────────────────────────────────────
let currentTab      = 'text';
let selectedFile    = null;
let selectedPdf     = null;
let lastResult      = '';
let currentSource   = '';   // the original content for Q&A context
let qaHistory       = [];   // [{ role, content }, ...]

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  ['text','youtube','pdf','video'].forEach(t => {
    document.getElementById(`panel-${t}`).classList.toggle('active', t === tab);
    document.getElementById(`tab-${t}`).classList.toggle('active', t === tab);
  });
  hideError();
  document.getElementById('result-section').classList.remove('show');
}

// ─── Text input counter ───────────────────────────────────────────────────────
function updateCharCount() {
  const text  = document.getElementById('text-input').value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  document.getElementById('char-count').textContent = text.length.toLocaleString();
  document.getElementById('word-count').textContent = words.toLocaleString();
}

// ─── Drag & drop helpers ──────────────────────────────────────────────────────
function onDragOver(e, zoneId) {
  e.preventDefault();
  document.getElementById(zoneId).classList.add('dragover');
}
function onDragLeave(zoneId) {
  document.getElementById(zoneId).classList.remove('dragover');
}
function onDropVideo(e) {
  e.preventDefault();
  onDragLeave('upload-zone');
  const file = e.dataTransfer.files[0];
  file && file.type.startsWith('video/') ? handleFile(file) : showError('Please drop a valid video file.');
}
function onDropPdf(e) {
  e.preventDefault();
  onDragLeave('pdf-upload-zone');
  const file = e.dataTransfer.files[0];
  file && file.type === 'application/pdf' ? handlePdf(file) : showError('Please drop a valid PDF file.');
}

// ─── Video file ───────────────────────────────────────────────────────────────
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

// ─── PDF file ─────────────────────────────────────────────────────────────────
function handlePdf(file) {
  if (!file) return;
  selectedPdf = file;
  document.getElementById('pdf-file-name').textContent = file.name;
  document.getElementById('pdf-file-size').textContent = formatBytes(file.size);
  document.getElementById('pdf-file-info').classList.add('show');
}
function removePdf() {
  selectedPdf = null;
  document.getElementById('pdf-input').value = '';
  document.getElementById('pdf-file-info').classList.remove('show');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(b) {
  if (b < 1024)    return b + ' B';
  if (b < 1048576) return Math.round(b / 1024) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
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
  document.getElementById('btn-summarize').disabled  = loading;
  document.getElementById('spinner').style.display   = loading ? 'block' : 'none';
  document.getElementById('btn-text').textContent    = loading ? 'Analysing…' : '✦ Summarize now';
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(inputText, style, length, language) {
  const styles = {
    concise:   'Write a concise, flowing prose recap.',
    bullet:    'Write as a structured bullet-point list with clear, scannable points.',
    detailed:  'Write a detailed prose overview covering all main themes and arguments.',
    eli5:      'Explain this as if to someone with no prior knowledge. Use simple language and analogies.',
    executive: 'Write a professional executive briefing: context, key findings, and implications.',
    keypoints: 'Extract only the most critical takeaways as a tight numbered list.',
  };
  const lengths = {
    short:         'Keep it to 1–2 sentences maximum.',
    medium:        'Aim for one solid paragraph (4–6 sentences).',
    long:          'Write 2–3 paragraphs with good depth.',
    comprehensive: 'Be comprehensive — cover all significant points thoroughly.',
  };
  return `You are an expert NLP summarization assistant.

Style: ${styles[style] || styles.concise}
Length: ${lengths[length] || lengths.medium}
Output language: Write your entire response in ${language}.

Respond with ONLY the summary — no preamble, no "Here is a summary". Just the summary itself.

Content to summarize:
---
${inputText}
---`;
}

// ─── Stream helper ────────────────────────────────────────────────────────────
async function streamFromEndpoint(endpoint, body, onChunk) {
  const response = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${response.status}`);
  }
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.text)  onChunk(parsed.text);
      } catch (e) {
        if (e.message !== 'Unexpected end of JSON input') throw e;
      }
    }
  }
}

// ─── Main summarize ───────────────────────────────────────────────────────────
async function summarize() {
  hideError();
  const style    = document.getElementById('style-select').value;
  const length   = document.getElementById('length-select').value;
  const language = document.getElementById('language-select').value;
  let inputText  = '';
  let originalWordCount = 0;
  let sourceLabel = '';

  // ── Gather input by tab ──
  if (currentTab === 'text') {
    inputText = document.getElementById('text-input').value.trim();
    if (!inputText)                              { showError('Please paste some text to summarize.'); return; }
    if (inputText.split(/\s+/).length < 30)     { showError('Please paste at least 30 words.'); return; }
    originalWordCount = inputText.split(/\s+/).length;
    sourceLabel = 'Text';

  } else if (currentTab === 'youtube') {
    const url = document.getElementById('youtube-input').value.trim();
    if (!url) { showError('Please paste a YouTube URL.'); return; }
    setLoading(true);
    prepareResultArea();
    try {
      const res = await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not fetch transcript');
      inputText = data.transcript;
      sourceLabel = 'YouTube';
      originalWordCount = inputText.split(/\s+/).length;
    } catch (err) {
      setLoading(false);
      showError('YouTube error: ' + err.message);
      return;
    }

  } else if (currentTab === 'pdf') {
    if (!selectedPdf) { showError('Please upload a PDF file.'); return; }
    setLoading(true);
    prepareResultArea();
    try {
      const formData = new FormData();
      formData.append('pdf', selectedPdf);
      const res  = await fetch('/api/pdf', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not extract PDF text');
      inputText = data.text;
      sourceLabel = selectedPdf.name;
      originalWordCount = inputText.split(/\s+/).length;
    } catch (err) {
      setLoading(false);
      showError('PDF error: ' + err.message);
      return;
    }

  } else {
    if (!selectedFile) { showError('Please upload a video file.'); return; }
    inputText = `Video file: "${selectedFile.name}" (${formatBytes(selectedFile.size)}). Summarize what this video likely contains based on its filename and context.`;
    originalWordCount = 60;
    sourceLabel = selectedFile.name;
  }

  currentSource = inputText;
  qaHistory     = [];
  document.getElementById('qa-messages').innerHTML = '';

  setLoading(true);
  prepareResultArea();

  const resultText = document.getElementById('result-text');
  resultText.className   = 'result-text streaming';
  resultText.textContent = '';
  let fullText = '';

  try {
    await streamFromEndpoint('/api/summarize',
      { prompt: buildPrompt(inputText, style, length, language) },
      chunk => { fullText += chunk; resultText.textContent = fullText; }
    );

    lastResult           = fullText;
    resultText.className = 'result-text';

    const summaryWords = fullText.trim().split(/\s+/).length;
    const reduction    = originalWordCount > 0 ? Math.round((1 - summaryWords / originalWordCount) * 100) : 0;
    if (reduction > 0) document.getElementById('reduction-badge').textContent = reduction + '% shorter';

    document.getElementById('stats-row').innerHTML = `
      <span class="stat-chip">📄 ${originalWordCount.toLocaleString()} words in</span>
      <span class="stat-chip">✦ ${summaryWords} words out</span>
      <span class="stat-chip">🌐 ${language}</span>
      <span class="stat-chip">📐 ${style}</span>
    `;

    saveToHistory(sourceLabel, fullText, style, language);

  } catch (err) {
    document.getElementById('result-section').classList.remove('show');
    showError('Summarization failed: ' + err.message);
  } finally {
    setLoading(false);
  }
}

function prepareResultArea() {
  document.getElementById('result-section').classList.add('show');
  document.getElementById('reduction-badge').textContent = '';
  document.getElementById('stats-row').innerHTML = '';
}

// ─── Copy & Export ────────────────────────────────────────────────────────────
function copyResult() {
  if (!lastResult) return;
  navigator.clipboard.writeText(lastResult).then(() => {
    const btns = document.querySelectorAll('.copy-btn');
    btns[0].innerHTML = '<span>✓</span> Copied!';
    setTimeout(() => { btns[0].innerHTML = '<span>⎘</span> Copy'; }, 2000);
  });
}

function exportResult(format) {
  if (!lastResult) return;
  const content  = format === 'md' ? `# Summary\n\n${lastResult}` : lastResult;
  const mime     = format === 'md' ? 'text/markdown' : 'text/plain';
  const filename = `summary.${format}`;
  const blob     = new Blob([content], { type: mime });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Q&A ──────────────────────────────────────────────────────────────────────
async function askQuestion() {
  const input    = document.getElementById('qa-input');
  const question = input.value.trim();
  if (!question || !currentSource) return;

  input.value = '';
  document.querySelector('.qa-send').disabled = true;

  const messagesEl = document.getElementById('qa-messages');

  // Show user message
  const userEl = document.createElement('div');
  userEl.className = 'qa-msg user';
  userEl.textContent = question;
  messagesEl.appendChild(userEl);

  // Prepare AI bubble
  const aiEl = document.createElement('div');
  aiEl.className = 'qa-msg ai streaming';
  messagesEl.appendChild(aiEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Build messages with context
  qaHistory.push({ role: 'user', content: question });

  const systemContext = `You are a helpful assistant answering questions about the following content:\n\n---\n${currentSource}\n---\n\nThe content has already been summarized as:\n${lastResult}\n\nAnswer questions concisely based on the content above.`;

  let aiText = '';
  try {
    await streamFromEndpoint('/api/qa', { context: systemContext, history: qaHistory },
      chunk => {
        aiText += chunk;
        aiEl.textContent = aiText;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    );
    aiEl.classList.remove('streaming');
    qaHistory.push({ role: 'assistant', content: aiText });
  } catch (err) {
    aiEl.textContent = 'Error: ' + err.message;
    aiEl.classList.remove('streaming');
  }

  document.querySelector('.qa-send').disabled = false;
  input.focus();
}

// ─── History (localStorage) ───────────────────────────────────────────────────
const HISTORY_KEY = 'briefly_history';

function saveToHistory(source, summary, style, language) {
  const history = getHistory();
  history.unshift({
    id:       Date.now(),
    source:   source.length > 60 ? source.slice(0, 57) + '…' : source,
    summary,
    style,
    language,
    date:     new Date().toLocaleDateString(),
  });
  const trimmed = history.slice(0, 50); // keep last 50
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  renderHistory();
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function renderHistory() {
  const list    = document.getElementById('sidebar-list');
  const history = getHistory();
  if (!history.length) {
    list.innerHTML = '<div class="sidebar-empty">No summaries yet.</div>';
    return;
  }
  list.innerHTML = history.map(item => `
    <div class="history-item" onclick="loadFromHistory(${item.id})">
      <div class="history-item-title">${escapeHtml(item.source)}</div>
      <div class="history-item-meta">${item.date} · ${item.style} · ${item.language}</div>
    </div>
  `).join('');
}

function loadFromHistory(id) {
  const item = getHistory().find(h => h.id === id);
  if (!item) return;
  lastResult = item.summary;
  document.getElementById('result-text').textContent = item.summary;
  document.getElementById('result-section').classList.add('show');
  document.getElementById('reduction-badge').textContent = '';
  document.getElementById('stats-row').innerHTML = `
    <span class="stat-chip">📂 Loaded from history</span>
    <span class="stat-chip">📐 ${item.style}</span>
    <span class="stat-chip">🌐 ${item.language}</span>
  `;
  toggleHistory();
  window.scrollTo({ top: document.getElementById('result-section').offsetTop - 20, behavior: 'smooth' });
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

function toggleHistory() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
  renderHistory();
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
renderHistory();

const API_URL = '/api/summarize';

let currentTab = 'text';
let selectedFile = null;
let lastResult = '';

// ---------------- INIT ----------------
document.addEventListener('DOMContentLoaded', () => {

  // Tabs
  document.getElementById('tab-text')
    .addEventListener('click', () => switchTab('text'));

  document.getElementById('tab-video')
    .addEventListener('click', () => switchTab('video'));

  // Text input
  document.getElementById('text-input')
    .addEventListener('input', updateCharCount);

  // Upload zone
  const uploadZone = document.getElementById('upload-zone');

  uploadZone.addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  uploadZone.addEventListener('dragover', onDragOver);
  uploadZone.addEventListener('dragleave', onDragLeave);
  uploadZone.addEventListener('drop', onDrop);

  // File input
  document.getElementById('file-input')
    .addEventListener('change', (e) => handleFile(e.target.files[0]));

  // Remove file
  document.querySelector('.file-remove')
    .addEventListener('click', removeFile);

  // Summarize button
  document.getElementById('btn-summarize')
    .addEventListener('click', summarize);

  // Copy button
  document.getElementById('copy-btn')
    .addEventListener('click', copyResult);
});

// ---------------- FUNCTIONS ----------------

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('panel-text').classList.toggle('active', tab === 'text');
  document.getElementById('panel-video').classList.toggle('active', tab === 'video');
}

function updateCharCount() {
  const text = document.getElementById('text-input').value;
  document.getElementById('char-count').textContent = text.length;
  document.getElementById('word-count').textContent =
    text.trim() ? text.trim().split(/\s+/).length : 0;
}

function onDragOver(e) {
  e.preventDefault();
}

function onDragLeave() {}

function onDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  handleFile(file);
}

function handleFile(file) {
  if (!file) return;
  selectedFile = file;
  document.getElementById('file-name').textContent = file.name;
}

function removeFile() {
  selectedFile = null;
}

async function summarize() {
  const text = document.getElementById('text-input').value;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: text }),
  });

  const data = await res.json();
  lastResult = data.text || '';
  document.getElementById('result-text').textContent = lastResult;
}

function copyResult() {
  navigator.clipboard.writeText(lastResult);
}

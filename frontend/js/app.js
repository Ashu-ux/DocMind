/* ════════════════════════════════════════════════════════════════
   DocMind — Enterprise RAG Q&A
   Application Logic v2.0 — Professional Black & White Edition
   ════════════════════════════════════════════════════════════════ */

'use strict';

// ── CONFIG ──────────────────────────────────────────────────────────
// Docker mode  → API_BASE = ''         (nginx proxies /api/* → backend:8000)
// Local dev    → API_BASE = 'http://localhost:8000'
const API_BASE = 'https://docmind-sc7n.onrender.com/';

// ── STATE ────────────────────────────────────────────────────────────
const state = {
  docs: [],                 // [{ sessionId, filename, chunks, ext, time }]
  activeSessionId: null,
  querying: false,
  queryCount: 0,
  totalChunks: 0,
  totalTime: 0,             // ms
  topK: 5,
  showSources: true,
  showContext: true,
  chatHistory: [],          // [{ role, text, time, sources, ms }]
};

// ── DOM ──────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const DOM = {
  // Upload
  dropZone:     $('drop-zone'),
  fileInput:    $('file-input'),
  browseBtn:    $('browse-btn'),
  uploadProg:   $('upload-prog'),
  progName:     $('prog-name'),
  progPct:      $('prog-pct'),
  progFill:     $('prog-fill'),
  progTrack:    $('prog-track'),
  progStatus:   $('prog-status'),
  uploadCount:  $('upload-count'),

  // Docs
  docList:      $('doc-list'),
  docEmpty:     $('doc-empty'),
  clearAllBtn:  $('clear-all-btn'),

  // Doc Info Card
  blockDocInfo: $('block-doc-info'),
  infoFilename: $('info-filename'),
  infoType:     $('info-type'),
  infoChunks:   $('info-chunks'),
  infoTime:     $('info-time'),
  infoSession:  $('info-session'),

  // Settings
  topkSlider:        $('topk-slider'),
  topkDisplay:       $('topk-display'),
  showSrcToggle:     $('show-sources-toggle'),
  showCtxToggle:     $('show-context-toggle'),

  // Stats
  statQueries: $('stat-queries'),
  statDocs:    $('stat-docs'),
  statChunks:  $('stat-chunks'),
  statAvgTime: $('stat-avgtime'),

  // Toolbar
  toolbarTitle:  $('toolbar-title'),
  toolbarMeta:   $('toolbar-meta'),
  exportBtn:     $('export-btn'),
  clearChatBtn:  $('clear-chat-btn'),

  // Chat
  welcomeScreen: $('welcome-screen'),
  chatMessages:  $('chat-messages'),

  // Input
  questionInput:  $('question-input'),
  sendBtn:        $('send-btn'),
  charCount:      $('char-count'),
  hintMsg:        $('hint-msg'),
  topkDisplayInput: $('topk-display-input'),
  sendIcon:       $('send-btn')?.querySelector('.send-icon'),
  sendSpin:       $('send-btn')?.querySelector('.send-spin'),
  quickActions:   $('quick-actions'),

  // Shortcuts
  shortcutsBtn:    $('shortcuts-btn'),
  shortcutsOverlay: $('shortcuts-overlay'),
  shortcutsClose:   $('shortcuts-close'),

  // Toast
  toastContainer: $('toast-container'),

  // Status
  statusDot:   $('status-dot'),
  statusLabel: $('status-label'),
};

// ── API HEALTH ───────────────────────────────────────────────────────
async function checkHealth() {
  setStatus('checking', 'Checking…');
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) { setStatus('online', 'API Online'); }
    else throw new Error();
  } catch {
    setStatus('offline', 'API Offline');
  }
}
function setStatus(type, label) {
  DOM.statusDot.className = `status-dot ${type}`;
  DOM.statusLabel.textContent = label;
}
checkHealth();
setInterval(checkHealth, 30_000);

// ── SETTINGS ─────────────────────────────────────────────────────────
DOM.topkSlider?.addEventListener('input', () => {
  state.topK = parseInt(DOM.topkSlider.value, 10);
  DOM.topkDisplay.textContent = state.topK;
  updateTopKDisplay();
});

DOM.showSrcToggle?.addEventListener('change', () => {
  state.showSources = DOM.showSrcToggle.checked;
});

DOM.showCtxToggle?.addEventListener('change', () => {
  state.showContext = DOM.showCtxToggle.checked;
});

function updateTopKDisplay() {
  if (DOM.topkDisplayInput) {
    DOM.topkDisplayInput.innerHTML = `Top-K: <span class="mono">${state.topK}</span>`;
  }
}

// ── FILE UPLOAD ───────────────────────────────────────────────────────
DOM.dropZone?.addEventListener('click', (e) => {
  if (!DOM.browseBtn.contains(e.target)) DOM.fileInput.click();
});
DOM.dropZone?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); DOM.fileInput.click(); }
});
DOM.browseBtn?.addEventListener('click', (e) => { e.stopPropagation(); DOM.fileInput.click(); });

DOM.dropZone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  DOM.dropZone.classList.add('drag-over');
});
DOM.dropZone?.addEventListener('dragleave', () => DOM.dropZone.classList.remove('drag-over'));
DOM.dropZone?.addEventListener('drop', (e) => {
  e.preventDefault();
  DOM.dropZone.classList.remove('drag-over');
  const f = e.dataTransfer?.files?.[0];
  if (f) handleFile(f);
});
DOM.fileInput?.addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (f) handleFile(f);
  DOM.fileInput.value = '';
});

// ── FILE VALIDATION ───────────────────────────────────────────────────
const ALLOWED = ['.pdf', '.docx', '.txt'];
const MAX_MB  = 10 * 1024 * 1024;

function ext(filename) {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

async function handleFile(file) {
  if (!ALLOWED.includes(ext(file.name))) {
    toast(`Unsupported: ${ext(file.name)}. Use PDF, DOCX, or TXT.`, 'error');
    return;
  }
  if (file.size > MAX_MB) {
    toast('File too large. Max 10 MB.', 'error');
    return;
  }
  await uploadFile(file);
}

async function uploadFile(file) {
  showProg(file.name);
  const fd = new FormData();
  fd.append('file', file);

  try {
    animateProg(5, 55, 1000);
    const r = await fetch(`${API_BASE}/api/documents/upload`, { method: 'POST', body: fd });
    animateProg(55, 80, 400);
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: 'Upload failed.' }));
      throw new Error(err.detail || 'Upload failed.');
    }
    const data = await r.json();
    animateProg(80, 100, 300);
    setTimeout(() => {
      hideProg();
      addDoc({ sessionId: data.session_id, filename: data.filename, chunks: data.chunks_created, ext: ext(data.filename), time: new Date() });
      toast(`"${data.filename}" indexed — ${data.chunks_created} chunks`, 'success');
    }, 350);
  } catch (err) {
    hideProg();
    toast(err.message || 'Upload failed. Is the API running?', 'error');
  }
}

// Progress helpers
function showProg(name) {
  DOM.progName.textContent = name;
  DOM.progPct.textContent = '0%';
  DOM.progFill.style.width = '0%';
  DOM.progStatus.textContent = 'Uploading…';
  DOM.uploadProg.hidden = false;
}
function hideProg() { DOM.uploadProg.hidden = true; }
function animateProg(from, to, dur) {
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min((now - t0) / dur, 1);
    const v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    DOM.progFill.style.width = v + '%';
    DOM.progPct.textContent  = v + '%';
    DOM.progTrack.setAttribute('aria-valuenow', v);
    DOM.progStatus.textContent = v < 60 ? 'Uploading…' : 'Embedding & indexing…';
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── DOCUMENT MANAGEMENT ───────────────────────────────────────────────
function addDoc(doc) {
  state.docs.push(doc);
  state.totalChunks += doc.chunks;
  renderDocs();
  setActive(doc.sessionId);
  updateStats();
}

function removeDoc(sessionId) {
  fetch(`${API_BASE}/api/documents/${sessionId}`, { method: 'DELETE' }).catch(() => {});
  const doc = state.docs.find(d => d.sessionId === sessionId);
  if (doc) state.totalChunks -= doc.chunks;
  state.docs = state.docs.filter(d => d.sessionId !== sessionId);
  if (state.activeSessionId === sessionId) {
    state.activeSessionId = state.docs.length ? state.docs[state.docs.length - 1].sessionId : null;
  }
  renderDocs();
  updateActiveInfo();
  updateStats();
  updateChatState();
}

function clearAllDocs() {
  state.docs.forEach(d => fetch(`${API_BASE}/api/documents/${d.sessionId}`, { method: 'DELETE' }).catch(() => {}));
  state.docs = [];
  state.totalChunks = 0;
  state.activeSessionId = null;
  renderDocs();
  updateActiveInfo();
  updateStats();
  updateChatState();
}

function setActive(sessionId) {
  state.activeSessionId = sessionId;
  renderDocs();
  updateActiveInfo();
  updateChatState();
}

function renderDocs() {
  DOM.docList.querySelectorAll('.doc-item').forEach(el => el.remove());
  const cnt = state.docs.length;
  DOM.uploadCount.textContent = `${cnt} loaded`;
  DOM.docEmpty.hidden = cnt > 0;
  DOM.clearAllBtn.hidden = cnt === 0;

  state.docs.forEach(doc => {
    const el = document.createElement('div');
    el.className = `doc-item${doc.sessionId === state.activeSessionId ? ' active' : ''}`;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `Select: ${doc.filename}`);
    el.dataset.id = doc.sessionId;

    const extLabel = doc.ext.replace('.', '').toUpperCase();
    el.innerHTML = `
      <div class="doc-badge">${esc(extLabel)}</div>
      <div class="doc-meta-wrap">
        <p class="doc-fname" title="${esc(doc.filename)}">${esc(doc.filename)}</p>
        <p class="doc-sub">${doc.chunks} chunks · ${fmtTime(doc.time)}</p>
      </div>
      <button class="doc-del-btn" aria-label="Remove ${esc(doc.filename)}" title="Remove">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    `;
    el.addEventListener('click', (e) => { if (!e.target.closest('.doc-del-btn')) setActive(doc.sessionId); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') setActive(doc.sessionId); });
    el.querySelector('.doc-del-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeDoc(doc.sessionId);
    });
    DOM.docList.appendChild(el);
  });
}

function updateActiveInfo() {
  const doc = state.docs.find(d => d.sessionId === state.activeSessionId);
  if (doc) {
    DOM.blockDocInfo.hidden = false;
    DOM.infoFilename.textContent = doc.filename;
    DOM.infoType.textContent     = doc.ext.replace('.', '').toUpperCase();
    DOM.infoChunks.textContent   = doc.chunks;
    DOM.infoTime.textContent     = doc.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    DOM.infoSession.textContent  = doc.sessionId.slice(0, 18) + '…';
    // Toolbar
    DOM.toolbarTitle.textContent = doc.filename;
    DOM.toolbarMeta.textContent  = `${doc.chunks} chunks indexed · Session ${doc.sessionId.slice(0, 8)}`;
  } else {
    DOM.blockDocInfo.hidden = true;
    DOM.toolbarTitle.textContent = 'No document selected';
    DOM.toolbarMeta.textContent  = 'Select or upload a document to begin';
  }
}

function updateStats() {
  DOM.statQueries.textContent = state.queryCount;
  DOM.statDocs.textContent    = state.docs.length;
  DOM.statChunks.textContent  = state.totalChunks;
  const avg = state.queryCount > 0 ? Math.round(state.totalTime / state.queryCount) : 0;
  DOM.statAvgTime.textContent = state.queryCount > 0 ? `${avg}ms` : '—';
}

// ── CHAT STATE ────────────────────────────────────────────────────────
function updateChatState() {
  const hasDoc = !!state.activeSessionId;
  DOM.questionInput.disabled = !hasDoc || state.querying;
  DOM.sendBtn.disabled = !hasDoc || state.querying;
  DOM.exportBtn.disabled = state.chatHistory.length === 0;
  DOM.clearChatBtn.disabled = state.chatHistory.length === 0;
  DOM.hintMsg.textContent = hasDoc
    ? 'Enter to send · Shift+Enter for new line.'
    : 'Upload a document to begin.';
}

// ── CHAT ACTIONS (Export / Clear) ─────────────────────────────────────
DOM.exportBtn?.addEventListener('click', exportChat);
DOM.clearChatBtn?.addEventListener('click', clearChat);

function exportChat() {
  if (state.chatHistory.length === 0) return;
  const lines = ['DocMind — Exported Conversation', '='.repeat(50), ''];
  state.chatHistory.forEach(m => {
    lines.push(`[${m.time}] ${m.role === 'user' ? 'YOU' : 'AI'}`);
    lines.push(m.text);
    if (m.sources?.length) lines.push('Sources: ' + m.sources.map(s => s.file?.split(/[\\/]/).pop() + (s.page ? ` (p.${s.page})` : '')).join(', '));
    lines.push('');
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `docmind-chat-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Chat exported as .txt', 'success');
}

function clearChat() {
  state.chatHistory = [];
  DOM.chatMessages.innerHTML = '';
  DOM.chatMessages.hidden = true;
  DOM.welcomeScreen.hidden = false;
  updateChatState();
  toast('Conversation cleared', 'info');
}

// ── CLEAR ALL DOCS ────────────────────────────────────────────────────
DOM.clearAllBtn?.addEventListener('click', () => {
  clearAllDocs();
  clearChat();
});

// ── INPUT HANDLING ────────────────────────────────────────────────────
DOM.questionInput?.addEventListener('input', () => {
  const len = DOM.questionInput.value.length;
  DOM.charCount.textContent = `${len}/2000`;
  DOM.sendBtn.disabled = !state.activeSessionId || state.querying || len === 0;
  DOM.questionInput.style.height = 'auto';
  DOM.questionInput.style.height = Math.min(DOM.questionInput.scrollHeight, 140) + 'px';
});

DOM.questionInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!DOM.sendBtn.disabled) sendQ(); }
  if (e.key === 'Escape') { DOM.questionInput.value = ''; DOM.questionInput.dispatchEvent(new Event('input')); }
});

DOM.sendBtn?.addEventListener('click', sendQ);

// Quick action chips
document.querySelectorAll('.sample-q, .qa-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (!state.activeSessionId) { toast('Upload a document first.', 'error'); return; }
    DOM.questionInput.value = chip.dataset.q;
    DOM.questionInput.dispatchEvent(new Event('input'));
    DOM.questionInput.focus();
  });
});

// ── SEND QUESTION ─────────────────────────────────────────────────────
async function sendQ() {
  const q = DOM.questionInput.value.trim();
  if (!q || !state.activeSessionId || state.querying) return;

  DOM.questionInput.value = '';
  DOM.questionInput.style.height = 'auto';
  DOM.charCount.textContent = '0/2000';

  // Switch to chat view
  DOM.welcomeScreen.hidden = true;
  DOM.chatMessages.hidden  = false;

  const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const startMs = Date.now();

  // User message
  appendMsg('user', q, [], null, timeNow);
  state.chatHistory.push({ role: 'user', text: q, time: timeNow });

  // Thinking
  const thinkEl = appendThinking();
  setQuerying(true);

  try {
    const r = await fetch(`${API_BASE}/api/query/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: state.activeSessionId, question: q, top_k: state.topK }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: 'Query failed.' }));
      throw new Error(err.detail || 'Query failed.');
    }

    const data = await r.json();
    const elapsedMs = Date.now() - startMs;
    thinkEl.remove();

    const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    appendMsg('ai', data.answer, state.showSources ? data.sources : [], state.showContext ? data.context_used : null, aiTime, elapsedMs);
    state.chatHistory.push({ role: 'ai', text: data.answer, time: aiTime, sources: data.sources, ms: elapsedMs });

    // Update stats
    state.queryCount++;
    state.totalTime += elapsedMs;
    updateStats();

  } catch (err) {
    thinkEl.remove();
    const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    appendMsg('ai', `Error: ${err.message}`, [], null, aiTime, null, true);
    state.chatHistory.push({ role: 'ai', text: `Error: ${err.message}`, time: aiTime });
  } finally {
    setQuerying(false);
    updateChatState();
    scrollBottom();
  }
}

// ── RENDER MESSAGE ────────────────────────────────────────────────────
function appendMsg(role, text, sources = [], contextUsed = null, timeLbl = '', ms = null, isErr = false) {
  const group = document.createElement('div');
  group.className = 'msg-group';

  const row = document.createElement('div');
  row.className = 'msg-row';

  const avatar = document.createElement('div');
  avatar.className = `msg-avatar ${role}-av`;
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = role === 'user' ? 'AK' : 'AI';

  const body = document.createElement('div');
  body.className = 'msg-body';

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.innerHTML = `
    <span class="msg-author">${role === 'user' ? 'Ashutosh Kumar' : 'DocMind AI'}</span>
    <span class="msg-time-lbl">${esc(timeLbl)}</span>
  `;

  // Content
  const content = document.createElement('div');
  content.className = `msg-content${role === 'user' ? ' user-text' : ''}${isErr ? ' error-text' : ''}`;
  content.innerHTML = renderText(text, isErr);

  body.appendChild(meta);
  body.appendChild(content);

  // Footer for AI messages
  if (role === 'ai') {
    const footer = document.createElement('div');
    footer.className = 'msg-footer';

    // Sources
    const srcWrap = document.createElement('div');
    srcWrap.className = 'sources-wrap';
    if (sources && sources.length > 0) {
      const lbl = document.createElement('span');
      lbl.className = 'sources-lbl';
      lbl.textContent = 'SOURCES';
      srcWrap.appendChild(lbl);
      const seen = new Set();
      sources.forEach(s => {
        const name = (s.file || '').split(/[\\/]/).pop();
        const key  = `${name}-${s.page}`;
        if (seen.has(key)) return;
        seen.add(key);
        const chip = document.createElement('span');
        chip.className = 'source-chip';
        chip.textContent = s.page ? `${name} · p.${s.page}` : name;
        srcWrap.appendChild(chip);
      });
    }

    // Right side: meta + copy
    const rightWrap = document.createElement('div');
    rightWrap.style.display = 'flex';
    rightWrap.style.alignItems = 'center';
    rightWrap.style.gap = '10px';

    const respMeta = document.createElement('div');
    respMeta.className = 'resp-meta';
    if (contextUsed !== null) {
      const ci = document.createElement('span');
      ci.className = 'resp-meta-item';
      ci.textContent = `${contextUsed} chunks`;
      respMeta.appendChild(ci);
    }
    if (ms !== null) {
      const ti = document.createElement('span');
      ti.className = 'resp-meta-item';
      ti.textContent = `${ms}ms`;
      respMeta.appendChild(ti);
    }

    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action-btn';
    copyBtn.setAttribute('aria-label', 'Copy response');
    copyBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true"><rect x="3.5" y="1" width="6.5" height="8" rx="1.2" stroke="currentColor" stroke-width="1.1"/><rect x="1" y="3" width="6.5" height="8" rx="1.2" stroke="currentColor" stroke-width="1.1" fill="currentColor" fill-opacity="0"/></svg> Copy`;
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true"><path d="M1.5 5.5l3 3 5-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg> Copied`;
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true"><rect x="3.5" y="1" width="6.5" height="8" rx="1.2" stroke="currentColor" stroke-width="1.1"/><rect x="1" y="3" width="6.5" height="8" rx="1.2" stroke="currentColor" stroke-width="1.1" fill="currentColor" fill-opacity="0"/></svg> Copy`;
        }, 2000);
      } catch { toast('Could not copy.', 'error'); }
    });
    actions.appendChild(copyBtn);
    rightWrap.appendChild(respMeta);
    rightWrap.appendChild(actions);

    footer.appendChild(srcWrap);
    footer.appendChild(rightWrap);
    body.appendChild(footer);
  }

  row.appendChild(avatar);
  row.appendChild(body);
  group.appendChild(row);
  DOM.chatMessages.appendChild(group);
  scrollBottom();
  return group;
}

function appendThinking() {
  const row = document.createElement('div');
  row.className = 'thinking-row';
  row.innerHTML = `
    <div class="msg-avatar ai-av" aria-hidden="true">AI</div>
    <div class="thinking-dots" aria-label="AI is thinking…">
      <div class="t-dot"></div>
      <div class="t-dot"></div>
      <div class="t-dot"></div>
    </div>
    <span class="thinking-txt">Retrieving & generating…</span>
  `;
  DOM.chatMessages.appendChild(row);
  scrollBottom();
  return row;
}

// ── TEXT RENDERING ────────────────────────────────────────────────────
function renderText(raw, isErr = false) {
  let s = esc(raw);
  // **bold**
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // bullet lines
  s = s.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
  // wrap consecutive <li> in <ul>
  s = s.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, (m) => {
    if (m.startsWith('<li>')) return '<ul>' + m + '</ul>';
    return m;
  });
  s = s.replace(/(<li>.*?<\/li>)+/gs, (m) => '<ul style="margin:.5em 0 .5em 16px;line-height:1.7">' + m + '</ul>');
  // numbered
  s = s.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  // newlines
  s = s.replace(/\n/g, '<br>');
  if (isErr) s = `<span style="color:var(--error)">${s}</span>`;
  return s;
}

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function fmtTime(d) {
  return d instanceof Date ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

function scrollBottom() {
  requestAnimationFrame(() => { DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight; });
}

// ── QUERYING STATE ────────────────────────────────────────────────────
function setQuerying(v) {
  state.querying = v;
  if (DOM.sendIcon) DOM.sendIcon.hidden = v;
  if (DOM.sendSpin) DOM.sendSpin.hidden = !v;
  DOM.questionInput.disabled = v || !state.activeSessionId;
  DOM.sendBtn.disabled = v || !state.activeSessionId;
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Ctrl+K → focus input
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    DOM.questionInput?.focus();
  }
  // Ctrl+E → export
  if (e.ctrlKey && e.key === 'e') {
    e.preventDefault();
    if (!DOM.exportBtn.disabled) exportChat();
  }
  // Ctrl+U → file picker
  if (e.ctrlKey && e.key === 'u') {
    e.preventDefault();
    DOM.fileInput?.click();
  }
  // Ctrl+ArrowUp → scroll top
  if (e.ctrlKey && e.key === 'ArrowUp') {
    DOM.chatMessages.scrollTop = 0;
  }
  // Ctrl+ArrowDown → scroll bottom
  if (e.ctrlKey && e.key === 'ArrowDown') {
    scrollBottom();
  }
  // Esc → close modal
  if (e.key === 'Escape') {
    DOM.shortcutsOverlay.hidden = true;
  }
});

// ── SHORTCUTS MODAL ───────────────────────────────────────────────────
DOM.shortcutsBtn?.addEventListener('click', () => { DOM.shortcutsOverlay.hidden = false; });
DOM.shortcutsClose?.addEventListener('click', () => { DOM.shortcutsOverlay.hidden = true; });
DOM.shortcutsOverlay?.addEventListener('click', (e) => {
  if (e.target === DOM.shortcutsOverlay) DOM.shortcutsOverlay.hidden = true;
});

// ── TOAST ─────────────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3500) {
  const labels = { success: 'SUCCESS', error: 'ERROR', info: 'INFO' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <div class="toast-marker"></div>
    <div class="toast-content">
      <p class="toast-type">${labels[type] ?? 'INFO'}</p>
      <p class="toast-msg">${esc(msg)}</p>
    </div>
    <button class="toast-x" aria-label="Dismiss">×</button>
  `;
  const dismiss = () => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };
  el.querySelector('.toast-x').addEventListener('click', dismiss);
  DOM.toastContainer.appendChild(el);
  setTimeout(dismiss, duration);
}

// ── INIT ──────────────────────────────────────────────────────────────
updateChatState();
updateStats();
updateTopKDisplay();
DOM.questionInput?.focus();

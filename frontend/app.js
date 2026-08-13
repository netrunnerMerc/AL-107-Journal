/* ── CONFIG ───────────────────────────────────────────────────────── */
const API = '';

/* ── PIN AUTH ─────────────────────────────────────────────────────── */
const SESSION_PIN = sessionStorage.getItem('al107_pin') || '';
if (!SESSION_PIN) {
  window.location.href = '/pin.html';
}
function authHeaders(extra = {}) {
  return { 'Content-Type': 'application/json', 'X-App-Pin': SESSION_PIN, ...extra };
}
function handleAuthError(r) {
  if (r.status === 401) {
    sessionStorage.removeItem('al107_pin');
    window.location.href = '/pin.html';
    return true;
  }
  return false;
}

/* ── STATE ────────────────────────────────────────────────────────── */
let allQuests = [];
let player = { level: 1, total_xp: 0, name: 'V' };
let currentFilter = 'all';
let currentView = 'dashboard';
let selectedQuestType = 'side';
let chatHistory = [];       // [{role, content}] for AL-107 two-way chat
let unreadCount = 0;
let chatOpen = false;

/* ── AUDIO ────────────────────────────────────────────────────────── */
let audioCtx;
function initAudio() { if (audioCtx) return; audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function _tone(freq, type, duration, gain = 0.07) {
  try {
    initAudio();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    o.start(); o.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}
function playClick()   { _tone(800, 'square', 0.06, 0.06); }
function playNav()     { _tone(600, 'sine', 0.04, 0.04); }
function playSuccess() { [880,1100,1320].forEach((f,i) => setTimeout(() => _tone(f,'sine',0.15,0.05), i*80)); }
function playFail()    {
  try {
    initAudio();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'sawtooth'; o.frequency.value = 220;
    o.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.3);
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    o.start(); o.stop(audioCtx.currentTime + 0.3);
  } catch(e) {}
}
function playSend() { _tone(900, 'sine', 0.05, 0.04); }

/* ── BOOT ─────────────────────────────────────────────────────────── */
const bootMessages = [
  'INITIALIZING NEURAL LINK...',
  'CONNECTING TO NIGHT CITY GRID...',
  'LOADING AL-107 PROTOCOLS...',
  'DECRYPTING QUEST DATABASE...',
  'CALIBRATING FIXER NETWORK...',
  'SYSTEM READY.'
];
function runBoot() {
  const fill = document.getElementById('boot-bar-fill');
  const status = document.getElementById('boot-status');
  let step = 0;
  const interval = setInterval(() => {
    if (step >= bootMessages.length) {
      clearInterval(interval);
      setTimeout(() => {
        document.getElementById('boot-screen').classList.add('fade-out');
        setTimeout(() => {
          document.getElementById('boot-screen').style.display = 'none';
          document.getElementById('app').classList.remove('hidden');
          loadAll();
        }, 600);
      }, 300);
      return;
    }
    status.textContent = bootMessages[step];
    fill.style.width = ((step + 1) / bootMessages.length * 100) + '%';
    step++;
  }, 350);
}

/* ── API ──────────────────────────────────────────────────────────── */
async function fetchQuests() { const r=await fetch(`${API}/api/quests`,{headers:authHeaders()}); if(handleAuthError(r))return; return r.json(); }
async function fetchPlayer() { const r=await fetch(`${API}/api/player`,{headers:authHeaders()}); if(handleAuthError(r))return; return r.json(); }
async function fetchNPCs() { const r=await fetch(`${API}/api/quests/npcs`,{headers:authHeaders()}); if(handleAuthError(r))return; return r.json(); }
async function fetchNPCQuests(name) { const r=await fetch(`${API}/api/quests/npc/${encodeURIComponent(name)}`,{headers:authHeaders()}); if(handleAuthError(r))return; return r.json(); }
async function createQuest(data) {
  const r = await fetch(`${API}/api/quests`, { method:'POST', headers:authHeaders(), body: JSON.stringify(data) });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}
async function updateQuestStatus(id, status) {
  const r = await fetch(`${API}/api/quests/${id}`, { method:'PATCH', headers:authHeaders(), body: JSON.stringify({status}) });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}
async function deleteQuest(id) { const r=await fetch(`${API}/api/quests/${id}`,{method:'DELETE',headers:authHeaders()}); if(handleAuthError(r))return; return r.json(); }
async function sendChatMessage(message) {
  const r = await fetch(`${API}/api/al107/chat`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    headers: authHeaders(),
    body: JSON.stringify({ message, history: chatHistory.slice(-8) })
  });
  if (!r.ok) throw new Error('Chat failed');
  return r.json();
}

/* ── LOAD & RENDER ────────────────────────────────────────────────── */
async function loadAll() {
  [allQuests, player] = await Promise.all([fetchQuests(), fetchPlayer()]);
  renderDashboard();
  renderPlayer();
}
function renderPlayer() {
  document.getElementById('p-name').textContent = player.name;
  document.getElementById('p-level').textContent = `LVL ${player.level}`;
  document.getElementById('p-xp').textContent = `${player.total_xp} XP`;
  document.getElementById('xp-bar-fill').style.width = ((player.total_xp % 500) / 500 * 100) + '%';
}

/* ── QUEST CARD ──────────────────────────────────────────────────── */
function buildQuestCard(q, showReactivate = false) {
  const card = document.createElement('div');
  const isArchived = q.status !== 'active';
  card.className = `quest-card ${q.quest_type} ${isArchived ? q.status : ''}`;
  card.dataset.id = q.id;

  // Badge
  let badgeClass, badgeLabel;
  if (isArchived) {
    badgeClass = q.status === 'failed' ? 'badge-failed' : 'badge-completed';
    badgeLabel = q.status.toUpperCase();
  } else {
    const labels = { main: ['badge-main','MAIN JOB'], side: ['badge-side','SIDE GIG'], personal: ['badge-personal','PERSONAL'] };
    [badgeClass, badgeLabel] = labels[q.quest_type] || labels.side;
  }

  // NPC/Fixer line
  let npcHtml = '';
  if (q.quest_type === 'personal') {
    npcHtml = `<div class="quest-npc self-issued">${player.name || 'SELF'}</div>`;
  } else if (q.npc) {
    npcHtml = `<div class="quest-npc">${escHtml(q.npc)}</div>`;
  }

  const date = new Date(q.created_at).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
  let actions = '';
  if (q.status === 'active') {
    actions = `<button class="action-btn complete-btn" data-id="${q.id}" data-action="completed">COMPLETE</button>
               <button class="action-btn fail-btn" data-id="${q.id}" data-action="failed">FAIL</button>`;
  } else if (showReactivate) {
    actions = `<button class="action-btn reactivate-btn" data-id="${q.id}" data-action="active">REACTIVATE</button>`;
  }
  actions += `<button class="action-btn delete-btn" data-id="${q.id}" data-action="delete">✕</button>`;

  card.innerHTML = `
    <div class="quest-card-top">
      <div class="quest-title">${escHtml(q.title)}</div>
      <span class="quest-badge ${badgeClass}">${badgeLabel}</span>
    </div>
    ${npcHtml}
    ${q.description ? `<div class="quest-desc">${escHtml(q.description)}</div>` : ''}
    ${q.raw_task ? `<div class="quest-raw">${escHtml(q.raw_task)}</div>` : ''}
    <div class="quest-footer">
      <span class="quest-xp">${q.xp_reward}</span>
      <span class="quest-date">${date}</span>
      <div class="quest-actions">${actions}</div>
    </div>
  `;
  card.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); playClick(); handleQuestAction(btn.dataset.id, btn.dataset.action); });
  });
  return card;
}

function renderDashboard() {
  const grid = document.getElementById('active-quest-grid');
  const active = allQuests.filter(q => q.status === 'active');
  const filtered = currentFilter === 'all' ? active : active.filter(q => q.quest_type === currentFilter);
  grid.innerHTML = '';
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">◈</div><div class="empty-text">No active contracts.<br/>You're either very efficient or very dead.</div></div>`;
    return;
  }
  filtered.forEach(q => grid.appendChild(buildQuestCard(q)));
}

function renderCompleted() {
  const grid = document.getElementById('completed-grid');
  const done = allQuests.filter(q => q.status === 'completed' || q.status === 'failed');
  grid.innerHTML = '';
  if (!done.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">◈</div><div class="empty-text">No archived contracts.</div></div>`;
    return;
  }
  done.forEach(q => grid.appendChild(buildQuestCard(q, true)));
}

async function renderNPCs() {
  const grid = document.getElementById('npc-grid');
  document.getElementById('npc-detail-panel').classList.add('hidden');
  grid.style.display = '';
  grid.innerHTML = '';
  try {
    const npcs = await fetchNPCs();
    if (!npcs.length) { grid.innerHTML = `<div class="empty-state"><div class="empty-icon">◈</div><div class="empty-text">No fixers on record yet.</div></div>`; return; }
    npcs.forEach(npc => {
      const card = document.createElement('div');
      card.className = 'npc-card';
      card.innerHTML = `<div class="npc-card-name">${escHtml(npc.name)}</div>
        <div class="npc-stats">
          <div class="npc-stat">TOTAL: <span>${npc.total}</span></div>
          <div class="npc-stat">ACTIVE: <span>${npc.active}</span></div>
          <div class="npc-stat">DONE: <span>${npc.completed}</span></div>
          <div class="npc-stat">FAILED: <span>${npc.failed}</span></div>
        </div>`;
      card.addEventListener('click', () => { playNav(); showNPCDetail(npc.name); });
      grid.appendChild(card);
    });
  } catch(e) { grid.innerHTML = `<div class="empty-state"><div class="empty-text">Error loading fixers.</div></div>`; }
}

async function showNPCDetail(name) {
  document.getElementById('npc-grid').style.display = 'none';
  const detail = document.getElementById('npc-detail-panel');
  const list = document.getElementById('npc-quest-list');
  detail.classList.remove('hidden');
  document.getElementById('npc-detail-name').textContent = name.toUpperCase();
  list.innerHTML = `<div class="empty-state"><div class="empty-text">LOADING...</div></div>`;
  const quests = await fetchNPCQuests(name);
  list.innerHTML = '';
  if (!quests.length) { list.innerHTML = `<div class="empty-state"><div class="empty-text">No contracts for this fixer.</div></div>`; return; }
  quests.forEach(q => {
    const card = buildQuestCard(q, true);
    list.appendChild(card);
  });
}

/* ── QUEST ACTIONS ────────────────────────────────────────────────── */
async function handleQuestAction(id, action, afterCallback = null) {
  if (action === 'delete') {
    if (!confirm('Purge this contract from the record?')) return;
    await deleteQuest(id);
    allQuests = allQuests.filter(q => q.id != id);
    refreshCurrentView();
    return;
  }
  try {
    const result = await updateQuestStatus(id, action);
    const idx = allQuests.findIndex(q => q.id == id);
    if (idx !== -1) allQuests[idx] = result.quest;
    player = result.player;
    renderPlayer();

    if (action === 'completed') { playSuccess(); showXPFlash(`+${result.xp_delta} XP`); }
    else if (action === 'failed') { playFail(); }
    else { playNav(); }

    // Determine chat message class
    const evtClass = action === 'completed' ? 'event-completed' : action === 'failed' ? 'event-failed' : '';
    const label = action === 'completed' ? 'CONTRACT CLOSED' : action === 'failed' ? 'CONTRACT FAILED' : 'STATUS UPDATE';
    pushAL107Message(result.al107_message, evtClass, label);

    refreshCurrentView();
    if (afterCallback) afterCallback();
  } catch(e) { console.error('Action failed:', e); }
}

function refreshCurrentView() {
  if (currentView === 'dashboard') renderDashboard();
  else if (currentView === 'completed') renderCompleted();
  else if (currentView === 'npc') renderNPCs();
}

/* ── AL-107 CHAT ──────────────────────────────────────────────────── */
function pushAL107Message(text, extraClass = '', label = 'AL-107') {
  const container = document.getElementById('al107-messages');
  const wrap = document.createElement('div');
  wrap.className = `al107-msg ${extraClass}`;

  const labelClass = extraClass.includes('failed') ? 'fail-label'
    : extraClass.includes('completed') ? 'complete-label'
    : extraClass.includes('personal') ? 'personal-label' : '';

  const now = new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
  wrap.innerHTML = `
    <div class="msg-bubble">${escHtml(text)}</div>
    <div class="msg-meta"><span class="msg-label ${labelClass}">${label}</span>${now}</div>
  `;
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;

  // Unread badge if chat is closed
  if (!chatOpen) {
    unreadCount++;
    const badge = document.getElementById('al107-unread');
    badge.style.display = 'flex';
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
  }
}

function pushUserMessage(text) {
  const container = document.getElementById('al107-messages');
  const wrap = document.createElement('div');
  wrap.className = 'user-msg';
  const now = new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
  wrap.innerHTML = `
    <div class="msg-bubble">${escHtml(text)}</div>
    <div class="msg-meta">YOU · ${now}</div>
  `;
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
  const container = document.getElementById('al107-messages');
  const el = document.createElement('div');
  el.className = 'al107-typing'; el.id = 'typing-indicator';
  el.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

async function handleChatSend() {
  const input = document.getElementById('al107-input');
  const text = input.value.trim();
  if (!text) return;

  const sendBtn = document.getElementById('al107-send');
  const sendTxt = document.getElementById('al107-send-txt');
  const sendSpin = document.getElementById('al107-send-spin');

  input.value = '';
  input.style.height = 'auto';
  pushUserMessage(text);
  playSend();

  // Add to local history for context
  chatHistory.push({ role: 'user', content: text });

  sendBtn.disabled = true;
  sendTxt.classList.add('hidden');
  sendSpin.classList.remove('hidden');
  showTypingIndicator();

  try {
    const result = await sendChatMessage(text);
    removeTypingIndicator();
    pushAL107Message(result.reply, '', 'AL-107');
    chatHistory.push({ role: 'assistant', content: result.reply });
    // Keep history from growing too large
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-16);
  } catch(e) {
    removeTypingIndicator();
    pushAL107Message('Signal lost. Try again.', '', 'AL-107 // ERROR');
  } finally {
    sendBtn.disabled = false;
    sendTxt.classList.remove('hidden');
    sendSpin.classList.add('hidden');
  }
}

function openChat() {
  document.getElementById('al107-panel').classList.remove('hidden');
  chatOpen = true;
  unreadCount = 0;
  document.getElementById('al107-unread').style.display = 'none';
  setTimeout(() => {
    const container = document.getElementById('al107-messages');
    container.scrollTop = container.scrollHeight;
    document.getElementById('al107-input').focus();
  }, 50);
}

function closeChat() {
  document.getElementById('al107-panel').classList.add('hidden');
  chatOpen = false;
}

/* ── QUEST ACCEPTED ───────────────────────────────────────────────── */
function showQuestAccepted(title, desc) {
  const overlay = document.getElementById('quest-accepted-overlay');
  document.getElementById('qa-title').textContent = title;
  document.getElementById('qa-sub').textContent = desc ? desc.slice(0, 120) + '...' : '';
  overlay.classList.remove('hidden');
  playSuccess();
  setTimeout(() => overlay.classList.add('hidden'), 2800);
}

/* ── XP FLASH ─────────────────────────────────────────────────────── */
function showXPFlash(text) {
  const el = document.createElement('div');
  el.className = 'xp-flash';
  el.textContent = text;
  el.style.cssText = `left:${window.innerWidth/2}px;top:${window.innerHeight/2}px;transform:translateX(-50%);`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

/* ── ADD QUEST MODAL ─────────────────────────────────────────────── */
function openModal() { document.getElementById('add-quest-modal').classList.remove('hidden'); document.getElementById('f-raw-task').focus(); playNav(); }
function closeModal() {
  document.getElementById('add-quest-modal').classList.add('hidden');
  document.getElementById('f-raw-task').value = '';
  document.getElementById('f-npc').value = '';
  document.getElementById('f-xp').value = '100';
  setQuestType('side');
}
function setQuestType(type) {
  selectedQuestType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
}

async function submitQuest() {
  const rawTask = document.getElementById('f-raw-task').value.trim();
  if (!rawTask) { document.getElementById('f-raw-task').focus(); return; }
  const npc = document.getElementById('f-npc').value.trim() || null;
  const xp = parseInt(document.getElementById('f-xp').value) || 100;

  const submitBtn = document.getElementById('submit-quest');
  const submitText = document.getElementById('submit-text');
  const spinner = document.getElementById('submit-spinner');
  submitBtn.disabled = true; submitText.classList.add('hidden'); spinner.classList.remove('hidden');

  try {
    const result = await createQuest({ raw_task: rawTask, npc, quest_type: selectedQuestType, xp_reward: xp });
    allQuests.unshift(result.quest);
    closeModal();

    // Quest accepted animation
    showQuestAccepted(result.quest.title, result.quest.description);

    // Fixer-style briefing message in chat (delayed so the overlay shows first)
    setTimeout(() => {
      const evtClass = selectedQuestType === 'personal' ? 'briefing event-personal' : 'briefing';
      pushAL107Message(result.al107_briefing, evtClass, 'CONTRACT BRIEFING');
      if (!chatOpen) openChat();
    }, 1200);

    renderDashboard();
  } catch(e) {
    alert('TRANSMISSION FAILED. Check your connection and try again.');
  } finally {
    submitBtn.disabled = false; submitText.classList.remove('hidden'); spinner.classList.add('hidden');
  }
}

/* ── NAV ──────────────────────────────────────────────────────────── */
function switchView(view) {
  playNav();
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.getElementById(`view-${view}`).classList.add('active');
  if (view === 'completed') renderCompleted();
  else if (view === 'npc') renderNPCs();
  else renderDashboard();
}

/* ── UTILITY ──────────────────────────────────────────────────────── */
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── EVENTS ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  runBoot();

  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

  document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', () => {
    playClick();
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === currentFilter));
    renderDashboard();
  }));

  document.getElementById('open-add-quest').addEventListener('click', () => { playClick(); openModal(); });
  document.getElementById('modal-close').addEventListener('click', () => { playClick(); closeModal(); });
  document.getElementById('modal-cancel').addEventListener('click', () => { playClick(); closeModal(); });
  document.getElementById('submit-quest').addEventListener('click', submitQuest);
  document.getElementById('add-quest-modal').addEventListener('click', e => { if (e.target.id === 'add-quest-modal') closeModal(); });
  document.getElementById('f-raw-task').addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) submitQuest(); });

  document.querySelectorAll('.type-btn').forEach(btn => btn.addEventListener('click', () => { playClick(); setQuestType(btn.dataset.type); }));

  document.getElementById('al107-toggle').addEventListener('click', () => {
    playClick();
    chatOpen ? closeChat() : openChat();
  });
  document.getElementById('al107-close').addEventListener('click', () => { playClick(); closeChat(); });

  document.getElementById('al107-send').addEventListener('click', handleChatSend);
  document.getElementById('al107-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
  });

  document.getElementById('npc-back').addEventListener('click', () => {
    playNav();
    document.getElementById('npc-detail-panel').classList.add('hidden');
    document.getElementById('npc-grid').style.display = '';
  });
});

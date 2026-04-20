# Agency Hub — Two Patches to Apply in GitHub

Both patches go in your `index.html` (or whatever your hub file is named).

---

## PATCH 1 — Add Damon's Content Review button to his card

**Find this exact line** in `buildAgentGrid()`:
```
        <button class="chat-btn" onclick="selectAgent('${agent.id}')">Open Chat →</button>
```

**Replace with:**
```
        <button class="chat-btn" onclick="selectAgent('${agent.id}')">Open Chat →</button>
        ${agent.id === 'damon' ? '<button class="chat-btn" style="margin-top:6px;border-color:var(--pink);color:var(--pink);" onclick="event.stopPropagation();window.open(\'damon-content-review.html\',\'_blank\')">✦ Content Review ↗</button>' : ''}
```

---

## PATCH 2 — Add the missing selectAgent(), addMessage(), removeTyping(), and sendMessage() functions

**Find this exact line** near the very bottom of your `<script>` block:
```
window.onload = init;
```

**Replace with the entire block below** (this replaces that one line and adds all the missing functions above it):

```javascript
// ============================================================
// SELECT AGENT — opens inline DM chat from team grid
// ============================================================
function selectAgent(agentId) {
  activeAgent = agentId;
  const agent = AGENTS.find(a => a.id === agentId);

  // Highlight active card
  document.querySelectorAll('.agent-card').forEach(c => c.classList.remove('active-chat'));
  const card = document.getElementById('card-' + agentId);
  if (card) card.classList.add('active-chat');

  // Show inline chat panel
  const wrap = document.getElementById('inlineChatWrap');
  wrap.style.display = 'block';

  // Update chat header
  const header = document.getElementById('inlineChatHeader');
  header.innerHTML =
    '<img src="data:image/jpeg;base64,' + PHOTOS[agent.photo] + '" alt="' + agent.name + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);">' +
    '<div><div class="chat-header-name">' + agent.name + '</div><div class="chat-header-role">' + agent.role + '</div></div>';

  // Reset chat history
  const msgs = document.getElementById('chatMessages');
  msgs.innerHTML = '';
  chatHistory = [];

  // Fire greeting
  sendGreeting(agentId);
}

async function sendGreeting(agentId) {
  if (!apiKey) {
    addMessage('agent', 'Set your API key first — hit the ⚿ API Key button in the header.', agentId);
    return;
  }
  const agent = AGENTS.find(a => a.id === agentId);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const start = new Date('2026-04-11');
  const day = Math.max(1, Math.floor((new Date() - start) / (1000*60*60*24)) + 1);

  addMessage('typing', null, agentId);
  try {
    const response = await fetch('/.netlify/functions/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 120,
        system: agent.systemPrompt + buildMemoryContext(agentId) + ' Today is ' + today + ', Day ' + day + '. Gina just opened a DM with you. Greet her in 1-2 sentences, fully in character. No markdown, no lists.',
        messages: [{ role: 'user', content: 'Hey' }]
      })
    });
    const data = await response.json();
    removeTyping();
    const text = data.content[0].text.trim();
    addMessage('agent', text, agentId);
    chatHistory = [{ role: 'user', content: 'Hey' }, { role: 'assistant', content: text }];
  } catch(e) {
    removeTyping();
    addMessage('agent', 'Ready when you are.', agentId);
  }
}

function addMessage(type, content, agentId) {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');

  if (type === 'typing') {
    div.className = 'msg agent';
    div.id = 'typing-indicator';
    const agent = AGENTS.find(a => a.id === agentId);
    div.innerHTML =
      '<img class="msg-avatar" src="data:image/jpeg;base64,' + PHOTOS[agent.photo] + '" alt="' + agent.name + '">' +
      '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
  } else if (type === 'user') {
    div.className = 'msg user';
    div.innerHTML = '<div class="msg-bubble">' + content + '</div><img class="msg-avatar" src="data:image/jpeg;base64,' + PHOTOS.gina + '" alt="Gina">';
  } else if (type === 'agent') {
    const agent = AGENTS.find(a => a.id === agentId);
    div.className = 'msg agent';
    div.innerHTML =
      '<img class="msg-avatar" src="data:image/jpeg;base64,' + PHOTOS[agent.photo] + '" alt="' + agent.name + '">' +
      '<div class="msg-bubble">' + content + '</div>';
  }

  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

async function sendMessage() {
  if (!apiKey) { openModal(); return; }
  if (!activeAgent) return;

  const input = document.getElementById('chatInput');
  const btn = document.getElementById('sendBtn');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  btn.disabled = true;
  addMessage('user', text, activeAgent);
  chatHistory.push({ role: 'user', content: text });

  const agent = AGENTS.find(a => a.id === activeAgent);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const start = new Date('2026-04-11');
  const day = Math.max(1, Math.floor((new Date() - start) / (1000*60*60*24)) + 1);

  addMessage('typing', null, activeAgent);

  try {
    const response = await fetch('/.netlify/functions/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: agent.systemPrompt + getMasterMemoryContext() + buildMemoryContext(activeAgent) +
          ' Today is ' + today + ', Day ' + day + '. Direct message from Gina. Be concise, direct, in character. No markdown unless writing an actual document.',
        messages: chatHistory
      })
    });
    const data = await response.json();
    removeTyping();
    const reply = data.content[0].text.trim();
    addMessage('agent', reply, activeAgent);
    chatHistory.push({ role: 'assistant', content: reply });
  } catch(e) {
    removeTyping();
    addMessage('agent', 'Error: ' + e.message, activeAgent);
  }
  btn.disabled = false;
}

window.onload = init;
```

---

## After patching

1. Commit both changes to GitHub
2. Make sure `damon-content-review.html` is in the **same root folder** as your hub file in the repo
3. Netlify will deploy both — the Content Review button will open in a new tab

That's it. Two find-and-replace operations.

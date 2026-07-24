// AI Lead Engine — Support Chatbot Widget
// Self-contained: injects a floating chat button + panel into any page.
// Usage: <script src="/assets/chatbot-widget.js"></script>
(function () {
  if (window.__chatbotInjected) return;
  window.__chatbotInjected = true;

  var history = [];
  var isOpen = false;
  var isTyping = false;

  // ── Styles ──────────────────────────────────────────────────────────────
  var css = `
#chatbot-fab{position:fixed;bottom:24px;right:24px;z-index:99999;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#6f2bff,#4c1fb3);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(102,31,255,.4);display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s}
#chatbot-fab:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(102,31,255,.55)}
#chatbot-fab svg{width:28px;height:28px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#chatbot-fab .chatbot-badge{position:absolute;top:-2px;right:-2px;width:18px;height:18px;background:#22c55e;border-radius:50%;border:2px solid #0a0a1f;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:700}
#chatbot-panel{position:fixed;bottom:96px;right:24px;z-index:99999;width:380px;max-width:calc(100vw - 48px);height:560px;max-height:calc(100vh - 130px);background:#0f0f1f;border:1px solid #1f2937;border-radius:16px;display:none;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.5);font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif}
#chatbot-panel.open{display:flex;animation:chatbotSlideIn .25s ease}
@keyframes chatbotSlideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
#chatbot-header{background:linear-gradient(135deg,#6f2bff,#4c1fb3);padding:16px 20px;display:flex;align-items:center;gap:12px;flex-shrink:0}
#chatbot-header .avatar{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
#chatbot-header .info{flex:1;min-width:0}
#chatbot-header .title{color:#fff;font-weight:700;font-size:15px;line-height:1.2}
#chatbot-header .status{color:rgba(255,255,255,.7);font-size:11px;display:flex;align-items:center;gap:5px}
#chatbot-header .status .dot{width:7px;height:7px;background:#22c55e;border-radius:50%;display:inline-block}
#chatbot-header .close-btn{background:none;border:none;color:#fff;cursor:pointer;padding:4px;opacity:.7;transition:opacity .2s;flex-shrink:0}
#chatbot-header .close-btn:hover{opacity:1}
#chatbot-header .close-btn svg{width:20px;height:20px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#chatbot-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin;scrollbar-color:#374151 transparent}
#chatbot-messages::-webkit-scrollbar{width:6px}
#chatbot-messages::-webkit-scrollbar-track{background:transparent}
#chatbot-messages::-webkit-scrollbar-thumb{background:#374151;border-radius:3px}
#chatbot-messages .msg{max-width:85%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5;word-wrap:break-word;white-space:pre-wrap}
#chatbot-messages .msg.bot{background:#1a1a2e;color:#e7e8f0;border-bottom-left-radius:4px;align-self:flex-start}
#chatbot-messages .msg.user{background:linear-gradient(135deg,#6f2bff,#4c1fb3);color:#fff;border-bottom-right-radius:4px;align-self:flex-end}
#chatbot-messages .msg.error{background:#3b1515;border:1px solid #7f1d1d;color:#fca5a5}
#chatbot-messages .typing{display:flex;gap:4px;padding:10px 14px;background:#1a1a2e;border-radius:12px;border-bottom-left-radius:4px;align-self:flex-start}
#chatbot-messages .typing span{width:7px;height:7px;background:#6b7280;border-radius:50%;animation:chatbotBounce 1.4s infinite ease-in-out both}
#chatbot-messages .typing span:nth-child(1){animation-delay:-.32s}
#chatbot-messages .typing span:nth-child(2){animation-delay:-.16s}
@keyframes chatbotBounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
#chatbot-suggestions{padding:0 16px 8px;display:flex;flex-wrap:wrap;gap:6px;flex-shrink:0}
#chatbot-suggestions .chip{background:#1a1a2e;border:1px solid #2a2b3d;color:#9ca3af;font-size:12px;padding:6px 12px;border-radius:20px;cursor:pointer;transition:all .2s;font-family:inherit}
#chatbot-suggestions .chip:hover{border-color:#6f2bff;color:#e7e8f0}
#chatbot-input-area{padding:12px 16px 16px;border-top:1px solid #1f2937;display:flex;gap:8px;flex-shrink:0;background:#0f0f1f}
#chatbot-input{flex:1;background:#111827;border:1px solid #374151;border-radius:10px;padding:10px 14px;font-size:14px;color:#fff;outline:none;transition:border-color .2s;font-family:inherit;resize:none;max-height:80px;min-height:42px;line-height:1.4}
#chatbot-input:focus{border-color:#6f2bff}
#chatbot-input::placeholder{color:#6b7280}
#chatbot-send{background:linear-gradient(135deg,#6f2bff,#4c1fb3);border:none;border-radius:10px;padding:0 16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .2s}
#chatbot-send:hover{opacity:.85}
#chatbot-send:disabled{opacity:.4;cursor:not-allowed}
#chatbot-send svg{width:20px;height:20px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#chatbot-footer{padding:6px 16px 10px;text-align:center;font-size:10px;color:#4b5563;flex-shrink:0}
#chatbot-footer a{color:#6b7280;text-decoration:none}
#chatbot-footer a:hover{text-decoration:underline}
@media(max-width:480px){
#chatbot-panel{right:0;bottom:0;width:100vw;height:100vh;max-height:100vh;border-radius:0;border:none}
#chatbot-fab{bottom:16px;right:16px}
}
`;

  // ── Inject CSS ──────────────────────────────────────────────────────────
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── Create FAB (floating action button) ─────────────────────────────────
  var fab = document.createElement('button');
  fab.id = 'chatbot-fab';
  fab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span class="chatbot-badge">1</span>';
  document.body.appendChild(fab);

  // ── Create Chat Panel ───────────────────────────────────────────────────
  var panel = document.createElement('div');
  panel.id = 'chatbot-panel';
  panel.innerHTML = `
<div id="chatbot-header">
  <div class="avatar">&#9889;</div>
  <div class="info">
    <div class="title">AI Lead Engine Support</div>
    <div class="status"><span class="dot"></span> Online — AI-powered</div>
  </div>
  <button class="close-btn" id="chatbot-close" aria-label="Close chat">
    <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
</div>
<div id="chatbot-messages">
  <div class="msg bot">Hi there! &#128075; I'm the AI Lead Engine support assistant. I can help you with questions about pricing, features, login issues, dashboard access, and more. What can I help you with today?</div>
</div>
<div id="chatbot-suggestions">
  <span class="chip" data-q="What are the pricing tiers?">What are the pricing tiers?</span>
  <span class="chip" data-q="How do I log in?">How do I log in?</span>
  <span class="chip" data-q="What is the DFY Vault?">What is the DFY Vault?</span>
  <span class="chip" data-q="How do I get a refund?">How do I get a refund?</span>
</div>
<div id="chatbot-input-area">
  <textarea id="chatbot-input" placeholder="Type your message..." rows="1"></textarea>
  <button id="chatbot-send" aria-label="Send message">
    <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
  </button>
</div>
<div id="chatbot-footer">Powered by DeepSeek AI &middot; <a href="mailto:support@admexo.com">support@admexo.com</a></div>
`;
  document.body.appendChild(panel);

  // Hide badge after first open
  var badge = fab.querySelector('.chatbot-badge');
  var badgeHidden = false;

  // ── Toggle panel ────────────────────────────────────────────────────────
  function togglePanel() {
    isOpen = !isOpen;
    if (isOpen) {
      panel.classList.add('open');
      if (badge && !badgeHidden) { badge.style.display = 'none'; badgeHidden = true; }
      setTimeout(function () { document.getElementById('chatbot-input').focus(); }, 100);
    } else {
      panel.classList.remove('open');
    }
  }

  fab.addEventListener('click', togglePanel);
  document.getElementById('chatbot-close').addEventListener('click', togglePanel);

  // ── Suggestions ─────────────────────────────────────────────────────────
  document.querySelectorAll('#chatbot-suggestions .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var q = chip.getAttribute('data-q');
      document.getElementById('chatbot-input').value = q;
      sendMessage();
      document.getElementById('chatbot-suggestions').style.display = 'none';
    });
  });

  // ── Auto-resize textarea ────────────────────────────────────────────────
  var input = document.getElementById('chatbot-input');
  input.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  // Enter to send (Shift+Enter for newline)
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('chatbot-send').addEventListener('click', sendMessage);

  // ── Scroll to bottom ────────────────────────────────────────────────────
  function scrollToBottom() {
    var msgs = document.getElementById('chatbot-messages');
    msgs.scrollTop = msgs.scrollHeight;
  }

  // ── Add message to DOM ──────────────────────────────────────────────────
  function addMessage(text, type) {
    var msgs = document.getElementById('chatbot-messages');
    var div = document.createElement('div');
    div.className = 'msg ' + type;
    div.textContent = text;
    msgs.appendChild(div);
    scrollToBottom();
    return div;
  }

  // ── Show typing indicator ───────────────────────────────────────────────
  function showTyping() {
    var msgs = document.getElementById('chatbot-messages');
    var div = document.createElement('div');
    div.className = 'typing';
    div.id = 'chatbot-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(div);
    scrollToBottom();
  }

  function hideTyping() {
    var el = document.getElementById('chatbot-typing');
    if (el) el.remove();
  }

  // ── Send message to API ─────────────────────────────────────────────────
  function sendMessage() {
    var text = input.value.trim();
    if (!text || isTyping) return;

    addMessage(text, 'user');
    history.push({ role: 'user', content: text });
    input.value = '';
    input.style.height = 'auto';

    // Hide suggestions after first message
    var sug = document.getElementById('chatbot-suggestions');
    if (sug) sug.style.display = 'none';

    isTyping = true;
    document.getElementById('chatbot-send').disabled = true;
    showTyping();

    fetch('/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history.slice(-10) }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        hideTyping();
        isTyping = false;
        document.getElementById('chatbot-send').disabled = false;
        if (data.error) {
          addMessage(data.error, 'error');
        } else {
          var reply = data.reply || 'Sorry, I could not process that. Please try again or contact support@admexo.com.';
          addMessage(reply, 'bot');
          history.push({ role: 'assistant', content: reply });
        }
        input.focus();
      })
      .catch(function () {
        hideTyping();
        isTyping = false;
        document.getElementById('chatbot-send').disabled = false;
        addMessage('Connection error. Please try again or email support@admexo.com.', 'error');
        input.focus();
      });
  }
})();

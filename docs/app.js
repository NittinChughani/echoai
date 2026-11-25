/* ECHO public website — no accounts, no paid keys in the browser, no tracking. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const els = {
    sidebar: $('sidebar'), scrim: $('sidebar-scrim'), history: $('chat-history'),
    chatCount: $('chat-count'), search: $('search-chats'), title: $('current-title'),
    welcome: $('welcome'), view: $('conversation-view'), messages: $('messages'),
    input: $('message-input'), send: $('send-button'), stop: $('stop-button'),
    model: $('model-select'), theme: $('theme-toggle'), settings: $('settings-dialog'),
    instructions: $('instructions-input'), toast: $('toast'), presence: document.querySelector('.presence-pill')
  };
  const DATA_KEY = 'echo-chat-v2';
  const PREF_KEY = 'echo-prefs-v2';
  const MAX_CHATS = 35;
  // For GitHub Pages: browser files are static; the Worker provides AI responses.
  // No secret keys are stored or sent to visitors.
  const useCloudflare = window.ECHO_CONFIG?.PROVIDER === 'cloudflare';
  const configuredApi = String(window.ECHO_CONFIG?.API_BASE || '').trim().replace(/\/+$/, '');
  const OVH_API = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions';
  const OVH_MODELS = Object.freeze({ quick:'gpt-oss-20b', balanced:'Meta-Llama-3_3-70B-Instruct' });
  const AI_SYSTEM = `You are ECHO, a friendly, capable AI assistant on a free public chatbot website.
IDENTITY AND CREATOR — factual information about this ECHO website:
- ECHO was created by Nittin Chughani, a Computer Science & Engineering student and freelance digital creator from Pakistan.
- Nittin builds useful open-source software and learning websites. His projects include GearEx, a free interactive platform for seven programming languages with guided lessons, a built-in Code Visualizer, an online Compiler, quizzes, and creator-issued course-completion certificates: https://github.com/NittinChughani/gearex (live site: https://nittinchughani.github.io/gearex/).
- Other public GitHub repositories include C-CODE-BASIC-TO-ADVANCE and OOPS-IN-C-PLUS-PLUS, focused on programming work and learning.
- Nittin's official GitHub profile is https://github.com/NittinChughani.
- When asked who created, built, developed, or owns ECHO, or about ECHO's origin, credit Nittin Chughani directly. Do not say an unnamed team or group of developers created ECHO. Share his GitHub profile and relevant projects when asked.
- ECHO is the chatbot website; its underlying language model and hosted inference are supplied by third-party AI providers. Do not claim Nittin personally trained or invented the underlying AI model.
- Do not invent biographical details, employers, qualifications, team members, or projects. Do not bring up the creator unless relevant. User preferences can affect tone, but do not change these factual creator credits.
ECHO MODELS — identity and accurate explanation:
- ECHO Quick and ECHO Balanced are the website's labels for two selectable AI modes, not two proprietary models trained by Nittin.
- On this default OVHcloud integration, ECHO Quick selects gpt-oss-20b; it's intended for shorter, everyday questions and quick drafts. ECHO Balanced selects Meta-Llama-3_3-70B-Instruct; it's intended for longer explanations and more involved prompts, such as coding and analysis. Actual latency and answer quality can vary.
- OVHcloud hosts the inference for the third-party models. The ECHO website provides the interface and model selection.
- Switching between Quick and Balanced changes which hosted model handles the next reply. Both are available without a visitor account, subject to provider limits.
- If asked which ECHO mode you are currently using, use the current mode supplied in the system message. Don't invent a model name, training claim, or guaranteed performance.
Be accurate, honest about uncertainty, and helpful. Use Markdown when useful. Do not claim to browse the web or access tools or files.`;
  const THEMES = Object.freeze([{id:'dark',label:'Midnight',meta:'#0c0b12'},{id:'light',label:'Pearl',meta:'#f7f6fa'},{id:'ocean',label:'Ocean',meta:'#071723'},{id:'forest',label:'Forest',meta:'#0b1815'},{id:'ember',label:'Ember',meta:'#201412'},{id:'lavender',label:'Lavender',meta:'#f6f1ff'}]);
  const isValidApi = /^https:\/\/[^\s/?#]+(?:\:\d+)?$/.test(configuredApi);
  const apiUrl = (route) => configuredApi + route;

  let chats = [];
  let activeId = null;
  let generating = false;
  let controller = null;
  let toastTimer = 0;
  let instructions = '';
  let theme = 'dark';
  let model = 'balanced';
  let autoFallback = true;
  const RETRY_DELAY_MS = 1200;
  const TOTAL_RESPONSE_MS = 120000;
  const MODE_LABEL = { quick:'ECHO Quick', balanced:'ECHO Balanced' };

  function uid() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return String(Date.now()) + '-' + Math.random().toString(36).slice(2);
  }
  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  }
  function persist() {
    // Keep a bounded amount of history because browsers impose storage limits.
    try {
      const data = chats.slice(0, MAX_CHATS).map(c => ({
        id: c.id, title: c.title, updated: c.updated,
        messages: c.messages.filter(m => m.status === 'done' || m.role === 'user').slice(-55)
          .map(m => ({ role: m.role, content: m.content, ...(m.actualMode ? {actualMode:m.actualMode, requestedMode:m.requestedMode} : {}), ...(m.interrupted ? {interrupted:true} : {}) }))
      }));
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
      localStorage.setItem(PREF_KEY, JSON.stringify({ theme, model, instructions, autoFallback }));
    } catch { showToast('Browser storage is full or unavailable. Export your chat to keep it.'); }
  }
  function load() {
    const saved = readJson(DATA_KEY, []);
    if (Array.isArray(saved)) chats = saved.filter(c => c && typeof c.id === 'string' && typeof c.title === 'string' && Array.isArray(c.messages))
      .slice(0, MAX_CHATS).map(c => ({
        id: c.id, title: c.title.slice(0, 100), updated: Number(c.updated) || Date.now(),
        messages: c.messages.filter(m => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string')
          .slice(-55).map(m => ({ role: m.role, content: m.content.slice(0, 6500), status: 'done', ...(m.role === 'assistant' && Object.hasOwn(MODE_LABEL,m.actualMode) ? {actualMode:m.actualMode, requestedMode:Object.hasOwn(MODE_LABEL,m.requestedMode)?m.requestedMode:m.actualMode} : {}), ...(m.role === 'assistant' && m.interrupted === true ? {interrupted:true} : {}) }))
      }));
    const prefs = readJson(PREF_KEY, {});
    if (THEMES.some(option => option.id === prefs.theme)) theme = prefs.theme;
    if (prefs.model === 'quick') model = 'quick';
    autoFallback = prefs.autoFallback !== false;
    $('auto-model-fallback').checked = autoFallback;
    if (typeof prefs.instructions === 'string') instructions = prefs.instructions.slice(0, 1200);
    applyTheme();
    els.model.value = model;
    els.instructions.value = instructions;
  }
  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add('show');
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200);
  }
  function activeChat() { return chats.find(c => c.id === activeId) || null; }
  function icon(name) { return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`; }
  function escapeHtml(value) {
    return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function inlineMarkdown(input) {
    let s = escapeHtml(input);
    // Links accept HTTP(S) only and are fully escaped, avoiding unsafe URL schemes.
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s<>)]+)\)/gi,
      (_, label, href) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`);
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    return s;
  }
  function renderTextBlock(text) {
    const lines = String(text).split('\n');
    let output = '';
    let listType = null;
    let paragraph = [];
    function finishParagraph() {
      if (paragraph.length) { output += `<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`; paragraph = []; }
    }
    function finishList() { if (listType) { output += `</${listType}>`; listType = null; } }
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { finishParagraph(); finishList(); continue; }
      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
      const bullet = trimmed.match(/^[-*]\s+(.+)$/);
      const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
      const quote = trimmed.match(/^>\s*(.*)$/);
      if (heading) { finishParagraph(); finishList(); output += `<h${Math.min(3, heading[1].length + 1)}>${inlineMarkdown(heading[2])}</h${Math.min(3, heading[1].length + 1)}>`; }
      else if (bullet || numbered) {
        finishParagraph(); const nextType = bullet ? 'ul' : 'ol';
        if (listType !== nextType) { finishList(); output += `<${nextType}>`; listType = nextType; }
        output += `<li>${inlineMarkdown((bullet || numbered)[1])}</li>`;
      } else if (quote) { finishParagraph(); finishList(); output += `<blockquote>${inlineMarkdown(quote[1])}</blockquote>`; }
      else { finishList(); paragraph.push(trimmed); }
    }
    finishParagraph(); finishList();
    return output;
  }
  function markdown(input) {
    // Escape all user/model output before adding a small allowlist of markup.
    const src = String(input || '');
    const re = /```([^`\n]*)\n([\s\S]*?)```/g;
    let out = '', index = 0, match;
    while ((match = re.exec(src))) {
      out += renderTextBlock(src.slice(index, match.index));
      const language = match[1].trim().slice(0, 35) || 'code';
      const code = match[2].replace(/\n$/, '');
      out += `<pre><span class="code-label">${escapeHtml(language)}<button type="button" class="code-copy">Copy code</button></span><code>${escapeHtml(code)}</code></pre>`;
      index = match.index + match[0].length;
    }
    out += renderTextBlock(src.slice(index));
    return out || '<p></p>';
  }

  function applyTheme() {
    const chosen = THEMES.find(option => option.id === theme) || THEMES[0];
    document.documentElement.dataset.theme = chosen.id;
    document.querySelector('#theme-toggle use').setAttribute('href', ['light','lavender'].includes(chosen.id) ? '#i-moon' : '#i-sun');
    document.querySelector('meta[name="theme-color"]').content = chosen.meta;
    els.theme.title = 'Current: ' + chosen.label + ' · click to cycle themes';
    els.theme.setAttribute('aria-label', 'Change theme. Current theme: ' + chosen.label);
    document.querySelectorAll('input[name="theme-choice"]').forEach(input => { input.checked = input.value === chosen.id; });
  }
  function setTheme(nextTheme) {
    if (!THEMES.some(option => option.id === nextTheme)) return;
    theme = nextTheme;
    applyTheme();
    persist();
    showToast(THEMES.find(option => option.id === theme).label + ' theme applied');
  }
  function toggleTheme() {
    const index = THEMES.findIndex(option => option.id === theme);
    setTheme(THEMES[(index + 1) % THEMES.length].id);
  }
  function closeSidebar() { els.sidebar.classList.remove('open'); els.scrim.hidden = true; }
  function openSidebar() { els.sidebar.classList.add('open'); els.scrim.hidden = false; }
  function startNewChat() {
    if (generating) stopGeneration();
    activeId = null;
    els.input.value = '';
    resizeInput();
    updateSend();
    renderAll();
    closeSidebar();
    els.input.focus();
  }
  function openChat(id) {
    if (!chats.some(c => c.id === id)) return;
    if (generating) stopGeneration();
    activeId = id;
    renderAll();
    closeSidebar();
    els.input.focus();
  }
  function deleteChat(id) {
    const chat = chats.find(c => c.id === id);
    if (!chat || !window.confirm(`Delete “${chat.title}”? This cannot be undone.`)) return;
    if (activeId === id && generating) stopGeneration();
    chats = chats.filter(c => c.id !== id);
    if (activeId === id) activeId = null;
    persist(); renderAll(); showToast('Conversation deleted.');
  }
  function renderHistory() {
    els.chatCount.textContent = String(chats.length);
    els.history.replaceChildren();
    const q = els.search.value.toLowerCase().trim();
    const filtered = [...chats].sort((a,b) => b.updated - a.updated).filter(c => c.title.toLowerCase().includes(q));
    if (!filtered.length) {
      const div = document.createElement('div');
      div.className = 'history-empty';
      div.textContent = q ? 'No matching conversations.' : 'Your conversations will appear here.';
      els.history.append(div); return;
    }
    for (const c of filtered) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chat-entry' + (activeId === c.id ? ' active' : '');
      button.innerHTML = `<span class="entry-icon">${icon('message')}</span><span class="entry-title"></span>`;
      button.querySelector('.entry-title').textContent = c.title;
      button.addEventListener('click', () => openChat(c.id));
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'entry-delete'; del.title = 'Delete conversation';
      del.setAttribute('aria-label', `Delete ${c.title}`);
      del.innerHTML = icon('trash');
      del.addEventListener('click', e => { e.stopPropagation(); deleteChat(c.id); });
      // A sibling button instead of nested buttons preserves semantic HTML.
      const row = document.createElement('div');
      row.className = 'chat-entry-row';
      row.append(button, del);
      els.history.append(row);
    }
  }
  function messageNode(message, index, messages) {
    const el = document.createElement('article');
    el.className = `message ${message.role}`;
    el.innerHTML = `<div class="message-avatar">${message.role === 'user' ? 'Y' : '<span class="mini-logo"></span>'}</div><div class="message-body"><div class="message-header">${message.role === 'user' ? 'You' : 'ECHO'}</div><div class="message-content"></div><div class="message-actions"></div></div>`;
    const content = el.querySelector('.message-content');
    if (message.status === 'loading' && !message.content) {
      content.innerHTML = '<span class="thinking-dots" aria-label="ECHO is thinking"><i></i><i></i><i></i></span>';
      if (message.progress) { const note=document.createElement('span'); note.className='recovery-progress'; note.setAttribute('role','status'); note.textContent=message.progress; content.append(note); }
    }
    else if (message.status === 'error') { content.classList.add('message-error'); content.textContent = message.content; }
    else content.innerHTML = markdown(message.content);
    if (message.role === 'assistant' && message.actualMode && MODE_LABEL[message.actualMode]) {
      const tag = document.createElement('span');
      tag.className = 'reply-mode' + (message.actualMode !== message.requestedMode ? ' fallback-mode' : '');
      tag.textContent = MODE_LABEL[message.actualMode] + (message.actualMode !== message.requestedMode ? ' · fallback' : '');
      tag.title = message.actualMode !== message.requestedMode ? 'The selected model was temporarily unavailable. Your preferred mode is unchanged.' : 'Model used for this response';
      el.querySelector('.message-header').append(tag);
    }
    if (message.interrupted) {
      const note=document.createElement('div'); note.className='interrupted-note';
      note.textContent='Response interrupted. The text above has been preserved.';
      content.append(note);
    }
    const actions = el.querySelector('.message-actions');
    if (message.content && message.status === 'done') {
      const copy = document.createElement('button'); copy.type='button';copy.className='message-action';copy.innerHTML=icon('copy')+' Copy';
      copy.addEventListener('click', () => copyText(message.content)); actions.append(copy);
      if (message.role === 'assistant' && index === messages.length - 1) {
        const regenerate = document.createElement('button');regenerate.type='button';regenerate.className='message-action';regenerate.innerHTML=icon('refresh')+' Regenerate';
        regenerate.addEventListener('click', regenerateAnswer);actions.append(regenerate);
      }
    }
    if (message.role === 'assistant' && index === messages.length - 1 && message.status === 'error') {
      const retry = document.createElement('button'); retry.type='button'; retry.className='message-action retry-response';
      retry.innerHTML=icon('refresh')+' Retry response';
      retry.addEventListener('click',regenerateAnswer); actions.append(retry);
    }
    return el;
  }
  function scrollBottom() { els.view.scrollTop = els.view.scrollHeight; }
  function renderMessages() {
    const chat = activeChat();
    els.messages.replaceChildren();
    if (!chat) return;
    chat.messages.forEach((m, i) => els.messages.append(messageNode(m, i, chat.messages)));
    requestAnimationFrame(scrollBottom);
  }
  function renderAll() {
    const chat = activeChat();
    els.title.textContent = chat?.title || 'New conversation';
    els.welcome.hidden = !!chat;
    els.view.hidden = !chat;
    renderHistory();
    renderMessages();
    updateSend();
  }
  function resizeInput() {
    els.input.style.height = 'auto';
    els.input.style.height = Math.min(els.input.scrollHeight, 170) + 'px';
  }
  function updateSend() {
    els.send.disabled = generating || !els.input.value.trim();
    els.send.hidden = generating;
    els.stop.hidden = !generating;
    els.model.disabled = generating;
  }
  async function copyText(value) {
    try { await navigator.clipboard.writeText(value); showToast('Copied to clipboard.'); }
    catch { showToast('Clipboard unavailable. Select the text to copy it.'); }
  }
  function stopGeneration() {
    if (controller) controller.abort();
    controller = null; generating = false;
    const chat = activeChat();
    const last = chat?.messages.at(-1);
    if (last?.role === 'assistant' && last.status === 'loading') {
      if (last.content) { last.status = 'done'; last.interrupted = true; }
      else { last.content = 'Response stopped.'; last.status = 'error'; }
    }
    persist(); renderAll();
  }
  function makeChatIfNeeded(firstPrompt) {
    let chat = activeChat();
    if (chat) return chat;
    chat = {id:uid(),title:firstPrompt.replace(/\s+/g,' ').slice(0,48) || 'New conversation',updated:Date.now(),messages:[]};
    chats.unshift(chat);chats = chats.slice(0, MAX_CHATS);activeId = chat.id;
    return chat;
  }
  function parseSseEvent(raw, onChunk) {
    const lines = raw.split('\n');
    const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n').trim();
    if (!data || data === '[DONE]') return;
    try {
      const item = JSON.parse(data);
      if (item.error) {
        const detail = typeof item.error === 'string' ? item.error : (item.error.message || '');
        throw classifyChatFailure(Number(item.error?.status || 0), detail);
      }
      const delta = typeof item.response === 'string' ? item.response
        : item.choices?.[0]?.delta?.content ?? item.choices?.[0]?.message?.content ?? '';
      if (delta) onChunk(String(delta));
    } catch (e) { if (e instanceof SyntaxError) return; throw e; }
  }
  async function readStream(response, onChunk) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Streaming was interrupted.');
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      buffer = (buffer + decoder.decode(value, {stream:true})).replace(/\r\n/g,'\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const part = buffer.slice(0,boundary);buffer = buffer.slice(boundary+2);
        parseSseEvent(part,onChunk);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) parseSseEvent(buffer,onChunk);
  }
  function updateStreamingMessage(chat, target) {
    if (activeId !== chat.id) return;
    const last = els.messages.lastElementChild;
    if (!last) return;
    const content = last.querySelector('.message-content');
    if (content) content.innerHTML = markdown(target.content);
    scrollBottom();
  }
  class ChatFailure extends Error {
    constructor(message, retryable=false) {
      super(message); this.name='ChatFailure'; this.retryable=retryable;
    }
  }
  function classifyChatFailure(status, detail='') {
    const message=String(detail || '');
    if (/daily|free AI usage allowance|neurons|quota|billing|paid plan|provider plan|not configured/i.test(message)) {
      return new ChatFailure(message || 'ECHO has reached its shared free AI allowance.');
    }
    // All explicit rate limits are respected: no automatic retries or model switching.
    if (status === 429 || /rate.limit|too many requests|capacity|\b429\b/i.test(message)) {
      return new ChatFailure(message || 'ECHO is busy or rate limited. Please try again later.');
    }
    if (status === 401 || status === 403) {
      return new ChatFailure('ECHO cannot access its AI service right now. Please report this issue.');
    }
    const transient = [408,500,502,503,504,520,521,522,523,524].includes(status)
      || /temporarily unavailable|service is busy|empty answer|network|connection|timeout|timed out/i.test(message);
    return new ChatFailure(message || (transient ? 'ECHO could not reach the AI service.' : 'The AI service could not process your message.'), transient);
  }
  function waitForRecovery(signal) {
    return new Promise((resolve,reject)=>{
      if (signal.aborted) { reject(new ChatFailure('Response stopped.')); return; }
      let timer;
      const onAbort=()=>{clearTimeout(timer);signal.removeEventListener('abort',onAbort);reject(new ChatFailure('Response stopped.'));};
      signal.addEventListener('abort',onAbort,{once:true});
      timer=setTimeout(()=>{signal.removeEventListener('abort',onAbort);resolve();},RETRY_DELAY_MS);
    });
  }
  function setRecoveryProgress(chat,target,message) {
    target.progress=message;
    if (activeId === chat.id) renderMessages();
  }
  async function performChatAttempt(chat,target,requestMessages,attemptMode,preference,signal,timeoutMs) {
    const attemptController = new AbortController();
    let timedOut=false;
    const onAbort=()=>attemptController.abort();
    signal.addEventListener('abort',onAbort,{once:true});
    if (signal.aborted) onAbort();
    const timer=setTimeout(()=>{timedOut=true;attemptController.abort();},timeoutMs);
    try {
      const endpoint = useCloudflare ? apiUrl('/api/chat') : OVH_API;
      const cloudMessages=[];
      let contextChars=0;
      for(let i=requestMessages.length-1;i>=0&&cloudMessages.length<8;i--){
        const m=requestMessages[i];
        if(contextChars+m.content.length>12000) break;
        cloudMessages.unshift(m); contextChars+=m.content.length;
      }
      while(cloudMessages.length&&cloudMessages[0].role!=='user')cloudMessages.shift();
      const payload = useCloudflare ? {messages:cloudMessages,mode:attemptMode,instructions:preference} : {
        model:OVH_MODELS[attemptMode]||OVH_MODELS.quick,
        messages:[
          {role:'system',content:AI_SYSTEM+'\nCurrent selected ECHO mode: '+(attemptMode==='quick'?'Quick (gpt-oss-20b)':'Balanced (Meta-Llama-3_3-70B-Instruct)')+(preference?'\nStyle preference: '+preference:'')},
          ...requestMessages
        ],
        stream:true,max_tokens:attemptMode==='quick'?850:1100
      };
      const response=await fetch(endpoint,{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify(payload),signal:attemptController.signal
      });
      if(!response.ok){
        const data=await response.json().catch(()=>({}));
        const detail=typeof data.error==='string'?data.error:data.error?.message;
        const failure=classifyChatFailure(response.status,detail);
        // Respect an explicit Retry-After response even if it is a server error.
        if(response.headers.get('retry-after'))failure.retryable=false;
        throw failure;
      }
      if((response.headers.get('content-type')||'').includes('text/event-stream')){
        await readStream(response,chunk=>{
          if(signal.aborted||attemptController.signal.aborted)return;
          target.actualMode=attemptMode;
          target.content+=chunk;
          updateStreamingMessage(chat,target);
        });
      }else{
        const data=await response.json();
        if(signal.aborted||attemptController.signal.aborted)throw new ChatFailure('Response stopped.');
        if(data.error)throw classifyChatFailure(Number(data.error?.status||0),typeof data.error==='string'?data.error:data.error?.message);
        target.actualMode=attemptMode;
        target.content=typeof data.response==='string'?data.response:String(data.choices?.[0]?.message?.content||'');
      }
      if(signal.aborted)throw new ChatFailure('Response stopped.');
      if(timedOut)throw new ChatFailure('The AI response timed out. Please try again.',true);
      if(!target.content.trim())throw new ChatFailure('The AI returned an empty answer. Please try again.',true);
      target.actualMode=attemptMode;
    }catch(e){
      if(signal.aborted)throw new ChatFailure('Response stopped.');
      if(timedOut)throw new ChatFailure('The AI response timed out. Please try again.',true);
      if(e instanceof ChatFailure)throw e;
      if(e instanceof TypeError||e?.name==='NetworkError'||/failed to fetch|networkerror|load failed|streaming was interrupted|connection lost/i.test(String(e?.message||''))){
        throw new ChatFailure('ECHO could not connect to its AI service. Please try again.',true);
      }
      throw new ChatFailure('ECHO could not complete the response. Please try again.');
    }finally{
      clearTimeout(timer);
      signal.removeEventListener('abort',onAbort);
    }
  }
  async function requestAnswer(chat) {
    if(generating)return;
    generating=true; controller=new AbortController();
    const myController=controller;
    const signal=myController.signal;
    const requestedMode=model;
    const preference=instructions;
    const allowFallback=useCloudflare&&autoFallback;
    const deadline=Date.now()+TOTAL_RESPONSE_MS;
    const target={role:'assistant',content:'',status:'loading',requestedMode};
    const requestMessages=chat.messages.filter(m=>m.role==='user'||(m.role==='assistant'&&m.status==='done'))
      .slice(-14).map(m=>({role:m.role,content:m.content.slice(0,6500)}));
    chat.messages.push(target);
    renderAll();
    try{
      if(useCloudflare&&!isValidApi)throw new ChatFailure('The website owner must configure the AI backend.');
      // At most three attempts: original, same-model retry, optional alternate mode.
      // Never recover automatically from a quota/permission error or after receiving text.
      const attempts=[requestedMode,requestedMode];
      if(allowFallback)attempts.push(requestedMode==='quick'?'balanced':'quick');
      for(let i=0;i<attempts.length;i++){
        if(signal.aborted)throw new ChatFailure('Response stopped.');
        if(i>0){
          setRecoveryProgress(chat,target,i===1?'Reconnecting to ECHO…':'Trying '+MODE_LABEL[attempts[i]]+'…');
          await waitForRecovery(signal);
        }
        const remaining=deadline-Date.now();
        if(remaining<1000)throw new ChatFailure('The AI response timed out. Please retry.');
        const attemptMode=attempts[i];
        const timeout=Math.min(attemptMode==='quick'?35000:50000,remaining);
        try{
          await performChatAttempt(chat,target,requestMessages,attemptMode,preference,signal,timeout);
          target.status='done'; target.progress='';
          break;
        }catch(e){
          if(signal.aborted||target.content.length||!e.retryable||i===attempts.length-1)throw e;
        }
      }
    }catch(e){
      // A previous request stopped by navigation must not overwrite a newer one.
      if(controller!==myController)return;
      if(target.content.length){
        target.status='done';target.interrupted=true;
      }else{
        target.status='error';
        target.content=signal.aborted?'Response stopped.':(e?.message||'ECHO is temporarily unavailable. Please retry.');
      }
      target.progress='';
    }finally{
      if(controller===myController){
        controller=null;generating=false;
        chat.updated=Date.now();
        persist();renderAll();
      }
    }
  }
  function send() {
    if (generating) return;
    const value = els.input.value.trim();
    if (!value) return;
    const chat = makeChatIfNeeded(value);
    // Remove a failed answer when the visitor sends a fresh message.
    if (chat.messages.at(-1)?.status === 'error') chat.messages.pop();
    chat.messages.push({role:'user',content:value,status:'done'});
    chat.updated=Date.now();
    els.input.value='';resizeInput();updateSend();persist();
    void requestAnswer(chat);
  }
  function regenerateAnswer() {
    if (generating) return;
    const chat = activeChat();
    if (!chat) return;
    if (chat.messages.at(-1)?.role === 'assistant') chat.messages.pop();
    if (chat.messages.at(-1)?.role !== 'user') return;
    persist();void requestAnswer(chat);
  }
  function exportChat() {
    const chat = activeChat();
    if (!chat || !chat.messages.length) {showToast('Start a conversation before exporting.');return;}
    const contents = '# '+chat.title+'\n\n'+chat.messages.filter(m => m.status === 'done' || m.role === 'user')
      .map(m => `## ${m.role === 'user' ? 'You' : 'ECHO'}\n\n${m.content}`).join('\n\n---\n\n');
    const blob = new Blob([contents],{type:'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url;a.download='ECHO-conversation.md';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showToast('Conversation exported.');
  }
  async function checkHealth() {
    if (!useCloudflare) {
      els.presence.textContent = 'Free AI · limited';
      els.presence.title = 'Anonymous OVHcloud hosted AI. About 2 messages per minute, per IP and model; live service availability may vary.';
      return;
    }
    if (!isValidApi) {
      els.presence.textContent = 'AI setup needed';
      els.presence.title = 'The website owner needs to set the Cloudflare Worker URL.';
      return;
    }
    try {
      const res = await fetch(apiUrl('/api/health'),{cache:'no-store'});
      if (!res.ok) throw new Error();
      const status = await res.json();
      if (!status.ready) { els.presence.textContent = 'AI not configured'; els.presence.title = 'The website owner has not enabled AI inference.'; }
      else { els.presence.textContent = 'Cloud AI · Free'; els.presence.title = 'Powered by Cloudflare Workers AI. Shared daily free allowance; availability varies.'; }
    } catch {
      els.presence.textContent = 'AI unavailable';
      els.presence.title = 'The AI backend could not be reached. Ask the website owner to check the Cloudflare Worker and CORS settings.';
    }
  }
  function openPreferences(showModels) {
    els.instructions.value = instructions;
    $('auto-model-fallback').checked = autoFallback;
    const modelGuide = $('model-guide');
    if (showModels) modelGuide.open = true;
    els.settings.showModal();
    closeSidebar();
    if (showModels) modelGuide.scrollIntoView({block:'nearest'});
  }
  function bind() {
    $('new-chat').addEventListener('click',startNewChat);
    $('open-sidebar').addEventListener('click',openSidebar);
    $('close-sidebar').addEventListener('click',closeSidebar);
    els.scrim.addEventListener('click',closeSidebar);
    els.search.addEventListener('input',renderHistory);
    els.send.addEventListener('click',send);
    els.stop.addEventListener('click',stopGeneration);
    els.input.addEventListener('input',()=>{resizeInput();updateSend();});
    els.input.addEventListener('keydown',e=>{
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {e.preventDefault();send();}
    });
    els.model.addEventListener('change',()=>{model=els.model.value;persist();});
    els.theme.addEventListener('click',toggleTheme);
    document.querySelectorAll('input[name="theme-choice"]').forEach(input => input.addEventListener('change',()=>{ if(input.checked) setTheme(input.value); }));
    $('model-info').addEventListener('click',()=>{ openPreferences(true); });
    document.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>{
      els.input.value=button.dataset.prompt;resizeInput();updateSend();send();
    }));
    $('open-settings').addEventListener('click',()=>openPreferences(false));
    $('settings-form').addEventListener('submit',e=>{
      if (e.submitter?.value !== 'save') return;
      instructions=els.instructions.value.trim().slice(0,1200);
      autoFallback=$('auto-model-fallback').checked;
      persist();showToast('Preferences saved.');
    });
    $('export-chat').addEventListener('click',exportChat);
    els.messages.addEventListener('click',event=>{
      const btn=event.target.closest('.code-copy');
      if (btn) {const code=btn.closest('pre')?.querySelector('code')?.textContent;if(code) void copyText(code);}
    });
    document.addEventListener('keydown',e=>{
      if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k') {e.preventDefault();startNewChat();}
      if (e.key==='Escape') closeSidebar();
    });
  }
  $('quick-model-name').textContent = useCloudflare ? '@cf/meta/llama-3.1-8b-instruct-fast' : OVH_MODELS.quick;
  $('balanced-model-name').textContent = useCloudflare ? '@cf/google/gemma-4-26b-a4b-it' : OVH_MODELS.balanced;
  load();bind();renderAll();resizeInput();void checkHealth();
})();

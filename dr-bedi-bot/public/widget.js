/* Dr. Rajeev Bedi OPD Chat Widget — Full Screen Interface */
(function () {
  var API = "https://api.drrajeevbedi.com";
  var SID = localStorage.getItem("bedi_sid");
  if (!SID) { SID = "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem("bedi_sid", SID); }
  var LOGKEY = "bedi_log_" + SID;
  var msgs = []; try { msgs = JSON.parse(localStorage.getItem(LOGKEY) || "[]"); } catch (e) {}
  var savedContact = null; try { savedContact = JSON.parse(localStorage.getItem("bedi_contact") || "null"); } catch (e) {}
  var savedName = (savedContact && savedContact.name) || "";
  var intakeDone = !!savedContact;
  var rendered = {};   
  var seen = {};       
  msgs.forEach(function (m) { if (m.ts) seen[m.ts] = 1; });
  var mode = "ai", open = false, started = false, listening = false, recog = null, pollTimer = null;

  var CFG_GREETING = "";
  try { fetch(API + "/api/config").then(function (r) { return r.json(); }).then(function (c) { if (c && c.greeting) CFG_GREETING = c.greeting; }).catch(function () {}); } catch (e) {}
  
  function inPhone(raw) {
    var d = String(raw || "").replace(/[\s\-().+]/g, "");
    if (d.indexOf("91") === 0 && d.length === 12) d = d.slice(2);
    else if (d.indexOf("0") === 0 && d.length === 11) d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d) ? d : null; 
  }

  function greet(fn) {
    if (CFG_GREETING) return CFG_GREETING.replace(/\{\s*name\s*\}/gi, fn || "").replace(/\s+/g, " ").trim();
    return "Hello " + (fn || "there") + " 👋 How can I assist you with Dr. Rajeev Bedi's OPD today?";
  }

  var C = { 
    teal: "#0A4D4A", tealDeep: "#063432", 
    coral: "#FF6B35", coralDeep: "#E85724",
    launch: "#FF6B35", launchDeep: "#E85724",   
    ink: "#0A4D4A", mint: "#E6F5EE", line: "#E2E8E6", muted: "#596D6C", bg: "#F8FAF9" 
  };

  var css = "" +
    "#bediw,#bediw *{box-sizing:border-box;font-family:'Inter',-apple-system,Segoe UI,Roboto,sans-serif}" +
    "#bedi-btn.hidden{opacity:0;visibility:hidden;pointer-events:none}" +
    "#bedi-btn{position:fixed;right:18px;bottom:24px;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;z-index:2147483000;box-shadow:0 10px 26px rgba(255,107,53,.45);background:linear-gradient(135deg," + C.launch + "," + C.launchDeep + ");display:flex;align-items:center;justify-content:center;transition:transform .2s}" +
    "#bedi-btn:hover{filter:brightness(1.1)}"+
    "#bedi-pop{position:fixed;right:18px;bottom:92px;max-width:235px;background:#fff;color:" + C.ink + ";border:1px solid " + C.line + ";padding:12px 30px 12px 14px;border-radius:16px 16px 4px 16px;box-shadow:0 12px 34px rgba(10,77,74,.18);z-index:2147482999;cursor:pointer;font-size:14px;line-height:1.45;display:none}" +
    "#bedi-pop.on{display:block;animation:bediup .3s ease}" +
    "#bedi-pop::after{content:'';position:absolute;right:41px;bottom:-7px;width:13px;height:13px;background:#fff;border-right:1px solid " + C.line + ";border-bottom:1px solid " + C.line + ";border-radius:0 0 3px 0;transform:rotate(45deg)}" +
    "#bedi-pop b{color:" + C.teal + ";font-size:12.5px;display:block;margin-bottom:2px}" +
    "#bedi-pop .x{position:absolute;top:5px;right:9px;font-size:17px;color:" + C.muted + ";line-height:1}" +
    
    /* Full Screen Fixed Panel Overlay */
    "#bedi-panel{position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;max-width:100vw;max-height:100vh;background:#fff;border:none;border-radius:0;overflow:hidden;display:none;flex-direction:column;z-index:2147483005;box-shadow:none}" +
    "#bedi-panel.on{display:flex;animation:bediup .25s ease}" +
    "@keyframes bediup{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}" +
    
    "#bedi-head{position:relative;z-index:6;padding:16px 20px;display:flex;align-items:center;gap:14px;background:#fff;border-bottom:1px solid #eef0f2}" +
    "#bedi-head .av{width:44px;height:44px;border-radius:50%;background:var(--cream, #F8FAF9);border:1px solid " + C.line + ";display:flex;align-items:center;justify-content:center;flex-shrink:0}" +
    "#bedi-head .nm{color:" + C.teal + ";font-weight:700;font-size:17px;line-height:1.2}" +
    "#bedi-head .st{color:#8a94a0;font-size:13px;display:flex;align-items:center;gap:6px;margin-top:3px}" +
    "#bedi-head.human{background:linear-gradient(135deg," + C.teal + "," + C.tealDeep + ");color:#fff}" +
    "#bedi-head.human .nm{color:#fff}" +
    "#bedi-head.human .st{color:#E6F5EE}" +
    "#bedi-book{background:" + C.teal + ";border:none;color:#fff;cursor:pointer;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-left:auto;flex-shrink:0}" +
    "#bedi-x{margin-left:8px;background:" + C.teal + ";border:none;color:#fff;cursor:pointer;font-size:24px;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .12s,color .12s}" +
    "#bedi-x:hover{background:" + C.tealDeep + ";color:#fff}" +
    
    /* Max width centered body for large desktop screens */
    "#bedi-body{flex:1;overflow-y:auto;padding:24px 20px;max-width:800px;width:100%;margin:0 auto;display:flex;flex-direction:column;gap:18px;background:#fff;-webkit-overflow-scrolling:touch}" +
    ".bedi-row{display:flex;gap:10px;align-items:flex-end;animation:bediin .25s ease}" +
    ".bedi-row.me{justify-content:flex-end}" +
    ".bedi-wrap{max-width:82%}" +
    "@keyframes bediin{from{opacity:0;transform:translateY(6px)}to{opacity:1}}" +
    ".bedi-b{width:fit-content;min-width:0;padding:12px 16px;font-size:15.5px;line-height:1.5;white-space:normal;overflow-wrap:break-word;word-break:normal;hyphens:none}" +
    ".bedi-b.bot{background:#f4f6f8;color:#2b3138;border:none;border-radius:4px 18px 18px 18px}" +
    ".bedi-b.me{background:" + C.teal + ";color:#fff;border-radius:18px 4px 18px 18px}" +
    ".bedi-b.team{background:#FFF3EB;color:" + C.ink + ";border:1px solid #FFE2D1;border-top:2px solid " + C.coral + ";border-radius:16px 16px 16px 4px}" +
    ".bedi-team-l{font-size:11.5px;font-weight:700;color:" + C.coralDeep + ";margin:0 0 3px 2px}" +
    ".bedi-sys{align-self:center;font-size:12px;color:" + C.muted + ";background:#F0F4F3;padding:5px 14px;border-radius:20px}" +
    ".bedi-av{display:none}" +
    "#bedi-chips{padding:12px 20px 14px;max-width:800px;width:100%;margin:0 auto;display:flex;flex-wrap:wrap;gap:8px}#bedi-chips:empty{padding:0}" +
    ".bedi-chip{padding:9px 16px;font-size:14px;font-weight:500;border-radius:22px;background:#fff;color:" + C.teal + ";border:1.5px solid #FFE2D1;cursor:pointer}" +
    ".bedi-chip:hover{transform:translateY(-1px)}" +
    ".bedi-cta{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;font-size:14px;font-weight:600;border-radius:20px;background:" + C.coral + ";color:#fff !important;border:1px solid " + C.coral + ";text-decoration:none;cursor:pointer;transition:background .12s}" +
    ".bedi-cta:hover{background:" + C.coralDeep + "}" +
    
    "#bedi-foot{padding:16px 20px;max-width:800px;width:100%;margin:0 auto;display:flex;align-items:center;gap:10px;border-top:1px solid #eef0f2;background:#fff}" +
    "#bedi-inwrap{flex:1;display:flex;align-items:center;gap:6px;background:#f4f6f8;border:1px solid #eef0f2;border-radius:28px;padding:0 8px 0 18px}" +
    "#bedi-in{flex:1;border:none;outline:none;padding:13px 0;font-size:16px;background:transparent;color:" + C.ink + "}" +
    ".bedi-ic{width:34px;height:34px;border:none;background:none;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center}" +
    ".bedi-ic.on{background:#FFF3EB}" +
    "#bedi-send{width:46px;height:46px;border:none;border-radius:50%;cursor:pointer;background:" + C.teal + ";display:flex;align-items:center;justify-content:center;flex-shrink:0}" +
    ".bedi-dot{width:7px;height:7px;border-radius:50%;background:" + C.coral + ";display:inline-block;animation:bedid 1s infinite}" +
    "@keyframes bedid{0%,60%,100%{opacity:.4;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}" +
    
    "#bedi-form{position:absolute;left:0;right:0;top:70px;bottom:0;background:#fff;z-index:5;display:flex;flex-direction:column;animation:bediin .2s ease}" +
    "#bedi-intake{flex:1;min-height:0;display:flex;flex-direction:column;padding:0;width:100%;max-width:600px;margin:0 auto;animation:bediin .2s ease}" +
    ".bedi-fh{padding:16px 20px;font-weight:700;font-size:16px;background:#fff;border-bottom:1px solid " + C.line + ";display:flex;align-items:center;color:" + C.ink + "}" +
    ".bedi-fh button{margin-left:auto;background:none;border:none;font-size:22px;cursor:pointer;color:" + C.ink + ";opacity:.6}" +
    ".bedi-fb{padding:20px;display:flex;flex-direction:column;gap:12px;overflow-y:auto}" +
    ".bedi-fi{padding:11px 2px;border:none;border-bottom:1.5px solid " + C.line + ";border-radius:0;outline:none;font-size:16px;background:transparent;color:" + C.ink + ";transition:border-color .16s}" +
    ".bedi-fi:focus{border-bottom-color:" + C.coral + "}" +
    ".bedi-fi::placeholder{color:#9aa3ad}" +
    ".bedi-seg{display:flex;gap:10px}.bedi-seg button{flex:1;padding:12px;border:1px solid " + C.line + ";background:#fff;border-radius:10px;cursor:pointer;font-size:14px;color:" + C.muted + "}.bedi-seg button.on{background:" + C.teal + ";color:#fff;border-color:" + C.teal + "}" +
    ".bedi-fbtn{padding:15px;border:none;border-radius:12px;background:" + C.coral + ";color:#fff;font-weight:700;cursor:pointer;font-size:16px;letter-spacing:.01em;transition:background .14s;margin-top:10px}" +
    ".bedi-fbtn:hover{background:" + C.coralDeep + "}" +
    ".bedi-fn{font-size:12px;color:" + C.muted + ";text-align:center}" +
    
    ".bedi-iw{position:relative;display:flex;flex-direction:column;gap:20px;padding:24px;min-height:0}" +
    ".bedi-it{font-weight:800;font-size:21px;color:" + C.ink + ";line-height:1.3;letter-spacing:-.01em}" +
    ".bedi-isub{font-size:14px;color:" + C.muted + ";margin:-8px 0 6px;line-height:1.45}" +
    ".bedi-ita{min-height:60px;resize:none;font-family:inherit;line-height:1.4}" +
    ".bedi-ierr{font-size:13px;color:#C0392B}.bedi-ierr:empty{display:none}" +
    
    /* CSS Protection */
    "#bediw button,#bediw a,#bediw input,#bediw textarea{font-family:inherit!important;text-transform:none!important;letter-spacing:normal!important;text-shadow:none!important;margin:0!important;min-width:0!important;min-height:0!important;line-height:normal!important}" +
    "#bediw #bedi-btn{width:60px!important;height:60px!important;padding:0!important;border:none!important;border-radius:50%!important;background:linear-gradient(135deg," + C.launch + "," + C.launchDeep + ")!important;box-shadow:0 10px 26px rgba(255,107,53,.45)!important}" +
    "#bediw #bedi-btn svg{display:block!important;width:30px!important;height:30px!important;opacity:1!important;visibility:visible!important}" +
    "#bediw #bedi-head .av svg{display:block!important;width:26px!important;height:26px!important;opacity:1!important;visibility:visible!important}" +
    "#bediw svg{vertical-align:middle;max-width:none!important}" +
    "#bediw .bedi-chip{background:#fff!important;color:" + C.teal + "!important;padding:8px 15px!important;font-size:14px!important;font-weight:500!important;border:1px solid " + C.line + "!important;border-radius:20px!important;width:auto!important;height:auto!important;box-shadow:none!important;text-align:center}" +
    "#bediw .bedi-cta{background:" + C.coral + "!important;color:#fff!important;padding:9px 16px!important;font-size:14px!important;font-weight:600!important;border:1px solid " + C.coral + "!important;border-radius:20px!important;width:auto!important;height:auto!important;box-shadow:none!important}" +
    "#bediw #bedi-send{width:46px!important;height:46px!important;padding:0!important;border:none!important;border-radius:50%!important;background:" + C.teal + "!important;box-shadow:none!important}" +
    "#bediw .bedi-ic{width:34px!important;height:34px!important;padding:0!important;border:none!important;border-radius:50%!important;background:none!important;box-shadow:none!important}" +
    "#bediw .bedi-ic.on{background:#FFF3EB!important}" +
    "#bediw #bedi-book{width:40px!important;height:40px!important;padding:0!important;border-radius:50%!important;background:" + C.teal + "!important;border:none!important;color:#fff!important;box-shadow:none!important;display:flex!important;align-items:center;justify-content:center;flex-shrink:0}" +
    "#bediw #bedi-x{width:40px!important;height:40px!important;padding:0!important;border-radius:50%!important;background:" + C.teal + "!important;border:none!important;color:#fff!important;box-shadow:none!important;display:flex!important;align-items:center;justify-content:center;flex-shrink:0}" +
    "#bediw #bedi-x{font-size:24px!important;margin-left:8px!important;color:#fff!important}" +
    "#bediw #bedi-book svg{width:22px!important;height:22px!important}" +
    "#bediw .bedi-fbtn{background:" + C.coral + "!important;color:#fff!important;padding:15px!important;border:none!important;border-radius:12px!important;width:100%!important;box-shadow:none!important;font-weight:700!important}";

  var bubbleIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/></svg>';
  var medicalLogo = '<svg viewBox="0 0 24 24" fill="none" stroke="#FF6B35" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px;display:block;margin:auto;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>';
  var sparkSm = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0A4D4A" stroke-width="2.2"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4L12 3z"/></svg>';
  var head = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M3 14v-2a9 9 0 0118 0v2"/><path d="M21 16a2 2 0 01-2 2h-1v-5h1a2 2 0 012 2zM3 16a2 2 0 002 2h1v-5H5a2 2 0 00-2 2z"/></svg>';
  var calI = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  var micI = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#596D6C" stroke-width="2"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 17v4"/></svg>';
  var sendI = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  var root = document.createElement("div"); root.id = "bediw";
  root.innerHTML =
    '<style>' + css + '</style>' +
    '<button id="bedi-btn" aria-label="Consult OPD Assistant">' + bubbleIcon + '</button>' +
    '<div id="bedi-pop"><span class="x" id="bedi-popx">&times;</span>Consult Dr. Bedi\'s Assistant 💬</div>' +
    '<div id="bedi-panel">' +
      '<div id="bedi-head"><div class="av">' + medicalLogo + '</div><div><div class="nm">Dr. Rajeev Bedi\'s OPD</div>' +
        '<div class="st"><span id="bedi-dot2" style="width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block"></span><span id="bedi-stt">Fortis Cancer Institute · Mohali</span></div></div>' +
        '<button id="bedi-book" title="Book Consultation">' + calI + '</button>' +
        '<button id="bedi-x" aria-label="Close" title="Back to website">&times;</button></div>' +
      '<div id="bedi-body"></div>' +
      '<div id="bedi-chips"></div>' +
      '<div id="bedi-foot"><div id="bedi-inwrap"><input id="bedi-in" placeholder="Ask about OPD consults..." autocomplete="off"/>' +
        '<button class="bedi-ic" id="bedi-mic" title="Voice">' + micI + '</button></div>' +
        '<button id="bedi-send">' + sendI + '</button></div>' +
    '</div>';
  document.body.appendChild(root);

  var $ = function (id) { return document.getElementById(id); };
  var body = $("bedi-body"), chipsEl = $("bedi-chips");
  
  var pop = $("bedi-pop"), popx = $("bedi-popx");
  var popDismissed = false;
  if (popx) popx.onclick = function (e) { e.stopPropagation(); pop.className = ""; popDismissed = true; };
  if (pop) pop.onclick = function () { pop.className = ""; $("bedi-btn").click(); };

  function persist() { try { localStorage.setItem(LOGKEY, JSON.stringify(msgs.slice(-60))); } catch (e) {} }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function buildRow(m) {
    if (m.role === "system") return el("div", "bedi-sys", esc(m.text));
    var row = el("div", "bedi-row" + (m.role === "user" ? " me" : ""));
    if (m.role !== "user") row.appendChild(el("div", "bedi-av", m.role === "team" ? head : sparkSm));
    var wrap = el("div", "bedi-wrap");
    if (m.role === "team") wrap.appendChild(el("div", "bedi-team-l", "OPD Team"));
    var cls = m.role === "user" ? "me" : (m.role === "team" ? "team" : "bot");
    wrap.appendChild(el("div", "bedi-b " + cls, esc(m.text)));
    row.appendChild(wrap);
    return row;
  }
  
  function addRow(m) {
    if (rendered[m.ts]) return;
    rendered[m.ts] = 1;
    var anchor = $("bedi-typing");
    var node = buildRow(m);
    if (anchor) body.insertBefore(node, anchor); else body.appendChild(node);
  }
  function scrollDown() { requestAnimationFrame(function () { body.scrollTop = body.scrollHeight; }); }
  function renderChips() {
    chipsEl.innerHTML = "";
    var last = msgs[msgs.length - 1];
    if (!last || last.role !== "bot") return;
    if (last.chips) last.chips.forEach(function (c) { var b = el("button", "bedi-chip", esc(c)); b.onclick = function () { sendMsg(c); }; chipsEl.appendChild(b); });
    if (last.cta && last.cta.url) { var a = el("a", "bedi-cta", esc(last.cta.label || "Book Consultation")); a.href = last.cta.url; a.target = "_blank"; a.rel = "noopener noreferrer"; chipsEl.appendChild(a); }
  }
  function sync() { var added = false; msgs.forEach(function (m) { if (!rendered[m.ts]) { addRow(m); added = true; } }); if (added) { renderChips(); scrollDown(); } }

  function push(role, text, extra) {
    var m = Object.assign({ role: role, text: text, ts: Date.now() + Math.random() }, extra || {});
    msgs.push(m); seen[m.ts] = 1; persist();
    addRow(m); renderChips(); scrollDown();
  }
  function typing(on) {
    var ex = $("bedi-typing"); if (ex) ex.remove();
    if (!on) return;
    var row = el("div", "bedi-row"); row.id = "bedi-typing";
    row.appendChild(el("div", "bedi-av", sparkSm));
    var wrap = el("div", "bedi-wrap");
    wrap.appendChild(el("div", "bedi-b bot", '<span class="bedi-dot"></span> <span class="bedi-dot" style="animation-delay:.15s"></span> <span class="bedi-dot" style="animation-delay:.3s"></span>'));
    row.appendChild(wrap);
    body.appendChild(row); scrollDown();
  }
  function setMode(m) {
    if (m === mode) return; mode = m;
    $("bedi-head").className = m === "human" ? "human" : "";
    $("bedi-stt").textContent = m === "human" ? "OPD Receptionist · Online" : "Fortis Cancer Institute · Mohali";
    $("bedi-dot2").style.background = m === "human" ? "#E6F5EE" : "#22c55e";
    $("bedi-head").querySelector(".av").innerHTML = m === "human" ? head : medicalLogo;
  }

  function prewarm() { try { fetch(API + "/api/ping").catch(function () {}); } catch (e) {} }

  async function sendMsg(text) {
    text = (text || "").trim(); if (!text) return;
    push("user", text);
    chipsEl.innerHTML = "";
    typing(true);
    
    var payload = { sessionId: SID, message: text };
    if (savedContact) payload.contact = savedContact;
    if (msgs.length > 0) payload.history = msgs;

    try {
      var r = await fetch(API + "/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      var d = await r.json();
      typing(false);
      if (d.mode) setMode(d.mode);
      if (d.reply) push("bot", d.reply, { chips: d.chips || [], cta: d.cta });
    } catch (e) { typing(false); push("bot", "Sorry, I couldn't connect right now — please call OPD Helpline directly at 72728 72728.", { chips: [] }); }
  }

  async function poll() {
    try {
      var r = await fetch(API + "/api/poll?sessionId=" + encodeURIComponent(SID));
      var d = await r.json();
      
      if (d.deleted) {
        msgs = [];
        seen = {};
        rendered = {};
        localStorage.removeItem(LOGKEY);
        body.innerHTML = "";
        chipsEl.innerHTML = "";
        clearInterval(pollTimer);
        started = false;
        if (open) {
          push("bot", CFG_GREETING ? greet(savedName ? savedName.split(" ")[0] : "") : ("Welcome back" + (savedName ? ", " + savedName.split(" ")[0] : "") + "! 👋 How can I assist you today?"), { chips: ["Book OPD Visit", "Breast Cancer", "Lung Cancer", "Second Opinion"] });
          pollTimer = setInterval(poll, 4000);
        }
        return;
      }

      if (d.mode) setMode(d.mode);
      var fresh = false;
      (d.events || []).forEach(function (ev) { if (seen[ev.ts]) return; seen[ev.ts] = 1; msgs.push({ role: ev.role, text: ev.text, ts: ev.ts }); fresh = true; });
      if (fresh) { persist(); sync(); }   
    } catch (e) {}
  }

  // --- Direct Booking Form Modal ---
  function closeBook() { var f = $("bedi-form"); if (f) f.remove(); }
  function openBook() {
    if ($("bedi-form")) return;
    var svcs = ["Breast Cancer Consultation", "Lung Cancer Consultation", "Targeted & Immunotherapy", "Prostate / Solid Tumors", "Second Opinion / Report Review", "General Oncology Query"];
    var whens = ["As soon as possible", "Tomorrow", "This week", "I'm flexible"];
    var f = el("div"); f.id = "bedi-form";
    f.innerHTML = '<div class="bedi-fh">Book Priority OPD Consultation <button id="bedi-fx" aria-label="Close">&times;</button></div>' +
      '<div class="bedi-fb">' +
      '<input class="bedi-fi" id="bk-name" placeholder="Patient Full Name *"/>' +
      '<input class="bedi-fi" id="bk-phone" placeholder="Mobile * (e.g. 98765 43210)" inputmode="tel"/>' +
      '<input class="bedi-fi" id="bk-email" placeholder="Email (optional)"/>' +
      '<select class="bedi-fi" id="bk-svc"><option value="">Consultation Requirement? *</option>' + svcs.map(function (o) { return '<option>' + o + '</option>'; }).join("") + '</select>' +
      '<select class="bedi-fi" id="bk-when"><option value="">Preferred Timeframe?</option>' + whens.map(function (o) { return '<option>' + o + '</option>'; }).join("") + '</select>' +
      '<div class="bedi-seg"><button data-pt="New patient" class="on">New patient</button><button data-pt="Existing patient">Existing patient</button></div>' +
      '<button id="bk-send" class="bedi-fbtn">Submit OPD Request</button>' +
      '<div class="bedi-fn">The team will call to confirm. Urgent? Call 72728 72728.</div></div>';
    $("bedi-panel").appendChild(f);
    var pt = "New patient";
    f.querySelectorAll("[data-pt]").forEach(function (b) { b.onclick = function () { pt = b.getAttribute("data-pt"); f.querySelectorAll("[data-pt]").forEach(function (x) { x.className = ""; }); b.className = "on"; }; });
    $("bedi-fx").onclick = closeBook;
    $("bk-send").onclick = function () {
      var name = $("bk-name").value.trim(), phone = $("bk-phone").value.trim(), email = $("bk-email").value.trim(), svc = $("bk-svc").value, when = $("bk-when").value;
      if (!name || !phone || !svc) { $("bk-send").textContent = "Please fill required fields (*)"; return; }
      var bkP = inPhone(phone);
      if (!bkP) { $("bk-send").textContent = "Enter a valid 10-digit mobile number"; setTimeout(function () { $("bk-send").textContent = "Submit OPD Request"; }, 2600); try { $("bk-phone").focus(); } catch (e) {} return; }
      phone = bkP;
      $("bk-send").textContent = "Sending…"; $("bk-send").disabled = true;
      fetch(API + "/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: SID, name: name, phone: phone, email: email, service: svc, when: when, patientType: pt }) })
        .then(function (r) { return r.json(); })
        .then(function () { closeBook(); push("bot", "Thank you " + name.split(" ")[0] + "! Your consultation request is received. Our OPD coordinator will call " + phone + " shortly to confirm your appointment. Is there anything else I can help with?", { chips: ["Fortis Mohali Address", "OPD Timings"] }); })
        .catch(function () { $("bk-send").textContent = "Try again"; $("bk-send").disabled = false; });
    };
  }

  // --- Global Direct Full-Screen Chat Launcher ---
  window.bediStartChat = function(name, phone, email, msg) {
    savedContact = { name: name, phone: phone, email: email };
    intakeDone = true;
    savedName = name;
    try { localStorage.setItem("bedi_contact", JSON.stringify(savedContact)); } catch (e) {}
    
    open = true;
    $("bedi-panel").className = "on";
    $("bedi-btn").className = "hidden";
    if (pop) pop.className = "";
    
    var fm = $("bedi-intake"); if (fm) fm.remove();
    $("bedi-foot").style.display = ""; chipsEl.style.display = "";
    
    if (!started) {
      started = true;
      poll(); pollTimer = setInterval(poll, 4000);
    }
    
    fetch(API + "/api/start", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ sessionId: SID, name: name, phone: phone, email: email, message: msg, silent: true }) 
    }).catch(function(){});

    sendMsg(msg);
  };

  function showIntake() {
    body.innerHTML = "";
    $("bedi-foot").style.display = "none";   
    chipsEl.style.display = "none";
    body.className = "intake";
    var f = el("div"); f.id = "bedi-intake";
    f.innerHTML = '<div class="bedi-iw">' +
      '<div class="bedi-it">Consult Dr. Rajeev Bedi</div>' +
      '<div class="bedi-isub">🔒 Details are kept strictly private and used only for OPD appointment coordination.</div>' +
      '<input class="bedi-fi" id="in-name" placeholder="Patient Name *" autocomplete="name"/>' +
      '<input class="bedi-fi" id="in-phone" placeholder="Mobile * (e.g. 98765 43210)" inputmode="tel" autocomplete="tel"/>' +
      '<input class="bedi-fi" id="in-email" placeholder="Email (optional)" inputmode="email" autocomplete="email"/>' +
      '<textarea class="bedi-fi bedi-ita" id="in-msg" placeholder="Describe diagnosis or requirement *"></textarea>' +
      '<div class="bedi-ierr" id="in-err"></div>' +
      '<button id="in-send" class="bedi-fbtn">Start Consultation Chat →</button>' +
      '</div>';
    body.appendChild(f);
    $("in-send").onclick = submitIntake;
    try { $("in-name").focus(); } catch (e) {}
  }

  function submitIntake() {
    var name = $("in-name").value.trim(), phone = $("in-phone").value.trim(), email = $("in-email").value.trim(), msg = $("in-msg").value.trim();
    var err = $("in-err");
    if (!name || !phone || !msg) { err.textContent = "Please fill in patient name, mobile number and your query."; return; }
    var inP = inPhone(phone);
    if (!inP) { err.textContent = "Please enter a valid 10-digit Indian mobile number."; try { $("in-phone").focus(); } catch (e) {} return; }
    phone = inP;
    if (email && !/.+@.+\..+/.test(email)) { err.textContent = "Please enter a valid email address."; return; }
    $("in-send").textContent = "Connecting…"; $("in-send").disabled = true;
    fetch(API + "/api/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: SID, name: name, phone: phone, email: email, message: msg }) })
      .then(function (r) { return r.json(); })
      .then(function () {
        try { localStorage.setItem("bedi_contact", JSON.stringify({ name: name, phone: phone, email: email })); } catch (e) {}
        intakeDone = true; savedName = name; savedContact = { name: name, phone: phone, email: email };
        var fm = $("bedi-intake"); if (fm) fm.remove();
        body.className = "";
        $("bedi-foot").style.display = ""; chipsEl.style.display = "";
        var fn = name.split(" ")[0];
        if (msg) { push("bot", "Hello " + fn + " 👋", {}); sendMsg(msg); }   
        else push("bot", greet(fn), { chips: ["Book OPD Visit", "Breast Cancer", "Lung Cancer", "Second Opinion"] });
      })
      .catch(function () { $("in-send").textContent = "Try again"; $("in-send").disabled = false; });
  }

  function toggleMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { push("system", "Voice input is supported on Chrome/Edge — please type your message."); return; }
    if (listening) { recog && recog.stop(); return; }
    recog = new SR(); recog.lang = "en-IN"; recog.interimResults = true;
    recog.onresult = function (e) { var s = ""; for (var i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; $("bedi-in").value = s; };
    recog.onend = function () { listening = false; $("bedi-mic").className = "bedi-ic"; };
    try { recog.start(); listening = true; $("bedi-mic").className = "bedi-ic on"; } catch (e) {}
  }

  $("bedi-btn").onclick = function () {
    open = !open; $("bedi-panel").className = open ? "on" : "";
    $("bedi-btn").className = open ? "hidden" : "";
    if (open) {
      if (pop) pop.className = ""; 
      prewarm();
      if (!intakeDone && !msgs.length) { started = true; showIntake(); }
      else if (!started) {
        started = true;
        if (msgs.length) sync();                                  
        else if (!intakeDone) showIntake();                       
        else { 
          try { fetch(API + "/api/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: SID, name: savedContact.name, phone: savedContact.phone, email: savedContact.email, silent: true }) }).catch(function(){}); } catch (e) {}
          push("bot", CFG_GREETING ? greet(savedName ? savedName.split(" ")[0] : "") : ("Welcome back" + (savedName ? ", " + savedName.split(" ")[0] : "") + "! 👋 How can I assist you today?"), { chips: ["Book OPD Visit", "Breast Cancer", "Lung Cancer", "Second Opinion"] });
        }
      }
      poll(); pollTimer = setInterval(poll, 4000);
    } else { clearInterval(pollTimer); }
  };
  
  $("bedi-x").onclick = function () { 
    open = false; 
    $("bedi-panel").className = ""; 
    $("bedi-btn").className = ""; 
    clearInterval(pollTimer); 
    
    if (!popDismissed) {
      setTimeout(function() { if (!open) pop.className = "on"; }, 5000);
    }
  };
  
  $("bedi-book").onclick = openBook;
  $("bedi-send").onclick = function () { var v = $("bedi-in").value; $("bedi-in").value = ""; sendMsg(v); };
  $("bedi-in").addEventListener("keydown", function (e) { if (e.key === "Enter") { var v = this.value; this.value = ""; sendMsg(v); } });
  $("bedi-mic").onclick = toggleMic;
  
  // NOTE: Auto-open on page load has been removed so it never interrupts form filling.
  (function () {
    if (intakeDone) {
      setTimeout(function () { if (!open && !popDismissed) pop.className = "on"; }, 4000);
    }
  })();

  prewarm();
})();

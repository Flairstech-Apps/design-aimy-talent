/* AiMY Talent on Sales · 3 of 3: the frame (top bar, rail, bell, answer
   card, canvas, call panel, toast), the router, every press, and boot.
   Sales's rules: one press and a toast with Undo, never "are you sure";
   the bar takes a sentence; the call sits beside the page. */
(function () {
  const T = window.T;
  const e = T.esc;
  const D = () => T.DB;
  const $ = T.byId;

  // ---------- writes, with Undo ----------
  let toastTimer = null;
  T.toast = (msg, undo, sub) => {
    const life = undo ? 6000 : 4000;
    T._undo = undo || null;
    clearTimeout(toastTimer);
    $('toastHost').innerHTML = `<div class="aimy-toast visible is-open s-toast" role="status">
      <span class="aimy-toast-icon">${T.logo(13, 15)}</span>
      <span class="aimy-toast-body"><span class="aimy-toast-title">${e(msg)}</span>${sub ? `<span class="aimy-toast-sub">${e(sub)}</span>` : ''}</span>
      ${undo ? '<span class="aimy-toast-divider"></span><button class="aimy-toast-undo" type="button" data-undo>Undo</button>' : ''}
      <span class="aimy-toast-progress"><span class="aimy-toast-progress-fill" style="animation-duration:${life}ms"></span></span></div>`;
    toastTimer = setTimeout(() => { $('toastHost').innerHTML = ''; T._undo = null; }, life);
  };
  T.commit = (msg, fn, sub) => {
    const snap = JSON.stringify(D());
    const out = fn();
    T.save(); render();
    T.toast(msg, () => { T.DB = JSON.parse(snap); T.save(); render(); T.toast('Undone.'); }, typeof sub === 'function' ? sub(out) : sub);
    return out;
  };
  const news = (to, item) => D().news.unshift(Object.assign({ id: T.id('n'), to, sev: 'p2', when: 'just now' }, item));

  // ---------- router ----------
  let depth = 0, pending = null;
  T.go = (o, opts = {}) => {
    if (!opts.force && T.UI.draft && T.url().list === 'draft' && o.list !== 'draft') { T.UI.leaving = true; pending = o; render(); $('pageScroll').scrollTop = 0; return; }
    const keep = !('as' in o);
    history.pushState({ d: ++depth }, '', T.href(o, keep));
    T.UI.find = '';
    render();
    $('pageScroll').scrollTop = 0;
  };
  // The browser's Back is caught too: an unsaved shortlist shows the gate.
  window.addEventListener('popstate', ev => {
    if (T.UI.draft && T.url().list !== 'draft') {
      history.pushState({ d: ++depth }, '', T.href({ list: 'draft' }));
      T.UI.leaving = true; pending = {}; render(); return;
    }
    depth = (ev.state && ev.state.d) || 0; render();
  });

  function render() {
    const u = T.url(), desk = T.desk();
    let page;
    if (u.debrief) page = T.pages.debrief(u);
    else if (u.approve) page = T.pages.approve(u);
    else if (u.apply) page = T.pages.apply(u);
    else if (u.me) page = T.pages.me(u);
    else if (u.con) page = T.pages.con(u);
    else if (u.req) page = T.pages.req(u);
    else if (u.list) page = T.pages.list(u);
    else if (u.on === 'reports') page = T.pages.reports(u);
    else if (u.on === 'hiring') page = T.pages.hiring(u);
    else page = T.pages[desk](u);
    $('wbStage').innerHTML = page;
    paintTop(); paintRail(); paintBell(); paintCall();
    if (T.UI.canvas) paintCanvas();
  }
  T.render = render;

  // ---------- the top bar ----------
  function paintTop() {
    const me = T.me(), desk = T.desk();
    $('userAvatar').textContent = T.initials(me.name);
    $('userName').textContent = me.name;
    $('userRole').textContent = me.role;
    $('asPanel').innerHTML = '<span class="b-menu-cap">Looking as</span>' + T.DESKS.map(d => `<button class="b-menu-item${d.id === desk ? ' is-on' : ''}" type="button" role="menuitemradio" aria-checked="${d.id === desk}" data-as="${d.id}">${T.face(T.person(d.id))}<span class="b-menu-line"><span class="b-menu-name">${e(T.person(d.id))}</span><span class="b-menu-sub">${e(d.label)} · Sales's ${e(d.sales.toLowerCase())}</span></span></button>`).join('');
    $('prodMenu').innerHTML = '<span class="b-menu-cap">AiMY products</span>' +
      `<a class="b-menu-item" href="https://aimy-sales.nour-ali.workers.dev/" target="_blank" rel="noopener">AiMY Sales</a><a class="b-menu-item" href="compare.html">Sales and Talent, compared</a>`;
  }

  // ---------- the rail: what needs you now, the next thing in the diary ----------
  function paintRail() {
    const desk = T.desk();
    let card = '', door = '';
    if (desk === 'omar') {
      const me = Object.values(D().apps).filter(a => T.req(a.req).owner === 'omar' && T.waitOn(a) === 'me');
      const iv = Object.values(D().interviews).filter(i => i.day >= 0 && T.req(T.app(i.app).req).owner === 'omar').sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))[0];
      card = railCard('Awaiting you', `<b>${T.plural(me.length, 'decision')}</b> ${me.length === 1 ? 'waits' : 'wait'} on you, across your ${T.mineReqs().length} requisitions.`, [[Object.values(D().apps).filter(a => T.req(a.req).owner === 'omar' && T.active(a)).length, 'in process'], [T.untold().filter(a => T.req(a.req).owner === 'omar').length, 'not told yet']], 'Show the ' + me.length, { q: 'me' });
      if (iv) door = railDoor(iv.day === 0 ? 'Today' : T.wday(iv.day), iv.time, T.cand(T.app(iv.app).cand).name, T.STAGES[iv.kind].label, `${Object.values(D().interviews).filter(i => i.day < 0 && !i.debrief).length} debrief owed`, 'Open the interviews', { on: 'iv' });
    } else if (desk === 'rania') {
      const n = T.asks().length;
      card = railCard('Awaiting you', `<b>${T.plural(n, 'ask')}</b> from your clients and recruiters.`, [[Object.values(D().reqs).filter(r => r.hm === 'rania' && T.isOpen(r)).length, 'requisitions']], 'Show them', {});
    } else if (desk === 'hesham') {
      const w = Object.values(D().offers).filter(o => !o.approvals.bu && o.sent == null).length;
      card = railCard(w ? 'Awaiting you' : 'Nothing waits', `<b>${T.plural(w, 'offer')}</b> ${w === 1 ? 'needs' : 'need'} your budget answer.`, [[T.declinesFor(null).length, 'client reasons']], 'Show the offers', { on: 'offers' });
    } else if (desk === 'jana') {
      const w = Object.values(D().apps).filter(a => T.req(a.req).acc === 'nw' && a.sendout && a.sendout.decided == null && !a.exit).length;
      card = railCard('Awaiting you', `<b>${T.plural(w, 'profile')}</b> ${w === 1 ? 'waits' : 'wait'} for your decision.`, [[4, 'hires this half']], 'Show them', {});
      door = railDoor('Your hiring with us', '3 of 3', 'still with you at day 90', 'Report', '18 profiles · 5 interviews', 'Read the report', { on: 'hiring' });
    } else {
      const risk = Object.values(D().reqs).filter(T.atRisk).length;
      card = railCard('Awaiting you', `<b>${T.plural(risk, 'requisition')}</b> at risk, and ${D().props.filter(p => p.status === 'open').length} learning proposals.`, [[Object.values(D().reqs).filter(T.isOpen).length, 'open'], [T.untold().length, 'not told yet']], 'Show the at-risk', { q: 'risk' });
    }
    $('appRail').innerHTML = `<div class="rail-read">${card}</div><div class="rail-doors">${door}${railDoor('Reports', '14 days', 'to the first profile', 'Aug–Sep', '268 screened → 81 sent', 'Open the reports', { on: 'reports' })}</div>
      <div class="rail-foot"><a class="rail-console" href="compare.html">${T.ic('ev', 16)}<span class="rail-console-name">Sales and Talent, compared</span></a></div>`;
  }
  const railCard = (state, html, pills, act, go) => `<div class="bcard rail-card"><div class="bcard-meta"><span class="type-label rail-state p2">${e(state)}</span></div>
      <p class="bcard-conclusion rail-conclusion">${html}</p><div class="bcard-evidence rail-evidence">${pills.map(([v, l]) => `<span class="evidence-pill"><span class="val">${v}</span>${e(l)}</span>`).join('')}</div>
      <button class="s-insight-lnk rail-act" type="button" data-go='${JSON.stringify(go)}'>${e(act)}</button></div>`;
  const railDoor = (cap, fig, who, kind, say, goLabel, go) => `<button class="b-door" type="button" data-go='${JSON.stringify(go)}'><span class="b-door-cap">${e(cap)}</span><span class="b-door-fig">${e(fig)}</span>
      <span class="b-door-who">${e(who)}<span class="b-kind">${e(kind)}</span></span><span class="b-door-say">${e(say)}</span><span class="b-door-go">${e(goLabel)}</span></button>`;

  // ---------- the bell: work that left a desk comes back here ----------
  function bellItems() {
    const desk = T.desk(), items = D().news.filter(n => n.to === desk);
    if (desk === 'omar') {
      const u = T.untold().filter(a => T.req(a.req).owner === 'omar');
      if (u.length) items.push({ id: 'b-untold', sev: 'p1', type: 'Not told yet', when: T.plural(u.length, 'person', 'people'), body: `Everyone who leaves the process hears within ${T.TELL_WITHIN} days.`, cta: 'Tell them', go: { q: 'untold' } });
    }
    return items;
  }
  function paintBell() {
    const items = bellItems(), unread = items.filter(i => !D().read[i.id]).length;
    $('ntfDot').hidden = !unread;
    $('ntfCount').hidden = !items.length; $('ntfCount').textContent = items.length;
    $('ntfList').innerHTML = items.map(i => `<li class="ntf-row"><span class="ntf-sev ${i.sev}"></span><div class="ntf-row-main"><div class="ntf-row-head"><span class="ntf-row-type">${e(i.type)}</span><span class="ntf-row-when">${e(i.when)}</span></div>
      <p class="ntf-row-body">${e(i.body)}</p><button class="ntf-row-cta" type="button" data-bellgo='${JSON.stringify(i.go)}'>${e(i.cta)}</button></div></li>`).join('') || '<li class="ntf-row"><div class="ntf-row-main"><p class="ntf-row-body">Nothing needs you.</p></div></li>';
  }

  // ---------- the answer card above the bar ----------
  T.peek = (html, acts) => {
    $('peekBody').innerHTML = html;
    $('peekActs').innerHTML = acts || '';
    $('aimyPeek').hidden = false; $('aimyPeek').classList.remove('is-shut');
    $('aimyFloatWrap').classList.add('has-peek');
  };
  const peekAway = () => { $('aimyPeek').hidden = true; $('aimyFloatWrap').classList.remove('has-peek'); };

  // ---------- the canvas: AiMY full screen ----------
  const say = (who, html) => { T.UI.chat.push({ who, html }); };
  function paintCanvas() {
    $('aimyOverlay').classList.add('open');
    $('overlayContextBar').hidden = !T.UI.ctx;
    $('overlayContextTags').innerHTML = T.UI.ctx ? `<span class="tag tag-neutral">${e(T.UI.ctx)}</span>` : '';
    $('overlayThread').innerHTML = T.UI.chat.map(t => t.who === 'you'
      ? `<div class="chat-msg user"><div class="msg-avatar user-av">${T.face(T.me().name, 28)}</div><div class="msg-bubble">${t.html}</div></div>`
      : `<div class="chat-msg aimy"><div class="msg-avatar aimy-av">${T.logo(16, 18)}</div><div class="msg-bubble">${t.html}</div></div>`).join('');
    $('overlayThread').scrollTop = $('overlayThread').scrollHeight;
    $('overlayThread').lastElementChild && $('overlayThread').lastElementChild.scrollIntoView({ block: 'end' });
  }
  // As in Sales: the answer card steps aside while the canvas is open.
  T.openCanvas = ctx => { T.UI.canvas = true; if (ctx !== undefined) T.UI.ctx = ctx; $('aimyFloatWrap').classList.add('is-hidden-by-canvas'); $('aimyPeek').hidden = true; paintCanvas(); };
  const closeCanvas = () => { if (!T.UI.canvas) return; T.UI.canvas = false; $('aimyOverlay').classList.remove('open'); if ($('peekBody').innerHTML) { $('aimyPeek').hidden = false; } };

  // ---------- the phone screen: the call sits beside the page ----------
  const SCRIPT = (a) => { const c = T.cand(a.cand), r = T.req(a.req); const unk = T.evidence(a).find(x => x.v === 'unknown' && x.c.must);
    return [['you', `Hi ${T.first(c.name)}, it's Omar from FlairsTech, about the ${r.title} role. Is now a good time?`], ['them', 'Yes, of course.'],
      ...(unk ? [['you', `Your CV doesn't say about ${unk.c.text.toLowerCase()}. Can you tell me?`], ['them', 'Yes, I did that for a year at my last job, no problem.']] : []),
      ['you', 'What is your notice period?'], ['them', 'One month.'], ['you', 'And what salary are you expecting?'], ['them', 'Around 30,000 a month.'],
      ['you', 'That works. I will book you with our HR team this week.'], ['them', 'Perfect, thank you.']]; };
  function paintCall() {
    const c = T.UI.call, p = $('callPanel');
    if (!c) { p.hidden = true; document.body.classList.remove('is-calling'); return; }
    p.hidden = false; document.body.classList.add('is-calling');
    const a = T.app(c.app), cand = T.cand(a.cand), r = T.req(a.req);
    const lines = c.rec ? SCRIPT(a).slice(0, c.shown).map(l => `<p class="call-line is-${l[0] === 'you' ? 'you' : 'them'}"><span class="call-who">${l[0] === 'you' ? 'Omar' : 'Them'}</span>${e(l[1])}</p>`).join('')
      : c.state === 'live' ? (c.asking ? `<div class="call-consent"><p class="call-consent-say">“This call is recorded so AiMY can write it up. Is that all right?”</p><div class="call-consent-acts"><button class="s-insight-lnk primary" type="button" data-recyes>They agreed</button><button class="b-ghost" type="button" data-recno>They said no</button></div></div>` : '<p class="call-none">Not recording. Nothing is being written down.</p>') : '';
    p.innerHTML = `<div class="call-who-block"><div class="call-who-top"><p class="call-name">${e(cand.name)}</p>${c.state === 'live' ? `<span class="call-timer">${Math.floor(c.secs / 60)}:${String(c.secs % 60).padStart(2, '0')}</span>` : ''}</div>
        <p class="call-sub">${e(cand.headline)} · ${e(r.title)}</p><p class="call-num">+20 10 ${String(1000 + cand.name.length * 137).slice(0, 4)} ${String(5000 + cand.name.length * 59).slice(0, 4)} · phone screen</p>
        <p class="call-sub">${T.ic('lock', 12)} Design target: Talent's telephony is on hold with AiMY Phone</p></div>
      <div class="call-lines" id="callLines">${lines}</div>
      <div class="call-tools">${c.state === 'ready' ? `<button class="call-end call-go" type="button" data-callgo>Call from +20 2 2555 0100</button>`
        : `${c.rec || c.asking ? '' : '<button class="call-tool b-ghost" type="button" data-recask>Record</button>'}<button class="call-end" type="button" data-hangup aria-label="Hang up" title="Hang up"><span style="display:inline-flex;transform:rotate(135deg)">${T.ic('phone', 18)}</span></button>`}<button class="call-min" type="button" data-callclose aria-label="Close">${T.ic('back', 14)}</button></div>`;
    const cl = $('callLines'); if (cl) cl.scrollTop = cl.scrollHeight;
  }
  function brief(a) {
    const c = T.cand(a.cand), r = T.req(a.req);
    const unk = T.evidence(a).filter(x => x.v === 'unknown');
    return `<div class="s-ans"><div class="s-ans-title">Before you speak to ${e(c.name)}</div><div class="s-ans-body"><div class="b-prep">
      <p class="b-prep-id">${e(c.headline)} · ${e(r.title)}</p>
      <div class="b-prep-state">${T.tag(T.STAGES[a.stage].label, T.overdue(a) ? 'warn' : 'info')}<span class="b-prep-owed">since ${T.fmt(a.since)}</span>${T.overdue(a) ? `<span class="b-prep-due is-late">waited ${T.age(a.since)}, usually ${T.STAGES[a.stage].exp}</span>` : ''}</div>
      <blockquote class="b-open"><span class="b-open-cap">Open with</span><p class="b-open-say">The ${e(r.title)} role at ${e(T.acc(r.acc).name)}, and that the call takes ten minutes.</p></blockquote>
      <div class="b-prep-know"><p class="b-prep-line"><b>${e(T.evCount(a).text)}.</b> ${unk.length ? 'Ask about: ' + unk.map(x => e(x.c.text.toLowerCase())).join(', ') + '. The CV is silent there.' : 'Nothing is unknown.'}</p></div>
      <h3 class="b-brief-cap">If they ask</h3><div class="b-back">
        <div class="b-back-row"><span class="b-back-k">Salary</span><p class="b-back-v">The band is ${e(r.budget)}. Ask theirs first; never promise a number.</p></div>
        <div class="b-back-row"><span class="b-back-k">Next steps</span><p class="b-back-v">${e(T.tpl(r).slice(T.tpl(r).indexOf(a.stage) + 1, T.tpl(r).indexOf(a.stage) + 4).map(k => T.STAGES[k].label).join(', then '))}.</p></div>
        <div class="b-back-row"><span class="b-back-k">Recording</span><p class="b-back-v">${c.consent.rec != null ? 'They agreed ' + T.fmt(c.consent.rec) + '.' : 'Ask before you record. No is a fine answer.'}</p></div></div>
      </div></div><div class="s-ans-cite"><span>Read from the CV and ${a.hist.length} steps on the record</span></div></div>`;
  }
  const OUT = { passed: ['Passed the call', 'ok'], out: ['Not progressing', 'warn'], later: ['Call back later', 'neutral'], none: ['No answer', 'neutral'] };
  function readBack(app, pick) {
    const a = T.app(app), r = T.req(a.req), next = T.nextStage(a);
    const o = OUT[pick];
    const qn = Object.values(D().apps).find(x => x.id !== a.id && T.req(x.req).owner === 'omar' && x.stage === 'phone' && T.waitOn(x) === 'me');
    T.UI.rb = { app, pick };
    return `<div class="s-ans"><div class="s-ans-title">I read that as ${e(o[0].toLowerCase())}. Is that right?</div><div class="s-ans-body"><div class="s-callsum"><div class="s-callsum-rows">
      ${[['Outcome', o[0], o[1]], ['Notice', 'One month', 'neutral'], ['Salary', '30,000 a month, inside the band (' + r.budget + ')', 'ok'],
        ...T.evidence(a).filter(x => x.v === 'unknown' && x.c.must).slice(0, 1).map(x => [x.c.text, 'Confirmed on the call', 'ok']),
        ['Stage', pick === 'passed' && next ? T.STAGES[a.stage].label + ' → ' + T.STAGES[next].label : 'stays at ' + T.STAGES[a.stage].label, pick === 'passed' ? 'ok' : 'neutral']]
        .map(rw => `<div class="s-callsum-row"><span class="s-callsum-cap">${e(rw[0])}</span><span class="s-callsum-val tone-${rw[2]}">${e(rw[1])}</span></div>`).join('')}</div>
      <details class="s-trace"><summary class="s-trace-sum">Transcript<span class="s-trace-n">${SCRIPT(a).length}</span></summary><div class="s-said-lines">${SCRIPT(a).map(l => `<p class="call-line is-${l[0] === 'you' ? 'you' : 'them'}"><span class="call-who">${l[0] === 'you' ? 'Omar' : 'Them'}</span>${e(l[1])}</p>`).join('')}</div></details></div></div>
      <div class="msg-acts">${Object.entries(OUT).map(([k, v], i) => `<button class="filter-chip${k === pick ? ' active' : ''}" type="button" data-rbpick="${k}"><kbd class="b-kbd">${i + 1}</kbd> ${e(v[0])}</button>`).join('')}</div>
      <div class="msg-acts"><button class="s-insight-lnk primary" type="button" data-logit>Log it</button>${qn ? `<button class="s-insight-lnk" type="button" data-logit="${qn.id}">Log it and call ${e(T.cand(qn.cand).name)}</button>` : ''}</div></div>`;
  }

  // ---------- stage moves ----------
  const INTERVIEWER = { hr: 'sara', tech: 'mostafa', mgr: 'rania', client: 'jana', ctech: 'jana' };
  function advance(a) {
    const next = T.nextStage(a); if (!next) return '';
    const c = T.cand(a.cand);
    a.stage = next; a.since = 0;
    a.hist.push({ day: 0, text: 'Moved to ' + T.STAGES[next].label, who: T.me().name });
    if (a.prospect && next === 'applied') { a.prospect = false; c.prospect = false; c.consent.cv = 0; }
    if (INTERVIEWER[next]) {
      const book = D().autonomy.find(x => x.k === 'book');
      if (book.rung >= 1) { const id = T.id('i'); D().interviews[id] = { id, app: a.id, kind: next, day: 2, time: '10:00', who: INTERVIEWER[next], mode: 'On Teams', recording: false, debrief: null, others: [] }; return `Booked ${T.wday(2)} 10:00 with ${T.person(INTERVIEWER[next])} in Bookings.`; }
      return `Booking is set to Suggest: ${T.wday(2)} 10:00 with ${T.person(INTERVIEWER[next])} is free.`;
    }
    if (next === 'assess') return c.consent.wa != null ? 'Invite sent on WhatsApp; they opted in ' + T.fmt(c.consent.wa) + '.' : 'Invite sent by email: there is no WhatsApp opt-in.';
    if (next === 'offer') { const id = T.id('o'); D().offers[id] = { id, app: a.id, salary: 'To confirm', band: T.req(a.req).budget, notice: '30 days', start: 30, approvals: { hm: null, bu: null }, sent: null }; return 'Offer drafted. Rania Samir and Hesham Nabil approve it in parallel.'; }
    if (next === 'accepted') { a.joinDay = 30; return 'Accepted to joined is tracked as its own stage.'; }
    if (next === 'joined') { a.joinDay = 0; a.checkins = [{ day: 30, due: 30, done: null }, { day: 90, due: 90, done: null }]; return 'Day-30 and day-90 check-ins set.'; }
    return '';
  }
  function exit(a, kind, note) { a.exit = kind; a.exitDay = 0; if (note) a.exitNote = note; a.hist.push({ day: 0, text: T.EXITS[kind] + (note ? ': ' + note : ''), who: T.me().name }); }
  function passWith(a, why, note) {
    const r = T.req(a.req), acc = T.acc(r.acc), client = T.desk() === 'jana';
    a.exit = 'clientno'; a.exitDay = 0; a.decline = { why, note, day: 0 };
    a.sendout.decided = 0; a.sendout.result = 'pass'; if (a.sendout.opened == null) a.sendout.opened = 0;
    a.hist.push({ day: 0, text: 'Client declined: ' + T.REASONS[why] + (note ? ' · ' + note : ''), who: client ? T.person('jana') : T.me().name + ', for the client' });
    D().declines.push({ acc: acc.id, why, day: 0, req: r.id, app: a.id });
    news('omar', { sev: 'p1', type: 'Client decision', body: `${acc.name} passed on ${T.cand(a.cand).name}: ${T.REASONS[why].toLowerCase()}. They are owed an answer within ${T.TELL_WITHIN} days.`, cta: 'Open the record', go: { con: a.id } });
    const n = D().declines.filter(d => d.acc === acc.id && d.why === why && d.day >= -30).length, short = acc.name.split(' ')[0];
    return `${T.ord(n)} ${short} decline this month for ${T.REASON_SHORT[why]}. It feeds matching for ${short} only.`;
  }

  // ---------- the bar: a question or a sentence ----------
  function answer(text) {
    const s = text.toLowerCase(), desk = T.desk();
    const link = (o, l) => `<button class="slv-n" type="button" data-go='${JSON.stringify(o)}'>${e(l)}</button>`;
    let m;
    if ((m = s.match(/(?:called|spoke to|talked to)\s+([a-z]+).*?(passed|not interested|withdrew|no answer)/))) {
      const a = Object.values(D().apps).find(x => T.active(x) && T.first(T.cand(x.cand).name).toLowerCase() === m[1]);
      if (a) {
        const pick = m[2] === 'passed' ? 'passed' : m[2] === 'no answer' ? 'none' : 'out';
        return { html: `I read that as <b>${e(T.cand(a.cand).name)}</b>, ${e(OUT[pick][0].toLowerCase())}${pick === 'passed' && T.nextStage(a) ? ': moving to ' + e(T.STAGES[T.nextStage(a)].label) : ''}.`, acts: `<button class="s-insight-lnk primary" type="button" data-rbapp="${a.id}" data-rbpick2="${pick}">Log it</button>` };
      }
    }
    if (/^(request|ask for) a hire:?\s*(.+)/.test(s)) {
      const t = text.replace(/^(request|ask for) a hire:?\s*/i, '');
      if (!t) return { html: 'Say who you need, in a sentence: “Two German support agents from January”.' };
      T.commit('Sent to Rania Samir, to talk through first.', () => D().asks.push({ id: T.id('k'), acc: desk === 'jana' ? 'nw' : 'ft', from: desk, day: 0, text: t, status: 'open' }));
      news('rania', { type: 'Hiring request', body: `${T.me().name} asked: “${t}”`, cta: 'Talk it through', go: {} });
      return { html: `Sent to <b>Rania Samir</b>. Nothing opens until she has talked it through with you.` };
    }
    if (/wait|first|today/.test(s)) {
      const items = bellItems().slice(0, 3);
      return { html: items.length ? 'First: ' + items.map(i => `${link(i.go, i.cta)} (${e(i.type.toLowerCase())})`).join(', then ') + '.' : 'Nothing waits on you.' };
    }
    if (/risk/.test(s)) { const r = Object.values(D().reqs).filter(T.atRisk); return { html: `${T.plural(r.length, 'requisition is', 'requisitions are')} at risk: ${r.map(x => link({ req: x.id }, x.title)).join(', ')}.` }; }
    if (/why|pass|declin|turn down/.test(s)) { const nw = T.declinesFor('nw'), top = T.reasonCounts(nw)[0]; return { html: `At Northwind, <b>${e(T.REASONS[top[0]].toLowerCase())}</b> is behind ${top[1]} of ${nw.length} declines in 90 days. ${link({ on: 'reports' }, 'All the reasons')}` }; }
    if (/lose|drop|funnel/.test(s)) return { html: `Upstream, mostly: 268 passed the phone screen and 81 profiles went to clients, and the first one took 14 days. ${link({ on: 'reports' }, 'See the funnel')}` };
    if (/find|someone like|search|look for/.test(s)) { findChat(null); return { html: 'Finding people in the canvas.' }; }
    if (/where are my|my requests/.test(s) && desk === 'jana') return { html: `${Object.values(D().reqs).filter(r => r.acc === 'nw' && T.isOpen(r)).map(r => e(r.title)).join(' and ')} are open.` };
    return { html: 'I can say what waits on you, what is at risk, why clients pass and where people drop; find people; take a hiring request; or log a call in a sentence: “Called Hana, she passed the call”.' };
  }
  function ask(text) {
    if (!text.trim()) return;
    say('you', e(text));
    const a = answer(text);
    say('aimy', a.html + (a.acts ? `<div class="msg-acts">${a.acts}</div>` : ''));
    $('floatInput').value = '';
    if (!T.UI.canvas) T.peek(a.html, a.acts); else paintCanvas();
  }

  // ---------- finding people through the chat (Sales B8) ----------
  function findChat(reqId, brief) {
    T.UI.fc = { req: reqId || 'r1', src: null, brief };
    if (brief) say('you', e(brief));
    say('aimy', `From your talent pool, public pages, or both? <div class="msg-acts"><button class="filter-chip" type="button" data-fc="both">Both, pool first</button><button class="filter-chip" type="button" data-fc="pool">Only the pool</button><button class="filter-chip" type="button" data-fc="web">Only public pages</button></div>`);
    T.openCanvas('Finding people');
  }
  function fcStep(v) {
    const f = T.UI.fc, r = T.req(f.req);
    if (['both', 'pool', 'web'].includes(v)) {
      f.src = v; say('you', { both: 'Both, pool first', pool: 'Only the pool', web: 'Only public pages' }[v]);
      say('aimy', `I read that as the success profile for <b>${e(r.title)}</b>: ${r.criteria.filter(c => c.must).map(c => e(c.text)).join(', ')}. One narrowing: only people who reached an interview before?
        <div class="msg-acts"><button class="s-insight-lnk primary" type="button" data-fc="enough">That is enough</button><button class="s-insight-lnk" type="button" data-fc="narrow">Narrow it</button></div>`);
    } else if (v === 'enough' || v === 'narrow') {
      say('you', v === 'enough' ? 'That is enough' : 'Narrow it');
      say('aimy', `<span class="work-state ws-ongoing">Curating</span> Talent pool, then public profiles and company pages. Never LinkedIn scraping; SignalHire is parked.`);
      paintCanvas();
      setTimeout(() => {
        const ppl = T.FIND_ALL.filter(p => (f.src === 'both' || p.kind === f.src) && (v === 'enough' || p.kind === 'pool' || p.ev[0] === 'm'));
        f.people = ppl;
        say('aimy', `${T.plural(ppl.length, 'person', 'people')} came back: ${ppl.filter(p => p.kind === 'pool').length} from your pool, ${ppl.filter(p => p.kind === 'web').length} from public pages. I would call it “${e(r.title.split(' (')[0])}, ${T.fmt(0)}”.
          <div class="msg-acts"><button class="s-insight-lnk primary" type="button" data-fc="curate">Curate the list</button></div>`);
        paintCanvas();
      }, 1400);
    } else if (v === 'curate') {
      T.UI.draft = { name: T.req(f.req).title.split(' (')[0] + ', ' + T.fmt(0), req: f.req, people: f.people, keep: {} };
      closeCanvas();
      T.go({ list: 'draft' });
    }
    paintCanvas();
  }
  function draftTo(target) {
    const d = T.UI.draft, kept = d.people.filter(p => d.keep[p.id] !== false), r = T.req(d.req);
    if (target === 'req') {
      T.UI.draft = null; T.UI.leaving = false;
      T.commit(`${T.plural(kept.length, 'person', 'people')} added to ${r.title}.`, () => kept.forEach(p => {
        if (!D().cands[p.id]) D().cands[p.id] = { id: p.id, name: p.name, city: 'Cairo', headline: p.head, source: p.kind === 'pool' ? 'Talent pool' : 'Public web', webSrc: p.src, prospect: p.kind === 'web',
          consent: p.kind === 'pool' ? { cv: -120, wa: p.wa ? -120 : null, rec: null } : { cv: null, wa: null, rec: null }, cvSays: {}, found: {}, notes: [] };
        if (T.appsOf(r.id).some(a => a.cand === p.id)) return;
        const id = T.id('a');
        D().apps[id] = { id, cand: p.id, req: r.id, stage: 'sourced', since: 0, ev: p.ev.slice(0, r.criteria.length).padEnd(r.criteria.length, 'u'), exit: null, prospect: p.kind === 'web', hist: [{ day: 0, text: p.kind === 'pool' ? 'Added from the talent pool' : 'Found on ' + p.src, who: T.me().name }] };
      }), kept.some(p => p.kind === 'web') ? 'Web people wait for your approval of first contact.' : '');
      T.go({ req: r.id }, { force: true });
    } else if (target === 'save') {
      T.UI.draft = null; T.UI.leaving = false;
      T.commit('Shortlist saved.', () => D().lists.unshift({ id: T.id('l'), name: d.name, req: null, people: kept.map(p => p.id), day: 0, by: T.desk() }));
      T.go(pending || { on: 'lists' }, { force: true }); pending = null;
    } else {
      T.UI.draft = null; T.UI.leaving = false;
      T.toast('Shortlist discarded.');
      T.go(pending || {}, { force: true }); pending = null;
    }
  }

  // ---------- every press ----------
  const val = id => { const el = $(id); return el ? el.value.trim() : ''; };
  const shake = id => { const el = $(id); if (!el) return; el.focus(); el.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 240 }); };
  const A = [
    ['undo', () => T._undo && T._undo()],
    ['back', () => { if (T.UI.draft && T.url().list === 'draft') { T.UI.leaving = true; pending = {}; render(); $('pageScroll').scrollTop = 0; return; } if (depth > 0) history.back(); else T.go({}); }],
    ['home', () => T.go({})],
    ['bellgo', el => { $('ntfPanel').hidden = true; T.go(JSON.parse(el.dataset.bellgo)); }],
    ['go', el => { const o = JSON.parse(el.dataset.go); if (o.as) { T.go(o); return; } T.go(o); }],
    ['as', el => { $('asPanel').hidden = true; T.UI.open = {}; T.UI.chat = []; closeCanvas(); peekAway(); T.UI.call = null; T.go({ as: el.dataset.as }); setTimeout(() => T.peek(`Welcome, <b>${e(T.first(T.me().name))}</b>. How can I help you today?`), 0); }],
    ['q', el => { const u = T.url(); T.go({ on: u.on, req: u.req, q: el.dataset.q }); }],
    ['page', el => { const u = T.url(); T.go({ on: u.on, req: u.req, q: u.q, list: u.list, p: el.dataset.page }); }],
    ['con', el => T.go({ con: el.dataset.con })],
    ['open', el => T.go({ con: el.dataset.open })],
    ['req', el => T.go({ req: el.dataset.req })],
    ['list', el => T.go({ list: el.dataset.list })],
    ['debrief', el => T.go({ debrief: el.dataset.debrief })],
    ['approve', el => T.go({ approve: el.dataset.approve, by: el.dataset.by })],
    ['me', el => { T.UI.meOk = false; T.go({ me: el.dataset.me }); }],
    ['say', el => { $('floatInput').value = el.dataset.say; $('floatInput').focus(); }],
    ['findchat', el => findChat(el.dataset.findchat === '1' ? null : el.dataset.findchat)],
    ['fc', el => fcStep(el.dataset.fc)],
    ['prep', el => { const iv = D().interviews[el.dataset.prep], a = T.app(iv.app); say('aimy', brief(a)); T.openCanvas(T.cand(a.cand).name); }],

    ['call', el => startCall(el.dataset.call)],
    ['callgo', () => { const c = T.UI.call; c.state = 'live'; paintCall(); c.timer = setInterval(() => { c.secs++; if (c.rec && c.shown < SCRIPT(T.app(c.app)).length && c.secs % 2 === 0) c.shown++; paintCall(); }, 600); }],
    ['recask', () => { T.UI.call.asking = true; paintCall(); }],
    ['recyes', () => { const c = T.UI.call; c.asking = false; c.rec = true; T.cand(T.app(c.app).cand).consent.rec = 0; paintCall(); }],
    ['recno', () => { T.UI.call.asking = false; paintCall(); }],
    ['hangup', () => { const c = T.UI.call; clearInterval(c.timer); T.UI.call = null; paintCall(); say('aimy', readBack(c.app, 'passed')); T.openCanvas(T.cand(T.app(c.app).cand).name); }],
    ['callclose', () => { const c = T.UI.call; if (c && c.timer) clearInterval(c.timer); T.UI.call = null; paintCall(); }],
    ['rbpick', el => { say('aimy', readBack(T.UI.rb.app, el.dataset.rbpick)); paintCanvas(); }],
    ['logit', el => logIt(T.UI.rb.app, T.UI.rb.pick, el.dataset.logit)],
    ['rbapp', el => { peekAway(); logIt(el.dataset.rbapp, el.dataset.rbpick2); }],

    ['advance', el => { const a = T.app(el.dataset.advance), to = T.STAGES[T.nextStage(a)].label; T.commit(`${T.cand(a.cand).name} moved to ${to}.`, () => advance(a), s => s); }],
    ['write', el => { T.UI.open['wu' + el.dataset.write] = true; if (T.url().con !== el.dataset.write) T.go({ con: el.dataset.write }); else render(); }],
    ['writeclose', el => { T.UI.open['wu' + el.dataset.writeclose] = false; render(); }],
    ['sendprofile', el => { const a = T.app(el.dataset.sendprofile), r = T.req(a.req), text = val('wu-' + a.id); T.UI.open['wu' + a.id] = false;
      T.commit(`Profile sent to ${T.acc(r.acc).name}.`, () => { a.stage = 'sent'; a.since = 0; a.sendout = { sent: 0, opened: null, decided: null, by: 'omar', writeup: text }; if (r.firstSent == null) r.firstSent = 0; a.hist.push({ day: 0, text: 'Profile sent, write-up approved', who: T.me().name }); }, 'The sendout is a record now; it shows opened when the client opens it.'); }],
    ['offersend', el => { const a = T.app(el.dataset.offersend), o = T.offerOf(a.id); T.commit(`Offer sent to ${T.cand(a.cand).name}.`, () => { o.sent = 0; a.hist.push({ day: 0, text: 'Offer sent', who: T.me().name }); }, T.cand(a.cand).consent.wa != null ? 'Questions come back on WhatsApp; money questions go to you.' : 'Sent by email: no WhatsApp opt-in.'); }],
    ['tell', el => { const a = T.app(el.dataset.tell), c = T.cand(a.cand); T.commit(`Answer sent to ${c.name} by ${c.consent.wa != null ? 'WhatsApp' : 'email'}.`, () => { a.toldDay = 0; a.hist.push({ day: 0, text: 'Told, under the HR template', who: T.me().name }); }, 'The reason stays internal. A person sent it; AiMY never declines on its own.'); }],
    ['tellall', () => { const ids = T.untold().filter(a => T.req(a.req).owner === 'omar').map(a => a.id); T.commit(`${T.plural(ids.length, 'answer')} sent under the HR template.`, () => ids.forEach(id => { const a = T.app(id); a.toldDay = 0; a.hist.push({ day: 0, text: 'Told, under the HR template (all at once)', who: T.me().name }); }), 'One Undo takes back all of them.'); }],
    ['contact', el => { const a = T.app(el.dataset.contact); T.commit(`First contact approved for ${T.cand(a.cand).name}.`, () => { a.contacted = true; a.hist.push({ day: 0, text: 'First contact approved; sent by email', who: T.me().name }); }, 'Sent by email. No WhatsApp before an opt-in.'); }],
    ['contactall', () => { const ids = Object.values(D().apps).filter(a => T.waitOn(a) === 'approval' && T.req(a.req).owner === 'omar').map(a => a.id); T.commit(`First contact approved for ${T.plural(ids.length, 'prospect')}.`, () => ids.forEach(id => { const a = T.app(id); a.contacted = true; a.hist.push({ day: 0, text: 'First contact approved; sent by email', who: T.me().name }); }), 'Approved once, for the list. Sent by email.'); }],
    ['meet', el => { const a = T.app(el.dataset.meet); T.commit(`${T.desk() === 'jana' ? 'You want' : 'The client wants'} to meet ${T.cand(a.cand).name}.`, () => {
      a.sendout.decided = 0; a.sendout.result = 'meet'; if (a.sendout.opened == null) a.sendout.opened = 0; a.stage = 'client'; a.since = 0; a.hist.push({ day: 0, text: 'Client wants to meet', who: T.person('jana') });
      const id = T.id('i'); D().interviews[id] = { id, app: a.id, kind: 'client', day: 3, time: '14:00', who: 'jana', mode: 'On Teams', recording: false, debrief: null, others: [] };
      news('omar', { sev: 'p2', type: 'Client decision', body: `Northwind wants to meet ${T.cand(a.cand).name}. Booked ${T.wday(3)} 14:00.`, cta: 'Open the record', go: { con: a.id } }); }, `Booked ${T.wday(3)} 14:00 on Teams.`); }],
    ['passopen', el => { T.UI.open['pass' + el.dataset.passopen] = true; render(); }],
    ['passcancel', el => { T.UI.open['pass' + el.dataset.passcancel] = false; render(); }],
    ['pass', el => { const a = T.app(el.dataset.pass), why = el.dataset.why, note = why === 'other' ? val('other-' + a.id) : '';
      if (why === 'other' && !note) { shake('other-' + a.id); return; }
      T.UI.open['pass' + a.id] = false;
      T.commit(`Passed on ${T.cand(a.cand).name}: ${T.REASONS[why].toLowerCase()}.`, () => passWith(a, why, note), s => s); }],
    ['withdrew', el => { const a = T.app(el.dataset.withdrew); T.commit(`${T.cand(a.cand).name} withdrew.`, () => { exit(a, 'withdrew'); a.toldDay = 0; }); }],
    ['endopen', el => { T.UI.open['end' + el.dataset.endopen] = !T.UI.open['end' + el.dataset.endopen]; render(); }],
    ['out', el => { const a = T.app(el.dataset.out); T.UI.open['end' + a.id] = false; T.commit(`${T.cand(a.cand).name}: not progressing.`, () => exit(a, 'out', 'Recruiter decision'), `They hear within ${T.TELL_WITHIN} days: Not told yet.`); }],
    ['askthem', el => { T.UI.asked[el.dataset.askthem + el.dataset.c] = true; render(); T.toast('Added to the questions for the next call.'); }],
    ['publish', el => { const r = T.req(el.dataset.publish); T.commit(r.published ? `${r.title} is no longer published.` : `${r.title} is published.`, () => (r.published = !r.published), r.published ? 'Off the careers page.' : 'On the careers page, with a link to share.'); }],
    ['reqstate', el => { const r = T.req(el.dataset.reqstate); T.commit(`${r.title}: ${el.dataset.to === 'onhold' ? 'on hold' : 'open'}.`, () => (r.state = el.dataset.to)); }],
    ['askdraft', el => { const k = D().asks.find(x => x.id === el.dataset.askdraft), id = T.id('r');
      T.commit('Draft requisition opened from Jana Weber’s ask.', () => { k.status = 'drafted'; D().reqs[id] = { id, title: 'Bilingual Technical Support (German), Leipzig hub', acc: k.acc, seats: 2, owner: 'omar', hm: 'rania', opened: 0, target: 60, state: 'draft', published: false, kind: 'New role', budget: 'To agree with Northwind', criteria: T.req('r1').criteria.map(c => Object.assign({}, c)), critVer: 'v1 · cloned from Bilingual Technical Support (German)', firstSent: null }; }, 'Cloned from the current German requisition. A draft until it is opened.');
      T.go({ req: id }); }],
    ['nudge', el => { const a = T.app(el.dataset.nudge); T.commit(`Nudged ${T.acc(T.req(a.req).acc).name} about ${T.cand(a.cand).name}.`, () => { a.nudged = 0; a.hist.push({ day: 0, text: 'Client nudged by email', who: T.me().name }); }); }],
    ['reassign', el => { const r = T.req(el.dataset.reassign), to = el.dataset.to, from = r.owner;
      T.commit(`${r.title} reassigned to ${T.person(to)}.`, () => { r.owner = to; news(to, { sev: 'p1', type: 'Assigned to you', body: `Dina Ragab gave you ${r.title}: you carry the fewest open requisitions.`, cta: 'Open it', go: { req: r.id } }); news(from, { type: 'Reassigned', body: `${r.title} went to ${T.person(to)}.`, cta: 'Open it', go: { req: r.id } }); }, 'The reason travels with it.'); }],
    ['prop', el => { const p = D().props.find(x => x.id === el.dataset.prop), ok = el.dataset.to === 'approved';
      T.commit((ok ? 'Approved: ' : 'Not now: ') + p.title + '.', () => { p.status = el.dataset.to; p.decided = 0; if (!ok) return;
        if (p.kind === 'question') { const q = D().asmts[p.asmt].qs.find(x => x.id === p.q); q.versions = q.versions || [{ v: 1, text: q.text, by: 'Dina Ragab', day: -60 }]; q.versions.push({ v: q.versions.length + 1, text: p.change, by: 'Dina Ragab', day: 0 }); q.text = p.change; }
        if (p.kind === 'decline') { const r = T.req('r1'); r.extraCheck = 'German speaking check before Profile sent, approved by Dina Ragab ' + T.fmt(0); r.critVer = 'v4 · Dina Ragab, ' + T.fmt(0); } },
        ok ? (p.kind === 'decline' ? 'The success profile gets a new version; earlier scores keep theirs.' : 'The question keeps its earlier wording as a version.') : 'AiMY will not propose it again for 30 days.'); }],
    ['rung', el => { const x = D().autonomy.find(y => y.k === el.dataset.rung), to = Number(el.dataset.to); if (to === x.rung) return;
      T.commit(`${x.label}: ${T.RUNGS[to]}.`, () => { x.log.push({ day: 0, text: (to > x.rung ? 'Moved up to ' : 'Moved down to ') + T.RUNGS[to] + ' by Dina Ragab' + (to > x.rung ? ". AiMY's reason: no overrides in 30 days." : '.') }); x.rung = to; }); }],
    ['keep', el => { const d = T.UI.draft; d.keep[el.dataset.keep] = d.keep[el.dataset.keep] === false; render(); }],
    ['listadd', () => draftTo('req')],
    ['listsave', () => draftTo('save')],
    ['listdiscard', () => draftTo('discard')],
    ['liststay', () => { T.UI.leaving = false; pending = null; render(); }],

    ['dbv', el => { T.UI.db.v[el.dataset.dbv] = el.dataset.to; render(); }],
    ['dbp', el => { T.UI.db.proceed = el.dataset.dbp; render(); }],
    ['gapask', () => { T.UI.gapAsked = true; render(); T.toast('AiMY will ask by message: “How would you set up a VPN for a new office?”'); }],
    ['dbsend', () => { const f = T.UI.db, iv = D().interviews[f.id], a = T.app(iv.app), c = T.cand(a.cand), r = T.req(a.req);
      T.commit('Debrief sent. Others\' feedback is now visible.', () => {
        iv.debrief = { by: iv.who, v: Object.assign({}, f.v), proceed: f.proceed === 'yes', day: 0 };
        r.criteria.forEach((cr, i) => { const v = f.v[cr.id]; if (!v) return; const q = (iv.quotes || {})[cr.id];
          c.found[cr.id] = { text: (f.edits[cr.id] ?? (q ? q.q : 'Rated ' + v)).replace(/^"|"$/g, '').slice(0, 90), status: v === 'met' ? 'confirmed' : 'differs', src: T.STAGES[iv.kind].label + ', ' + T.fmt(iv.day) + (q ? ' · ' + q.at : '') };
          a.ev = a.ev.slice(0, i) + ({ met: 'm', partly: 'p', not: 'n' })[v] + a.ev.slice(i + 1); });
        a.hist.push({ day: 0, text: 'Debrief in: ' + (f.proceed === 'yes' ? 'proceed' : 'do not proceed'), who: T.person(iv.who) });
        D().news = D().news.filter(n => !(n.go && n.go.debrief === iv.id));
        news('omar', { sev: 'p1', type: 'Debrief in', body: `${T.person(iv.who)} says ${f.proceed === 'yes' ? 'proceed' : 'do not proceed'} on ${c.name}.`, cta: 'Decide', go: { con: a.id } }); }, 'Back with Omar Saeed to decide.'); }],
    ['approveok', el => { const o = D().offers[el.dataset.approveok], by = el.dataset.by; T.commit('Approved.', () => { o.approvals[by] = { ok: true, day: 0 }; D().news = D().news.filter(n => !(n.go && n.go.approve === o.id && n.to === (by === 'bu' ? 'hesham' : 'rania'))); if (o.approvals.hm && o.approvals.bu) news('omar', { sev: 'p1', type: 'Offer approved', body: `Both approved ${T.cand(T.app(o.app).cand).name}'s offer. A person sends it.`, cta: 'Send it', go: { con: o.app } }); }); }],
    ['approveno', el => { const o = D().offers[el.dataset.approveno], by = el.dataset.by, note = val('nyet'); if (!note) { shake('nyet'); return; } T.commit('Sent back: ' + note, () => (o.approvals[by] = { ok: false, day: 0, note })); }],
    ['lang', el => { T.UI.lang = el.dataset.lang; render(); }],
    ['applycv', () => { T.UI.applyStep = 1; render(); }],
    ['applyphone', () => { T.UI.applyStep = 2; render(); }],
    ['applysend', () => { if (!$('ccv').checked) { shake('ccv'); return; } const wa = $('cwa').checked;
      if (!D().cands.yara) { D().cands.yara = { id: 'yara', name: 'Yara Mansour', city: 'Cairo', headline: 'Technical support, German C1', source: 'Applied · careers link', consent: { cv: 0, wa: wa ? 0 : null, rec: null }, cvSays: { c1: 'C1', c2: 'Zendesk, 3 years', c3: 'L2 troubleshooting', c4: 'Night shifts', c5: 'Not stated' }, found: {}, notes: [] };
        const id = T.id('a'); D().apps[id] = { id, cand: 'yara', req: 'r1', stage: 'applied', since: 0, ev: 'mmmmu', exit: null, hist: [{ day: 0, text: 'Applied through the careers page with AiMY', who: 'Yara Mansour' }] }; }
      T.UI.applyStep = 3; T.save(); render(); }],
    ['meok', () => { T.UI.meOk = true; render(); }],
    ['withdraw', el => { const a = T.app(el.dataset.withdraw); T.commit('Your application is withdrawn.', () => { exit(a, 'withdrew'); a.toldDay = 0; }); }],
    ['wa', el => { const c = T.cand(el.dataset.wa); T.commit(c.consent.wa != null ? 'WhatsApp updates off. We will use email.' : 'WhatsApp updates on.', () => (c.consent.wa = c.consent.wa != null ? null : 0)); }],
    ['reset', () => { T.reset(); T.UI = { open: {}, sel: {}, asked: {}, chat: [], draft: null, call: null, lang: 'en' }; $('protoPanel').hidden = true; closeCanvas(); T.go({}, { force: true }); T.toast('Back to the seed.'); }],
  ];
  function startCall(id) {
    const a = T.app(id);
    T.UI.call = { app: a.id, state: 'ready', secs: 0, shown: 0, rec: false };
    T.UI.chat = []; say('aimy', brief(a));
    if (T.url().con !== a.id) T.go({ con: a.id }); else render();
    T.openCanvas(T.cand(a.cand).name);
  }
  function logIt(app, pick, nextApp) {
    const a = T.app(app), c = T.cand(a.cand);
    closeCanvas();
    if (pick === 'passed') {
      T.commit(`Logged: ${c.name} passed the call.`, () => { a.ev = a.ev.replace(/u/, 'm'); a.hist.push({ day: 0, text: 'Phone screen: passed (AiMY read it back, confirmed)', who: T.me().name }); return advance(a); }, s => s);
    } else if (pick === 'out') {
      T.commit(`Logged: ${c.name} is not progressing.`, () => exit(a, 'out', 'After the phone screen'), `They hear within ${T.TELL_WITHIN} days.`);
    } else {
      T.commit(`Logged: ${OUT[pick][0].toLowerCase()}.`, () => a.hist.push({ day: 0, text: 'Phone screen: ' + OUT[pick][0].toLowerCase(), who: T.me().name }));
    }
    if (nextApp) startCall(nextApp);
  }

  document.addEventListener('click', ev => {
    const t = ev.target;
    // menus
    const openers = { asBtn: 'asPanel', ntfBell: 'ntfPanel', prodChev: 'prodMenu', protoToggle: 'protoPanel' };
    for (const [b, p] of Object.entries(openers)) {
      if (t.closest('#' + b)) { const el = $(p); el.hidden = !el.hidden; $(b).setAttribute('aria-expanded', String(!el.hidden)); if (p === 'protoPanel') paintProto(); if (p === 'ntfPanel' && !el.hidden) { bellItems().forEach(i => (D().read[i.id] = 1)); T.save(); setTimeout(paintBell, 400); } return; }
      if (!$(p).hidden && !t.closest('#' + p)) $(p).hidden = true;
    }
    if (t.closest('#ntfClear')) { bellItems().forEach(i => (D().read[i.id] = 1)); T.save(); paintBell(); return; }
    if (t.closest('#ntfAskAll')) { $('ntfPanel').hidden = true; ask('What should I do first?'); return; }
    if (t.closest('#railToggle')) { $('appRail').classList.toggle('is-open'); return; }
    if (t.closest('#railScrim')) { $('appRail').classList.remove('is-open'); return; }
    if (t.closest('[data-home]')) { closeCanvas(); T.go({}); return; }
    if (t.closest('#peekClose')) { peekAway(); return; }
    if (t.closest('#peekGrip')) { $('aimyPeek').classList.toggle('is-shut'); return; }
    if (t.closest('#peekOpen')) { T.openCanvas(); return; }
    if (t.closest('#canvasOpen')) { T.openCanvas(); return; }
    if (t.closest('[data-overlay-close]')) { closeCanvas(); return; }
    if (t.closest('#floatSend')) { ask($('floatInput').value); return; }
    if (t.closest('#overlaySend')) { ask($('overlayInput').value); $('overlayInput').value = ''; return; }
    const el = t.closest('button, a, article[data-open]');
    if (!el || el.disabled) return;
    for (const [k, fn] of A) {
      if (el.dataset[k] !== undefined) {
        if (k === 'open' && t.closest('button')) continue;
        ev.preventDefault();
        if (t.closest('#aimyOverlay') && !['fc', 'rbpick', 'logit', 'rbapp'].includes(k)) closeCanvas();
        fn(el, ev);
        return;
      }
    }
  });
  document.addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.dbedit && T.UI.db) T.UI.db.edits[el.dataset.dbedit] = el.value;
    if (el.dataset.find !== undefined) { T.UI.find = el.value; const pos = el.selectionStart; render(); const n = document.querySelector('[data-find]'); if (n) { n.value = T.UI.find; n.focus(); n.setSelectionRange(pos, pos); } }
  });
  document.addEventListener('keydown', ev => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (ev.key === 'Enter' && document.activeElement === $('floatInput')) { ev.preventDefault(); ask($('floatInput').value); return; }
    if (ev.key === 'Enter' && document.activeElement === $('overlayInput') && !ev.shiftKey) { ev.preventDefault(); ask($('overlayInput').value); $('overlayInput').value = ''; return; }
    if (ev.key === 'Escape') { if (T.UI.canvas) closeCanvas(); else peekAway(); ['asPanel', 'ntfPanel', 'prodMenu', 'protoPanel'].forEach(p => ($(p).hidden = true)); return; }
    if (typing) return;
    if (ev.key === '/') { ev.preventDefault(); $('floatInput').focus(); return; }
    // Enter does the obvious next thing, as in Sales: call, place, hang up, log.
    if (ev.key === 'Enter') {
      const c = T.UI.call;
      if (c && c.state === 'ready') { ev.preventDefault(); document.querySelector('[data-callgo]').click(); return; }
      if (c && c.state === 'live') { ev.preventDefault(); document.querySelector('[data-hangup]').click(); return; }
      if (T.UI.canvas && document.querySelector('#overlayThread [data-logit]:not([disabled])')) { ev.preventDefault(); [...document.querySelectorAll('#overlayThread [data-logit]')].pop().click(); }
    }
    if (T.UI.canvas && T.UI.rb && /^[1-4]$/.test(ev.key)) { const k = Object.keys(OUT)[Number(ev.key) - 1]; say('aimy', readBack(T.UI.rb.app, k)); paintCanvas(); }
  });

  // The prototype panel: outside links, the comparison, the reset.
  function paintProto() {
    $('protoPanel').innerHTML = `<div class="proto-sec"><div class="proto-h">Outside links</div>
        <button class="proto-link" type="button" data-go='{"apply":"r1"}'>The careers page, applying with AiMY</button>
        <button class="proto-link" type="button" data-me="laila">Laila's own profile, by one-time code</button>
        <button class="proto-link" type="button" data-go='{"debrief":"i1"}'>Mostafa's debrief link for Ahmed</button>
        <button class="proto-link" type="button" data-go='{"approve":"o1","by":"bu"}'>The BU Director's approval link</button>
        <button class="proto-link" type="button" data-go='{"approve":"o1","by":"hm"}'>The hiring manager's approval link</button></div>
      <div class="proto-sec"><div class="proto-h">Compare</div><a class="proto-link" href="compare.html">Sales and Talent, side by side</a><a class="proto-link" href="https://aimy-sales.nour-ali.workers.dev/" target="_blank" rel="noopener">Open AiMY Sales</a></div>
      <div class="proto-sec"><div class="proto-h">Data</div><button class="proto-link" type="button" data-reset>Reset to seed</button></div>`;
  }

  // ---------- boot ----------
  history.replaceState({ d: 0 }, '', location.href);
  render();
  T.peek(`Welcome, <b>${e(T.first(T.me().name))}</b>. How can I help you today?`);
})();

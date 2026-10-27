/* AiMY Talent v2 · store, Undo, router, shell and shared components.
   Every write goes through `commit`: it snapshots the store, applies the
   change, and lands in a toast with Undo. No "are you sure". */
(function () {
  const T = window.T;
  const KEY = 'aimy-talent-v2';

  // ---------- store ----------
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 3) return s; } catch (e) {}
    return T.seed();
  }
  T.DB = load();
  T.UI = { desk: 'omar', theme: null, lang: 'en', open: {}, find: null, asked: {} };
  try { Object.assign(T.UI, JSON.parse(localStorage.getItem(KEY + ':ui')) || {}); } catch (e) {}
  T.save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(T.DB)); localStorage.setItem(KEY + ':ui', JSON.stringify({ desk: T.UI.desk, theme: T.UI.theme, lang: T.UI.lang })); } catch (e) {}
  };
  T.reset = () => { T.DB = T.seed(); T.save(); T.toast('Demo data reset to the seed.'); T.render(); };
  T.id = p => p + (++T.DB.seq);

  // ---------- helpers ----------
  T.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  T.date = d => { const x = new Date(T.TODAY); x.setDate(x.getDate() + d); return x; };
  T.fmt = d => T.date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  T.wday = d => T.date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  T.rel = d => d === 0 ? 'today' : d === -1 ? 'yesterday' : d === 1 ? 'tomorrow' : d < 0 ? (-d) + ' days ago' : 'in ' + d + ' days';
  T.age = d => { const n = -d; return n <= 0 ? 'today' : n === 1 ? '1 day' : n + ' days'; };
  T.plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  T.ord = n => n + (['th','st','nd','rd'][(n % 100 - 20) % 10] || ['th','st','nd','rd'][n % 100] || 'th');
  T.person = k => (T.STAFF[k] || {}).name || k;
  T.first = name => String(name).split(' ')[0];

  // ---------- domain reads ----------
  const D = () => T.DB;
  T.req = id => D().reqs[id];
  T.acc = id => D().accounts[id];
  T.cand = id => D().cands[id];
  T.app = id => D().apps[id];
  T.tpl = req => T.TEMPLATES[T.acc(req.acc).template].stages;
  T.appsOf = reqId => Object.values(D().apps).filter(a => a.req === reqId);
  T.appsFor = candId => Object.values(D().apps).filter(a => a.cand === candId);
  T.active = a => !a.exit && a.stage !== 'joined';
  T.nextStage = a => { const t = T.tpl(T.req(a.req)); return t[t.indexOf(a.stage) + 1] || null; };
  T.isOpen = r => r.state === 'open' || r.state === 'atrisk';
  T.daysLeft = r => r.target;
  T.atRisk = r => T.isOpen(r) && (r.target < 0 || (r.target <= 7 && T.appsOf(r.id).filter(a => T.active(a) && ['sent','client','ctech','offer','accepted'].includes(a.stage)).length < r.seats));
  T.myReqs = who => Object.values(D().reqs).filter(r => r.owner === who && r.state !== 'filled');
  T.interviewOf = (appId, kind) => Object.values(D().interviews).find(i => i.app === appId && (!kind || i.kind === kind));

  // Evidence per criterion, as counts (D2): "3 of 4 must-haves met".
  T.evidence = a => {
    const r = T.req(a.req);
    return r.criteria.map((c, i) => ({ c, v: ({ m: 'meets', p: 'partly', n: 'not', u: 'unknown' })[a.ev[i]] || 'unknown' }));
  };
  T.evCount = a => {
    const ev = T.evidence(a).filter(e => e.c.must);
    const met = ev.filter(e => e.v === 'meets').length, unk = ev.filter(e => e.v === 'unknown').length;
    return { met, of: ev.length, unk, text: met + ' of ' + ev.length + ' must-haves met' + (unk ? ' · ' + unk + ' not known' : '') };
  };

  // Who the next move waits on. Interviews hand it back to the recruiter once
  // the debrief is in.
  T.waitOn = a => {
    if (!T.active(a)) return null;
    if (a.prospect && !a.contacted) return 'approval';
    if (a.prospect) return 'candidate';
    const iv = Object.values(D().interviews).find(i => i.app === a.id && i.kind === a.stage);
    if (iv) return iv.day >= 0 ? 'booked' : iv.debrief ? 'me' : 'interviewer';
    if (a.stage === 'offer') { const o = T.offerOf(a.id); if (o && o.sent == null) return o.approvals.hm && o.approvals.hm.ok && o.approvals.bu && o.approvals.bu.ok ? 'me' : 'approvers'; }
    return T.STAGES[a.stage].who;
  };
  T.overdue = a => -a.since > (T.STAGES[a.stage].exp || 99);
  T.offerOf = appId => Object.values(D().offers).find(o => o.app === appId);

  // Held exits owed an answer (M4).
  T.untold = () => Object.values(D().apps).filter(a => (a.exit === 'out' || a.exit === 'clientno') && a.toldDay == null);

  // Client decline counts for one account, last 90 days.
  T.declinesFor = (acc, days = 90) => D().declines.filter(d => (!acc || d.acc === acc) && d.day >= -days);
  T.reasonCounts = list => {
    const m = {}; for (const d of list) m[d.why] = (m[d.why] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  // ---------- Undo ----------
  let toastTimer;
  T.commit = (message, fn, opts = {}) => {
    const snap = JSON.stringify(T.DB);
    fn();
    T.save();
    T.render();
    T.toast(message, () => { T.DB = JSON.parse(snap); T.save(); T.render(); T.toast('Undone.'); }, opts.aimy);
  };
  T.toast = (message, undo, aimy) => {
    const el = document.getElementById('toast');
    el.innerHTML = `<div class="toast-in">
        <div class="toast-text"><span>${T.esc(message)}</span>${aimy ? `<span class="toast-aimy">${T.mark(14)} ${T.esc(aimy)}</span>` : ''}</div>
        ${undo ? '<button class="btn ghost sm" data-act="undo">Undo</button>' : ''}
        <button class="icon-btn" data-act="toast-close" aria-label="Close">${T.icon('x', 14)}</button></div>`;
    el.className = 'toast show';
    T._undo = undo;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = 'toast'), aimy ? 9000 : 6000);
  };

  // ---------- icons (stroke, 24 grid) ----------
  const P = {
    today: 'M3 10h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
    reqs: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4',
    find: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    asmt: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    reports: 'M3 3v18h18M7 15l4-4 3 3 5-6',
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
    check: 'M20 6L9 17l-5-5',
    x: 'M18 6L6 18M6 6l12 12',
    undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8',
    arrow: 'M5 12h14M13 5l7 7-7 7',
    back: 'M19 12H5M11 19l-7-7 7-7',
    chev: 'M9 18l6-6-6-6',
    down: 'M6 9l6 6 6-6',
    globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
    db: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
    msg: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    play: 'M5 3l14 9-14 9V3z',
    doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
    alert: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    plus: 'M12 5v14M5 12h14',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    spark: 'M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z',
    menu: 'M3 6h18M3 12h18M3 18h18',
    hist: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  };
  T.icon = (k, s = 18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[k] || ''}"/></svg>`;
  T.mark = (s = 18) => `<img class="mark" src="img/aimy-mark.svg" width="${s}" height="${s}" alt="">`;

  // ---------- shared components ----------
  T.chip = (text, tone = 'muted', extra = '') => `<span class="chip ${tone}" ${extra}>${T.esc(text)}</span>`;
  T.btn = (label, act, data = {}, cls = '') => `<button class="btn ${cls}" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${T.esc(v)}"`).join(' ')}>${label}</button>`;
  T.av = name => `<span class="av" aria-hidden="true">${T.esc(String(name).split(' ').map(w => w[0]).slice(0, 2).join(''))}</span>`;

  // AiMY speaks in its own line, and names what it read.
  T.aimy = (text, foot) => `<div class="aimy"><div class="aimy-mark">${T.mark(20)}</div><div><p>${text}</p>${foot ? `<p class="aimy-foot">${foot}</p>` : ''}</div></div>`;

  // Source note (M8): which records a block reads.
  T.src = text => `<span class="src">${T.icon('db', 12)} Reads ${T.esc(text)}</span>`;

  T.block = (title, body, opts = {}) => `<section class="block ${opts.cls || ''}" ${opts.id ? `id="${opts.id}"` : ''}>
      <header class="block-h"><div><h2>${title}</h2>${opts.sub ? `<p class="sub">${opts.sub}</p>` : ''}</div>${opts.right || ''}</header>
      ${body}${opts.src ? `<footer class="block-f">${T.src(opts.src)}</footer>` : ''}</section>`;

  T.empty = text => `<p class="empty">${text}</p>`;

  T.stageChip = a => a.exit ? T.chip(T.EXITS[a.exit], a.exit === 'clientno' ? 'bad' : 'muted') : T.chip(T.STAGES[a.stage].label, 'brand');

  // Evidence per criterion (P4): Meets / Partly / Not known with the CV quoted.
  T.criteriaRows = (a, opts = {}) => {
    const cand = T.cand(a.cand);
    return `<div class="crit">${T.evidence(a).filter(e => !opts.mustOnly || e.c.must).map(e => {
      const v = T.VERDICT[e.v], said = (cand.cvSays || {})[e.c.id];
      const asked = T.UI.asked[a.id + e.c.id];
      return `<div class="crit-row">
        <div class="crit-name">${T.esc(e.c.text)}${e.c.must ? '' : ' <span class="faint">nice to have</span>'}</div>
        <div class="crit-v">${T.chip(v.label, v.tone)}</div>
        <div class="crit-q">${e.v === 'unknown' ? '<span class="faint">The CV is silent here.</span>' : said ? `“${T.esc(said)}”` : ''}</div>
        <div class="crit-a">${e.v === 'unknown' && !opts.readonly ? (asked ? T.chip('In the next call', 'brand') : T.btn('Ask them', 'ask-them', { app: a.id, c: e.c.id }, 'ghost sm')) : ''}</div>
      </div>`; }).join('')}
      ${opts.foot === false ? '' : `<p class="crit-foot">Criteria ${T.esc(T.req(a.req).critVer)} · Not known is not Not met.</p>`}</div>`;
  };

  // Sendout timeline (P1): sent, opened, decided, each dated.
  T.sendoutLine = (a, opts = {}) => {
    const s = a.sendout; if (!s) return '';
    const req = T.req(a.req);
    const step = (on, cls, label, rest) => `<li class="${on ? cls : 'todo'}"><b>${label}</b>${rest ? ' · ' + rest : ''}</li>`;
    const decided = s.decided != null;
    const daysIn = s.sent - req.opened;
    return `<ol class="tl">
      ${step(true, 'ok', 'Sent ' + T.fmt(s.sent), opts.client ? 'by ' + T.person(s.by) : `${daysIn} days after the request opened (target 7) · write-up approved by ${T.person(s.by)}`)}
      ${step(s.opened != null, 'ok', s.opened != null ? 'Opened ' + T.fmt(s.opened) : 'Not opened yet', s.opened != null ? T.person(T.acc(req.acc).contact) || 'the client' : '')}
      ${decided ? step(true, s.result === 'pass' ? 'bad' : 'ok', (s.result === 'pass' ? 'Declined ' : 'Wants to meet · ') + T.fmt(s.decided), a.decline ? T.esc(T.REASONS[a.decline.why]) + (a.decline.note ? ' · “' + T.esc(a.decline.note) + '”' : '') : '')
                : step(false, '', 'Decision', 'waiting ' + T.age(s.opened ?? s.sent))}
    </ol>`;
  };

  // Reason picker (P1): one press on a reason is the decision, with Undo.
  T.reasonPicker = (appId, who) => `<div class="reasons" role="group" aria-label="Why the client passed">
      <p class="label">Why? Pick one${who === 'client' ? '' : ' (from the client)'}</p>
      <div class="reason-list">${Object.entries(T.REASONS).filter(([k]) => k !== 'other').map(([k, v]) => T.btn(T.esc(v), 'pass-why', { app: appId, why: k, who }, 'pill')).join('')}
        <span class="other"><input class="input sm" id="other-${appId}" placeholder="Other: one line" maxlength="80">${T.btn('Pass', 'pass-why', { app: appId, why: 'other', who }, 'pill')}</span></div>
      <button class="link" data-act="pass-cancel" data-app="${appId}">Cancel</button></div>`;

  // Decline reasons breakdown.
  T.reasonBars = (list) => {
    const rc = T.reasonCounts(list), max = Math.max(1, ...rc.map(r => r[1]));
    if (!rc.length) return T.empty('No client declines yet.');
    return `<div class="bars">${rc.map(([k, n]) => `<div class="bar-row"><span class="bar-l">${T.esc(T.REASONS[k])}</span>
      <span class="bar"><span style="width:${(n / max) * 100}%"></span></span><span class="bar-n">${n}</span></div>`).join('')}</div>`;
  };

  // Consent list (P9).
  T.consentList = (c, editable) => {
    const row = (k, label, d, hint) => `<li><span>${label}</span>${d != null ? T.chip('Yes · ' + T.fmt(d), 'ok') : T.chip('No', 'muted')}${hint ? `<span class="faint">${hint}</span>` : ''}</li>`;
    return `<ul class="consent">
      ${row('cv', 'Keep and read my CV', c.consent.cv, c.prospect ? 'Prospect: minimal data until they reply' : '')}
      ${row('wa', 'Updates on WhatsApp', c.consent.wa, c.consent.wa == null ? 'Messages go by email' : '')}
      ${row('rec', 'Interviews recorded', c.consent.rec, '')}</ul>`;
  };

  // Sample gate (P3, P7): a meter, not a number pretending to be enough.
  T.gate = (n, of, what) => `<div class="gate"><div class="gate-bar"><span style="width:${Math.min(100, n / of * 100)}%"></span></div>
      <span>${n} of ${of} ${what}</span></div>`;

  // Batch bar (M7): select many, act once.
  T.batchBar = (count, actions) => count ? `<div class="batch"><b>${count} selected</b>${actions}<button class="link" data-act="sel-clear">Clear</button></div>` : '';

  // ---------- router ----------
  T.route = () => {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, q] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    return { name: parts[0] || '', args: parts.slice(1), q: new URLSearchParams(q || '') };
  };
  T.go = h => { location.hash = h; };

  T.NAV = {
    omar:  [['today', 'Today', 'today'], ['reqs', 'Requisitions', 'reqs'], ['find', 'Find people', 'find'], ['asmts', 'Assessments', 'asmt'], ['reports', 'Reports', 'reports']],
    rania: [['asks', 'Asks', 'today'], ['reqs', 'Requisitions', 'reqs'], ['reports', 'Reports', 'reports']],
    dina:  [['hr', 'Today', 'today'], ['learning', 'Learning', 'spark'], ['autonomy', 'What AiMY may do', 'shield'], ['templates', 'Stage templates', 'layers'], ['reqs', 'Requisitions', 'reqs'], ['asmts', 'Assessments', 'asmt'], ['reports', 'Reports', 'reports']],
    jana:  [['client', 'Profiles', 'people'], ['client-hiring', 'Your hiring with us', 'reports']],
  };
  T.OUTSIDE = ['apply', 'me', 'debrief', 'approve'];

  T.render = () => {
    const r = T.route();
    const app = document.getElementById('app');
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
    if (T.OUTSIDE.includes(r.name)) { app.innerHTML = T.views.outside(r); T.after && T.after(); return; }
    const desk = T.UI.desk;
    const deskObj = T.DESKS.find(d => d.id === desk);
    if (!r.name) { location.replace('#/' + deskObj.home); return; }
    const view = T.views[r.name];
    let body;
    try { body = view ? view(r) : T.empty('Not found.'); }
    catch (e) { console.error(e); body = `<div class="block">${T.empty('This page failed to draw: ' + T.esc(e.message))}</div>`; }
    const me = T.STAFF[desk];
    const nav = T.NAV[desk];
    const active = r.name === 'req' || r.name === 'cand' ? (desk === 'jana' ? 'client' : 'reqs') : r.name === 'asmt' ? 'asmts' : r.name;
    app.innerHTML = `
      <div class="shell">
        <aside class="side">
          <a class="brand" href="#/${deskObj.home}">${T.mark(26)}<span>AiMY <b>Talent</b></span></a>
          <nav class="nav">${nav.map(([k, l, i]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}">${T.icon(i)}<span>${l}</span></a>`).join('')}</nav>
          <div class="side-foot">
            <p class="label">Outside links</p>
            <a href="#/apply/r1">${T.icon('globe', 15)} Careers page</a>
            <a href="#/me/laila">${T.icon('people', 15)} Candidate's own profile</a>
            <a href="#/debrief/i1">${T.icon('msg', 15)} Interviewer debrief</a>
            <a href="#/approve/o1/bu">${T.icon('check', 15)} BU Director approval</a>
          </div>
        </aside>
        <div class="main">
          <header class="top">
            <button class="icon-btn only-sm" data-act="nav-toggle" aria-label="Menu">${T.icon('menu')}</button>
            <button class="aimy-bar" data-act="bar-open">${T.mark(18)}<span>Ask AiMY or tell it what happened</span><kbd>/</kbd></button>
            <button class="icon-btn" data-act="theme" aria-label="Switch theme">${T.icon(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun')}</button>
            <div class="desk">
              <button class="desk-pill" data-act="desk-menu" aria-haspopup="true">${T.av(me.name)}<span><b>${T.esc(me.name)}</b><small>${T.esc(me.role)}</small></span>${T.icon('down', 14)}</button>
              <div class="desk-menu" id="desk-menu" hidden>
                <p class="label">Switch desk</p>
                ${T.DESKS.map(d => `<button data-act="desk" data-id="${d.id}" class="${d.id === desk ? 'on' : ''}">${T.av(T.STAFF[d.id].name)}<span><b>${T.esc(T.STAFF[d.id].name)}</b><small>${d.label}</small></span></button>`).join('')}
                <hr><button data-act="reset">${T.icon('undo', 15)} Reset demo data</button>
              </div>
            </div>
          </header>
          <main class="page" id="page">${body}</main>
        </div>
      </div>
      ${T.views.bar()}`;
    T.after && T.after();
  };
})();

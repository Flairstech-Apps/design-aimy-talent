/* AiMY Talent on Sales · 1 of 3: helpers, store, derivations, URL.
   Built the way bdr.js is (helpers, vocabulary, corpus, store, derivations,
   URL, painting, router, boot), painting into Sales's own markup so
   sales.css and bdr.css draw it unedited. Departures from Sales are noted
   where they happen. */
(function () {
  const T = window.T;
  const KEY = 'aimy-talent-sales';

  // ---------- helpers ----------
  T.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  T.byId = id => document.getElementById(id);
  T.date = d => { const x = new Date(T.TODAY); x.setDate(x.getDate() + d); return x; };
  T.fmt = d => T.date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  T.wday = d => T.date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  T.rel = d => d === 0 ? 'today' : d === -1 ? 'yesterday' : d === 1 ? 'tomorrow' : d < 0 ? (-d) + ' days ago' : 'in ' + d + ' days';
  T.age = d => { const n = -d; return n <= 0 ? 'today' : n === 1 ? '1 day' : n + ' days'; };
  T.plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  T.ord = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  T.person = k => (T.STAFF[k] || {}).name || k;
  T.first = name => String(name || '').split(' ')[0];
  T.initials = name => String(name).split(' ').map(w => w[0]).slice(0, 2).join('');
  T.attr = o => Object.entries(o || {}).map(([k, v]) => ` data-${k}="${T.esc(v)}"`).join('');

  // Sales's small marks: the AiMY logo and the fact icons.
  T.logo = (w = 14, h = 15) => `<svg width="${w}" height="${h}" viewBox="0 0 18 20" aria-hidden="true"><use href="#aimy-logo-small"/></svg>`;
  const ICON = {
    req: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
    acc: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1',
    pin: 'M12 22s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    src: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5',
    web: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
    ev: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    back: 'M19 12H5M11 19l-7-7 7-7',
    go: 'M5 12h14M13 5l7 7-7 7',
  };
  T.ic = (k, s = 14) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;
  T.fact = (k, html) => `<span class="b-fact">${T.ic(k)}<span>${html}</span></span>`;
  T.face = (name, px = 24) => `<span class="b-face" style="width:${px}px;height:${px}px"><span class="topnav-avatar" style="width:${px}px;height:${px}px;font-size:${Math.round(px * 0.4)}px">${T.esc(T.initials(name))}</span></span>`;
  T.back = (label = 'Back to the briefing') => `<button class="s-back" type="button" data-back>${T.ic('back')}${T.esc(label)}</button>`;
  T.tag = (text, tone = 'neutral') => `<span class="tag tag-${tone}">${T.esc(text)}</span>`;
  T.st = (text, tone = 'neutral') => `<span class="s-meta-st tone-${tone}">${T.esc(text)}</span>`;

  // ---------- store ----------
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 3) return s; } catch (e) {}
    const db = T.seed();
    T.seedSales(db);
    return db;
  }
  // What the Sales build adds to the shared seed: shortlists, the bell.
  T.seedSales = db => {
    db.lists = [
      { id: 'l1', name: 'German support, pool rediscovery', req: 'r1', people: ['ingy', 'rewan'], day: -6, by: 'omar' },
      { id: 'l2', name: 'Senior accountants, Big Four alumni', req: null, people: ['mona'], day: -14, by: 'omar' },
    ];
    db.news = [
      { id: 'n1', to: 'omar',  sev: 'p1', type: 'Debrief owed', when: 'since yesterday', body: 'Mostafa Hamdy has not written up Ahmed Fawzy\'s technical interview.', cta: 'Open the debrief link', go: { debrief: 'i1' } },
      { id: 'n2', to: 'rania', sev: 'p2', type: 'Client ask', when: '3 days ago', body: 'Jana Weber asked for two more German seats from January.', cta: 'Talk it through', go: { on: 'asks' } },
      { id: 'n3', to: 'dina',  sev: 'p2', type: 'Learning proposal', when: 'yesterday', body: 'AiMY drafted a rule for Northwind from 18 client declines.', cta: 'Read it', go: { on: 'learning' } },
      { id: 'n4', to: 'hesham', sev: 'p1', type: 'Approval', when: '2 days ago', body: 'Mona Saber\'s offer needs your budget and headcount answer.', cta: 'Answer it', go: { approve: 'o1', by: 'bu' } },
    ];
    db.read = {};
  };
  T.DB = load();
  T.save = () => { try { localStorage.setItem(KEY, JSON.stringify(T.DB)); } catch (e) {} };
  T.reset = () => { T.DB = T.seed(); T.seedSales(T.DB); T.save(); };
  T.id = p => p + (++T.DB.seq);
  T.UI = { open: {}, sel: {}, asked: {}, chat: [], draft: null, call: null, lang: 'en' };

  // ---------- derivations ----------
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
  T.isOpen = r => r.state === 'open';
  T.atRisk = r => T.isOpen(r) && (r.target < 0 || (r.target <= 7 && T.appsOf(r.id).filter(a => T.active(a) && ['sent', 'client', 'ctech', 'offer', 'accepted'].includes(a.stage)).length < r.seats));
  T.offerOf = appId => Object.values(D().offers).find(o => o.app === appId);
  T.untold = () => Object.values(D().apps).filter(a => (a.exit === 'out' || a.exit === 'clientno') && a.toldDay == null);
  T.overdue = a => -a.since > (T.STAGES[a.stage].exp || 99);
  T.declinesFor = (acc, days = 90) => D().declines.filter(d => (!acc || d.acc === acc) && d.day >= -days);
  T.reasonCounts = list => { const m = {}; for (const d of list) m[d.why] = (m[d.why] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]); };

  T.evidence = a => T.req(a.req).criteria.map((c, i) => ({ c, v: ({ m: 'meets', p: 'partly', n: 'not', u: 'unknown' })[a.ev[i]] || 'unknown' }));
  T.evCount = a => {
    const ev = T.evidence(a).filter(e => e.c.must);
    const met = ev.filter(e => e.v === 'meets').length, unk = ev.filter(e => e.v === 'unknown').length;
    return { met, of: ev.length, unk, text: met + ' of ' + ev.length + ' must-haves met' + (unk ? ' · ' + unk + ' not known' : '') };
  };
  // Who the next move waits on.
  T.waitOn = a => {
    if (!T.active(a)) return null;
    if (a.prospect && !a.contacted) return 'approval';
    if (a.prospect) return 'candidate';
    const iv = Object.values(D().interviews).find(i => i.app === a.id && i.kind === a.stage);
    if (iv) return iv.day >= 0 ? 'booked' : iv.debrief ? 'me' : 'interviewer';
    if (a.stage === 'offer') { const o = T.offerOf(a.id); if (o && o.sent == null) return o.approvals.hm && o.approvals.hm.ok && o.approvals.bu && o.approvals.bu.ok ? 'me' : 'approvers'; }
    return T.STAGES[a.stage].who;
  };
  // The tone a stage tag takes: amber when it waits on you too long.
  T.stageTone = a => a.exit ? (a.exit === 'clientno' ? 'err' : 'neutral') : T.waitOn(a) === 'me' && T.overdue(a) ? 'warn' : T.waitOn(a) === 'me' ? 'info' : 'neutral';

  // ---------- URL: every view is an address, as in Sales ----------
  const KEYS = ['as', 'on', 'con', 'req', 'q', 'p', 'list', 'debrief', 'approve', 'by', 'apply', 'me'];
  T.url = () => { const u = new URLSearchParams(location.search); const o = {}; for (const k of KEYS) o[k] = u.get(k) || ''; return o; };
  T.href = (o, keepAs = true) => { const u = new URLSearchParams(); const cur = T.url(); if (keepAs && cur.as) u.set('as', cur.as); for (const [k, v] of Object.entries(o)) if (v !== '' && v != null) u.set(k, v); const s = u.toString(); return location.pathname + (s ? '?' + s : ''); };
  T.desk = () => { const a = T.url().as; return T.DESKS.some(d => d.id === a) ? a : 'omar'; };
  T.me = () => T.STAFF[T.desk()];
})();

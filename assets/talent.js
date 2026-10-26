/* ═══════════════════════════════════════════════════════════════════════════
   AiMY TALENT — THE RECRUITER BUILD

   Built on AiMY Sales (decided 26 Oct 2026). Same shell, same components,
   same nine sections as Sales's bdr.js; a different process on top. The
   recruiter opens this to see two things: what is waiting on them, and the
   requisitions they are filling.

   ── HOW THIS FILE IS ORGANISED (the order bdr.js uses) ─────────────────────
    1  Helpers            esc, rng, dates, words, icons
    2  Vocabulary         stages, templates, exits, who acts at each stage
    3  The corpus         people, accounts, requisitions, candidates — seed()
    4  The store          seed + delta, localStorage, reset
    5  Derivations        decisions, waits, risk, funnel, days to send
    6  The URL            parse / go
    7  Painting           rail, Today, Requisitions, one requisition
    8  The router         one delegated listener over data-* verbs
    9  Boot

   ── WHAT IS PORTED FROM SALES, AND WHAT IS NOT YET ──────────────────────────
   Ported word for word or nearly: esc, rng (mulberry32), the date helpers,
   the store-holds-the-delta rule, toast with Undo, aimyBlock, the switcher
   and its bar, the card anatomy (type-card / b-qcard), the record head.
   Not yet: the AiMY canvas and peek, voice, the call rail, the bell's
   follow-up lines, desks other than the recruiter's. Each comes with the
   surface that needs it.

   ── TWO RULES CARRIED OVER FROM SALES ──────────────────────────────────────
   THE STAGE IS STORED. `cand.stage` is a field, moved only by `move` (one
   press, with Undo). Every count reads the field. A stage never moves
   backwards except by Undo, and an exit is not a stage.

   THE STORE HOLDS THE DELTA, NOT THE CORPUS. The corpus is regenerated from
   one seed on every load, dated relative to today, and only what you changed
   is saved. Reset is one line.

   ── THE SHAPE OF THE CORPUS IS THE REAL DASHBOARD'S ────────────────────────
   The Recruitment dashboard (Power BI, Aug–Sep 2026) is the reference: about
   39 requisitions and 45 seats over 6 recruiters, one account holding more
   than half the requests, 82% replacements, two thirds billable, support /
   accounting / operations roles, and stage pass rates of roughly 71% (phone
   to HR), 54% (HR to technical), 79% (technical to profile sent), 30%
   (profile sent to client interview) and 88% (client interview to hired).
   Every person, account and figure here is invented.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ══ 1. HELPERS ═════════════════════════════════════════════════════════ */

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  const byId = (id) => document.getElementById(id);

  const BUILD = (function () {
    const t = document.currentScript || document.querySelector('script[src*="talent.js"]');
    const m = t && /[?&]v=([^&]+)/.exec(t.getAttribute('src') || '');
    return m ? 'v' + m[1] : 'unstamped';
  })();
  try { console.info('AiMY Talent ' + BUILD); } catch (e) {}

  /* Deterministic PRNG (mulberry32), as in Sales. Math.random would give a
     different corpus every reload, and then no count could be checked twice. */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const chance = (r, p) => r() < p;

  /* ── Dates ── relative to the real clock, floored to the day, as in Sales:
     a link opened next month still shows interviews today. */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  const DAY_MS = 86400000;
  const dayOf = (n) => new Date(TODAY.getTime() + n * DAY_MS);
  const sayDay = (n) => { const d = dayOf(n); return d.getDate() + ' ' + MONTHS[d.getMonth()]; };
  /* Relative where relative is what a recruiter means, absolute otherwise. */
  const sayWhen = (n) => n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday'
    : n < 0 && n > -7 ? (-n) + ' days ago' : sayDay(n);
  const days = (n) => n === 1 ? '1 day' : n + ' days';

  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const first = (name) => String(name).split(' ')[0];

  /* Lucide icons, verbatim path data on the 24 grid. */
  const IC = {
    req: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
    acc: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    cal: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    goal: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    lang: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
    job: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    go: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    find: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  };
  const svg = (k, px) => '<svg viewBox="0 0 24 24"' + (px ? ' width="' + px + '" height="' + px + '"' : '') +
    ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    IC[k] + '</svg>';
  const fact = (k, text) => '<span class="b-fact">' + svg(k) + '<span>' + esc(text) + '</span></span>';
  const mark = (px) => '<svg width="' + px + '" height="' + Math.round(px * 20 / 18) + '" viewBox="0 0 18 20" aria-hidden="true"><use href="#aimy-logo-small"/></svg>';


  /* ══ 2. VOCABULARY ══════════════════════════════════════════════════════
     A stage is a position on a track, not a verdict (Sales's ladder rule).
     ORDER IS MEANING, and the order comes from the requisition's TEMPLATE,
     not from one global list: some clients run a technical round of their
     own, and FlairsTech's own roles end in a managerial interview rather
     than a client one. Sales's ladder comment warns what inserting into one
     global array does to every stored position below it.

     `who` is who the next move waits on. `exp` is the days a stage usually
     takes before it counts as waiting too long (a team setting later; these
     are samples). `go` is the recruiter's verb for moving past it. */
  const STAGE = {
    sourced:  { label: 'Sourced',             who: 'me',        exp: 3, go: 'They want to talk', say: 'found, not yet in touch' },
    applied:  { label: 'Applied',             who: 'me',        exp: 2, go: 'Book the call',     say: 'applied or agreed to talk' },
    phone:    { label: 'Phone screen',        who: 'me',        exp: 2, go: 'Passed the call',   say: 'a screening call is due' },
    hr:       { label: 'HR interview',        who: 'me',        exp: 3, go: 'Passed HR',         say: 'with HR' },
    tech:     { label: 'Technical interview', who: 'interviewer', exp: 4, go: 'Send the profile', say: 'with the technical interviewer' },
    mgr:      { label: 'Managerial interview', who: 'hm',       exp: 3, go: 'Passed',            say: 'with the hiring manager' },
    sent:     { label: 'Profile sent',        who: 'client',    exp: 3, go: 'Client wants to meet', say: 'with the client to choose' },
    client:   { label: 'Client interview',    who: 'client',    exp: 5, go: 'Client said yes',   say: 'met the client' },
    offer:    { label: 'Offer',               who: 'candidate', exp: 4, go: 'Accepted',          say: 'an offer is out' },
    accepted: { label: 'Accepted',            who: 'candidate', exp: 40, go: 'Joined',           say: 'accepted, not started' },
    joined:   { label: 'Joined',              who: null,        exp: 0, say: 'started' },
  };
  /* The internal template's tech step does not send a profile anywhere. */
  const GO_INTERNAL = { tech: 'Passed technical' };

  const TEMPLATE = {
    client:   ['sourced', 'applied', 'phone', 'hr', 'tech', 'sent', 'client', 'offer', 'accepted', 'joined'],
    internal: ['sourced', 'applied', 'phone', 'hr', 'tech', 'mgr', 'offer', 'accepted', 'joined'],
  };

  /* The ways out. Not stages: a candidate does not climb to "declined". */
  const EXIT = {
    out:       { label: 'Not progressing', say: 'we did not take them further' },
    withdrew:  { label: 'Withdrew',        say: 'they stepped out' },
    clientno:  { label: 'Client declined', say: 'the client said no' },
    offerno:   { label: 'Offer declined',  say: 'they turned the offer down' },
  };

  /* Stages where an interview happens, so a result can be in or still owed. */
  const MEETS = { hr: 1, tech: 1, mgr: 1, client: 1 };

  const REQ_STATE = {
    open:     { label: 'Open',              tone: 'neutral' },
    risk:     { label: 'At risk',           tone: 'warn' },
    hold:     { label: 'On hold',           tone: 'neutral' },
    filled:   { label: 'Filled',            tone: 'ok' },
    started:  { label: 'Hired, not started', tone: 'ok' },
    cclient:  { label: 'Cancelled by the client', tone: 'neutral' },
    cmgr:     { label: 'Cancelled by the manager', tone: 'neutral' },
  };
  const CLOSED = { filled: 1, started: 1, cclient: 1, cmgr: 1 };


  /* ══ 3. THE CORPUS ══════════════════════════════════════════════════════ */

  const ME = 'omar';
  const RECRUITERS = [
    { id: 'omar',    name: 'Omar Saeed',    ini: 'OS', reqs: 10 },
    { id: 'nadine',  name: 'Nadine Fawzy',  ini: 'NF', reqs: 8 },
    { id: 'karim',   name: 'Karim Adel',    ini: 'KA', reqs: 7 },
    { id: 'salma',   name: 'Salma Rashad',  ini: 'SR', reqs: 6 },
    { id: 'hana',    name: 'Hana Mostafa',  ini: 'HM', reqs: 6 },
    { id: 'youssef', name: 'Youssef Gamal', ini: 'YG', reqs: 2 },
  ];
  const HMS = [
    { id: 'rania',   name: 'Rania Samir' },
    { id: 'tarek',   name: 'Tarek Hamdy' },
    { id: 'laila',   name: 'Laila Mansour' },
    { id: 'sherine', name: 'Sherine Wahba' },
    { id: 'amr',     name: 'Amr Fekry' },
  ];
  /* One account holds more than half the requests, as one does in the real
     data. `tpl` picks the stage template; `ctech` would add the client's own
     technical round and is not used yet. */
  const ACCOUNTS = [
    { id: 'northwind', name: 'Northwind Software', tpl: 'client',   weight: 21, hm: 'rania' },
    { id: 'flairs',    name: 'FlairsTech',         tpl: 'internal', weight: 5,  hm: 'tarek' },
    { id: 'halcyon',   name: 'Halcyon Mobile',     tpl: 'client',   weight: 3,  hm: 'laila' },
    { id: 'quarry',    name: 'Quarry Payroll',     tpl: 'client',   weight: 3,  hm: 'laila' },
    { id: 'kestrel',   name: 'Kestrel Labs',       tpl: 'client',   weight: 3,  hm: 'sherine' },
    { id: 'seaborne',  name: 'Seaborne Cruises',   tpl: 'client',   weight: 2,  hm: 'amr' },
    { id: 'fernhill',  name: 'Fernhill Data',      tpl: 'client',   weight: 2,  hm: 'amr' },
  ];

  /* Role families, with the success profile each is read against. The
     language line is a must-have, because in this book it usually is. */
  const ROLES = [
    { title: 'Technical Support Engineer',          fam: 'support', level: 'Mid-level',
      must: ['2+ years of L2 software support', 'Ticketing tools (Zendesk or Freshdesk)', 'SQL to read logs and data', 'Fluent English, spoken and written'] },
    { title: 'Bilingual Technical Support (German)', fam: 'support', level: 'Mid-level',
      must: ['German at C1 or above', 'Fluent English', '1+ year of software support', 'Calm with escalations on the phone'] },
    { title: 'L3 Support Engineer',                 fam: 'support', level: 'Senior',
      must: ['4+ years in software support, 2 at L3', 'Reads stack traces and logs', 'SQL and one scripting language', 'Fluent English'] },
    { title: 'Customer Support Team Lead',          fam: 'support', level: 'Manager',
      must: ['2+ years leading a support team', 'Calm with escalations in Arabic and English', 'Runs schedules and quality checks', 'Reports on SLAs'] },
    { title: 'Customer Support Agent',              fam: 'support', level: 'Junior',
      must: ['Fluent English', 'Typing and written replies', 'Shift work, including weekends'] },
    { title: 'Accounts Receivable Specialist',      fam: 'finance', level: 'Mid-level',
      must: ['2+ years in accounts receivable', 'Collections with overseas clients', 'NetSuite or a similar ERP', 'Fluent English'] },
    { title: 'General Accountant',                  fam: 'finance', level: 'Mid-level',
      must: ['3+ years of general ledger work', 'Month-end close', 'Bank reconciliations', 'Advanced Excel'] },
    { title: 'AP Specialist',                       fam: 'finance', level: 'Junior',
      must: ['1+ year in accounts payable', 'Invoice matching', 'Fluent English'] },
    { title: 'Operations Specialist',               fam: 'ops',     level: 'Mid-level',
      must: ['2+ years in operations or back office', 'Process documentation', 'Advanced Excel', 'Fluent English'] },
    { title: 'AI Business Analyst',                 fam: 'ops',     level: 'Senior',
      must: ['3+ years as a business analyst', 'Writes requirements engineers build from', 'Has worked with AI or data teams', 'Fluent English'] },
  ];

  const MEN = ['Ahmed', 'Mohamed', 'Mahmoud', 'Mostafa', 'Hossam', 'Karim', 'Tamer', 'Sherif', 'Hany', 'Ayman', 'Islam', 'Ziad', 'Omar', 'Yassin', 'Adham', 'Marwan', 'Seif', 'Bassem', 'Wael', 'Ramy'];
  const WOMEN = ['Yara', 'Mai', 'Nour', 'Salma', 'Reem', 'Nada', 'Dina', 'Heba', 'Aya', 'Farida', 'Malak', 'Habiba', 'Mariam', 'Rana', 'Sara', 'Nadine', 'Laila', 'Esraa', 'Shaimaa', 'Menna'];
  const LAST = ['Fouad', 'Lotfy', 'Adel', 'Hamdy', 'Wahba', 'Kamal', 'Amin', 'Fathy', 'Ezz', 'Gamal', 'Salah', 'Ibrahim', 'Sabry', 'Nabil', 'Ragab', 'Hassan', 'Mansour', 'Farouk', 'Shawky', 'Tawfik', 'Zaki', 'Hegazy', 'Abdelaziz', 'Morsy'];
  const PLACES = ['Nasr City', 'Maadi', 'New Cairo', 'Heliopolis', 'Giza', 'Sheikh Zayed', '6th of October', 'Alexandria', 'Mansoura', 'Dokki'];
  const SOURCES = ['Applied through the link', 'From the talent pool', 'Referred by a colleague', 'Found on the web', 'Added by the recruiter'];
  const NOW_AT = {
    support: ['Support Engineer at a SaaS company', 'Customer Care Agent at a telecom', 'Helpdesk Analyst at a bank', 'Technical Support at a call centre'],
    finance: ['Accountant at an audit firm', 'AR Officer at a distributor', 'Accounting Assistant at a hospital group', 'Finance Associate at a logistics company'],
    ops:     ['Operations Coordinator at a fintech', 'Back-office Analyst at a bank', 'Business Analyst at a software house', 'Process Associate at an outsourcing firm'],
  };

  /* How many of the candidates reaching a stage reach the next one. The
     phone→HR through client→offer rates are the dashboard's. */
  const PASS = { sourced: 0.62, applied: 0.8, phone: 0.71, hr: 0.54, tech: 0.79, mgr: 0.75, sent: 0.30, client: 0.88, offer: 0.86, accepted: 0.92 };

  const DB = { reqs: [], cands: [], byReq: {}, byId: {}, reqById: {} };

  function seed() {
    const r = rng(20261026);
    DB.reqs = []; DB.cands = []; DB.byReq = {}; DB.byId = {}; DB.reqById = {};
    const accBag = [];
    ACCOUNTS.forEach((a) => { for (let i = 0; i < a.weight; i++) accBag.push(a.id); });
    let rn = 0, cn = 0;
    const usedNames = {};
    const person = () => {
      for (;;) {
        const woman = chance(r, 0.5);
        const n = pick(r, woman ? WOMEN : MEN) + ' ' + pick(r, LAST);
        if (!usedNames[n]) { usedNames[n] = 1; return n; }
      }
    };

    /* The recruiter's own desk is drawn to a script, so the briefing always
       has its cases: one requisition at risk, one with profiles waiting on the
       client, one with results in and decisions owed, one just opened, one on
       hold, and a closed tail. Everyone else's is random in the same shape. */
    const MINE = [
      { acc: 'northwind', role: 2, state: 'open', open: 26, span: 32, plan: 'risk' },
      { acc: 'northwind', role: 1, state: 'open', open: 21, span: 40, plan: 'client', seats: 2 },
      { acc: 'halcyon',   role: 0, state: 'open', open: 17, span: 35, plan: 'decide' },
      { acc: 'flairs',    role: 9, state: 'open', open: 12, span: 45, plan: 'decide2' },
      { acc: 'northwind', role: 5, state: 'open', open: 4,  span: 30, plan: 'fresh' },
      { acc: 'kestrel',   role: 3, state: 'hold', open: 30, span: 30, plan: 'hold' },
      { acc: 'northwind', role: 4, state: 'filled', open: 70, span: 30, seats: 2 },
      { acc: 'quarry',    role: 6, state: 'started', open: 55, span: 35 },
      { acc: 'northwind', role: 0, state: 'filled', open: 64, span: 30 },
      { acc: 'seaborne',  role: 8, state: 'cclient', open: 48, span: 30 },
    ];
    const OTHER_STATES = ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'hold', 'hold', 'hold', 'hold',
      'filled', 'filled', 'filled', 'filled', 'filled', 'filled', 'filled', 'started',
      'cclient', 'cclient', 'cclient', 'cclient', 'cclient', 'cmgr', 'cmgr', 'cmgr', 'filled'];

    const makeReq = (spec, recId) => {
      const acc = ACCOUNTS.filter((a) => a.id === spec.acc)[0];
      const role = ROLES[spec.role];
      const id = 'r' + (++rn);
      const q = {
        id: id, title: role.title, fam: role.fam, level: role.level, must: role.must,
        acc: acc.id, tpl: acc.tpl, hm: acc.hm, rec: recId,
        seats: spec.seats || 1,
        kind: chance(r, 0.82) ? 'replacement' : 'new',
        billable: acc.tpl === 'client' && chance(r, 0.8),
        state: spec.state, opened: -spec.open, target: -spec.open + spec.span,
        place: chance(r, 0.7) ? 'Nasr City office' : 'Hybrid, Maadi office',
        plan: spec.plan || null,
      };
      DB.reqs.push(q); DB.reqById[id] = q; DB.byReq[id] = [];
      return q;
    };

    MINE.forEach((s) => makeReq(s, ME));
    RECRUITERS.slice(1).forEach((rc) => {
      for (let i = 0; i < rc.reqs; i++) {
        makeReq({ acc: pick(r, accBag), role: between(r, 0, ROLES.length - 1),
          state: pick(r, OTHER_STATES), open: between(r, 5, 85), span: between(r, 28, 45),
          seats: chance(r, 0.15) ? 2 : 1 }, rc.id);
      }
    });

    /* ── Candidates ── each walks the req's template stage by stage with the
       pass rates above. Where the walk stops: on an open requisition they
       are often still there, in progress; otherwise they left by the exit
       that stage has. */
    const exitAt = (k) => k === 'sent' || k === 'client' ? 'clientno' : k === 'offer' ? 'offerno'
      : (k === 'sourced' || k === 'applied') && chance(r, 0.4) ? 'withdrew' : 'out';
    const makeCand = (q, stage, opts) => {
      const name = person();
      const id = 'k' + (++cn);
      const role = ROLES.filter((x) => x.title === q.title)[0];
      /* Evidence per must-have: met, partly met, or not evidenced. Further
         along usually means more met, because screening let them through. */
      const tpl = TEMPLATE[q.tpl];
      const depth = tpl.indexOf(stage) / tpl.length;
      const ev = q.must.map(() => {
        const x = r() * 0.6 + depth * 0.9;
        return x > 0.75 ? 'm' : x > 0.45 ? 'p' : 'n';
      });
      const c = Object.assign({
        id: id, name: name, req: q.id, stage: stage, exit: null,
        since: between(r, 0, 3), meet: null, fb: false, nudged: null,
        years: between(r, 1, 9), at: pick(r, NOW_AT[role.fam]), place: pick(r, PLACES),
        langs: q.title.indexOf('German') >= 0 ? ['Arabic', 'English', 'German'] : ['Arabic', 'English'],
        source: pick(r, SOURCES), ev: ev, maxAt: stage,
      }, opts || {});
      DB.cands.push(c); DB.byId[id] = c; DB.byReq[q.id].push(c);
      return c;
    };

    DB.reqs.forEach((q) => {
      const tpl = TEMPLATE[q.tpl];
      const open = !CLOSED[q.state];
      const n = q.plan === 'fresh' ? 7 : open ? between(r, 9, 16) : between(r, 8, 14);
      let hired = 0;
      for (let i = 0; i < n; i++) {
        let k = 0;
        while (k < tpl.length - 1 && chance(r, PASS[tpl[k]])) k++;
        let stage = tpl[k];
        const closedStages = q.state === 'filled' || q.state === 'started';
        /* A filled requisition ends with exactly its seats taken. */
        if (stage === 'joined' || stage === 'accepted') {
          if (closedStages && hired < q.seats) { hired++; makeCand(q, q.state === 'started' ? 'accepted' : 'joined', { since: between(r, 5, 30) }); continue; }
          stage = 'offer';
        }
        if (open && chance(r, q.plan === 'fresh' ? 0.95 : 0.5) && tpl.indexOf(stage) < tpl.indexOf('offer')) {
          if (q.plan === 'fresh' && tpl.indexOf(stage) > tpl.indexOf('phone')) stage = 'phone';
          makeCand(q, stage);
        } else {
          makeCand(q, stage, { exit: exitAt(stage), since: between(r, 3, 40) });
        }
      }
      if ((q.state === 'filled' || q.state === 'started') && hired < q.seats) {
        for (; hired < q.seats; hired++) makeCand(q, q.state === 'started' ? 'accepted' : 'joined', { since: between(r, 5, 30) });
      }
    });

    /* ── The interview calendar ── a candidate at an interview stage either
       has it ahead (meet > 0), today (0), or behind them (meet < 0), and when
       it is behind them the result is either in (`fb`) or still owed. */
    const SLOTS = ['10:00', '11:00', '12:30', '14:00', '15:30'];
    DB.cands.forEach((c) => {
      if (c.exit || !MEETS[c.stage]) return;
      c.meet = between(r, -4, 3);
      c.slot = pick(r, SLOTS);
      c.fb = c.meet < 0 && chance(r, 0.45);
      if (c.meet >= 0) c.since = Math.max(c.since, 1);
      else c.since = Math.max(c.since, -c.meet);
    });

    /* ── The script for the recruiter's own desk ── */
    const mineBy = (plan) => DB.reqs.filter((q) => q.rec === ME && q.plan === plan)[0];
    const active = (q) => DB.byReq[q.id].filter((c) => !c.exit);
    const setAt = (c, stage, o) => Object.assign(c, { stage: stage, exit: null, maxAt: stage }, o || {});

    /* At risk: 6 days to the target, and nobody past the technical round. */
    const risk = mineBy('risk');
    active(risk).forEach((c) => {
      if (TEMPLATE.client.indexOf(c.stage) > TEMPLATE.client.indexOf('tech')) setAt(c, 'hr', { meet: -1, fb: false, slot: '11:00', since: 1 });
    });
    const rt = active(risk).filter((c) => c.stage === 'tech')[0] || active(risk)[0];
    setAt(rt, 'tech', { meet: -3, fb: false, slot: '12:30', since: 3 });

    /* Profiles with the client: three sent, the oldest six days ago. */
    const cl = mineBy('client');
    const cla = active(cl);
    setAt(cla[0], 'sent', { since: 6, meet: null, fb: false });
    setAt(cla[1], 'sent', { since: 6, meet: null, fb: false });
    setAt(cla[2], 'sent', { since: 2, meet: null, fb: false });
    setAt(cla[3], 'client', { meet: 0, slot: '14:00', fb: false, since: 2 });

    /* Results in, decisions owed. */
    const d1 = active(mineBy('decide'));
    setAt(d1[0], 'tech', { meet: -2, fb: true, since: 2, slot: '10:00' });
    setAt(d1[1], 'tech', { meet: -1, fb: true, since: 1, slot: '15:30' });
    setAt(d1[2], 'hr', { meet: 0, slot: '11:00', fb: false, since: 1 });
    const d2 = active(mineBy('decide2'));
    setAt(d2[0], 'mgr', { meet: -3, fb: true, since: 3, slot: '12:30' });
    setAt(d2[1], 'hr', { meet: -1, fb: true, since: 1, slot: '10:00' });

    /* Every candidate's furthest stage is where they are now (exits stop
       there too). The funnel reads `maxAt`. */
    DB.cands.forEach((c) => { c.maxAt = c.stage; });
  }


  /* ══ 4. THE STORE ═══════════════════════════════════════════════════════
     The delta, never the corpus. `D.c[id]` holds the fields a person changed
     on one candidate; `D.log` is the record of moves, newest last. */
  const KEY = 'aimy-talent:db:v1';
  let D = { c: {}, log: [] };
  function load() {
    try { const s = localStorage.getItem(KEY); if (s) D = JSON.parse(s); } catch (e) { D = { c: {}, log: [] }; }
    if (!D || !D.c) D = { c: {}, log: [] };
    Object.keys(D.c).forEach((id) => { if (DB.byId[id]) Object.assign(DB.byId[id], D.c[id]); });
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }
  function write(c, fields) {
    D.c[c.id] = Object.assign(D.c[c.id] || {}, fields);
    Object.assign(c, fields);
    save();
  }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) {} D = { c: {}, log: [] }; seed(); }


  /* ══ 5. DERIVATIONS ═════════════════════════════════════════════════════
     Every figure on every surface is worked out here, once, from the stage
     fields. A surface never re-derives a count (Sales's one-definition rule:
     the dashboard's two hire counts disagreeing is what that rule prevents). */

  const accOf = (q) => ACCOUNTS.filter((a) => a.id === q.acc)[0];
  const hmOf = (q) => HMS.filter((h) => h.id === q.hm)[0];
  const tplOf = (q) => TEMPLATE[q.tpl];
  const reqOf = (c) => DB.reqById[c.req];
  const rank = (q, k) => tplOf(q).indexOf(k);
  const isOpen = (q) => !CLOSED[q.state] && q.state !== 'hold';
  const mine = () => DB.reqs.filter((q) => q.rec === ME);
  const myOpen = () => mine().filter(isOpen);
  const activeOf = (q) => DB.byReq[q.id].filter((c) => !c.exit && c.stage !== 'joined');

  /* The next stage on this requisition's own template. */
  const nextOf = (c) => { const t = tplOf(reqOf(c)); return t[t.indexOf(c.stage) + 1] || null; };
  const goSay = (c) => (reqOf(c).tpl === 'internal' && GO_INTERNAL[c.stage]) || STAGE[c.stage].go;

  /* Who the next move waits on, read off the stage and the interview. An
     interview that has happened with its result in is the recruiter's call;
     one with the result still owed is the interviewer's (or the client's). */
  function waitsOn(c) {
    if (c.exit || c.stage === 'joined') return null;
    if (MEETS[c.stage]) {
      if (c.fb) return 'me';
      if (c.meet != null && c.meet >= 0) return 'booked';
      return c.stage === 'hr' ? 'me' : c.stage === 'client' ? 'client' : c.stage === 'mgr' ? 'hm' : 'interviewer';
    }
    return STAGE[c.stage].who;
  }

  /* A DECISION is a result that is in and a call that is the recruiter's:
     proceed or not. That is the hero count. Work the recruiter does without
     deciding anything (a call to book, a person to contact) is not one. */
  function decisions() {
    const out = [];
    myOpen().forEach((q) => activeOf(q).forEach((c) => {
      if (MEETS[c.stage] && c.fb) out.push(c);
    }));
    return out.sort((a, b) => b.since - a.since);
  }

  /* Waiting on somebody else, past the time that stage usually takes. */
  function waits() {
    const out = [];
    myOpen().forEach((q) => activeOf(q).forEach((c) => {
      const w = waitsOn(c);
      if (w === 'client' || w === 'interviewer' || w === 'hm' || w === 'candidate') {
        if (c.since >= STAGE[c.stage].exp || (MEETS[c.stage] && c.meet != null && c.meet < 0)) out.push(c);
      }
    }));
    return out.sort((a, b) => b.since - a.since);
  }
  /* The nudge names who it goes to, in words a person would say. */
  const nudgeSay = (c) => {
    const w = waitsOn(c), q = reqOf(c);
    return w === 'client' ? 'Nudge the client' : w === 'hm' ? 'Nudge ' + first(hmOf(q).name)
      : w === 'candidate' ? 'Nudge ' + first(c.name) : 'Nudge the interviewer';
  };
  const waitWho = (c) => {
    const w = waitsOn(c), q = reqOf(c);
    return w === 'client' ? accOf(q).name : w === 'hm' ? hmOf(q).name
      : w === 'candidate' ? first(c.name) : 'The interviewer';
  };

  /* Interviews on the calendar today, earliest first. */
  function today() {
    const out = [];
    myOpen().forEach((q) => activeOf(q).forEach((c) => { if (MEETS[c.stage] && c.meet === 0) out.push(c); }));
    return out.sort((a, b) => a.slot.localeCompare(b.slot));
  }

  /* Work that is not a decision: calls to book, people to contact. */
  const toScreen = () => {
    const out = [];
    myOpen().forEach((q) => activeOf(q).forEach((c) => { if (c.stage === 'applied' || c.stage === 'phone') out.push(c); }));
    return out;
  };

  /* ── Requisition health, rule-based and said as its reason ──
     The usual days from the furthest active candidate's stage to an accepted
     offer, against the days left to the target. A requisition is at risk
     when the first is more than the second. Nothing predictive. */
  function health(q) {
    if (!isOpen(q)) return null;
    const t = tplOf(q);
    const act = activeOf(q);
    const left = q.target;
    const furthest = act.reduce((best, c) => (t.indexOf(c.stage) > t.indexOf(best) ? c.stage : best), 'sourced');
    const end = t.indexOf('accepted');
    let need = 0;
    for (let i = t.indexOf(furthest); i < end; i++) need += STAGE[t[i]].exp;
    return { left: left, need: need, furthest: furthest, risk: need > left, count: act.length };
  }
  const stateOf = (q) => { const h = health(q); return h && h.risk ? 'risk' : q.state; };

  /* ── The funnel, per requisition ── how many ever reached each stage.
     Exits count as reaching the stage they left from. */
  function funnel(q) {
    const t = tplOf(q).filter((k) => k !== 'joined' || CLOSED[q.state]);
    const all = DB.byReq[q.id];
    return t.map((k) => ({ k: k, n: all.filter((c) => rank(q, c.maxAt) >= rank(q, k)).length }));
  }
  /* The stage with the biggest fall to the next, among stages reached by at
     least three people (a fall from two is not a finding). */
  function worstStep(f) {
    let at = -1, worst = 1;
    for (let i = 0; i < f.length - 1; i++) {
      if (f[i].n < 3) continue;
      const rate = f[i + 1].n / f[i].n;
      if (rate < worst) { worst = rate; at = i; }
    }
    return at < 0 ? null : { from: f[at].k, to: f[at + 1].k, rate: worst, n: f[at].n, m: f[at + 1].n };
  }

  /* Days to send the first profile, per requisition with one sent. Sample
     arithmetic off the opening date; the real figure needs the event. */
  function sentDays(q) {
    if (q.tpl !== 'client') return null;
    const sent = DB.byReq[q.id].filter((c) => rank(q, c.maxAt) >= rank(q, 'sent'));
    if (!sent.length) return null;
    return Math.max(3, Math.round(-q.opened * 0.45));
  }
  function avgSent(list) {
    const v = list.map(sentDays).filter((x) => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  }

  /* Evidence, said as counts — "3 of 4 must-haves met". The audit's
     recommendation for decision 2, pending the manager: a score that is its
     own explanation, never a percentage. */
  const evMet = (c) => c.ev.filter((e) => e === 'm').length;
  const evSay = (c) => '<b>' + evMet(c) + ' of ' + c.ev.length + '</b> must-haves met' +
    (c.ev.filter((e) => e === 'p').length ? ', ' + c.ev.filter((e) => e === 'p').length + ' partly' : '');


  /* ══ 6. THE URL ═════════════════════════════════════════════════════════
     Every view is a URL, so every view can be sent and Back works. */
  let S = {};
  const KEYS = ['on', 'req', 'q', 'find'];
  function parse() {
    const p = new URLSearchParams(location.search);
    S = {};
    KEYS.forEach((k) => { if (p.get(k)) S[k] = p.get(k); });
    if (S.req && !DB.reqById[S.req]) delete S.req;
  }
  function urlOf(s) {
    const p = new URLSearchParams();
    KEYS.forEach((k) => { if (s[k]) p.set(k, s[k]); });
    const qs = p.toString();
    return location.pathname + (qs ? '?' + qs : '');
  }
  /* `over` replaces the view. The last view you were on is kept for the
     Back link, which goes there rather than to a fixed place (Sales, b68c204). */
  let TRAIL = null;
  function go(over, replace) {
    const next = Object.assign({}, over);
    if (!replace) TRAIL = Object.assign({}, S);
    S = next;
    const u = urlOf(S);
    if (replace) history.replaceState(null, '', u); else history.pushState(null, '', u);
    /* A row in the bell is a way somewhere; once you are there it closes. */
    byId('ntfPanel').hidden = true;
    byId('ntfBell').setAttribute('aria-expanded', 'false');
    paint();
    byId('pageScroll').scrollTop = 0;
  }


  /* ══ 7. PAINTING ════════════════════════════════════════════════════════ */

  function aimyBlock(said, bare) {
    if (!said) return '';
    return '<div class="b-aimy">' +
      '<svg class="b-aimy-mark" width="13" height="15" viewBox="0 0 18 20" aria-hidden="true">' +
        '<use href="#aimy-logo-small"/></svg>' +
      '<span class="b-aimy-say">' + said.text +
        (bare ? '' : '<span class="b-aimy-from">' + esc(said.from) + '</span>') +
      '</span>' +
    '</div>';
  }
  const goAttr = (s) => " data-go='" + esc(JSON.stringify(s)) + "'";
  const tag = (label, tone) => '<span class="tag tag-' + (tone || 'neutral') + '">' + esc(label) + '</span>';
  const stageTag = (c) => c.exit ? tag(EXIT[c.exit].label) : tag(STAGE[c.stage].label,
    c.stage === 'joined' || c.stage === 'accepted' ? 'ok' : waitsOn(c) === 'me' && MEETS[c.stage] ? 'warn' : 'neutral');

  /* ── The header: who you are. One desk for now; the switcher arrives with
     the hiring manager's. ── */
  function paintWho() {
    const me = RECRUITERS[0];
    byId('userAvatar').textContent = me.ini;
    byId('userName').textContent = me.name;
    byId('userRole').textContent = 'Recruiter';
  }

  /* ── The rail: what is reachable, with one reading on top. ── */
  function paintRail() {
    const d = decisions();
    const open = myOpen();
    const people = open.reduce((n, q) => n + activeOf(q).length, 0);
    const t = today();
    const nxt = t[0];
    const avg = avgSent(mine());
    const team = avgSent(DB.reqs);
    byId('appRail').innerHTML =
      '<div class="rail-read"><div class="bcard rail-card">' +
        '<div class="bcard-meta"><span class="type-label rail-state p2">Waiting on you</span></div>' +
        '<p class="bcard-conclusion rail-conclusion">' + (d.length
          ? '<b>' + plural(d.length, 'decision') + '</b> ' + (d.length === 1 ? 'waits' : 'wait') + ' on you, out of the <b>' + people + '</b> people on your open requisitions.'
          : 'Nothing waits on your call. <b>' + people + '</b> people are on your open requisitions.') + '</p>' +
        '<div class="bcard-evidence rail-evidence">' +
          '<span class="evidence-pill"><span class="val">' + open.length + '</span>open requisitions</span>' +
          '<span class="evidence-pill"><span class="val">' + t.length + '</span>' + (t.length === 1 ? 'interview' : 'interviews') + ' today</span>' +
        '</div>' +
      '</div></div>' +
      '<div class="rail-doors">' +
        (nxt ? '<button class="b-door" type="button"' + goAttr({ req: nxt.req }) + '>' +
          '<span class="b-door-cap">Today</span>' +
          '<span class="b-door-fig"><span class="b-door-clock">' + svg('clock') + '</span>' + esc(nxt.slot) + '</span>' +
          '<span class="b-door-who">' + esc(nxt.name) + '<span class="b-kind">' + esc(STAGE[nxt.stage].label) + '</span></span>' +
          '<span class="b-door-say">for ' + esc(reqOf(nxt).title) + ', ' + esc(accOf(reqOf(nxt)).name) + '</span>' +
          '<span class="b-door-go">Open the requisition' + svg('go') + '</span>' +
        '</button>' : '') +
        (avg != null ? '<button class="b-door" type="button"' + goAttr({ on: 'reqs' }) + '>' +
          '<span class="b-door-cap">Profiles to clients</span>' +
          '<span class="b-door-fig">' + avg + '<span class="b-door-of">days</span></span>' +
          '<span class="b-door-say">from opening to the first profile sent, on average. The team’s is ' + team + '.</span>' +
          '<span class="b-door-go">Open your requisitions' + svg('go') + '</span>' +
        '</button>' : '') +
      '</div>';
  }

  /* ── The briefing at the top of every page, as Sales draws it. ── */
  function topBrief() {
    const d = decisions(), w = waits(), t = today();
    const risky = myOpen().filter((q) => health(q).risk);
    const client = w.filter((c) => waitsOn(c) === 'client');
    const oldest = d[0];
    const lines = [];
    lines.push(d.length
      ? '<b>' + plural(d.length, 'decision') + '</b> ' + (d.length === 1 ? 'waits' : 'wait') + ' on you, the oldest <b>' + days(oldest.since) + '</b>. ' +
        (t.length ? '<b>' + plural(t.length, 'interview') + '</b> today, the first at <b>' + esc(t[0].slot) + '</b> with ' + esc(t[0].name) + '.' : 'No interviews today.')
      : 'Nothing waits on your call. ' + (t.length ? '<b>' + plural(t.length, 'interview') + '</b> today.' : ''));
    if (risky.length) {
      const q = risky[0], h = health(q);
      lines.push('<button class="slv-n" type="button"' + goAttr({ req: q.id }) + '>' + esc(q.title) + '</button> for ' + esc(accOf(q).name) +
        ' is likely to miss its date: <b>' + days(h.left) + '</b> left, and the furthest candidate is at the ' + esc(STAGE[h.furthest].label.toLowerCase()) + '.');
    }
    if (client.length) {
      lines.push('Clients owe an answer on <button class="slv-n" type="button"' + goAttr({ on: 'reqs', q: 'client' }) + '>' + plural(client.length, 'candidate') + '</button>' +
        ', the oldest waiting <b>' + days(client[0].since) + '</b>.');
    }
    const scr = toScreen();
    const ready = d.filter((c) => c.stage === 'tech' && reqOf(c).tpl === 'client');
    const starts = [
      { k: 'decide', label: 'Decide the oldest one', n: d.length, why: oldest ? oldest.name + ', ' + STAGE[oldest.stage].label.toLowerCase() : 'nothing is waiting' },
      { k: 'send', label: 'Send profiles', n: ready.length, why: ready.length ? 'technical results are in for ' + plural(ready.length, 'candidate') : 'none ready yet' },
      { k: 'screen', label: 'Book screening calls', n: scr.length, why: 'people who applied or agreed to talk' },
      { k: 'risk', label: 'Requisitions at risk', n: risky.length, why: risky.length ? risky.map((q) => q.title).join(', ') : 'all on course' },
    ];
    return '<section class="slv s-block-wide">' +
      '<div class="slv-head">' + mark(18).replace('<svg ', '<svg ') + '<h1 class="slv-title">Today</h1>' +
        '<span class="slv-time">' + sayDay(0) + '</span></div>' +
      '<div class="slv-body">' + lines.map((l) => '<p class="slv-line">' + l + '</p>').join('') + '</div>' +
      '<div class="s-starts-wrap"><span class="s-starts-cap">Start</span><div class="s-starts">' +
        starts.map((s) => '<button class="s-start" type="button" data-start="' + s.k + '">' +
          '<span class="s-start-top"><span class="s-start-label">' + esc(s.label) + '</span>' +
            '<span class="s-start-n">' + (s.n || '​') + '</span></span>' +
          '<span class="s-start-why">' + esc(s.why) + '</span></button>').join('') +
      '</div></div>' +
    '</section>';
  }

  /* ── The switcher: the heading is the navigation, as in Sales. ── */
  function switcher(here) {
    const open = myOpen().length;
    const tabs = [
      { k: '', label: 'Today' },
      { k: 'reqs', label: 'Requisitions', n: open },
    ];
    return '<h2 class="b-switch">' + tabs.map((t) => '<button class="b-switch-btn' + (t.k === here ? ' is-on' : '') + '" type="button"' +
      goAttr(t.k ? { on: t.k } : {}) + (t.k === here ? ' aria-current="page"' : '') + '>' + esc(t.label) +
      (t.n != null ? '<span class="b-switch-n">' + t.n + '</span>' : '') + '</button>').join('') +
      '<span class="b-switch-bar" aria-hidden="true"></span></h2>';
  }

  /* ── One row of work: who, for what, why, and the one move. ── */
  function workRow(c, i, verb) {
    const q = reqOf(c);
    const nx = nextOf(c);
    return '<div class="b-owed-row t-row" style="--i:' + Math.min(i, 8) + '">' +
      '<span class="b-owed-sev" aria-hidden="true"></span>' +
      '<button class="b-owed-main t-row-open" type="button"' + goAttr({ req: q.id }) + '>' +
        '<span class="b-owed-head">' +
          '<span class="b-owed-type">' + esc(c.name) + '</span>' +
          '<span class="b-owed-by">' + esc(q.title) + ' · ' + esc(accOf(q).name) + '</span>' +
          stageTag(c) +
        '</span>' +
        '<span class="b-owed-body">' + rowSay(c) + '</span>' +
      '</button>' +
      (verb === 'nudge'
        ? '<button class="b-owed-go t-row-go" type="button" data-nudge="' + c.id + '">' + (c.nudged != null ? 'Nudged' : esc(nudgeSay(c))) + '</button>'
        : nx ? '<button class="b-owed-go t-row-go" type="button" data-move="' + c.id + '|' + nx + '">' + esc(goSay(c)) + '</button>' : '') +
    '</div>';
  }
  function rowSay(c) {
    const w = waitsOn(c);
    if (MEETS[c.stage] && c.fb) return 'Interview ' + sayWhen(c.meet) + '. The result is in: proceed. ' + evSay(c) + '.';
    if (w === 'client' && c.stage === 'sent') return 'Profile sent <b>' + days(c.since) + '</b> ago. ' + esc(waitWho(c)) + ' has not said whether they want to meet.';
    if (MEETS[c.stage] && c.meet < 0) return 'Interview ' + sayWhen(c.meet) + '. ' + esc(waitWho(c)) + ' has not sent the result.';
    if (c.stage === 'offer') return 'Offer out <b>' + days(c.since) + '</b>. No answer yet.';
    return esc(STAGE[c.stage].say) + ', ' + days(c.since) + '.';
  }

  /* ── TODAY ── */
  function homePage() {
    const d = decisions(), w = waits(), t = today();
    const risky = myOpen().map((q) => ({ q: q, h: health(q) })).filter((x) => x.h.risk);
    return '<div class="s-home">' +
      topBrief() +
      '<section class="s-block s-block-wide">' +
        '<div class="s-camp-list-head">' + switcher('') + '</div>' +
        '<p class="b-tocall">' + (d.length ? '<b>' + plural(d.length, 'decision') + '</b> waiting on you, oldest first. Each is one press, and each can be undone.'
          : 'Nothing is waiting on your call.') + '</p>' +
        (d.length ? '<div class="b-owed">' + d.map((c, i) => workRow(c, i)).join('') + '</div>' : '') +
      '</section>' +
      (t.length ? '<section class="s-block s-block-wide" aria-label="Interviews today">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Interviews today</h2>' +
          '<span class="s-block-say">' + plural(t.length, 'interview') + ' · earliest first</span></div>' +
        '<div class="b-cal-agenda">' + t.map((c) => '<button class="b-cal-ev" type="button"' + goAttr({ req: c.req }) + '>' +
          '<span class="b-cal-evtop"><span class="b-cal-dot k-meeting"></span><span class="b-cal-etime">' + esc(c.slot) + '</span>' +
            '<span class="b-kind">' + esc(STAGE[c.stage].label) + '</span></span>' +
          '<span class="b-cal-ename"><b>' + esc(c.name) + '</b><span class="b-cal-ewhat">' + esc(reqOf(c).title) + ' · ' + esc(accOf(reqOf(c)).name) + '</span></span>' +
        '</button>').join('') + '</div>' +
      '</section>' : '') +
      (w.length ? '<section class="s-block s-block-wide" aria-label="Waiting on others">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Waiting on others</h2>' +
          '<span class="s-block-say">' + plural(w.length, 'candidate') + ' past the usual time · longest first</span></div>' +
        aimyBlock({ text: 'Nudging is done for you and logged. Nothing is sent to a candidate.', from: 'how nudges work here' }) +
        '<div class="b-owed">' + w.map((c, i) => workRow(c, i, 'nudge')).join('') + '</div>' +
      '</section>' : '') +
      (risky.length ? '<section class="s-block s-block-wide" aria-label="At risk">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Likely to miss their date</h2>' +
          '<span class="s-block-say">rule-based · the reason is on each row</span></div>' +
        '<div class="b-owed">' + risky.map((x, i) => '<button class="b-owed-row" type="button"' + goAttr({ req: x.q.id }) + ' style="--i:' + i + '">' +
          '<span class="b-owed-sev" aria-hidden="true"></span>' +
          '<span class="b-owed-main"><span class="b-owed-head"><span class="b-owed-type">' + esc(x.q.title) + '</span>' +
            '<span class="b-owed-by">' + esc(accOf(x.q).name) + '</span>' + tag('At risk', 'warn') + '</span>' +
            '<span class="b-owed-body">' + riskSay(x.q, x.h) + '</span></span>' +
          '<span class="b-owed-go">Open it</span></button>').join('') + '</div>' +
      '</section>' : '') +
    '</div>';
  }
  function riskSay(q, h) {
    return 'The target is ' + sayDay(q.target) + ', <b>' + days(h.left) + '</b> away. The furthest candidate is at the ' +
      esc(STAGE[h.furthest].label.toLowerCase()) + ', and from there an accepted offer usually takes <b>' + days(h.need) + '</b>.';
  }

  /* ── REQUISITIONS ── the recruiter's, as cards, cut by where they stand. */
  const CUTS = [
    /* "Open" is `isOpen`, the same test the rail and the switcher count, so
       the three numbers cannot disagree. On hold is its own cut. */
    { k: 'all',    label: 'Open',               test: isOpen },
    { k: 'risk',   label: 'At risk',            test: (q) => stateOf(q) === 'risk' },
    { k: 'client', label: 'Waiting on the client', test: (q) => activeOf(q).some((c) => waitsOn(c) === 'client') },
    { k: 'mine',   label: 'Waiting on you',     test: (q) => activeOf(q).some((c) => MEETS[c.stage] && c.fb) },
    { k: 'hold',   label: 'On hold',            test: (q) => q.state === 'hold' },
    { k: 'closed', label: 'Closed',             test: (q) => !!CLOSED[q.state] },
  ];
  const findHit = (q, f) => {
    if (!f) return true;
    const s = f.toLowerCase();
    return (q.title + ' ' + accOf(q).name + ' ' + hmOf(q).name).toLowerCase().indexOf(s) >= 0 ||
      DB.byReq[q.id].some((c) => c.name.toLowerCase().indexOf(s) >= 0);
  };
  function reqsPage() {
    const cut = CUTS.filter((c) => c.k === S.q)[0] || CUTS[0];
    const all = mine();
    const list = all.filter(cut.test).filter((q) => findHit(q, S.find))
      .sort((a, b) => (stateOf(b) === 'risk') - (stateOf(a) === 'risk') || a.target - b.target);
    return '<div class="s-home">' +
      topBrief() +
      '<section class="s-block s-block-wide">' +
        '<div class="s-camp-list-head">' + switcher('reqs') +
          '<label class="b-find">' + svg('find', 14) +
            '<input type="text" data-find value="' + esc(S.find || '') + '" placeholder="Find a requisition, an account or a candidate" spellcheck="false" aria-label="Find a requisition, an account or a candidate"></label>' +
        '</div>' +
        '<div class="b-cuts b-cuts-row">' + CUTS.map((c) => '<button class="filter-chip' + (c === cut ? ' active' : '') + '" type="button" data-q="' + c.k + '">' +
          esc(c.label) + '<span class="b-cut-n">' + all.filter(c.test).length + '</span></button>').join('') + '</div>' +
        (list.length ? '<div class="b-grid">' + list.map((q, i) => '<div class="b-slot">' + reqCard(q, i) + '</div>').join('') + '</div>' +
          '<p class="b-vfoot">' + (list.length === all.filter(cut.test).length ? plural(list.length, 'requisition') + ', all shown.' : plural(list.length, 'requisition') + ' match “' + esc(S.find) + '”.') + '</p>'
          : '<p class="s-none">' + (S.find ? 'Nothing here matches “' + esc(S.find) + '”.' : 'None of your requisitions is here.') + '</p>') +
      '</section>' +
    '</div>';
  }

  function reqCard(q, i) {
    const st = REQ_STATE[stateOf(q)];
    const h = health(q);
    const act = activeOf(q);
    const sent = act.filter((c) => c.stage === 'sent' || c.stage === 'client').length;
    const f = funnel(q);
    const ws = worstStep(f);
    const clock = CLOSED[q.state] ? 'closed' : q.state === 'hold' ? 'paused' : h.left >= 0 ? days(h.left) + ' left' : days(-h.left) + ' past the target';
    const read = CLOSED[q.state]
      ? (q.state === 'filled' || q.state === 'started' ? plural(q.seats, 'seat') + ' filled, from ' + DB.byReq[q.id].length + ' candidates.' : 'Closed before anyone was hired.')
      : ws ? '<b>' + ws.m + ' of ' + ws.n + '</b> moved on from the ' + esc(STAGE[ws.from].label.toLowerCase()) + ', the biggest drop here.'
      : 'Too early to say where people drop.';
    return '<article class="type-card s-card b-qcard" data-open="req:' + q.id + '" style="--i:' + Math.min(i, 8) + '">' +
      '<div class="tc-head">' + tag(st.label, st.tone) + '<span class="b-kind">' + esc(clock) + '</span>' +
        '<span class="tc-type b-fact">' + svg('acc') + '<span>' + esc(accOf(q).name) + '</span></span></div>' +
      '<button class="tc-title s-card-title" type="button" data-req="' + q.id + '">' + esc(q.title) + '</button>' +
      '<p class="tc-summary b-qcard-what b-fact">' + svg('goal') + '<span>' +
        esc(plural(q.seats, 'seat')) + ' · ' + esc(q.kind === 'replacement' ? 'a replacement' : 'a new role') + ' · ' + esc(q.level) + '</span></p>' +
      '<div class="b-qcard-why">' + (CLOSED[q.state] ? 'Opened ' + sayDay(q.opened)
        : '<b>' + act.length + '</b> in progress' + (sent ? ', <b>' + sent + '</b> with the client' : '')) + '</div>' +
      aimyBlock({ text: read, from: 'this requisition’s own stages' }) +
      '<div class="tc-gov b-qcard-foot"><span class="b-qcard-num b-fact">' + svg('user') + '<span>' + esc(hmOf(q).name) + '</span></span>' +
        '<button class="s-insight-lnk primary" type="button" data-req="' + q.id + '">Open it</button></div>' +
    '</article>';
  }

  /* ── ONE REQUISITION ── the campaign record, as a requisition. */
  function reqPage() {
    const q = DB.reqById[S.req];
    const st = REQ_STATE[stateOf(q)];
    const h = health(q);
    const t = tplOf(q);
    const act = activeOf(q);
    const all = DB.byReq[q.id];
    const f = funnel(q);
    const ws = worstStep(f);
    const cutK = S.q && (S.q === 'all' || S.q === 'out' || STAGE[S.q]) ? S.q : 'all';
    const people = cutK === 'all' ? act : cutK === 'out' ? all.filter((c) => c.exit) : act.filter((c) => c.stage === cutK);
    people.sort((a, b) => t.indexOf(b.stage) - t.indexOf(a.stage) || b.since - a.since);
    const sentN = all.filter((c) => rank(q, c.maxAt) >= rank(q, 'sent')).length;
    const metN = all.filter((c) => rank(q, c.maxAt) >= rank(q, 'client')).length;
    const backTo = TRAIL && (TRAIL.on || !TRAIL.req) ? (TRAIL.on === 'reqs' ? 'Requisitions' : 'Today') : 'Requisitions';

    const lead = CLOSED[q.state] ? { n: q.seats, of: q.seats, say: 'seats filled. This requisition is closed.' }
      : q.tpl === 'client' && sentN ? { n: metN, of: sentN, say: (sentN === 1 ? 'profile sent got' : 'profiles sent got') + ' a client interview' + (h ? ', with ' + days(Math.max(0, h.left)) + ' to the target.' : '.') }
      : { n: act.length, of: all.length, say: (all.length === 1 ? 'candidate is' : 'candidates are') + ' still in progress' + (h ? ', with ' + days(Math.max(0, h.left)) + ' to the target.' : '.') };
    const deck = h && h.risk ? riskSay(q, h).replace(/<\/?b>/g, '') + ' Moving the date changes the forecast, not the work.'
      : ws ? 'The biggest drop is after the ' + STAGE[ws.from].label.toLowerCase() + ': ' + ws.m + ' of ' + ws.n + ' moved on.'
      : 'Nothing stands out yet.';

    return '<div class="s-home">' +
      '<div class="b-topbar s-block-wide"><button class="s-back" type="button" data-trail>' + svg('back', 14) + 'Back to ' + backTo + '</button></div>' +
      '<section class="s-rec-head s-block-wide">' +
        '<span class="s-rec-kind b-kinds">' + fact('req', 'Requisition') + fact('acc', accOf(q).name) + fact('pin', q.place) +
          fact('users', plural(q.seats, 'seat')) + fact('cal', sayDay(q.opened) + ' to ' + sayDay(q.target)) + '</span>' +
        '<div class="s-rec-title"><h1 class="s-rec-name">' + esc(q.title) + '</h1>' +
          '<span class="s-meta-st tone-' + st.tone + '">' + esc(st.label) + '</span>' +
          (h ? '<span class="b-kind">' + (h.left >= 0 ? days(h.left) + ' left' : days(-h.left) + ' past the target') + '</span>' : '') + '</div>' +
        '<div class="b-cmeta">' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">The need</h2><div class="b-cmeta-say">' +
            '<p class="b-cmeta-p">' + esc(plural(q.seats, 'seat')) + ', ' + (q.kind === 'replacement' ? 'a replacement' : 'a new role') + ', ' + esc(q.level.toLowerCase()) + '.</p>' +
            '<p class="b-cmeta-p">' + (q.billable ? 'Billable to the client.' : 'Not billable.') + '</p></div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Hiring manager</h2><div class="b-cmeta-say"><p class="b-cmeta-p"><b>' + esc(hmOf(q).name) + '</b></p></div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Stages</h2><div class="b-cmeta-say"><p class="b-cmeta-p">' +
            esc(t.filter((k) => k !== 'joined').map((k) => STAGE[k].label).join(' → ')) + '</p></div></div>' +
        '</div>' +
        '<div class="b-cmeta b-said">' +
          '<div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">Success profile</span></div><div class="b-cmeta-say">' +
            q.must.map((m) => '<p class="b-cmeta-p">' + esc(m) + '</p>').join('') + '</div></div>' +
          '<div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">Notes</span></div><div class="b-cmeta-say"><p class="b-cmeta-p b-draft-none">Nothing written.</p></div></div>' +
        '</div>' +
      '</section>' +
      '<section class="s-insight is-lead s-block-wide" aria-label="Where this requisition is">' +
        '<div class="s-lead-mark"><svg class="s-insight-mark" viewBox="0 0 18 20" width="14" height="14" aria-hidden="true"><use href="#aimy-logo-small"/></svg>' +
          '<span class="work-state ws-detected">Read off the record</span></div>' +
        '<div class="s-lead-line"><span class="s-lead-n">' + lead.n + '</span><span class="s-lead-say">of the <span class="s-lead-of">' + lead.of + '</span> ' + esc(lead.say) + '</span></div>' +
        '<p class="s-lead-deck">' + esc(deck) + '</p>' +
      '</section>' +
      funnelBlock(q, f, ws) +
      '<section class="s-block s-block-wide" aria-label="Candidates">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">The candidates on it</h2>' +
          '<span class="s-block-say">' + act.length + ' in progress · ' + all.filter((c) => c.exit).length + ' left</span></div>' +
        '<div class="b-cuts b-cuts-row">' +
          '<button class="filter-chip' + (cutK === 'all' ? ' active' : '') + '" type="button" data-q="all">In progress<span class="b-cut-n">' + act.length + '</span></button>' +
          t.filter((k) => k !== 'joined').map((k) => { const n = act.filter((c) => c.stage === k).length;
            return n ? '<button class="filter-chip' + (cutK === k ? ' active' : '') + '" type="button" data-q="' + k + '">' + esc(STAGE[k].label) + '<span class="b-cut-n">' + n + '</span></button>' : ''; }).join('') +
          '<button class="filter-chip' + (cutK === 'out' ? ' active' : '') + '" type="button" data-q="out">Left<span class="b-cut-n">' + all.filter((c) => c.exit).length + '</span></button>' +
        '</div>' +
        (people.length ? '<div class="b-grid">' + people.map((c, i) => '<div class="b-slot">' + candCard(c, i) + '</div>').join('') + '</div>' +
          '<p class="b-vfoot">' + plural(people.length, 'candidate') + ', all shown.</p>'
          : '<p class="s-none">Nobody is here.</p>') +
      '</section>' +
    '</div>';
  }

  /* The funnel: how many ever reached each stage, to scale against the
     first, with the biggest drop marked. One chart, and it is the
     requisition's own. */
  function funnelBlock(q, f, ws) {
    const top = Math.max(1, f[0].n);
    return '<section class="s-block s-block-wide" aria-label="Funnel">' +
      '<div class="s-camp-list-head"><h2 class="s-block-h">How far people got</h2>' +
        '<span class="s-block-say">everyone who reached each stage · share of the stage before</span></div>' +
      '<div class="t-funnel" role="list">' + f.map((s, i) => {
        const prev = i ? f[i - 1].n : 0;
        const leak = ws && ws.to === s.k;
        return '<div class="t-fn-row' + (leak ? ' is-leak' : '') + '" role="listitem">' +
          '<span class="t-fn-label">' + esc(STAGE[s.k].label) + '</span>' +
          '<span class="t-fn-track"><span class="t-fn-fill" style="width:' + (s.n / top * 100).toFixed(1) + '%"></span></span>' +
          '<span class="t-fn-n"><b>' + s.n + '</b>' + (i && prev ? ' · ' + Math.round(s.n / prev * 100) + '%' : '') + '</span>' +
        '</div>';
      }).join('') + '</div>' +
      (ws ? aimyBlock({ text: '<b>' + Math.round(ws.rate * 100) + '%</b> got past the ' + esc(STAGE[ws.from].label.toLowerCase()) + ', the lowest of any stage on this requisition.', from: 'every candidate on it' }) : '') +
    '</section>';
  }

  /* One candidate, as the same card. */
  function candCard(c, i) {
    const q = reqOf(c);
    const nx = nextOf(c);
    const w = waitsOn(c);
    const say = c.exit ? EXIT[c.exit].say + '.'
      : MEETS[c.stage] && c.meet != null ? (c.meet > 0 ? 'Interview ' + sayWhen(c.meet) + ' at ' + c.slot + '.'
        : c.meet === 0 ? 'Interview today at ' + c.slot + '.'
        : c.fb ? 'Interviewed ' + sayWhen(c.meet) + '. The result is in: proceed.'
        : 'Interviewed ' + sayWhen(c.meet) + '. ' + waitWho(c) + ' has not sent the result.')
      : STAGE[c.stage].say.charAt(0).toUpperCase() + STAGE[c.stage].say.slice(1) + ', ' + days(c.since) + '.';
    const canMove = !c.exit && nx && (w === 'me' || w === 'client' || w === 'candidate' || c.stage === 'sourced');
    const outK = c.stage === 'sent' || c.stage === 'client' ? 'clientno' : c.stage === 'offer' ? 'offerno' : 'out';
    return '<article class="type-card s-card b-qcard" style="--i:' + Math.min(i, 8) + '">' +
      '<div class="tc-head">' + stageTag(c) + '<span class="b-kind">' + esc(c.source) + '</span></div>' +
      '<div class="b-qcard-top"><span class="tc-title s-card-title">' + esc(c.name) + '</span></div>' +
      '<p class="tc-summary b-qcard-role">' + esc(c.at) + '</p>' +
      '<p class="b-qcard-where">' + fact('job', plural(c.years, 'year') + ' of experience') + fact('pin', c.place) + '</p>' +
      '<p class="b-qcard-where">' + fact('lang', c.langs.join(', ')) + '</p>' +
      aimyBlock({ text: esc(say) + ' ' + evSay(c) + '.', from: 'the CV, read against the success profile' }) +
      (canMove ? '<div class="tc-gov b-qcard-foot">' +
        '<button class="b-ghost" type="button" data-out="' + c.id + '|' + outK + '">' + esc(EXIT[outK].label) + '</button>' +
        '<button class="s-insight-lnk primary" type="button" data-move="' + c.id + '|' + nx + '">' + esc(goSay(c)) + '</button>' +
      '</div>' : '') +
    '</article>';
  }

  /* ── The prototype panel: not product UI. ── */
  function paintProto() {
    const p = byId('protoPanel');
    if (p.hidden) return;
    p.innerHTML = '<div class="proto-sec">' +
        '<div class="proto-h">Sample data · ' + DB.reqs.length + ' requisitions, ' + DB.cands.length + ' candidates</div>' +
        '<button class="proto-link" type="button" data-reset>Reset to seed</button>' +
      '</div>';
  }

  /* The switcher bar slides to the lit tab (Sales, placeSwitchBar). */
  function placeSwitchBar() {
    const bar = document.querySelector('.b-switch-bar');
    const on = document.querySelector('.b-switch-btn.is-on');
    if (!bar || !on) return;
    bar.style.transform = 'translate(' + on.offsetLeft + 'px, ' + (on.offsetTop + on.offsetHeight - 2) + 'px) scaleX(' + on.offsetWidth + ')';
  }

  function paint() {
    paintWho();
    byId('wbStage').innerHTML = S.req ? reqPage() : S.on === 'reqs' ? reqsPage() : homePage();
    paintRail();
    paintBell();
    paintProto();
    requestAnimationFrame(placeSwitchBar);
  }

  /* ── The bell: what is waiting on a person, every row ending in a record. */
  function paintBell() {
    const w = waits(), d = decisions();
    /* Sales's bell row (sev, head, body, one way in), drawn as a string. */
    const items = d.slice(0, 4).map((c) => ({ c: c, sev: 'p2', type: 'Your call', body: 'The result is in for ' + c.name + '.', cta: 'Open the requisition' }))
      .concat(w.slice(0, 4).map((c) => ({ c: c, sev: 'p3', type: 'Waiting on ' + waitWho(c), body: waitWho(c) + ' owes an answer on ' + c.name + '.', cta: 'Open the requisition' })));
    byId('ntfList').innerHTML = items.length ? items.map((x) => '<li class="ntf-row' + (D.read ? ' is-read' : '') + '">' +
      '<span class="ntf-sev ' + x.sev + '" aria-hidden="true"></span>' +
      '<div class="ntf-row-main"><div class="ntf-row-head"><span class="ntf-row-type">' + esc(x.type) + '</span>' +
        '<span class="ntf-row-when">' + esc(days(x.c.since)) + '</span></div>' +
        '<p class="ntf-row-body">' + esc(x.body) + ' ' + esc(reqOf(x.c).title) + ', ' + esc(accOf(reqOf(x.c)).name) + '.</p>' +
        '<button class="ntf-row-cta" type="button"' + goAttr({ req: x.c.req }) + '>' + esc(x.cta) + '</button></div></li>').join('')
      : '<li class="ntf-empty">Nothing waiting on you.</li>';
    const unread = !D.read && items.length;
    byId('ntfDot').hidden = !unread;
    byId('ntfCount').hidden = !items.length;
    byId('ntfCount').textContent = items.length;
  }


  /* ══ 8. THE ROUTER ══════════════════════════════════════════════════════
     One delegated listener; each branch is a verb a surface draws. */

  /* ── Toast. Every write lands here and every write can be taken back. ── */
  let toastTimer = null;
  let UNDO = null;
  function toastGone() {
    const el = byId('toastHost').querySelector('.s-toast');
    UNDO = null;
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (!el || el.classList.contains('is-leaving')) return;
    el.classList.add('is-leaving');
    setTimeout(() => { if (el.parentNode) el.remove(); }, 200);
  }
  function toast(msg, undo, sub) {
    const life = undo ? 6000 : 4000;
    UNDO = undo || null;
    if (toastTimer) clearTimeout(toastTimer);
    const inner =
      '<span class="aimy-toast-icon"><svg width="13" height="15" viewBox="0 0 18 20">' +
        '<use href="#aimy-logo-small"/></svg></span>' +
      '<span class="aimy-toast-body"><span class="aimy-toast-title">' + esc(msg) + '</span>' +
        (sub ? '<span class="aimy-toast-sub">' + esc(sub) + '</span>' : '') + '</span>' +
      (undo ? '<span class="aimy-toast-divider"></span>' +
        '<button class="aimy-toast-undo" type="button" data-undo>Undo</button>' : '') +
      '<span class="aimy-toast-progress"><span class="aimy-toast-progress-fill" ' +
        'style="animation-duration:' + life + 'ms"></span></span>';
    const host = byId('toastHost');
    const up = host.querySelector('.s-toast:not(.is-leaving)');
    if (up) up.innerHTML = inner;
    else host.innerHTML = '<div class="aimy-toast visible s-toast">' + inner + '</div>';
    toastTimer = setTimeout(toastGone, life);
  }

  /* A move, with its own Undo. The stage only goes forward here; Undo puts
     back exactly the fields it changed. */
  function move(c, to) {
    const was = { stage: c.stage, since: c.since, meet: c.meet, fb: c.fb, maxAt: c.maxAt, exit: c.exit, nudged: c.nudged };
    const q = reqOf(c);
    const fields = { stage: to, since: 0, fb: false, nudged: null,
      meet: MEETS[to] ? 2 : null, slot: c.slot || '11:00',
      maxAt: rank(q, to) > rank(q, c.maxAt) ? to : c.maxAt };
    write(c, fields);
    paint();
    toast('Moved ' + first(c.name) + ' to ' + STAGE[to].label.toLowerCase(), () => { write(c, was); paint(); toast('Put back', null, c.name + ' is at ' + STAGE[was.stage].label.toLowerCase() + ' again.'); },
      MEETS[to] ? 'Booked for ' + sayDay(2) + '. AiMY tells them from the booking.' : to === 'sent' ? 'Sent to ' + accOf(q).name + '. They will be asked once, and nudged if they go quiet.' : null);
  }
  function out(c, k) {
    const was = { exit: c.exit, since: c.since };
    write(c, { exit: k, since: 0 });
    paint();
    toast(first(c.name) + ': ' + EXIT[k].label.toLowerCase(), () => { write(c, was); paint(); toast('Put back', null, c.name + ' is in progress again.'); },
      k === 'out' ? 'Nothing is sent to them until a person approves the message.' : null);
  }
  function nudge(c) {
    if (c.nudged != null) return;
    write(c, { nudged: 0 });
    paint();
    toast(nudgeSay(c).replace('Nudge', 'Nudged'), () => { write(c, { nudged: null }); paint(); }, 'About ' + c.name + '. Logged on the requisition.');
  }

  function start(k) {
    const d = decisions();
    if (k === 'decide' && d[0]) return go({ req: d[0].req, q: d[0].stage });
    if (k === 'send') { const c = d.filter((x) => x.stage === 'tech' && reqOf(x).tpl === 'client')[0]; return c ? go({ req: c.req, q: 'tech' }) : go({ on: 'reqs', q: 'mine' }); }
    if (k === 'screen') { const c = toScreen()[0]; return c ? go({ req: c.req, q: c.stage }) : go({ on: 'reqs' }); }
    if (k === 'risk') return go({ on: 'reqs', q: 'risk' });
    go({});
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    const at = (sel) => t.closest(sel);
    let el;
    if ((el = at('[data-undo]'))) { const u = UNDO; toastGone(); if (u) u(); return; }
    if ((el = at('[data-move]'))) { const p = el.getAttribute('data-move').split('|'); move(DB.byId[p[0]], p[1]); return; }
    if ((el = at('[data-out]'))) { const p = el.getAttribute('data-out').split('|'); out(DB.byId[p[0]], p[1]); return; }
    if ((el = at('[data-nudge]'))) { nudge(DB.byId[el.getAttribute('data-nudge')]); return; }
    if ((el = at('[data-start]'))) { start(el.getAttribute('data-start')); return; }
    if ((el = at('[data-quick]'))) { go({ on: 'reqs', q: el.getAttribute('data-quick') }); return; }
    if ((el = at('[data-q]'))) { go(Object.assign({}, S, { q: el.getAttribute('data-q') }), true); return; }
    if ((el = at('[data-trail]'))) { go(TRAIL && !TRAIL.req ? TRAIL : { on: 'reqs' }); return; }
    if ((el = at('[data-home]'))) { go({}); return; }
    if ((el = at('[data-reset]'))) { reset(); load(); go({}, true); toast('Back to the start', null, 'Every change you made is gone.'); return; }
    if ((el = at('#protoToggle'))) { const p = byId('protoPanel'); p.hidden = !p.hidden; el.setAttribute('aria-expanded', String(!p.hidden)); paintProto(); return; }
    if ((el = at('#ntfBell'))) { const p = byId('ntfPanel'); p.hidden = !p.hidden; el.setAttribute('aria-expanded', String(!p.hidden)); return; }
    if ((el = at('#ntfClear'))) { D.read = true; save(); paintBell(); return; }
    if ((el = at('#canvasOpen'))) { byId('floatInput').focus(); return; }
    /* The product list that hangs from the mark below 720px (Sales). */
    if ((el = at('[data-pickopen]'))) {
      const m = byId(el.getAttribute('data-pickopen'));
      m.hidden = !m.hidden; el.setAttribute('aria-expanded', String(!m.hidden)); return;
    }
    if ((el = at('[data-req]'))) { go({ req: el.getAttribute('data-req') }); return; }
    if ((el = at('[data-go]'))) { go(JSON.parse(el.getAttribute('data-go'))); return; }
    /* The whole card is a door, written as the trailing fallback so any
       control inside it wins (Sales's rule). */
    if ((el = at('[data-open]'))) { const p = el.getAttribute('data-open').split(':'); if (p[0] === 'req') go({ req: p[1] }); return; }
    /* A click outside the bell closes it. */
    if (!at('.ntf-anchor')) { const p = byId('ntfPanel'); if (!p.hidden) { p.hidden = true; byId('ntfBell').setAttribute('aria-expanded', 'false'); } }
  });

  /* Find, as you type. The page repaints and the cursor stays where it was. */
  document.addEventListener('input', (e) => {
    if (!e.target.matches('[data-find]')) return;
    const v = e.target.value, pos = e.target.selectionStart;
    S.find = v || undefined;
    history.replaceState(null, '', urlOf(S));
    paint();
    const inp = document.querySelector('[data-find]');
    if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
  });
  /* The composer finds, for now: Enter takes what was typed to the
     requisitions it matches. Asking AiMY arrives with the canvas. */
  byId('floatInput').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const v = e.target.value.trim();
    e.target.value = '';
    go({ on: 'reqs', find: v || undefined });
  });
  byId('floatSend').addEventListener('click', () => {
    const v = byId('floatInput').value.trim();
    byId('floatInput').value = '';
    go({ on: 'reqs', find: v || undefined });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { const p = byId('ntfPanel'); if (!p.hidden) { p.hidden = true; byId('ntfBell').setAttribute('aria-expanded', 'false'); } }
    if (e.key === '/' && !/input|textarea/i.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); byId('floatInput').focus(); }
  });
  window.addEventListener('popstate', () => { parse(); paint(); });
  window.addEventListener('resize', () => requestAnimationFrame(placeSwitchBar), { passive: true });


  /* ══ 9. BOOT ════════════════════════════════════════════════════════════ */
  /* The narrow-width product menu is filled from the tab strip itself, so
     the ecosystem list has one source (Sales's rule). */
  byId('prodMenu').innerHTML = Array.prototype.map.call(document.querySelectorAll('.topnav-tab'), (t) =>
    t.tagName === 'A' ? '<a class="b-menu-item" role="menuitem" href="' + esc(t.getAttribute('href')) + '">' + esc(t.textContent.trim()) + '</a>'
      : t.hasAttribute('data-home') ? '<button class="b-menu-item" type="button" role="menuitem" data-home aria-current="page">' + esc(t.textContent.trim()) + '</button>'
      : '').join('');
  seed();
  load();
  parse();
  paint();
  window.TALENT = { DB: DB, S: S, decisions: decisions, waits: waits, health: health, funnel: funnel };
})();

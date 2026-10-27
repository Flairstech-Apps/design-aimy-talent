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
  /* Lower-case a label for the middle of a sentence, but keep an acronym
     ("HR interview") as it is. */
  const lower = (t) => /^[A-Z][A-Z0-9]/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);

  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const first = (name) => String(name).split(' ')[0];
  /* Where someone is, said as English: "at the technical interview", but
     "with the client" rather than "at the profile sent". */
  const STAGE_AT = { sourced: 'sourced, not contacted yet', applied: 'at the application', sent: 'with the client, profile sent', accepted: 'past the offer, accepted', joined: 'joined' };
  const atStage = (k) => STAGE_AT[k] || 'at the ' + STAGE[k].label.charAt(0).toLowerCase() + STAGE[k].label.slice(1);

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
    /* The call's own icons, verbatim from Sales's ICONS. */
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    hangup: '<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/> <line x1="22" x2="2" y1="2" y2="22"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/> <path d="M19 10v2a7 7 0 0 1-14 0v-2"/> <line x1="12" x2="12" y1="19" y2="22"/>',
    micoff: '<line x1="2" x2="22" y1="2" y2="22"/> <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/> <path d="M5 10v2a7 7 0 0 0 12 5"/> <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/> <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/> <line x1="12" x2="12" y1="19" y2="22"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/> <rect x="6" y="4" width="4" height="16" rx="1"/>',
    dot: '<circle cx="12" cy="12" r="10"/>',
    callin: '<path d="M17 7 7 17"/> <path d="M7 11v6h6"/>',
    callout: '<path d="M7 17 17 7"/> <path d="M7 7h10v10"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    videooff: '<path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196"/><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/><path d="m2 2 20 20"/>',
    skip: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    /* For the research mockups (30 Research/UI): Lucide, as the rest. */
    quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>',
    okc: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    qc: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    warnc: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    tri: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    loop: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    branch: '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    bars: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
    listc: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
    clip: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    pen: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    hist: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    msg: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    ring: '<circle cx="12" cy="12" r="10" stroke-dasharray="3 3"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    badge: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
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
    assess:   { label: 'Assessment',          who: 'candidate', exp: 3, go: 'Passed the assessment', say: 'taking the assessment' },
    phone:    { label: 'Phone screen',        who: 'me',        exp: 2, go: 'Passed the call',   say: 'a screening call is due' },
    hr:       { label: 'HR interview',        who: 'me',        exp: 3, go: 'Passed HR',         say: 'with HR' },
    tech:     { label: 'Technical interview', who: 'interviewer', exp: 4, go: 'Send the profile', say: 'with the technical interviewer' },
    mgr:      { label: 'Managerial interview', who: 'hm',       exp: 3, go: 'Passed',            say: 'with the hiring manager' },
    sent:     { label: 'Profile sent',        who: 'client',    exp: 3, go: 'Client wants to meet', say: 'with the client to choose' },
    client:   { label: 'Client interview',    who: 'client',    exp: 5, go: 'Client said yes',   say: 'met the client' },
    ctech:    { label: 'Client technical interview', who: 'client', exp: 5, go: 'Client said yes', say: 'with the client’s technical team' },
    offer:    { label: 'Offer',               who: 'candidate', exp: 4, go: 'Accepted',          say: 'an offer is out' },
    accepted: { label: 'Accepted',            who: 'candidate', exp: 40, go: 'Joined',           say: 'accepted, not started' },
    joined:   { label: 'Joined',              who: null,        exp: 0, say: 'started' },
  };
  /* The internal template's tech step does not send a profile anywhere. */
  const GO_INTERNAL = { tech: 'Passed technical' };

  /* The stage templates. The pipeline differs by company and department
     (New Operations list), so each account picks one, and the HR Manager
     edits them on the Templates page. `northwind` is the one client that
     tests before the call and runs a technical round of its own. */
  const TEMPLATE = {
    client:    ['sourced', 'applied', 'phone', 'hr', 'tech', 'sent', 'client', 'offer', 'accepted', 'joined'],
    northwind: ['sourced', 'applied', 'assess', 'phone', 'hr', 'tech', 'sent', 'client', 'ctech', 'offer', 'accepted', 'joined'],
    internal:  ['sourced', 'applied', 'phone', 'hr', 'tech', 'mgr', 'offer', 'accepted', 'joined'],
  };
  const TEMPLATE_SEED = JSON.parse(JSON.stringify(TEMPLATE));
  const TEMPLATE_NAME = { client: 'Client roles', northwind: 'Northwind Software', internal: 'FlairsTech’s own roles' };
  /* Stages a template must keep, because the product's own steps hang off
     them: someone has to come in, be screened and be hired. */
  const STAGE_FIXED = { sourced: 1, applied: 1, phone: 1, offer: 1, accepted: 1, joined: 1 };
  /* The library a template is built from, in the order a pipeline runs. */
  const STAGE_ORDER = ['sourced', 'applied', 'assess', 'phone', 'hr', 'tech', 'mgr', 'sent', 'client', 'ctech', 'offer', 'accepted', 'joined'];

  /* The ways out. Not stages: a candidate does not climb to "declined". */
  const EXIT = {
    out:       { label: 'Not progressing', say: 'we did not take them further' },
    withdrew:  { label: 'Withdrew',        say: 'they stepped out' },
    clientno:  { label: 'Client declined', say: 'the client said no' },
    offerno:   { label: 'Offer declined',  say: 'they turned the offer down' },
  };

  /* Stages where an interview happens, so a result can be in or still owed. */
  const MEETS = { hr: 1, tech: 1, mgr: 1, client: 1, ctech: 1 };

  const REQ_STATE = {
    draft:    { label: 'Draft',             tone: 'warn' },
    open:     { label: 'Open',              tone: 'neutral' },
    risk:     { label: 'At risk',           tone: 'warn' },
    hold:     { label: 'On hold',           tone: 'neutral' },
    filled:   { label: 'Filled',            tone: 'ok' },
    started:  { label: 'Hired, not started', tone: 'ok' },
    cclient:  { label: 'Cancelled by the client', tone: 'neutral' },
    cmgr:     { label: 'Cancelled by the manager', tone: 'neutral' },
  };
  const CLOSED = { filled: 1, started: 1, cclient: 1, cmgr: 1 };

  /* ── Calls ──────────────────────────────────────────────────────────────
     Ported from Sales's call model and re-worded for a recruiter. Eight
     outcomes on one row, keys 1 to 8. Only the first moves a stage forward,
     and only while the candidate is at or before the phone screen; a call
     later on (a status question, a reschedule) is logged against them and
     moves nothing. The exits are the same exits the cards use. */
  /* `label` is the chip; `say` is the same outcome inside a sentence. */
  const OUTCOMES = [
    { k: 'passed',   label: 'Passed the screen', say: 'passed the screen' },
    { k: 'reached',  label: 'Spoke to them',     say: 'you spoke' },
    { k: 'callback', label: 'Call back',         say: 'they asked to be called back' },
    { k: 'noanswer', label: 'No answer',         say: 'no answer' },
    { k: 'notfit',   label: 'Not a fit',         say: 'not a fit' },
    { k: 'withdrew', label: 'Not interested',    say: 'not interested' },
    { k: 'wrong',    label: 'Wrong number',      say: 'wrong number' },
    { k: 'dnc',      label: 'Do not call',       say: 'they asked not to be called' },
  ];
  const OUTCOME = {};
  OUTCOMES.forEach((o, i) => { OUTCOME[o.k] = Object.assign({ n: i + 1 }, o); });

  /* THE TELEPHONY IS FIXTURE, as in Sales. No dialling of any kind: a
     transcript grows a line at a time from a script chosen by the
     candidate's own `fate`, so a demo walked twice tells the same story. */
  const DIAL_MS = 1600;
  const LINE_MS = 2600;
  const CALL_SCRIPTS = {
    pass: [
      ['you', 'Hi {first}, this is {me} from FlairsTech, about the {role} role. Is now a good time?'],
      ['them', 'Yes, go ahead.'],
      ['you', 'Tell me about the work you do now, and why you are looking.'],
      ['them', 'I have done {years} years of this. I want a team where I can grow.'],
      ['you', 'What notice do you have to give, and what salary are you expecting?'],
      ['them', 'One month notice. I am expecting around 25,000 a month.'],
      ['you', 'That works for this role. I would like to book you for an HR interview.'],
      ['them', 'Sounds good, I am interested. Send me the time.'],
    ],
    german: [
      ['you', 'Hi {first}, this is {me} from FlairsTech, about the {role} role. Is now a good time?'],
      ['them', 'Yes, I have a few minutes.'],
      ['you', 'The client works in German all day. How strong is yours?'],
      ['them', 'My German is C1. I lived in Munich for three years.'],
      ['you', 'Good. What notice do you have, and what are you expecting?'],
      ['them', 'Two months notice. I am expecting around 42,000 a month.'],
      ['you', 'I would like to book you for an HR interview.'],
      ['them', 'Happy to come in for the interview.'],
    ],
    callback: [
      ['you', 'Hi {first}, this is {me} from FlairsTech, about the {role} role.'],
      ['them', 'I am at work right now and cannot talk.'],
      ['you', 'No problem. When is better?'],
      ['them', 'Call me back tomorrow after six.'],
    ],
    noanswer: [
      ['you', 'Dialling…'],
      ['them', 'Nobody picks up.'],
      ['you', 'Left a voicemail asking them to call back.'],
    ],
    notfit: [
      ['you', 'Hi {first}, this is {me} from FlairsTech, about the {role} role.'],
      ['them', 'Yes, I applied last week.'],
      ['you', 'The role runs on shifts, including weekends. Does that work for you?'],
      ['them', 'I cannot work weekends or night shifts, I am afraid.'],
    ],
    withdrew: [
      ['you', 'Hi {first}, this is {me} from FlairsTech, about the {role} role.'],
      ['them', 'Thanks for calling, but I accepted another offer last week. I am not interested any more.'],
    ],
    wrong: [
      ['you', 'Hi, could I speak to {first}?'],
      ['them', 'You have the wrong number. There is nobody here by that name.'],
    ],
  };
  const INBOUND_SCRIPTS = {
    known: [
      ['them', 'Hi, this is {first}. I missed a call from this number about the {role} role.'],
      ['you', 'Thanks for calling back. Is now a good time for a few questions?'],
      ['them', 'Yes. I am interested, and I can start after one month notice.'],
      ['you', 'Good. I will book you for the HR interview.'],
      ['them', 'Sounds good. Thank you.'],
    ],
    status: [
      ['them', 'Hi, it is {first}. I wanted to ask where my application for {role} is.'],
      ['you', 'You are at the {stage} now. You will hear from us this week.'],
      ['them', 'Thank you, that helps.'],
    ],
    named: [
      ['them', 'Hello, I saw the support role on LinkedIn. Is it still open?'],
      ['you', 'It is. Who am I speaking to?'],
      ['them', 'My name is Karim Nabil. I work in technical support at a telecom.'],
      ['you', 'Good to hear from you. I will send you the details and call you back.'],
      ['them', 'Sounds good. I am interested.'],
    ],
    anon: [
      ['them', 'Hi, I am calling about a job I saw. What does it pay?'],
      ['you', 'It depends on the role. Who am I speaking to?'],
      ['them', 'I would rather not say yet. I will call back.'],
    ],
  };
  const DIALLED_SCRIPT = [
    ['you', 'Hello, this is {me} from FlairsTech. Who am I speaking to?'],
    ['them', 'You are speaking to Mariam Khaled. Hossam passed me your number about the support role.'],
    ['you', 'Thanks, Mariam. What do you do now?'],
    ['them', 'I work in technical support at a bank. I am interested, send me the details.'],
  ];

  /* The lines a recruiter calls from (Sales's TEL_LINES). */
  const TEL_LINES = [
    { id: 'cai1', cc: 'EG', num: '+20 2 2480 1150' },
    { id: 'cai2', cc: 'EG', num: '+20 2 2480 1176' },
  ];
  const telTag = (l) => l.cc + ' ' + l.num.replace(/\D/g, '').slice(-4);

  /* ── THE READER ── what a call said, read off the transcript or a typed
     note (Sales's readCall, with a recruiting lexicon). The first matching
     outcome wins, in this order, because "I cannot work weekends, so not
     for me" is a fit question before it is a no. A typed note is read the
     same way and overrides the transcript (Sales's per-axis rule). */
  const READ = [
    ['dnc',      /\b(do not (call|contact)|don't call|take me off)\b/i],
    ['wrong',    /\b(wrong number|nobody (here )?by that name)\b/i],
    ['notfit',   /\b(cannot|can't|unable to) work (weekends|nights?|night shifts|shifts)|not a fit|no german|too far\b/i],
    ['withdrew', /\b(not interested|accepted another|took another|no longer looking|not looking)\b/i],
    ['callback', /\b(call (me )?back|cannot talk|can't talk|not a good time|busy right now)\b/i],
    ['noanswer', /\b(nobody picks? up|no answer|voicemail|didn't pick up)\b/i],
    ['passed',   /\b(sounds good|happy to come in|book (me|you) for|i am interested|i'm interested|passed)\b/i],
  ];
  function readCall(text) {
    const t = String(text || '');
    const out = { outcome: null, notice: null, salary: null, when: null };
    for (let i = 0; i < READ.length; i++) if (READ[i][1].test(t)) { out.outcome = READ[i][0]; break; }
    const n = /\b(one|two|three|1|2|3) months?'?s? notice|\b(start (right away|immediately|next week))/i.exec(t);
    const WORDS = { 1: 'one', 2: 'two', 3: 'three' };
    if (n && n[1]) { const w = WORDS[n[1]] || n[1].toLowerCase(); out.notice = w + (w === 'one' ? ' month’s' : ' months’') + ' notice'; }
    else if (n) out.notice = 'can ' + n[2].toLowerCase();
    const s = /(?:expect(?:ing)?|looking for|asking for)[^0-9]{0,24}([\d,]{5,7})/i.exec(t);
    if (s) out.salary = 'EGP ' + s[1] + ' a month';
    out.when = /\btomorrow\b/i.test(t) ? 1 : /\bnext week\b/i.test(t) ? 7 : /\b(later today|this evening|tonight|in an hour)\b/i.test(t) ? 0 : null;
    return out;
  }
  /* A stranger's name, read off what they said (Sales's READ_WHO, cut down). */
  function readWho(lines) {
    const said = lines.filter((l) => l[0] === 'them').map((l) => l[1]).join(' ');
    const m = /(?:[Mm]y name is|[Yy]ou are speaking to|[Tt]his is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+){1,2})/.exec(said);
    return m ? m[1] : null;
  }

  /* ── Desks ──────────────────────────────────────────────────────────────
     Sales's desks, for recruiting (audit, "Building on AiMY Sales"). The
     recruiter does the work; the hiring manager is an account manager who
     asks for hires, approves and interviews; the HR Manager reads all of it
     and assigns; the client sees the profiles sent to them and nothing
     internal. The candidate and the interviewer are not desks: they reach
     their own screens from a link, as the audit recommended. */
  const DESKS = {
    omar:  { id: 'omar',  name: 'Omar Saeed',   ini: 'OS', role: 'Recruiter',      fn: 'rec' },
    rania: { id: 'rania', name: 'Rania Samir',  ini: 'RS', role: 'Hiring manager', fn: 'hm' },
    /* Sales's stakeholder: reads, changes nothing. The BU Director answers
       budget and headcount on an offer, requests hires for the unit, and
       hears why clients pass (Sales S1, "what buyers say"). */
    hesham: { id: 'hesham', name: 'Hesham Nabil', ini: 'HN', role: 'BU Director',  fn: 'bu' },
    dina:  { id: 'dina',  name: 'Dina Ragab',   ini: 'DR', role: 'HR Manager',     fn: 'hr' },
    jana:  { id: 'jana',  name: 'Jana Weber',   ini: 'JW', role: 'Northwind Software', fn: 'client', acc: 'northwind' },
  };
  const DESK_ORDER = ['omar', 'rania', 'hesham', 'dina', 'jana'];

  /* The people who interview, by role family. */
  const INTERVIEWERS = {
    support: ['Mostafa Kamel, support lead', 'Heba Nagy, L3 support'],
    finance: ['Ahmed Fathy, finance lead', 'Noha Selim, senior accountant'],
    ops:     ['Tamer Ezzat, operations lead', 'Karim Hosny, delivery manager'],
  };
  const BU_DIRECTOR = 'Hesham Nabil';

  /* ── Assessments ─────────────────────────────────────────────────────────
     Questionnaires and live interviews with the AiMY agent (New Operations
     list). A question is a choice (one right answer) or open (AiMY scores it
     against the points listed). `fails` is the share that got it wrong in
     the seed, so the insight "everyone fails Q5" has something to read. */
  const ASMT_SEED = [
    { id: 'a1', title: 'Support troubleshooting and written English', kind: 'quiz', fam: 'support', pass: 70, mins: 20, questions: [
      { q: 'A customer says the app logs them out every few minutes. What do you check first?', type: 'choice', options: ['Their session timeout settings', 'Their screen resolution', 'Their invoice history', 'The app’s colour theme'], right: 0, fails: 0.18 },
      { q: 'Which SQL finds the 10 most recent errors in a table called logs?', type: 'choice', options: ['SELECT * FROM logs ORDER BY created_at DESC LIMIT 10', 'SELECT TOP logs 10', 'GET logs LAST 10', 'SELECT * FROM logs WHERE 10'], right: 0, fails: 0.31 },
      { q: 'Write a two-sentence reply to a customer whose ticket you must escalate.', type: 'open', points: ['says it is escalated', 'says when they will hear back', 'polite and plain'], fails: 0.22 },
      { q: 'A bug only happens for one customer. What do you ask them for?', type: 'choice', options: ['Steps to reproduce, browser and a screenshot', 'Their password', 'Nothing, close it', 'Their manager’s number'], right: 0, fails: 0.12 },
      { q: 'What does an HTTP 502 usually mean?', type: 'choice', options: ['A server upstream gave a bad response', 'The page was not found', 'The user is not logged in', 'The request was too large'], right: 0, fails: 0.79 },
      { q: 'Put these in order of urgency: a typo on the help page, checkout is down, one user cannot reset a password.', type: 'open', points: ['checkout first', 'password second', 'typo last'], fails: 0.27 },
    ] },
    { id: 'a2', title: 'German language check', kind: 'live', fam: 'support', pass: 75, mins: 12, questions: [
      { q: 'Stellen Sie sich bitte kurz vor.', type: 'open', points: ['fluent', 'clear structure'], fails: 0.2 },
      { q: 'Ein Kunde ist verärgert, weil seine Bestellung fehlt. Wie reagieren Sie?', type: 'open', points: ['apologises', 'next step', 'polite register'], fails: 0.34 },
      { q: 'Erklären Sie einem Kunden, wie er sein Passwort zurücksetzt.', type: 'open', points: ['clear steps', 'correct grammar'], fails: 0.28 },
    ] },
    { id: 'a3', title: 'Accounting basics', kind: 'quiz', fam: 'finance', pass: 65, mins: 25, questions: [
      { q: 'A customer pays an invoice. Which accounts move?', type: 'choice', options: ['Cash up, accounts receivable down', 'Revenue up, cash down', 'Accounts payable up', 'Nothing moves'], right: 0, fails: 0.14 },
      { q: 'What is a bank reconciliation for?', type: 'choice', options: ['To match the books to the bank statement', 'To pay suppliers', 'To file taxes', 'To set budgets'], right: 0, fails: 0.1 },
      { q: 'An invoice is 95 days overdue. What do you do?', type: 'open', points: ['contacts the customer', 'escalates per policy', 'records the follow-up'], fails: 0.3 },
      { q: 'Which is an accrual?', type: 'choice', options: ['An expense incurred but not yet invoiced', 'Cash in the bank', 'A paid invoice', 'A share issue'], right: 0, fails: 0.41 },
    ] },
    { id: 'a4', title: 'Operations case', kind: 'quiz', fam: 'ops', pass: 65, mins: 20, questions: [
      { q: 'A weekly report takes a team member a full day. What do you do first?', type: 'open', points: ['writes down the steps', 'finds what repeats', 'asks who reads it'], fails: 0.26 },
      { q: 'Which is the clearest way to hand a process to a new joiner?', type: 'choice', options: ['A short written checklist with an example', 'A long call', 'Nothing, they will learn', 'A screenshot'], right: 0, fails: 0.11 },
      { q: 'Two teams want opposite changes to the same form. What do you do?', type: 'open', points: ['asks both why', 'finds the shared need', 'agrees an owner'], fails: 0.38 },
    ] },
  ];

  /* ── Interview templates ── the agenda the HR Manager sets for each kind
     of interview (New Operations list). AiMY adds the questions the CV is
     silent on to whichever template is used. */
  const IVTPL_SEED = [
    { id: 'tp-hr',   kind: 'hr',     title: 'HR interview',                items: ['Motivation and why this role', 'Notice period and salary expectation', 'Shift and location fit', 'Questions they have for us'] },
    { id: 'tp-tech', kind: 'tech',   title: 'Technical interview',         items: ['Walk through a recent piece of work', 'One live problem from the role', 'The must-haves the CV is silent on', 'How they learn something new'] },
    { id: 'tp-mgr',  kind: 'mgr',    title: 'Managerial interview',        items: ['How they work with a team lead', 'A time they disagreed and how it ended', 'What a good first month looks like'] },
    { id: 'tp-cli',  kind: 'client', title: 'Client interview',            items: ['The client introduces the team', 'Their questions on the candidate’s experience', 'Fit with the client’s hours and tools'] },
    { id: 'tp-ctech', kind: 'ctech', title: 'Client technical interview',  items: ['The client’s own technical exercise', 'Questions on their stack'] },
  ];
  const IV_MODES = { person: 'In person or on Teams', aimy: 'With the AiMY agent', phone: 'By phone' };
  const RATE = { m: 'Met', p: 'Partly met', n: 'Not shown' };

  /* ── Why a client passes (UI/UX plan, P1) ── one reason per decline, from
     a fixed list, because a reason in a list can be counted and a sentence
     cannot. None of the staffing tools researched records one (R2); it is
     the only judgement that carries the client's own idea of fit, so it is
     what teaches matching. "Other" takes one line. */
  const DECLINE = [
    { k: 'lang',   label: 'Spoken language', say: 'spoken language below what they need' },
    { k: 'exp',    label: 'Experience',      say: 'not the experience they need' },
    { k: 'salary', label: 'Salary',          say: 'salary above their range' },
    { k: 'notice', label: 'Notice period',   say: 'notice period too long' },
    { k: 'skills', label: 'Skills gap',      say: 'a skills gap' },
    { k: 'other',  label: 'Other',           say: 'another reason' },
  ];
  const DECLINE_K = {};
  DECLINE.forEach((d) => { DECLINE_K[d.k] = d; });
  /* ── Why we stop (Not progressing) ── the same rule on our own side: one
     reason from a list, so it can be counted, and so a person who comes
     back is read with what stopped them last time. Kept with us; the
     answer the candidate gets never quotes it. */
  const OUT_WHY = [
    { k: 'must',   label: 'Misses a must-have', say: 'misses a must-have' },
    { k: 'lang',   label: 'Spoken language',    say: 'spoken language below what the role needs' },
    { k: 'salary', label: 'Salary',             say: 'expects more than the budget' },
    { k: 'notice', label: 'Notice period',      say: 'notice period too long' },
    { k: 'iv',     label: 'The interview',      say: 'the interview did not go well' },
    { k: 'reach',  label: 'Could not reach them', say: 'could not be reached' },
    { k: 'other',  label: 'Other',              say: 'another reason' },
  ];
  const OUT_K = {};
  OUT_WHY.forEach((d) => { OUT_K[d.k] = d; });
  /* Declines this many days old or newer count as "this month". */
  const MONTH = 30;

  /* ── Nobody waits without hearing back (M4) ── a person marked not
     progressing, or declined by the client, is told within this many days,
     by a person, under the HR Manager's template. Withdrawals and declined
     offers need no telling: the candidate made that call. */
  const TELL_DAYS = 5;
  const NEEDS_TELLING = { out: 1, clientno: 1 };
  const TELL_TPL = 'Hi {first}, thank you for your time on your application for {role}. We have decided not to take it further this time. ' +
    'We keep your profile, and we will tell you about roles that fit you better. {me}, FlairsTech recruiting';

  /* ── What AiMY may do on its own (m4) ── three rungs. Trust goes up only
     when a person moves it, and the move is logged with AiMY's reason; it
     can come down the same way. Seeded where the prototype already acts. */
  const RUNG = [
    { k: 'suggest', label: 'Suggests', say: 'AiMY suggests; a person does it' },
    { k: 'undo',    label: 'Does, with Undo', say: 'AiMY does it; the toast can take it back' },
    { k: 'tell',    label: 'Does and tells', say: 'AiMY does it and says so afterwards' },
  ];
  const AUTO_SEED = [
    { k: 'book',    label: 'Book an interview in the interviewer’s free slots', at: 'undo', why: 'Every booking this month kept its slot; 2 of 61 were moved by a person.' },
    { k: 'nudge',   label: 'Nudge an interviewer or a client who has gone quiet', at: 'undo', why: 'Nudges were undone 3 times in 120.' },
    { k: 'notify',  label: 'Tell a candidate about a booking', at: 'tell', why: 'Booking messages are facts from the calendar, nothing judged.' },
    { k: 'decline', label: 'Send a decline under the HR template', at: 'suggest', why: '38 declines went out under the template in 30 days, none edited before sending.' },
    { k: 'contact', label: 'First message to a sourced prospect', at: 'suggest', why: 'Not enough yet: 9 approvals so far, and prospects have not consented to anything.' },
    { k: 'offerq',  label: 'Answer a candidate’s questions from the offer facts', at: 'undo', why: 'Anything about money already goes to a person.' },
  ];


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
    { id: 'northwind', name: 'Northwind Software', tpl: 'northwind', weight: 21, hm: 'rania', domain: 'Software', since: 2023 },
    { id: 'flairs',    name: 'FlairsTech',         tpl: 'internal',  weight: 5,  hm: 'tarek', domain: 'Internal', since: 2016 },
    { id: 'halcyon',   name: 'Halcyon Mobile',     tpl: 'client',    weight: 3,  hm: 'laila', domain: 'Telecom', since: 2024 },
    { id: 'quarry',    name: 'Quarry Payroll',     tpl: 'client',    weight: 3,  hm: 'laila', domain: 'Payroll software', since: 2022 },
    { id: 'kestrel',   name: 'Kestrel Labs',       tpl: 'client',    weight: 3,  hm: 'sherine', domain: 'Test automation', since: 2025 },
    { id: 'seaborne',  name: 'Seaborne Cruises',   tpl: 'client',    weight: 2,  hm: 'amr', domain: 'Travel', since: 2021 },
    { id: 'fernhill',  name: 'Fernhill Data',      tpl: 'client',    weight: 2,  hm: 'amr', domain: 'Data annotation', since: 2025 },
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
  const PASS = { sourced: 0.62, applied: 0.8, assess: 0.72, ctech: 0.82, phone: 0.71, hr: 0.54, tech: 0.79, mgr: 0.75, sent: 0.30, client: 0.88, offer: 0.86, accepted: 0.92 };

  const DB = { reqs: [], cands: [], byReq: {}, byId: {}, reqById: {}, calls: [] };

  function seed() {
    const r = rng(20261026);
    /* The templates are editable; a seed always starts from the shipped ones. */
    Object.keys(TEMPLATE).forEach((k) => delete TEMPLATE[k]);
    Object.keys(TEMPLATE_SEED).forEach((k) => { TEMPLATE[k] = TEMPLATE_SEED[k].slice(); });
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

    /* Monthly gross, EGP, by level. Sample bands for the offer packet. */
    const BUDGET = { Junior: [14000, 20000], 'Mid-level': [20000, 32000], Senior: [32000, 48000], Manager: [40000, 60000] };
    const BLURB = {
      support: 'You will answer customers by ticket and phone, work out what broke, and fix it or hand it on with everything the next person needs.',
      finance: 'You will keep the books straight for a growing client: invoices, collections, reconciliations and a clean month-end close.',
      ops: 'You will keep the work moving: write down how things are done, spot what slows the team, and fix it with them.',
    };
    const descOf = (q, acc) => 'We are hiring ' + (q.seats === 1 ? 'a ' : q.seats + ' people as ') + q.title +
      (acc.id === 'flairs' ? ' for FlairsTech itself. ' : ' for ' + acc.name + ', a ' + acc.domain.toLowerCase() + ' client. ') + BLURB[q.fam];
    const makeReq = (spec, recId) => {
      const acc = ACCOUNTS.filter((a) => a.id === spec.acc)[0];
      const role = ROLES[spec.role];
      const id = 'r' + (++rn);
      const q = {
        id: id, title: role.title, fam: role.fam, level: role.level, must: role.must,
        acc: acc.id, tpl: acc.tpl, hm: acc.hm, rec: recId,
        seats: spec.seats || 1,
        kind: chance(r, 0.82) ? 'replacement' : 'new',
        billable: acc.tpl !== 'internal' && chance(r, 0.8),
        state: spec.state, opened: -spec.open, target: -spec.open + spec.span,
        place: chance(r, 0.7) ? 'Nasr City office' : 'Hybrid, Maadi office',
        plan: spec.plan || null,
        domain: acc.domain,
        /* Published is off by default (overview); about half the open ones
           have been put on the careers site and LinkedIn by now. */
        published: spec.state === 'open' && chance(r, 0.55),
        budget: BUDGET[role.level] ? { min: BUDGET[role.level][0], max: BUDGET[role.level][1] } : null,
        desc: null,
      };
      q.desc = descOf(q, acc);
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
    /* Egyptian mobiles, unique, so a typed number finds one person. */
    const usedPhones = {};
    const phoneOf = () => {
      for (;;) {
        const p = '+20 1' + pick(r, ['0', '1', '2', '5']) + ' ' + between(r, 1000, 9999) + ' ' + between(r, 1000, 9999);
        if (!usedPhones[p]) { usedPhones[p] = 1; return p; }
      }
    };
    /* How a first call with this person goes, so a demo walked twice tells
       the same story twice (Sales's `fate`). */
    const fateOf = (q) => {
      const x = r();
      return x < 0.42 ? (q.title.indexOf('German') >= 0 ? 'german' : 'pass') : x < 0.58 ? 'callback'
        : x < 0.78 ? 'noanswer' : x < 0.88 ? 'notfit' : x < 0.96 ? 'withdrew' : 'wrong';
    };
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
        phone: phoneOf(), fate: fateOf(q), dnc: false, badNumber: false, callback: null,
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

    /* Nobody gets past the phone screen with a CV that meets nothing: the
       script above moves people forward after their evidence was drawn, so
       anyone past the screen is brought up to at least three in five met,
       Partly met first. */
    DB.cands.forEach((c) => {
      const t = TEMPLATE[DB.reqById[c.req].tpl];
      if (t.indexOf(c.stage) <= t.indexOf('phone')) return;
      let need = Math.ceil(c.ev.length * 0.6) - c.ev.filter((e) => e === 'm').length;
      ['p', 'n'].forEach((k) => { for (let i = 0; i < c.ev.length && need > 0; i++) if (c.ev[i] === k) { c.ev[i] = 'm'; need--; } });
    });

    /* ── The call history ── what has already been said, to whom. Everyone
       past the phone screen had one; people waiting for theirs may have a
       missed attempt; people who left at the screen left on a call. The
       recruiter's own desk also gets today's calls so far, two callbacks due
       today, and three people who called in and got nobody. */
    DB.calls = [];
    let tn = 0;
    const TIMES = ['09:10', '09:40', '10:25', '11:15', '12:05', '13:30', '14:20', '15:10', '16:00', '17:20'];
    const NOTICE = ['one month’s notice', 'one month’s notice', 'two months’ notice', 'can start right away'];
    const PAY = ['EGP 18,000 a month', 'EGP 22,000 a month', 'EGP 25,000 a month', 'EGP 30,000 a month', 'EGP 38,000 a month'];
    const T = (c, day, o) => {
      const q = DB.reqById[c.req];
      const t = Object.assign({ id: 'c' + (++tn), cand: c.id, day: day, time: pick(r, TIMES), dir: 'out',
        secs: 0, outcome: 'noanswer', by: q.rec, missed: false, note: '' }, o);
      DB.calls.push(t);
      return t;
    };
    DB.cands.forEach((c) => {
      const q = DB.reqById[c.req], t = TEMPLATE[q.tpl];
      const ri = t.indexOf(c.maxAt), pi = t.indexOf('phone');
      const d0 = Math.min(-1, q.opened + between(r, 2, 9));
      if (ri > pi) {
        c.notice = pick(r, NOTICE); c.salary = pick(r, PAY);
        if (chance(r, 0.3)) T(c, d0 - 1, { note: 'No answer. Left a voicemail.' });
        T(c, d0, { outcome: 'passed', secs: between(r, 240, 720), note: 'Screened by phone: ' + c.notice + ', expects ' + c.salary + '.' });
      } else if (c.exit && (c.stage === 'phone' || c.stage === 'applied')) {
        const o = c.exit === 'withdrew' ? 'withdrew' : 'notfit';
        T(c, d0, { outcome: o, secs: between(r, 60, 240),
          note: o === 'withdrew' ? 'Accepted another offer.' : 'Cannot work the shifts the role needs.' });
      } else if (!c.exit && c.stage === 'phone' && chance(r, 0.5)) {
        T(c, between(r, -3, -1), { note: 'No answer. Left a voicemail.' });
      }
    });
    const minePeople = (pred) => DB.cands.filter((c) => !c.exit && DB.reqById[c.req].rec === ME &&
      !CLOSED[DB.reqById[c.req].state] && DB.reqById[c.req].state !== 'hold' && pred(c));
    minePeople((c) => c.stage === 'phone').slice(0, 2).forEach((c, i) => {
      T(c, -1, { outcome: 'callback', secs: 40, time: i ? '16:00' : '13:30', note: 'Asked to be called back today after six.' });
      c.callback = 0; c.fate = c.fate === 'german' ? 'german' : 'pass';
    });
    minePeople((c) => c.stage === 'hr' || c.stage === 'tech').slice(0, 2).forEach((c, i) => {
      T(c, 0, { outcome: 'reached', secs: between(r, 90, 200), time: i ? '10:25' : '09:40', note: 'Confirmed the interview time.' });
    });
    minePeople((c) => c.stage === 'applied').slice(0, 1).forEach((c) => {
      T(c, 0, { outcome: 'noanswer', secs: 0, time: '11:15', note: 'No answer. Left a voicemail.' });
    });
    minePeople((c) => c.stage === 'applied' || c.stage === 'phone').slice(2, 5).forEach((c, i) => {
      /* Two of them left a message, which plays back from the log (Sales). */
      T(c, i ? -1 : 0, Object.assign({ dir: 'in', missed: true, outcome: 'noanswer', time: i === 0 ? '12:05' : i === 1 ? '17:20' : '15:10', note: 'They called. Nobody picked up.' },
        i === 1 ? {} : { vm: { secs: i ? 24 : 19, text: 'Hi, it is ' + c.name.split(' ')[0] + ', calling about the ' + DB.reqById[c.req].title + ' role. ' +
          (i ? 'I have another offer to answer by Thursday, so I would like to know where I stand.' : 'I am free after four today. Thank you.') } }));
    });

    seedPeople(r);
    seedWork(r);
    seedLoop();
  }

  /* ── People, not just applications ──────────────────────────────────────
     A candidate record here is one application to one requisition. The
     person behind it (`pid`) can hold several: the New Operations list asks
     for "positions they applied to", and rediscovery is someone who left one
     requisition turning up on another. About one in eighteen does. */
  const SKILLS = {
    support: ['Zendesk', 'Freshdesk', 'SQL', 'Jira', 'Log reading', 'Customer calls', 'Written English', 'REST APIs'],
    finance: ['NetSuite', 'Oracle', 'Excel', 'Reconciliations', 'Collections', 'Month-end close', 'IFRS basics'],
    ops:     ['Process mapping', 'Excel', 'Power BI', 'Jira', 'Documentation', 'Stakeholder updates'],
  };
  function seedPeople(r) {
    DB.cands.forEach((c) => {
      const q = DB.reqById[c.req];
      c.pid = c.id;
      c.contactOk = c.source !== 'Found on the web';
      c.email = c.name.toLowerCase().replace(/[^a-z ]/g, '').split(' ').join('.') + '@' + pick(r, ['gmail.com', 'outlook.com', 'yahoo.com']);
      const pool = SKILLS[q.fam];
      c.skills = pool.filter(() => chance(r, 0.5)).slice(0, 5);
      if (!c.skills.length) c.skills = [pool[0]];
      c.summary = c.years + ' years, now ' + lower(c.at) + '. Strongest in ' + c.skills.slice(0, 2).join(' and ') + '.';
      c.applied = q.opened + between(r, 1, Math.max(2, -q.opened - 1));
      if (c.applied > -1) c.applied = -1;
    });
    /* Rediscovery: people who left a closed requisition, back on an open
       one of the same family, at the start of it. */
    const openReqs = DB.reqs.filter((q) => q.state === 'open');
    const left = DB.cands.filter((c) => c.exit === 'out' || c.exit === 'clientno');
    left.forEach((c) => {
      if (!chance(r, 0.055)) return;
      const q0 = DB.reqById[c.req];
      const to = openReqs.filter((q) => q.fam === q0.fam && q.id !== q0.id)[0];
      if (!to) return;
      const id = 'k' + (DB.cands.length + 1) + 'r';
      const k = Object.assign({}, c, {
        id: id, req: to.id, stage: chance(r, 0.5) ? 'sourced' : 'applied', exit: null, since: between(r, 0, 4),
        meet: null, fb: false, nudged: null, maxAt: null, callback: null, source: 'From the talent pool',
        ev: to.must.map((m, i) => c.ev[i] || 'p'), applied: -between(r, 1, 6),
      });
      k.maxAt = k.stage;
      DB.cands.push(k); DB.byId[id] = k; DB.byReq[to.id].push(k);
    });
    DB.cands.forEach((c) => {
      if (c.exit !== 'out') return;
      const n = parseInt(c.id.slice(1), 10) || 0;
      const why = c.stage === 'sourced' || c.stage === 'applied' ? ['reach', 'salary'][n % 2]
        : c.stage === 'phone' || c.stage === 'assess' ? ['lang', 'salary', 'notice', 'must'][n % 4] : ['iv', 'must'][n % 2];
      c.outWhy = { why: why, note: '', day: -c.since, by: DB.reqById[c.req].rec };
    });
  }

  /* ── Interviews, assessment results and offers, consistent with where each
     person stands ── */
  const IV_NOTE = {
    m: ['Gave a clear example from their current job.', 'Answered with numbers and a real case.', 'Strong, and could explain why.'],
    p: ['Knows the idea, has not owned it yet.', 'Did it once with help.', 'Partly there; would need support.'],
    n: ['Could not give an example.', 'Has not done this.', 'Did not come up, and they had nothing to add when asked.'],
  };
  function interviewerFor(q, stage) {
    if (stage === 'hr') return DESKS.omar.name + ', recruiter';
    if (stage === 'tech') return INTERVIEWERS[q.fam][0];
    if (stage === 'mgr') return (HMS.filter((h) => h.id === q.hm)[0] || {}).name + ', hiring manager';
    if (q.acc === 'northwind') return stage === 'ctech' ? 'Lukas Brandt, Northwind engineering' : 'Jana Weber, Northwind';
    return 'The client’s panel';
  }
  function seedWork(r) {
    DB.ivs = []; DB.sends = []; DB.offers = []; DB.events = [];
    DB.asmts = ASMT_SEED.map((a) => JSON.parse(JSON.stringify(a)));
    DB.ivtpls = IVTPL_SEED.map((t) => JSON.parse(JSON.stringify(t)));
    let ivn = 0, sn = 0, on = 0;
    const rate = (bias) => { const x = r() + bias; return x > 0.7 ? 'm' : x > 0.4 ? 'p' : 'n'; };
    DB.reqs.forEach((q) => {
      if (q.tpl === 'northwind') q.asmt = q.title.indexOf('German') >= 0 ? 'a2' : q.fam === 'finance' ? 'a3' : q.fam === 'ops' ? 'a4' : 'a1';
    });
    DB.cands.forEach((c) => {
      const q = DB.reqById[c.req], t = TEMPLATE[q.tpl];
      const at = t.indexOf(c.stage);
      t.forEach((s, i) => {
        if (!MEETS[s] || i > at) return;
        const current = i === at && !c.exit;
        const leftHere = i === at && !!c.exit;
        let status = 'done', day = Math.min(-1, c.applied + 2 + i * 3);
        if (current) {
          if (c.meet == null) return;
          day = c.meet;
          status = c.meet >= 0 ? 'booked' : c.fb ? 'done' : 'owed';
        }
        const verdict = status !== 'done' ? null : leftHere ? 'no' : 'yes';
        const bias = verdict === 'no' ? -0.25 : 0.25;
        const iv = { id: 'iv' + (++ivn), cand: c.id, stage: s, day: day, slot: c.slot || pick(r, ['10:00', '11:00', '12:30', '14:00']),
          by: interviewerFor(q, s), mode: s === 'hr' && chance(r, 0.15) ? 'aimy' : 'person', status: status,
          ratings: status === 'done' ? q.must.map(() => rate(bias)) : null, notes: null, verdict: verdict, recording: null,
          tpl: (IVTPL_SEED.filter((x) => x.kind === s)[0] || {}).id };
        if (iv.ratings) iv.notes = iv.ratings.map((x) => pick(r, IV_NOTE[x]));
        if (status === 'done' && chance(r, 0.4)) iv.recording = { mins: between(r, 22, 48), at: day };
        DB.ivs.push(iv);
      });
      /* Assessment results, on the template that tests. */
      if (q.asmt && t.indexOf('assess') >= 0) {
        const ai = t.indexOf('assess');
        const reached = c.exit ? t.indexOf(c.stage) >= ai : at >= ai;
        if (reached) {
          const a = ASMT_SEED.filter((x) => x.id === q.asmt)[0];
          const pending = !c.exit && c.stage === 'assess' && chance(r, 0.5);
          const answers = a.questions.map((qq) => !chance(r, qq.fails * (at > ai ? 0.7 : 1.1)));
          const score = Math.round(answers.filter(Boolean).length / answers.length * 100);
          DB.sends.push({ id: 's' + (++sn), asmt: a.id, cand: c.id, day: Math.min(-1, c.applied + 1), status: pending ? 'sent' : 'done',
            answers: pending ? null : answers, score: pending ? null : score, doneDay: pending ? null : Math.min(-1, c.applied + 2) });
        }
      }
      /* Offers. Dated inside the requisition's life: an offer goes out a week
         or more after it opens, and a joined hire starts after their offer.
         The same draws as before, clamped, so the rest of the corpus holds. */
      const oi = t.indexOf('offer');
      const inLife = (d) => Math.min(-1, Math.max(q.opened + 7, d));
      if (at >= oi || c.exit === 'offerno') {
        const lo = q.budget ? q.budget.min : 20000, hi = q.budget ? q.budget.max : 30000;
        const salary = Math.round((lo + (hi - lo) * (0.35 + r() * 0.5)) / 500) * 500;
        const offer = { id: 'o' + (++on), cand: c.id, salary: salary, notice: c.notice || 'one month’s notice',
          expects: c.salary || null, hm: 'ok', bu: 'ok', sentDay: null, status: 'draft', joinDay: null, note: null };
        if (c.exit === 'offerno') Object.assign(offer, { status: 'declined', sentDay: inLife(-between(r, 5, 20)), note: 'Took a counter-offer from their current employer.' });
        else if (c.stage === 'offer') {
          if (chance(r, 0.5)) Object.assign(offer, { hm: chance(r, 0.5) ? 'ok' : 'waiting', bu: 'waiting', status: 'approving' });
          else Object.assign(offer, { status: 'sent', sentDay: -c.since });
        } else if (c.stage === 'accepted') Object.assign(offer, { status: 'accepted', sentDay: inLife(-between(r, 10, 30)), joinDay: between(r, 3, 35) });
        else if (c.stage === 'joined') {
          const sd = inLife(-between(r, 40, 80));
          Object.assign(offer, { status: 'joined', sentDay: sd, joinDay: Math.min(-1, Math.max(sd + 14, -between(r, 5, 30))) });
        }
        DB.offers.push(offer);
      }
    });
  }

  /* ── The loop's own records (UI/UX plan, waves 1 to 3) ── drawn from a
     second seed, so the corpus above draws exactly what it always drew and
     every count the README quotes still holds. */
  function seedLoop() {
    const r = rng(20261027);
    DB.props = [];
    /* Why each client decline happened. Northwind's German roles fail on
       spoken German more than anything else, the story reason codes exist
       to tell; everywhere else experience and skills lead. */
    const WHY = {
      german: ['lang', 'lang', 'lang', 'lang', 'exp', 'notice'],
      northwind: ['lang', 'lang', 'exp', 'skills', 'skills', 'salary', 'notice'],
      other: ['exp', 'exp', 'skills', 'skills', 'salary', 'notice', 'other'],
    };
    const OTHER_NOTE = ['They filled it internally.', 'Wanted someone already in Munich.', 'Asked for a different shift pattern.'];
    DB.cands.forEach((c) => {
      const q = DB.reqById[c.req], t = TEMPLATE[q.tpl];
      /* Consent, as people gave it. Applying through the link offers the
         optional WhatsApp box; a referral may opt in on the first call. */
      c.wa = (c.source === 'Applied through the link' && chance(r, 0.45)) || (c.source === 'Referred by a colleague' && chance(r, 0.3));
      c.waDay = c.wa ? Math.min(-1, (c.applied || -3) + (c.source === 'Referred by a colleague' ? 2 : 0)) : null;
      /* Told, or still owed an answer. */
      c.told = NEEDS_TELLING[c.exit] ? c.since > TELL_DAYS + 1 : null;
      /* The sendout, as its own record: sent, opened, decided. */
      const si = t.indexOf('sent');
      if (si < 0 || t.indexOf(c.maxAt) < si) return;
      if (c.stage === 'sent' && !c.exit) {
        c.sentDay = -c.since;
        c.openDay = c.since >= 2 && chance(r, 0.6) ? c.sentDay + 1 : null;
        c.decideDay = null;
      } else if (c.stage === 'sent' && c.exit === 'clientno') {
        c.decideDay = -c.since;
        c.sentDay = c.decideDay - between(r, 2, 6);
        c.openDay = c.sentDay + 1;
      } else {
        const iv = DB.ivs.filter((v) => v.cand === c.id && v.stage === 'client')[0];
        c.sentDay = Math.min(-2, (iv ? iv.day : -c.since - 8) - between(r, 3, 6));
        c.openDay = c.sentDay + 1;
        c.decideDay = Math.min(-1, c.sentDay + between(r, 1, 3));
      }
      if (c.exit === 'clientno') {
        const bag = q.title.indexOf('German') >= 0 ? WHY.german : q.acc === 'northwind' ? WHY.northwind : WHY.other;
        const why = pick(r, bag);
        c.decline = { why: why, note: why === 'other' ? pick(r, OTHER_NOTE) : '', day: -c.since, by: q.acc === 'northwind' ? 'jana' : null };
      }
    });
    /* One question already carries a history: the SQL question was free
       text once, and most people missed it for the wording. */
    const sql = DB.asmts.filter((a) => a.id === 'a1')[0].questions[1];
    sql.versions = [{ v: 1, q: 'Write the SQL that returns the latest ten errors from the logs table.', day: -41, by: 'dina',
      why: '68% got it wrong as free text. Made it a choice, same skill.' }];
    /* Hires from before this corpus, so retention and the day-90 sample
       have something to count. The first twelve joined after AiMY began
       recording check-ins; the rest come from the HR system as stayed or
       left, with no structured check-in behind them. */
    const accBag = [];
    ACCOUNTS.forEach((a) => { for (let i = 0; i < a.weight; i++) accBag.push(a.id); });
    const LEFT = ['Left for a higher salary elsewhere', 'Did not pass probation', 'Moved abroad', 'The client ended the project'];
    const SAID30 = ['Settling in well', 'Settling in well', 'Settling in well', 'Some concerns about the shift pattern', 'Wants more training on the tools'];
    DB.past = [];
    for (let i = 0; i < 28; i++) {
      const accId = pick(r, accBag);
      const acc = ACCOUNTS.filter((a) => a.id === accId)[0];
      const role = pick(r, ROLES);
      const stayed = chance(r, 0.84);
      DB.past.push({ id: 'p' + (i + 1), name: pick(r, chance(r, 0.5) ? WOMEN : MEN) + ' ' + pick(r, LAST), acc: acc.id, title: role.title,
        billable: acc.id !== 'flairs', join: i < 12 ? -between(r, 95, 190) : -between(r, 200, 360), recorded: i < 12,
        d30: i < 12 ? pick(r, SAID30) : null, stayed: stayed, why: stayed ? null : pick(r, LEFT) });
    }
    /* ONE PACKET WAITS ON THE BU DIRECTOR, so that desk opens on its one
       question. The hiring manager has said yes on fit and salary; the seat
       and the money are still open. Taken from another recruiter's client
       interview, so Omar's scripted day is untouched, and drawn after every
       use of `r`, so the rest of the seed is unchanged. */
    if (!DB.offers.some((o) => o.status === 'approving')) {
      const c = DB.cands.filter((x) => !x.exit && x.stage === 'client' && DB.reqById[x.req].rec !== ME)[0];
      if (c) {
        const q = DB.reqById[c.req], lo = q.budget ? q.budget.min : 20000, hi = q.budget ? q.budget.max : 30000;
        Object.assign(c, { stage: 'offer', since: 1, maxAt: 'offer', meet: null, fb: false });
        DB.offers.push({ id: 'obu1', cand: c.id, salary: Math.round((lo + (hi - lo) * 0.6) / 500) * 500, notice: c.notice || 'one month’s notice',
          expects: c.salary || null, hm: 'ok', bu: 'waiting', sentDay: null, status: 'approving', joinDay: null, note: null });
      }
    }
  }


  /* ══ 4. THE STORE ═══════════════════════════════════════════════════════
     The delta, never the corpus. `D.c[id]` holds the fields a person changed
     on one candidate; `D.log` is the record of moves, newest last. */
  const KEY = 'aimy-talent:db:v1';
  /* `calls` are the calls you logged, appended to the seed's history.
     `added` are candidates a call brought in (a stranger who rang). */
  /* `auto` holds the rung a person set for each of AiMY's actions, and
     `autoLog` every move up or down the ladder, with AiMY's reason. */
  /* `news` is work coming back to a desk (Sales's bell: a hand-over, an
     assignment, a decision taken somewhere else). `lists` are shortlists a
     person saved from the chat. */
  const fresh = () => ({ c: {}, calls: [], added: [], x: {}, tpl: {}, auto: {}, autoLog: [], news: [], lists: [] });
  /* Every other collection keeps its changes the same way: `D.x[col][id]`
     holds the fields a person changed, and a record made here carries
     `_new` so it is rebuilt on load. `props` are Learning proposals. */
  const COLS = ['reqs', 'ivs', 'sends', 'offers', 'asmts', 'ivtpls', 'events', 'props'];
  let D = fresh();
  function load() {
    try { const s = localStorage.getItem(KEY); if (s) D = JSON.parse(s); } catch (e) { D = fresh(); }
    if (!D || !D.c) D = fresh();
    D.calls = D.calls || []; D.added = D.added || []; D.gone = D.gone || [];
    D.added.forEach((c) => { if (!DB.byId[c.id] && DB.byReq[c.req]) { DB.cands.push(c); DB.byId[c.id] = c; DB.byReq[c.req].push(c); } });
    /* Deleted at their request: gone from the record on every load. */
    D.gone.forEach((g) => { const c = DB.byId[g.id]; if (c) { DB.cands = DB.cands.filter((x) => x.id !== c.id); DB.byReq[c.req] = DB.byReq[c.req].filter((x) => x.id !== c.id); delete DB.byId[c.id]; } });
    D.x = D.x || {}; D.tpl = D.tpl || {}; D.auto = D.auto || {}; D.autoLog = D.autoLog || [];
    D.news = D.news || []; D.lists = D.lists || [];
    Object.keys(D.tpl).forEach((k) => { TEMPLATE[k] = D.tpl[k].slice(); });
    COLS.forEach((col) => {
      const m = D.x[col] || {};
      Object.keys(m).forEach((id) => {
        const f = m[id];
        let rec = DB[col].filter((x) => x.id === id)[0];
        if (rec) { Object.assign(rec, f); return; }
        if (!f._new) return;
        rec = JSON.parse(JSON.stringify(f));
        DB[col].push(rec);
        if (col === 'reqs') { DB.reqById[id] = rec; DB.byReq[id] = DB.byReq[id] || []; }
      });
    });
    D.added.forEach((c) => { if (!DB.byId[c.id] && DB.byReq[c.req]) { DB.cands.push(c); DB.byId[c.id] = c; DB.byReq[c.req].push(c); } });
    Object.keys(D.c).forEach((id) => { if (DB.byId[id]) Object.assign(DB.byId[id], D.c[id]); });
    D.calls.forEach((t) => DB.calls.push(t));
  }
  function put(col, rec, fields) {
    D.x[col] = D.x[col] || {};
    D.x[col][rec.id] = Object.assign(D.x[col][rec.id] || {}, JSON.parse(JSON.stringify(fields)));
    Object.assign(rec, fields);
    save();
  }
  function make(col, rec) {
    rec._new = true;
    DB[col].push(rec);
    if (col === 'reqs') { DB.reqById[rec.id] = rec; DB.byReq[rec.id] = DB.byReq[rec.id] || []; }
    D.x[col] = D.x[col] || {};
    D.x[col][rec.id] = JSON.parse(JSON.stringify(rec));
    save();
    return rec;
  }
  function unmake(col, rec) {
    DB[col] = DB[col].filter((x) => x !== rec);
    if (col === 'reqs') { delete DB.reqById[rec.id]; delete DB.byReq[rec.id]; }
    if (D.x[col]) delete D.x[col][rec.id];
    save();
  }
  const uid = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const nowTime = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  /* Something a person did, on the candidate's history, and its undo. */
  function note(c, kind, text, extra) {
    return make('events', Object.assign({ id: uid('e'), cand: c.id, day: 0, time: nowTime(), kind: kind, text: text, by: DESK }, extra || {}));
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }
  /* WORK COMES BACK (Sales: "follow-ups come back in the bell"). A review of
     Sales's desks found work that left a desk never returned; here a
     decision taken on another desk lands in the bell of the desk it is for,
     and an Undo takes the news back with the change. */
  function tellDesk(to, n) {
    const x = Object.assign({ id: uid('n'), to: to, day: 0, time: nowTime(), sev: 'p2', read: false }, n);
    D.news.push(x);
    save();
    return x;
  }
  function untell(x) { if (!x) return; D.news = D.news.filter((n) => n.id !== x.id); save(); }
  function write(c, fields) {
    D.c[c.id] = Object.assign(D.c[c.id] || {}, fields);
    Object.assign(c, fields);
    save();
  }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) {} D = fresh(); seed(); }
  /* A logged call, and the way to take one back (its toast's Undo). */
  function addCall(t) { D.calls.push(t); DB.calls.push(t); save(); }
  function dropCall(id) {
    D.calls = D.calls.filter((t) => t.id !== id);
    DB.calls = DB.calls.filter((t) => t.id !== id);
    save();
  }
  function addCand(c) { D.added.push(c); DB.cands.push(c); DB.byId[c.id] = c; DB.byReq[c.req].push(c); save(); }
  /* ── OBJECT AND BE DELETED (R8, Egypt Law 151) ── a prospect found on the
     web who objects, by the link in the first email or by replying, is
     deleted in one press, by them or by the recruiter on their word. The
     record goes; one line stays (name, where they were found, when), so a
     later search leaves them out and nobody contacts them again. Undo puts
     it all back, as everywhere. */
  function forget(c, byThem) {
    const keep = { c: c, x: D.c[c.id], added: D.added.some((x) => x.id === c.id) };
    const g = { id: c.id, pid: c.pid, name: c.name, src: c.page ? c.page + ', ' + c.link : c.source, day: 0, by: byThem ? null : DESK };
    dropCand(c);
    D.gone.push(g); save();
    if (!byThem) go(TRAIL && TRAIL.cand !== c.id ? TRAIL : { on: 'cands', q: 'new' }); else paint();
    toast(byThem ? tr('Deleted', 'حُذفت بياناتك') : 'Deleted ' + c.name + ' at their request',
      () => { D.gone = D.gone.filter((x) => x !== g); if (keep.added) addCand(keep.c); else { DB.cands.push(c); DB.byId[c.id] = c; DB.byReq[c.req].push(c); } if (keep.x) D.c[c.id] = keep.x; save(); paint(); },
      byThem ? tr('Nobody from FlairsTech will contact you again.', 'لن يتواصل معك أحد من فليرز تك مرة أخرى.') : 'Their record is gone. Their name stays on the do-not-contact line, so no search finds them again.');
  }
  function dropCand(c) {
    if (D.c[c.id]) delete D.c[c.id];
    D.added = D.added.filter((x) => x.id !== c.id);
    DB.cands = DB.cands.filter((x) => x.id !== c.id);
    DB.byReq[c.req] = DB.byReq[c.req].filter((x) => x.id !== c.id);
    delete DB.byId[c.id];
    save();
  }


  /* ══ 5. DERIVATIONS ═════════════════════════════════════════════════════
     Every figure on every surface is worked out here, once, from the stage
     fields. A surface never re-derives a count (Sales's one-definition rule:
     the dashboard's two hire counts disagreeing is what that rule prevents). */

  const accOf = (q) => ACCOUNTS.filter((a) => a.id === q.acc)[0];
  const hmOf = (q) => HMS.filter((h) => h.id === q.hm)[0];
  const tplOf = (q) => TEMPLATE[q.tpl];
  const reqOf = (c) => DB.reqById[c.req];
  const rank = (q, k) => tplOf(q).indexOf(k);
  const isOpen = (q) => !CLOSED[q.state] && q.state !== 'hold' && q.state !== 'draft';

  /* ── The desk you are looking from (Sales's DESKS and `?as=`) ── */
  let DESK = 'omar';
  const me = () => DESKS[DESK];
  const isRec = () => me().fn === 'rec';
  const isHM = () => me().fn === 'hm';
  const isHR = () => me().fn === 'hr';
  const isClient = () => me().fn === 'client';
  const isBU = () => me().fn === 'bu';
  /* WHOSE REQUISITIONS. The recruiter's are the ones they fill, the hiring
     manager's the ones they asked for, the client's the ones for their
     company, and the HR Manager reads all of them. */
  function deskReqs() {
    const d = me();
    if (d.fn === 'rec') return DB.reqs.filter((q) => q.rec === d.id);
    if (d.fn === 'hm') return DB.reqs.filter((q) => q.hm === d.id);
    if (d.fn === 'client') return DB.reqs.filter((q) => q.acc === d.acc && q.state !== 'draft');
    if (d.fn === 'bu') return DB.reqs.filter((q) => q.state !== 'draft');
    return DB.reqs;
  }
  const mine = () => deskReqs();
  /* WHO A DESK SEES. The hiring manager sees candidates once the recruiter
     has advanced them to the technical round, and the rest as a count; the
     client sees only the profiles sent to them (overview, "visibility
     boundaries"). */
  function sees(c) {
    if (isRec() || isHR()) return true;
    const q = DB.reqById[c.req], t = TEMPLATE[q.tpl];
    const reached = t.indexOf(c.maxAt || c.stage);
    if (isHM() || isBU()) return reached >= t.indexOf('tech');
    if (isClient()) return q.acc === me().acc && t.indexOf('sent') >= 0 && reached >= t.indexOf('sent') && c.exit !== 'out';
    return false;
  }
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
    if (c.stage === 'assess') { const s = sendOf(c); return s && s.status === 'done' ? 'me' : 'candidate'; }
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
      else if (c.stage === 'assess' && sendOf(c) && sendOf(c).status === 'done') out.push(c);
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
    if (TEMPLATE[q.tpl].indexOf('sent') < 0) return null;
    const sent = DB.byReq[q.id].filter((c) => rank(q, c.maxAt) >= rank(q, 'sent'));
    if (!sent.length) return null;
    return Math.max(3, Math.round(-q.opened * 0.45));
  }
  /* Open, sending to a client, and nobody sent yet this long after opening:
     the requisitions the reports' one action opens (P2). */
  const NOSEND_DAYS = 10;
  /* Profiles per client interview against the agency rule of thumb of 3 to
     5 (R2), said as what it is, whichever side of the range it falls. */
  const versusNorm = (x) => x == null ? 'No client has met anyone yet.'
    : x < 3 ? 'Agencies usually need 3 to 5, so clients here take more of what is sent than usual.'
    : x <= 5 ? 'Agencies usually need 3 to 5, so this is inside the usual range.'
    : 'Agencies usually need 3 to 5, so clients here pass on more than usual; their reasons say why.';
  const noSend = (q) => isOpen(q) && TEMPLATE[q.tpl].indexOf('sent') >= 0 && q.opened <= -NOSEND_DAYS &&
    !DB.byReq[q.id].some((c) => rank(q, c.maxAt) >= rank(q, 'sent'));
  function avgSent(list) {
    const v = list.map(sentDays).filter((x) => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  }

  /* Evidence, said as counts — "3 of 4 must-haves met". The audit's
     recommendation for decision 2, pending the manager: a score that is its
     own explanation, never a percentage. */
  const evMet = (c) => c.ev.filter((e) => e === 'm').length;
  /* UNKNOWN IS SAID AS UNKNOWN (UI/UX plan; people follow an AI's pick
     about nine times in ten, even when it is wrong). A must-have the CV is
     silent on is not a must-have missed, so "0 of 4 met" was a rejection
     the CV never made. With nothing met yet, the sentence leads with what
     the CV does not say. */
  const evSay = (c) => {
    const all = c.ev.length, met = evMet(c);
    const part = c.ev.filter((e) => e === 'p').length, unk = c.ev.filter((e) => e === 'n').length;
    if (!met && unk) return 'The CV is silent on <b>' + unk + ' of ' + all + '</b> must-haves' + (part ? ', and partly shows ' + part : '') + '. Not known yet, not missing';
    return '<b>' + met + ' of ' + all + '</b> must-haves met' + (part ? ', ' + part + ' partly' : '') + (unk ? ', ' + unk + ' not known yet' : '');
  };

  /* ── The loop, derived (UI/UX plan) ── */
  const nth = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
  const reached = (c, k) => { const q = reqOf(c); return rank(q, k) >= 0 && rank(q, c.maxAt) >= rank(q, k); };
  /* Client declines that carry a reason, newest first. */
  const declines = (reqs) => reqs.reduce((l, q) => l.concat(DB.byReq[q.id].filter((c) => c.exit === 'clientno' && c.decline)), [])
    .sort((a, b) => b.decline.day - a.decline.day);
  /* The reasons counted, most first; a reason nobody gave is left out. */
  const declineCounts = (list) => DECLINE.map((d) => ({ d: d, n: list.filter((c) => c.decline.why === d.k).length }))
    .filter((x) => x.n).sort((a, b) => b.n - a.n);
  const accDeclines = (accId, within) => declines(DB.reqs.filter((q) => q.acc === accId)).filter((c) => c.decline.day >= -(within || MONTH));
  /* What a reason feeds, said once, as AiMY says it when a Pass lands. */
  function declineFeeds(c) {
    const q = reqOf(c), a = accOf(q);
    const n = accDeclines(q.acc).filter((x) => x.decline.why === c.decline.why).length;
    return nth(n) + ' decline at ' + a.name + ' this month for ' + lower(DECLINE_K[c.decline.why].label) + '. It feeds matching for ' + a.name + ' only.';
  }
  /* A reason that keeps coming back becomes a Learning proposal the HR
     Manager approves: at least five declines in 90 days at one account, and
     one reason behind at least three of them and a third of the whole.
     "Other" never proposes anything; it is not a rule. */
  const PROPOSE = {
    lang: (a) => 'Check spoken language on the phone screen before a profile goes to ' + a + '.',
    exp: (a) => 'Weight years in the same kind of role higher for ' + a + '.',
    skills: (a) => 'Ask for a short work sample on the must-have skills before sending to ' + a + '.',
    salary: (a) => 'Check the salary expectation against ' + a + '’s range before a profile goes.',
    notice: (a) => 'Prefer people on one month’s notice or less for ' + a + '.',
  };
  function declineProposals() {
    const out = [];
    ACCOUNTS.forEach((a) => {
      const list = accDeclines(a.id, 90);
      const top = declineCounts(list)[0];
      if (list.length < 5 || !top || top.n < 3 || top.n * 3 < list.length || !PROPOSE[top.d.k]) return;
      const rec = DB.props.filter((p) => p.kind === 'decline' && p.acc === a.id && p.why === top.d.k)[0];
      out.push({ kind: 'decline', acc: a.id, why: top.d.k, n: top.n, of: list.length, rule: PROPOSE[top.d.k](a.name), rec: rec || null });
    });
    return out;
  }
  /* The rule in force for an account, once a person approved it. */
  const accRule = (accId) => DB.props.filter((p) => p.kind === 'decline' && p.acc === accId && p.state === 'approved')[0] || null;

  /* Hiring outcomes for one account (M10): billed hires never shown alone,
     always beside how many profiles met the team and who stayed to day 90. */
  function outcomes(accId) {
    const reqs = DB.reqs.filter((q) => q.acc === accId && q.state !== 'draft');
    const cands = reqs.reduce((l, q) => l.concat(DB.byReq[q.id]), []);
    const sent = cands.filter((c) => reached(c, 'sent') && !(c.stage === 'sent' && !c.exit));
    const met = sent.filter((c) => reached(c, 'client'));
    const ivs = DB.ivs.filter((v) => (v.stage === 'client' || v.stage === 'ctech') && v.status === 'done' && DB.byId[v.cand] && reqs.indexOf(reqOf(DB.byId[v.cand])) >= 0);
    const hired = cands.filter((c) => !c.exit && (c.stage === 'joined' || c.stage === 'accepted') && reqOf(c).billable);
    const past = DB.past.filter((p) => p.acc === accId);
    return { sent: sent.length, met: met.length, ivs: ivs.length, yes: ivs.filter((v) => v.verdict === 'yes').length,
      billed: hired.length + past.filter((p) => p.billable).length, past: past.length, stayed: past.filter((p) => p.stayed).length };
  }

  /* THE MINIMUM SAMPLE (P7). No Learning proposal is drawn from check-ins
     until this many day-90 check-ins are recorded: about 21 hires in two
     months means a pattern needs months, not weeks. */
  const GATE = 20;
  const checkins = () => DB.past.filter((p) => p.recorded).length + DB.cands.filter((c) => c.d90).length;

  /* Owed an answer (M4): marked not progressing, or declined by the client,
     on this desk's requisitions, and not told yet. Longest waiting first. */
  const untold = () => mine().reduce((l, q) => l.concat(DB.byReq[q.id].filter((c) => NEEDS_TELLING[c.exit] && c.told === false)), [])
    .sort((a, b) => b.since - a.since);
  /* The date a candidate is promised an answer by, in days from today. */
  const hearBy = (c) => NEEDS_TELLING[c.exit] ? Math.max(1, TELL_DAYS - c.since) : Math.max(1, STAGE[c.stage].exp - c.since + 2);

  /* Where AiMY stands on the ladder for one action. */
  const autoAt = (k) => D.auto[k] || AUTO_SEED.filter((a) => a.k === k)[0].at;


  /* ── Interviews, assessments, offers, derived ── */
  const ivsOf = (c) => DB.ivs.filter((v) => v.cand === c.id).sort((a, b) => b.day - a.day);
  const ivNow = (c) => DB.ivs.filter((v) => v.cand === c.id && v.stage === c.stage)[0] || null;
  const sendOf = (c) => DB.sends.filter((x) => x.cand === c.id).sort((a, b) => b.day - a.day)[0] || null;
  const asmtOf = (id) => DB.asmts.filter((a) => a.id === id)[0] || null;
  const offerOf = (c) => DB.offers.filter((o) => o.cand === c.id)[0] || null;
  const apps = (c) => DB.cands.filter((x) => x.pid === (c.pid || c.id));
  const tplById = (id) => DB.ivtpls.filter((t) => t.id === id)[0] || null;
  const tplFor = (stage) => DB.ivtpls.filter((t) => t.kind === stage)[0] || null;

  /* WHAT IS VERIFIED, PER MUST-HAVE (New Operations list: "validation on
     the skills and experience based on the communication history"). The CV
     says one thing; each interview that rated it says another. Where they
     disagree it is said plainly, "CV says" next to "Interview found", never
     as a warning about the person. */
  function verified(c) {
    const q = reqOf(c);
    const done = ivsOf(c).filter((v) => v.status === 'done' && v.ratings);
    return q.must.map((m, i) => {
      /* The deepest interview that rated it speaks first: a technical
         interview outranks the HR screen on a technical must-have. */
      const seen = done.filter((v) => v.ratings[i]).map((v) => ({ r: v.ratings[i], by: v.by, note: v.notes ? v.notes[i] : '', stage: v.stage, day: v.day }))
        .sort((a, b) => rank(q, b.stage) - rank(q, a.stage));
      const best = seen[0] || null;
      const cv = c.ev[i];
      const state = !best ? 'unproven' : best.r === 'm' ? 'verified' : cv === 'm' ? 'differs' : best.r === 'p' ? 'partly' : 'notshown';
      return { must: m, cv: cv, seen: seen, state: state };
    });
  }

  /* EVERYTHING THAT HAPPENED TO ONE APPLICATION, newest first: applying,
     calls, assessments, interviews, offers, and what people did and wrote. */
  function historyOf(c) {
    const out = [];
    const q = reqOf(c);
    out.push({ day: c.applied != null ? c.applied : -3, time: '09:00', kind: 'apply',
      text: (c.source === 'Applied through the link' ? 'Applied through the careers link' : c.source) + ' for ' + q.title + '.' });
    callsOf(c.id).forEach((t) => out.push({ day: t.day, time: t.time, kind: 'call',
      text: t.missed ? 'Called and got nobody.' : (t.dir === 'in' ? 'Called in: ' : 'Phone call: ') + OUTCOME[t.outcome].label + '. ' + (t.note || '') }));
    DB.sends.filter((x) => x.cand === c.id).forEach((x) => {
      const a = asmtOf(x.asmt);
      out.push({ day: x.day, time: '10:00', kind: 'asmt', text: 'Sent the ' + a.title + ' assessment.' });
      if (x.status === 'done') out.push({ day: x.doneDay != null ? x.doneDay : x.day, time: '18:00', kind: 'asmt',
        text: 'Finished the assessment: ' + x.score + '%' + (x.score >= a.pass ? ', a pass.' : ', under the ' + a.pass + '% pass mark.') });
    });
    ivsOf(c).forEach((v) => out.push({ day: v.day, time: v.slot, kind: 'iv', text: STAGE[v.stage].label + ' with ' + v.by +
      (v.status === 'booked' ? ' is booked.' : v.status === 'owed' ? '. The result is still owed.' : v.verdict === 'yes' ? '. Result: proceed.' : '. Result: do not proceed.') +
      (v.recording ? ' Recorded, ' + v.recording.mins + ' minutes, transcribed.' : '') }));
    const o = offerOf(c);
    if (o && o.sentDay != null) out.push({ day: o.sentDay, time: '16:00', kind: 'offer', text: 'Offer sent: EGP ' + o.salary.toLocaleString('en-US') + ' a month.' });
    if (o && o.status === 'accepted') out.push({ day: Math.min(0, o.sentDay + 2), time: '12:00', kind: 'offer', text: 'Accepted the offer. Joins ' + sayDay(o.joinDay) + '.' });
    if (o && o.status === 'declined') out.push({ day: Math.min(0, o.sentDay + 2), time: '12:00', kind: 'offer', text: 'Declined the offer. ' + (o.note || '') });
    DB.events.filter((e) => e.cand === c.id).forEach((e) => out.push({ day: e.day, time: e.time, kind: e.kind, text: e.text, by: e.by }));
    return out.sort((a, b) => b.day - a.day || String(b.time).localeCompare(String(a.time)));
  }

  /* ── Calls, derived ── newest first. A day is an offset from today; within
     a day, the clock. */
  const callKey = (t) => t.day * 10000 + Number(String(t.time).replace(':', ''));
  const callsOf = (id) => DB.calls.filter((t) => t.cand === id).sort((a, b) => callKey(b) - callKey(a));
  const lastCall = (c) => callsOf(c.id)[0] || null;
  const canCall = (c) => !!c && !c.dnc && !c.badNumber && !!c.phone;
  const myCalls = () => DB.calls.filter((t) => t.by === ME).sort((a, b) => callKey(b) - callKey(a));

  /* WHO TO CALL. Callbacks someone asked for come first, then the phone
     screens that are due, longest waiting first, then the people who
     applied and have not been called yet. Nobody who asked not to be called,
     and nobody whose number did not work. */
  function toCall() {
    const out = [];
    myOpen().forEach((q) => activeOf(q).forEach((c) => {
      if (!canCall(c)) return;
      if (c.callback != null && c.callback <= 0) out.push({ c: c, why: 'callback', rank: 0 });
      else if (c.stage === 'phone') out.push({ c: c, why: 'screen', rank: 1 });
      else if (c.stage === 'applied') out.push({ c: c, why: 'applied', rank: 2 });
    }));
    return out.sort((a, b) => a.rank - b.rank || b.c.since - a.c.since);
  }
  /* A missed call is answered by any call with that person after it that
     somebody picked up: you calling back, or them calling again and
     getting you. The same clock minute counts as after. */
  function missed() {
    /* A caller is the candidate when there is one, the number when not. */
    const same = (a, b) => (a.cand ? a.cand === b.cand : !b.cand && a.phone === b.phone);
    return myCalls().filter((t) => t.dir === 'in' && t.missed && (DB.byId[t.cand] || (!t.cand && t.phone)) &&
      !DB.calls.some((x) => x !== t && same(t, x) && !x.missed && callKey(x) >= callKey(t)));
  }
  /* One call, said as a sentence: "they called today at 12:05 and got
     nobody", "last call yesterday at 16:00: no answer". */
  const callSay = (t) => t.dir === 'in' && t.missed ? 'They called ' + callAt(t) + ' and got nobody.'
    : (t.dir === 'in' ? 'They called ' : 'Last call ') + callAt(t) + ': ' + OUTCOME[t.outcome].say + '.';
  const telLine = (id) => TEL_LINES.filter((l) => l.id === id)[0] || null;
  const candByPhone = (num) => {
    const d = String(num || '').replace(/\D/g, '');
    if (d.length < 7) return null;
    return DB.cands.filter((c) => c.phone && (c.phone.replace(/\D/g, '').slice(-9) === d.slice(-9)))[0] || null;
  };
  const fmtClock = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const callAt = (t) => (t.day === 0 ? 'today' : t.day === -1 ? 'yesterday' : sayDay(t.day)) + ' at ' + t.time;


  /* ══ 6. THE URL ═════════════════════════════════════════════════════════
     Every view is a URL, so every view can be sent and Back works. */
  let S = {};
  /* `as` is the desk (Sales's `?as=`). `apply`, `me`, `take`, `debrief` and
     `approve` are the screens people outside the recruiting team reach from a
     link: the careers page, a candidate's own profile, an assessment, an
     interviewer's debrief and an approver's offer packet. */
  const KEYS = ['as', 'on', 'req', 'cand', 'asmt', 'acc', 'q', 'p', 'list', 'find', 'edit', 'apply', 'me', 'take', 'debrief', 'approve', 'by', 'src', 'period', 'account', 'rq'];
  const OUTSIDE = ['apply', 'me', 'take', 'debrief', 'approve'];
  const outside = () => OUTSIDE.some((k) => !!S[k]);
  function parse() {
    const p = new URLSearchParams(location.search);
    S = {};
    KEYS.forEach((k) => { if (p.get(k)) S[k] = p.get(k); });
    if (S.req && !DB.reqById[S.req]) delete S.req;
    if (S.cand && !DB.byId[S.cand]) delete S.cand;
    if (S.asmt && !asmtOf(S.asmt)) delete S.asmt;
    DESK = DESKS[S.as] ? S.as : 'omar';
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
  /* `force` passes the unsaved-shortlist gate (the gate's own buttons). */
  function go(over, replace, force) {
    const next = Object.assign({}, over);
    if (!force && DRAFT && S.on === 'draft' && !S.list && next.on !== 'draft') {
      LEAVE = over; paint(); byId('pageScroll').scrollTop = 0; return;
    }
    /* The desk travels with every link inside the product, and never onto a
       screen somebody outside it opens. */
    if (DESK !== 'omar' && !('as' in over) && !OUTSIDE.some((k) => !!next[k])) next.as = DESK;
    if (!replace) TRAIL = Object.assign({}, S);
    /* A half-made pass and ticks on another page do not follow you. */
    if (next.req !== S.req || next.cand !== S.cand || next.on !== S.on) { PASSING = null; OUTING = null; WRITING = null; SEL.sourced = {}; }
    S = next;
    DESK = DESKS[S.as] ? S.as : 'omar';
    const u = urlOf(S);
    if (replace) history.replaceState(null, '', u); else history.pushState(null, '', u);
    /* A row in the bell is a way somewhere; once you are there it closes. */
    byId('ntfPanel').hidden = true;
    peekHide();
    /* Opening a record closes the canvas; the mark on the bar reopens the
       same thread (Sales). */
    if (canvasShown()) closeCanvas();
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
    const d = me();
    byId('userAvatar').textContent = d.ini;
    byId('userName').textContent = d.name;
    byId('userRole').textContent = d.role;
    byId('asPanel').innerHTML = '<span class="b-menu-cap">Looking as</span>' + DESK_ORDER.map((k) => {
      const x = DESKS[k];
      return '<button class="b-menu-item' + (k === DESK ? ' is-on' : '') + '" type="button" role="menuitemradio" aria-checked="' + (k === DESK) + '" data-as="' + k + '">' +
        '<span class="b-menu-name">' + esc(x.name) + '</span><span class="tel-menu-cc">' + esc(x.role) + '</span></button>';
    }).join('');
  }

  /* ── The rail: what is reachable, with one reading on top. ── */
  /* The other desks' rail: their one reading, and doors to their work. */
  function paintDeskRail() {
    const a = asks();
    const reqs = deskReqs().filter((q) => q.state !== 'draft');
    const open = reqs.filter(isOpen);
    const risky = open.filter((q) => health(q).risk);
    const say = isHR() ? '<b>' + risky.length + ' of ' + open.length + '</b> open requisitions are likely to miss their date.'
      : a.length ? '<b>' + plural(a.length, 'thing') + '</b> ' + (a.length === 1 ? 'waits' : 'wait') + ' on you.' : 'Nothing waits on you.';
    byId('appRail').innerHTML =
      '<div class="rail-read"><div class="bcard rail-card">' +
        '<div class="bcard-meta"><span class="type-label rail-state p2">' + esc(isHR() ? 'At risk' : 'Waiting on you') + '</span></div>' +
        '<p class="bcard-conclusion rail-conclusion">' + say + '</p>' +
        '<div class="bcard-evidence rail-evidence"><span class="evidence-pill"><span class="val">' + open.length + '</span>open requisitions</span>' +
          (isClient() ? '' : '<span class="evidence-pill"><span class="val">' + reqs.filter((q) => q.state === 'filled' || q.state === 'started').length + '</span>filled</span>') + '</div>' +
      '</div></div>' +
      '<div class="rail-doors">' +
        (a[0] ? '<button class="b-door" type="button"' + goAttr(a[0].go) + '><span class="b-door-cap">Next</span>' +
          '<span class="b-door-who">' + esc(a[0].head) + '</span><span class="b-door-say">' + esc(a[0].body) + '</span>' +
          '<span class="b-door-go">' + esc(a[0].verb) + svg('go') + '</span></button>' : '') +
        (isClient() ? '' : '<button class="b-door" type="button"' + goAttr({ on: 'reports' }) + '><span class="b-door-cap">Reports</span>' +
          '<span class="b-door-fig">' + (avgSent(reqs) != null ? avgSent(reqs) : '·') + '<span class="b-door-of">days</span></span>' +
          '<span class="b-door-say">to send the first profile, on average</span><span class="b-door-go">Open the reports' + svg('go') + '</span></button>') +
      '</div>';
  }
  function paintRail() {
    if (!isRec()) { paintDeskRail(); return; }
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
        (function () {
          const miss = missed(), tc = toCall();
          if (!miss.length && !tc.length) return '';
          return '<button class="b-door" type="button"' + goAttr({ on: 'calls', q: miss.length ? 'missed' : 'tocall' }) + '>' +
            '<span class="b-door-cap">Calls</span>' +
            '<span class="b-door-fig">' + tc.length + '<span class="b-door-of">to call</span></span>' +
            '<span class="b-door-say">' + (miss.length ? '<b class="b-door-miss">' + plural(miss.length, 'missed call') + '</b> · ' : '') +
              plural(tc.filter((x) => x.why === 'callback').length, 'callback') + ' due today</span>' +
            '<span class="b-door-go">Open your calls' + svg('go') + '</span></button>';
        })() +
        (avg != null ? '<button class="b-door" type="button"' + goAttr({ on: 'reqs' }) + '>' +
          '<span class="b-door-cap">Profiles to clients</span>' +
          '<span class="b-door-fig">' + avg + '<span class="b-door-of">days</span></span>' +
          '<span class="b-door-say">from opening to the first profile sent, on average. The team’s is ' + team + '.</span>' +
          '<span class="b-door-go">Open your requisitions' + svg('go') + '</span>' +
        '</button>' : '') +
      '</div>';
  }

  /* ── The briefing, on Today only. Sales opens a desk on it; every other
     tab's heading is its tab switcher, with cuts and cards under it (Sales
     handoff, 'The page title is the tab switcher'). It stood above
     Requisitions and Calls as well until 28 Oct. ── */
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
        ' is likely to miss its date: <b>' + days(h.left) + '</b> left, and the furthest candidate is ' + esc(atStage(h.furthest)) + '.');
    }
    if (client.length) {
      lines.push('Clients owe an answer on <button class="slv-n" type="button"' + goAttr({ on: 'reqs', q: 'client' }) + '>' + plural(client.length, 'candidate') + '</button>' +
        ', the oldest waiting <b>' + days(client[0].since) + '</b>.');
    }
    const tc = toCall();
    const miss = missed();
    if (miss.length) {
      lines.push('<button class="slv-n" type="button"' + goAttr({ on: 'calls', q: 'missed' }) + '>' + plural(miss.length, 'person', 'people') + '</button>' +
        ' called and got nobody' + (tc.filter((x) => x.why === 'callback').length ? ', and <b>' + plural(tc.filter((x) => x.why === 'callback').length, 'callback') + '</b> ' +
        (tc.filter((x) => x.why === 'callback').length === 1 ? 'is' : 'are') + ' due today.' : '.'));
    }
    const ready = d.filter((c) => c.stage === 'tech' && reqOf(c).tpl !== 'internal');
    const starts = [
      { k: 'decide', label: 'Decide the oldest one', n: d.length, why: oldest ? oldest.name + ', ' + lower(STAGE[oldest.stage].label) : 'nothing is waiting' },
      { k: 'send', label: 'Send profiles', n: ready.length, why: ready.length ? 'technical results are in for ' + plural(ready.length, 'candidate') : 'none ready yet' },
      { k: 'screen', label: 'Call the next one', n: tc.length, why: tc.length ? tc[0].c.name + (tc[0].why === 'callback' ? ' asked for a callback' : ', ' + lower(STAGE[tc[0].c.stage].label)) : 'nobody is waiting' },
      /* Sales's fourth tile is Find leads; at-risk requisitions are already a
         line above and a block below. */
      { k: 'find', label: 'Find people', n: null, why: 'describe who to look for; what comes back is a shortlist' },
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
    /* Each desk's row is the work that desk does (Sales: a surface belongs
       to whoever does the verb on it). */
    const all = {
      '': { label: 'Today' },
      cands: { label: 'Candidates', n: isRec() || isHR() ? queue().length : null },
      reqs: { label: 'Requisitions', n: open },
      calls: { label: 'Calls', n: isRec() ? toCall().length : null },
      find: { label: 'Find candidates' },
      asmts: { label: 'Assessments' },
      templates: { label: 'Templates' },
      reports: { label: 'Reports' },
    };
    const row = isRec() ? ['', 'cands', 'reqs', 'calls', 'find', 'asmts', 'reports'] : isHM() || isBU() ? ['', 'reqs', 'reports']
      : isHR() ? ['', 'cands', 'reqs', 'asmts', 'templates', 'reports'] : ['', 'reqs'];
    const tabs = row.map((k) => Object.assign({ k: k }, all[k]));
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
        '<span class="b-owed-body">' + rowSay(c) + (verb === 'nudge' ? ' <b>' + days(lostDays(c)) + '</b> past the usual time' +
          (c.nudged != null ? ', nudged ' + esc(sayWhen(c.nudged)) + '.' : ', not nudged yet.') : '') + '</span>' +
      '</button>' +
      (verb === 'nudge'
        ? '<button class="b-owed-go t-row-go" type="button" data-nudge="' + c.id + '">' + (c.nudged != null ? 'Nudged' : esc(nudgeSay(c))) + '</button>'
        : nx ? '<button class="b-owed-go t-row-go" type="button" data-move="' + c.id + '|' + nx + '">' + esc(goSay(c)) + '</button>' : '') +
    '</div>';
  }
  function rowSay(c) {
    const w = waitsOn(c);
    if (MEETS[c.stage] && c.fb) return 'Interview ' + sayWhen(c.meet) + '. The result is in: proceed. ' + evSay(c) + '.';
    if (w === 'client' && c.stage === 'sent') return 'Profile sent <b>' + days(c.since) + '</b> ago, ' + (c.openDay != null ? 'opened ' + esc(sayWhen(c.openDay)) : '<b>not opened yet</b>') + '. ' +
      esc(waitWho(c)) + ' has not said whether they want to meet.';
    if (MEETS[c.stage] && c.meet < 0) return 'Interview ' + sayWhen(c.meet) + '. ' + esc(waitWho(c)) + ' has not sent the result.';
    if (c.stage === 'offer') return 'Offer out <b>' + days(c.since) + '</b>. No answer yet.';
    return esc(STAGE[c.stage].say) + ', ' + days(c.since) + '.';
  }

  /* ── TODAY, A BRIEFING NOT A LIST (Sales: open on a briefing, not a
     database; "show the one thing that matters, expand for the rest") ──
     Each block shows its first three. The rest opens in place under them,
     and where a tab holds the same set, a second link opens it there. */
  const TODAY_N = 3;
  const TODAY_MORE = {};
  const topN = (k, list) => (TODAY_MORE[k] ? list : list.slice(0, TODAY_N));
  function moreLinks(k, n, tab) {
    if (n <= TODAY_N && !tab) return '';
    return '<p class="t-acts t-more">' +
      (n > TODAY_N ? '<button class="s-inline-btn" type="button" data-more="' + k + '" aria-expanded="' + !!TODAY_MORE[k] + '">' +
        (TODAY_MORE[k] ? 'Show the first ' + TODAY_N + ' only' : 'Show the other ' + (n - TODAY_N)) + '</button>' : '') +
      (tab ? '<button class="s-inline-btn" type="button"' + goAttr(tab.go) + '>' + esc(tab.label) + '</button>' : '') +
    '</p>';
  }
  /* WHAT WAITING COSTS (R5: in FlairsTech's own data, 46 of 105 lost
     requisition-days were spent waiting for feedback). The days past the
     usual time for that step, said on each row and added up in the head. */
  const lostDays = (c) => Math.max(0, MEETS[c.stage] && c.meet != null && c.meet < 0 ? -c.meet - 1 : c.since - STAGE[c.stage].exp);
  /* ONE MOVE ON A REQUISITION THAT WILL MISS ITS DATE. Nobody far along:
     the pipeline is thin, so find more people. Somebody far along but not
     fast enough: the date is what is wrong, so ask the hiring manager to
     move it to when an offer is likely. */
  function riskAct(q, h) {
    if (rank(q, h.furthest) < rank(q, 'tech')) return '<button class="b-owed-go t-row-go" type="button"' + goAttr({ on: 'find', req: q.id }) + '>Find more people</button>';
    const hm = hmOf(q);
    return q.askedMove != null ? '<span class="b-owed-go t-row-done">Asked ' + esc(first(hm.name)) + '</span>'
      : '<button class="b-owed-go t-row-go" type="button" data-ask-date="' + q.id + '">Ask ' + esc(first(hm.name)) + ' to move it</button>';
  }
  function askMove(q) {
    const h = health(q), hm = hmOf(q);
    put('reqs', q, { askedMove: 0 });
    const n = tellDesk(hm.id, { sev: 'p2', type: 'Target date', cta: 'Open ' + q.title, go: { req: q.id },
      body: me().name + ' asks to move the target for ' + q.title + ' from ' + sayDay(q.target) + ' to ' + sayDay(h.need) + ': the furthest candidate is at the ' +
        lower(STAGE[h.furthest].label) + ', and an accepted offer usually takes ' + days(h.need) + ' from there.' });
    paint();
    toast('Asked ' + first(hm.name) + ' to move the date', () => { put('reqs', q, { askedMove: null }); untell(n); paint(); },
      'To ' + sayDay(h.need) + ', when an offer is likely. It is in their bell.');
  }
  /* ── PREPARE ME (Sales M1) ── the interview's brief, in the conversation:
     who is in the room, the agenda, what to probe (what the CV is silent on
     and no interview has confirmed), what is already confirmed, and what
     they told us. The verdict stays the interviewer's. */
  function prepMe(c) {
    const q = reqOf(c), v = ivsOf(c).filter((x) => x.status === 'booked' && x.day === 0)[0];
    const tpl = (v && tplById(v.tpl)) || tplFor(c.stage);
    const ver = verified(c);
    const probe = ver.filter((x) => x.state !== 'verified').map((x) => x.must + (x.cv === 'n' ? ' (the CV is silent)' : x.state === 'differs' ? ' (an interview found it differs)' : ''));
    const done = ver.filter((x) => x.state === 'verified').map((x) => x.must + ', at the ' + lower(STAGE[x.seen[0].stage].label));
    const last = lastCall(c);
    const said = [c.notice ? c.notice : null, c.salary ? 'expects ' + c.salary : null].filter(Boolean);
    const body = '<div class="b-prep">' +
      '<p class="b-prep-id">' + esc(STAGE[c.stage].label) + ' at ' + esc(c.slot) + ' · ' + esc(q.title) + ' · ' + esc(accOf(q).name) +
        (v ? ' · with ' + esc(v.by) + (v.mode === 'video' ? ', on Teams' : ', in person') : '') + '</p>' +
      openQ('Open with', 'Say who is in the room and that it takes about 45 minutes. Ask if they are happy for it to be recorded; nothing is recorded until they agree.') +
      (tpl ? openQ('The agenda · ' + tpl.title, tpl.items.map((x) => esc(x)).join('<br>')) : '') +
      (probe.length ? openQ('Probe', esc(probe.join('; ')) + '. Ask for an example of each.') : '') +
      (done.length ? openQ('Already confirmed', esc(done.join('; ')) + '. No need to cover it again.') : '') +
      openQ('What they told us', said.length ? esc(said.join(', ')) + '.' : last ? esc(callSay(last)) : 'Nothing yet beyond the CV.') +
      openQ('Your verdict', 'Rate each must-have, then say proceed or not. AiMY never fills it, and other interviewers’ feedback stays hidden until you send yours.') +
    '</div>';
    callChat(null, 'Before you interview ' + c.name);
    callTurn({ who: 'aimy', html: answerBlock('Before you interview ' + c.name, body, plural(ivsOf(c).filter((x) => x.status === 'done').length, 'interview') + ' so far'),
      acts: [{ label: 'Open their record', go: { cand: c.id } }] });
  }

  /* ── TODAY ── */
  function homePage() {
    const d = decisions(), w = waits(), t = today();
    const risky = myOpen().map((q) => ({ q: q, h: health(q) })).filter((x) => x.h.risk);
    const owed = untold();
    const late = owed.filter((c) => c.since >= TELL_DAYS);
    return '<div class="s-home">' +
      topBrief() +
      '<section class="s-block s-block-wide">' +
        '<div class="s-camp-list-head">' + switcher('') + '</div>' +
        '<p class="b-tocall">' + (d.length ? '<b>' + plural(d.length, 'decision') + '</b> waiting on you, oldest first. Each is one press, and each can be undone.'
          : 'Nothing is waiting on your call.') + '</p>' +
        srcNote([['Debrief results', true], ['Assessment results', true]]) +
        (d.length ? '<div class="b-owed">' + topN('decide', d).map((c, i) => workRow(c, i)).join('') + '</div>' + moreLinks('decide', d.length) : '') +
      '</section>' +
      (owed.length ? '<section class="s-block s-block-wide" aria-label="Not told yet">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Not told yet</h2>' +
          '<span class="s-block-say">' + plural(owed.length, 'person', 'people') + ' owed an answer · ' + (late.length ? late.length + ' past the ' + TELL_DAYS + '-day limit' : 'all inside the ' + TELL_DAYS + '-day limit') + '</span></div>' +
        srcNote([['Exits on each candidate', false], ['HR message templates', true]]) +
        aimyBlock({ text: 'Nobody waits more than ' + TELL_DAYS + ' days to hear back. A person sends the answer, under the HR Manager’s template; AiMY only suggests it.', from: 'how declines work here' }) +
        msgPreview(DB.byId[Object.keys(SEL.tell)[0]] || owed[0]) +
        '<div class="b-owed">' + topN('tell', owed).map((c, i) => '<div class="b-owed-row t-row" style="--i:' + Math.min(i, 8) + '">' + selBox('tell', c.id, c.name) +
          '<button class="b-owed-main t-row-open" type="button" data-cand="' + c.id + '"><span class="b-owed-head"><span class="b-owed-type">' + esc(c.name) + '</span>' +
            '<span class="b-owed-by">' + esc(reqOf(c).title) + ' · ' + esc(accOf(reqOf(c)).name) + '</span>' + tag(EXIT[c.exit].label, c.since >= TELL_DAYS ? 'warn' : 'neutral') + '</span>' +
            '<span class="b-owed-body">' + esc(EXIT[c.exit].label) + ' ' + esc(sayWhen(-c.since)) + (c.decline ? ': ' + esc(lower(DECLINE_K[c.decline.why].label)) : '') + '. ' +
              (c.since >= TELL_DAYS ? '<b>Past the ' + TELL_DAYS + '-day limit.</b>' : 'Tell them by ' + esc(sayDay(TELL_DAYS - c.since)) + '.') + '</span></button>' +
          '<button class="b-owed-go t-row-go" type="button" data-tell="' + c.id + '">Send the answer</button></div>').join('') + '</div>' +
        moreLinks('tell', owed.length, { label: 'Open all ' + owed.length + ' in Candidates', go: { on: 'cands', q: 'untold' } }) +
        (selN('tell') ? batchBar('tell', '<button class="s-insight-lnk primary" type="button" data-tell-sel>Send the answer to ' + plural(selN('tell'), 'person', 'people') + '</button>')
          : '<p class="t-acts"><button class="b-ghost" type="button" data-sel-all="tell">Select all ' + owed.length + '</button></p>') +
      '</section>' : '') +
      (t.length ? '<section class="s-block s-block-wide" aria-label="Interviews today">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Interviews today</h2>' +
          '<span class="s-block-say">' + plural(t.length, 'interview') + ' · earliest first</span></div>' +
        srcNote([['Bookings calendar', false]]) +
        '<div class="b-cal-agenda">' + topN('iv', t).map((c) => '<div class="b-cal-ev is-plain t-cal-ev">' +
          '<button class="t-cal-open" type="button"' + goAttr({ cand: c.id }) + '>' +
            '<span class="b-cal-evtop"><span class="b-cal-dot k-meeting"></span><span class="b-cal-etime">' + esc(c.slot) + '</span>' +
              '<span class="b-kind">' + esc(STAGE[c.stage].label) + '</span></span>' +
            '<span class="b-cal-ename"><b>' + esc(c.name) + '</b><span class="b-cal-ewhat">' + esc(reqOf(c).title) + ' · ' + esc(accOf(reqOf(c)).name) + '</span></span>' +
          '</button>' +
          '<button class="s-inline-btn t-prep-btn" type="button" data-prep="' + c.id + '">' + mark(12) + 'Prepare me</button>' +
        '</div>').join('') + '</div>' + moreLinks('iv', t.length) +
      '</section>' : '') +
      (w.length ? '<section class="s-block s-block-wide" aria-label="Waiting on others">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Waiting on others</h2>' +
          '<span class="s-block-say">' + plural(w.length, 'candidate') + ' · <b>' + plural(w.reduce((n, c) => n + lostDays(c), 0), 'day') + '</b> past the usual time · longest first</span></div>' +
        srcNote([['Stage and date', false], ['Sendout record', true]]) +
        aimyBlock({ text: 'Waiting is where requisitions lose the most time: in FlairsTech’s own data, 46 of 105 lost days were spent waiting for feedback. Nudging is done for you and logged; nothing is sent to a candidate.', from: 'the recruitment data, and how nudges work here' }) +
        '<div class="b-owed">' + topN('wait', w).map((c, i) => workRow(c, i, 'nudge')).join('') + '</div>' + moreLinks('wait', w.length) +
      '</section>' : '') +
      (risky.length ? '<section class="s-block s-block-wide" aria-label="At risk">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Likely to miss their date</h2>' +
          '<span class="s-block-say">rule-based · the reason is on each row</span></div>' +
        srcNote([['Target date', false], ['Stage and date', false]]) +
        '<div class="b-owed">' + topN('risk', risky).map((x, i) => '<div class="b-owed-row t-row" style="--i:' + i + '">' +
          '<span class="b-owed-sev" aria-hidden="true"></span>' +
          '<button class="b-owed-main t-row-open" type="button"' + goAttr({ req: x.q.id }) + '><span class="b-owed-head"><span class="b-owed-type">' + esc(x.q.title) + '</span>' +
            '<span class="b-owed-by">' + esc(accOf(x.q).name) + '</span>' + tag('At risk', 'warn') + '</span>' +
            '<span class="b-owed-body">' + riskSay(x.q, x.h) + '</span></button>' +
          riskAct(x.q, x.h) + '</div>').join('') + '</div>' +
        moreLinks('risk', risky.length, { label: 'Open all ' + risky.length + ' in Requisitions', go: { on: 'reqs', q: 'risk' } }) +
      '</section>' : '') +
    '</div>';
  }
  function riskSay(q, h) {
    return 'The target is ' + sayDay(q.target) + ', <b>' + days(h.left) + '</b> away. The furthest candidate is at the ' +
      esc(lower(STAGE[h.furthest].label)) + ', and from there an accepted offer usually takes <b>' + days(h.need) + '</b>.';
  }

  /* ── CANDIDATES ── Sales's Contacts: everyone on your open requisitions as
     one queue, cut by who the next move waits on. The cuts are a partition,
     so they add up to All (Sales B1), and the people still owed an answer
     sit apart, the way Sales keeps Accounts apart. Fifteen at a time. */
  const PAGE_N = 15;
  const queueCut = (c) => {
    const w = waitsOn(c);
    if (c.stage === 'sourced' && !c.contactOk) return 'new';
    return w === 'me' ? 'me' : w === 'client' ? 'client' : 'others';
  };
  const QCUT_ORDER = { me: 0, new: 1, client: 2, others: 3 };
  function queue() {
    return myOpen().reduce((l, q) => l.concat(activeOf(q)), [])
      .sort((a, b) => QCUT_ORDER[queueCut(a)] - QCUT_ORDER[queueCut(b)] || b.since - a.since);
  }
  const QCUTS = [
    { k: 'all',    label: 'All' },
    { k: 'me',     label: 'Waiting on you' },
    { k: 'new',    label: 'First contact' },
    { k: 'client', label: 'With the client' },
    { k: 'others', label: 'Waiting on others' },
  ];
  /* SEARCH AND ONE REQUISITION. A recruiter with several requisitions open
     looks for one person, or one requisition's people, more often than they
     scroll the queue. Both narrow the cuts, so the count on each chip is
     what is left to see. */
  const candHit = (c, f) => {
    if (!f) return true;
    const q = reqOf(c);
    return [c.name, c.at, c.place, c.email || '', c.phone || '', (c.skills || []).join(' '), q.title, accOf(q).name]
      .join(' ').toLowerCase().indexOf(f.toLowerCase()) >= 0;
  };
  /* CARDS OR A LIST: the card for working one person, the list for reading
     many at a glance. The choice is kept for this person, on this device. */
  const LIST_N = 40;
  function candRow(c) {
    const q = reqOf(c), was = before(c);
    const works = isRec() || isHR();
    const pick1 = works && !c.exit && c.stage === 'sourced' && !c.contactOk;
    const owedTell = works && c.exit && c.told === false;
    /* One verb per row, the card's first one; anything with a choice in it
       (an exit and its reason, an offer) is on the card. */
    const act = owedTell ? '<button class="s-inline-btn" type="button" data-tell="' + c.id + '">Send the answer</button>'
      : pick1 ? '<button class="s-inline-btn" type="button" data-contact-ok="' + c.id + '">Approve first contact</button>'
      : !c.exit && isRec() && (c.stage === 'applied' || c.stage === 'phone') && canCall(c) ? '<button class="s-inline-btn" type="button" data-call="' + c.id + '">' + svg('phone', 13) + 'Call</button>'
      : '<button class="s-inline-btn" type="button" data-cand="' + c.id + '">Open</button>';
    return '<li class="t-crow">' +
      (pick1 ? selBox('sourced', c.id, c.name) : owedTell ? selBox('tell', c.id, c.name) : '<span class="t-crow-sel" aria-hidden="true"></span>') +
      '<span class="t-crow-who"><button class="t-crow-name" type="button" data-cand="' + c.id + '">' + esc(c.name) + '</button><span class="t-crow-sub">' + esc(c.at) + '</span></span>' +
      '<span class="t-crow-req"><span class="t-crow-title">' + esc(q.title) + '</span><span class="t-crow-sub">' + esc(accOf(q).name) + '</span></span>' +
      '<span class="t-crow-tags">' + stageTag(c) + (was ? tag('Returning', 'info') : '') + '</span>' +
      '<span class="t-crow-say">' + esc(candSay(c)) + '</span>' +
      '<span class="t-crow-act">' + act + '</span>' +
    '</li>';
  }
  function candsPage() {
    const rqQ = S.rq && DB.reqById[S.rq] ? DB.reqById[S.rq] : null;
    const hit = (c) => (!rqQ || c.req === rqQ.id) && candHit(c, S.find);
    const everyone = queue(), owedAll = untold();
    const all = everyone.filter(hit), owed = owedAll.filter(hit);
    const cut = S.q === 'untold' || QCUTS.some((x) => x.k === S.q) ? S.q : 'all';
    const list = cut === 'untold' ? owed : cut === 'all' ? all : all.filter((c) => queueCut(c) === cut);
    const n = (k) => k === 'all' ? all.length : all.filter((c) => queueCut(c) === k).length;
    const asList = UI.cview === 'list';
    const per = asList ? LIST_N : PAGE_N;
    const pages = Math.max(1, Math.ceil(list.length / per));
    const page = Math.min(pages - 1, Math.max(0, Number(S.p) || 0));
    const from = page * per, to = Math.min(list.length, from + per);
    const left = list.length - to;
    /* The search and the requisition ride on every link on this page. */
    const keep = (o) => goAttr(Object.assign({ on: 'cands', rq: S.rq, find: S.find }, o));
    const narrowed = !!(rqQ || S.find);
    const reqsIn = mine().map((q) => ({ q: q, n: everyone.concat(owedAll).filter((c) => c.req === q.id).length })).filter((x) => x.n);
    const clear = '<button class="t-inline-link" type="button" data-cfclear>Show everyone</button>';
    return '<div class="s-home">' +
      '<section class="s-block s-block-wide">' +
        '<div class="s-camp-list-head">' + switcher('cands') + '</div>' +
        '<p class="b-tocall"><b>' + n('me') + '</b> waiting on you, ' + (rqQ ? 'on ' + esc(rqQ.title) + ' for ' + esc(accOf(rqQ).name) : 'across ' + plural(myOpen().length, 'open requisition')) + '</p>' +
        '<div class="t-cfilters">' +
          '<label class="b-find">' + svg('find', 14) +
            '<input type="text" data-find value="' + esc(S.find || '') + '" placeholder="Find a name, a skill or a requisition" spellcheck="false" aria-label="Find a name, a skill or a requisition"></label>' +
          '<span class="b-menu-wrap"><button class="b-ghost t-rq-btn" type="button" data-pickopen="rqMenu" aria-haspopup="menu" aria-expanded="false">' +
            '<span class="t-rq-label">' + esc(rqQ ? rqQ.title + ', ' + accOf(rqQ).name : 'All requisitions') + '</span>' + svg('down', 14) + '</button>' +
            '<div class="b-menu" id="rqMenu" role="menu" hidden><span class="b-menu-cap">Requisition</span>' +
              '<button class="b-menu-item" type="button" role="menuitem" data-rq=""' + (rqQ ? '' : ' aria-current="true"') + '><span class="b-menu-name">All requisitions</span><span class="tel-menu-cc">' + everyone.concat(owedAll).length + '</span></button>' +
              reqsIn.map((x) => '<button class="b-menu-item" type="button" role="menuitem" data-rq="' + x.q.id + '"' + (rqQ === x.q ? ' aria-current="true"' : '') + '>' +
                '<span class="t-rq-item"><span class="b-menu-name">' + esc(x.q.title) + '</span><span class="t-crow-sub">' + esc(accOf(x.q).name) + '</span></span><span class="tel-menu-cc">' + x.n + '</span></button>').join('') +
            '</div></span>' +
          '<span class="t-cview" role="group" aria-label="Show as">' + [['cards', 'Cards'], ['list', 'List']].map((x) => {
            const on = (x[0] === 'list') === asList;
            return '<button class="s-view' + (on ? ' is-on' : '') + '" type="button" data-cview="' + x[0] + '" aria-pressed="' + on + '">' + x[1] + '</button>'; }).join('') + '</span>' +
        '</div>' +
        '<div class="b-cuts b-cuts-row">' + QCUTS.map((x) => '<button class="filter-chip' + (x.k === cut ? ' active' : '') + '" type="button"' + keep({ q: x.k === 'all' ? undefined : x.k }) + '>' +
          esc(x.label) + '<span class="b-cut-n">' + n(x.k) + '</span></button>').join('') +
          '<button class="filter-chip t-cut-apart' + (cut === 'untold' ? ' active' : '') + '" type="button"' + keep({ q: 'untold' }) + '>Not told yet<span class="b-cut-n">' + owed.length + '</span></button>' +
        '</div>' +
        (narrowed ? '<p class="b-vfoot t-cf-on">Showing ' + (rqQ ? 'the people on ' + esc(rqQ.title) + ', ' + esc(accOf(rqQ).name) : 'everyone') + (S.find ? ' matching “' + esc(S.find) + '”' : '') + '. ' + clear + '</p>' : '') +
        /* Where the volume is, select many and act once (Batch bar, M7); the
           answer owed is shown as it will read (Message preview, M4). */
        (cut === 'untold' && owed.length ? msgPreview(DB.byId[Object.keys(SEL.tell)[0]] || owed[0]) +
          (selN('tell') ? batchBar('tell', '<button class="s-insight-lnk primary" type="button" data-tell-sel>Send the answer to ' + plural(selN('tell'), 'person', 'people') + '</button>')
            : '<p class="t-acts"><button class="b-ghost" type="button" data-sel-all="tell">Select all ' + owed.length + '</button></p>') : '') +
        (cut === 'new' && list.length ? trustCard(list.filter((c) => /^Found on/.test(c.source) && !c.contactOk)) : '') +
        (cut === 'new' && list.length ? (selN('sourced') ? batchBar('sourced', '<button class="s-insight-lnk primary" type="button" data-contact-sel>Approve first contact for ' + plural(selN('sourced'), 'person', 'people') + '</button>')
            : '<p class="t-acts"><button class="b-ghost" type="button" data-sel-all="sourced">Select all ' + list.length + '</button></p>') : '') +
        (list.length ? (asList ? '<ul class="t-clist" aria-label="Candidates">' + list.slice(from, to).map(candRow).join('') + '</ul>'
            : '<div class="b-grid">' + list.slice(from, to).map((c, i) => '<div class="b-slot" style="--i:' + i + '">' + candCard(c, i) + '</div>').join('') + '</div>') +
          '<div class="b-pager"><span class="b-vfoot">' + (from + 1) + '–' + to + ' of ' + plural(list.length, 'candidate') + ' · page ' + (page + 1) + ' of ' + pages + '</span>' +
            '<span class="b-pager-go">' + (page > 0 ? '<button class="s-inline-btn" type="button"' + keep({ q: S.q, p: page > 1 ? String(page - 1) : undefined }) + '>Previous ' + per + '</button>' : '') +
            (left > 0 ? '<button class="s-inline-btn" type="button"' + keep({ q: S.q, p: String(page + 1) }) + '>Next ' + Math.min(per, left) + '</button>' : '') + '</span></div>'
          : '<p class="s-none">' + (narrowed ? 'Nobody here matches. ' + clear : 'Nobody here.') + '</p>') +
      '</section></div>';
  }

  /* ── REQUISITIONS ── the recruiter's, as cards, cut by where they stand. */
  const CUTS = [
    /* "Open" is `isOpen`, the same test the rail and the switcher count, so
       the three numbers cannot disagree. On hold is its own cut. */
    { k: 'all',    label: 'Open',               test: isOpen },
    { k: 'risk',   label: 'At risk',            test: (q) => stateOf(q) === 'risk' },
    { k: 'client', label: 'Waiting on the client', test: (q) => activeOf(q).some((c) => waitsOn(c) === 'client') },
    { k: 'mine',   label: 'Waiting on you',     test: (q) => activeOf(q).some((c) => MEETS[c.stage] && c.fb) },
    { k: 'nosend', label: 'No profile after ' + NOSEND_DAYS + ' days', test: (q) => noSend(q) },
    { k: 'hold',   label: 'On hold',            test: (q) => q.state === 'hold' },
    { k: 'closed', label: 'Closed',             test: (q) => !!CLOSED[q.state] },
    { k: 'draft',  label: 'Drafts',             test: (q) => q.state === 'draft' },
  ];
  const findHit = (q, f) => {
    if (!f) return true;
    const s = f.toLowerCase();
    return (q.title + ' ' + accOf(q).name + ' ' + hmOf(q).name).toLowerCase().indexOf(s) >= 0 ||
      DB.byReq[q.id].some((c) => c.name.toLowerCase().indexOf(s) >= 0);
  };
  function reqsPage() {
    /* A client sees open and closed requests; the internal cuts are ours. */
    const cuts = isClient() ? CUTS.filter((c) => c.k === 'all' || c.k === 'closed') : CUTS;
    const cut = cuts.filter((c) => c.k === S.q)[0] || cuts[0];
    const all = mine();
    const list = all.filter(cut.test).filter((q) => findHit(q, S.find))
      .sort((a, b) => (stateOf(b) === 'risk') - (stateOf(a) === 'risk') || a.target - b.target);
    return '<div class="s-home">' +
      '<section class="s-block s-block-wide">' +
        '<div class="s-camp-list-head">' + switcher('reqs') +
          '<label class="b-find">' + svg('find', 14) +
            '<input type="text" data-find value="' + esc(S.find || '') + '" placeholder="Find a requisition, an account or a candidate" spellcheck="false" aria-label="Find a requisition, an account or a candidate"></label>' +
          (isClient() ? '<button class="b-ghost" type="button" data-client-request>Ask for a hire</button>'
            : isBU() ? '<button class="b-ghost" type="button" data-client-request>Request a hire</button>'
            : '<button class="b-ghost" type="button" data-new-req>New requisition</button>') +
        '</div>' +
        '<div class="b-cuts b-cuts-row">' + cuts.map((c) => '<button class="filter-chip' + (c === cut ? ' active' : '') + '" type="button" data-q="' + c.k + '">' +
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
    const clock = q.state === 'draft' ? 'not open yet' : CLOSED[q.state] ? 'closed' : q.state === 'hold' ? 'paused' : h.left >= 0 ? days(h.left) + ' left' : days(-h.left) + ' past the target';
    const sentTo = DB.byReq[q.id].filter((c) => rank(q, 'sent') >= 0 && rank(q, c.maxAt) >= rank(q, 'sent'));
    const read = q.state === 'draft' ? 'A draft. Nothing happens until it is opened.'
      : isClient() ? (sentTo.length ? 'We sent <b>' + plural(sentTo.length, 'profile') + '</b>; you met ' + sentTo.filter((c) => rank(q, c.maxAt) >= rank(q, 'client')).length + '.' : 'No profiles sent yet.')
      : CLOSED[q.state]
      ? (q.state === 'filled' || q.state === 'started' ? plural(q.seats, 'seat') + ' filled, from ' + DB.byReq[q.id].length + ' candidates.' : 'Closed before anyone was hired.')
      : ws ? '<b>' + ws.m + ' of ' + ws.n + '</b> moved on after ' + esc(STAGE[ws.from].label) + ', the biggest drop here.'
      : 'Too early to say where people drop.';
    return '<article class="type-card s-card b-qcard" data-open="req:' + q.id + '" style="--i:' + Math.min(i, 8) + '">' +
      '<div class="tc-head">' + tag(st.label, st.tone) + '<span class="b-kind">' + esc(clock) + '</span>' +
        '<span class="tc-type b-fact">' + svg('acc') + '<span>' + esc(accOf(q).name) + '</span></span></div>' +
      '<button class="tc-title s-card-title" type="button" data-req="' + q.id + '">' + esc(q.title || 'Untitled draft') + '</button>' +
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
    if (!q || (isClient() && q.acc !== me().acc)) return '<div class="s-home"><section class="s-block s-block-wide"><p class="s-none">This requisition is not one of yours.</p></section></div>';
    /* A draft is always open for editing; anything else is edited behind
       Edit, and atomic things (published, on hold) are one press on the
       record itself (Sales's inline-versus-Edit rule). */
    if (q.state === 'draft' || (S.edit && canEditReq(q))) return reqEditPage(q);
    const st = REQ_STATE[stateOf(q)];
    const h = health(q);
    const t = tplOf(q);
    const act = activeOf(q);
    const all = DB.byReq[q.id];
    const f = funnel(q);
    const ws = worstStep(f);
    const cutK = S.q && (S.q === 'all' || S.q === 'out' || STAGE[S.q]) ? S.q : 'all';
    const pool = cutK === 'all' ? act : cutK === 'out' ? all.filter((c) => c.exit) : act.filter((c) => c.stage === cutK);
    const people = pool.filter(sees);
    const hidden = pool.length - people.length;
    people.sort((a, b) => t.indexOf(b.stage) - t.indexOf(a.stage) || b.since - a.since);
    const sentN = all.filter((c) => rank(q, c.maxAt) >= rank(q, 'sent')).length;
    const metN = all.filter((c) => rank(q, c.maxAt) >= rank(q, 'client')).length;
    const backTo = TRAIL && (TRAIL.on || !TRAIL.req) ? (TRAIL.on === 'reqs' ? 'Requisitions' : 'Today') : 'Requisitions';

    const lead = CLOSED[q.state] ? { n: q.seats, of: q.seats, say: 'seats filled. This requisition is closed.' }
      : rank(q, 'sent') >= 0 && sentN ? { n: metN, of: sentN, say: (sentN === 1 ? 'profile sent got' : 'profiles sent got') + ' a client interview' + (h ? ', with ' + days(Math.max(0, h.left)) + ' to the target.' : '.') }
      : { n: act.length, of: all.length, say: (all.length === 1 ? 'candidate is' : 'candidates are') + ' still in progress' + (h ? ', with ' + days(Math.max(0, h.left)) + ' to the target.' : '.') };
    const deck = h && h.risk ? riskSay(q, h).replace(/<\/?b>/g, '') + ' Moving the date changes the forecast, not the work.'
      : ws ? 'The biggest drop is after the ' + lower(STAGE[ws.from].label) + ': ' + ws.m + ' of ' + ws.n + ' moved on.' +
        (ws.from === 'sent' ? ' That one is the client’s choice: about ' + (ws.n / Math.max(1, ws.m)).toFixed(1) + ' profiles per client interview. ' + versusNorm(ws.m ? ws.n / ws.m : null) + ' Their reasons say what to change.' : '')
      : 'Nothing stands out yet.';

    return '<div class="s-home">' +
      '<div class="b-topbar s-block-wide"><button class="s-back" type="button" data-trail>' + svg('back', 14) + 'Back to ' + backTo + '</button>' +
        reqActs(q) + '</div>' +
      '<section class="s-rec-head s-block-wide">' +
        '<span class="s-rec-kind b-kinds">' + fact('req', 'Requisition') +
          (isClient() ? fact('acc', accOf(q).name) : '<button class="b-fact t-fact-link" type="button" data-acc="' + q.acc + '">' + svg('acc') + '<span>' + esc(accOf(q).name) + '</span></button>') +
          fact('pin', q.place) +
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
            q.must.map((m) => '<p class="b-cmeta-p">' + esc(m) + '</p>').join('') +
            (accRule(q.acc) && !isClient() ? '<p class="b-cmeta-p t-rule">' + mark(10) + '<span>Learned from ' + esc(accOf(q).name) + '’s declines: ' + esc(accRule(q.acc).rule) + '</span></p>' : '') + '</div></div>' +
          '<div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">About the role</span></div><div class="b-cmeta-say">' +
            (q.desc ? '<p class="b-cmeta-p">' + esc(q.desc) + '</p>' : '<p class="b-cmeta-p b-draft-none">Nothing written.</p>') + '</div></div>' +
        '</div>' +
      '</section>' +
      (isClient() ? '' : reqStrip(q)) +
      '<section class="s-insight is-lead s-block-wide" aria-label="Where this requisition is">' +
        '<div class="s-lead-mark"><svg class="s-insight-mark" viewBox="0 0 18 20" width="14" height="14" aria-hidden="true"><use href="#aimy-logo-small"/></svg>' +
          '<span class="work-state ws-detected">Read off the record</span></div>' +
        '<div class="s-lead-line"><span class="s-lead-n">' + lead.n + '</span><span class="s-lead-say">of the <span class="s-lead-of">' + lead.of + '</span> ' + esc(lead.say) + '</span></div>' +
        '<p class="s-lead-deck">' + esc(deck) + '</p>' +
      '</section>' +
      (isClient() ? '' : funnelBlock(q, f, ws)) +
      (isClient() ? '' : reasonsBlock(declines([q]), 'the client', q.acc)) +
      '<section class="s-block s-block-wide" aria-label="Candidates">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">' + (isClient() ? 'Profiles sent to you' : 'The candidates on it') + '</h2>' +
          '<span class="s-block-say">' + act.length + ' in progress · ' + all.filter((c) => c.exit).length + ' left</span></div>' +
        '<div class="b-cuts b-cuts-row">' +
          '<button class="filter-chip' + (cutK === 'all' ? ' active' : '') + '" type="button" data-q="all">In progress<span class="b-cut-n">' + act.length + '</span></button>' +
          t.filter((k) => k !== 'joined').map((k) => { const n = act.filter((c) => c.stage === k).length;
            return n ? '<button class="filter-chip' + (cutK === k ? ' active' : '') + '" type="button" data-q="' + k + '">' + esc(STAGE[k].label) + '<span class="b-cut-n">' + n + '</span></button>' : ''; }).join('') +
          '<button class="filter-chip' + (cutK === 'out' ? ' active' : '') + '" type="button" data-q="out">Left<span class="b-cut-n">' + all.filter((c) => c.exit).length + '</span></button>' +
        '</div>' +
        (people.length ? '<div class="b-grid">' + people.map((c, i) => '<div class="b-slot">' + candCard(c, i) + '</div>').join('') + '</div>' +
          batchBar('sourced', '<button class="s-insight-lnk primary" type="button" data-contact-sel>Approve first contact for ' + plural(selN('sourced'), 'person', 'people') + '</button>') +
          '<p class="b-vfoot">' + plural(people.length, 'candidate') + ', all shown.' +
            (hidden ? ' ' + hidden + ' more ' + (hidden === 1 ? 'is' : 'are') + ' with the recruiter and not advanced yet.' : '') + '</p>'
          : '<p class="s-none">' + (hidden ? hidden + ' ' + (hidden === 1 ? 'person is' : 'people are') + ' with the recruiter. You see them once they are advanced.' : 'Nobody is here.') + '</p>') +
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
      (ws ? aimyBlock({ text: '<b>' + Math.round(ws.rate * 100) + '%</b> got past the ' + esc(lower(STAGE[ws.from].label)) + ', the lowest of any stage on this requisition.', from: 'every candidate on it' }) : '') +
    '</section>';
  }

  /* Where a candidate stands, in one sentence: the card's and the list's. */
  function candSay(c) {
    return c.exit ? exitSay(c) + '.'
      : MEETS[c.stage] && c.meet != null ? (c.meet > 0 ? 'Interview ' + sayWhen(c.meet) + ' at ' + c.slot + '.'
        : c.meet === 0 ? 'Interview today at ' + c.slot + '.'
        : c.fb ? 'Interviewed ' + sayWhen(c.meet) + '. The result is in: proceed.'
        : 'Interviewed ' + sayWhen(c.meet) + '. ' + waitWho(c) + ' has not sent the result.')
      : STAGE[c.stage].say.charAt(0).toUpperCase() + STAGE[c.stage].say.slice(1) + ', ' + days(c.since) + '.';
  }
  /* The earlier application, said with what stopped it. */
  const beforeSay = (x) => 'Applied before for ' + reqOf(x).title + ': ' + lower(EXIT[x.exit].label) +
    (x.outWhy && x.exit === 'out' ? ', ' + lower(OUT_K[x.outWhy.why].label) : x.decline ? ', ' + lower(DECLINE_K[x.decline.why].label) : '');
  /* One candidate, as the same card. */
  function candCard(c, i) {
    const q = reqOf(c);
    const nx = nextOf(c);
    const w = waitsOn(c);
    const say = candSay(c);
    const was = before(c);
    const canMove = !c.exit && nx && (w === 'me' || w === 'client' || w === 'candidate' || c.stage === 'sourced') && (isRec() || isHR());
    const outK = c.stage === 'sent' || c.stage === 'client' || c.stage === 'ctech' ? 'clientno' : c.stage === 'offer' ? 'offerno' : 'out';
    const foot = (l, r) => '<div class="tc-gov b-qcard-foot">' + l + r + '</div>';
    const ghostOut = exitBtn(c, outK);
    const s = sendOf(c), o = offerOf(c);
    /* Each stage's one verb: a test to send or read, an interview to book,
       a first contact to approve, an offer to prepare, send or answer. */
    let special = null;
    if (!c.exit && (isRec() || isHR())) {
      if (c.stage === 'sourced' && !c.contactOk) special = foot(ghostOut, '<button class="s-insight-lnk primary" type="button" data-contact-ok="' + c.id + '">Approve first contact</button>');
      else if (c.stage === 'assess' && !s) special = foot(ghostOut, '<button class="s-insight-lnk primary" type="button" data-send-asmt="' + c.id + '">Send the assessment</button>');
      else if (c.stage === 'assess' && s.status === 'sent') special = foot(ghostOut, '<span class="b-kind">Waiting on their test, sent ' + esc(sayWhen(s.day)) + '</span>');
      else if (MEETS[c.stage] && !ivNow(c) && c.meet == null) special = foot(ghostOut, '<button class="s-insight-lnk primary" type="button" data-cand="' + c.id + '">Book the interview</button>');
      else if (c.stage === 'offer' && !o) special = foot(ghostOut, '<button class="s-insight-lnk primary" type="button" data-offer-new="' + c.id + '">Prepare the offer</button>');
      else if (c.stage === 'offer' && o.status === 'approving') special = foot(ghostOut, o.hm === 'ok' && o.bu === 'ok'
        ? '<button class="s-insight-lnk primary" type="button" data-offer-send="' + o.id + '">Send the offer</button>'
        : '<span class="b-kind">With the approvers: ' + [o.hm === 'ok' ? null : hmOf(q).name, o.bu === 'ok' ? null : BU_DIRECTOR].filter(Boolean).join(' and ') + '</span>');
      else if (c.stage === 'offer' && o.status === 'sent') special = foot('<button class="b-ghost" type="button" data-offer-res="' + o.id + '|declined">They declined</button>',
        '<button class="s-insight-lnk primary" type="button" data-offer-res="' + o.id + '|accepted">They accepted</button>');
    }
    if (!c.exit && isClient() && c.stage === 'sent') special = foot(exitBtn(c, 'clientno'),
      '<button class="s-insight-lnk primary" type="button" data-move="' + c.id + '|client">Meet them</button>');
    /* Pressing Pass, or the recruiter's Client declined, opens the reasons
       where the buttons were. */
    if (!c.exit && passOpen(c)) special = passPicker(c);
    if (!c.exit && writeOpen(c)) special = writeBox(c);
    if (!c.exit && outPicking(c)) special = outPicker(c);
    /* Owed an answer (M4): tick it into the batch, or send this one. */
    const owedTell = c.exit && c.told === false && (isRec() || isHR());
    if (owedTell) special = foot('<span class="b-kind">' + (c.since >= TELL_DAYS ? 'Past the ' + TELL_DAYS + '-day limit' : 'Tell them by ' + esc(sayDay(TELL_DAYS - c.since))) + '</span>',
      '<button class="s-insight-lnk primary" type="button" data-tell="' + c.id + '">Send the answer</button>');
    const pick1 = !c.exit && c.stage === 'sourced' && !c.contactOk && (isRec() || isHR());
    return '<article class="type-card s-card b-qcard" style="--i:' + Math.min(i, 8) + '">' +
      '<div class="tc-head">' + (pick1 ? selBox('sourced', c.id, c.name) : owedTell ? selBox('tell', c.id, c.name) : '') + stageTag(c) + (was ? tag('Returning', 'info') : '') + '<span class="b-kind">' + esc(c.source) + '</span></div>' +
      '<div class="b-qcard-top"><button class="tc-title s-card-title" type="button" data-cand="' + c.id + '">' + esc(c.name) + '</button></div>' +
      '<p class="tc-summary b-qcard-role">' + esc(c.at) + '</p>' +
      '<p class="b-qcard-where">' + fact('job', plural(c.years, 'year') + ' of experience') + fact('pin', c.place) + '</p>' +
      '<p class="b-qcard-where">' + fact('lang', c.langs.join(', ')) + '</p>' +
      (was ? '<p class="b-qcard-where t-before">' + fact('hist', beforeSay(was)) + '</p>' : '') +
      aimyBlock({ text: esc(say) + ' ' + evSay(c) + '.' + (s && s.status === 'done' ? ' Assessment ' + s.score + '%.' : ''), from: 'the CV, read against the success profile' }) +
      (c.stage === 'sent' || (isClient() && c.exit === 'clientno') ? sendout(c) : '') +
      /* AT THE SCREEN, THE CALL IS THE MOVE. Someone who applied or is due a
         phone screen moves forward by being called and the call being
         logged, so the card's one verb is Call, not a stage button. */
      (special ? special : !c.exit && isRec() && (c.stage === 'applied' || c.stage === 'phone') ? '<div class="tc-gov b-qcard-foot">' +
        '<button class="b-ghost" type="button" data-out="' + c.id + '|out">' + esc(EXIT.out.label) + '</button>' +
        (canCall(c) ? '<button class="s-insight-lnk primary" type="button" data-call="' + c.id + '">' + svg('phone', 14) + 'Call ' + esc(first(c.name)) + '</button>'
          : '<span class="b-kind">' + esc(c.dnc ? 'Asked not to be called' : 'Number did not work') + '</span>') +
      '</div>'
      : canMove ? '<div class="tc-gov b-qcard-foot">' + exitBtn(c, outK) +
        '<button class="s-insight-lnk primary" type="button" data-move="' + c.id + '|' + nx + '">' + esc(goSay(c)) + '</button>' +
      '</div>' : '') +
    '</article>';
  }

  /* ══ THE LOOP: PARTS FROM THE UI/UX PLAN ═══════════════════════════════
     The pieces that make the hiring loop learn and keep it lawful, each
     drawn once here and used wherever its record shows. Every one keeps the
     house rules: one press with Undo, no modal, AiMY's words in its own
     line, a person deciding. */

  /* ── A PASS WITH ITS REASON (P1) ── Pass opens the reasons in place, on
     the card it was pressed on, and pressing a reason is the pass, with
     Undo: one more press than before, and that press is the answer. "Other"
     takes one line. The recruiter recording a client's no gets the same. */
  let PASSING = null;
  const exitBtn = (c, k, cls) => k === 'clientno'
    ? '<button class="' + (cls || 'b-ghost') + '" type="button" data-pass-open="' + c.id + '">' + (isClient() ? 'Pass' : esc(EXIT.clientno.label)) + '</button>'
    : '<button class="' + (cls || 'b-ghost') + '" type="button" data-out="' + c.id + '|' + k + '">' + esc(EXIT[k].label) + '</button>';
  const passOpen = (c) => !!PASSING && PASSING.id === c.id;
  /* Not progressing opens its reasons in place the same way: pressing a
     reason is the exit, with Undo. */
  let OUTING = null;
  const outPicking = (c) => !!OUTING && OUTING.id === c.id;
  /* Said after the exit: "we did not take them further: notice period too long". */
  const exitSay = (c) => EXIT[c.exit].say + (c.exit === 'out' && c.outWhy ? ': ' + OUT_K[c.outWhy.why].say + (c.outWhy.note ? ', “' + c.outWhy.note + '”' : '')
    : c.decline ? ': ' + DECLINE_K[c.decline.why].say + (c.decline.note ? ', “' + c.decline.note + '”' : '') : '');
  /* RETURNING (R2, rediscovery): this person was on another requisition
     before and left it. The card says so, with what stopped them, so
     nobody screens them twice for the same thing. */
  const before = (c) => apps(c).filter((x) => x.id !== c.id && x.exit)[0] || null;

  /* ══ THE RESEARCH COMPONENTS (30 Research/UI/source/components.html) ═════
     The eleven component cards drawn for the research, built from that
     file's own markup and class names, as is: an .eyebrow (a caps label
     with its icon) over a .card; inside, .row.between with an h3 "Thing ·
     Person", a .sub line and one .chip; .crit rows led by an .ico, the
     evidence in a .quote; AiMY's violet .aimy box with its .prov line;
     .note footnotes with a lock or a shield. The styles are that file's
     stylesheet, scoped under .rc in talent.css §THE RESEARCH COMPONENTS.
     Here they are wired to the real records and handlers. */
  /* Class lists written out whole, so the audit can see each one used. */
  const RC_CHIP = { ok: 'chip ok', warn: 'chip warn', err: 'chip err', acc: 'chip acc', dash: 'chip dash', on: 'chip on' };
  const RC_ICO = { ok: 'ico ok', warn: 'ico warn', err: 'ico err', acc: 'ico acc', mute: 'ico mute', brand: 'ico brand' };
  const RC_BTN = { primary: 'btn primary', small: 'btn small', psmall: 'btn primary small', quiet: 'btn small quiet' };
  const RC_EV = { ok: 'ev done', err: 'ev bad', wait: 'ev' };
  const RC_GRP = { Screen: 'grp g1', Assess: 'grp g2', Interview: 'grp g3', Client: 'grp g4', Offer: 'grp g5', Hired: 'grp g6' };
  const rcChip = (text, tone, ico) => '<span class="' + (RC_CHIP[tone] || 'chip') + '">' + (ico ? svg(ico, 12) + ' ' : '') + esc(text) + '</span>';
  const rcBtn = (label, attr, kind, ico) => '<button class="' + (RC_BTN[kind] || 'btn') + '" type="button" ' + attr + '>' + (ico ? svg(ico, 13) + ' ' : '') + esc(label) + '</button>';
  const rcHead = (title, sub, right) => '<div class="row between"><div><h3>' + title + '</h3>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' + (right || '') + '</div>';
  const rcCaps = (t) => '<span class="sub caps">' + esc(t) + '</span>';
  const rcMark = () => mark(18).replace('<svg ', '<svg class="mark" ');
  const rcAimy = (text, prov, acts, top) => '<div class="aimy"' + (top ? '' : ' style="margin-top:14px"') + '>' + rcMark() + '<div>' + text +
    (prov ? '<div class="prov">' + prov + '</div>' : '') + (acts ? '<div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">' + acts + '</div>' : '') + '</div></div>';
  const rcWarn = (html, acts) => '<div class="warnbox" style="margin-top:10px">' + svg('tri', 14) + '<div>' + html +
    (acts ? '<div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">' + acts + '</div>' : '') + '</div></div>';
  const rcNote = (ico, html) => '<div class="note">' + svg(ico, 14) + '<span>' + html + '</span></div>';
  const rcCrit = (ico, tone, label, body, right) => '<div class="crit"><span class="' + (RC_ICO[tone] || 'ico mute') + '">' + svg(ico, 18) + '</span>' +
    '<div><b>' + label + '</b>' + (body || '') + '</div>' + (right || '<span></span>') + '</div>';
  const rcGate = (ico, tone, label, say, right) => '<div class="gate"><span class="' + (RC_ICO[tone] || 'ico mute') + '">' + svg(ico, 18) + '</span>' +
    '<div><b>' + label + '</b><div class="sub">' + say + '</div></div>' + right + '</div>';
  const rcQuote = (html) => '<div class="quote">' + html + '</div>';
  const rcSay = (html) => '<div class="sub" style="margin-top:3px">' + html + '</div>';
  const rcFoot = (left, right) => '<div class="foot"><span>' + left + '</span>' + (right ? '<span>' + right + '</span>' : '') + '</div>';
  const initials = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  function rcard(o) {
    return '<section class="rc s-block-wide" aria-label="' + esc(o.label || o.cap) + '">' +
      (o.amber ? '<div class="eyebrow amber">' : '<div class="eyebrow">') + svg(o.ico, 14) + ' ' + esc(o.cap) + '</div>' +
      (o.cards || ['<div class="card">' + o.body + '</div>']).join('') + '</section>';
  }
  const shortAcc = (a) => a.name.split(' ')[0];
  /* What the CV says on one must-have, as a line to quote: the skill or
     language it names, else the job it describes. Read as data. */
  function cvSays(c, m) {
    const ml = m.toLowerCase();
    const sk = (c.skills || []).filter((s) => ml.indexOf(s.toLowerCase().split(' ')[0]) >= 0)[0];
    const lg = (c.langs || []).filter((l) => ml.indexOf(l.toLowerCase()) >= 0)[0];
    if (sk) return sk + ', in the CV';
    if (lg) return lg + ', listed';
    if (/year|experience/.test(ml)) return plural(c.years, 'year') + ', ' + lower(c.at);
    return c.at;
  }

  /* ── THE REASON PICKER (P1) ── one reason from a fixed list, as the
     sendout's .reasons chips; a pressed reason is the pass, with Undo.
     Other takes one line. Outside a component card it brings its own .rc. */
  function passPicker(c, inCard) {
    const other = PASSING.other;
    const body = '<div style="margin-top:12px" role="group" aria-label="Why ' + esc(isClient() ? 'you pass on ' : 'the client passed on ') + esc(c.name) + '">' +
      rcCaps(isClient() ? 'Why · pick one' : 'Why · the client picks one') +
      '<div class="reasons">' + DECLINE.map((d) => other && d.k === 'other'
        ? '<button class="chip on" type="button" data-pass-why="' + c.id + '|' + d.k + '">' + svg('check', 12) + ' ' + esc(d.label) + '</button>'
        : '<button class="chip" type="button" data-pass-why="' + c.id + '|' + d.k + '">' + esc(d.label) + '</button>').join('') + '</div>' +
      (other ? '<div class="t-addnote t-input-wrap" id="wrapPass"><input class="dial-input t-input" id="passNote" type="text" autocomplete="off" placeholder="One line on why" aria-label="Why, in one line" value="' + esc(PASSING.line || '') + '">' +
        rcBtn('Pass', 'data-pass-other="' + c.id + '"', 'primary') + '</div>' : '') +
      rcNote('info', 'Reason codes · not free text · feeds matching for ' + esc(accOf(reqOf(c)).name) + ' only. ' + rcBtn('Keep ' + first(c.name) + ' in', 'data-pass-cancel', 'quiet')) +
    '</div>';
    return inCard ? body : '<div class="rc rc-pick">' + body + '</div>';
  }

  function outPicker(c, inCard) {
    const other = OUTING.other;
    const body = '<div style="margin-top:12px" role="group" aria-label="Why ' + esc(c.name) + ' is not progressing">' +
      rcCaps('Why not progressing · pick one') +
      '<div class="reasons">' + OUT_WHY.map((d) => other && d.k === 'other'
        ? '<button class="chip on" type="button" data-out-why="' + c.id + '|' + d.k + '">' + svg('check', 12) + ' ' + esc(d.label) + '</button>'
        : '<button class="chip" type="button" data-out-why="' + c.id + '|' + d.k + '">' + esc(d.label) + '</button>').join('') + '</div>' +
      (other ? '<div class="t-addnote t-input-wrap" id="wrapOut"><input class="dial-input t-input" id="outNote" type="text" autocomplete="off" placeholder="One line on why" aria-label="Why, in one line" value="' + esc(OUTING.line || '') + '">' +
        rcBtn('Not progressing', 'data-out-other="' + c.id + '"', 'primary') + '</div>' : '') +
      rcNote('lock', 'Kept with us. The answer ' + esc(first(c.name)) + ' gets does not quote it. ' + rcBtn('Keep ' + first(c.name) + ' in', 'data-out-cancel', 'quiet')) +
    '</div>';
    return inCard ? body : '<div class="rc rc-pick">' + body + '</div>';
  }

  /* ── THE WRITE-UP BEFORE A PROFILE GOES (AI submission write-up) ── Send
     opens AiMY's draft in place: who they are, the must-haves they meet,
     what an interview confirmed, what is not known yet, and their notice.
     Never salary, margin or an internal note: the client reads this. The
     recruiter edits it, and Approve and send is the send, with Undo. */
  let WRITING = null;
  const writeOpen = (c) => !!WRITING && WRITING.id === c.id;
  function writeUp(c) {
    const q = reqOf(c);
    const conf = verified(c).filter((x) => x.state === 'verified').map((x) => x.must);
    /* Silent in the CV but confirmed in an interview is known. */
    const met = q.must.filter((m, i) => c.ev[i] === 'm'), unk = q.must.filter((m, i) => c.ev[i] === 'n' && conf.indexOf(m) < 0);
    return first(c.name) + ': ' + c.at + ', ' + plural(c.years, 'year') + ' of experience; speaks ' + c.langs.join(', ') + '. ' +
      'Meets ' + met.length + ' of ' + q.must.length + ' must-haves' + (met.length ? ': ' + met.join('; ') : '') + '. ' +
      (conf.length ? 'Confirmed in interview: ' + conf.join('; ') + '. ' : '') +
      (unk.length ? 'Not known yet: ' + unk.join('; ') + '. ' : '') +
      (c.notice ? 'Notice: ' + c.notice + '.' : '');
  }
  /* The write-up that went with a profile. One sent before this record was
     kept is the draft as AiMY would have written it, approved by the
     requisition's recruiter, which is what the sendout already said. */
  const wuOf = (c) => c.writeup || (c.sentDay != null ? { text: writeUp(c), by: reqOf(c).rec, day: c.sentDay } : null);
  function writeBox(c, inCard) {
    const a = accOf(reqOf(c));
    const body = '<div style="margin-top:12px">' + rcCaps('The write-up · what ' + a.name + ' reads') +
      rcAimy('AiMY drafted this from the CV, the interviews and the evidence. Salary, margin and internal notes are left out. Edit anything before it goes.', 'from ' + plural(ivsOf(c).filter((v) => v.status === 'done').length, 'interview') + ' and the success profile') +
      '<div class="t-input-wrap" id="wrapWu" style="margin-top:10px"><textarea class="dial-input t-area t-input" id="wuText" rows="5" aria-label="The write-up the client reads">' + esc(WRITING.text) + '</textarea>' +
        '<p class="t-error-msg">The client needs a line or two about them.</p></div>' +
      '<div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">' + rcBtn('Approve and send to ' + a.name, 'data-wu-send="' + c.id + '"', 'primary', 'send') +
        rcBtn('Not yet', 'data-wu-cancel', 'quiet') + '</div>' +
    '</div>';
    return inCard ? body : '<div class="rc rc-pick">' + body + '</div>';
  }

  /* ── 1. THE SENDOUT, WITH THE CLIENT'S REASON (client-sendout-reason-codes) ── */
  function sendoutCard(c) {
    if (c.sentDay == null) return '';
    const q = reqOf(c), a = accOf(q);
    const passed = c.exit === 'clientno', met = !passed && c.decideDay != null;
    const who = a.id === 'northwind' ? DESKS.jana.name : 'their hiring team';
    const pill = passed ? rcChip(isClient() ? 'You declined' : 'Client declined', 'err') : met ? rcChip('Wants to meet', 'ok')
      : c.openDay != null ? rcChip('Opened, no decision', 'warn') : rcChip('Not opened yet');
    const ev = (tone, head, rest) => '<div class="' + RC_EV[tone] + '"><b>' + head + '</b>' + (rest ? ' <span class="sub">· ' + rest + '</span>' : '') + '</div>';
    const wu = wuOf(c), wuBy = wu && DESKS[wu.by] ? DESKS[wu.by].name : 'the recruiter';
    const sentSay = isClient() ? 'by ' + esc(wuBy) + ', FlairsTech' : (c.sentDay - q.opened) + ' days after the request opened · write-up approved by ' + esc(wuBy);
    const pick = passed && c.decline ? '<div style="margin-top:12px">' + rcCaps(isClient() ? 'Why · you picked one' : 'Why · the client picks one') +
      '<div class="reasons">' + DECLINE.map((d) => d.k === c.decline.why ? '<span class="chip on">' + svg('check', 12) + ' ' + esc(d.label) + '</span>' : '<span class="chip">' + esc(d.label) + '</span>').join('') + '</div></div>' : '';
    const n = passed && c.decline ? accDeclines(a.id, MONTH).filter((x) => x.decline.why === c.decline.why).length : 0;
    return rcard({ cap: isClient() ? 'Your desk · the profile we sent' : 'Client desk · the sendout', ico: 'send', label: 'The sendout',
      body: rcHead('Profile sent · ' + esc(c.name), 'to ' + esc(a.name) + ' · ' + esc(q.title), pill) +
        '<div class="tl">' +
          ev('ok', 'Sent ' + esc(sayDay(c.sentDay)), sentSay) +
          (c.openDay != null ? ev('ok', 'Opened by the client ' + esc(sayDay(c.openDay)), esc(who)) : ev('wait', 'Not opened yet', 'sent ' + esc(sayWhen(c.sentDay)))) +
          (passed ? ev('err', 'Declined ' + esc(sayDay(c.decideDay != null ? c.decideDay : 0)), c.decline && c.decline.note ? '“' + esc(c.decline.note) + '”' : esc(lower(DECLINE_K[c.decline ? c.decline.why : 'other'].label)))
            : met ? ev('ok', 'Wants to meet · ' + esc(sayDay(c.decideDay)), 'the client interview is next')
            : c.openDay != null ? ev('wait', 'Decision', 'waiting ' + days(-c.openDay)) : '') +
        '</div>' +
        (wu ? '<div style="margin-top:12px">' + rcCaps(isClient() ? 'What we wrote' : 'The write-up · what the client read') + rcQuote(esc(wu.text)) + '</div>' : '') +
        (passOpen(c) ? passPicker(c, true) : pick) +
        (passed && c.decline ? rcAimy('This is the ' + nth(Math.max(1, n)) + ' ' + esc(shortAcc(a)) + ' decline this month for ' + esc(DECLINE_K[c.decline.why].say) + '. It now counts in ' + esc(shortAcc(a)) + '’s success profile as a learning signal.',
          'Reason codes · not free text · feeds matching for this account only') : '') +
        (isClient() && !c.exit && c.stage === 'sent' && !passOpen(c) ? '<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">' +
          rcBtn('Invite to interview', 'data-move="' + c.id + '|client"', 'primary', 'cal') + rcBtn('Decline with a reason', 'data-pass-open="' + c.id + '"') + '</div>' : '') });
  }

  /* ── 3. EVIDENCE PER CRITERION (scoring-evidence-per-criterion) ── the
     count is the score, each criterion quoted, an unknown said as unknown
     with one way to find out. Never a percentage (D2). */
  function evidenceCard(c) {
    const q = reqOf(c), works = isRec() || isHR();
    const met = c.ev.filter((e) => e === 'm').length, unk = c.ev.filter((e) => e === 'n').length, part = c.ev.filter((e) => e === 'p').length, all = c.ev.length;
    const lane = met === all ? ['Lane · Strong fit', 'ok'] : met + unk === all ? ['Lane · Fit, to check', 'warn'] : met * 2 >= all ? ['Lane · Partial fit', 'warn'] : ['Lane · Weak fit', ''];
    const asks = c.asks || [];
    return rcard({ cap: 'Scoring and matching', ico: 'listc', label: 'Against the success profile',
      body: rcHead(esc(c.name), esc(q.title) + ' · ' + esc(accOf(q).name), rcChip(lane[0], lane[1])) +
        '<div class="row between" style="margin-top:14px;align-items:flex-end"><div><div class="big">' + met + ' of ' + all + '</div><div class="sub" style="margin-top:4px">required criteria met, each quoted</div></div>' +
          (unk ? rcChip(unk + ' not known yet', 'warn', 'qc') : part ? rcChip(part + ' partly', 'warn') : '') + '</div>' +
        '<div class="segs" aria-hidden="true">' + c.ev.map((e) => e === 'm' ? '<i class="ok"></i>' : '<i class="warn"></i>').join('') + '</div>' +
        '<div style="margin-top:12px">' + q.must.map((m, i) => {
          const e = c.ev[i];
          if (e === 'n') return rcCrit('qc', 'warn', esc(m), rcSay('The CV is silent here. Not the same as Not met.'),
            works && !c.exit ? (asks.indexOf(i) >= 0 ? rcChip('On the list') : rcBtn('Ask ' + first(c.name), 'data-ask-must="' + c.id + '|' + i + '"', 'small', 'msg')) : rcChip('Not known', 'dash'));
          return rcCrit(e === 'm' ? 'okc' : 'warnc', e === 'm' ? 'ok' : 'warn', esc(m), rcQuote('“' + esc(cvSays(c, m)) + '”'), rcChip(EVW[e], e === 'm' ? 'ok' : 'warn'));
        }).join('') + '</div>' +
        rcFoot(svg('hist', 12) + ' Criteria v' + ((q.mustV || 0) + 1) + ' · set by ' + esc(hmOf(q).name) + ', ' + esc(sayDay(q.opened)), works ? 'Overridable · you decide' : 'Read against your success profile') });
  }

  /* ── 2. WHAT WE VERIFIED (candidate-verified-skills) ── CV says next to
     interview found, each finding confirmed by the interviewer, with where
     it was said. */
  function verifiedCard(c, v) {
    const works = isRec() || isHR();
    const asks = c.asks || [];
    const ivN = ivsOf(c).filter((x) => x.status === 'done').length, asN = DB.sends.filter((s) => s.cand === c.id && s.status === 'done').length;
    const last = v.reduce((d, x) => (x.seen[0] && (d == null || x.seen[0].day > d) ? x.seen[0].day : d), null);
    const STV = { verified: ['Confirmed', 'ok'], differs: ['Differs', 'warn'], partly: ['Partly shown', 'warn'], notshown: ['Not shown', ''], unproven: ['Not checked', 'dash'] };
    return rcard({ cap: 'Candidates and history', ico: 'badge', label: 'What we verified',
      body: rcHead(esc(c.name) + ' · what we verified', 'Across ' + plural(ivN, 'interview') + ' and ' + plural(asN, 'assessment') + ' · every new requisition starts here',
          last != null ? rcChip('Last checked ' + sayDay(last), 'acc', 'hist') : rcChip('Nothing checked yet', 'dash')) +
        '<table style="margin-top:14px"><tr><th>Skill or experience</th><th>CV says</th><th>Interview found</th><th></th><th>Evidence</th></tr>' +
          v.map((x, i) => {
            const best = x.seen[0], s = STV[x.state];
            const asked = asks.indexOf(i) >= 0;
            return '<tr><td><b>' + esc(x.must) + '</b></td>' +
              '<td>' + esc(x.cv === 'n' ? 'Silent' : cvSays(c, x.must)) + '</td>' +
              '<td>' + (best ? esc(best.note || RATE[best.r]) : 'Not asked yet') + '</td>' +
              '<td>' + rcChip(s[0], s[1]) + '</td>' +
              '<td class="sub"><span class="row" style="gap:5px">' + (best ? '<span class="ico brand">' + svg('play', 14) + '</span>' + esc(STAGE[best.stage].label) + ', ' + esc(sayDay(best.day))
                : '<span class="ico brand">' + svg('ring', 14) + '</span>' + (asked ? 'On the list for the next interview' : works && !c.exit ? rcBtn('Ask in the next interview', 'data-ask-must="' + c.id + '|' + i + '"', 'quiet') : 'Not asked yet')) + '</span></td></tr>';
          }).join('') +
        '</table>' +
        (isClient() ? '' : rcNote('info', 'AiMY suggests each finding from the transcript; the interviewer confirms it before it lands here. The candidate sees and edits only their own layer: what the CV says.')) });
  }
  function passWith(c, why, line) {
    const was = { exit: c.exit, since: c.since, decline: c.decline || null, decideDay: c.decideDay, told: c.told };
    write(c, { exit: 'clientno', since: 0, decline: { why: why, note: line || '', day: 0, by: DESK }, decideDay: 0, told: false });
    const e = note(c, 'out', (isClient() ? me().name + ' passed: ' : 'The client passed, recorded by ' + me().name + ': ') +
      lower(DECLINE_K[why].label) + (line ? ', “' + line + '”' : '') + '.');
    PASSING = null;
    /* The client's decision goes back to the recruiter who sent the profile. */
    const n = isClient() ? tellDesk(reqOf(c).rec, { sev: 'p1', type: 'Client decision', cta: 'Open ' + first(c.name), go: { cand: c.id },
      body: accOf(reqOf(c)).name + ' passed on ' + c.name + ': ' + lower(DECLINE_K[why].label) + '. They are owed an answer within ' + TELL_DAYS + ' days.' }) : null;
    paint();
    toast('Passed on ' + first(c.name) + ': ' + lower(DECLINE_K[why].label), () => { write(c, was); unmake('events', e); untell(n); paint(); }, declineFeeds(c));
  }

  /* ── THE SENDOUT (P1, R2) ── sent, opened, decided, each dated. A profile
     with a client is a record with its own life, so "6 days with the
     client" can say whether anybody has looked. */
  function sendout(c) {
    if (c.sentDay == null) return '';
    const dec = c.exit === 'clientno' ? 'Passed' + (c.decline ? ': ' + lower(DECLINE_K[c.decline.why].label) : '')
      : c.decideDay != null ? 'Wants to meet' : 'Decided';
    const steps = [['Sent', c.sentDay], ['Opened', c.openDay], [dec, c.decideDay]];
    return '<ol class="t-sendout" aria-label="The profile with the client">' + steps.map((s, i) => {
      const done = s[1] != null;
      const now = !done && steps[i - 1] && steps[i - 1][1] != null;
      return '<li class="t-so-step' + (done ? ' is-done' : now ? ' is-now' : '') + '"><span class="t-so-dot" aria-hidden="true"></span>' +
        '<span class="t-so-cap">' + esc(s[0]) + '</span><span class="t-so-day">' + (done ? esc(sayWhen(s[1])) : now ? 'waiting' : 'not yet') + '</span></li>';
    }).join('') + '</ol>';
  }

  /* ── WHY CLIENTS PASS ── the reasons counted, one row each to scale, the
     lead reason marked in words as well as colour, and what AiMY does with
     it. Read on a requisition, an account and the reports. */
  function reasonsBlock(list, who, accId) {
    if (!list.length) return '';
    const counts = declineCounts(list);
    const top = counts[0];
    const rule = accId ? accRule(accId) : null;
    const prop = accId ? declineProposals().filter((p) => p.acc === accId)[0] : null;
    const notes = list.filter((c) => c.decline.note).slice(0, 2);
    return '<section class="s-block s-block-wide" aria-label="Why ' + esc(who) + ' passed">' +
      '<div class="s-camp-list-head"><h2 class="s-block-h">Why ' + esc(who) + ' passed</h2><span class="s-block-say">' + plural(list.length, 'decline') + ' · one reason each</span></div>' +
      '<div class="t-funnel">' + counts.map((x) => '<div class="t-fn-row' + (x === top && top.n >= 2 ? ' is-top' : '') + '"><span class="t-fn-label">' + esc(x.d.label) + '</span>' +
        '<span class="t-fn-track"><span class="t-fn-fill" style="width:' + (x.n / top.n * 100).toFixed(1) + '%"></span></span>' +
        '<span class="t-fn-n"><b>' + x.n + '</b> · ' + Math.round(x.n / list.length * 100) + '%</span></div>').join('') + '</div>' +
      aimyBlock({ text: (top.n >= 2 ? '<b>' + top.n + ' of ' + list.length + '</b> name ' + esc(lower(top.d.label)) + '. ' : 'No reason stands out yet. ') +
        (rule ? 'A rule is in force, approved by ' + esc(DESKS[rule.decidedBy] ? DESKS[rule.decidedBy].name : 'the HR Manager') + ': ' + esc(rule.rule)
          : prop && !prop.rec ? 'AiMY has proposed a change to the HR Manager: ' + esc(prop.rule)
          : accId ? 'AiMY proposes a change once there are five declines in 90 days and one reason is behind a third of them.' : 'Each reason feeds matching for its own client only.') +
        (notes.length ? ' Said under Other: ' + notes.map((c) => '“' + esc(c.decline.note) + '”').join(', ') + '.' : ''), from: 'every decline with a reason' }) +
    '</section>';
  }

  /* ── 5. THE INSIGHTS LAYER (insight-sentence-and-metric) ── one finding
     in AiMY's box with one action, then each figure it rests on as a tile:
     the number, what it is of, and its unit, start and stop spelled out. */
  function insight(o) {
    return rcard({ cap: 'Insights layer', ico: 'bars', label: o.label, cards: [
      rcAimy(o.say, o.src, o.act, true),
      '<div class="two" style="margin-top:14px">' + o.metrics.map((m) => '<div class="tile"><div class="sub">' + esc(m.cap) + '</div>' +
        '<div class="row" style="align-items:baseline;gap:8px;margin-top:6px"><span class="big">' + esc(m.n) + '</span><span class="sub">' + esc(m.of) + '</span></div>' +
        '<div class="def">' + m.def.map((d) => '<span>' + esc(d[0]) + '</span><b>' + esc(d[1]) + '</b>').join('') + '</div></div>').join('') + '</div>',
      o.foot ? rcNote('users', o.foot) : ''] });
  }

  /* ── WHAT A BLOCK READS (M8) ── the record each part of the briefing
     needs, and whether that record exists today or is one Talent adds. */
  const srcNote = (reads) => '<p class="t-src"><span class="t-src-cap">Reads</span>' + reads.map((x) =>
    '<span class="t-src-k' + (x[1] ? ' is-new' : '') + '"' + (x[1] ? ' title="A record AiMY Talent adds. The dashboard does not have it today."' : '') + '>' + esc(x[0]) + (x[1] ? ' · new' : '') + '</span>').join('') + '</p>';

  /* ── SELECT MANY, ACT ONCE (M7) ── a tick on each row, and a bar holding
     the count and the verbs while anything is ticked. One press acts on
     all of them; one Undo takes all of it back. */
  const SEL = { find: {}, sourced: {}, tell: {} };
  const selN = (k) => Object.keys(SEL[k]).length;
  const selBox = (k, id, name) => '<button class="t-check t-sel' + (SEL[k][id] ? ' is-on' : '') + '" type="button" data-sel="' + k + '|' + id + '" aria-pressed="' + !!SEL[k][id] + '" aria-label="Select ' + esc(name) + '">' + (SEL[k][id] ? svg('check', 12) : '') + '</button>';
  function batchBar(k, acts) {
    const n = selN(k);
    if (!n) return '';
    return '<div class="t-batch" role="region" aria-label="' + n + ' selected"><span class="t-batch-n"><b>' + n + '</b> selected</span>' +
      '<span class="t-acts">' + acts + '<button class="b-ghost" type="button" data-sel-clear="' + k + '">Clear</button></span></div>';
  }

  /* ── A MESSAGE BEFORE IT GOES (M4) ── the HR Manager's template, filled
     for one real person, with the channel it goes by. Nothing is sent from
     here; the verb beside it sends. */
  const tellText = (c) => TELL_TPL.replace('{first}', first(c.name)).replace('{role}', reqOf(c).title).replace('{me}', me().name);
  function msgPreview(c) {
    return '<div class="t-msg"><p class="t-msg-cap">The message · HR template “Decline, after screening”, approved by ' + esc(DESKS.dina.name) + '</p>' +
      '<p class="t-msg-body">' + esc(tellText(c)) + '</p>' +
      '<p class="t-msg-foot">To ' + esc(first(c.name)) + ' by ' + (c.wa ? 'WhatsApp and email (opted in)' : 'email only: no WhatsApp opt-in') + '. Each person gets their own name and role.</p></div>';
  }
  function tell(ids) {
    const list = ids.map((id) => DB.byId[id]).filter((c) => c && c.told === false);
    if (!list.length) return;
    const es = list.map((c) => { write(c, { told: true }); return note(c, 'out', 'Told by ' + me().name + ' under the HR decline template, by ' + (c.wa ? 'WhatsApp and email.' : 'email.')); });
    SEL.tell = {};
    paint();
    toast(list.length === 1 ? 'Sent the answer to ' + first(list[0].name) : 'Sent the answer to ' + plural(list.length, 'person', 'people'),
      () => { list.forEach((c) => write(c, { told: false })); es.forEach((e) => unmake('events', e)); paint(); },
      'Under the HR template. Their own profile now says so.');
  }

  /* ── CONSENT, AS GIVEN (P9, R8) ── each permission on its own line with
     its date, so nobody guesses whether a WhatsApp message or a recording
     is allowed. WhatsApp needs the person's own opt-in to FlairsTech; a
     number bought or found does not count. */
  function consentList(c) {
    const web = /^Found on/.test(c.source);
    const cv = c.source === 'Applied through the link' ? ['ok', 'Given ' + sayWhen(c.applied != null ? c.applied : -3) + ', when they applied', 'Given']
      : c.source === 'From the talent pool' ? ['ok', 'Agreed to hear about other roles', 'Given']
      : web ? ['warn', c.contactOk ? 'A prospect: first contact approved, no reply yet' : 'A prospect: nothing given yet', 'Prospect']
      : ['ok', 'Given on the first call', 'Given'];
    const wa = c.wa ? ['ok', 'Opted in ' + sayWhen(c.waDay != null ? c.waDay : 0) + '. Updates can go there', 'Allowed'] : ['err', 'No opt-in. Messages go by email', 'Blocked'];
    const rec = ['ok', 'Notice in the invite, said again on the call; they can opt out', 'Asked'];
    /* Each permission as a .gate row of the trust card, with its date. */
    return '<div class="rc rc-flat">' + [['user', 'CV and details', cv], ['msg', 'WhatsApp', wa], ['mic', 'Recording', rec]].map((x, i) =>
      rcGate(x[0], x[2][0], esc(x[1]), esc(x[2][1]), x[2][0] === 'err' ? rcChip(x[2][2], 'err', 'ban') : x[2][0] === 'warn' ? rcChip(x[2][2], 'dash') : rcChip(x[2][2], 'ok'))).join('') + '</div>';
  }
  /* ── 10. TRUST AND LAW (trust-consent-gates) ── where first contact and
     recording are decided: the law's deadline, what first contact may use
     and what it never may, and what a recording needs. Shown on the First
     contact cut and on a prospect's own page. */
  function trustCard(list, who, c) {
    const n = list.length;
    return rcard({ cap: 'Trust and law', ico: 'shield', amber: true, label: 'Trust and law', cards: [
      '<div class="errbox">' + svg('tri', 14) + '<span><b>Egypt Law 151/2020:</b> the grace period ends around 1 Nov 2026. Licence, data protection officer and transfer permit are with legal.</span></div>',
      '<div class="card" style="margin-top:12px"><h4>First contact · ' + esc(who || plural(n, 'web prospect')) + '</h4>' +
        '<div class="gate" style="border-top:0;margin-top:6px"><span class="ico ok">' + svg('mail', 18) + '</span><div><b>Email with a privacy notice</b><div class="sub">Says where we found them; one click to object and be deleted</div></div>' + rcChip('Allowed', 'ok') + '</div>' +
        rcGate('msg', 'err', 'WhatsApp', 'Needs their opt-in to FlairsTech first. Bought numbers don’t count', rcChip('Blocked', 'err', 'ban')) +
        rcGate('globe', 'err', 'Scrape LinkedIn', 'Against LinkedIn’s user agreement', rcChip('Never', 'err', 'ban')) +
        (c ? '<div class="row between" style="margin-top:10px;flex-wrap:wrap"><span class="sub">' + svg('trash', 12) + ' If ' + esc(first(c.name)) + ' objects, by the link in the email or by reply, delete them. One line stays so no search finds them again.</span>' +
          rcBtn('Delete at their request', 'data-forget="' + c.id + '"', 'small', 'trash') + '</div>' : '') +
      '</div>',
      '<div class="card"><h4>Recording an interview</h4>' +
        '<div class="reasons" style="margin-top:10px">' + ['Notice in the invite', 'Opt-out link', 'Spoken notice on calls', 'No bot after opt-out'].map((t) => rcChip(t, 'ok', 'check')).join('') + rcChip('Retention period set per client') + '</div>' +
        rcNote('ban', 'No emotion or personality read from face or voice.') +
      '</div>'] });
  }
  const viaSay = (c) => c.wa ? 'by WhatsApp and email' : 'by email (no WhatsApp opt-in)';

  /* ── A LEARNING PROPOSAL (P5, R6) ── AiMY proposes a change to its own
     rules; the HR Manager approves it, and the version before is kept. One
     card for each kind: a question everyone misses, a client's decline
     pattern. */
  function propCard(p, i) {
    const st = p.rec ? p.rec.state : null;
    const acts = isHR()
      ? (st === 'approved' ? '' : '<button class="s-insight-lnk primary" type="button" data-prop="' + esc(p.key) + '|approve">Approve</button>' +
        (p.kind === 'question' ? '<button class="b-ghost" type="button" data-prop="' + esc(p.key) + '|drop">Drop the question instead</button>' : '') +
        '<button class="b-ghost" type="button" data-prop="' + esc(p.key) + '|later">Not now</button>')
      : st === 'waiting' ? '<span class="b-kind">Waiting on ' + esc(DESKS.dina.name) + '</span>'
      : st ? '' : '<button class="s-insight-lnk primary" type="button" data-prop="' + esc(p.key) + '|send">Send it to ' + esc(DESKS.dina.name) + ' to approve</button>';
    return '<article class="t-prop" style="--i:' + Math.min(i || 0, 8) + '">' +
      '<div class="t-prop-head"><span class="tag tag-' + (st === 'approved' ? 'ok' : 'neutral') + '">' + (st === 'approved' ? 'Approved' : 'Learning proposal') + '</span><b class="t-prop-title">' + esc(p.title) + '</b></div>' +
      aimyBlock({ text: p.evidence, from: p.from }) +
      '<div class="t-prop-diff"><p class="t-prop-was"><span class="t-vcap">Now</span>' + esc(p.was) + '</p><p class="t-prop-to"><span class="t-vcap">Proposed</span>' + esc(p.to) + '</p></div>' +
      '<p class="b-vfoot">' + esc(p.scope) + '</p>' +
      (acts ? '<p class="t-acts">' + acts + '</p>' : '') +
    '</article>';
  }
  /* The question proposals: one for the question most people miss on each
     assessment, until a person has answered it. */
  function rewordOf(qq) {
    const n = JSON.parse(JSON.stringify(qq));
    n.q = qq.type === 'choice' ? 'In one line: ' + qq.q.replace(/\?$/, '') + '? Pick the closest answer.' : qq.q + ' Answer with one example from your own work.';
    if (qq.type === 'choice' && qq.options) n.options = qq.options.map((o, k) => (k === qq.right ? o + ' (the most common cause)' : o));
    return n;
  }
  function qProposals(onlyA) {
    return DB.asmts.filter((a) => !onlyA || a.id === onlyA).map((a) => {
      const rates = qRates(a);
      const i = rates.reduce((w, x, k) => (x != null && (w == null || x < rates[w]) ? k : w), null);
      if (i == null || rates[i] >= 40) return null;
      const key = 'q|' + a.id + '|' + i;
      const rec = DB.props.filter((p) => p.key === key)[0] || null;
      if (rec && rec.state !== 'waiting') return null;
      const qq = a.questions[i];
      return { key: key, kind: 'question', asmt: a.id, i: i, rec: rec, title: 'Reword Q' + (i + 1) + ' of ' + a.title,
        evidence: 'Only <b>' + rates[i] + '%</b> of the ' + resultsOf(a).length + ' people who took it get Q' + (i + 1) + ' right. When nearly everyone misses one question, the question is usually the problem.',
        from: 'every result on this assessment', was: qq.q, to: rewordOf(qq).q,
        scope: 'New attempts get the new wording. Results so far keep theirs, and the old wording stays on the question as version ' + ((qq.versions || []).length + 1) + '.' };
    }).filter(Boolean);
  }
  function dProposals() {
    return declineProposals().filter((p) => !p.rec || p.rec.state === 'waiting').map((p) => {
      const a = ACCOUNTS.filter((x) => x.id === p.acc)[0];
      return { key: 'd|' + p.acc + '|' + p.why, kind: 'decline', acc: p.acc, why: p.why, rule: p.rule, rec: p.rec, title: a.name + ': ' + lower(DECLINE_K[p.why].label),
        evidence: '<b>' + p.n + ' of ' + p.of + '</b> declines from ' + esc(a.name) + ' in the last 90 days name ' + esc(lower(DECLINE_K[p.why].label)) + '.',
        from: 'the reasons ' + a.name + ' gave', was: 'Profiles go to ' + a.name + ' on the success profile alone.', to: p.rule,
        scope: a.name + ' only. Every other client keeps its own rules. Undo for six seconds; the rule can be lifted from here at any time.' };
    });
  }

  /* A question's earlier wordings, newest first, behind one press. */
  function verHist(qq) {
    const v = qq.versions || [];
    if (!v.length) return '';
    const last = v[v.length - 1];
    return '<div class="t-acc" data-acc-open="false"><p class="b-vfoot">Version ' + (v.length + 1) + ', approved by ' + esc(DESKS[last.by] ? DESKS[last.by].name : 'the HR Manager') + ' ' + esc(sayWhen(last.day)) + '. ' + esc(last.why) + ' ' +
      '<button class="t-inline-link t-acc-head" type="button" aria-expanded="false" data-acc-toggle>Earlier wording<span class="t-acc-chevron">' + svg('down', 12) + '</span></button></p>' +
      '<div class="t-acc-panel"><div class="t-acc-panel-inner"><div class="t-qlist">' + v.slice().reverse().map((x) => '<p class="t-q"><span class="tag tag-neutral">Version ' + x.v + '</span><span>' + esc(x.q) + '</span></p>').join('') + '</div></div></div></div>';
  }
  /* A person answers a proposal. Approving a question rewords it, or drops
     it, and keeps the wording before; approving a decline rule puts it in
     force for that one client. Sending is the recruiter handing it on. */
  function propAct(key, act) {
    const view = qProposals().concat(dProposals()).filter((p) => p.key === key)[0];
    const rec0 = DB.props.filter((p) => p.key === key)[0] || null;
    if (!view) return;
    const before = rec0 ? JSON.parse(JSON.stringify(rec0)) : null;
    const state = act === 'send' ? 'waiting' : act === 'later' ? 'later' : 'approved';
    const fields = { state: state, decidedBy: act === 'send' ? null : DESK, rule: view.rule || null, act: act };
    let rec = rec0;
    if (rec) put('props', rec, fields);
    else rec = make('props', Object.assign({ id: uid('pr'), key: key, kind: view.kind, acc: view.acc || null, why: view.why || null, asmt: view.asmt || null, i: view.i != null ? view.i : null, by: DESK, day: 0 }, fields));
    let undoQ = null;
    if (state === 'approved' && view.kind === 'question') {
      const a = asmtOf(view.asmt), i = view.i;
      const was = JSON.parse(JSON.stringify(a.questions)), qs = JSON.parse(JSON.stringify(a.questions)), wasDropped = (a.dropped || []).slice();
      const rate = qRates(a)[i];
      const sends = DB.sends.filter((s) => s.asmt === a.id && s.answers).map((s) => ({ s: s, a: s.answers.slice() }));
      if (act === 'drop') {
        put('asmts', a, { dropped: wasDropped.concat([{ q: qs[i].q, day: 0, by: DESK }]) });
        qs.splice(i, 1);
        sends.forEach((x) => { const an = x.a.slice(); an.splice(i, 1); put('sends', x.s, { answers: an }); });
      } else {
        const old = qs[i];
        const n = rewordOf(old);
        n.versions = (old.versions || []).concat([{ v: (old.versions || []).length + 1, q: old.q, day: 0, by: DESK, why: 'Reworded: only ' + rate + '% got it right.' }]);
        qs[i] = n;
        sends.forEach((x) => { const an = x.a.slice(); an[i] = null; put('sends', x.s, { answers: an }); });
      }
      put('asmts', a, { questions: qs });
      undoQ = () => { put('asmts', a, { questions: was, dropped: wasDropped }); sends.forEach((x) => put('sends', x.s, { answers: x.a })); };
    }
    paint();
    const said = act === 'send' ? ['Sent to ' + DESKS.dina.name + ' to approve', 'Nothing changes until she approves it.']
      : act === 'later' ? ['Not now', 'AiMY asks again only if the pattern grows.']
      : view.kind === 'decline' ? ['In force for ' + accOf({ acc: view.acc }).name, view.rule + ' Shown on its account and its requisitions.']
      : act === 'drop' ? ['Dropped Q' + (view.i + 1), 'Results drop the same question. The wording is kept on the assessment.']
      : ['Reworded Q' + (view.i + 1), 'The old wording is kept as a version on the question.'];
    toast(said[0], () => { if (undoQ) undoQ(); if (before) put('props', rec, before); else unmake('props', rec); paint(); }, said[1]);
  }

  /* ── THE SAMPLE GATE (P7) ── how many outcomes are in against how many a
     proposal needs. Below the line AiMY proposes nothing from them. */
  function gate(n, of, what, say) {
    return '<div class="t-gate' + (n >= of ? ' is-open' : '') + '"><p class="t-gate-top"><b>' + n + ' of ' + of + '</b> ' + esc(what) + '</p>' +
      '<span class="t-gate-track" role="meter" aria-label="' + esc(what) + '" aria-valuemin="0" aria-valuemax="' + of + '" aria-valuenow="' + Math.min(n, of) + '">' +
        '<span class="t-gate-fill" style="width:' + Math.min(100, n / of * 100).toFixed(1) + '%"></span></span>' +
      '<p class="t-gate-say">' + say + '</p></div>';
  }

  /* ── DOES A QUESTION PREDICT ANYTHING? (P3) ── of the people sent to a
     client after taking it, how many met the client, split by whether they
     got this question right. A difference is only named once both sides
     have five people and the whole has the minimum sample. */
  function qOutcomes(a) {
    const done = resultsOf(a).map((s) => ({ s: s, c: DB.byId[s.cand] }))
      .filter((x) => x.c && x.s.answers && reached(x.c, 'sent') && !(x.c.stage === 'sent' && !x.c.exit));
    return a.questions.map((qq, i) => {
      const l = done.filter((x) => x.s.answers[i] != null);
      const right = l.filter((x) => x.s.answers[i]), wrong = l.filter((x) => !x.s.answers[i]);
      const met = (g) => g.filter((x) => reached(x.c, 'client')).length;
      return { n: l.length, right: right.length, rightMet: met(right), wrong: wrong.length, wrongMet: met(wrong) };
    });
  }
  function outcomeLink(o) {
    if (!o || !o.n) return '';
    if (o.n < GATE) return '<p class="t-olink"><span>Outcomes: <b>' + o.n + ' of ' + GATE + '</b> people sent to a client so far. Too few to say what this question predicts.</span></p>';
    const pr = o.right ? o.rightMet / o.right : 0, pw = o.wrong ? o.wrongMet / o.wrong : 0;
    const enough = o.right >= 5 && o.wrong >= 5;
    const verdict = !enough ? ['neutral', 'Too few missed it to compare'] : pr - pw >= 0.2 ? ['ok', 'Predicts the client’s yes'] : pw - pr >= 0.2 ? ['warn', 'Points the wrong way'] : ['neutral', 'No difference yet'];
    return '<p class="t-olink"><span class="tag tag-' + verdict[0] + '">' + verdict[1] + '</span><span>Got it right: <b>' + o.rightMet + ' of ' + o.right + '</b> met the client. Got it wrong: <b>' + o.wrongMet + ' of ' + o.wrong + '</b>.</span></p>';
  }

  /* ── WHAT AiMY MAY DO (m4) ── one row per action, three rungs. AiMY
     shows its reason for the next rung up; only a person moves it, and the
     move is logged. Coming down is one press too. */
  function ladder() {
    return '<section class="s-block s-block-wide" aria-label="What AiMY may do">' +
      '<div class="s-camp-list-head"><h2 class="s-block-h">What AiMY may do</h2><span class="s-block-say">trust goes up only when a person moves it · every move is logged</span></div>' +
      '<div class="t-ladder">' + AUTO_SEED.map((a) => {
        const at = RUNG.map((g) => g.k).indexOf(autoAt(a.k));
        return '<div class="t-ladder-row"><div class="t-ladder-what"><b>' + esc(a.label) + '</b>' +
          '<span class="t-ladder-why">' + mark(10) + '<span>' + esc(a.why) + '</span></span></div>' +
          '<div class="t-rungs" role="radiogroup" aria-label="' + esc(a.label) + '">' + RUNG.map((g, k) =>
            '<button class="t-rung' + (k <= at ? ' is-on' : '') + '" type="button" role="radio" aria-checked="' + (k === at) + '" data-auto="' + a.k + '|' + g.k + '" title="' + esc(g.say) + '">' + esc(g.label) + '</button>').join('') +
          '</div></div>';
      }).join('') + '</div>' +
      (D.autoLog.length ? '<div class="b-log">' + D.autoLog.slice().reverse().slice(0, 6).map((x, i) => logRow({ tone: '', ico: svg('goal'),
        who: (AUTO_SEED.filter((a) => a.k === x.k)[0] || {}).label + ': ' + RUNG.filter((g) => g.k === x.to)[0].label.toLowerCase(),
        meta: logMeta([DESKS[x.by] ? DESKS[x.by].name : null, x.time, x.up ? 'raised, with AiMY’s reason' : 'lowered']), say: x.up ? esc(x.why) : '', aimy: x.up }, i)).join('') + '</div>'
        : '<p class="b-vfoot">No changes yet. AiMY never moves itself up a rung; its reason sits beside each action.</p>') +
    '</section>';
  }
  function setAuto(k, to) {
    const from = autoAt(k);
    if (from === to) return;
    const order = RUNG.map((g) => g.k);
    const a = AUTO_SEED.filter((x) => x.k === k)[0];
    const had = Object.prototype.hasOwnProperty.call(D.auto, k) ? D.auto[k] : undefined;
    D.auto[k] = to;
    D.autoLog.push({ k: k, from: from, to: to, by: DESK, time: nowTime(), up: order.indexOf(to) > order.indexOf(from), why: a.why });
    save();
    paint();
    toast(a.label + ': ' + RUNG.filter((g) => g.k === to)[0].label.toLowerCase(), () => {
      if (had === undefined) delete D.auto[k]; else D.auto[k] = had;
      D.autoLog.pop(); save(); paint();
    }, order.indexOf(to) > order.indexOf(from) ? 'Raised by ' + me().name + '. Logged with AiMY’s reason.' : 'Lowered. AiMY asks before it does this now.');
  }

  /* ── HIRING OUTCOMES (M10) ── billed hires never alone: beside them, how
     many profiles met the team, how many interviews ended in yes, and who
     was still there at day 90. */
  function outcomeStrip(accId, you) {
    const o = outcomes(accId);
    const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '·');
    const tiles = [
      ['Hires billed', o.billed, 'people hired and billed, the last twelve months'],
      ['Profiles that met ' + (you ? 'your team' : 'their team'), pct(o.met, o.sent), o.met + ' of ' + o.sent + ' profiles ' + (you ? 'you' : 'they') + ' decided on'],
      ['Yes after an interview', pct(o.yes, o.ivs), o.yes + ' of ' + o.ivs + ' client interviews'],
      ['Still there at day 90', pct(o.stayed, o.past), o.stayed + ' of ' + o.past + ' hires whose day 90 has passed'],
    ];
    return '<section class="s-block s-block-wide" aria-label="' + (you ? 'Your hiring with us' : 'Their hiring with us') + '">' +
      '<div class="s-camp-list-head"><h2 class="s-block-h">' + (you ? 'Your hiring with us' : 'Their hiring with us') + '</h2><span class="s-block-say">billed hires, always beside what came of them</span></div>' +
      '<div class="t-kpis">' + tiles.map((t) => '<div class="t-kpi"><span class="t-kpi-cap">' + esc(t[0]) + '</span><b class="t-kpi-n">' + esc(t[1]) + '</b><span class="t-kpi-say">' + esc(t[2]) + '</span></div>').join('') + '</div>' +
    '</section>';
  }

  /* ══ THE CALL ════════════════════════════════════════════════════════════
     Sales's call, for a recruiter. A shell region beside the page with four
     states: ready (who, what to get, the line you call from, Start),
     connecting, live (timer, the transcript while recording, mute, hold,
     hang up), and logging.

     LOGGING IS A SENTENCE, NOT A FORM (Sales's README). Eight outcomes on
     one row with AiMY's read already lit, a line to type underneath that is
     read as you type and overrides the transcript, and a sentence saying
     what Log will do. In Sales the read-back lands in the canvas; Talent has
     no canvas yet, so it lands in the panel the call was in.

     RECORDING NEEDS CONSENT, as in Sales: pressing Record asks whether the
     candidate has been told, and nothing is written down until they have.
     Without a recording AiMY has nothing to read, says so, and lights
     nothing. */
  let CALL = null;
  let CALL_DIAL = null, CALL_TICK = null, CALL_LINE = null;
  let CALL_MIN = false;
  const UI_KEY = 'aimy-talent:ui';
  const UI = (function () { try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; } catch (e) { return {}; } })();
  if (!telLine(UI.line)) UI.line = TEL_LINES[0].id;
  const saveUI = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(UI)); } catch (e) {} };

  function clearCallTimers() {
    if (CALL_DIAL) { clearTimeout(CALL_DIAL); CALL_DIAL = null; }
    if (CALL_TICK) { clearInterval(CALL_TICK); CALL_TICK = null; }
    if (CALL_LINE) { clearInterval(CALL_LINE); CALL_LINE = null; }
  }
  /* Down to a strip so the page can be read mid-call (Sales's callMin). */
  function callMin(on) {
    CALL_MIN = !!on;
    document.body.classList.toggle('is-call-min', CALL_MIN);
  }
  const meFirst = () => first(RECRUITERS[0].name);
  function scriptFor(c, kind) {
    const q = c && DB.reqById[c.req];
    const s = kind ? INBOUND_SCRIPTS[kind] : (c && CALL_SCRIPTS[c.fate]) || CALL_SCRIPTS.pass;
    const fill = (t) => t.split('{first}').join(c ? first(c.name) : 'there').split('{me}').join(meFirst())
      .split('{role}').join(q ? q.title : 'the').split('{years}').join(c ? String(c.years) : 'a few')
      .split('{stage}').join(c ? lower(STAGE[c.stage].label) : 'next stage');
    return s.map((l) => [l[0], fill(l[1])]);
  }
  const busy = () => {
    if (PENDING) { openCanvas(); toast('Log the last call first.', null, 'It is waiting in the conversation.'); return true; }
    if (CALL) { toast('You are already on a call. One line at a time.'); return true; }
    if (RINGING) { toast('A call is coming in. Answer it or let it go first.'); return true; }
    return false;
  };

  function startCall(id, sess) {
    const c = DB.byId[id];
    if (!c || busy()) return false;
    if (c.dnc) { toast(c.name + ' asked not to be called again.'); return false; }
    if (c.badNumber) { toast('The number on file for ' + c.name + ' did not work.'); return false; }
    clearCallTimers();
    CALL = { cand: id, state: 'ready', secs: 0, dir: 'out', from: UI.line, phone: c.phone,
      script: sess ? coachScript(c, sess) : scriptFor(c), shown: 0, note: '', recording: false, asking: false, muted: false,
      held: false, sess: sess || null, lit: null, read: null, video: false, camOff: false };
    document.body.classList.add('is-calling');
    callMin(false);
    paintCall();
    callBrief(c);
    return true;
  }
  function callGo() {
    const c = CALL;
    if (!c || c.state !== 'ready') return;
    /* Call now while the run is paused for a tip is carrying on with it. */
    if (coachHeld(c)) coachAnswer('go', true);
    briefFreeze();
    c.state = 'connecting';
    paintCall();
    CALL_DIAL = setTimeout(() => {
      CALL_DIAL = null;
      if (!CALL || CALL.state !== 'connecting') return;
      liveNow();
    }, DIAL_MS);
  }
  function liveNow() {
    CALL.state = 'live';
    CALL.secs = 0;
    CALL_TICK = setInterval(() => {
      if (!CALL || CALL.state !== 'live') return;
      if (!CALL.held) CALL.secs++;
      const el = byId('callTimer');
      if (el) el.textContent = (CALL.held ? 'On hold · ' : '') + fmtClock(CALL.secs);
    }, 1000);
    CALL_LINE = setInterval(growTranscript, LINE_MS);
    paintCall();
  }
  function growTranscript() {
    const c = CALL;
    if (!c || c.state !== 'live' || !c.recording || c.held) return;
    if (c.shown >= c.script.length) { clearInterval(CALL_LINE); CALL_LINE = null; return; }
    c.shown++;
    const host = byId('callLines');
    if (host) { host.innerHTML = transcriptHtml(c); host.scrollTop = host.scrollHeight; }
  }
  function transcriptHtml(c) {
    if (!c.recording) return '<p class="call-none">Not recording. Nothing is being written down.</p>';
    if (!c.shown) return '<p class="call-none">Recording. Nothing said yet.</p>';
    return c.script.slice(0, c.shown).map((l) => '<p class="call-line ' + (l[0] === 'you' ? 'is-you' : 'is-them') + '">' +
      '<span class="call-who">' + esc(l[0] === 'you' ? meFirst() : 'Them') + '</span>' + esc(l[1]) + '</p>').join('');
  }
  const heardText = (c) => c.script.slice(0, c.shown).map((l) => l[1]).join(' ');

  /* HANGING UP CLOSES THE PANEL (Sales). The call is over, so the panel
     goes, and what AiMY heard is read back in the conversation, where the
     brief already is. A call stopped while it was still connecting is a
     call nobody answered. */
  function endCall() {
    const c = CALL;
    if (!c || c.state === 'ready') return;
    clearCallTimers();
    c.dialing = c.state === 'connecting';
    c.state = 'logging';
    c.read = c.recording && c.shown ? readCall(heardText(c)) : { outcome: null, notice: null, salary: null, when: null };
    c.lit = c.dialing ? 'noanswer' : c.read.outcome || (c.dir === 'in' && c.cand ? 'reached' : null);
    if (!c.cand) c.who = readWho(c.script.slice(0, c.shown));
    briefFreeze();
    /* The conversation it is read back in: the run's, the brief's, or a
       new one for a call that had no brief (a typed number, a stranger). */
    const home = c.sess && c.sess.chat ? c.sess.chat : (CHATS.filter((x) => x.turns.some((y) => y.id === c.brief))[0] || {}).id;
    if (home) CHAT_AT = home;
    else callChat(null, c.cand ? 'A call with ' + DB.byId[c.cand].name : 'A call from ' + c.phone);
    c.chat = CHAT_AT;
    PENDING = c;
    CALL = null;
    document.body.classList.remove('is-calling');
    callMin(false);
    paintCall();
    readbackSay();
  }
  /* What pressing Log will do, said before it is pressed. */
  function willSay(call) {
    const c = DB.byId[call.cand];
    const o = call.lit;
    if (!o) return 'Pick what happened, or type it below.';
    if (!c) return 'Logs a ' + fmtClock(call.secs) + ' call with ' + (call.who || call.phone) + ' in your call log.';
    const q = reqOf(c);
    const early = rank(q, c.stage) <= rank(q, 'phone');
    return {
      passed: early ? 'Logs the call and moves ' + first(c.name) + ' to the HR interview. What they said about notice and salary goes on their record.'
        : 'Logs the call. ' + first(c.name) + ' is past the screen already, so nothing moves.',
      reached: 'Logs the call. Nothing moves.',
      callback: 'Logs the call and puts them back in your calls ' + CB_SAY[cbWhen(call)] + '.',
      noanswer: 'Logs an attempt. They stay in your calls.',
      notfit: 'Logs the call and takes them out as not a fit. Nothing is sent to them until a person approves the message.',
      withdrew: 'Logs the call and takes them out: they are not interested.',
      wrong: 'Logs the call and marks the number as not working.',
      dnc: 'Logs the call and takes them out. Nobody calls this number again.',
    }[o];
  }

  function logCall(stop) {
    const call = PENDING;
    if (!call) return;
    const o = call.lit;
    if (!o) { toast('Pick what happened first.'); return; }
    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const rd = call.read || {};
    const t = { id: 'u' + Date.now().toString(36), cand: call.cand || null, phone: call.phone, who: call.who || null,
      day: 0, time: time, dir: call.dir, secs: call.secs, outcome: o, by: ME, missed: false, from: call.dir === 'out' && !call.video ? call.from : null, video: !!call.video,
      note: call.note || (rd.notice || rd.salary ? 'Said on the call: ' + [rd.notice, rd.salary ? 'expects ' + rd.salary : null].filter(Boolean).join(', ') + '.'
        : call.dir === 'in' ? 'They called in.' : OUTCOME[o].label + '.'),
      lines: call.recording ? call.script.slice(0, call.shown).map((l) => ({ who: l[0], text: l[1] })) : [] };
    const c = DB.byId[call.cand];
    let undo, said;
    if (c) {
      const q = reqOf(c);
      const before = { stage: c.stage, since: c.since, exit: c.exit, maxAt: c.maxAt, callback: c.callback, notice: c.notice,
        salary: c.salary, dnc: c.dnc, badNumber: c.badNumber, fb: c.fb, meet: c.meet, slot: c.slot, told: c.told };
      const f = { callback: null };
      if (rd.notice) f.notice = rd.notice;
      if (rd.salary) f.salary = rd.salary;
      let moved = null;
      if (o === 'passed' && rank(q, c.stage) <= rank(q, 'phone')) {
        moved = 'hr';
        Object.assign(f, { stage: 'hr', since: 0, meet: 2, slot: '11:00', fb: false, maxAt: rank(q, 'hr') > rank(q, c.maxAt) ? 'hr' : c.maxAt });
      }
      call.movedTo = moved;
      if (o === 'callback') f.callback = cbWhen(call);
      if (o === 'noanswer') f.callback = c.callback;
      /* Not a fit on a call was said on the call, so they have been told. */
      if (o === 'notfit') Object.assign(f, { exit: 'out', since: 0, told: true });
      if (o === 'withdrew') Object.assign(f, { exit: 'withdrew', since: 0 });
      if (o === 'dnc') Object.assign(f, { exit: 'withdrew', since: 0, dnc: true });
      if (o === 'wrong') f.badNumber = true;
      write(c, f);
      addCall(t);
      said = 'Logged the call with ' + first(c.name) + ' · ' + OUTCOME[o].label + (moved ? ', moved to the HR interview' : '');
      undo = () => { dropCall(t.id); write(c, before); paint(); };
    } else {
      addCall(t);
      said = 'Logged a call with ' + (call.who || call.phone);
      undo = () => { dropCall(t.id); paint(); };
    }
    const sess = call.sess, was = call.cand;
    /* The read-back keeps its words as the record and loses its buttons,
       so the same call cannot be logged twice. */
    const ch = CHATS.filter((x) => x.id === call.chat)[0];
    const rt = ch ? ch.turns.filter((x) => x.id === call.turn)[0] : null;
    if (rt) rt.html = 'Logged: <b>' + esc(OUTCOME[o].label.toLowerCase()) + '</b>' + (c ? ' with ' + esc(first(c.name)) : '') + (call.movedTo ? ', moved to the HR interview' : '') + '.';
    if (sess) { (sess.log = sess.log || []).push({ cand: was, o: o, moved: !!call.movedTo }); coachNote(call); }
    PENDING = null;
    saveChats();
    paint();
    toast(said, undo);
    /* On a single call the conversation gets out of the way; in a run it
       stays, as the run's record, and the next call is already counting. */
    if (!sess) { closeCanvas(); return; }
    if (stop) { runSummary(sess); return; }
    advance(sess, was);
  }
  /* ══ THE CALL GOES THROUGH THE CONVERSATION (Sales, 28 Oct) ══════════════
     As AiMY Sales does it now. Pressing Call opens the conversation with
     AiMY's brief as its turn, "Before you speak to Mariam Hamdy", and the
     panel on the right is only the call: who, From, Call. Hanging up closes
     the panel; the conversation asks "I read that as passed the screen. Is
     that right?" with the outcome, what was said and where it moves them,
     and Log it is one press, or one typed sentence corrects it. A run is
     one conversation, the record of the run: each brief arrives in it, the
     brief carries Skip this one and Stop the run, and the run ends with
     what it was worth. Nothing here dials anything (the fixture is as
     before).

     THE RECRUITER PLACES EVERY CALL (Engy, 28 Oct). Sales places the next
     call of a run itself after a 30-second count (AIMY-2667). Talent does
     not: the next person is set up with their brief, and the call goes when
     the recruiter presses Call, once they have read it. A count that dials
     somebody by itself read as calling back after thirty seconds. */
  let PENDING = null;
  /* WHEN TO CALL BACK IS THE RECRUITER'S CALL (Engy, 28 Oct): later today,
     tomorrow or next week, read from what was said and changed in one
     press. It is when they come back into Calls, never a call placed by
     itself. */
  const CB_WHEN = [[0, 'Later today'], [1, 'Tomorrow'], [7, 'Next week']];
  const CB_SAY = { 0: 'later today', 1: 'tomorrow', 7: 'next week' };
  const cbWhen = (call) => (call.read && call.read.when != null && CB_SAY[call.read.when] ? call.read.when : 1);
  const narrowCall = () => window.matchMedia('(max-width: 760px)').matches;
  const answerBlock = (title, body, cite) => '<div class="s-ans"><div class="s-ans-title">' + esc(title) + '</div>' +
    '<div class="s-ans-body">' + body + '</div>' + (cite ? '<div class="s-ans-cite"><span>' + esc(cite) + '</span></div>' : '') + '</div>';
  const openQ = (cap, say) => '<blockquote class="b-open"><span class="b-open-cap">' + esc(cap) + '</span><p class="b-open-say">' + say + '</p></blockquote>';
  /* The conversation a call speaks in: the run's own, or a new one. */
  function callChat(sess, title) {
    let ch = sess && sess.chat ? CHATS.filter((x) => x.id === sess.chat)[0] : null;
    if (!ch) {
      ch = { id: uid('ch'), desk: DESK, title: title, turns: [] };
      CHATS.push(ch);
      if (sess) sess.chat = ch.id;
    }
    CHAT_AT = ch.id;
    return ch;
  }
  function callTurn(turn) {
    const ch = chatNow() || callChat(null, 'A call');
    turn.id = turn.id || uid('t');
    ch.turns.push(turn);
    saveChats();
    if (canvasShown()) paintThread(); else openCanvas();
    return turn;
  }
  /* How to open, by where they are: what the person on the other end is
     expecting to hear in the first sentence. */
  function openWith(c) {
    const q = reqOf(c), a = accOf(q);
    if (c.callback != null && c.callback <= 0) return 'They asked you to call back today: say so first, then ask if now is better.';
    if (c.source === 'Found on the web') return 'Say who you are, that you are at FlairsTech, and where you saw their profile. Then ask if they have two minutes to hear about ' + esc(q.title) + '.';
    if (c.stage === 'applied' || c.stage === 'phone' || c.stage === 'sourced') return 'Thank them for applying to ' + esc(q.title) + ' and say this first call takes about ten minutes.';
    return 'A follow-up: say in one sentence why you are calling. They are ' + esc(atStage(c.stage)) + ' for ' + esc(q.title) + (a ? ' with ' + esc(a.name) : '') + '.';
  }
  /* What usually comes back on a screen, and what to say to it. */
  const PUSH = [
    ['Salary', 'Ask what matters to them besides pay before naming any number. The range is not promised on the phone.'],
    ['Notice', 'Ask whether their employer can release them early, and write down the date they say.'],
    ['Not looking', 'Ask what would make them look. If nothing, ask whether you may keep them for the next role.'],
  ];
  function briefHtml(t) {
    const c = DB.byId[t.cand];
    if (!c) return answerBlock('Before you speak to them', '<p class="b-prep-line">They are no longer on file.</p>');
    const q = reqOf(c), a = accOf(q);
    const call = CALL && CALL.brief === t.id ? CALL : null;
    const silent = q.must.filter((m, i) => c.ev[i] === 'n'), partly = q.must.filter((m, i) => c.ev[i] === 'p');
    const early = rank(q, c.stage) <= rank(q, 'phone');
    const last = lastCall(c), calls = callsOf(c.id);
    const body = '<div class="b-prep">' +
      '<p class="b-prep-id">' + esc(q.title) + ' · ' + esc(a.name) + ' · ' + esc(STAGE[c.stage].label) + '</p>' +
      (call && call.video ? videoBlock(c) : '') +
      (t.inbound ? (openQ('Why they called', ringRead(c)) + openQ('What to get', early ? 'Their notice and the salary they expect, if they have time.' : 'Answer what they ask; nothing on this call moves their stage.'))
        : openQ('Open with', openWith(c)) +
          openQ('What to get', early
            ? 'Their notice, the salary they expect' + (silent.length ? ', and what the CV is silent on: ' + esc(silent.join('; ')) + '.' : '.') +
              (partly.length ? ' The CV only partly shows: ' + esc(partly.join('; ')) + '.' : '')
            : 'A follow-up. They are ' + esc(atStage(c.stage)) + ', and nothing on this call moves their stage.') +
          openQ('Last time', last ? esc(callSay(last)) + (last.note && !last.missed ? ' ' + esc(last.note) : '') : 'You have not spoken yet.') +
          (early ? openQ('If they push back', PUSH.map((p) => '<b>' + esc(p[0]) + '.</b> ' + esc(p[1])).join('<br>')) : '') +
          openQ('The role', esc(plural(q.seats || 1, 'seat')) + ' at ' + esc(a.name) + (q.place ? ', ' + esc(q.place) : '') +
            (q.published ? '. It is on the careers page, so you can send them the link.' : '. It is not on the careers page; nothing public to send yet.'))) +
      (call && call.sess && call.state === 'ready'
        ? '<p class="t-acts"><button class="s-inline-btn" type="button" data-call-skip>Skip this one</button><button class="s-inline-btn" type="button" data-sess-stop>Stop the run</button></p>' : '') +
    '</div>';
    return answerBlock((t.inbound ? 'While you have ' : 'Before you speak to ') + c.name + (t.inbound ? ' on the line' : ''), body,
      calls.length ? plural(calls.length, 'call') + ' on the record' : 'Nothing on the record yet');
  }
  function callBrief(c, inbound) {
    callChat(CALL.sess, (inbound ? 'While you have ' : 'Before you speak to ') + c.name + (inbound ? ' on the line' : ''));
    /* Named before it is drawn, so its first paint already knows its call. */
    CALL.brief = uid('t');
    const t = callTurn({ id: CALL.brief, who: 'aimy', kind: 'brief', cand: c.id, inbound: !!inbound });
    /* On a call already under way the brief is final the moment it lands. */
    if (inbound) { t.html = briefHtml(t); saveChats(); paintThread(); }
  }
  /* Frozen when the phone starts dialling: the record of the run keeps the
     brief as it was read, without Skip and Stop, which no longer apply. */
  function briefFreeze() {
    const ch = CHATS.filter((x) => CALL && x.turns.some((y) => y.id === CALL.brief))[0];
    const t = ch && CALL && CALL.brief ? ch.turns.filter((x) => x.id === CALL.brief)[0] : null;
    if (t && !t.html) { const was = CALL.state; CALL.state = 'live'; t.html = briefHtml(t); CALL.state = was; saveChats(); paintThread(); }
  }

  /* ── THE READ-BACK ── what AiMY heard, to agree with or correct. */
  function readbackHtml(t) {
    const call = PENDING;
    if (!call || call.turn !== t.id) return 'This call was left without a log.';
    const c = DB.byId[call.cand], o = call.lit, rd = call.read || {};
    const heard = call.recording && call.shown;
    const said = call.note && o ? 'With what you told me, I have it as <b>' + esc(OUTCOME[o].label.toLowerCase()) + '</b>. Is that right?'
      : call.dialing ? 'Nobody picked up, so I read that as <b>no answer</b>. Is that right?'
      : heard ? (rd.outcome ? 'I read that as <b>' + esc(OUTCOME[rd.outcome].label.toLowerCase()) + '</b>. Is that right?' : 'I could not tell how it went from what was said.')
      : o ? 'I have it as <b>' + esc(OUTCOME[o].label.toLowerCase()) + '</b>.' : 'Nothing was recorded, so I have nothing to read.';
    const q = c ? reqOf(c) : null;
    const moves = c && o === 'passed' && rank(q, c.stage) <= rank(q, 'phone');
    const rows = [['Outcome', o ? OUTCOME[o].label : 'Not picked yet', o ? 'ok' : 'warn']];
    if (rd.notice) rows.push(['Notice', rd.notice, 'neutral']);
    if (rd.salary) rows.push(['Expects', rd.salary, 'neutral']);
    if (moves) rows.push(['Stage', STAGE[c.stage].label + ' → HR interview', 'neutral']);
    if (o === 'callback') rows.push(['Call back', CB_SAY[cbWhen(call)].replace(/^./, (x) => x.toUpperCase()), 'neutral']);
    if (!c) rows.push(['Who', call.who || 'Not on file', 'neutral']);
    const nx = call.dir === 'in' ? null : sessNext(call);
    return said +
      '<p class="s-callsum-note">Or tell me what I got wrong, or press 1 to 8 for the outcome.</p>' +
      '<div class="s-callsum-in-turn"><div class="s-callsum"><div class="s-callsum-rows">' + rows.map((r) =>
        '<div class="s-callsum-row"><span class="s-callsum-cap">' + esc(r[0]) + '</span><span class="s-callsum-val tone-' + r[2] + '">' + esc(r[1]) + '</span></div>').join('') + '</div>' +
        (heard ? '<details class="s-trace"><summary class="s-trace-sum">Transcript<span class="s-trace-n">' + call.shown + '</span></summary>' +
          '<div class="s-said-lines">' + transcriptHtml(call) + '</div></details>' : '') + '</div></div>' +
      '<div class="b-cuts t-log-row" role="group" aria-label="What happened">' + OUTCOMES.map((x) =>
        '<button class="filter-chip' + (o === x.k ? ' active' : '') + '" type="button" data-outcome="' + x.k + '" aria-pressed="' + (o === x.k) + '">' +
          '<span class="t-key" aria-hidden="true">' + OUTCOME[x.k].n + '</span>' + esc(x.label) + '</button>').join('') + '</div>' +
      (o === 'callback' ? '<div class="b-cuts t-log-row" role="group" aria-label="When to call back">' + CB_WHEN.map((w) =>
        '<button class="filter-chip' + (cbWhen(call) === w[0] ? ' active' : '') + '" type="button" data-cb="' + w[0] + '" aria-pressed="' + (cbWhen(call) === w[0]) + '">' + esc(w[1]) + '</button>').join('') + '</div>' : '') +
      '<p class="t-log-will">' + esc(willSay(call)) + '</p>' +
      '<p class="t-acts">' +
        (!c && call.who ? '<button class="btn btn-ghost btn-sm" type="button" data-add-stranger>Add ' + esc(first(call.who)) + ' as a candidate</button>' : '') +
        (nx ? '<button class="btn btn-brand btn-sm" type="button" data-log>Log it and call ' + esc(first(nx.name)) + '</button><button class="btn btn-ghost btn-sm" type="button" data-log="stop">Log it and stop</button>'
          : '<button class="btn btn-brand btn-sm" type="button" data-log>' + (call.sess ? 'Log it and finish' : 'Log it') + '</button>') +
      '</p>';
  }
  function readbackSay() {
    /* A new reading supersedes the last: the old one keeps its words and
       loses its buttons, so the record cannot be logged twice. */
    CHAT_AT = PENDING.chat;
    const ch = chatNow();
    const old = ch && PENDING.turn ? ch.turns.filter((x) => x.id === PENDING.turn)[0] : null;
    if (old && !old.html) old.html = 'Read again below.';
    PENDING.turn = uid('t');
    callTurn({ id: PENDING.turn, who: 'aimy', kind: 'readback' });
  }
  /* A sentence typed while a call waits to be logged is a correction. */
  function callCorrect(text) {
    if (!PENDING) return false;
    CHAT_AT = PENDING.chat;
    const rd = readCall(text);
    PENDING.note = text;
    PENDING.read = PENDING.read || {};
    if (rd.outcome) PENDING.lit = rd.outcome;
    if (rd.notice) PENDING.read.notice = rd.notice;
    if (rd.salary) PENDING.read.salary = rd.salary;
    if (rd.when != null) PENDING.read.when = rd.when;
    callTurn({ who: 'you', html: esc(text) });
    readbackSay();
    return true;
  }

  /* ── WHAT THE RUN WAS WORTH ── said once, at its end, in its conversation. */
  function runSummary(sess) {
    const log = sess.log || [];
    const by = {};
    log.forEach((x) => { by[x.o] = (by[x.o] || 0) + 1; });
    const got = log.filter((x) => x.o !== 'noanswer' && x.o !== 'wrong').length;
    const moved = log.filter((x) => x.moved).length;
    const TONE = { passed: 'ok', reached: 'neutral', callback: 'warn', noanswer: 'neutral', notfit: 'err', withdrew: 'err', wrong: 'err', dnc: 'err' };
    const body = '<p class="s-callsum-note">' + plural(log.length, 'call') + ' · <b>' + got + '</b> got through' + (sess.skipped.length ? ' · ' + sess.skipped.length + ' skipped' : '') + '.</p>' +
      (log.length ? '<div class="b-cuts">' + Object.keys(by).map((k) => '<span class="tag tag-' + TONE[k] + '">' + by[k] + ' ' + esc(OUTCOME[k].label) + '</span>').join('') + '</div>' : '') +
      '<div class="s-callsum-rows"><div class="s-callsum-row"><span class="s-callsum-mem">What it was worth</span><span class="s-callsum-val">' +
        (moved ? '<b>' + plural(moved, 'person', 'people') + '</b> passed the screen and ' + (moved === 1 ? 'is' : 'are') + ' booked for the HR interview.'
          : got ? 'You spoke to ' + plural(got, 'person', 'people') + '; nobody passed the screen this time.' : log.length ? 'Nobody picked up.' : 'Nobody was called.') +
      '</span></div>' + coachSum(sess) + '</div>';
    callChat(sess, 'A run of calls');
    callTurn({ who: 'aimy', html: answerBlock('That run is finished', body, plural(log.length, 'call') + ' written to their records') });
  }
  function stopRun() {
    const sess = CALL && CALL.sess;
    if (!sess) return;
    briefFreeze();
    closeCall();
    paint();
    runSummary(sess);
  }

  /* ══ AiMY COACHES THE RUN (Sales, AIMY-2666) ═════════════════════════════
     While a run goes, AiMY hears the recruiter's calls in threes. When the
     same thing goes less well on two of the three, it pauses the run before
     the next call and says one thing to try, as a suggestion and never as a
     score: in the call panel, and as its turn in the run's conversation.
     "Got it, carry on" or "Not now" resumes the run in one press, with
     Undo. When nothing is wrong, nothing interrupts.

     It coaches the recruiter's own way of speaking (a hello, asking and
     listening, saying what happens next), never anything about the
     candidate: no emotion or personality is read from anyone's voice
     (R8). Recording is not needed; a call nobody picked up says nothing
     about how anyone speaks, so only the calls that got through count.

     For the demo, as in Sales, the run's first three calls always end in a
     tip: the run carries one habit in the recruiter's lines until they take
     the tip on, or the prototype panel picks one. Skip this one keeps the
     run paused. */
  const COACH_N = 3;
  let COACH_FORCE = '';
  const COACH_GOT = ['pass', 'german', 'callback', 'notfit', 'withdrew'];
  const COACH_HELLO = /\b(good morning|morning|afternoon|evening|hello|hi|hey)\b/i;
  const COACH_TALK = [
    'FlairsTech has been placing people for twelve years, with teams in Cairo, Lisbon and Warsaw, and this client is one of our oldest accounts.',
    'The team you would join looks after customers across Europe on every shift, and they are known for keeping their people a long time.',
  ];
  const COACH_RUSH = 'Great, thanks, bye.';
  const coachOn = (n) => (n ? 'On ' + n + ' of your last 3 calls' : 'On your calls so far');
  const COACH = {
    greet: {
      label: 'Say hello first',
      saw: (n) => coachOn(n) + ' you went straight to the role without a hello.',
      tip: 'Try opening with “Good morning, how are you?” before the role. It gives them a moment to settle, and they answer more openly.',
    },
    talk: {
      label: 'Ask, then listen',
      saw: (n, x) => coachOn(n) + ' you did most of the talking, about ' + (x || 8) + ' words in every 10.',
      tip: 'Ask one open question early, like “What are you looking for in your next role?”, and then let them answer. A screen is for hearing them.',
    },
    rush: {
      label: 'Say what happens next',
      saw: (n) => coachOn(n) + ' you said goodbye straight after their last word.',
      tip: 'Before you hang up, say what happens next, like “You will hear from me by Thursday about the HR interview.” They leave sure of the next step.',
    },
  };
  const COACH_KEYS = ['greet', 'talk', 'rush'];
  function coachOf(sess) {
    if (!sess.coach) {
      const h = String(sess.id || '').split('').reduce((n, ch) => n + ch.charCodeAt(0), 0);
      sess.coach = { habit: COACH_KEYS[h % COACH_KEYS.length], log: [], from: 0, checks: 0, tips: [], open: null, fixed: {}, snooze: {} };
    }
    return sess.coach;
  }
  const coachHeld = (call) => !!(call && call.sess && call.sess.coach && call.sess.coach.open);
  /* The habit the recruiter's next call carries, if any. Taking the tip on
     is what ends it. */
  function coachHabit(sess) {
    if (!sess) return null;
    const co = coachOf(sess);
    const h = COACH[COACH_FORCE] ? COACH_FORCE : COACH_FORCE ? null : co.habit;
    return h && !co.fixed[h] ? h : null;
  }
  /* A script with the habit in the recruiter's lines only. Calls that never
     reach the person are left alone. None of the words added is in the
     reader's lexicon, so the read-back is the same either way. */
  function coachScript(c, sess) {
    const lines = scriptFor(c);
    const h = coachHabit(sess);
    if (!h || COACH_GOT.indexOf(c.fate || 'pass') < 0) return lines;
    const out = lines.map((l) => l.slice());
    const opener = out.findIndex((l) => l[0] === 'you');
    if (h === 'greet' && opener >= 0) {
      const s = out[opener][1].replace(/^(hi|hello|good morning|good afternoon)[\s,]*/i, '');
      out[opener][1] = s.charAt(0).toUpperCase() + s.slice(1);
    }
    if (h === 'talk') {
      const pitch = out.findIndex((l, i) => i > opener && l[0] === 'you');
      out.splice(pitch >= 0 ? pitch + 1 : out.length, 0, ['you', COACH_TALK[0]], ['you', COACH_TALK[1]]);
    }
    if (h === 'rush') out.push(['you', COACH_RUSH]);
    return out;
  }
  function coachRescript() {
    const c = CALL && DB.byId[CALL.cand];
    if (c && CALL.sess && CALL.state === 'ready' && CALL.dir !== 'in') CALL.script = coachScript(c, CALL.sess);
  }
  /* What AiMY heard of a call, kept when it is logged: everything said,
     recorded or not. */
  function coachNote(call) {
    const sess = call.sess;
    if (!sess || call.dir === 'in') return;
    const c = DB.byId[call.cand];
    coachOf(sess).log.push({ cand: call.cand, lines: call.script.map((l) => l.slice()), got: !call.dialing && COACH_GOT.indexOf((c && c.fate) || 'pass') >= 0 });
  }
  function coachSigns(calls) {
    const n = { greet: { n: 0 }, talk: { n: 0, x: 0 }, rush: { n: 0 } };
    const words = (ls) => ls.reduce((s, l) => s + l[1].split(/\s+/).length, 0);
    calls.forEach((c) => {
      const you = c.lines.filter((l) => l[0] === 'you');
      if (you.length && !COACH_HELLO.test(you[0][1])) n.greet.n++;
      const share = words(you) / Math.max(1, words(c.lines));
      if (share > 0.65) { n.talk.n++; n.talk.x += share; }
      const last = c.lines[c.lines.length - 1];
      if (last && last[0] === 'you' && /\bbye\b/i.test(last[1]) && last[1].split(/\s+/).length <= 5) n.rush.n++;
    });
    if (n.talk.n) n.talk.x = Math.round((n.talk.x / n.talk.n) * 10);
    return n;
  }
  /* Once three calls have been placed since the last check, AiMY reads the
     ones that got through. A habit on two of the three is a tip; one set
     aside waits a batch. The run's first check always tips (the demo). */
  function coachCheck(sess) {
    const co = coachOf(sess);
    const win = co.log.slice(co.from);
    if (win.length < COACH_N) return null;
    co.from = co.log.length;
    const n = coachSigns(win.filter((x) => x.got));
    co.tips.forEach((t) => { if (t.state === 'go' && !t.after) t.after = n[t.k].n >= 2 ? 'still' : 'better'; });
    const open = (x) => !(co.snooze[x] > co.checks);
    let k = COACH_KEYS.filter((x) => n[x].n >= 2 && open(x)).sort((a, b) => n[b].n - n[a].n)[0];
    if (!k && !co.checks) k = coachHabit(sess) || COACH_KEYS.filter((x) => n[x].n && open(x)).sort((a, b) => n[b].n - n[a].n)[0];
    co.checks++;
    return k ? { k: k, n: n[k].n, x: n[k].x, state: 'open', after: '' } : null;
  }
  /* The tip as a turn. Its last line says where it stands, so the run's
     conversation keeps the record after the buttons are spent. */
  function coachHtml(tip) {
    const m = COACH[tip.k];
    const where = {
      open: 'The run is paused. It carries on with the next call when you answer.',
      go: 'You took this on, and the run carried on.',
      skip: 'Set aside for now. It will not come up again straight away.',
      stopped: 'The run stopped before this was answered.',
    }[tip.state];
    return answerBlock('A tip for your next calls',
      '<p class="b-coach-saw">' + esc(m.saw(tip.n, tip.x)) + '</p>' +
      '<p class="b-coach-tip">' + esc(m.tip) + '</p>' +
      '<p class="b-coach-state' + (tip.state === 'open' ? ' is-open' : '') + '">' + svg(tip.state === 'open' ? 'pause' : tip.state === 'go' ? 'check' : 'clock', 14) +
        '<span>' + esc(where) + '</span></p>' +
      (tip.state === 'open' ? '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-coach="go">Got it, carry on</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-coach="skip">Not now</button></p>' : ''),
      'From your last 3 calls');
  }
  function coachSay(sess, tip) {
    const co = coachOf(sess);
    co.tips.push(tip);
    co.open = tip;
    callChat(sess, 'A run of calls');
    tip.turn = uid('t');
    callTurn({ id: tip.turn, who: 'aimy', html: coachHtml(tip) });
  }
  function coachTurn(sess, tip) {
    const ch = CHATS.filter((x) => x.id === sess.chat)[0];
    const t = ch ? ch.turns.filter((x) => x.id === tip.turn)[0] : null;
    if (!t) return;
    t.html = coachHtml(tip);
    saveChats();
    if (canvasShown()) paintThread();
  }
  /* The answer, from the turn or the panel, or from Call now (`quiet`: the
     call is being placed, so no wait and no toast). Undo puts the run back
     on hold if the next call has not gone yet. */
  function coachAnswer(how, quiet) {
    const sess = CALL && CALL.sess;
    const co = sess && sess.coach;
    const tip = co && co.open;
    if (!tip || (how !== 'go' && how !== 'skip')) return;
    const was = { fixed: co.fixed[tip.k], snooze: co.snooze[tip.k] };
    const apply = (state) => {
      tip.state = state;
      co.open = state === 'open' ? tip : null;
      co.fixed[tip.k] = state === 'go' ? true : was.fixed;
      co.snooze[tip.k] = state === 'skip' ? co.checks + 1 : was.snooze;
      coachTurn(sess, tip);
      if (!CALL || CALL.sess !== sess || CALL.state !== 'ready') return;
      coachRescript();
      paintCall();
    };
    apply(how);
    if (quiet) return;
    const nx = DB.byId[CALL.cand];
    const f = nx ? first(nx.name) : 'the next person';
    toast(how === 'go' ? 'Got it. ' + f + ' is next: try the tip on this call.' : 'Set aside. ' + f + ' is next.', () => apply('open'));
  }
  /* In the panel while the run is paused: that it is, the tip, and the two
     answers. The same tip stands in the conversation; either answers it. */
  function coachBlock(call) {
    const tip = call.sess.coach.open, m = COACH[tip.k];
    const nx = DB.byId[call.cand];
    return '<div class="call-wait call-held" role="group" aria-labelledby="callHeldSay">' +
      '<p class="call-held-say" id="callHeldSay">' + svg('pause', 16) + '<span>Paused before ' + esc(nx ? first(nx.name) : 'the next call') + '</span></p>' +
      '<div class="call-held-tip">' +
        '<p class="call-held-cap"><svg class="b-aimy-mark" width="13" height="15" viewBox="0 0 18 20" aria-hidden="true"><use href="#aimy-logo-small"/></svg>A tip for your next calls</p>' +
        '<p class="call-held-saw">' + esc(m.saw(tip.n, tip.x)) + '</p>' +
        '<p class="call-held-do">' + esc(m.tip) + '</p>' +
      '</div>' +
      '<div class="call-held-acts"><button class="btn btn-brand btn-sm" type="button" data-coach="go">Got it, carry on</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-coach="skip">Not now</button></div>' +
    '</div>';
  }
  /* The run's wrap-up row: every tip and what became of it. */
  function coachSum(sess) {
    const co = sess.coach;
    if (!co) return '';
    if (co.open) { co.open.state = 'stopped'; coachTurn(sess, co.open); co.open = null; }
    const said = co.tips.map((t) => {
      const m = COACH[t.k];
      return '<span class="b-coach-sum"><b>' + esc(m.label) + '.</b> ' + esc(
        t.state === 'go' ? (t.after === 'better' ? 'You took it on, and it showed on the calls after.'
          : t.after === 'still' ? 'You took it on. It still came up on the calls after.' : 'You took it on.')
        : t.state === 'skip' ? 'You set it aside.'
        : t.state === 'later' ? 'For your next run: ' + m.tip
        : 'The run stopped before you answered it.') + '</span>';
    }).join('');
    if (!said && !co.checks) return '';
    return '<div class="s-callsum-row"><span class="s-callsum-mem">What AiMY suggested</span><span class="s-callsum-val">' +
      (said || 'Nothing. AiMY heard ' + plural(co.log.length, 'call') + ' and had nothing to change.') + '</span></div>';
  }

  /* Closing the panel before a call starts: one press, with Undo. In a run
     it is Stop the run. */
  function dismissCall() {
    const was = CALL;
    if (!was || was.state !== 'ready') return;
    if (was.sess) { stopRun(); return; }
    const minWas = CALL_MIN;
    closeCall();
    paint();
    toast('Closed', () => { CALL = was; document.body.classList.add('is-calling'); callMin(minWas); paintCall(); });
  }
  function closeCall() {
    clearCallTimers();
    CALL = null;
    document.body.classList.remove('is-calling');
    callMin(false);
    paintCall();
  }

  /* ── Calling down a list (Sales's callAll session) ── one after another,
     each logged before the next starts. */
  function callAll(ids) {
    const live = ids.filter((id) => canCall(DB.byId[id]));
    if (!live.length) { toast('Nobody here has a number to call.'); return; }
    const sess = { id: uid('s'), ids: live, done: [], skipped: [] };
    startCall(live[0], sess);
  }
  function advance(sess, was) {
    if (was && sess.done.indexOf(was) < 0) sess.done.push(was);
    const next = sess.ids.filter((id) => sess.done.indexOf(id) < 0 && sess.skipped.indexOf(id) < 0 && canCall(DB.byId[id]))[0];
    /* AiMY reads the last three calls before the next one is set up, so a
       tip lands above the next brief and the run waits on it. One found
       after the last call goes to the wrap-up, for the next run. */
    const tip = coachCheck(sess);
    if (!next) { if (tip) { tip.state = 'later'; coachOf(sess).tips.push(tip); } runSummary(sess); return; }
    if (tip) coachSay(sess, tip);
    startCall(next, sess);
  }
  function skipCall() {
    const call = CALL;
    if (!call || !call.sess || call.state !== 'ready') return;
    call.sess.skipped.push(call.cand);
    const sess = call.sess;
    briefFreeze();
    closeCall();
    advance(sess);
  }

  /* The line you call from, as Sales's telPick: a menu, one press. */
  function telPick(where) {
    const on = telLine(UI.line);
    const id = 'telMenu' + where;
    return '<span class="b-menu-wrap tel-pick">' +
      '<button class="b-ghost b-menu-open tel-pick-btn" type="button" data-pickopen="' + id + '" aria-haspopup="menu" ' +
        'aria-label="' + esc('Call from ' + on.num) + '"><span class="tel-pick-num">' + esc(on.num) + '</span>' +
        '<span class="tel-pick-cc">' + esc(on.cc) + '</span>' + svg('down') + '</button>' +
      '<div class="b-menu tel-menu" id="' + id + '" role="menu" hidden>' + TEL_LINES.map((l) =>
        '<button class="b-menu-item' + (l.id === on.id ? ' is-on' : '') + '" type="button" role="menuitemradio" aria-checked="' +
          (l.id === on.id) + '" data-call-line="' + l.id + '"><span class="b-menu-name">' + esc(l.num) + '</span>' +
          '<span class="tel-menu-cc">' + esc(l.cc) + '</span></button>').join('') +
      '</div></span>';
  }

  /* ══ ON VIDEO (Sales) ══════════════════════════════════════════════════
     A screen can be on Teams instead of the phone, and on video how the
     recruiter comes across is read as closely as what they ask. Folded, so
     the brief under it does not move. */
  function videoTips(c) {
    const f = first(c.name), last = lastCall(c);
    const spoken = !!(last && !last.missed && last.outcome !== 'noanswer');
    return [
      spoken ? ['Open', f + ' has spoken to you before. Say the one thing they told you last time in your first sentence, so they see you remember.']
        : ['Open', 'This is the first time ' + f + ' sees you. Smile as the video connects, then say your name, FlairsTech and the role in one sentence.'],
      ['Eye line', 'Put the camera at eye level. Look at the lens, not at their face, when you ask about notice and salary.'],
      ['Listening', 'When they answer, keep your eyes on the screen. Do not read the CV or look at another window while they talk.'],
      ['Their camera', 'If they keep their camera off, carry on as normal. It says nothing about them as a candidate.'],
      ['Camera and room', 'Light in front of you, a plain wall behind, and your phone face down out of shot.'],
    ];
  }
  function videoBlock(c) {
    const tips = videoTips(c);
    return '<details class="b-video"><summary class="b-video-sum">' + svg('video') +
        '<span><b>On video.</b> ' + tips.length + ' tips for how you come across</span>' + svg('down') + '</summary>' +
      '<ol class="b-video-list">' + tips.map((t) => '<li><b>' + esc(t[0]) + '</b> ' + esc(t[1]) + '</li>').join('') + '</ol></details>';
  }

  function paintCall() {
    const host = byId('callPanel');
    const mounting = host.hidden && !!CALL;
    host.hidden = !CALL;
    host.classList.toggle('is-opening', mounting);
    host.innerHTML = CALL ? callPanel() : '';
    paintDial();
    const lines = byId('callLines');
    if (lines && CALL && CALL.state === 'live') lines.scrollTop = lines.scrollHeight;
  }
  function callPanel() {
    const call = CALL;
    const c = DB.byId[call.cand] || null;
    const st = call.state;
    const q = c ? reqOf(c) : null;
    const sess = call.sess;
    const at = sess ? sess.done.length + sess.skipped.length + 1 : 0;
    const name = c ? c.name : call.who || call.phone;
    const sub = c ? STAGE[c.stage].label + ' · ' + q.title + ', ' + accOf(q).name : 'Not a candidate on file';
    const from = telLine(call.from);
    const head = '<div class="call-who-block"><div class="call-who-top"><p class="call-name">' + esc(name) + '</p>' +
      '<div class="call-head">' +
        (st === 'connecting' || st === 'live'
          ? '<span class="call-live' + (st === 'connecting' ? ' is-dialing' : '') + '" aria-hidden="true"></span>' +
            '<span class="call-timer" id="callTimer">' + (st === 'connecting' ? 'Connecting…' : (call.held ? 'On hold · ' : '') + fmtClock(call.secs)) + '</span>'
          : '') +
        (sess ? '<span class="call-of">' + at + ' of ' + sess.ids.length + '</span>' : '') +
        '<span class="tag tag-warn" title="Telephony for Talent is on hold with AiMY Phone">Design target</span>' +
      '</div>' +
      /* A way out of the panel whenever no call is on the line: before it
         starts, and once it has ended. A live call ends with hang-up. */
      (st === 'ready' ? '<button class="call-x" type="button" data-call-close aria-label="Close" title="Close">' + svg('x', 16) + '</button>' : '') +
      '</div>' +
      '<p class="call-sub">' + esc(sub) + '</p>' +
      (call.video ? '<p class="call-num call-vid">' + svg('video') + 'Video call on Teams' + (call.camOff && st === 'live' ? ' · your camera is off' : '') + '</p>'
        : '<p class="call-num">' + esc(call.phone) + '</p>') +
      (call.dir === 'in' ? '<p class="call-from-on">They called you</p>'
        : st !== 'ready' && from ? '<p class="call-from-on">From ' + esc(from.num) + ', ' + esc(from.cc) + '</p>' : '') +
    '</div>';

    return head +
      '<div class="call-lines" id="callLines">' + (st === 'ready' ? (coachHeld(call) ? coachBlock(call) : call.sess ? '<p class="call-none">Next in the run. Call when you have read the brief.</p>' : '') +
        (call.brief && (!canvasShown() || narrowCall()) ? '<button class="b-ghost" type="button" data-brief-open>Read the brief</button>' : '') : transcriptHtml(call)) + '</div>' +
      (call.asking ? '<div class="call-consent" role="group" aria-labelledby="callConsentSay">' +
        '<p class="call-consent-say" id="callConsentSay">They have to be told before this can start. Have you told them?</p>' +
        '<div class="call-consent-acts"><button class="btn btn-ghost btn-sm" type="button" data-call-consent="no">Not yet</button>' +
        '<button class="btn btn-brand btn-sm" type="button" data-call-consent="yes">I have told them</button></div></div>' : '') +
      (st === 'ready' && call.dir === 'out' && c ? '<div class="b-cuts t-call-mode" role="group" aria-label="How to reach them">' +
        '<button class="filter-chip' + (call.video ? '' : ' active') + '" type="button" data-call-mode="phone" aria-pressed="' + !call.video + '">' + svg('phone', 14) + 'Phone</button>' +
        '<button class="filter-chip' + (call.video ? ' active' : '') + '" type="button" data-call-mode="video" aria-pressed="' + !!call.video + '">' + svg('video', 14) + 'Video on Teams</button></div>' : '') +
      (st === 'ready' && call.dir === 'out' && !call.video ? '<div class="call-from"><span class="call-from-cap">From</span>' + telPick('Call') + '</div>' : '') +
      '<div class="call-tools">' +
        (st === 'ready' ? (sess ? '<button class="call-tool" type="button" data-call-skip aria-label="Skip to the next one" title="Skip to the next one">' + svg('skip') + '</button>' : '') +
            (call.video
              ? '<button class="call-end call-go" type="button" data-callgo aria-label="Start the video call with ' + esc(name) + '">' + svg('video') + 'Start the video call</button>'
              : '<button class="call-end call-go" type="button" data-callgo aria-label="Start the call to ' + esc(name) + ' from ' + esc(from.num) + '">' +
                svg('phone') + 'Call from ' + esc(telTag(from)) + '</button>')
          : (call.video ? '<button class="call-tool' + (call.camOff ? ' is-on' : '') + '" type="button" data-call-cam aria-pressed="' + call.camOff + '" aria-label="' +
              (call.camOff ? 'Turn your camera on' : 'Turn your camera off') + '" title="' + (call.camOff ? 'Turn your camera on' : 'Turn your camera off') + '">' + svg(call.camOff ? 'videooff' : 'video') + '</button>' : '') +
            '<button class="call-tool' + (call.recording ? ' is-rec' : '') + '" type="button" data-call-rec aria-pressed="' + call.recording + '" aria-label="' +
              (call.recording ? 'Stop recording' : 'Record') + '" title="' + (call.recording ? 'Stop recording' : 'Record') + '">' + svg('dot') + '</button>' +
            '<button class="call-tool' + (call.muted ? ' is-on' : '') + '" type="button" data-call-mute aria-pressed="' + call.muted + '" aria-label="' +
              (call.muted ? 'Unmute' : 'Mute') + '" title="' + (call.muted ? 'Unmute' : 'Mute') + '">' + svg(call.muted ? 'micoff' : 'mic') + '</button>' +
            '<button class="call-tool' + (call.held ? ' is-on' : '') + '" type="button" data-call-hold aria-pressed="' + call.held + '" aria-label="' +
              (call.held ? 'Resume' : 'Hold') + '" title="' + (call.held ? 'Resume' : 'Hold') + '">' + svg(call.held ? 'play' : 'pause') + '</button>' +
            '<button class="call-end" type="button" data-call-end aria-label="' + (st === 'connecting' ? 'Stop calling them' : 'End the call') +
              '" title="' + (st === 'connecting' ? 'Stop calling them' : 'End the call') + '">' + svg('hangup') + '</button>') +
        '<button class="call-min" type="button" data-call-min aria-expanded="' + !CALL_MIN + '" aria-controls="callPanel" aria-label="' +
          (CALL_MIN ? 'Back to the call' : 'Back to the page') + '" title="' + (CALL_MIN ? 'Back to the call' : 'Back to the page') + '">' +
          svg(CALL_MIN ? 'up' : 'down') + '</button>' +
      '</div>';
  }
  const sessNext = (call) => {
    const s = call.sess;
    if (!s) return null;
    const id = s.ids.filter((x) => x !== call.cand && s.done.indexOf(x) < 0 && s.skipped.indexOf(x) < 0 && canCall(DB.byId[x]))[0];
    return id ? DB.byId[id] : null;
  };

  /* A stranger who rang about a role becomes a candidate on the requisition
     their words point at, one press, with Undo. */
  function addStranger() {
    const call = PENDING || CALL;
    if (!call || call.cand || !call.who) return;
    const text = heardText(call).toLowerCase();
    const open = myOpen();
    const q = open.filter((x) => text.indexOf(x.fam === 'support' ? 'support' : x.fam === 'finance' ? 'account' : 'operations') >= 0)[0] || open[0];
    const c = { id: 'kx' + Date.now().toString(36), name: call.who, req: q.id, stage: 'applied', exit: null, since: 0, meet: null,
      fb: false, nudged: null, years: 2, at: 'Told us on a call', place: 'Cairo', langs: ['Arabic', 'English'],
      source: 'Called in', ev: q.must.map(() => 'n'), maxAt: 'applied', phone: call.phone, fate: 'pass', dnc: false,
      badNumber: false, callback: null };
    addCand(c);
    call.cand = c.id;
    if (call === PENDING) readbackSay(); else paintCall();
    paint();
    toast('Added ' + c.name + ' to ' + q.title, () => { dropCand(c); if (PENDING && PENDING.cand === c.id) { PENDING.cand = null; readbackSay(); } if (CALL && CALL.cand === c.id) { CALL.cand = null; paintCall(); } paint(); },
      'Applied, with the number they called from. The call is logged against them.');
  }

  /* ── The phone ringing (Sales's ring widget, tones and all) ── */
  let RINGING = null, RING_TIMER = null, RING_GONE = null;
  const RING_MS = 30000, RING_HANDOFF_MS = 900;
  function ringRead(c) {
    const last = lastCall(c);
    return (c.stage === 'applied' ? 'Applied for <b>' + esc(reqOf(c).title) + '</b>, not screened yet. '
      : 'At the ' + esc(lower(STAGE[c.stage].label)) + ' for <b>' + esc(reqOf(c).title) + '</b>. ') +
      (last ? esc(callSay(last)) : 'You have not spoken yet.');
  }
  function paintRing() {
    const host = byId('ringHost');
    if (!RINGING) { host.innerHTML = ''; return; }
    const r = RINGING;
    const c = r.cand ? DB.byId[r.cand] : null;
    const live = r.state === 'live';
    const who = c ? c.name : r.phone;
    const ini = c ? c.name.split(' ').map((w) => w[0]).join('').slice(0, 2) : '?';
    host.innerHTML = '<div class="b-ring" data-state="' + (live ? 'live' : 'ringing') + '" role="alertdialog" aria-live="assertive" ' +
        'aria-label="' + (live ? 'Call connected' : 'Incoming call') + ' from ' + esc(who) + '">' +
      '<div class="b-ring-main">' +
        '<span class="b-ring-av' + (c ? '' : ' is-unknown') + '" aria-hidden="true">' + esc(ini) + '</span>' +
        '<span class="b-ring-id"><span class="b-ring-name">' + esc(who) + '</span>' +
          '<span class="b-ring-sub">' + (live ? 'Connected' : esc(c ? c.phone : 'Not a candidate on file')) + '</span>' +
          (live ? '' : '<span class="b-ring-state">Incoming call</span>') + '</span>' +
        (live ? '' : '<span class="b-ring-acts">' +
          '<button class="b-ring-btn is-no" type="button" data-ring-no aria-label="Decline the call">' + svg('phone') + '</button>' +
          '<button class="b-ring-btn is-yes" type="button" data-ring-yes aria-label="Answer the call">' + svg('phone') + '</button></span>') +
      '</div>' +
      (!live && c ? '<div class="b-ring-read"><svg class="b-ring-mark" viewBox="0 0 18 20" aria-hidden="true"><use href="#aimy-logo-small"/></svg>' +
        '<span class="b-ring-said">' + ringRead(c) + '</span></div>' : '') +
    '</div>';
  }
  function ringIn(phone, says) {
    /* A widget still saying "Connected" after that call has ended is on its
       way out; it does not hold the line. */
    if (RINGING && RINGING.state === 'live' && !CALL) { ringStop(); RINGING = null; paintRing(); }
    if (CALL || RINGING) { busy(); return; }
    const c = says === 'known' ? candByPhone(phone) : null;
    ringStop();
    RINGING = { phone: phone, cand: c ? c.id : null, state: 'ringing', says: says };
    paintRing();
    ringToneOn();
    RING_TIMER = setTimeout(() => ringEnded('You missed'), RING_MS);
  }
  function ringStop() {
    ringToneOff();
    if (RING_TIMER) { clearTimeout(RING_TIMER); RING_TIMER = null; }
    if (RING_GONE) { clearTimeout(RING_GONE); RING_GONE = null; }
  }
  function ringRetire() {
    ringStop();
    const el = byId('ringHost').firstElementChild;
    if (!el) { RINGING = null; paintRing(); return; }
    el.classList.add('is-leaving');
    RING_GONE = setTimeout(() => { RING_GONE = null; RINGING = null; paintRing(); }, 260);
  }
  function answerInbound() {
    const r = RINGING;
    if (!r || r.state === 'live') return;
    const c = r.cand ? DB.byId[r.cand] : null;
    ringStop();
    clearCallTimers();
    const kind = c ? (rank(reqOf(c), c.stage) > rank(reqOf(c), 'phone') ? 'status' : 'known') : r.says;
    CALL = { cand: c ? c.id : null, state: 'ready', secs: 0, dir: 'in', from: null, phone: r.phone,
      script: scriptFor(c, kind), shown: 0, note: '', recording: false, asking: false, muted: false,
      held: false, sess: null, lit: null, read: null };
    document.body.classList.add('is-calling');
    callMin(false);
    liveNow();
    if (c) callBrief(c, true);
    r.state = 'live';
    paintRing();
    RING_GONE = setTimeout(ringRetire, RING_HANDOFF_MS);
  }
  /* Declined or missed, it is on their record and in the call log. */
  function ringEnded(verb) {
    const r = RINGING;
    if (!r || r.state === 'live') return;
    ringRetire();
    ringEndTone();
    const now = new Date();
    const t = { id: 'u' + Date.now().toString(36), cand: r.cand, phone: r.phone, who: null, day: 0,
      time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
      dir: 'in', secs: 0, outcome: 'noanswer', by: ME, missed: true, note: verb + ' their call.' };
    /* Somebody on file who gets nobody leaves a message. */
    const known = r.cand ? DB.byId[r.cand] : null;
    if (known && verb === 'You missed') t.vm = { secs: 17, text: 'Hi, it is ' + first(known.name) + ' returning your call about the ' + reqOf(known).title + ' role. Call me back when you can.' };
    addCall(t);
    paint();
    const c = r.cand ? DB.byId[r.cand] : null;
    toast(verb + ' a call from ' + (c ? c.name : r.phone), () => { dropCall(t.id); paint(); },
      c ? 'It is on their record and under Missed in your calls.' : 'Nobody on file has that number. It is under Missed in your calls.');
  }
  /* The ringtone, synthesised (Sales: D4, up a fifth to A4, settling on F#4). */
  const RING_VOICE = [[1, 1, 0.42], [4, 0.12, 0.16]];
  const RING_MELODY = [[0.00, 293.66, 0.85], [0.00, 146.83, 0.34], [0.42, 440.00, 0.95], [1.15, 369.99, 0.58],
    [3.60, 293.66, 0.85], [3.60, 146.83, 0.34], [4.02, 440.00, 0.95], [4.75, 369.99, 0.58]];
  const RING_GAP = 7.0, RING_VOL = 0.88;
  const RING_END = [[0.00, 220.00, 0.90], [0.10, 185.00, 0.78]];
  const RING_END_VOICE = [[1, 1, 0.42], [4, 0.20, 0.16]];
  let RING_AC = null, RING_AT = 0, RING_BEAT = null;
  function ringBurst(ac, at, melody, vol, voice) {
    melody.forEach((note) => voice.forEach((pt) => {
      const t0 = at + note[0], peak = vol * pt[1] * note[2], life = pt[2];
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = note[1] * pt[0];
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0002, t0 + life);
      g.gain.linearRampToValueAtTime(0, t0 + life + 0.03);
      o.connect(g); g.connect(ac.destination);
      o.start(t0); o.stop(t0 + life + 0.05);
    }));
  }
  function ringToneOn() {
    if (UI.quiet) return;
    ringToneOff();
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      RING_AC = new AC();
      if (RING_AC.state === 'suspended' && RING_AC.resume) RING_AC.resume();
      RING_AT = RING_AC.currentTime + 0.05;
      ringBurst(RING_AC, RING_AT, RING_MELODY, RING_VOL, RING_VOICE);
      RING_AT += RING_GAP;
      RING_BEAT = setInterval(() => {
        try {
          if (!RING_AC) return;
          while (RING_AT < RING_AC.currentTime + 1.5) { ringBurst(RING_AC, RING_AT, RING_MELODY, RING_VOL, RING_VOICE); RING_AT += RING_GAP; }
        } catch (e) {}
      }, 500);
    } catch (e) { RING_AC = null; }
  }
  function ringToneOff() {
    if (RING_BEAT) { clearInterval(RING_BEAT); RING_BEAT = null; }
    if (RING_AC) { try { if (RING_AC.close) RING_AC.close(); } catch (e) {} RING_AC = null; }
  }
  function ringEndTone() {
    if (UI.quiet) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
      if (ac.state === 'suspended' && ac.resume) ac.resume();
      ringBurst(ac, ac.currentTime + 0.02, RING_END, RING_VOL, RING_END_VOICE);
      setTimeout(() => { try { if (ac.close) ac.close(); } catch (e) {} }, 1500);
    } catch (e) {}
  }
  /* The prototype's three ways a call comes in. */
  function ringTrigger(which) {
    if (which === 'known') {
      const m = missed()[0];
      const c = (m && DB.byId[m.cand]) || (toCall()[0] || {}).c;
      if (!c) { toast('Nobody on your requisitions has a number to call in from.'); return; }
      ringIn(c.phone, 'known');
      return;
    }
    let n = '';
    do { n = '+20 10 ' + String(1000 + Math.floor(Math.random() * 9000)) + ' ' + String(1000 + Math.floor(Math.random() * 9000)); } while (candByPhone(n));
    ringIn(n, which);
  }

  /* ── The dialer (Sales's paintDial / dialBody / dialGo) ── */
  let DIAL_NUM = '';
  function paintDial() {
    const l = telLine(UI.line);
    const say = CALL ? 'Back to the call' : 'Call a number from ' + l.num;
    const btn = byId('dialBtn');
    btn.setAttribute('aria-label', say);
    btn.title = say;
  }
  const dialSay = (t) => aimyBlock({ text: t }, true);
  function dialWho() {
    if (DIAL_NUM.replace(/\D/g, '').length < 7) return '';
    const c = candByPhone(DIAL_NUM);
    if (!c) return dialSay('That number is not on file. When you hang up, I will offer to add them as a candidate.');
    if (c.dnc) return dialSay(esc(c.name) + ' asked not to be called again.');
    return dialSay('That is <b>' + esc(c.name) + '</b>, ' + esc(atStage(c.stage)) + ' for ' + esc(reqOf(c).title) + '. The call goes on their record.');
  }
  function dialBody() {
    const l = telLine(UI.line);
    return '<div class="ntf-head"><b>Call a number</b></div><div class="dial-body">' +
      '<div class="dial-field"><span class="dial-cap">From</span>' + telPick('Dial') + '</div>' +
      '<div class="dial-field"><label class="dial-cap" for="dialNum">Number</label>' +
        '<input class="dial-input" id="dialNum" type="tel" inputmode="tel" autocomplete="off" spellcheck="false" placeholder="+20 10 1234 5678" value="' + esc(DIAL_NUM) + '">' +
        '<div class="dial-who" id="dialWho" aria-live="polite">' + dialWho() + '</div></div>' +
      '<button class="btn btn-brand dial-go" type="button" data-dial-go>' + svg('phone') + '<span>Call from ' + esc(telTag(l)) + '</span></button>' +
    '</div>';
  }
  function dialOpen(num) {
    if (num != null) DIAL_NUM = num;
    const panel = byId('dialPanel');
    panel.innerHTML = dialBody();
    panel.hidden = false;
    byId('dialBtn').setAttribute('aria-expanded', 'true');
    const f = byId('dialNum');
    if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
  }
  function closeDial() {
    const panel = byId('dialPanel');
    if (panel.hidden) return;
    panel.hidden = true;
    byId('dialBtn').setAttribute('aria-expanded', 'false');
  }
  function dialGo() {
    const num = DIAL_NUM.trim();
    if (num.replace(/\D/g, '').length < 7) {
      const who = byId('dialWho');
      if (who) who.innerHTML = dialSay('That is too short to be a phone number.');
      return;
    }
    if (busy()) return;
    closeDial();
    const c = candByPhone(num);
    DIAL_NUM = '';
    if (c) { if (startCall(c.id)) callGo(); return; }
    clearCallTimers();
    CALL = { cand: null, state: 'ready', secs: 0, dir: 'out', from: UI.line, phone: num,
      script: DIALLED_SCRIPT.map((x) => [x[0], x[1].split('{me}').join(meFirst())]), shown: 0, note: '',
      recording: false, asking: false, muted: false, held: false, sess: null, lit: null, read: null };
    document.body.classList.add('is-calling');
    callMin(false);
    paintCall();
    callGo();
  }

  /* ── The call log rows (Sales's logRow / logDays) ── */
  const sayMark = () => '<svg class="b-log-mark" width="11" height="13" viewBox="0 0 18 20" aria-hidden="true"><use href="#aimy-logo-small"/></svg>';
  const logMeta = (bits) => bits.filter(Boolean).map((b) => esc(b)).join(' · ');
  function logRow(o, i) {
    const inner = '<span class="b-log-ico ' + esc(o.tone) + '">' + o.ico + '</span>' +
      '<span class="b-log-main"><span class="b-log-name">' + esc(o.who) + '</span>' +
        '<span class="b-log-meta">' + o.meta + '</span>' +
        (o.say ? '<span class="b-log-say">' + (o.aimy ? sayMark() : '') + '<span>' + o.say + '</span></span>' : '') +
      '</span>' + (o.go ? '<span class="b-log-go">' + (o.goIco || '') + esc(o.go) + '</span>' : '');
    /* A history row with nowhere to go is not a button: a control that does
       nothing is the one thing the audit cannot see. */
    return '<div class="b-log-item" style="--i:' + Math.min(i, 8) + '">' +
      (o.act ? '<button class="b-log-row" type="button" ' + o.act + '>' + inner + '</button>'
        : '<div class="b-log-row t-log-static">' + inner + '</div>') +
      (o.vm ? vmStrip(o.vm, o.vmId) : '') + '</div>';
  }

  /* ══ A MESSAGE THEY LEFT (Sales's voicemail strip) ═════════════════════
     The call is one thing in the log and the message is another, attached to
     it, so playing it back is its own press. The strip fills as it plays,
     and the browser reads the message aloud where it can speak (telephony is
     a fixture, so the words are what the caller left, read by the browser's
     own voice). It does not repaint the page: only the strip changes. */
  const VM_BARS = 28;
  let VM_ON = null, VM_T0 = 0, VM_TIMER = null, VM_TICK = null;
  const vmHash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const vmCall = (id) => DB.calls.filter((t) => t.id === id)[0] || null;
  const vmAt = () => (VM_ON && vmCall(VM_ON) ? Math.min(vmCall(VM_ON).vm.secs, (Date.now() - VM_T0) / 1000) : 0);
  function vmWave(id) {
    let out = '';
    for (let b = 0; b < VM_BARS; b++) out += '<i style="height:' + (18 + vmHash(id + ':w' + b) % 79) + '%"></i>';
    return out;
  }
  function vmStrip(vm, id) {
    const on = VM_ON === id;
    const el = on ? vmAt() : 0;
    return '<button class="b-log-vm' + (on ? ' is-playing' : '') + '" type="button" data-vm="' + esc(id) + '" aria-pressed="' + on + '" ' +
      'aria-label="' + (on ? 'Stop the message' : 'Play the message they left, ' + fmtClock(vm.secs)) + '">' +
      '<span class="b-log-vm-go">' + svg(on ? 'pause' : 'play') + '</span>' +
      '<span class="b-log-vm-wave"><span class="b-log-vm-bars">' + vmWave(id) + '</span>' +
        '<span class="b-log-vm-bars b-log-vm-on"' + (on ? ' style="animation-duration:' + vm.secs + 's;animation-delay:-' + el + 's"' : '') + '>' + vmWave(id) + '</span></span>' +
      '<span class="b-log-vm-len">' + fmtClock(Math.ceil(vm.secs - el)) + '</span></button>';
  }
  function vmDraw(id) {
    const el = document.querySelector('[data-vm="' + id + '"]'), t = vmCall(id);
    if (el && t && t.vm) el.outerHTML = vmStrip(t.vm, id);
  }
  function vmStop() {
    if (VM_TIMER) { clearTimeout(VM_TIMER); VM_TIMER = null; }
    if (VM_TICK) { clearInterval(VM_TICK); VM_TICK = null; }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    const was = VM_ON;
    VM_ON = null;
    if (was) vmDraw(was);
  }
  function vmPlay(id) {
    const was = VM_ON;
    vmStop();
    if (was === id) return;
    const t = vmCall(id);
    if (!t || !t.vm) return;
    VM_ON = id;
    VM_T0 = Date.now();
    vmDraw(id);
    if (!UI.quiet && window.speechSynthesis && window.SpeechSynthesisUtterance) {
      try { const u = new SpeechSynthesisUtterance(t.vm.text); u.lang = 'en-GB'; window.speechSynthesis.speak(u); } catch (e) {}
    }
    VM_TIMER = setTimeout(() => { VM_TIMER = null; vmStop(); }, t.vm.secs * 1000);
    VM_TICK = setInterval(() => {
      const el = document.querySelector('[data-vm="' + VM_ON + '"] .b-log-vm-len');
      if (el && vmCall(VM_ON)) el.textContent = fmtClock(Math.max(0, Math.ceil(vmCall(VM_ON).vm.secs - vmAt())));
    }, 250);
  }
  const dayLabel = (d) => d === 0 ? 'Today' : d === -1 ? 'Yesterday' : sayDay(d);
  function logDays(items, draw) {
    let day = null;
    return items.map((t, i) => {
      const head = t.day !== day ? '<h3 class="b-month">' + esc(dayLabel(t.day)) + '</h3>' : '';
      day = t.day;
      return head + draw(t, i);
    }).join('');
  }
  function callRow(t, i, withName) {
    const c = t.cand ? DB.byId[t.cand] : null;
    const ico = t.video ? svg('video') : t.dir === 'in' ? svg('callin') : svg('callout');
    return logRow({
      tone: t.missed ? 'is-missed' : '', ico: ico,
      who: withName ? (c ? c.name : t.who || t.phone) : (t.dir === 'in' ? (t.missed ? 'Missed call' : 'They called') : t.video ? 'Video call' : 'You called'),
      meta: logMeta([t.missed ? (t.vm ? 'Missed, left a message' : 'Missed') : OUTCOME[t.outcome].label, t.video ? 'on Teams' : null, t.secs ? fmtClock(t.secs) : null, t.time,
        withName && c ? reqOf(c).title : null, t.from && telLine(t.from) ? 'from ' + telTag(telLine(t.from)) : null]),
      say: t.vm ? '“' + esc(t.vm.text) + '”' : esc(t.note || ''),
      vm: t.vm || null, vmId: t.id,
      act: withName ? (c ? 'data-cand="' + c.id + '"' : 'data-redial="' + esc(t.phone) + '"') : '',
      go: withName ? (c ? 'Open' : 'Call back') : '', goIco: withName && !c ? svg('phone', 14) : '',
    }, i);
  }

  /* ── CALLS ── who to call, who called and got nobody, and every call. */
  function callsPage() {
    const list = toCall(), miss = missed(), log = myCalls();
    const tab = S.q === 'missed' || S.q === 'log' ? S.q : 'tocall';
    const n = { tocall: list.length, missed: miss.length, log: log.filter((t) => t.day === 0).length };
    const TABS = [['tocall', 'To call'], ['missed', 'Missed'], ['log', 'Today']];
    const counts = { callback: 0, screen: 0, applied: 0 };
    list.forEach((x) => counts[x.why]++);
    const WHY = { callback: 'asked for a callback', screen: 'phone screen due', applied: 'applied, not called yet' };
    let body;
    if (tab === 'tocall') {
      body = list.length
        ? aimyBlock({ text: '<b>' + plural(list.length, 'person', 'people') + '</b> to call: ' +
            [counts.callback ? counts.callback + ' asked for a callback' : null, counts.screen ? counts.screen + ' due a phone screen' : null,
              counts.applied ? counts.applied + ' applied and not called yet' : null].filter(Boolean).join(', ') + '. Callbacks first.' }, true) +
          '<div class="b-acts"><button class="s-insight-lnk primary" type="button" data-call-all>' + svg('phone', 14) + 'Call them in order</button></div>' +
          '<div class="b-log">' + list.map((x, i) => logRow({
            tone: '', ico: svg('phone'), who: x.c.name,
            meta: logMeta([WHY[x.why], x.c.phone, reqOf(x.c).title + ', ' + accOf(reqOf(x.c)).name]),
            say: lastCall(x.c) ? esc(callSay(lastCall(x.c))) : 'Not called yet. ' + evSay(x.c) + '.',
            aimy: true, act: 'data-call="' + x.c.id + '"', go: 'Call', goIco: svg('phone', 14),
          }, i)).join('') + '</div>'
        : '<p class="b-vfoot">Nobody is waiting for a call from you.</p>';
    } else if (tab === 'missed') {
      body = miss.length
        ? aimyBlock({ text: '<b>' + plural(miss.length, 'person', 'people') + '</b> called and nobody picked up. Calling them back clears them from here.' }, true) +
          '<div class="b-log">' + logDays(miss, (t, i) => {
            const c = DB.byId[t.cand];
            return c ? logRow({ tone: 'is-missed', ico: svg('callin'), who: c.name, meta: logMeta([t.vm ? 'Missed, left a message' : 'Missed', c.phone, t.time]),
              say: t.vm ? '“' + esc(t.vm.text) + '”' : ringRead(c), aimy: !t.vm, act: 'data-call="' + c.id + '"', go: 'Call them back', goIco: svg('phone', 14),
              vm: t.vm || null, vmId: t.id }, i)
              : logRow({ tone: 'is-missed', ico: svg('callin'), who: t.phone, meta: logMeta(['Missed', 'not on file', t.time]),
              say: 'Nobody on file has this number. Calling back puts it in the dialer.', aimy: true,
              act: 'data-redial="' + esc(t.phone) + '"', go: 'Call them back', goIco: svg('phone', 14) }, i);
          }) + '</div>'
        : '<p class="b-vfoot">Every call that came in got answered or returned.</p>';
    } else {
      const shown = log.slice(0, 40);
      body = shown.length ? '<div class="b-log">' + logDays(shown, (t, i) => callRow(t, i, true)) + '</div>' +
        '<p class="b-vfoot">The last ' + shown.length + ' of ' + log.length + ' calls.</p>' : '<p class="b-vfoot">No calls yet.</p>';
    }
    return '<div class="s-home">' +
      '<section class="s-block s-block-wide" aria-label="Calls">' +
        '<div class="s-camp-list-head">' + switcher('calls') + '</div>' +
        '<p class="t-scope">' + tag('Design target', 'warn') + '<span>Telephony for Talent is on hold with AiMY Phone. These calls show where it is going, not what ships first.</span></p>' +
        '<div class="b-cuts b-log-tabs">' + TABS.map((x) => '<button class="filter-chip' + (tab === x[0] ? ' active' : '') + '" type="button" data-q="' + x[0] + '"' +
          (tab === x[0] ? ' aria-current="true"' : '') + '>' + esc(x[1]) + '<span class="b-cut-n">' + n[x[0]] + '</span></button>').join('') + '</div>' +
        body +
      '</section></div>';
  }

  /* ── ONE CANDIDATE ── Sales's contact record, as a candidate. Who they
     are and how to reach them, what they said on calls, each must-have with
     what the CV says next to what interviews found, every application this
     person has, the assessment, the interviews, the offer, and everything
     that happened, newest first. A note typed here goes on that history
     (New Operations list: interviews held outside AiMY are still recorded). */
  /* "The CV is silent here" is not "not met" (R3): an unknown is said as
     unknown, and it comes with one way to find out. */
  const EVW = { m: 'Meets', p: 'Partly', n: 'Not known' };
  const profileLink = (c) => 'talent.flairstech.com/me/' + c.pid;
  function candPage() {
    const c = DB.byId[S.cand];
    if (!c || !sees(c)) return '<div class="s-home"><section class="s-block s-block-wide"><p class="s-none">This candidate has not been sent to you.</p></section></div>';
    if (S.edit && !isClient()) return candEditPage(c);
    const q = reqOf(c);
    const nx = nextOf(c);
    const calls = callsOf(c.id);
    const v = verified(c);
    const ok = v.filter((x) => x.state === 'verified').length;
    const differs = v.filter((x) => x.state === 'differs');
    const early = !c.exit && rank(q, c.stage) <= rank(q, 'phone');
    const outK = c.stage === 'sent' || c.stage === 'client' || c.stage === 'ctech' ? 'clientno' : c.stage === 'offer' ? 'offerno' : 'out';
    const w = waitsOn(c);
    const works = isRec() || isHR();
    const others = apps(c).filter((x) => x.id !== c.id);
    const part = (cap, body) => '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">' + esc(cap) + '</h2><div class="b-cmeta-say">' + body + '</div></div>';
    const p = (t) => '<p class="b-cmeta-p">' + t + '</p>';
    return '<div class="s-home">' +
      '<div class="b-topbar s-block-wide"><button class="s-back" type="button" data-req="' + q.id + '">' + svg('back', 14) + 'Back to ' + esc(q.title) + '</button>' +
        (works ? '<span class="b-draft-acts"><button class="b-ghost" type="button" data-edit-cand="' + c.id + '">Edit</button>' +
          '<span class="b-menu-wrap"><button class="b-ghost b-menu-open" type="button" data-pickopen="addTo' + c.id + '" aria-haspopup="menu">Add to another requisition' + svg('down', 14) + '</button>' +
            '<div class="b-menu" id="addTo' + c.id + '" role="menu" hidden><span class="b-menu-cap">Open requisitions</span>' +
              DB.reqs.filter((x) => isOpen(x) && !apps(c).some((y) => y.req === x.id) && (isHR() || x.rec === DESK)).slice(0, 12).map((x) =>
                '<button class="b-menu-item" type="button" role="menuitem" data-add-app="' + c.id + '|' + x.id + '"><span class="b-menu-name">' + esc(x.title) + '</span><span class="tel-menu-cc">' + esc(accOf(x).name) + '</span></button>').join('') +
            '</div></span></span>' : '') + '</div>' +
      '<section class="s-rec-head s-block-wide">' +
        '<span class="s-rec-kind b-kinds">' + fact('user', 'Candidate') + fact('req', q.title) + (isClient() ? '' : fact('acc', accOf(q).name)) + fact('pin', c.place) + '</span>' +
        '<div class="s-rec-title"><h1 class="s-rec-name">' + esc(c.name) + '</h1>' +
          '<span class="s-meta-st tone-' + (c.exit ? 'neutral' : 'ok') + '">' + esc(c.exit ? EXIT[c.exit].label : STAGE[c.stage].label) + '</span>' +
          (isClient() || !before(c) ? '' : tag('Returning', 'info')) +
          (isClient() ? '' : '<span class="b-kind">' + esc(c.source) + ', ' + esc(sayWhen(c.applied != null ? c.applied : -3)) + '</span>') + '</div>' +
          (isClient() || !before(c) ? '' : '<p class="b-cmeta-p t-before">' + fact('hist', beforeSay(before(c))) + '</p>') +
        '<div class="b-cmeta">' +
          part('Now', p(esc(c.at)) + p(esc(plural(c.years, 'year')) + ' of experience')) +
          (isClient() ? '' : part('Reach them', p('<b>' + esc(c.phone || 'No phone yet') + '</b>') + p(esc(c.email || '')) +
            p(esc(c.dnc ? 'Asked not to be called again.' : c.badNumber ? 'This number did not work.' : c.callback != null && c.callback <= 0 ? 'Asked to be called back today.' : plural(calls.length, 'call') + ' so far.')))) +
          part('Languages and skills', p(esc(c.langs.join(', '))) + p(esc((c.skills || []).join(', ')))) +
          (isClient() ? '' : part('Said on calls', c.notice || c.salary ? (c.notice ? p(esc(c.notice.charAt(0).toUpperCase() + c.notice.slice(1))) : '') +
            (c.salary ? p('Expects ' + esc(c.salary)) : '') : '<p class="b-cmeta-p b-draft-none">Nothing yet. The phone screen asks.</p>')) +
        '</div>' +
        '<div class="b-cmeta b-said">' +
          '<div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">Summary</span></div><div class="b-cmeta-say">' + p(esc(c.summary || '')) + '</div></div>' +
          (works ? '<div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">Their own profile</span>' +
            '<button class="b-draft-ai" type="button" data-copy="' + esc('https://' + profileLink(c)) + '">Copy the link</button></div>' +
            '<div class="b-cmeta-say">' + p('<b class="t-link-text">' + esc(profileLink(c)) + '</b>') +
            p('They open it with a one-time code sent to their phone, see where they stand, update their details and take any test sent to them. <button class="t-inline-link" type="button"' + goAttr({ me: c.pid }) + '>See what they see</button>') + '</div></div>' : '') +
          (works ? '<div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">Consent</span></div><div class="b-cmeta-say">' + consentList(c) + '</div></div>' : '') +
        '</div>' +
      '</section>' +
      '<section class="s-insight is-lead s-block-wide" aria-label="Where they are">' +
        '<div class="s-lead-mark"><svg class="s-insight-mark" viewBox="0 0 18 20" width="14" height="14" aria-hidden="true"><use href="#aimy-logo-small"/></svg>' +
          '<span class="work-state ws-detected">Read off the record</span></div>' +
        '<div class="s-lead-line"><span class="s-lead-n">' + ok + '</span><span class="s-lead-say">of the <span class="s-lead-of">' + v.length + '</span> must-haves verified in interview. The CV meets ' + evMet(c) + '.</span></div>' +
        '<p class="s-lead-deck">' + esc(c.exit ? exitSay(c).charAt(0).toUpperCase() + exitSay(c).slice(1) + '.' +
            (c.told === false && !isClient() ? ' Not told yet; they hear by ' + sayDay(hearBy(c)) + '.' : c.told ? ' They have been told.' : '')
          : differs.length ? 'The CV and the interview differ on ' + differs.map((x) => x.must).join('; ') + '. Worth asking about in the next round.'
          : !ok ? (early ? 'Nothing is checked in an interview yet. The phone screen comes first.' : 'Nothing is checked in an interview yet.')
          : 'What the CV says has held up in interview so far.') + '</p>' +
        /* Message preview (component library): what they will read, before Send. */
        (c.exit && c.told === false && works ? msgPreview(c) + '<div class="s-lead-acts"><button class="s-insight-lnk primary" type="button" data-tell="' + c.id + '">Send the answer</button></div>' : '') +
        /* With a sendout, the reasons open inside its card instead. */
        (c.exit || !works ? '' : passOpen(c) && c.sentDay == null ? passPicker(c) : outPicking(c) ? outPicker(c) : writeOpen(c) ? writeBox(c) : '<div class="s-lead-acts">' +
          (isRec() && canCall(c) ? '<button class="s-insight-lnk' + (early ? ' primary' : '') + '" type="button" data-call="' + c.id + '">' + svg('phone', 14) + 'Call ' + esc(first(c.name)) + '</button>' : '') +
          (nx && !early && (w === 'me' || w === 'client' || w === 'candidate') && c.stage !== 'offer' ? '<button class="s-insight-lnk primary" type="button" data-move="' + c.id + '|' + nx + '">' + esc(goSay(c)) + '</button>' : '') +
          exitBtn(c, outK) +
        '</div>') +
      '</section>' +
      (works && /^Found on/.test(c.source) && c.stage === 'sourced' ? trustCard([c], first(c.name) + ', a web prospect', c) : '') +
      sendoutCard(c) +
      evidenceCard(c) +
      verifiedCard(c, v) +
      (others.length ? appsBlock(c, others) : '') +
      (isClient() ? '' : asmtBlock(c)) +
      ivBlock(c) +
      (isClient() ? '' : offerBlock(c)) +
      (isClient() ? '' : historyBlock(c)) +
      (isClient() || !calls.length ? '' : '<section class="s-block s-block-wide" aria-label="Calls with them">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Calls with them</h2><span class="s-block-say">' + plural(calls.length, 'call') + ' · newest first</span></div>' +
        '<div class="b-log">' + logDays(calls, (t, i) => callRow(t, i, false)) + '</div></section>') +
    '</div>';
  }

  /* Every other application this person has made, or been put on. */
  function appsBlock(c, others) {
    return '<section class="s-block s-block-wide" aria-label="Other applications">' +
      '<div class="s-camp-list-head"><h2 class="s-block-h">Their other applications</h2><span class="s-block-say">' + others.length + '</span></div>' +
      '<div class="b-log">' + others.map((x, i) => logRow({ tone: '', ico: svg('req'), who: reqOf(x).title,
        meta: logMeta([accOf(reqOf(x)).name, x.exit ? EXIT[x.exit].label : STAGE[x.stage].label, x.source]),
        act: 'data-cand="' + x.id + '"', go: 'Open' }, i)).join('') + '</div>' +
    '</section>';
  }

  /* ── The assessment on this application ── */
  function asmtBlock(c) {
    const q = reqOf(c);
    const s = sendOf(c);
    if (!s && !q.asmt) return '';
    const a = asmtOf(s ? s.asmt : q.asmt);
    const works = isRec() || isHR();
    let body;
    if (!s) body = '<p class="b-cmeta-p">Not sent yet.</p>' + (works ? '<p class="b-cmeta-p t-acts"><button class="s-insight-lnk primary" type="button" data-send-asmt="' + c.id + '">Send the assessment</button></p>' : '');
    else if (s.status === 'sent') body = '<p class="b-cmeta-p">Sent ' + esc(sayWhen(s.day)) + '. Not taken yet.</p>' +
      (works ? '<p class="b-cmeta-p t-acts"><button class="s-insight-lnk" type="button" data-copy="' + esc('https://talent.flairstech.com/test/' + s.id) + '">Copy their test link</button>' +
        '<button class="s-insight-lnk" type="button"' + goAttr({ take: s.id }) + '>Open it as them</button></p>' : '');
    else body = '<p class="b-cmeta-p"><b>' + s.score + '%</b>, ' + (s.score >= a.pass ? 'a pass' : 'under the ' + a.pass + '% pass mark') + '. Scored by AiMY ' + esc(sayWhen(s.doneDay != null ? s.doneDay : s.day)) + '.' + (s.probed && s.probed.length ? ' Taken live; AiMY asked for more on ' + s.probed.map((i) => 'Q' + (i + 1)).join(' and ') + '.' : '') + '</p>' +
      '<div class="t-qlist">' + a.questions.map((qq, i) => '<p class="t-q"><span class="tag tag-' + (s.answers[i] ? 'ok' : 'neutral') + '">' + (s.answers[i] ? 'Right' : 'Missed') + '</span>' +
        '<span>Q' + (i + 1) + '. ' + esc(qq.q) + '</span></p>').join('') + '</div>';
    return '<section class="s-block s-block-wide" aria-label="Assessment">' +
      '<div class="s-camp-list-head"><h2 class="s-block-h">Assessment</h2><span class="s-block-say"><button class="t-inline-link" type="button" data-asmt="' + a.id + '">' + esc(a.title) + '</button></span></div>' +
      body + '</section>';
  }

  /* ── Interviews: book, debrief, recording ── */
  const SLOT_DAYS = [1, 2, 3];
  const SLOT_TIMES = ['10:00', '12:30', '15:00'];
  function ivBlock(c) {
    const list = ivsOf(c).filter((v) => !isClient() || v.stage === 'client' || v.stage === 'ctech');
    const q = reqOf(c);
    const needsBooking = !c.exit && MEETS[c.stage] && !ivNow(c) && (isRec() || isHR() || (isClient() && (c.stage === 'client' || c.stage === 'ctech')));
    if (!list.length && !needsBooking) return '';
    const tpl = tplFor(c.stage);
    return '<section class="s-block s-block-wide" aria-label="Interviews">' +
      '<div class="s-camp-list-head"><h2 class="s-block-h">Interviews</h2><span class="s-block-say">' + plural(list.length, 'interview') + '</span></div>' +
      (needsBooking ? '<div class="t-book"><p class="b-tocall"><b>' + esc(STAGE[c.stage].label) + '</b> is next. Pick a time from ' + esc(interviewerFor(q, c.stage)) + '’s free slots on Bookings. AiMY tells ' + esc(first(c.name)) + ' from the booking.</p>' +
        '<div class="b-cuts t-slots">' + SLOT_DAYS.map((d) => SLOT_TIMES.map((t) => '<button class="filter-chip" type="button" data-book="' + c.id + '|' + d + '|' + t + '">' + esc(sayWhen(d)) + ', ' + t + '</button>').join('')).join('') + '</div>' +
        (tpl ? '<p class="b-vfoot">The kit follows the ' + esc(tpl.title) + ' template, plus what the CV is silent on.</p>' : '') + '</div>' : '') +
      (list.length ? '<div class="t-ivs">' + list.map((v) => ivRow(c, v)).join('') + '</div>' : '') +
    '</section>';
  }
  function ivRow(c, v) {
    const st = v.status === 'booked' ? (v.day === 0 ? 'Today at ' + v.slot : sayWhen(v.day) + ' at ' + v.slot)
      : v.status === 'owed' ? 'Held ' + sayWhen(v.day) + '. The result is owed.'
      : 'Held ' + sayWhen(v.day) + '. ' + (v.verdict === 'yes' ? 'Proceed.' : 'Do not proceed.');
    const works = isRec() || isHR() || isClient();
    const rec = v.recording;
    return '<div class="t-iv t-acc" data-acc-open="false">' +
      '<div class="t-iv-head">' +
        '<span class="t-iv-main"><b>' + esc(STAGE[v.stage].label) + '</b><span class="b-kind">' + esc(v.by) + ' · ' + esc(IV_MODES[v.mode]) + '</span><span class="t-iv-st">' + esc(st) + '</span></span>' +
        '<span class="t-acts">' +
          (v.status !== 'done' && works ? '<button class="s-insight-lnk' + (v.status === 'owed' ? ' primary' : '') + '" type="button"' + goAttr({ debrief: v.id }) + '>' + (v.status === 'owed' ? 'Open the debrief' : 'The debrief link') + '</button>' : '') +
          (v.status === 'owed' && (isRec() || isHR()) ? '<button class="b-ghost" type="button" data-nudge-iv="' + v.id + '">' + (v.nudged ? 'Nudged' : 'Nudge ' + esc(first(v.by))) + '</button>' : '') +
          (v.status !== 'booked' && !rec && works && !isClient() ? '<button class="b-ghost" type="button" data-rec-up="' + v.id + '">Upload the recording</button>' : '') +
          (v.status === 'done' || rec ? '<button class="b-ghost t-acc-head" type="button" aria-expanded="false" data-acc-toggle>Details<span class="t-acc-chevron">' + svg('down', 14) + '</span></button>' : '') +
        '</span>' +
      '</div>' +
      (v.status === 'done' || rec ? '<div class="t-acc-panel"><div class="t-acc-panel-inner">' +
        (v.ratings ? '<div class="t-qlist">' + reqOf(c).must.map((m, i) => '<p class="t-q"><span class="tag tag-' + (v.ratings[i] === 'm' ? 'ok' : v.ratings[i] === 'p' ? 'warn' : 'neutral') + '">' + RATE[v.ratings[i]] + '</span>' +
          '<span>' + esc(m) + '. ' + esc(v.notes ? v.notes[i] : '') + '</span></p>').join('') + '</div>' : '') +
        (rec ? '<div class="t-rec">' + aimyBlock({ text: '<b>Recording, ' + rec.mins + ' minutes, transcribed.</b> ' + esc(rec.summary || 'Summarised and matched to the success profile.'), from: 'the recording, read by AiMY' }) +
          (rec.lines ? '<div class="s-said-lines">' + rec.lines.map((l) => '<p class="call-line ' + (l[0] === 'them' ? 'is-them' : 'is-you') + '"><span class="call-who">' + esc(l[0] === 'them' ? first(c.name) : first(v.by)) + '</span>' + esc(l[1]) + '</p>').join('') + '</div>' : '') +
          (rec.suggests ? '<p class="b-vfoot">AiMY’s read of the recording, kept apart from the interviewer’s own rating: ' + reqOf(c).must.map((m, i) => esc(m) + ', ' + RATE[rec.suggests[i]].toLowerCase()).join('; ') + '.</p>' : '') +
        '</div>' : '') +
      '</div></div>' : '') +
    '</div>';
  }

  /* ── The offer, its approvals, and day one ── */
  function offerBlock(c) {
    const o = offerOf(c);
    const q = reqOf(c);
    const works = isRec() || isHR();
    if (!o && c.stage !== 'offer') return '';
    if (!o) return '<section class="s-block s-block-wide" aria-label="Offer"><div class="s-camp-list-head"><h2 class="s-block-h">Offer</h2></div>' +
      '<p class="b-tocall">The client said yes. AiMY drafts the packet from the requisition, the interviews and what ' + esc(first(c.name)) + ' said on the phone.</p>' +
      (works ? '<p class="t-acts"><button class="s-insight-lnk primary" type="button" data-offer-new="' + c.id + '">Prepare the offer</button></p>' : '') + '</section>';
    const appr = (who, label, k) => '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">' + esc(label) + '</h2><div class="b-cmeta-say">' +
      '<p class="b-cmeta-p"><b>' + esc(who) + '</b></p><p class="b-cmeta-p"><span class="s-meta-st tone-' + (o[k] === 'ok' ? 'ok' : o[k] === 'back' ? 'warn' : 'neutral') + '">' +
      (o[k] === 'ok' ? 'Approved' : o[k] === 'back' ? 'Sent back' : 'Waiting') + '</span></p>' +
      (o.status === 'approving' && o[k] !== 'ok' ? '<p class="b-cmeta-p"><button class="t-inline-link" type="button"' + goAttr({ approve: o.id, by: k }) + '>Open their approval page</button></p>' : '') + '</div></div>';
    const inBand = q.budget && o.salary >= q.budget.min && o.salary <= q.budget.max;
    const both = o.hm === 'ok' && o.bu === 'ok';
    return '<section class="s-block s-block-wide" aria-label="Offer">' +
      '<div class="s-camp-list-head"><h2 class="s-block-h">Offer</h2><span class="s-block-say">' + esc(OFFER_ST[o.status]) + '</span></div>' +
      '<div class="b-cmeta">' +
        '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Monthly gross</h2><div class="b-cmeta-say">' +
          (works && (o.status === 'approving' || o.status === 'draft')
            ? '<span class="t-step"><button class="b-ghost" type="button" data-offer-step="' + o.id + '|-500" aria-label="Less">−</button><b class="t-step-n">' + money(o.salary) + '</b>' +
              '<button class="b-ghost" type="button" data-offer-step="' + o.id + '|500" aria-label="More">+</button></span>'
            : '<p class="b-cmeta-p"><b>' + money(o.salary) + '</b></p>') +
          '<p class="b-cmeta-p">' + (q.budget ? 'Budget ' + money(q.budget.min) + ' to ' + money(q.budget.max).replace('EGP ', '') + (inBand ? ', inside it.' : ', outside it.') : '') + '</p>' +
          (o.expects ? '<p class="b-cmeta-p">They expect ' + esc(o.expects) + '.</p>' : '') + '</div></div>' +
        '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Notice and start</h2><div class="b-cmeta-say"><p class="b-cmeta-p">' + esc(o.notice.charAt(0).toUpperCase() + o.notice.slice(1)) + '</p>' +
          (o.joinDay != null ? '<p class="b-cmeta-p">' + (o.status === 'joined' ? 'Joined ' : 'Joins ') + esc(sayDay(o.joinDay)) + '</p>' : '') + '</div></div>' +
        appr(hmOf(q).name, 'Hiring manager: fit and salary', 'hm') +
        appr(BU_DIRECTOR, 'BU Director: budget and headcount', 'bu') +
      '</div>' +
      (o.status === 'approving' ? aimyBlock({ text: 'Both approve the same packet at the same time. Changing the salary asks them again.', from: 'how offers are approved' }) : '') +
      (works ? '<p class="t-acts">' +
        (o.status === 'approving' && both ? '<button class="s-insight-lnk primary" type="button" data-offer-send="' + o.id + '">Send the offer</button>' : '') +
        (o.status === 'sent' ? '<button class="s-insight-lnk primary" type="button" data-offer-res="' + o.id + '|accepted">They accepted</button>' +
          '<button class="b-ghost" type="button" data-offer-res="' + o.id + '|declined">They declined</button>' : '') +
      '</p>' : '') +
      (o.status === 'accepted' || o.status === 'joined' ? onboardHtml(c, o) : '') +
    '</section>';
  }
  const OFFER_ST = { draft: 'Drafted', approving: 'With the approvers', sent: 'Sent, waiting on their answer', accepted: 'Accepted, not started', joined: 'Joined', declined: 'Declined', back: 'Sent back' };
  /* Onboarding through day 90 (overview): tracked steps with owners, then
     the 30 and 90 day check-ins. */
  /* Documents go on WhatsApp only to someone who opted in (P9). */
  const ONBOARD = [
    ['IT access, as a Freshdesk ticket to the IT team', 'IT'],
    ['Contract signed', 'HR'],
    ['Documents collected {via}', 'AiMY'],
    ['A buddy on the team', 'Hiring manager'],
    ['The day-one schedule sent', 'AiMY'],
  ];
  /* A check-in is a record with an outcome a person picks (Day 90 in the
     UI/UX plan), so the minimum sample has something to count. */
  const CHECK30 = [['well', 'Settling in well', 'ok'], ['some', 'Some concerns', 'warn'], ['risk', 'At risk of leaving', 'warn']];
  const CHECK90 = [['stayed', 'Stayed', 'ok'], ['left', 'Left', 'neutral']];
  function checkRow(c, o, day, opts, done) {
    const due = o.joinDay != null ? o.joinDay + day : null;
    const works = isRec() || isHR() || isHM();
    const got = done ? opts.filter((x) => x[0] === done)[0] : null;
    /* A .crit row of the day-90 card: the icon and chip carry the outcome. */
    const good = got && (got[0] === 'well' || got[0] === 'stayed');
    return rcCrit(got ? (good ? 'okc' : 'warnc') : 'ring', got ? (good ? 'ok' : 'warn') : 'mute',
      'Day ' + day + (day === 30 ? ' · how it is going' : ' · whether they stayed'),
      rcSay((day === 30 ? 'With ' + esc(hmOf(reqOf(c)).name) + ' and with ' + esc(first(c.name)) + ', separately.' : 'And why, if not. Then Employee Self-Service takes over.') +
        (got ? '' : due != null ? ' Due ' + esc(sayWhen(due)) + '.' : '')) +
        (!got && works && due != null && due <= 0 ? '<div class="reasons">' + opts.map((x) => '<button class="chip" type="button" data-checkin="' + c.id + '|' + day + '|' + x[0] + '">' + esc(x[1]) + '</button>').join('') + '</div>' : ''),
      got ? rcChip(got[0] === 'stayed' ? 'Still here' : got[1], good ? 'ok' : 'warn') : rcChip('Not yet', 'dash'));
  }
  function onboardHtml(c, o) {
    const done = c.onb || [];
    const works = isRec() || isHR();
    return '<div class="t-onb"><h3 class="b-month">Before day one</h3>' +
      ONBOARD.map((x, i) => '<p class="t-q"><button class="t-check' + (done[i] ? ' is-on' : '') + '" type="button" ' + (works ? 'data-onb="' + c.id + '|' + i + '"' : 'disabled') +
        ' aria-pressed="' + !!done[i] + '" aria-label="' + esc(x[0].replace('{via}', c.wa ? 'on WhatsApp' : 'by email')) + '">' + (done[i] ? svg('check', 12) : '') + '</button><span>' +
        esc(x[0].replace('{via}', c.wa ? 'on WhatsApp' : 'by email')) + '</span><span class="b-kind">' + esc(x[1]) + '</span></p>').join('') +
    '</div>' + dayNinety(c, o);
  }
  /* ── 6. DAY 90, AND THE LOOP IT FEEDS (day-90-learning-loop) ── the
     check-ins as rows with their outcome, kept apart from probation; then
     the learning proposal they feed, waiting behind its sample gate. */
  function dayNinety(c, o) {
    const q = reqOf(c), a = accOf(q);
    const got = CHECK90.filter((x) => x[0] === c.d90)[0];
    const pill = got ? rcChip(got[0] === 'stayed' ? 'Still here' : 'Left', got[0] === 'stayed' ? 'ok' : 'err')
      : o.joinDay != null && o.joinDay + 90 <= 0 ? rcChip('Day 90 due', 'warn') : rcChip(o.joinDay != null && o.joinDay <= 0 ? 'Before day 90' : 'Not started yet', 'dash');
    const n = checkins(), pct = Math.min(100, Math.round(n / GATE * 100));
    return rcard({ cap: 'Offers and onboarding · day 90', ico: 'loop', label: 'Day-90 check-in', cards: [
      '<div class="card">' + rcHead('Day-90 check-in · ' + esc(c.name),
          (o.joinDay != null ? (o.joinDay <= 0 ? 'Joined ' : 'Joins ') + esc(shortAcc(a)) + ' ' + esc(sayDay(o.joinDay)) + ' · ' : '') + 'asked of ' + esc(hmOf(q).name) + ' and of ' + esc(first(c.name)) + ', separately', pill) +
        '<div style="margin-top:10px">' + checkRow(c, o, 30, CHECK30, c.d30) + checkRow(c, o, 90, CHECK90, c.d90) + '</div>' +
        rcNote('shield', 'Separate from probation. Answers feed learning in aggregate only.') + '</div>',
      '<div class="card"><div class="row between"><h4>Learning Proposal · ' + esc(shortAcc(a)) + ' success profile</h4>' +
          (n >= GATE ? rcChip('Enough data', 'ok') : rcChip('Waiting for data', 'dash', 'lock')) + '</div>' +
        '<div class="sub" style="margin-top:6px">Weigh what day-90 outcomes show at screening</div>' +
        '<div class="meter" role="meter" aria-label="Day-90 check-ins recorded" aria-valuemin="0" aria-valuemax="' + GATE + '" aria-valuenow="' + Math.min(n, GATE) + '"><i style="width:' + pct + '%"></i></div>' +
        '<div class="row between" style="margin-top:6px"><span class="sub">' + n + ' of ' + GATE + ' day-90 check-ins needed before AiMY proposes</span><span class="sub">' + pct + '%</span></div></div>'] });
  }

  /* ── The history, and a line to add to it ── in the research cards'
     language: a .card titled "History · Person", each day a .divider, each
     entry a .crit row led by its icon, who and when in the .sub line. */
  function historyBlock(c) {
    const h = historyOf(c);
    const ICO = { apply: 'user', call: 'phone', asmt: 'goal', iv: 'users', offer: 'job', move: 'go', out: 'go', note: 'req' };
    const TONE = { apply: 'brand', call: 'brand', asmt: 'acc', iv: 'acc', offer: 'ok', move: 'ok', out: 'err', note: 'mute' };
    let day = null;
    const sug = c.histSug ? DB.events.filter((e) => e.id === c.histSug)[0] : null;
    return rcard({ cap: 'Candidates and history', ico: 'hist', label: 'History',
      body: rcHead('History · ' + esc(c.name), 'Everything, newest first', rcChip(plural(h.length, 'entry', 'entries'))) +
      ((isRec() || isHR() || isHM()) ? '<div class="t-addnote"><input class="dial-input" id="histNote" type="text" autocomplete="off" spellcheck="false" ' +
          'placeholder="Add something that happened, like: interviewed by the client on Teams, they said yes" aria-label="Add to their history">' +
        rcBtn('Add', 'data-hist-add="' + c.id + '"', 'primary') + '</div>' : '') +
      (sug && sug.read && !c.exit ? rcAimy('I read “' + esc(sug.text) + '” as <b>' + (sug.read === 'yes' ? 'they passed' : 'they did not pass') + '</b>.', 'from your note',
        (sug.read === 'yes' && nextOf(c) ? rcBtn('Move them to ' + lower(STAGE[nextOf(c)].label), 'data-move="' + c.id + '|' + nextOf(c) + '"', 'psmall')
          : sug.read === 'no' ? rcBtn('Mark as not progressing', 'data-out="' + c.id + '|out"', 'psmall') : '') +
        rcBtn('Leave it', 'data-sug-no="' + c.id + '"', 'small')) : '') +
      '<div style="margin-top:4px">' + h.map((x) => {
        const head = x.day !== day ? '<div class="divider">' + esc(dayLabel(x.day)) + '</div>' : '';
        day = x.day;
        const meta = [x.time, x.by && DESKS[x.by] ? DESKS[x.by].name : null].filter(Boolean).join(' · ');
        return head + '<div class="crit" style="border-top:0;padding:8px 0"><span class="' + (RC_ICO[TONE[x.kind]] || 'ico mute') + '">' + svg(ICO[x.kind] || 'req', 18) + '</span>' +
          '<div><b>' + esc(x.text) + '</b>' + (meta ? rcSay(esc(meta)) : '') + '</div><span></span></div>';
      }).join('') + '</div>' });
  }
  /* A note says someone passed or did not, in plain words. */
  const readNote = (t) => /\b(not|didn'?t|did not|no)\b.{0,20}\b(pass|proceed|fit|good)|\bsaid no\b|\brejected\b|\bnot a fit\b/i.test(t) ? 'no'
    : /\b(passed|proceed|said yes|liked (him|her|them)|good fit|move (him|her|them) on|approved)\b/i.test(t) ? 'yes' : null;

  /* ── Editing a candidate's details ── */
  function candEditPage(c) {
    const f = editBuf('cand', c, () => ({ name: c.name, phone: c.phone || '', email: c.email || '', at: c.at, years: c.years, place: c.place,
      langs: c.langs.join(', '), skills: (c.skills || []).join(', '), summary: c.summary || '' }));
    const part = (cap, k, wide) => '<div class="b-cmeta-part' + (wide ? ' t-wide' : '') + '"><h2 class="b-cmeta-cap">' + esc(cap) + '</h2><div class="b-cmeta-say">' +
      '<input class="b-draft-in" type="text" data-ed="' + k + '" value="' + esc(f[k]) + '" aria-label="' + esc(cap) + '"></div></div>';
    return '<div class="s-home">' +
      '<div class="b-topbar s-block-wide"><button class="s-back" type="button" data-cancel-edit>' + svg('back', 14) + 'Back to ' + esc(c.name) + '</button>' +
        '<span class="b-draft-acts"><button class="b-ghost" type="button" data-cancel-edit>Cancel</button>' +
        '<button class="btn btn-brand btn-sm" type="button" data-save-cand="' + c.id + '">Save</button></span></div>' +
      '<section class="s-rec-head s-block-wide">' +
        '<span class="s-rec-kind b-kinds">' + fact('user', 'Editing the candidate') + '</span>' +
        '<div class="t-input-wrap" id="wrapName"><input class="b-draft-name t-input" type="text" data-ed="name" value="' + esc(f.name) + '" aria-label="Name" spellcheck="false">' +
          '<p class="t-error-msg">A candidate needs a name.</p></div>' +
        '<div class="b-cmeta t-edit-grid">' + part('Phone', 'phone') + part('Email', 'email') + part('Now', 'at', true) + part('Years of experience', 'years') +
          part('Where they live', 'place') + part('Languages, comma between', 'langs', true) + part('Skills, comma between', 'skills', true) + '</div>' +
        '<div class="b-cmeta b-said"><div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">Summary</span></div><div class="b-cmeta-say">' +
          '<textarea class="b-draft-in b-draft-area t-area" rows="3" data-ed="summary" aria-label="Summary">' + esc(f.summary) + '</textarea></div></div></div>' +
      '</section>' +
      aimyBlock({ text: 'What the candidate says about themselves stays theirs. Interview findings are not edited here; they come from the interviews.', from: 'how profiles work' }) +
    '</div>';
  }
  function saveCand(c) {
    const f = EDIT.f;
    if (!String(f.name).trim()) { shake('wrapName'); return; }
    const before = { name: c.name, phone: c.phone, email: c.email, at: c.at, years: c.years, place: c.place, langs: c.langs, skills: c.skills, summary: c.summary };
    write(c, { name: String(f.name).trim(), phone: String(f.phone).trim(), email: String(f.email).trim(), at: String(f.at).trim(),
      years: Number(f.years) || c.years, place: String(f.place).trim(), langs: String(f.langs).split(',').map((x) => x.trim()).filter(Boolean),
      skills: String(f.skills).split(',').map((x) => x.trim()).filter(Boolean), summary: String(f.summary).trim() });
    EDIT = null;
    go({ cand: c.id }, true);
    toast('Saved ' + first(c.name) + '’s details', () => { write(c, before); paint(); });
  }
  /* ══ ADDING A CANDIDATE FROM A CV ════════════════════════════════════════
     Upload a CV, AiMY reads it, asks for what is missing, and makes the
     profile (New Operations list). The CV is read as data about a person;
     nothing written inside it is followed as an instruction. Reading is
     fixture: a dropped file is matched to a sample person by its name. */
  const SAMPLE_CVS = {
    support: [
      { name: 'Mariam Hosny', phone: '+20 10 2231 7754', email: 'mariam.hosny@gmail.com', at: 'Technical Support Agent at a SaaS company', years: 3, place: 'Heliopolis', langs: ['Arabic', 'English'], skills: ['Zendesk', 'SQL', 'Customer calls', 'Jira'], file: 'Mariam_Hosny_CV.pdf' },
      { name: 'Ziad Fawzy', phone: null, email: 'ziad.fawzy@outlook.com', at: 'L2 Support Engineer at a fintech', years: 5, place: 'Maadi', langs: ['Arabic', 'English', 'German'], skills: ['Freshdesk', 'REST APIs', 'Log reading', 'SQL'], file: 'Ziad Fawzy - Resume.docx' },
    ],
    finance: [
      { name: 'Nourhan Adel', phone: '+20 11 4420 9183', email: 'nourhan.adel@gmail.com', at: 'AR Accountant at a distributor', years: 4, place: 'Nasr City', langs: ['Arabic', 'English'], skills: ['NetSuite', 'Collections', 'Reconciliations', 'Excel'], file: 'Nourhan Adel CV.pdf' },
      { name: 'Hazem Lotfy', phone: null, email: 'hazem.lotfy@yahoo.com', at: 'Junior Accountant at an audit firm', years: 2, place: 'Giza', langs: ['Arabic', 'English'], skills: ['Excel', 'Month-end close'], file: 'CV_Hazem_Lotfy.pdf' },
    ],
    ops: [
      { name: 'Salma Ezzat', phone: '+20 12 7781 0045', email: 'salma.ezzat@gmail.com', at: 'Operations Coordinator at a logistics company', years: 3, place: 'New Cairo', langs: ['Arabic', 'English'], skills: ['Process mapping', 'Excel', 'Documentation'], file: 'Salma Ezzat Resume.pdf' },
    ],
  };
  /* Each must-have, read against what a CV says. A years rule checks the
     years; a language checks the languages; anything else needs one of the
     person's skills named in it. */
  function evFor(must, p) {
    return must.map((m) => {
      const t = m.toLowerCase();
      const yr = /(\d+)\+?\s*years?/.exec(t);
      if (/german/.test(t)) return p.langs.indexOf('German') >= 0 ? 'm' : 'n';
      if (/english/.test(t) && !yr) return p.langs.indexOf('English') >= 0 ? 'm' : 'n';
      const hit = p.skills.some((s) => t.indexOf(s.toLowerCase().split(' ')[0]) >= 0);
      if (yr) return p.years >= Number(yr[1]) ? (hit || /support|account|operation|analyst/.test(t) ? 'm' : 'p') : 'p';
      return hit ? 'm' : 'n';
    });
  }
  let INTAKE = null;
  const READ_STEPS = ['Reading the CV', 'Finding their contact details', 'Reading their experience against the success profile', 'Checking whether they are already in the pool'];
  function addPage() {
    const q = S.req ? DB.reqById[S.req] : null;
    if (!q) {
      const open = myOpen();
      return '<div class="s-home"><div class="b-topbar s-block-wide"><button class="s-back" type="button" data-trail>' + svg('back', 14) + 'Back</button></div>' +
        '<section class="s-block s-block-wide"><div class="s-camp-list-head"><h2 class="s-block-h">Add a candidate</h2></div>' +
        '<p class="b-tocall">Which requisition is this person for?</p>' +
        '<div class="b-cuts b-cuts-row">' + open.map((x) => '<button class="filter-chip" type="button"' + goAttr({ on: 'add', req: x.id }) + '>' + esc(x.title) + ' · ' + esc(accOf(x).name) + '</button>').join('') + '</div>' +
        (open.length ? '' : '<p class="s-none">You have no open requisitions.</p>') + '</section></div>';
    }
    if (!INTAKE || INTAKE.req !== q.id) INTAKE = { req: q.id, step: 'attach', i: 0 };
    const top = '<div class="b-topbar s-block-wide"><button class="s-back" type="button" data-req="' + q.id + '">' + svg('back', 14) + 'Back to ' + esc(q.title) + '</button></div>';
    let body;
    if (INTAKE.step === 'attach') {
      body = '<label class="t-drop" for="cvFile">' + svg('upload', 22) + '<b>Drop a CV here, or choose a file</b><span>PDF or Word. AiMY reads it as information about the person; nothing written in it is followed as an instruction.</span>' +
        '<input class="t-file" id="cvFile" type="file" accept=".pdf,.doc,.docx" data-cv-file></label>' +
        '<p class="t-acts"><button class="s-insight-lnk" type="button" data-intake-sample>Use a sample CV</button></p>';
    } else if (INTAKE.step === 'reading') {
      body = '<div class="t-steps">' + READ_STEPS.map((s, i) => '<p class="t-stepline' + (i < INTAKE.i ? ' is-done' : i === INTAKE.i ? ' is-now' : '') + '">' +
        '<span class="t-stepmark">' + (i < INTAKE.i ? svg('check', 12) : '') + '</span>' +
        (i === INTAKE.i ? '<span class="t-shimmer" data-text="' + esc(s) + '">' + esc(s) + '</span>' : '<span>' + esc(s) + '</span>') + '</p>').join('') + '</div>' +
        '<p class="b-vfoot">' + esc(INTAKE.file) + '</p>';
    } else {
      const f = INTAKE.f;
      const ev = evFor(q.must, { langs: String(f.langs).split(',').map((x) => x.trim()), skills: String(f.skills).split(',').map((x) => x.trim()), years: Number(f.years) || 0 });
      const dup = DB.cands.filter((c) => c.name.toLowerCase() === String(f.name).trim().toLowerCase() || (f.phone && c.phone && c.phone.replace(/\D/g, '').slice(-9) === String(f.phone).replace(/\D/g, '').slice(-9)))[0];
      const fld = (cap, k, wide) => '<div class="b-cmeta-part' + (wide ? ' t-wide' : '') + '"><h2 class="b-cmeta-cap">' + esc(cap) + '</h2><div class="b-cmeta-say">' +
        '<input class="b-draft-in" type="text" data-in="' + k + '" value="' + esc(f[k] == null ? '' : f[k]) + '" aria-label="' + esc(cap) + '"' + (k === 'phone' && !f.phone ? ' placeholder="Not in the CV. Add it so we can call."' : '') + '></div></div>';
      body = '<div class="t-skel-in">' +
        aimyBlock({ text: 'Read from <b>' + esc(INTAKE.file) + '</b>. ' + (INTAKE.cv.phone ? 'Everything the profile needs was in it.' : '<b>The CV has no phone number.</b> Add one below so we can call them.') + ' Check the rest and change anything I got wrong.', from: 'the CV' }, false) +
        '<div class="t-input-wrap" id="wrapIntakeName"><input class="b-draft-name t-input" type="text" data-in="name" value="' + esc(f.name) + '" aria-label="Name"><p class="t-error-msg">A candidate needs a name.</p></div>' +
        '<div class="b-cmeta t-edit-grid">' + fld('Phone', 'phone') + fld('Email', 'email') + fld('Now', 'at', true) + fld('Years of experience', 'years') + fld('Where they live', 'place') +
          fld('Languages, comma between', 'langs', true) + fld('Skills, comma between', 'skills', true) + '</div>' +
        '<h3 class="b-month">Against the success profile</h3>' +
        '<div class="t-qlist">' + q.must.map((m, i) => '<p class="t-q"><span class="tag tag-' + (ev[i] === 'm' ? 'ok' : ev[i] === 'p' ? 'warn' : 'neutral') + '">' + EVW[ev[i]] + '</span><span>' + esc(m) + '</span></p>').join('') + '</div>' +
        (dup ? aimyBlock({ text: '<b>' + esc(dup.name) + '</b> is already in the pool, for ' + esc(reqOf(dup).title) + ' (' + esc(dup.exit ? EXIT[dup.exit].label.toLowerCase() : STAGE[dup.stage].label.toLowerCase()) + '). The new profile is kept as another application by the same person.', from: 'the talent pool' }) : '') +
        '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-intake-create>Create the profile</button><button class="b-ghost" type="button" data-intake-reset>Start again</button></p>' +
      '</div>';
    }
    return '<div class="s-home">' + top +
      '<section class="s-rec-head s-block-wide"><span class="s-rec-kind b-kinds">' + fact('user', 'New candidate') + fact('req', q.title) + fact('acc', accOf(q).name) + '</span>' +
        '<div class="s-rec-title"><h1 class="s-rec-name">Add a candidate</h1></div></section>' +
      '<section class="s-block s-block-wide" aria-label="CV">' + body + '</section></div>';
  }
  function intakeRead(fileName) {
    const q = DB.reqById[INTAKE.req];
    const list = SAMPLE_CVS[q.fam];
    let h = 0;
    String(fileName || '').split('').forEach((ch) => { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
    const cv = fileName ? list[h % list.length] : list[INTAKE.n = ((INTAKE.n || 0) + 1) % list.length];
    INTAKE.cv = cv;
    INTAKE.file = fileName || cv.file;
    INTAKE.step = 'reading';
    INTAKE.i = 0;
    paint();
    clearInterval(INTAKE.timer);
    INTAKE.timer = setInterval(() => {
      if (!INTAKE || INTAKE.step !== 'reading') { clearInterval(INTAKE && INTAKE.timer); return; }
      INTAKE.i++;
      if (INTAKE.i >= READ_STEPS.length) {
        clearInterval(INTAKE.timer);
        INTAKE.step = 'review';
        INTAKE.f = { name: cv.name, phone: cv.phone || '', email: cv.email, at: cv.at, years: cv.years, place: cv.place, langs: cv.langs.join(', '), skills: cv.skills.join(', ') };
      }
      if (S.on === 'add') paint();
    }, 650);
  }
  function intakeCreate() {
    const q = DB.reqById[INTAKE.req];
    const f = INTAKE.f;
    if (!String(f.name).trim()) { shake('wrapIntakeName'); return; }
    const p = { langs: String(f.langs).split(',').map((x) => x.trim()).filter(Boolean), skills: String(f.skills).split(',').map((x) => x.trim()).filter(Boolean), years: Number(f.years) || 1 };
    const dup = DB.cands.filter((c) => c.name.toLowerCase() === String(f.name).trim().toLowerCase())[0];
    const id = uid('k');
    const c = { id: id, pid: dup ? dup.pid : id, name: String(f.name).trim(), req: q.id, stage: 'applied', exit: null, since: 0, meet: null, fb: false,
      nudged: null, years: p.years, at: String(f.at).trim(), place: String(f.place).trim(), langs: p.langs, skills: p.skills, source: 'Added by the recruiter',
      ev: evFor(q.must, p), maxAt: 'applied', phone: String(f.phone).trim() || null, email: String(f.email).trim(), fate: 'pass', dnc: false, badNumber: false,
      callback: null, applied: 0, summary: p.years + ' years, now ' + lower(String(f.at)) + '. Strongest in ' + p.skills.slice(0, 2).join(' and ') + '.' };
    addCand(c);
    const e = note(c, 'apply', 'Profile made from ' + INTAKE.file + ' by ' + me().name + '.');
    INTAKE = null;
    go({ cand: c.id }, true);
    toast('Added ' + c.name + ' to ' + q.title, () => { unmake('events', e); dropCand(c); go({ req: q.id }, true); },
      'Applied. Send them their profile link from their page.');
  }

  /* ── Booking, nudging and recordings ── */
  function bookIv(c, d, slot) {
    const q = reqOf(c);
    const tpl = tplFor(c.stage);
    const v = make('ivs', { id: uid('iv'), cand: c.id, stage: c.stage, day: d, slot: slot, by: interviewerFor(q, c.stage), mode: 'person',
      status: 'booked', ratings: null, notes: null, verdict: null, recording: null, tpl: tpl ? tpl.id : null });
    const was = { meet: c.meet, slot: c.slot, fb: c.fb };
    write(c, { meet: d, slot: slot, fb: false });
    const e = note(c, 'iv', 'Booked the ' + lower(STAGE[c.stage].label) + ' with ' + v.by + ', ' + sayWhen(d) + ' at ' + slot + '.');
    paint();
    toast('Booked ' + sayWhen(d) + ' at ' + slot, () => { unmake('ivs', v); unmake('events', e); write(c, was); paint(); },
      'On Bookings. AiMY tells ' + first(c.name) + ' from the booking and sends the interviewer the kit.');
  }
  /* A recording is uploaded, transcribed and matched to the success
     profile. AiMY's reading is kept apart from the interviewer's own rating,
     so it can never stand in for it (audit, "independent feedback"). */
  const REC_BUSY = {};
  const ANSWER = {
    m: 'I did that every week in my last job. For example, I took the hardest cases and wrote down how I solved them.',
    p: 'I have done some of it, mostly with help from my team lead.',
    n: 'I have not done that yet, but I would like to learn it.',
  };
  function uploadRec(v) {
    if (REC_BUSY[v.id] || v.recording) return;
    REC_BUSY[v.id] = true;
    paint();
    toast('Uploading the recording', null, 'Transcribing it and matching what was said to the success profile.');
    setTimeout(() => {
      delete REC_BUSY[v.id];
      const c = DB.byId[v.cand];
      const q = reqOf(c);
      const sug = c.ev.map((x, i) => (i % 3 === 2 && x === 'm' ? 'p' : x === 'n' && i % 2 ? 'p' : x));
      const lines = [];
      q.must.forEach((m, i) => { lines.push(['you', 'Give me an example for this one: ' + lower(m) + '.']); lines.push(['them', ANSWER[sug[i]]]); });
      const strong = q.must.filter((m, i) => sug[i] === 'm'), weak = q.must.filter((m, i) => sug[i] !== 'm');
      put('ivs', v, { recording: { mins: 26 + (v.id.length % 17), at: 0, lines: lines,
        summary: (strong.length ? 'Clear examples on ' + strong.join('; ') + '. ' : '') + (weak.length ? 'Less to go on for ' + weak.join('; ') + '.' : ''), suggests: sug } });
      note(c, 'iv', 'Recording of the ' + lower(STAGE[v.stage].label) + ' uploaded and transcribed.');
      paint();
      toast('Transcribed', null, 'It is on the interview, with AiMY’s read of it beside the interviewer’s.');
    }, 2600);
  }

  /* ── The interviewer's debrief, from a link ── outside the product, no
     shell. Two minutes: a rating per must-have with a line, and a verdict.
     Nobody else's feedback shows until this one is in. */
  let DEBRIEF = null;
  /* `lang` puts the English / Arabic switch on the pages candidates see. */
  function outsideHead(title, sub, lang) {
    return '<header class="t-out-head"><span class="t-out-mark">' + mark(22) + '</span><span><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></span>' +
      (lang ? langSwitch() : '') + '</header>';
  }
  function debriefPage() {
    const v = DB.ivs.filter((x) => x.id === S.debrief)[0];
    if (!v) return '<div class="t-out">' + outsideHead('Interview debrief', 'FlairsTech') + '<p class="s-none">This link has expired.</p></div>';
    const c = DB.byId[v.cand], q = reqOf(c);
    if (!DEBRIEF || DEBRIEF.id !== v.id) DEBRIEF = { id: v.id, r: v.ratings ? v.ratings.slice() : [], n: v.notes ? v.notes.slice() : [], v: v.verdict, sent: false };
    if (DEBRIEF.sent || (v.status === 'done' && v.verdict)) {
      return '<div class="t-out">' + outsideHead('Interview debrief', 'For ' + v.by) +
        '<section class="t-out-card t-done">' + successCheck() + '<h1 class="t-out-h">Thank you. It is with the recruiter.</h1>' +
          '<p>You said <b>' + (v.verdict === 'yes' ? 'proceed' : 'do not proceed') + '</b> for ' + esc(c.name) + '. The decision is ' + esc(first(DESKS.omar.name)) + '’s.</p></section></div>';
    }
    const tpl = tplById(v.tpl) || tplFor(v.stage);
    const gaps = q.must.filter((m, i) => c.ev[i] !== 'm');
    const rec = v.recording;
    /* AiMY fills facts, the interviewer gives the verdict (R5). From a
       transcript: each must-have's answer, quoted and marked Check it; and
       the first agenda topic the recording never reaches. */
    const said = (i) => rec && rec.lines && rec.lines[i * 2 + 1] ? rec.lines[i * 2 + 1][1] : null;
    const heard = rec && rec.lines ? rec.lines.map((l) => l[1]).join(' ').toLowerCase() : '';
    const missedTopic = rec && rec.lines && tpl ? tpl.items.filter((x) => !x.toLowerCase().split(/[^a-z-]+/).some((w) => w.length > 4 && heard.indexOf(w) >= 0))[0] : null;
    /* ── 4. THE DEBRIEF (interview-debrief) ── AI fills facts, the
       interviewer gives the verdict: quotes marked Check it, the topic that
       never came up, then ratings and a call that start empty. */
    const quoted = q.must.map((m, i) => [m, said(i), i]).filter((x) => x[1]);
    return '<div class="t-out">' + outsideHead('Interview debrief', 'For ' + v.by) +
      rcard({ cap: 'Interviews · the debrief', ico: 'mic', label: 'The debrief',
        body: rcHead(esc(STAGE[v.stage].label) + ' · ' + esc(c.name),
            esc(sayDay(v.day)) + ' · ' + esc(v.slot) + (rec ? ' · ' + rec.mins + ' min · recorded with consent' : ' · not recorded') + ' · ' + esc(q.title) + ', ' + esc(accOf(q).name),
            rec ? rcChip('Recording', '', 'play') : rcBtn(REC_BUSY[v.id] ? 'Transcribing…' : 'Upload the recording', 'data-rec-up="' + v.id + '"', 'small', 'upload')) +
          (quoted.length ? '<div style="margin-top:12px">' + rcCaps('From the transcript · check it') + quoted.map((x) =>
            rcCrit('quote', 'acc', esc(x[0]), rcQuote('“' + esc(x[1]) + '”' + (rec && rec.suggests ? ' · the recording suggests ' + esc(RATE[rec.suggests[x[2]]].toLowerCase()) : '')),
              rcBtn('Edit', 'data-dr-quote="' + x[2] + '"', 'quiet'))).join('') + '</div>' : '') +
          (missedTopic ? rcWarn('The template asks about <b>' + esc(lower(missedTopic)) + '</b>, and it did not come up. Ask ' + esc(first(c.name)) + ' by message?',
            DEBRIEF.asked ? '<span>Asked ' + esc(viaSay(c)) + '. The answer lands on their record.</span>' : rcBtn('Ask ' + first(c.name) + ' by message', 'data-gap-ask="' + v.id + '"', 'small', 'msg'))
            : gaps.length ? rcWarn('The CV is silent on <b>' + esc(gaps.join('; ')) + '</b>. Ask for an example before you rate it.') : '') +
          (tpl ? '<div style="margin-top:14px">' + rcCaps('The agenda · ' + tpl.title) + '<ol class="agenda">' + tpl.items.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol></div>' : '') +
          '<div class="t-input-wrap" id="wrapDebrief" style="margin-top:14px"><div class="t-input">' +
            rcCaps('Each must-have · your rating') + q.must.map((m, i) => '<div class="rate"><b>' + esc(m) + '</b>' +
              '<div class="verdict">' + ['m', 'p', 'n'].map((k) => (DEBRIEF.r[i] === k ? '<button class="on" type="button"' : '<button type="button"') + ' data-dr="' + i + '|' + k + '">' + RATE[k] + '</button>').join('') + '</div>' +
              '<input class="dial-input" type="text" data-drn="' + i + '" value="' + esc(DEBRIEF.n[i] || '') + '" placeholder="One line on what you saw" aria-label="What you saw on ' + esc(m) + '"></div>').join('') +
            '<div style="margin-top:14px"><h4>Your verdict</h4>' +
            '<div class="verdict">' + [['yes', 'Proceed'], ['no', 'Do not proceed']].map((x) => (DEBRIEF.v === x[0] ? '<button class="on" type="button"' : '<button type="button"') + ' data-dv="' + x[0] + '">' + x[1] + '</button>').join('') + '</div></div>' +
          '</div><p class="t-error-msg">Rate every line, then say proceed or not.</p></div>' +
          rcNote('lock', 'AiMY never fills this. Other interviewers’ feedback stays hidden until you submit yours.') +
          '<div class="row" style="justify-content:flex-end;margin-top:8px">' + rcBtn('Submit debrief', 'data-debrief-submit', 'primary') + '</div>' }) +
    '</div>';
  }
  function debriefSubmit() {
    const v = DB.ivs.filter((x) => x.id === DEBRIEF.id)[0];
    const c = DB.byId[v.cand], q = reqOf(c);
    if (q.must.some((m, i) => !DEBRIEF.r[i]) || !DEBRIEF.v) { shake('wrapDebrief'); return; }
    put('ivs', v, { status: 'done', ratings: DEBRIEF.r.slice(), notes: q.must.map((m, i) => DEBRIEF.n[i] || IV_NOTE[DEBRIEF.r[i]][0]), verdict: DEBRIEF.v,
      day: v.status === 'booked' && v.day > 0 ? 0 : v.day });
    if (c.stage === v.stage && !c.exit) write(c, { fb: true, meet: Math.min(0, c.meet == null ? 0 : c.meet) });
    note(c, 'iv', v.by + ' sent the debrief: ' + (DEBRIEF.v === 'yes' ? 'proceed.' : 'do not proceed.'), { by: null });
    tellDesk(q.rec, { sev: 'p1', type: 'Debrief in', cta: 'Decide', go: { cand: c.id },
      body: v.by.split(',')[0] + ' says ' + (DEBRIEF.v === 'yes' ? 'proceed' : 'do not proceed') + ' on ' + c.name + ', ' + lower(STAGE[v.stage].label) + ' for ' + q.title + '.' });
    DEBRIEF.sent = true;
    paint();
  }
  /* transitions.dev success check, for a person outside the team finishing
     the one thing they came to do. */
  const successCheck = () => '<span class="t-success-check" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path class="t-success-path" d="M20 6 9 17l-5-5"/></svg></span>';

  /* ── Offers ── */
  function offerNew(c) {
    const q = reqOf(c);
    const lo = q.budget ? q.budget.min : 20000, hi = q.budget ? q.budget.max : 30000;
    const exp = c.salary ? Number(String(c.salary).replace(/[^\d]/g, '')) : null;
    const salary = Math.round(Math.min(hi, Math.max(lo, exp || (lo + hi) / 2)) / 500) * 500;
    const o = make('offers', { id: uid('o'), cand: c.id, salary: salary, notice: c.notice || 'one month’s notice', expects: c.salary || null,
      hm: 'waiting', bu: 'waiting', sentDay: null, status: 'approving', joinDay: null, note: null });
    const e = note(c, 'offer', 'Offer prepared at ' + money(salary) + ' and sent to ' + hmOf(q).name + ' and ' + BU_DIRECTOR + ' to approve, at the same time.');
    paint();
    toast('Offer packet ready', () => { unmake('offers', o); unmake('events', e); paint(); }, hmOf(q).name + ' and ' + BU_DIRECTOR + ' approve it in parallel. A person sends it.');
  }
  function offerStep(o, d) {
    const re = o.hm === 'ok' || o.bu === 'ok';
    const before = { salary: o.salary, hm: o.hm, bu: o.bu };
    put('offers', o, { salary: o.salary + d, hm: re ? 'waiting' : o.hm, bu: re ? 'waiting' : o.bu });
    paint();
    if (re) toast('Salary changed to ' + money(o.salary), () => { put('offers', o, before); paint(); }, 'Both approvers are asked again.');
  }
  function offerSend(o) {
    const c = DB.byId[o.cand];
    put('offers', o, { status: 'sent', sentDay: 0 });
    const e = note(c, 'offer', 'Offer sent by ' + me().name + '.');
    paint();
    toast('Offer sent to ' + first(c.name), () => { put('offers', o, { status: 'approving', sentDay: null }); unmake('events', e); paint(); },
      'AiMY answers their questions from the offer facts, ' + viaSay(c) + '. Anything about money comes to you.');
  }
  function offerRes(o, k) {
    const c = DB.byId[o.cand];
    const was = { stage: c.stage, since: c.since, exit: c.exit, maxAt: c.maxAt };
    const months = /two/.test(o.notice) ? 2 : /three/.test(o.notice) ? 3 : /right away/.test(o.notice) ? 0 : 1;
    if (k === 'accepted') {
      put('offers', o, { status: 'accepted', joinDay: months ? months * 30 : 7 });
      write(c, { stage: 'accepted', since: 0, maxAt: 'accepted' });
    } else {
      put('offers', o, { status: 'declined' });
      write(c, { exit: 'offerno', since: 0 });
    }
    const e = note(c, 'offer', k === 'accepted' ? 'Accepted the offer. Joins ' + sayDay(o.joinDay) + '.' : 'Declined the offer.');
    paint();
    toast(k === 'accepted' ? first(c.name) + ' accepted' : first(c.name) + ' declined', () => { put('offers', o, { status: 'sent', joinDay: null }); write(c, was); unmake('events', e); paint(); },
      k === 'accepted' ? 'Onboarding opens from the role template.' : 'The requisition stays open; the next candidate is on it.');
  }
  /* The approver's page, from a link: one packet, one question. */
  let APPROVE_DONE = null;
  function approvePage() {
    const o = DB.offers.filter((x) => x.id === S.approve)[0];
    const by = S.by === 'bu' ? 'bu' : 'hm';
    if (!o) return '<div class="t-out">' + outsideHead('Offer approval', 'FlairsTech') + '<p class="s-none">This link has expired.</p></div>';
    const c = DB.byId[o.cand], q = reqOf(c);
    const who = by === 'hm' ? hmOf(q).name : BU_DIRECTOR;
    const other = by === 'hm' ? o.bu : o.hm;
    const otherWho = by === 'hm' ? BU_DIRECTOR : hmOf(q).name;
    if (APPROVE_DONE === o.id + by || (o[by] === 'ok' && o.status !== 'approving')) {
      return '<div class="t-out">' + outsideHead('Offer approval', 'For ' + who) + '<section class="t-out-card t-done">' + successCheck() +
        '<h1 class="t-out-h">' + (o[by] === 'ok' ? 'Approved.' : 'Sent back to the recruiter.') + '</h1>' +
        '<p>' + (o[by] === 'ok' ? (other === 'ok' ? 'Both approvals are in. ' + esc(first(DESKS.omar.name)) + ' sends the offer.' : 'Waiting on ' + esc(otherWho) + ' too. A person sends it once you both approve.') : 'Nothing goes to ' + esc(first(c.name)) + '.') + '</p></section></div>';
    }
    const ivs = ivsOf(c).filter((v) => v.status === 'done');
    const v = verified(c);
    /* Two approvers, two questions (M3). The hiring manager owns the fit
       and the salary; the BU Director owns the money and the seat, and sees
       only what that takes. */
    const inBand = q.budget && o.salary >= q.budget.min && o.salary <= q.budget.max;
    const hired = DB.byReq[q.id].filter((x) => !x.exit && (x.stage === 'accepted' || x.stage === 'joined')).length;
    return '<div class="t-out">' + outsideHead('Offer approval', 'For ' + who) +
      '<section class="t-out-card">' +
        '<p class="t-out-kicker">' + esc(by === 'hm' ? 'Your call: the fit and the salary' : 'Your call: the budget and the headcount') + '</p>' +
        '<h1 class="t-out-h">' + esc(c.name) + '</h1>' +
        '<p>' + (by === 'bu' ? 'You approve that the budget and the headcount allow this hire at this salary. Whether ' + esc(first(c.name)) + ' fits is ' + esc(otherWho) + '’s call. '
          : esc(q.title) + ' for ' + esc(accOf(q).name) + '. ') + esc(otherWho) + ' approves the same packet at the same time' + (other === 'ok' ? ', and already has.' : '.') + '</p>' +
        (by === 'bu' ? '<div class="b-cmeta t-out-meta">' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Monthly gross</h2><div class="b-cmeta-say"><p class="b-cmeta-p"><b>' + money(o.salary) + '</b></p>' +
            (q.budget ? '<p class="b-cmeta-p">Budget ' + money(q.budget.min) + ' to ' + money(q.budget.max).replace('EGP ', '') + (inBand ? ', inside it' : ', <b>outside it</b>') + '</p>' : '') + '</div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Headcount</h2><div class="b-cmeta-say"><p class="b-cmeta-p">Seat ' + (hired + 1) + ' of ' + q.seats + ' on ' + esc(q.title) + '</p>' +
            '<p class="b-cmeta-p">' + esc(q.kind === 'replacement' ? 'A replacement' : 'A new role') + (q.billable ? ', billable to ' + esc(accOf(q).name) : ', not billable') + '</p></div></div>' +
        '</div><p class="b-vfoot">Whether the BU Director approves the hire or the headcount is decision D7. If it is the headcount and the budget, this question moves to when the requisition opens.</p>'
        : '<div class="b-cmeta t-out-meta">' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Monthly gross</h2><div class="b-cmeta-say"><p class="b-cmeta-p"><b>' + money(o.salary) + '</b></p>' +
            (q.budget ? '<p class="b-cmeta-p">Budget ' + money(q.budget.min) + ' to ' + money(q.budget.max).replace('EGP ', '') + '</p>' : '') +
            (o.expects ? '<p class="b-cmeta-p">They expect ' + esc(o.expects) + '</p>' : '') + '</div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Notice</h2><div class="b-cmeta-say"><p class="b-cmeta-p">' + esc(o.notice) + '</p></div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Interviews</h2><div class="b-cmeta-say"><p class="b-cmeta-p">' + plural(ivs.length, 'interview') + ', ' +
            ivs.filter((x) => x.verdict === 'yes').length + ' said proceed</p><p class="b-cmeta-p">' + v.filter((x) => x.state === 'verified').length + ' of ' + v.length + ' must-haves confirmed</p></div></div>' +
        '</div>') +
        '<input class="dial-input" id="apprNote" type="text" placeholder="A line for the recruiter, if you send it back" aria-label="Note">' +
        '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-appr="' + o.id + '|' + by + '|ok">Approve</button>' +
          '<button class="b-ghost" type="button" data-appr="' + o.id + '|' + by + '|back">Send it back</button></p>' +
      '</section></div>';
  }
  function approve(o, by, k) {
    const c = DB.byId[o.cand];
    const n = byId('apprNote') ? byId('apprNote').value.trim() : '';
    put('offers', o, { [by]: k });
    note(c, 'offer', (by === 'hm' ? hmOf(reqOf(c)).name : BU_DIRECTOR) + (k === 'ok' ? ' approved the offer.' : ' sent the offer back' + (n ? ': ' + n : '.')));
    if (k !== 'ok') tellDesk(reqOf(c).rec, { sev: 'p1', type: 'Offer sent back', cta: 'Open ' + first(c.name), go: { cand: c.id },
      body: (by === 'hm' ? hmOf(reqOf(c)).name : BU_DIRECTOR) + ' sent ' + first(c.name) + '’s offer back' + (n ? ': ' + n : '.') });
    else if (o.hm === 'ok' && o.bu === 'ok') tellDesk(reqOf(c).rec, { sev: 'p1', type: 'Offer approved', cta: 'Send it', go: { cand: c.id },
      body: 'Both approvers said yes to ' + c.name + '’s offer. A person sends it.' });
    APPROVE_DONE = o.id + by;
    paint();
  }

  /* ── Sending an assessment ── */
  function sendAsmt(c) {
    const q = reqOf(c);
    const a = asmtOf(q.asmt || 'a1');
    const s = make('sends', { id: uid('s'), asmt: a.id, cand: c.id, day: 0, status: 'sent', answers: null, score: null, doneDay: null });
    const e = note(c, 'asmt', 'Sent the ' + a.title + ' assessment.');
    paint();
    toast('Sent the assessment to ' + first(c.name), () => { unmake('sends', s); unmake('events', e); paint(); },
      (c.wa ? 'By WhatsApp and email' : 'By email only: no WhatsApp opt-in') + ', with their link. AiMY scores it when they finish.');
  }

  /* ══ FINDING CANDIDATES ══════════════════════════════════════════════════
     Search by a job description, a CV ("someone like this"), a list of
     skills, or an open requisition; across our own pool and the web,
     Apollo and SignalHire (New Operations list). Every result carries its
     score as its own explanation: "3 of 4 must-haves met", with Why behind
     it, never a bare percentage (audit, decision 2). People found outside
     have not applied, so first contact needs a person's approval. */
  /* SAFE SOURCING (P4, R8). The pool first, the public web second, one
     list. LinkedIn bans scraping, so the web means public pages only, and
     each result names the page it came from. Apollo only adds a work email
     to someone already found (its contract is still to be checked).
     SignalHire stays parked (decision D10): consent and accuracy
     complaints. Everyone found outside is a prospect until they reply. */
  const FIND_SOURCES = [
    { k: 'pool', label: 'Our talent pool', say: 'People who applied before', tag: 'Talent pool' },
    { k: 'web', label: 'The public web', say: 'GitHub, portfolios and company pages, never LinkedIn scraping', tag: 'Prospect' },
    { k: 'apollo', label: 'Apollo', say: 'Adds a work email to people found', tag: 'Apollo', enrich: true },
    { k: 'signal', label: 'SignalHire', say: 'Parked, decision D10', parked: true },
  ];
  const WEB_PAGES = [['Public GitHub profile', 'github.com/'], ['Portfolio', 'behance.net/'], ['Company team page', 'team page, '], ['Conference speaker page', 'speaker, ']];
  const KEYS_TO_MUST = [
    [/german/i, 'German at C1 or above'], [/english/i, 'Fluent English'], [/\bsql\b/i, 'SQL to read logs and data'],
    [/zendesk|freshdesk|ticket/i, 'Ticketing tools (Zendesk or Freshdesk)'], [/support|helpdesk|customer/i, 'Software support experience'],
    [/netsuite|erp|oracle/i, 'NetSuite or a similar ERP'], [/receivable|collection/i, 'Accounts receivable and collections'],
    [/excel/i, 'Advanced Excel'], [/reconcil/i, 'Bank reconciliations'], [/process|operation/i, 'Process documentation'],
    [/jira/i, 'Jira'], [/api/i, 'REST APIs'],
  ];
  let FIND = { q: '', req: null, src: { pool: true, web: true, apollo: true, signal: false }, step: 'ask', i: 0, res: [], done: {}, tab: 'pool', why: {} };
  function findCriteria() {
    if (FIND.req && DB.reqById[FIND.req]) return DB.reqById[FIND.req].must.slice();
    const t = FIND.q || '';
    const out = KEYS_TO_MUST.filter((x) => x[0].test(t)).map((x) => x[1]);
    const y = /(\d+)\+?\s*years?/i.exec(t);
    if (y) out.unshift(y[1] + '+ years of experience');
    return out.slice(0, 6);
  }
  const WEB_AT = ['Support Engineer at a payments startup', 'Customer Success Specialist at a SaaS company', 'Accountant at a logistics group',
    'Operations Analyst at an e-commerce company', 'Technical Support Lead at a telecom', 'AR Specialist at a hospital group', 'Helpdesk Engineer at a bank'];
  function runFind() {
    const crit = findCriteria();
    if (!crit.length) { shake('wrapFind'); return; }
    FIND.crit = crit;
    FIND.step = 'searching';
    FIND.i = 0;
    FIND.done = {};
    FIND.why = {};
    SEL.find = {};
    FIND.res = gatherFind(crit);
    paint();
    clearInterval(FIND.timer);
    const steps = findSteps();
    FIND.timer = setInterval(() => {
      FIND.i++;
      if (FIND.i >= steps.length) { clearInterval(FIND.timer); FIND.step = 'results'; FIND.reveal = true; }
      if (S.on === 'find') paint();
    }, 620);
  }
  /* Who comes back for these criteria, from the sources FIND has on: the
     pool first, the web second, one list. Shared by the Find tab and the
     chat, so both bring back the same people for the same ask. */
  function gatherFind(crit) {
    let h = 7;
    (FIND.q + '|' + (FIND.req || '')).split('').forEach((ch) => { h = (h * 33 + ch.charCodeAt(0)) >>> 0; });
    const r = rng(h);
    const fam = FIND.req ? DB.reqById[FIND.req].fam : famOf(FIND.q);
    const res = [];
    const fromPerson = (p, src, extra) => {
      if (D.gone.some((g) => g.name === p.name)) return;
      const ev = evFor(crit, { langs: p.langs, skills: p.skills || [], years: p.years });
      res.push(Object.assign({ src: src, name: p.name, at: p.at, place: p.place, years: p.years, langs: p.langs, skills: p.skills || [], ev: ev,
        score: ev.filter((x) => x === 'm').length + ev.filter((x) => x === 'p').length * 0.5, phone: p.phone || null, email: p.email || null }, extra || {}));
    };
    if (FIND.src.pool) {
      const seen = {};
      DB.cands.filter((c) => (c.exit === 'out' || c.exit === 'clientno' || c.exit === 'withdrew') && reqOf(c).fam === fam).forEach((c) => {
        if (seen[c.pid] || res.length > 6) return;
        seen[c.pid] = 1;
        fromPerson(c, 'pool', { pid: c.pid, was: reqOf(c).title + ', ' + EXIT[c.exit].label.toLowerCase(), consent: c.exit === 'withdrew' ? 'Withdrew last time. Ask before calling.' : 'Applied before and agreed to hear about other roles.' });
      });
    }
    const make1 = (n) => {
      for (let i = 0; i < n; i++) {
        const woman = chance(r, 0.5);
        const p = { name: pick(r, woman ? WOMEN : MEN) + ' ' + pick(r, LAST), at: pick(r, WEB_AT), place: pick(r, PLACES), years: between(r, 1, 9),
          langs: chance(r, 0.25) ? ['Arabic', 'English', 'German'] : ['Arabic', 'English'], skills: SKILLS[fam].filter(() => chance(r, 0.45)).slice(0, 4) };
        const page = pick(r, WEB_PAGES);
        const mail = FIND.src.apollo && chance(r, 0.6);
        fromPerson(p, 'web', {
          phone: null,
          email: mail ? p.name.toLowerCase().split(' ').join('.') + '@company.com' : null, emailFrom: mail ? 'Apollo' : null,
          page: page[0], link: page[1] + (page[1].indexOf('/') > 0 ? p.name.toLowerCase().split(' ').join('') : sayDay(-between(r, 20, 200))),
          consent: 'A prospect: has not applied or agreed to anything. First contact needs your approval.' });
      }
    };
    if (FIND.src.web) make1(between(r, 5, 8));
    /* The pool first, then the web, each strongest first: one list. */
    res.sort((a, b) => (a.src === 'pool' ? 0 : 1) - (b.src === 'pool' ? 0 : 1) || b.score - a.score);
    res.forEach((x, i) => { x.i = i; });
    return res;
  }

  /* ══ FINDING THROUGH THE CHAT (Sales B8) ══════════════════════════════════
     Describe who you want; AiMY asks where to look, reads the success
     profile back, and brings back a draft shortlist, "Not saved yet", with a
     Keep tick on each card. Leaving an unsaved draft shows a gate at the top
     of the page, not a dialog, and the browser's Back is caught too. */
  let FC = null, DRAFT = null, LEAVE = null;
  function fcSay(who, html, acts) {
    const ch = chatFor();
    if (!ch.title && who === 'you') ch.title = html.length > 56 ? html.slice(0, 55) + '…' : html;
    ch.turns.push({ who: who, html: who === 'you' ? esc(html) : html, acts: acts || [] });
    saveChats();
    paintThread();
  }
  function findChat(reqId, text) {
    CHAT_AT = null;
    FC = { req: reqId || null, q: text || '', src: null };
    peekHide();
    if (!canvasShown()) openCanvas();
    if (!chatNow() || !chatNow().title) chatFor().title = text || 'Find people';
    if (text) fcSay('you', text);
    fcSay('aimy', 'From your talent pool, the public web, or both? The pool comes first either way; SignalHire stays parked and nothing is scraped from LinkedIn.', [
      { label: 'Both, pool first', data: 'fc="both"', primary: true }, { label: 'Only the pool', data: 'fc="pool"' }, { label: 'Only the public web', data: 'fc="web"' }]);
  }
  function fcCrit() {
    FIND.q = FC.q; FIND.req = FC.req;
    return findCriteria();
  }
  function fcStep(v) {
    if (!FC) return;
    const open = DB.reqs.filter(isOpen).filter((q) => isHR() || q.rec === DESK);
    if (v === 'both' || v === 'pool' || v === 'web') {
      FC.src = v;
      fcSay('you', { both: 'Both, pool first', pool: 'Only the pool', web: 'Only the public web' }[v]);
    } else if (v.indexOf('req:') === 0) {
      FC.req = v.slice(4);
      fcSay('you', DB.reqById[FC.req].title);
    }
    if (v === 'both' || v === 'pool' || v === 'web' || v.indexOf('req:') === 0) {
      const crit = fcCrit();
      if (!crit.length) {
        fcSay('aimy', 'For which requisition? I read its success profile, so the people come back already judged against it.',
          open.slice(0, 6).map((q) => ({ label: q.title + ' · ' + accOf(q).name, data: 'fc="req:' + q.id + '"' })));
        return;
      }
      fcSay('aimy', 'I read that as ' + (FC.req ? 'the success profile for <b>' + esc(DB.reqById[FC.req].title) + '</b>' : 'what you wrote') + ': ' +
        crit.map((m) => '<b>' + esc(m) + '</b>').join(', ') + '. Each person comes back with how many of these they meet; a profile that is silent on one reads Not known, not No.',
        [{ label: 'That is enough', data: 'fc="enough"', primary: true }]);
      return;
    }
    if (v === 'enough') {
      fcSay('you', 'That is enough');
      FIND.src = { pool: FC.src !== 'web', web: FC.src !== 'pool', apollo: true, signal: false };
      const crit = fcCrit();
      const res = gatherFind(crit);
      const title = (FC.req ? DB.reqById[FC.req].title : crit[0] || 'People') + ', ' + sayDay(0);
      FC.res = res; FC.crit = crit; FC.name = title;
      const pool = res.filter((x) => x.src === 'pool').length;
      fcSay('aimy', '<b>' + plural(res.length, 'person', 'people') + '</b> came back: ' + plural(pool, 'from your pool', 'from your pool') + ', ' + (res.length - pool) + ' from public pages, each page named. I would call it “' + esc(title) + '”.',
        [{ label: 'Curate the list', data: 'fc="curate"', primary: true }]);
      return;
    }
    if (v === 'curate') {
      DRAFT = { name: FC.name, req: FC.req, crit: FC.crit, res: FC.res, keep: {} };
      FC = null;
      closeCanvas();
      go({ on: 'draft' });
    }
  }
  /* The draft, or a saved shortlist (`?on=draft&list=`). */
  function draftPage() {
    const saved = S.list ? D.lists.filter((l) => l.id === S.list)[0] : null;
    const d = saved || DRAFT;
    if (!d) return '<div class="s-home"><div class="b-topbar s-block-wide"><button class="s-back" type="button" data-trail>' + svg('back', 14) + 'Back</button></div>' +
      '<section class="s-block s-block-wide"><p class="s-none">Nothing to review. Ask AiMY to find people.</p></section></div>';
    const q = d.req ? DB.reqById[d.req] : null;
    const kept = d.res.filter((x) => saved || d.keep[x.i] !== false);
    const pool = d.res.filter((x) => x.src === 'pool').length;
    const gate = !saved && LEAVE ? '<section class="s-insight is-lead b-lead-slim b-gate s-block-wide" aria-label="Not saved">' +
      '<div class="s-lead-mark">' + mark(14) + '<span class="work-state ws-staged" data-work-state="staged">Awaiting You</span></div>' +
      '<p class="s-lead-deck">This shortlist is not saved. <b>' + plural(d.res.length, 'person', 'people') + '</b> came back and nobody is working them.</p>' +
      '<p class="b-gate-note">Leaving throws them away. Save it and it is yours; put it on a requisition and they join your queue.</p>' +
      '<div class="s-lead-acts"><button class="s-insight-lnk primary" type="button" data-draft-save>Save</button>' +
        '<button class="s-insight-lnk" type="button" data-draft-discard>Discard</button><button class="s-inline-btn" type="button" data-draft-stay>Stay</button></div></section>' : '';
    const open = DB.reqs.filter(isOpen).filter((x) => isHR() || x.rec === DESK);
    const addBtn = q ? '<button class="s-insight-lnk primary" type="button" data-draft-add="' + q.id + '">Add ' + kept.length + ' to ' + esc(q.title) + '</button>'
      : '<span class="b-menu-wrap"><button class="s-insight-lnk primary b-menu-open" type="button" data-pickopen="drAdd" aria-haspopup="menu">Add ' + kept.length + ' to a requisition' + svg('down', 14) + '</button>' +
        '<div class="b-menu" id="drAdd" role="menu" hidden>' + open.map((x) => '<button class="b-menu-item" type="button" role="menuitem" data-draft-add="' + x.id + '"><span class="b-menu-name">' + esc(x.title) + '</span><span class="tel-menu-cc">' + esc(accOf(x).name) + '</span></button>').join('') + '</div></span>';
    return '<div class="s-home">' + gate +
      '<div class="b-topbar s-block-wide"><button class="s-back" type="button" data-trail>' + svg('back', 14) + 'Back</button></div>' +
      '<section class="s-rec-head s-block-wide">' +
        '<span class="s-rec-kind b-kinds">' + fact('users', 'Shortlist') + (saved ? tag('Saved ' + sayWhen(saved.day), 'ok') : tag('Not saved yet', 'warn')) + '</span>' +
        '<div class="s-rec-title"><h1 class="s-rec-name">' + esc(d.name) + '</h1></div>' +
        '<div class="b-cmeta"><div class="b-cmeta-part"><h2 class="b-cmeta-cap">Who came back</h2><div class="b-cmeta-say"><p class="b-cmeta-p">' +
          plural(pool, 'person', 'people') + ' from the talent pool, ' + (d.res.length - pool) + ' from public pages' + (q ? ', read against the success profile for ' + esc(q.title) : '') +
          '. Read against: ' + esc(d.crit.join('; ')) + '. Web people are prospects: first contact waits for your approval.</p></div></div></div>' +
        '<div class="s-rec-actions">' + addBtn + (saved ? '<button class="b-ghost" type="button" data-list-del="' + saved.id + '">Delete it</button>'
          : '<button class="b-ghost" type="button" data-draft-save>Save</button><button class="b-ghost" type="button" data-draft-discard>Discard</button>') + '</div>' +
      '</section>' +
      '<section class="s-block s-block-wide"><div class="s-camp-list-head"><h2 class="s-block-h">Who is on it</h2><span class="s-block-say">' +
        (saved ? plural(d.res.length, 'person', 'people') : kept.length + ' of ' + d.res.length + ' kept · untick anyone you do not want') + '</span></div>' +
        '<div class="b-grid">' + d.res.map((x, i) => '<div class="b-slot">' + draftCard(x, i, d, !!saved) + '</div>').join('') + '</div></section>' +
    '</div>';
  }
  function draftCard(x, i, d, saved) {
    const met = x.ev.filter((e) => e === 'm').length;
    const keep = saved || d.keep[x.i] !== false;
    return '<article class="type-card s-card b-qcard" style="--i:' + Math.min(i, 8) + '">' +
      '<div class="tc-head">' + tag(x.src === 'pool' ? 'Talent pool' : 'Prospect', x.src === 'pool' ? 'ok' : 'neutral') +
        '<span class="b-kind">' + esc(x.was || (x.page ? x.page + ' · ' + x.link : '')) + '</span></div>' +
      '<div class="b-qcard-top"><span class="tc-title s-card-title">' + esc(x.name) + '</span></div>' +
      '<p class="tc-summary b-qcard-role">' + esc(x.at) + '</p>' +
      '<p class="b-qcard-where">' + fact('job', plural(x.years, 'year')) + fact('pin', x.place) + fact('lang', x.langs.join(', ')) + '</p>' +
      aimyBlock({ text: '<b>' + met + ' of ' + x.ev.length + '</b> must-haves met' + (x.ev.filter((e) => e === 'n').length ? '; ' + x.ev.filter((e) => e === 'n').length + ' not known, which is not a no' : '') + '.', from: x.src === 'pool' ? 'their history with us' : 'a public page, named' }) +
      '<p class="b-vfoot">' + esc(x.consent) + (x.email ? (x.emailFrom ? ' Work email from ' + esc(x.emailFrom) + '.' : ' Email on file.') : '') + '</p>' +
      (saved ? '' : '<div class="tc-gov b-qcard-foot"><span></span><button class="filter-chip' + (keep ? ' active' : '') + '" type="button" data-keep="' + x.i + '" aria-pressed="' + keep + '">' + (keep ? svg('check', 12) + 'Keep' : 'Keep') + '</button></div>') +
    '</article>';
  }
  /* Put the kept people on a requisition, as Find's own add does; one Undo
     takes back all of them. */
  function draftAdd(reqId) {
    const saved = S.list ? D.lists.filter((l) => l.id === S.list)[0] : null;
    const d = saved || DRAFT, q = DB.reqById[reqId];
    if (!d || !q) return;
    /* findAdd reads FIND.res by each person's own index. */
    const byI = []; d.res.forEach((x) => { byI[x.i] = x; });
    FIND.res = byI; FIND.done = {};
    const made = d.res.filter((x) => saved || d.keep[x.i] !== false).map((x) => findAdd(x.i, reqId, true)).filter(Boolean);
    const wasDraft = DRAFT;
    if (!saved) DRAFT = null;
    LEAVE = null;
    go({ req: q.id }, false, true);
    toast(plural(made.length, 'person', 'people') + ' added to ' + q.title, () => { made.forEach(dropCand); if (!saved) DRAFT = wasDraft; paint(); },
      made.some((c) => !c.contactOk) ? 'They are at Sourced. First contact with the web people waits for your approval.' : 'They are at Sourced.');
  }
  function draftSave() {
    const d = DRAFT; if (!d) return;
    const l = { id: uid('l'), name: d.name, req: d.req, crit: d.crit, res: d.res.filter((x) => d.keep[x.i] !== false), day: 0, by: DESK };
    D.lists.push(l); save();
    DRAFT = null;
    const to = LEAVE || { on: 'draft', list: l.id };
    LEAVE = null;
    go(to, false, true);
    toast('Shortlist saved', () => { D.lists = D.lists.filter((x) => x.id !== l.id); DRAFT = d; save(); paint(); }, plural(l.res.length, 'person', 'people') + ', under Find candidates.');
  }
  function draftDiscard() {
    const d = DRAFT;
    DRAFT = null;
    const to = LEAVE || {};
    LEAVE = null;
    go(to, false, true);
    toast('Shortlist discarded', () => { DRAFT = d; go({ on: 'draft' }, false, true); });
  }
  const findSteps = () => ['Reading what to look for'].concat(FIND_SOURCES.filter((s) => FIND.src[s.k] && !s.parked)
    .map((s) => s.enrich ? 'Adding work emails from ' + s.label : 'Searching ' + lower(s.label)))
    .concat(['Reading each profile against the criteria']);
  function findPage() {
    if (S.req && S.req !== FIND.req && FIND.step !== 'results') FIND.req = S.req;
    const open = DB.reqs.filter(isOpen).filter((q) => isHR() || q.rec === DESK);
    const crit = findCriteria();
    let body = '', after = '';
    if (FIND.step === 'searching') {
      const steps = findSteps();
      body = '<div class="t-steps">' + steps.map((s, i) => '<p class="t-stepline' + (i < FIND.i ? ' is-done' : i === FIND.i ? ' is-now' : '') + '">' +
        '<span class="t-stepmark">' + (i < FIND.i ? svg('check', 12) : '') + '</span>' +
        (i === FIND.i ? '<span class="t-shimmer" data-text="' + esc(s) + '">' + esc(s) + '</span>' : '<span>' + esc(s) + '</span>') + '</p>').join('') + '</div>' +
        '<div class="b-grid">' + [0, 1, 2].map(() => '<div class="b-slot"><div class="b-skel s-skel-card"><div class="s-skel-line skeleton"></div><div class="s-skel-line skeleton"></div><div class="s-skel-line skeleton"></div><div class="s-skel-line skeleton"></div></div></div>').join('') + '</div>';
    } else if (FIND.step === 'results') {
      after = sourcingCard();
      FIND.reveal = false;
    }
    return '<div class="s-home">' +
      (isRec() ? '' : '<div class="b-topbar s-block-wide"><button class="s-back" type="button" data-trail>' + svg('back', 14) + 'Back</button></div>') +
      '<section class="s-block s-block-wide" aria-label="Find candidates">' +
        '<div class="s-camp-list-head">' + switcher('find') + '</div>' +
        '<div class="t-input-wrap" id="wrapFind"><textarea class="dial-input t-area t-input t-findq" rows="3" data-find-q aria-label="What to look for" ' +
          'placeholder="Paste a job description or a CV, or list skills: German, Zendesk, SQL, 3 years">' + esc(FIND.q) + '</textarea>' +
          '<p class="t-error-msg">Tell me what to look for, or pick a requisition.</p></div>' +
        '<p class="b-tocall">Or look for people who fit an open requisition:</p>' +
        '<div class="b-cuts">' + open.map((q) => '<button class="filter-chip' + (FIND.req === q.id ? ' active' : '') + '" type="button" data-find-req="' + q.id + '">' + esc(q.title) + ' · ' + esc(accOf(q).name) + '</button>').join('') + '</div>' +
        '<p class="b-tocall">Where to look:</p>' +
        '<div class="b-cuts">' + FIND_SOURCES.map((s) => s.parked
          ? '<button class="filter-chip t-parked" type="button" disabled title="Consent and accuracy complaints. Kept off until decision D10.">' + esc(s.label) + '<span class="b-cut-n">' + esc(s.say) + '</span></button>'
          : '<button class="filter-chip' + (FIND.src[s.k] ? ' active' : '') + '" type="button" data-find-src="' + s.k + '" aria-pressed="' + !!FIND.src[s.k] + '">' + esc(s.label) + '<span class="b-cut-n">' + esc(s.say) + '</span></button>').join('') + '</div>' +
        (crit.length ? '<p class="b-vfoot">Read against: ' + esc(crit.join('; ')) + '.</p>' : '') +
        '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-find-go>' + (FIND.step === 'results' ? 'Search again' : 'Find candidates') + '</button>' +
          '<button class="b-ghost" type="button" data-start="find">Or ask AiMY in the chat</button></p>' +
        body +
      '</section>' + after +
      (D.lists.length ? '<section class="s-block s-block-wide" aria-label="Saved shortlists"><div class="s-camp-list-head"><h2 class="s-block-h">Saved shortlists</h2><span class="s-block-say">' + D.lists.length + '</span></div>' +
        '<div class="b-owed">' + D.lists.slice().reverse().map((l, i) => '<button class="b-owed-row" type="button"' + goAttr({ on: 'draft', list: l.id }) + ' style="--i:' + Math.min(i, 8) + '">' +
          '<span class="b-owed-sev" aria-hidden="true"></span><span class="b-owed-main"><span class="b-owed-head"><span class="b-owed-type">' + esc(l.name) + '</span>' +
            '<span class="b-owed-by">' + plural(l.res.length, 'person', 'people') + (l.req && DB.reqById[l.req] ? ' · ' + esc(DB.reqById[l.req].title) : '') + '</span></span>' +
            '<span class="b-owed-body">Saved ' + esc(sayWhen(l.day)) + ' by ' + esc(DESKS[l.by] ? DESKS[l.by].name : 'you') + '.</span></span>' +
          '<span class="b-owed-go">Open it</span></button>').join('') + '</div></section>' : '') +
    '</div>';
  }
  /* ── 11. SOURCING, POOL FIRST (sourcing-pool-first) ── what was asked, in
     the search line; our own pool first, warm people with their history;
     the web people counted apart as prospects, not candidates until they
     reply; and how first contact goes. Each row adds the person in one
     press, with Undo. */
  const findTab = () => FIND.tab === 'web' && FIND.res.some((x) => x.src !== 'pool') || !FIND.res.some((x) => x.src === 'pool') ? 'web' : 'pool';
  const inTab = (x) => (findTab() === 'pool') === (x.src === 'pool');
  function sourcingCard() {
    const pool = FIND.res.filter((x) => x.src === 'pool'), web = FIND.res.filter((x) => x.src !== 'pool');
    const tab = findTab();
    const open = DB.reqs.filter(isOpen).filter((r) => isHR() || r.rec === DESK);
    const n = selN('find'), left = FIND.res.filter((x) => inTab(x) && !FIND.done[x.i]).length;
    const q = FIND.req ? DB.reqById[FIND.req] : null;
    const asked = FIND.q.trim() ? FIND.q.trim().split('\n')[0] : q ? 'People who fit ' + q.title : 'Anyone who fits';
    const mails = web.filter((x) => x.emailFrom).length;
    /* Met, and what their profile is silent on, said apart (unknown is not a no). */
    const known = (x) => { const m = x.ev.filter((e) => e === 'm').length, u = x.ev.filter((e) => e === 'n').length;
      return m + ' of ' + x.ev.length + ' met' + (u ? ', ' + u + ' not known yet' : ''); };
    const why = (x) => '<div class="reasons" style="grid-column:2 / -1;margin-top:0">' + FIND.crit.map((m, k) => rcChip(EVW[x.ev[k]] + ' · ' + m, x.ev[k] === 'm' ? 'ok' : x.ev[k] === 'p' ? 'warn' : 'dash')).join('') + '</div>';
    const row = (x, k, body, right) => '<div class="person"' + (k ? '' : ' style="border-top:0"') + '>' + body + '<div class="row" style="gap:8px">' + right +
      rcBtn(FIND.why[x.i] ? 'Hide why' : 'Why', 'data-find-why="' + x.i + '" aria-expanded="' + !!FIND.why[x.i] + '"', 'quiet') +
      (FIND.done[x.i] ? '' : selBox('find', x.i, x.name)) + '</div>' + (FIND.why[x.i] ? why(x) : '') + '</div>';
    const add = (x) => FIND.done[x.i] ? '<span class="sub">Added to ' + esc(FIND.done[x.i]) + '</span>' : findAddBtn(x);
    const rows = tab === 'pool'
      ? pool.map((x, k) => row(x, k, '<div class="av" aria-hidden="true">' + esc(initials(x.name)) + '</div><div><h4>' + esc(x.name) + '</h4><div class="sub">' + esc(x.was) + ' · ' + esc(known(x)) + ' · ' + esc(x.consent) + '</div></div>',
          (/^Withdrew/.test(x.consent) ? rcChip('Ask first', 'warn') : rcChip('Warm', 'ok')) + add(x))).join('') +
        (web.length ? '<div class="divider">Web prospects · not candidates until they reply</div>' +
          '<div class="person"><div class="av g" aria-hidden="true">' + svg('globe', 15) + '</div><div><h4>' + plural(web.length, 'public profile') + '</h4><div class="sub">Source shown on each · minimal data kept · nobody contacted</div></div>' +
            '<div class="row" style="gap:8px">' + rcChip('Prospect', 'dash') + rcBtn('See them', 'data-find-tab="web"', 'small') + '</div></div>' : '')
      : web.map((x, k) => row(x, k, '<div class="av g" aria-hidden="true">' + svg('globe', 15) + '</div><div><h4>' + esc(x.name) + '</h4><div class="sub">' + esc(x.at) + ' · ' + esc(known(x)) + ' · ' + esc(x.page) + ', ' + esc(x.link.indexOf('/') > 0 ? x.link : x.link.split(', ').pop()) +
          (x.emailFrom ? ' · work email from ' + esc(x.emailFrom) : '') + '</div></div>', rcChip('Prospect', 'dash') + add(x))).join('');
    return '<section class="rc s-block-wide" aria-label="What AiMY found">' +
      '<div class="eyebrow">' + svg('find', 14) + ' Sourcing and search</div>' +
      '<div class="search">' + svg('find', 16) + '<span>' + esc(asked) + '</span>' + (q ? '<span style="margin-left:auto" class="chip acc">' + svg('doc', 12) + ' from ' + esc(q.title) + '</span>' : '') + '</div>' +
      '<div class="tabs" role="tablist">' + [['pool', 'In your pool', pool.length], ['web', 'Web prospects', web.length]].map((t) =>
        (t[0] === tab ? '<button class="on" type="button" role="tab" aria-selected="true"' : '<button type="button" role="tab" aria-selected="false"') + ' data-find-tab="' + t[0] + '">' + t[1] + '<b>' + t[2] + '</b></button>').join('') + '</div>' +
      '<div class="card" style="padding:4px 16px 12px">' + (rows || '<div class="person" style="border-top:0"><div class="av g" aria-hidden="true">' + svg('find', 15) + '</div><div><h4>Nobody here</h4><div class="sub">Try the other sources above</div></div><span></span></div>') +
        '<div class="row between" style="margin-top:10px;flex-wrap:wrap"><span class="sub">' + svg('mail', 12) + ' First contact by email with a privacy notice' +
          (tab === 'web' ? ', once you approve it' + (mails ? ' · ' + mails + ' with a work email from Apollo' : '') : '') + '</span>' +
          '<span class="row" style="gap:8px;flex-wrap:wrap">' + (left ? rcBtn('Select all ' + left, 'data-sel-all="find"', 'small') : '') +
          (q && FIND.res.some((x) => !FIND.done[x.i]) ? rcBtn('Add the 5 strongest to ' + q.title, 'data-find-top', 'primary') : '') + '</span></div>' +
        (D.gone.length ? rcNote('ban', plural(D.gone.length, 'person', 'people') + ' asked to be deleted. They stay out of every search.') : '') +
      '</div>' +
      /* Select many, act once (M7): one press adds them all, one Undo. */
      batchBar('find', q ? '<button class="s-insight-lnk primary" type="button" data-find-sel="' + q.id + '">Add ' + n + ' to ' + esc(q.title) + '</button>'
        : '<span class="b-menu-wrap"><button class="s-insight-lnk primary b-menu-open" type="button" data-pickopen="faSel" aria-haspopup="menu">Add ' + n + ' to a requisition' + svg('down', 14) + '</button>' +
          '<div class="b-menu" id="faSel" role="menu" hidden>' + open.map((r) => '<button class="b-menu-item" type="button" role="menuitem" data-find-sel="' + r.id + '"><span class="b-menu-name">' + esc(r.title) + '</span><span class="tel-menu-cc">' + esc(accOf(r).name) + '</span></button>').join('') + '</div></span>') +
    '</section>';
  }
  function findAddBtn(x) {
    const open = DB.reqs.filter(isOpen).filter((q) => isHR() || q.rec === DESK);
    return FIND.req ? rcBtn('Add', 'data-find-add="' + x.i + '|' + FIND.req + '"', 'small', 'plus')
      : '<span class="b-menu-wrap"><button class="btn small b-menu-open" type="button" data-pickopen="fa' + x.i + '" aria-haspopup="menu">' + svg('plus', 13) + ' Add ' + svg('down', 12) + '</button>' +
        '<div class="b-menu" id="fa' + x.i + '" role="menu" hidden>' + open.map((q) => '<button class="b-menu-item" type="button" role="menuitem" data-find-add="' + x.i + '|' + q.id + '"><span class="b-menu-name">' + esc(q.title) + '</span><span class="tel-menu-cc">' + esc(accOf(q).name) + '</span></button>').join('') + '</div></span>';
  }
  function findAdd(i, reqId, quiet) {
    const x = FIND.res[i];
    const q = DB.reqById[reqId];
    if (!x || !q || FIND.done[i]) return null;
    const id = uid('k');
    const c = { id: id, pid: x.pid || id, name: x.name, req: q.id, stage: 'sourced', exit: null, since: 0, meet: null, fb: false, nudged: null,
      years: x.years, at: x.at, place: x.place, langs: x.langs, skills: x.skills, source: x.src === 'pool' ? 'From the talent pool' : 'Found on the web', page: x.page || null, link: x.link || null,
      ev: evFor(q.must, x), maxAt: 'sourced', phone: x.phone, email: x.email, fate: 'pass', dnc: false, badNumber: false, callback: null, applied: 0,
      contactOk: x.src === 'pool' && x.consent.indexOf('Withdrew') < 0, summary: x.years + ' years, now ' + lower(x.at) + '.' };
    addCand(c);
    FIND.done[i] = q.title;
    if (!quiet) { paint(); toast('Added ' + x.name + ' to ' + q.title, () => { dropCand(c); delete FIND.done[i]; paint(); }, c.contactOk ? 'Sourced. They agreed to hear about roles, so you can call.' : 'Sourced. First contact waits for your approval.'); }
    return c;
  }

  /* ══ ASSESSMENTS ═════════════════════════════════════════════════════════
     Build them by hand or with AiMY, share a link, AiMY scores the answers,
     and the questions everyone fails come back as something to fix (New
     Operations list: "people have always been failing Q5"). */
  const ASMT_KIND = { quiz: 'Questionnaire', live: 'Live with the AiMY agent' };
  const resultsOf = (a) => DB.sends.filter((s) => s.asmt === a.id && s.status === 'done');
  /* The share of people who got each question right, out of those who took it. */
  function qRates(a) {
    const r = resultsOf(a);
    return a.questions.map((q, i) => { const n = r.filter((s) => s.answers && s.answers[i] != null).length; return n ? Math.round(r.filter((s) => s.answers[i]).length / n * 100) : null; });
  }
  function asmtsPage() {
    const list = DB.asmts;
    return '<div class="s-home">' +
      '<section class="s-block s-block-wide" aria-label="Assessments">' +
        '<div class="s-camp-list-head">' + switcher('asmts') + '<span class="b-draft-acts"><button class="b-ghost" type="button" data-asmt-new>New assessment</button></span></div>' +
        aimyBlock({ text: 'Tests a candidate takes from a link before the phone screen. AiMY scores them; a person decides.', from: 'how assessments work' }, false) +
        '<div class="b-grid">' + list.map((a, i) => {
          const r = resultsOf(a), rates = qRates(a);
          const worst = rates.reduce((w, x, k) => (x != null && (w == null || x < rates[w]) ? k : w), null);
          const avg = r.length ? Math.round(r.reduce((n, s) => n + s.score, 0) / r.length) : null;
          const used = DB.reqs.filter((q) => q.asmt === a.id && isOpen(q)).length;
          return '<div class="b-slot"><article class="type-card s-card b-qcard" data-open="asmt:' + a.id + '" style="--i:' + Math.min(i, 8) + '">' +
            '<div class="tc-head">' + tag(ASMT_KIND[a.kind]) + '<span class="b-kind">' + a.mins + ' minutes</span></div>' +
            '<button class="tc-title s-card-title" type="button" data-asmt="' + a.id + '">' + esc(a.title) + '</button>' +
            '<p class="tc-summary b-qcard-what b-fact">' + svg('goal') + '<span>' + plural(a.questions.length, 'question') + ' · pass mark ' + a.pass + '%</span></p>' +
            '<div class="b-qcard-why"><b>' + r.length + '</b> taken' + (avg != null ? ', average ' + avg + '%' : '') + ' · on ' + plural(used, 'open requisition') + '</div>' +
            (worst != null && rates[worst] < 40 ? aimyBlock({ text: 'Only <b>' + rates[worst] + '%</b> get Q' + (worst + 1) + ' right. Worth rewording.', from: 'every result' }) : '') +
            '<div class="tc-gov b-qcard-foot"><span class="b-kind">' + (a.kind === 'live' ? 'Spoken, then transcribed' : 'Written') + '</span><button class="s-insight-lnk primary" type="button" data-asmt="' + a.id + '">Open it</button></div>' +
          '</article></div>';
        }).join('') + '</div>' +
      '</section></div>';
  }
  function newAsmt(fromReq) {
    const q = fromReq ? DB.reqById[fromReq] : null;
    const a = make('asmts', { id: uid('a'), title: q ? q.title + ' check' : 'New assessment', kind: 'quiz', fam: q ? q.fam : 'support', pass: 70, mins: 15,
      questions: q ? q.must.map((m) => ({ q: 'Give an example from your work of: ' + lower(m) + '.', type: 'open', points: ['a real example', 'what they did themselves', 'the result'], fails: 0 })) : [] });
    EDIT = null;
    go({ asmt: a.id, edit: '1' });
    if (q) toast('AiMY drafted ' + plural(a.questions.length, 'question') + ' from the success profile', () => { unmake('asmts', a); go({ on: 'asmts' }, true); }, 'One per must-have. Change any of them.');
  }
  function asmtPage() {
    const a = asmtOf(S.asmt);
    const edit = !!S.edit && (isRec() || isHR());
    const r = resultsOf(a), rates = qRates(a);
    const worst = rates.reduce((w, x, k) => (x != null && (w == null || x < rates[w]) ? k : w), null);
    const outs = qOutcomes(a);
    const link = 'talent.flairstech.com/test/' + a.id;
    return '<div class="s-home">' +
      '<div class="b-topbar s-block-wide"><button class="s-back" type="button"' + goAttr({ on: 'asmts' }) + '>' + svg('back', 14) + 'Back to Assessments</button>' +
        (isRec() || isHR() ? '<span class="b-draft-acts">' + (edit ? '<button class="btn btn-brand btn-sm" type="button"' + goAttr({ asmt: a.id }) + '>Done</button>'
          : '<button class="b-ghost" type="button"' + goAttr({ asmt: a.id, edit: '1' }) + '>Edit</button>') + '</span>' : '') + '</div>' +
      '<section class="s-rec-head s-block-wide">' +
        '<span class="s-rec-kind b-kinds">' + fact('goal', 'Assessment') + fact('clock', a.mins + ' minutes') + fact('req', ASMT_KIND[a.kind]) + '</span>' +
        (edit ? '<input class="b-draft-name" type="text" data-aed="title" value="' + esc(a.title) + '" aria-label="Title">' : '<div class="s-rec-title"><h1 class="s-rec-name">' + esc(a.title) + '</h1></div>') +
        '<div class="b-cmeta">' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">How it is taken</h2><div class="b-cmeta-say">' + (edit
            ? Object.keys(ASMT_KIND).map((k) => '<button class="filter-chip' + (a.kind === k ? ' active' : '') + '" type="button" data-aset="kind|' + k + '">' + ASMT_KIND[k] + '</button>').join('')
            : '<p class="b-cmeta-p">' + esc(ASMT_KIND[a.kind]) + '</p>') + '</div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Pass mark</h2><div class="b-cmeta-say">' + (edit
            ? '<span class="t-step"><button class="b-ghost" type="button" data-aset="pass|-5" aria-label="Lower">−</button><b class="t-step-n">' + a.pass + '%</b><button class="b-ghost" type="button" data-aset="pass|5" aria-label="Higher">+</button></span>'
            : '<p class="b-cmeta-p"><b>' + a.pass + '%</b></p>') + '</div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Link to share</h2><div class="b-cmeta-say"><p class="b-cmeta-p"><b class="t-link-text">' + esc(link) + '</b></p>' +
            '<p class="b-cmeta-p t-acts"><button class="s-insight-lnk" type="button" data-copy="https://' + esc(link) + '">Copy the link</button></p></div></div>' +
        '</div>' +
      '</section>' +
      (r.length && !edit ? itemInsights(a, rates, outs, worst, link) : '') +
      '<section class="s-block s-block-wide" aria-label="Questions">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Questions</h2><span class="s-block-say">' + plural(a.questions.length, 'question') + (r.length ? ' · share who got each right' : '') + '</span></div>' +
        (a.questions.length ? '<div class="t-asq">' + a.questions.map((qq, i) => '<div class="t-asq-row">' +
          '<span class="t-asq-n">Q' + (i + 1) + '</span>' +
          '<div class="t-asq-main">' + (edit
            ? '<textarea class="b-draft-in b-draft-area t-area" rows="2" data-qed="' + i + '|q" aria-label="Question ' + (i + 1) + '">' + esc(qq.q) + '</textarea>' +
              '<div class="b-cuts">' + [['choice', 'One right answer'], ['open', 'Open answer, scored by AiMY']].map((x) => '<button class="filter-chip' + (qq.type === x[0] ? ' active' : '') + '" type="button" data-qtype="' + i + '|' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
              (qq.type === 'choice' ? (qq.options || []).map((o, k) => '<p class="t-q"><button class="t-check' + (qq.right === k ? ' is-on' : '') + '" type="button" data-qright="' + i + '|' + k + '" aria-pressed="' + (qq.right === k) + '" aria-label="Mark as the right answer">' + (qq.right === k ? svg('check', 12) : '') + '</button>' +
                '<input class="b-draft-in" type="text" data-qopt="' + i + '|' + k + '" value="' + esc(o) + '" aria-label="Option ' + (k + 1) + '"></p>').join('')
                : '<input class="b-draft-in" type="text" data-qpts="' + i + '" value="' + esc((qq.points || []).join(', ')) + '" aria-label="What a good answer covers">') +
              '<p class="t-acts"><button class="b-ghost" type="button" data-q-del="' + a.id + '|' + i + '">Remove</button></p>'
            : '<p class="t-asq-q">' + esc(qq.q) + '</p>' +
              (qq.type === 'choice' ? '<p class="b-vfoot">Right answer: ' + esc(qq.options[qq.right]) + '</p>' : '<p class="b-vfoot">A good answer covers: ' + esc((qq.points || []).join('; ')) + '</p>') +
              verHist(qq) + outcomeLink(outs[i])) +
          '</div>' +
          (rates[i] != null && !edit ? '<span class="t-asq-rate' + (rates[i] < 40 ? ' is-low' : '') + '"><b>' + rates[i] + '%</b> right</span>' : '') +
        '</div>').join('') + '</div>' : '<p class="s-none">No questions yet.</p>') +
        (a.dropped && a.dropped.length && !edit ? '<p class="b-vfoot">' + a.dropped.map((x) => 'Dropped by ' + esc(DESKS[x.by] ? DESKS[x.by].name : 'the HR Manager') + ' ' + esc(sayWhen(x.day)) + ': “' + esc(x.q) + '”').join(' · ') + '</p>' : '') +
        (edit ? '<p class="t-acts"><button class="s-insight-lnk" type="button" data-q-add="' + a.id + '">Add a question</button></p>' : '') +
      '</section>' +
      (r.length && !edit ? '<section class="s-block s-block-wide" aria-label="Results"><div class="s-camp-list-head"><h2 class="s-block-h">Results</h2><span class="s-block-say">' + r.length + ', newest first</span></div>' +
        '<div class="b-log">' + r.slice().sort((x, y) => (y.doneDay || 0) - (x.doneDay || 0)).slice(0, 20).map((s, i) => { const c = DB.byId[s.cand];
          return c ? logRow({ tone: '', ico: svg('goal'), who: c.name, meta: logMeta([s.score + '%', s.score >= a.pass ? 'a pass' : 'under the pass mark', reqOf(c).title, sayWhen(s.doneDay != null ? s.doneDay : s.day)]),
            act: 'data-cand="' + c.id + '"', go: 'Open' }, i) : ''; }).join('') + '</div></section>' : '') +
    '</div>';
  }
  /* ── 8. ITEM INSIGHTS (assessment-item-insights) ── each question's pass
     rate against what happened next, and the question to fix as a learning
     proposal an HR Manager approves. Nothing is named below the sample. */
  function itemInsights(a, rates, outs, worst, link) {
    const r = resultsOf(a);
    const first0 = r.reduce((d, s) => Math.min(d, s.doneDay != null ? s.doneDay : s.day), 0);
    const verdict = (o) => {
      if (!o || o.n < GATE) return rcChip('Too few results yet', 'dash');
      const pr = o.right ? o.rightMet / o.right : 0, pw = o.wrong ? o.wrongMet / o.wrong : 0;
      if (o.right < 5 || o.wrong < 5) return rcChip('Too few missed it to compare', 'dash');
      return pr - pw >= 0.2 ? rcChip('Predicts client acceptance', 'ok') : pw - pr >= 0.2 ? rcChip('Points the wrong way', 'err') : rcChip('Predicts nothing we measure', 'err');
    };
    const p = worst != null && rates[worst] < 40 ? qProposals(a.id)[0] : null;
    const sentN = Math.max.apply(null, outs.map((o) => o.n).concat([0]));
    const acts = p ? (isHR() ? rcBtn('Approve the rewording', 'data-prop="' + esc(p.key) + '|approve"', 'psmall') + rcBtn('Drop Q' + (p.i + 1) + ' instead', 'data-prop="' + esc(p.key) + '|drop"', 'small')
        : p.rec && p.rec.state === 'waiting' ? '<span class="sub">Waiting on ' + esc(DESKS.dina.name) + '</span>'
        : rcBtn('Review proposal', 'data-prop="' + esc(p.key) + '|send"', 'psmall')) + rcBtn('Keep Q' + (p.i + 1), 'data-prop="' + esc(p.key) + '|later"', 'small') : '';
    return rcard({ cap: 'Assessments · item insights', ico: 'clip', label: 'Item insights',
      body: rcHead(esc(a.title), plural(r.length, 'taken', 'taken') + ' since ' + esc(sayDay(first0)) + ' · linked to what happened next',
          '<button class="chip" type="button" data-copy="https://' + esc(link) + '">' + svg('link', 12) + ' Shared by link</button>') +
        '<table style="margin-top:14px"><tr><th>Question</th><th>Pass rate</th><th>Against later outcomes</th></tr>' +
          a.questions.map((qq, i) => '<tr><td><b>Q' + (i + 1) + '</b> · ' + esc(qq.q.length > 46 ? qq.q.slice(0, 45) + '…' : qq.q) + '</td>' +
            '<td><b>' + (rates[i] != null ? rates[i] + '%' : '·') + '</b><div class="bar"><i style="width:' + (rates[i] || 0) + '%;background:var(' + (rates[i] != null && rates[i] < 40 ? '--err' : '--brand') + ')"></i></div></td>' +
            '<td>' + verdict(outs[i]) + '</td></tr>').join('') +
        '</table>' +
        (sentN < GATE ? gate(sentN, GATE, 'people sent to a client after taking it', 'Below ' + GATE + ', no question is said to predict anything.') : '') +
        (p ? rcAimy((100 - rates[worst]) + '% get Q' + (worst + 1) + ' wrong. When nearly everyone misses one question, the question is usually the problem. Reword it: “' + esc(p.to) + '”?',
          'Learning Proposal · from ' + plural(r.length, 'result') + ' and ' + plural(sentN, 'client decision') + ' · an HR Manager approves', acts) : '') });
  }
  function asmtSet(a, fields, say) {
    const before = JSON.parse(JSON.stringify({ title: a.title, kind: a.kind, pass: a.pass, questions: a.questions }));
    put('asmts', a, fields);
    paint();
    if (say) toast(say, () => { put('asmts', a, before); paint(); });
  }

  /* The candidate's side: the test, from its link. */
  let TAKE = null;
  function portalTake() {
    const s = DB.sends.filter((x) => x.id === S.take)[0];
    if (!s) return '<div class="t-out">' + outsideHead('Assessment', 'FlairsTech careers') + '<p class="s-none">This link has expired.</p></div>';
    const a = asmtOf(s.asmt), c = DB.byId[s.cand];
    if (s.status === 'done') return '<div class="t-out">' + outsideHead('Assessment', 'FlairsTech careers') + '<section class="t-out-card t-done">' + successCheck() +
      '<h1 class="t-out-h">Thank you, ' + esc(first(c.name)) + '. It is in.</h1><p>The recruiting team will be in touch about next steps. We do not share scores; a person reads every result.</p></section></div>';
    if (!TAKE || TAKE.id !== s.id) TAKE = { id: s.id, a: [] };
    if (a.kind === 'live') return liveTake(s, a, c);
    return '<div class="t-out">' + outsideHead('Assessment', 'FlairsTech careers') +
      '<section class="t-out-card">' +
        '<p class="t-out-kicker">' + esc(ASMT_KIND[a.kind]) + ' · about ' + a.mins + ' minutes</p>' +
        '<h1 class="t-out-h">' + esc(a.title) + '</h1>' +
        '<p>For ' + esc(reqOf(c).title) + '. ' + (a.kind === 'live' ? 'AiMY asks each question; answer in your own words, out loud or typed.' : 'Answer every question. There is no trick to it.') + '</p>' +
        '<div class="t-input-wrap" id="wrapTake"><div class="t-input">' + a.questions.map((qq, i) => '<div class="t-dr">' +
          '<p class="t-dr-must">' + (a.kind === 'live' ? mark(12) + ' ' : '') + 'Q' + (i + 1) + '. ' + esc(qq.q) + '</p>' +
          /* The options are written right answer first; the person taking
             it sees them turned, a different turn per question. */
          (qq.type === 'choice' ? '<div class="b-cuts t-col">' + qq.options.map((o, k, all) => { const j = (k + i * 3 + 1) % all.length; return '<button class="filter-chip' + (TAKE.a[i] === j ? ' active' : '') + '" type="button" data-ans="' + i + '|' + j + '">' + esc(all[j]) + '</button>'; }).join('') + '</div>'
            : '<textarea class="dial-input t-area" rows="3" data-anstext="' + i + '" aria-label="Your answer">' + esc(TAKE.a[i] || '') + '</textarea>') +
        '</div>').join('') + '</div><p class="t-error-msg">Answer every question first.</p></div>' +
        '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-take-submit>Send my answers</button></p>' +
      '</section></div>';
  }
  /* ══ LIVE WITH THE AIMY AGENT ══════════════════════════════════════════
     The same questions as a short conversation: AiMY asks one at a time,
     reads the answer, and asks once for more when an open answer is too
     thin to score, the way an interviewer would. Scoring is the
     questionnaire's (takeSubmit), so a live result reads like any other. */
  const LIVE_ACK = ['Thank you.', 'Got it, thank you.', 'Clear. Next one.', 'Thank you, that helps.'];
  function liveTake(s, a, c) {
    const L = TAKE.live || (TAKE.live = { said: {}, probed: {}, done: {} });
    const said = [];
    const ai = (t) => said.push('<div class="t-chat-ai">' + mark(14) + '<p>' + t + '</p></div>');
    const you = (t) => said.push('<div class="t-chat-you"><p>' + esc(t) + '</p></div>');
    ai('Hi ' + esc(first(c.name)) + '. I will ask ' + plural(a.questions.length, 'question') + ', one at a time, for ' + esc(reqOf(c).title) +
      '. Answer in your own words, typed or spoken. If an answer is short I may ask for a little more; that is normal.');
    let at = -1;
    a.questions.forEach((qq, i) => {
      if (at >= 0) return;
      ai('<b>' + (i + 1) + ' of ' + a.questions.length + '.</b> ' + esc(qq.q));
      const got = L.said[i] || [];
      if (got[0] != null) you(got[0]);
      if (L.probed[i]) { ai('Can you say a little more? One example from your own work is enough.'); if (got[1] != null) you(got[1]); }
      if (L.done[i]) { if (i < a.questions.length - 1) ai(LIVE_ACK[i % LIVE_ACK.length]); } else at = i;
    });
    let input;
    if (at < 0) {
      ai('That is every question. Send your answers when you are ready; a person reads every result.');
      input = '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-take-submit>Send my answers</button></p>';
    } else if (a.questions[at].type === 'choice') {
      const qq = a.questions[at];
      input = '<div class="b-cuts t-col">' + qq.options.map((o, k, all) => { const j = (k + at * 3 + 1) % all.length;
        return '<button class="filter-chip" type="button" data-live-pick="' + at + '|' + j + '">' + esc(all[j]) + '</button>'; }).join('') + '</div>';
    } else {
      input = '<div class="t-input-wrap" id="wrapLive"><textarea class="dial-input t-area t-input" id="liveIn" rows="3" aria-label="Your answer" placeholder="Type your answer. Enter sends it."></textarea>' +
        '<p class="t-error-msg">Type an answer first.</p></div>' +
        '<p class="t-acts"><button class="btn btn-ghost btn-sm t-live-mic" type="button" data-live-mic aria-pressed="false">' + svg('mic', 14) + '<span>Say it</span></button>' +
          '<button class="btn btn-brand btn-sm" type="button" data-live-send>Send</button></p>';
    }
    return '<div class="t-out">' + outsideHead('Assessment', 'FlairsTech careers') +
      '<section class="t-out-card">' +
        '<p class="t-out-kicker">' + esc(ASMT_KIND[a.kind]) + ' · about ' + a.mins + ' minutes</p>' +
        '<h1 class="t-out-h">' + esc(a.title) + '</h1></section>' +
      '<section class="t-out-card t-chat" aria-label="Assessment with AiMY">' + said.join('') + input + '</section></div>';
  }
  function liveAt() {
    const a = asmtOf(DB.sends.filter((x) => x.id === TAKE.id)[0].asmt);
    return { a: a, i: a.questions.findIndex((qq, i) => !TAKE.live.done[i]) };
  }
  /* Dictation into the answer, with the browser's own recognition. Where it
     is missing or the microphone is refused, it says so in words; it never
     writes a sentence nobody said. */
  let DICT = null;
  function liveMic() {
    if (DICT) { DICT.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('This browser cannot take dictation', null, 'Type your answer instead. Chrome, Edge and Safari can listen.'); return; }
    const box = byId('liveIn'), btn = document.querySelector('[data-live-mic]');
    const p = liveAt();
    const base = box.value.trim() ? box.value.trim() + ' ' : '';
    const rec = new SR();
    rec.lang = /german/i.test(p.a.title) ? 'de-DE' : 'en-GB';
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; box.value = base + t.trim(); };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('The microphone was refused', null, 'Allow it in the browser to speak your answers, or type them.');
    };
    rec.onend = () => {
      DICT = null;
      const b = document.querySelector('[data-live-mic]');
      if (b) { b.classList.remove('is-rec'); b.setAttribute('aria-pressed', 'false'); b.lastChild.textContent = 'Say it'; }
    };
    try { rec.start(); } catch (err) { toast('The microphone could not start', null, 'Type your answer instead.'); return; }
    DICT = rec;
    btn.classList.add('is-rec'); btn.setAttribute('aria-pressed', 'true'); btn.lastChild.textContent = 'Listening. Press to stop';
  }
  function liveSend() {
    if (DICT) { DICT.onresult = null; DICT.stop(); }
    const box = byId('liveIn');
    const v = box ? box.value.trim() : '';
    if (!v) { shake('wrapLive'); return; }
    const p = liveAt(), L = TAKE.live, i = p.i;
    (L.said[i] = L.said[i] || []).push(v);
    const all = L.said[i].join(' ');
    if (all.split(/\s+/).length < 8 && !L.probed[i]) L.probed[i] = true;
    else { L.done[i] = true; TAKE.a[i] = all; }
    paint();
    const next = byId('liveIn'); if (next) next.focus();
  }
  function livePick(i, j) {
    const p = liveAt(), qq = p.a.questions[i];
    TAKE.live.said[i] = [qq.options[j]];
    TAKE.live.done[i] = true;
    TAKE.a[i] = j;
    paint();
  }
  function takeSubmit() {
    const s = DB.sends.filter((x) => x.id === TAKE.id)[0];
    const a = asmtOf(s.asmt), c = DB.byId[s.cand];
    if (a.questions.some((qq, i) => TAKE.a[i] == null || TAKE.a[i] === '')) { shake('wrapTake'); return; }
    /* A choice is right or wrong; an open answer is scored against what a
       good answer covers (fixture: enough said, in enough words). */
    const answers = a.questions.map((qq, i) => qq.type === 'choice' ? TAKE.a[i] === qq.right : String(TAKE.a[i]).trim().split(/\s+/).length >= 8);
    const score = Math.round(answers.filter(Boolean).length / answers.length * 100);
    put('sends', s, { status: 'done', answers: answers, score: score, doneDay: 0, probed: TAKE.live ? Object.keys(TAKE.live.probed).map(Number) : null });
    note(c, 'asmt', 'Finished the ' + a.title + ' assessment: ' + score + '%.');
    TAKE = null;
    paint();
  }

  /* ══ TEMPLATES ═══════════════════════════════════════════════════════════
     The HR Manager sets the stages each kind of requisition runs, and the
     agenda each kind of interview follows (New Operations list). Stages are
     switched on or off in their fixed order, one press each; nothing is
     dragged. A stage with people on it cannot be switched off. */
  /* ── 7. A STAGE TEMPLATE (pipeline-stage-template) ── each account names
     its own stages, and each stage maps to one of six groups, so the funnel
     compares across clients. Edit opens the stage switches in place. */
  const STAGE_GROUP = { sourced: 'Screen', applied: 'Screen', phone: 'Screen', assess: 'Assess', hr: 'Interview', tech: 'Interview', mgr: 'Interview',
    sent: 'Client', client: 'Client', ctech: 'Client', offer: 'Offer', accepted: 'Offer', joined: 'Hired' };
  let TPL_EDIT = {};
  function templatesPage() {
    const busy = (k, s) => DB.reqs.some((q) => q.tpl === k && isOpen(q) && DB.byReq[q.id].some((c) => !c.exit && c.stage === s));
    const only = (k, s) => Object.keys(TEMPLATE).filter((x) => TEMPLATE[x].indexOf(s) >= 0).length === 1;
    return '<div class="s-home">' +
      '<section class="s-block s-block-wide" aria-label="Stage templates">' +
        '<div class="s-camp-list-head">' + switcher('templates') + '</div>' +
      '</section>' +
      rcard({ cap: 'Positions and pipeline', ico: 'branch', label: 'Stage templates', cards: Object.keys(TEMPLATE).map((k) => {
        const name = TEMPLATE_NAME[k] || k, accs = ACCOUNTS.filter((a) => a.tpl === k);
        const used = DB.reqs.filter((q) => q.tpl === k && isOpen(q)).length;
        return '<div class="card">' + rcHead('Stage template · ' + esc(name), 'Set by the HR Manager · used by ' + plural(used, 'open requisition') + (accs.length ? ' · ' + esc(accs.map((a) => a.name).join(', ')) : ''),
            rcBtn(TPL_EDIT[k] ? 'Done' : 'Edit', 'data-tpl-edit="' + k + '"', TPL_EDIT[k] ? 'psmall' : 'small', TPL_EDIT[k] ? 'check' : 'pen')) +
          (TPL_EDIT[k] ? '<div class="reasons" style="margin-top:12px">' + STAGE_ORDER.map((s) => {
            const on = TEMPLATE[k].indexOf(s) >= 0, locked = STAGE_FIXED[s];
            return (on ? '<button class="chip ok" type="button"' : '<button class="chip" type="button"') + (locked ? ' disabled title="Every pipeline needs this stage"' : ' data-tpl-toggle="' + k + '|' + s + '"') +
              ' aria-pressed="' + on + '">' + (on ? svg('check', 12) + ' ' : '') + esc(STAGE[s].label) + (busy(k, s) && on ? ' · in use' : '') + '</button>';
          }).join('') + '</div>' : '') +
          '<div class="row between" style="margin:16px 0 8px">' + rcCaps(name + '’s stages') + '<span class="sub caps" style="width:150px;text-align:center">One internal funnel</span></div>' +
          '<div class="map">' + TEMPLATE[k].map((s) => '<div class="st">' + esc(STAGE[s].label) + (only(k, s) ? '<small>' + esc(name) + ' only</small>' : '') + '</div>' +
            '<div class="arr">' + svg('arrow', 14) + '</div><div class="' + RC_GRP[STAGE_GROUP[s]] + '">' + STAGE_GROUP[s] + '</div>').join('') + '</div>' +
          rcNote('info', 'Each client names its own stages. Every stage maps to one of six groups, so the funnel compares across clients. Exits (withdrew, client declined) are reasons, not stages.') +
        '</div>';
      }) }) +
      '<section class="s-block s-block-wide" aria-label="Interview templates">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Interview templates</h2><span class="s-block-say">the agenda each interviewer follows · AiMY adds what the CV is silent on</span></div>' +
        DB.ivtpls.map((t) => '<div class="t-tpl"><h3 class="b-month">' + esc(t.title) + '</h3>' +
          t.items.map((x, i) => '<p class="t-q"><span class="t-asq-n">' + (i + 1) + '</span><input class="b-draft-in t-grow" type="text" data-tpled="' + t.id + '|' + i + '" value="' + esc(x) + '" aria-label="Agenda item ' + (i + 1) + '">' +
            '<button class="b-ghost" type="button" data-tpl-del="' + t.id + '|' + i + '" aria-label="Remove">Remove</button></p>').join('') +
          '<p class="t-acts"><button class="s-insight-lnk" type="button" data-tpl-add="' + t.id + '">Add an item</button></p></div>').join('') +
      '</section>' +
      (isHR() ? ladder() : '') +
    '</div>';
  }
  function toggleStage(k, s) {
    const on = TEMPLATE[k].indexOf(s) >= 0;
    if (on && DB.reqs.some((q) => q.tpl === k && isOpen(q) && DB.byReq[q.id].some((c) => !c.exit && c.stage === s))) {
      toast('Somebody is ' + atStage(s) + ' on an open requisition', null, 'Move them on first, then switch the stage off.');
      return;
    }
    const before = TEMPLATE[k].slice();
    TEMPLATE[k] = STAGE_ORDER.filter((x) => (x === s ? !on : TEMPLATE[k].indexOf(x) >= 0));
    D.tpl[k] = TEMPLATE[k].slice();
    save();
    paint();
    toast((on ? 'Switched off: ' : 'Added: ') + STAGE[s].label, () => { TEMPLATE[k] = before; D.tpl[k] = before.slice(); save(); paint(); }, 'For ' + (TEMPLATE_NAME[k] || k) + '.');
  }

  /* ══ REPORTS ═════════════════════════════════════════════════════════════
     Every number the Recruitment dashboard shows today, with one definition
     each, so moving off it loses nothing (audit, "insights"). Scoped to the
     desk: a recruiter sees their own, a hiring manager theirs, the HR
     Manager everyone's. */

  /* THE VIEW A REPORT READS: a period and an account, kept in the link so a
     view can be sent. The period picks requisitions BY THE DAY THEY OPENED,
     one rule for the whole page, so every tile and chart below counts the
     same set and none can disagree with another. */
  const PERIODS = [[30, 'Last 30 days'], [60, 'Last 60 days'], [90, 'Last 90 days']];
  const perOf = () => (S.period === '30' || S.period === '60' ? Number(S.period) : 90);
  const openedIn = (q, lo, hi) => -q.opened >= lo && -q.opened < hi;
  /* A span with fewer than this many to count from shows no figure: a rate
     off two people is not a trend. */
  const TREND_MIN = 3;
  const rate = (a, b, min) => (b && b >= (min || 1) ? Math.round(a / b * 100) : null);

  /* Every figure the page shows, for one set of requisitions. Worked out
     once per set, so the tile, its trend and its target read one number. */
  function rstats(reqs) {
    const cands = reqs.reduce((l, q) => l.concat(DB.byReq[q.id]), []);
    const reached = (k) => cands.filter((c) => { const q = reqOf(c); return rank(q, k) >= 0 && rank(q, c.maxAt) >= rank(q, k); }).length;
    const n = (k) => reqs.filter((q) => q.state === k).length;
    const offers = DB.offers.filter((o) => DB.byId[o.cand] && reqs.indexOf(reqOf(DB.byId[o.cand])) >= 0);
    const hiredO = offers.filter((o) => o.status === 'accepted' || o.status === 'joined');
    const avg = (l, f) => (l.length ? Math.round(l.reduce((s, x) => s + f(x), 0) / l.length) : null);
    const hires = cands.filter((c) => { const q = reqOf(c); return rank(q, c.maxAt) >= rank(q, 'accepted'); });
    const notStarted = cands.filter((c) => !c.exit && c.stage === 'accepted');
    return {
      reqs: reqs, cands: cands, reached: reached, n: n, offers: offers, hiredO: hiredO,
      open: reqs.filter(isOpen).length,
      seats: reqs.reduce((s, q) => s + q.seats, 0),
      hiredSeats: reqs.filter((q) => q.state === 'filled' || q.state === 'started').reduce((s, q) => s + q.seats, 0),
      openSeats: reqs.filter(isOpen).reduce((s, q) => s + q.seats, 0),
      sendAvg: avgSent(reqs), sentN0: reqs.map(sentDays).filter((x) => x != null).length,
      toHire: avg(hiredO, (o) => o.sentDay - reqOf(DB.byId[o.cand]).opened),
      toJoin: avg(hiredO, (o) => o.joinDay - reqOf(DB.byId[o.cand]).opened),
      phones: reached('hr') + cands.filter((c) => c.stage === 'phone' && c.exit).length,
      /* Profiles per hire only where a profile goes to a client at all. */
      hiresSent: hires.filter((c) => rank(reqOf(c), 'sent') >= 0).length,
      made: offers.filter((o) => o.sentDay != null).length,
      declined: offers.filter((o) => o.status === 'declined').length,
      notStarted: notStarted,
      billed: hires.filter((c) => !c.exit && reqOf(c).billable).length,
    };
  }

  /* A trend is three spans of 30 days, oldest first, drawn as a line and
     said as numbers, so the line is never the only way to read it. */
  function spark(vals) {
    const pts = vals.map((v, i) => (v == null ? null : [6 + i * 26, v]));
    const ok = pts.filter(Boolean);
    if (ok.length < 2) return '';
    const lo = Math.min.apply(null, ok.map((p) => p[1])), hi = Math.max.apply(null, ok.map((p) => p[1]));
    const y = (v) => (hi === lo ? 10 : 16 - (v - lo) / (hi - lo) * 12).toFixed(1);
    let d = '';
    pts.forEach((p, i) => { if (p) d += (i && pts[i - 1] ? 'L' : 'M') + p[0] + ' ' + y(p[1]); });
    const end = ok[ok.length - 1];
    return '<svg class="t-spark" viewBox="0 0 64 20" width="64" height="20" aria-hidden="true"><path d="' + d + '"/><circle cx="' + end[0] + '" cy="' + y(end[1]) + '" r="2.5"/></svg>';
  }
  /* A target said with how far off it is, in the tile's own unit. */
  function tgtSay(t, v, lead) {
    const pc = t.unit === '%';
    const unit = pc ? '%' : t.unit ? ' ' + t.unit : '';
    const head = 'Target ' + t.v + unit + (t.dir === 'le' ? (pc ? ' or less' : ' or fewer') : ' or more');
    if (v == null) return '<span class="t-kpi-tgt">' + esc((lead || '') + head) + '</span>';
    const met = t.dir === 'le' ? v <= t.v : v >= t.v;
    const gap = Math.round(Math.abs(v - t.v) * 10) / 10;
    const off = (pc ? plural(gap, 'point') : t.unit === 'days' ? days(gap) : String(gap)) + (t.dir === 'le' ? ' over' : ' short');
    return '<span class="t-kpi-tgt ' + (met ? 'is-ok' : 'is-warn') + '">' + esc((lead || '') + head + ' · ' + (met ? 'met' : off)) + '</span>';
  }

  function reportsPage() {
    const per = perOf();
    const pool = deskReqs().filter((q) => q.state !== 'draft');
    const accs = ACCOUNTS.filter((a) => pool.some((q) => q.acc === a.id));
    const accIn = accs.filter((a) => a.id === S.account)[0] || null;
    const inAcc = pool.filter((q) => !accIn || q.acc === accIn.id);
    const reqs = inAcc.filter((q) => openedIn(q, 0, per));
    const st = rstats(reqs);
    /* The three spans the trend reads, on the same account, whatever the period. */
    const WS = [[60, 90], [30, 60], [0, 30]].map((w) => rstats(inAcc.filter((q) => openedIn(q, w[0], w[1]))));
    const reached = st.reached;
    const offers = st.offers, hiredO = st.hiredO, hiredSeats = st.hiredSeats;
    const sendAvg = st.sendAvg, phones = st.phones;
    const num = (x) => (x == null ? '·' : String(x));
    const pcS = (x) => (x == null ? '·' : x + '%');
    const TARGET_BY = 'Set by ' + DESKS.dina.name + ', the HR Manager. A sample until the team sets its own.';
    const TREND_DEF = ['Trend', 'Three spans of 30 days, oldest first, by the day each requisition opened. A span with fewer than ' + TREND_MIN + ' to count from shows ·. The latest span is still running, so its days and rates can move.'];
    /* Day 90 is read for the hires whose day 90 has passed, which are older
       than any period here, so the period cannot apply to them; the account
       does. */
    const past = DB.past.filter((p) => p.billable && (accIn ? p.acc === accIn.id : accs.some((a) => a.id === p.acc)));
    const stayed = past.filter((p) => p.stayed).length;
    /* ONE DEFINITION PER FIGURE (R6, the metric dictionary): each tile says
       its unit, where it starts and stops, and how many it rests on, behind
       How it is counted. Days to send profiles and Days to hire are averaged
       over different sets (requisitions that sent a profile, people with an
       accepted offer), so one can read lower than the other; the tile says so
       rather than leaving it to look like a mistake.
       A TARGET ON EACH, WHERE ONE IS OURS TO HIT (R6: a number with no target
       and no trend cannot say whether it is good). How many requisitions come
       in, or how many a client cancels, is not, so those say why they have none. */
    const tiles = [
      { cap: 'Requisitions', v: (s) => s.reqs.length, show: num,
        say: (s) => s.open + ' open, ' + (s.n('filled') + s.n('started')) + ' filled, ' + (s.n('cclient') + s.n('cmgr')) + ' cancelled',
        def: () => [['Unit', 'Requisition'], ['Counts', 'Every requisition opened in the period. Drafts are left out.'], ['Not to mix', 'Seats: one requisition can hold several.'], ['Target', 'None. How many come in is the clients’ to decide.']] },
      { cap: 'Seats', v: (s) => s.seats, show: num,
        say: (s) => s.hiredSeats + ' hired, ' + s.openSeats + ' still open',
        def: () => [['Unit', 'Seat, one vacancy'], ['Hired at', 'Its requisition is filled or its people have started'], ['Not to mix', 'People hired: an offer accepted counts a person, not a seat.'], ['Target', 'None, as for requisitions.']] },
      { cap: 'Days to send profiles', v: (s) => s.sendAvg, base: (s) => s.sentN0, show: num, tgt: { v: 7, dir: 'le', unit: 'days' },
        say: (s) => 'from opening to the first profile sent, on average · ' + plural(s.sentN0, 'requisition'),
        def: (s) => [['Unit', 'Requisition'], ['Starts', 'The requisition opens'], ['Stops', 'Its first profile is sent to the client'], ['Counts', plural(s.sentN0, 'requisition') + ' that have sent one. The rest are still waiting and are left out.']] },
      { cap: 'Days to hire', v: (s) => s.toHire, base: (s) => s.hiredO.length, show: num, tgt: { v: 30, dir: 'le', unit: 'days' },
        say: (s) => 'from opening to the offer, on average · ' + plural(s.hiredO.length, 'person', 'people'),
        def: (s) => [['Unit', 'Person'], ['Starts', 'Their requisition opens'], ['Stops', 'The offer is sent'], ['Counts', plural(s.hiredO.length, 'person', 'people') + ' with an accepted offer. Fewer than the requisitions above, so the two are not one timeline.']] },
      { cap: 'Days to join', v: (s) => s.toJoin, base: (s) => s.hiredO.length, show: num, tgt: { v: 60, dir: 'le', unit: 'days' },
        say: (s) => 'from opening to day one, on average · ' + plural(s.hiredO.length, 'person', 'people'),
        def: () => [['Unit', 'Person'], ['Starts', 'Their requisition opens'], ['Stops', 'Their first day at work'], ['Counts', 'People with an accepted offer; a date not reached yet is the agreed start date.'], ['Why 60', 'Most notice periods here are one or two months.']] },
      { cap: 'HR after the phone screen', v: (s, m) => rate(s.reached('hr'), s.phones, m), show: pcS, tgt: { v: 70, dir: 'ge', unit: '%' },
        say: (s) => 'of people who passed the call went on to HR · ' + plural(s.phones, 'person', 'people'),
        def: (s) => [['Unit', 'Person'], ['Of', plural(s.phones, 'person', 'people') + ' who finished a phone screen: went on to HR, or left at it'], ['Counts', 'Those who reached the HR interview']] },
      { cap: 'Technical after HR', v: (s, m) => rate(s.reached('tech'), s.reached('hr'), m), show: pcS, tgt: { v: 55, dir: 'ge', unit: '%' },
        say: (s) => 'of people past HR reached the technical round · ' + plural(s.reached('hr'), 'person', 'people'),
        def: (s) => [['Unit', 'Person'], ['Of', plural(s.reached('hr'), 'person', 'people') + ' who reached the HR interview'], ['Counts', 'Those who reached the technical interview']] },
      { cap: 'Client interview per profile sent', v: (s, m) => rate(s.reached('client'), s.reached('sent'), m), show: pcS, tgt: { v: 25, dir: 'ge', unit: '%' },
        say: (s) => 'of profiles sent got a client interview · ' + plural(s.reached('sent'), 'profile'),
        def: (s) => [['Unit', 'Person'], ['Of', plural(s.reached('sent'), 'profile') + ' sent to a client'], ['Counts', 'Those the client agreed to meet'], ['Norm', 'About 3 to 5 profiles per client interview is usual for agencies; a weak benchmark. 25% is one in four.']] },
    ];
    /* THE STAFFING NUMBERS (R2, R6) the dashboard does not show: what it
       takes to make a hire, the hires lost after the count, and the client's
       side. Billed hires are never shown alone, always beside who stayed to
       day 90 (M10), as they are on the client's own page. */
    const staffing = [
      { cap: 'Profiles sent per hire', v: (s, m) => (s.hiresSent && s.hiresSent >= (m || 1) ? Math.round(s.reached('sent') / s.hiresSent * 10) / 10 : null), show: num, tgt: { v: 6, dir: 'le', unit: '' },
        say: (s) => s.reached('sent') + ' profiles sent for ' + plural(s.hiresSent, 'hire'),
        def: () => [['Unit', 'Profile, per person hired'], ['Of', 'People with an accepted offer, on requisitions that send profiles to a client'], ['Counts', 'Every profile sent on those requisitions, hired or not'], ['Why 6', 'About 3 to 5 profiles per client interview, and most client interviews end in a hire.']] },
      { cap: 'Offers declined', v: (s, m) => rate(s.declined, s.made, m), show: pcS, tgt: { v: 15, dir: 'le', unit: '%' },
        say: (s) => s.declined + ' of ' + plural(s.made, 'offer') + ' made were turned down',
        def: () => [['Unit', 'Offer'], ['Of', 'Offers sent to the candidate. Ones still being approved are left out.'], ['Counts', 'Offers the candidate turned down'], ['Read with', 'Their reasons, on each candidate. A counter-offer is the usual one.']] },
      { cap: 'Hired, not started', v: (s) => s.notStarted.length, show: num,
        say: (s) => { const j = s.notStarted.map((c) => (DB.offers.filter((o) => o.cand === c.id)[0] || {}).joinDay).filter((d) => d != null && d >= 0).sort((a, b) => a - b);
          return s.notStarted.length ? 'accepted, day one still ahead' + (j.length ? ' · the next joins ' + sayDay(j[0]) : '') : 'nobody waiting to start'; },
        def: () => [['Unit', 'Person'], ['Counts', 'People who accepted an offer and have not had their first day'], ['Not to mix', 'Hired already counts them. Anyone who drops out from here is a hire lost after it was counted.'], ['Target', 'None: it is a list to watch, not a rate.']] },
      { cap: 'Cancelled by the client', v: (s, m) => rate(s.n('cclient'), s.reqs.length, m), show: pcS,
        say: (s) => s.n('cclient') + ' of ' + plural(s.reqs.length, 'requisition') + (s.n('cmgr') ? ', and ' + s.n('cmgr') + ' by the manager' : ''),
        def: () => [['Unit', 'Requisition'], ['Of', 'Every requisition opened in the period'], ['Counts', 'Those the client cancelled. The manager’s own cancellations are said beside it, not counted in.'], ['Target', 'None: it is the client’s decision. Read it with their reasons.']] },
      { cap: 'Billed hires', v: (s) => s.billed, show: num, tgt: { v: 85, dir: 'ge', unit: '%' }, tgtV: () => rate(stayed, past.length), tgtLead: 'Day 90 ' + pcS(rate(stayed, past.length)) + ' · ',
        say: (s) => 'hired on billable requisitions · ' + stayed + ' of ' + past.length + ' earlier ones stayed to day 90',
        def: () => [['Unit', 'Person'], ['Counts', 'People with an accepted offer on a billable requisition'], ['Beside it', plural(past.length, 'billed hire') + ' whose day 90 has passed, on ' + (accIn ? accIn.name : 'these accounts') + '. Older than any period here, so the period does not apply to them.'], ['Target', 'For day 90: 85% or more. ' + TARGET_BY]] },
    ];
    const tile = (t) => {
      const v = t.v(st);
      const tv = WS.map((s) => (t.base && t.base(s) < TREND_MIN ? null : t.v(s, TREND_MIN)));
      const def = t.def(st).concat(t.tgt && !t.tgtV ? [['Target', TARGET_BY]] : [], [TREND_DEF]);
      return '<div class="t-kpi"><span class="t-kpi-cap">' + esc(t.cap) + '</span><b class="t-kpi-n">' + esc(t.show(v)) + '</b>' +
        (t.tgt ? tgtSay(t.tgt, t.tgtV ? t.tgtV(st) : v, t.tgtLead) : '') +
        '<span class="t-kpi-say">' + esc(t.say(st)) + '</span>' +
        '<span class="t-kpi-trend">' + spark(tv) + '<span>Month by month: ' + tv.map((x) => esc(t.show(x))).join(' → ') + '</span></span>' +
        '<details class="t-kpi-def"><summary>How it is counted</summary><dl>' + def.map((d) => '<dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd>').join('') + '</dl></details></div>';
    };
    /* The filters: the period as three chips, each with how many it holds,
       and the account as chips too, wrapping rather than scrolling (Sales's
       filter row), because a filter you cannot see is one you forget is on. */
    const filters = '<div class="t-rpt-filters">' +
      '<div class="s-views" role="group" aria-label="Opened in"><span class="t-rpt-lab">Opened in</span>' + PERIODS.map((p) =>
        '<button class="s-view' + (per === p[0] ? ' is-on' : '') + '" type="button" data-period="' + p[0] + '" aria-pressed="' + (per === p[0]) + '">' + esc(p[1]) +
        '<span class="s-view-n">' + inAcc.filter((q) => openedIn(q, 0, p[0])).length + '</span></button>').join('') + '</div>' +
      (accs.length > 1 ? '<div class="s-views" role="group" aria-label="Account"><span class="t-rpt-lab">Account</span>' +
        '<button class="s-view' + (!accIn ? ' is-on' : '') + '" type="button" data-account="" aria-pressed="' + !accIn + '">All accounts</button>' +
        accs.map((a) => '<button class="s-view' + (accIn === a ? ' is-on' : '') + '" type="button" data-account="' + a.id + '" aria-pressed="' + (accIn === a) + '">' + esc(a.name) +
          '<span class="s-view-n">' + pool.filter((q) => q.acc === a.id && openedIn(q, 0, per)).length + '</span></button>').join('') + '</div>' : '') +
    '</div>';
    const whose = isHR() ? 'Everyone’s requisitions' : isHM() ? 'The requisitions you asked for' : 'Your requisitions';
    const head = '<div class="s-camp-list-head">' + switcher('reports') + '<span class="s-block-say">' + esc(whose + ', opened in the last ' + per + ' days' + (accIn ? ', for ' + accIn.name : '')) + '</span></div>' + filters;
    if (!reqs.length) {
      return '<div class="s-home"><section class="s-block s-block-wide" aria-label="Reports">' + head +
        '<p class="t-rpt-none">No requisitions opened in the last ' + per + ' days' + (accIn ? ' for ' + esc(accIn.name) : '') + '. Try a longer period' + (accIn ? ' or all accounts' : '') + '.</p></section></div>';
    }
    const byAcc = ACCOUNTS.map((a) => ({ a: a, n: reqs.filter((q) => q.acc === a.id).length, open: reqs.filter((q) => q.acc === a.id && isOpen(q)).length,
      hired: reqs.filter((q) => q.acc === a.id && (q.state === 'filled' || q.state === 'started')).length })).filter((x) => x.n).sort((x, y) => y.n - x.n);
    const maxAcc = Math.max(1, ...byAcc.map((x) => x.n));
    const titles = {};
    reqs.forEach((q) => { titles[q.title] = (titles[q.title] || 0) + 1; });
    const byTitle = Object.keys(titles).map((t) => ({ t: t, n: titles[t] })).sort((x, y) => y.n - x.n).slice(0, 8);
    const f = ['phone', 'hr', 'tech', 'sent', 'client', 'offer', 'accepted'].map((k) => ({ k: k, n: k === 'phone' ? phones : reached(k) }));
    const dropped = offers.filter((o) => o.status === 'declined').length;
    const repl = reqs.filter((q) => q.kind === 'replacement').length;
    const bill = reqs.filter((q) => q.billable).length;
    const bar = (v, max, tone) => '<span class="t-fn-track"><span class="t-fn-fill' + (tone ? ' ' + tone : '') + '" style="width:' + (v / max * 100).toFixed(1) + '%"></span></span>';
    /* THE HONEST LINE (P2). Client acceptance looks like the leak, but
       about three to five profiles per client interview is the agency norm,
       so the loss worth naming is the one in people, upstream, and the
       days it takes to send. The benchmark is weak and the line says so. */
    let lossAt = 1;
    for (let i = 1; i < f.length; i++) if (f[i - 1].n - f[i].n > f[lossAt - 1].n - f[lossAt].n) lossAt = i;
    const sentN = reached('sent'), metN = reached('client');
    const slow = reqs.filter(noSend);
    /* WHERE TIME GOES (R5: in FlairsTech's own data, 46 of 105 lost
       requisition-days were spent waiting for feedback). Now, on the open
       requisitions in view: the days each person is past the usual time for
       their step, added up by the step and by who it waits on. The
       recruiter's own steps are counted too, so the chart is not a list of
       other people to blame. */
    const WHO_SAY = { me: 'you', interviewer: 'the interviewer', hm: 'the hiring manager', client: 'the client', candidate: 'the candidate' };
    const lost = {};
    reqs.filter(isOpen).forEach((q) => activeOf(q).forEach((c) => {
      const w = waitsOn(c), d = lostDays(c);
      if (!WHO_SAY[w] || !d) return;
      const k = c.stage + '|' + w;
      lost[k] = lost[k] || { stage: c.stage, w: w, d: 0, n: 0 };
      lost[k].d += d; lost[k].n++;
    }));
    const lostRows = Object.keys(lost).map((k) => lost[k]).sort((x, y) => y.d - x.d);
    const lostAll = lostRows.reduce((s, x) => s + x.d, 0);
    const lostThem = lostRows.filter((x) => x.w !== 'me').reduce((s, x) => s + x.d, 0);
    const maxLost = Math.max(1, ...lostRows.map((x) => x.d));
    return '<div class="s-home">' +
      '<section class="s-block s-block-wide" aria-label="Reports">' + head +
        '<div class="t-kpis">' + tiles.map(tile).join('') + '</div>' +
      '</section>' +
      '<section class="s-block s-block-wide" aria-label="Staffing"><div class="s-camp-list-head"><h2 class="s-block-h">Staffing</h2><span class="s-block-say">what a hire takes, and what happens after it</span></div>' +
        '<div class="t-kpis">' + staffing.map(tile).join('') + '</div>' +
      '</section>' +
      (phones ? (function () {
        /* AiMY's one finding: a client's decline pattern waiting on a
           person, if there is one; otherwise the honest line (P2). */
        const dp = isRec() || isHR() ? dProposals()[0] : null;
        const say = dp ? dp.evidence + ' ' + esc(dp.rule)
          : '<b>' + sentN + ' of ' + phones + '</b> people screened by phone were sent to a client. Most are lost before the client, not at it' +
            (sendAvg != null ? ', and the first profile takes <b>' + days(sendAvg) + '</b> to send.' : '.');
        const act = dp ? (isHR() ? rcBtn('Approve the rule', 'data-prop="' + esc(dp.key) + '|approve"', 'psmall') : dp.rec && dp.rec.state === 'waiting' ? '<span class="sub">Waiting on ' + esc(DESKS.dina.name) + '</span>'
            : rcBtn('Send it to ' + DESKS.dina.name, 'data-prop="' + esc(dp.key) + '|send"', 'psmall')) + rcBtn('Not now', 'data-prop="' + esc(dp.key) + '|later"', 'small')
          : slow.length ? rcBtn('Open the ' + plural(slow.length, 'requisition') + ' with no profile after ' + NOSEND_DAYS + ' days', goAttr({ on: 'reqs', q: 'nosend' }).trim(), 'psmall') : '';
        return insight({ label: 'Where people are lost', say: say, act: act,
          src: dp ? 'Learning proposal · from ' + esc(dp.from) + ' in 90 days · reason codes · an HR Manager approves'
            : 'Clients met ' + metN + ' of them, about ' + (metN ? (sentN / metN).toFixed(1) : '·') + ' profiles per client interview. ' + versusNorm(metN ? sentN / metN : null) + ' A weak benchmark: vendor blogs and one 2018 survey.',
          metrics: [
            { cap: 'Profiles sent → client interview', n: sentN ? (metN / sentN * 100).toFixed(1) + '%' : '·', of: metN + ' of ' + sentN + ' · the requisitions in view',
              def: [['Unit', 'Person'], ['Starts', 'Profile sent'], ['Stops', 'Client accepts an interview']] },
            { cap: 'Hired', n: String(hiredO.length), of: 'people · the requisitions in view',
              def: [['Unit', 'Person'], ['Counts at', 'Offer accepted'], ['Not to mix', 'Vacancies filled: ' + hiredSeats]] },
          ],
          foot: isHR() ? 'Team and request views. Per-recruiter scorecards live in AiMY QA; the counts below are alphabetical, not a ranking.' : 'Team and request views only. Per-recruiter scorecards live in AiMY QA.' });
      })() : '') +
      '<section class="s-block s-block-wide" aria-label="Where time goes"><div class="s-camp-list-head"><h2 class="s-block-h">Where time goes</h2><span class="s-block-say">days past the usual time, now · by step and who it waits on</span></div>' +
        (lostRows.length ? '<div class="t-funnel">' + lostRows.map((x, i) => '<div class="t-fn-row t-lost-row' + (x.w === 'me' ? ' is-mine' : '') + (i === 0 ? ' is-top' : '') + '">' +
            '<span class="t-fn-label"><span class="t-lost-step">' + esc(STAGE[x.stage].label) + '</span><span class="t-lost-who">waiting on ' + esc(WHO_SAY[x.w]) + '</span></span>' +
            bar(x.d, maxLost) + '<span class="t-fn-n"><b>' + days(x.d) + '</b> · ' + plural(x.n, 'person', 'people') + '</span></div>').join('') + '</div>' +
          aimyBlock({ text: '<b>' + lostThem + ' of ' + lostAll + '</b> days past the usual time are spent waiting on someone else’s answer' +
            (lostAll - lostThem ? ', and <b>' + days(lostAll - lostThem) + '</b> on steps that are yours' : '') + '. In FlairsTech’s own data it was 46 of 105, so waiting is where to look first. Today lists each one with its nudge.',
            from: 'the open requisitions in view, and the recruitment data' })
          : '<p class="t-rpt-none">Nothing is past its usual time on the open requisitions in view.</p>') +
      '</section>' +
      '<section class="s-block s-block-wide" aria-label="Funnel"><div class="s-camp-list-head"><h2 class="s-block-h">The funnel</h2><span class="s-block-say">everyone who reached each stage · share of the stage before</span></div>' +
        '<div class="t-funnel">' + f.map((s, i) => '<div class="t-fn-row' + (i === lossAt ? ' is-leak' : '') + '"><span class="t-fn-label">' + esc(STAGE[s.k].label) + '</span>' +
          bar(s.n, Math.max(1, f[0].n)) + '<span class="t-fn-n"><b>' + s.n + '</b>' + (i && f[i - 1].n ? ' · ' + Math.round(s.n / f[i - 1].n * 100) + '%' : '') + '</span></div>').join('') + '</div>' +
        aimyBlock({ text: 'The most people leave between the ' + esc(lower(STAGE[f[lossAt - 1].k].label)) + ' and the ' + esc(lower(STAGE[f[lossAt].k].label)) + ': <b>' + (f[lossAt - 1].n - f[lossAt].n) + '</b> of ' + f[lossAt - 1].n + '. ' +
          dropped + ' offers were declined. ' + repl + ' of ' + reqs.length + ' requests were replacements, and ' + bill + ' are billable.', from: 'every requisition in view' }) +
      '</section>' +
      reasonsBlock(declines(reqs), 'clients') +
      (accIn ? '' : '<section class="s-block s-block-wide" aria-label="By account"><div class="s-camp-list-head"><h2 class="s-block-h">By account</h2><span class="s-block-say">requests · open · filled</span></div>' +
        '<div class="t-funnel">' + byAcc.map((x) => '<button class="t-fn-row t-fn-btn" type="button" data-acc="' + x.a.id + '"><span class="t-fn-label">' + esc(x.a.name) + '</span>' + bar(x.n, maxAcc) +
          '<span class="t-fn-n"><b>' + x.n + '</b> · ' + x.open + ' · ' + x.hired + '</span></button>').join('') + '</div>' +
      '</section>') +
      '<section class="s-block s-block-wide" aria-label="By role"><div class="s-camp-list-head"><h2 class="s-block-h">By role</h2><span class="s-block-say">requests</span></div>' +
        '<div class="t-funnel">' + byTitle.map((x) => '<div class="t-fn-row"><span class="t-fn-label">' + esc(x.t) + '</span>' + bar(x.n, byTitle[0].n) + '<span class="t-fn-n"><b>' + x.n + '</b></span></div>').join('') + '</div>' +
      '</section>' +
      /* Counts, alphabetical, no bars: nothing here can be read as a
         ranking until decision D5 (P6; rank incentives cut productivity in
         a field experiment, R6). The same period and account as the rest. */
      (isHR() ? '<section class="s-block s-block-wide" aria-label="By recruiter"><div class="s-camp-list-head"><h2 class="s-block-h">By recruiter</h2><span class="s-block-say">alphabetical · not a ranking</span></div>' +
        aimyBlock({ text: 'The same numbers the dashboard shows today, as counts. Whether per-person numbers stay in Talent is decision D5; the research leans to team views here and coaching one person at a time in AiMY QA.', from: 'the UI/UX plan, P6' }) +
        '<div class="t-tbl" role="table" aria-label="By recruiter"><div class="t-tbl-row t-tbl-head" role="row"><span role="columnheader">Recruiter</span><span role="columnheader">Open requisitions</span><span role="columnheader">People in progress</span><span role="columnheader">Days to send profiles</span></div>' +
        RECRUITERS.slice().sort((x, y) => x.name.localeCompare(y.name)).map((rc) => { const mineR = reqs.filter((q) => q.rec === rc.id);
          const act = mineR.filter(isOpen).reduce((s, q) => s + activeOf(q).length, 0);
          return '<div class="t-tbl-row" role="row"><span role="cell">' + esc(rc.name) + '</span><span role="cell">' + mineR.filter(isOpen).length + '</span><span role="cell">' + act + '</span><span role="cell">' + (avgSent(mineR) != null ? avgSent(mineR) : '·') + '</span></div>'; }).join('') + '</div>' +
      '</section>' : '') +
    '</div>';
  }

  /* ══ THE OTHER DESKS ═════════════════════════════════════════════════════ */
  function deskHome() { return isHM() ? hmHome() : isHR() ? hrHome() : isClient() ? clientHome() : isBU() ? buHome() : homePage(); }
  /* What waits on this desk, each with the one way to answer it. Feeds the
     home page, the rail and the bell alike, so they cannot disagree. */
  function asks() {
    const out = [];
    if (isHM()) {
      DB.offers.filter((o) => o.status === 'approving' && o.hm !== 'ok' && DB.byId[o.cand] && reqOf(DB.byId[o.cand]).hm === DESK).forEach((o) => {
        const c = DB.byId[o.cand];
        out.push({ k: 'offer', c: c, age: c.since, head: 'Approve ' + first(c.name) + '’s offer', body: money(o.salary) + ' for ' + reqOf(c).title + '. ' + BU_DIRECTOR + ' approves the same packet at the same time.', go: { approve: o.id, by: 'hm' }, verb: 'Open the packet' });
      });
      DB.ivs.filter((v) => v.status === 'owed' && v.by.indexOf(me().name) === 0).forEach((v) => {
        const c = DB.byId[v.cand];
        out.push({ k: 'debrief', c: c, age: -v.day, head: 'Your debrief on ' + c.name, body: STAGE[v.stage].label + ' ' + sayWhen(v.day) + '. About two minutes.', go: { debrief: v.id }, verb: 'Write it' });
      });
      /* The hiring manager manages the account, so a client gone quiet on a
         profile is theirs to chase (M11 groups these by account). */
      deskReqs().filter(isOpen).forEach((q) => activeOf(q).filter((c) => c.stage === 'sent' && c.since >= STAGE.sent.exp).forEach((c) => {
        out.push({ k: 'client', c: c, age: c.since, head: accOf(q).name + ' owes an answer on ' + c.name, body: 'Profile sent ' + days(c.since) + ' ago for ' + q.title + ', ' +
          (c.openDay != null ? 'opened ' + sayWhen(c.openDay) : 'not opened yet') + '. You manage the account.', go: { cand: c.id }, verb: 'See them' });
      }));
      deskReqs().filter(isOpen).forEach((q) => activeOf(q).filter((c) => c.stage === 'tech' && c.since <= 2).forEach((c) => {
        out.push({ k: 'new', c: c, age: c.since, head: c.name + ' is on your shortlist', body: 'Advanced to the technical round for ' + q.title + '. ' + evMet(c) + ' of ' + c.ev.length + ' must-haves met in the CV.', go: { cand: c.id }, verb: 'See them' });
      }));
      /* A client's request lands here as a draft, to be talked through. */
      DB.reqs.filter((q) => q.state === 'draft' && q.hm === DESK && DESKS[q.askedBy] && (DESKS[q.askedBy].fn === 'client' || DESKS[q.askedBy].fn === 'bu')).forEach((q) => {
        out.push({ k: 'request', c: null, age: 0, head: DESKS[q.askedBy].name + ' asked for ' + (q.title ? plural(q.seats, 'seat') + ' as ' + q.title : 'a hire'),
          body: q.desc + ' Talk it through with them, then open it.', go: { req: q.id }, verb: 'Open the draft' });
      });
    } else if (isClient()) {
      deskReqs().filter(isOpen).forEach((q) => activeOf(q).filter((c) => c.stage === 'sent').forEach((c) => {
        out.push({ k: 'sent', c: c, head: c.name + ' for ' + q.title, body: 'Sent ' + (c.since ? days(c.since) + ' ago' : 'today') + '. ' + evMet(c) + ' of ' + c.ev.length + ' must-haves met, verified in our interviews.', go: { cand: c.id }, verb: 'Decide', yes: true });
      }));
      DB.ivs.filter((v) => v.status === 'owed' && (v.stage === 'client' || v.stage === 'ctech') && reqOf(DB.byId[v.cand]).acc === me().acc).forEach((v) => {
        const c = DB.byId[v.cand];
        out.push({ k: 'debrief', c: c, head: 'How did ' + first(c.name) + '’s interview go?', body: STAGE[v.stage].label + ' ' + sayWhen(v.day) + '. Your feedback goes to the recruiter.', go: { debrief: v.id }, verb: 'Give feedback' });
      });
    } else if (isBU()) {
      /* Two approvers, two questions (M3): fit and salary are the hiring
         manager's; the seat and the money are the BU Director's. */
      DB.offers.filter((o) => o.status === 'approving' && o.bu !== 'ok' && DB.byId[o.cand]).forEach((o) => {
        const c = DB.byId[o.cand], q = reqOf(c);
        out.push({ k: 'offer', c: c, age: c.since, head: 'Budget and headcount for ' + first(c.name) + '’s offer',
          body: money(o.salary) + ' for ' + q.title + ', ' + accOf(q).name + '. Fit is ' + hmOf(q).name + '’s question; yours is whether the seat and the money are there.',
          go: { approve: o.id, by: 'bu' }, verb: 'Answer it' });
      });
    } else if (isHR()) {
      DB.offers.filter((o) => o.status === 'approving').forEach((o) => {
        const c = DB.byId[o.cand];
        out.push({ k: 'offer', c: c, head: first(c.name) + '’s offer is waiting on ' + (o.hm !== 'ok' && o.bu !== 'ok' ? 'both approvers' : o.hm !== 'ok' ? hmOf(reqOf(c)).name : BU_DIRECTOR),
          body: reqOf(c).title + ', ' + money(o.salary) + '.', go: { cand: c.id }, verb: 'See the offer' });
      });
    }
    return out;
  }
  function deskBrief(title, lines, starts) {
    return '<section class="slv s-block-wide">' +
      '<div class="slv-head">' + mark(18) + '<h1 class="slv-title">' + esc(title) + '</h1><span class="slv-time">' + sayDay(0) + '</span></div>' +
      '<div class="slv-body">' + lines.map((l) => '<p class="slv-line">' + l + '</p>').join('') + '</div>' +
      (starts ? '<div class="s-starts-wrap"><span class="s-starts-cap">Start</span><div class="s-starts">' + starts.map((s) => '<button class="s-start" type="button"' + (s.go ? goAttr(s.go) : ' data-' + s.data) + '>' +
        '<span class="s-start-top"><span class="s-start-label">' + esc(s.label) + '</span><span class="s-start-n">' + (s.n || '​') + '</span></span>' +
        '<span class="s-start-why">' + esc(s.why) + '</span></button>').join('') + '</div></div>' : '') +
    '</section>';
  }
  function askRows(list) {
    return '<div class="b-owed">' + list.map((x, i) => '<div class="b-owed-row t-row" style="--i:' + Math.min(i, 8) + '">' +
      '<span class="b-owed-sev" aria-hidden="true"></span>' +
      '<button class="b-owed-main t-row-open" type="button"' + goAttr(x.c ? { cand: x.c.id } : x.go) + '><span class="b-owed-head"><span class="b-owed-type">' + esc(x.head) + '</span></span>' +
        '<span class="b-owed-body">' + esc(x.body) + '</span></button>' +
      (x.yes ? '<span class="t-acts">' + exitBtn(x.c, 'clientno') +
        '<button class="b-owed-go t-row-go" type="button" data-move="' + x.c.id + '|client">Meet them</button></span>'
        : '<button class="b-owed-go t-row-go" type="button"' + goAttr(x.go) + '>' + esc(x.verb) + '</button>') +
    '</div>' + (x.yes && passOpen(x.c) ? '<div class="t-row-more">' + passPicker(x.c) + '</div>' : '')).join('') + '</div>';
  }
  /* The hiring manager holds many requests at once (M11), so their asks
     come grouped by account, the account with the oldest ask first, and
     oldest first inside each. */
  function askGroups(list) {
    const accOfAsk = (x) => x.c ? reqOf(x.c).acc : x.go && x.go.req && DB.reqById[x.go.req] ? DB.reqById[x.go.req].acc : 'flairs';
    const groups = {};
    list.forEach((x) => { const k = accOfAsk(x); (groups[k] = groups[k] || []).push(x); });
    return Object.keys(groups).map((k) => ({ a: ACCOUNTS.filter((x) => x.id === k)[0], list: groups[k].sort((p, q) => (q.age || 0) - (p.age || 0)) }))
      .sort((p, q) => (q.list[0].age || 0) - (p.list[0].age || 0))
      .map((g) => '<h3 class="b-month">' + esc(g.a.name) + ' <span class="b-kind">' + plural(g.list.length, 'ask') + ', the oldest ' + days(g.list[0].age || 0) + '</span></h3>' + askRows(g.list)).join('');
  }
  function hmHome() {
    const a = asks();
    const reqs = deskReqs().filter((q) => q.state !== 'draft');
    const open = reqs.filter(isOpen);
    const risky = open.filter((q) => health(q).risk);
    const accs = ACCOUNTS.filter((x) => open.some((q) => q.acc === x.id));
    return '<div class="s-home">' +
      deskBrief('Today', [
        a.length ? '<b>' + plural(a.length, 'ask') + '</b> waiting on you: ' + ['request', 'offer', 'client', 'debrief', 'new'].map((k) => { const n = a.filter((x) => x.k === k).length; return n ? n + ' ' + { offer: n === 1 ? 'offer to approve' : 'offers to approve', client: n === 1 ? 'answer a client owes' : 'answers clients owe', debrief: n === 1 ? 'debrief' : 'debriefs', new: 'new on your shortlists', request: n === 1 ? 'request from a client' : 'requests from clients' }[k] : null; }).filter(Boolean).join(', ') + '.' : 'Nothing waits on you today.',
        '<b>' + plural(open.length, 'requisition') + '</b> open across ' + plural(accs.length, 'account') + (risky.length ? ', and <b>' + risky.length + '</b> ' + (risky.length === 1 ? 'is' : 'are') + ' likely to miss the date.' : '.'),
        'You see candidates once the recruiter advances them; until then they are a count.',
      ], [
        { label: 'Approve offers', n: a.filter((x) => x.k === 'offer').length, why: 'one packet, approved in parallel', go: a.filter((x) => x.k === 'offer')[0] ? a.filter((x) => x.k === 'offer')[0].go : { on: 'reqs' } },
        { label: 'Debriefs you owe', n: a.filter((x) => x.k === 'debrief').length, why: 'two minutes each', go: a.filter((x) => x.k === 'debrief')[0] ? a.filter((x) => x.k === 'debrief')[0].go : { on: 'reqs' } },
        { label: 'Ask for a hire', why: 'or clone one you had before', data: 'new-req' },
        { label: 'Reports', why: 'your requisitions, in numbers', go: { on: 'reports' } },
      ]) +
      '<section class="s-block s-block-wide"><div class="s-camp-list-head">' + switcher('') + '<span class="s-block-say">by account · oldest first</span></div>' +
        (a.length ? askGroups(a) : '<p class="s-none">Nothing is waiting on you.</p>') + '</section>' +
      accs.map((x) => '<section class="s-block s-block-wide" aria-label="' + esc(x.name) + '"><div class="s-camp-list-head"><h2 class="s-block-h">' + esc(x.name) + '</h2>' +
        '<span class="s-block-say">' + plural(open.filter((q) => q.acc === x.id).length, 'open requisition') + '</span></div>' +
        '<div class="b-grid">' + open.filter((q) => q.acc === x.id).map((q, i) => '<div class="b-slot">' + reqCard(q, i) + '</div>').join('') + '</div></section>').join('') +
    '</div>';
  }
  function hrHome() {
    const all = DB.reqs.filter((q) => q.state !== 'draft');
    const open = all.filter(isOpen);
    const risky = open.filter((q) => health(q).risk);
    const owed = DB.ivs.filter((v) => v.status === 'owed').sort((x, y) => x.day - y.day);
    const appr = DB.offers.filter((o) => o.status === 'approving');
    /* Alphabetical, for reassigning: a load list, not a league table (P6). */
    const load = RECRUITERS.map((rc) => ({ rc: rc, n: DB.reqs.filter((q) => q.rec === rc.id && isOpen(q)).length,
      p: DB.reqs.filter((q) => q.rec === rc.id && isOpen(q)).reduce((s, q) => s + activeOf(q).length, 0) })).sort((x, y) => x.rc.name.localeCompare(y.rc.name));
    const heavy = load.slice().sort((x, y) => y.n - x.n)[0];
    const most = Math.max(1, heavy.n);
    const avgLoad = load.reduce((s, x) => s + x.n, 0) / load.length;
    const lp = dProposals().concat(qProposals());
    return '<div class="s-home">' +
      deskBrief('Today', [
        '<b>' + risky.length + ' of ' + open.length + '</b> open requisitions are likely to miss their date.',
        appr.length ? '<b>' + plural(appr.length, 'offer') + '</b> ' + (appr.length === 1 ? 'is' : 'are') + ' waiting on an approver. ' + (owed.length ? '<b>' + plural(owed.length, 'debrief') + '</b> ' + (owed.length === 1 ? 'is' : 'are') + ' owed, the oldest from ' + sayWhen(owed[0].day) + '.' : '') : 'No offer is waiting on an approver.',
        heavy.n > avgLoad * 1.4 ? '<b>' + esc(heavy.rc.name) + '</b> carries ' + heavy.n + ' open requisitions against an average of ' + Math.round(avgLoad) + '.' : 'The load is even across the team.',
      ], [
        { label: 'At risk', n: risky.length, why: 'each with its reason', go: { on: 'reqs', q: 'risk' } },
        { label: 'Templates', why: 'stages, agendas and what AiMY may do', go: { on: 'templates' } },
        { label: 'Assessments', n: qProposals().length || null, why: qProposals().length ? 'questions most people fail' : 'all reading well', go: { on: 'asmts' } },
        { label: 'Reports', why: 'every number from the dashboard', go: { on: 'reports' } },
      ]) +
      '<section class="s-block s-block-wide"><div class="s-camp-list-head">' + switcher('') + '<span class="s-block-say">likely to miss their date · the reason is on each row</span></div>' +
        (risky.length ? '<div class="b-owed">' + risky.map((q, i) => '<div class="b-owed-row t-row" style="--i:' + Math.min(i, 8) + '"><span class="b-owed-sev" aria-hidden="true"></span>' +
          '<button class="b-owed-main t-row-open" type="button"' + goAttr({ req: q.id }) + '><span class="b-owed-head"><span class="b-owed-type">' + esc(q.title) + '</span>' +
            '<span class="b-owed-by">' + esc(accOf(q).name) + ' · ' + esc((RECRUITERS.filter((x) => x.id === q.rec)[0] || {}).name) + '</span>' + tag('At risk', 'warn') + '</span>' +
            '<span class="b-owed-body">' + riskSay(q, health(q)) + '</span></button>' +
          '<span class="t-acts">' + assignMenu(q) + '</span></div>').join('') + '</div>' : '<p class="s-none">Nothing is at risk.</p>') +
      '</section>' +
      (appr.length ? '<section class="s-block s-block-wide"><div class="s-camp-list-head"><h2 class="s-block-h">Offers waiting on an approver</h2><span class="s-block-say">' + appr.length + '</span></div>' + askRows(asks()) + '</section>' : '') +
      (owed.length ? '<section class="s-block s-block-wide"><div class="s-camp-list-head"><h2 class="s-block-h">Feedback owed</h2><span class="s-block-say">items, not people · oldest first</span></div>' +
        '<div class="b-log">' + owed.slice(0, 8).map((v, i) => { const c = DB.byId[v.cand]; return logRow({ tone: '', ico: svg('users'), who: STAGE[v.stage].label + ' for ' + reqOf(c).title,
          meta: logMeta([v.by, 'held ' + sayWhen(v.day)]), act: 'data-cand="' + c.id + '"', go: 'Open' }, i); }).join('') + '</div></section>' : '') +
      '<section class="s-block s-block-wide"><div class="s-camp-list-head"><h2 class="s-block-h">The team’s load</h2><span class="s-block-say">alphabetical · open requisitions · people in progress</span></div>' +
        '<div class="t-funnel">' + load.map((x) => '<div class="t-fn-row"><span class="t-fn-label">' + esc(x.rc.name) + '</span><span class="t-fn-track"><span class="t-fn-fill" style="width:' + (x.n / most * 100).toFixed(1) + '%"></span></span>' +
          '<span class="t-fn-n"><b>' + x.n + '</b> · ' + x.p + '</span></div>').join('') + '</div></section>' +
      '<section class="s-block s-block-wide" aria-label="Learning proposals"><div class="s-camp-list-head"><h2 class="s-block-h">Learning proposals</h2><span class="s-block-say">AiMY proposes · you approve · the version before is kept</span></div>' +
        gate(checkins(), GATE, 'day-90 check-ins recorded', checkins() < GATE
          ? 'AiMY proposes nothing from outcomes until there are ' + GATE + '. At about 21 hires in two months, that is months, not weeks. Proposals from client reasons and from test results need no outcomes, so they come now.'
          : 'Enough to read. AiMY compares who stayed against the success profile, and proposes only where a pattern holds.') +
        (lp.length ? '<div class="t-props">' + lp.map((p, i) => propCard(p, i)).join('') + '</div>' : '<p class="s-none">Nothing to approve.</p>') +
      '</section>' +
    '</div>';
  }
  /* The BU Director's desk is Sales's stakeholder: the manager's reading,
     bounded to what they answer for, with reading-only verbs. */
  function buHome() {
    const a = asks();
    const open = deskReqs().filter(isOpen);
    const risky = open.filter((q) => health(q).risk);
    const said = declines(DB.reqs).filter((c) => c.decline.day >= -90);
    const top = declineCounts(said)[0];
    return '<div class="s-home">' +
      deskBrief('Today', [
        a.length ? '<b>' + plural(a.length, 'offer') + '</b> ' + (a.length === 1 ? 'waits' : 'wait') + ' for your answer on budget and headcount. Fit is the hiring manager’s question, not yours.' : 'No offer is waiting for your answer.',
        /* No bare count of seats filled: Hiring outcomes never shows hires
           without acceptance and day-90 retention beside them (M10). */
        '<b>' + plural(open.length, 'requisition') + '</b> open in the unit' + (risky.length ? ', <b>' + risky.length + '</b> likely to miss the date.' : '.'),
        top ? 'Clients gave <b>' + plural(said.length, 'reason') + '</b> for passing in 90 days; the most common is ' + esc(lower(top.d.label)) + '.' : 'No client has passed with a reason yet.',
      ], [
        { label: 'Answer the budget question', n: a.length, why: a[0] ? a[0].c.name + ', ' + reqOf(a[0].c).title : 'nothing is waiting', go: a[0] ? a[0].go : { on: 'reqs' } },
        { label: 'Request a hire', why: 'a hiring manager talks it through before it opens', data: 'client-request' },
        { label: 'Why clients pass', why: 'one reason per decision, every client', data: 'ask="Why do clients pass?"' },
        { label: 'Reports', why: 'the unit in numbers', go: { on: 'reports' } },
      ]) +
      '<section class="s-block s-block-wide"><div class="s-camp-list-head">' + switcher('') + '<span class="s-block-say">offers waiting on your answer · oldest first</span></div>' +
        (a.length ? askRows(a) : '<p class="s-none">Nothing is waiting on you.</p>') + '</section>' +
      reasonsBlock(said, 'clients', null) +
    '</div>';
  }
  /* ── 9. WHAT THE CLIENT SEES (client-desk-view) ── the profiles sent to
     them, each with its evidence as a count and two verbs; what they see
     and never see, said on the page. */
  function profilesForYou(list) {
    const a = ACCOUNTS.filter((x) => x.id === me().acc)[0];
    const titles = list.map((c) => reqOf(c).title).filter((t, i, all) => all.indexOf(t) === i);
    const fresh = list.filter((c) => c.since <= 7).length;
    return rcard({ cap: 'Client desk · what ' + shortAcc(a) + ' sees', ico: 'acc', label: 'Profiles for you',
      body: rcHead('Profiles for you', esc(titles.join(', ')) + ' · ' + plural(fresh, 'new this week', 'new this week'), rcChip(me().name + ' · ' + a.name)) +
        list.map((c) => {
          const met = evMet(c), all = c.ev.length;
          const v = verified(c).filter((x) => x.state === 'verified').map((x) => x.must);
          return '<div class="card" style="margin-top:14px">' +
            '<div class="row between"><div class="row"><div class="av" aria-hidden="true">' + esc(initials(c.name)) + '</div>' +
              '<div><h4><button type="button" data-cand="' + c.id + '">' + esc(c.name) + '</button></h4>' +
                '<div class="sub">' + esc(c.at) + ', ' + plural(c.years, 'year') + ' · ' + esc(c.langs.join(', ')) + (v.length ? ' · ' + esc(v[0]) + ' (verified in interview)' : '') + (c.notice ? ' · ' + esc(c.notice) : '') + '</div></div></div>' +
              rcChip(met + ' of ' + all + ' met', met === all ? 'ok' : 'warn') + '</div>' +
            (wuOf(c) ? '<div style="margin-top:10px">' + rcQuote(esc(wuOf(c).text)) + '</div>' : '') +
            (passOpen(c) ? passPicker(c, true) : '<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">' + rcBtn('Invite to interview', 'data-move="' + c.id + '|client"', 'primary', 'cal') + rcBtn('Decline with a reason', 'data-pass-open="' + c.id + '"') + '</div>') +
            rcNote('lock', 'Each person on your team decides on their own; nobody’s rating shows to the others until they have given theirs.') +
          '</div>';
        }).join('') +
        '<div class="two" style="margin-top:14px">' +
          '<div class="note">' + svg('eye', 14) + '<span><b>You see</b><br>profiles we sent, evidence, interviews, status of your requests</span></div>' +
          '<div class="note">' + svg('eyeoff', 14) + '<span><b>You never see</b><br>salary, margin, internal notes, other clients</span></div>' +
        '</div>' });
  }
  function clientHome() {
    const a = asks();
    const reqs = deskReqs();
    const open = reqs.filter(isOpen);
    const sent = a.filter((x) => x.k === 'sent');
    const booked = DB.ivs.filter((v) => v.status === 'booked' && (v.stage === 'client' || v.stage === 'ctech') && reqOf(DB.byId[v.cand]).acc === me().acc);
    return '<div class="s-home">' +
      deskBrief('Today', [
        sent.length ? '<b>' + plural(sent.length, 'profile') + '</b> ' + (sent.length === 1 ? 'waits' : 'wait') + ' on your answer. Meet them, or pass with a reason.' : 'No profiles are waiting on you.',
        booked.length ? '<b>' + plural(booked.length, 'interview') + '</b> booked with your team, the next ' + sayWhen(booked.sort((x, y) => x.day - y.day)[0].day) + '.' : 'No interviews are booked with your team.',
        '<b>' + plural(open.length, 'request') + '</b> open with us. Your account manager is ' + esc(hmOf(reqs[0] || { hm: 'rania' }).name) + '.',
      ], [
        { label: 'Profiles to decide', n: sent.length, why: 'meet them or pass', go: sent[0] ? sent[0].go : { on: 'reqs' } },
        { label: 'Feedback owed', n: a.filter((x) => x.k === 'debrief').length, why: 'two minutes each', go: a.filter((x) => x.k === 'debrief')[0] ? a.filter((x) => x.k === 'debrief')[0].go : { on: 'reqs' } },
        { label: 'Ask for a hire', why: 'your account manager talks it through', data: 'client-request' },
      ]) +
      '<section class="s-block s-block-wide"><div class="s-camp-list-head">' + switcher('') + '</div>' +
        (a.filter((x) => x.k !== 'sent').length ? askRows(a.filter((x) => x.k !== 'sent'))
          : sent.length ? '' : '<p class="s-none">Nothing is waiting on you.</p>') + '</section>' +
      (sent.length ? profilesForYou(sent.map((x) => x.c)) : '') +
      outcomeStrip(me().acc, true) +
      '<section class="s-block s-block-wide"><div class="s-camp-list-head"><h2 class="s-block-h">Your requests</h2><span class="s-block-say">' + open.length + ' open</span></div>' +
        '<div class="b-grid">' + open.map((q, i) => '<div class="b-slot">' + reqCard(q, i) + '</div>').join('') + '</div></section>' +
    '</div>';
  }

  /* ══ THE CAREERS PAGE AND THE CANDIDATE'S OWN PROFILE ════════════════════
     From the link a requisition carries once it is published. Only a
     published role is shown, and a client-linked one never names the
     client. The candidate applies by talking to AiMY: drop a CV, AiMY reads
     it, asks only for what is missing, takes consent, and hands back a link
     to their own profile (New Operations list). */
  /* ── ARABIC ON THE PAGES CANDIDATES SEE (M9) ── the careers page and a
     candidate's own profile, right to left. Each line is written in both
     languages side by side, so neither drifts from the other. The role
     itself stays as the hiring team wrote it, marked as English. The
     Arabic wants a native speaker's read before it ships. */
  const isAr = () => UI.lang === 'ar';
  const tr = (en, ar, v) => String(isAr() ? ar : en).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m));
  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const sayDayL = (n) => { const d = dayOf(n); return isAr() ? d.getDate() + ' ' + MONTHS_AR[d.getMonth()] : sayDay(n); };
  const yearsL = (n) => isAr() ? (n === 1 ? 'سنة واحدة' : n === 2 ? 'سنتين' : n <= 10 ? n + ' سنوات' : n + ' سنة') : plural(n, 'year');
  const langSwitch = () => '<span class="t-lang" role="group" aria-label="Language">' +
    '<button class="t-lang-btn' + (isAr() ? '' : ' is-on') + '" type="button" data-lang="en" lang="en" aria-pressed="' + !isAr() + '">English</button>' +
    '<button class="t-lang-btn' + (isAr() ? ' is-on' : '') + '" type="button" data-lang="ar" lang="ar" aria-pressed="' + isAr() + '">العربية</button></span>';
  const outOpen = (cls) => '<div class="t-out' + (cls ? ' ' + cls : '') + '"' + (isAr() ? ' dir="rtl" lang="ar"' : '') + '>';

  let APPLY = null;
  function portalApply() {
    const q = DB.reqById[S.apply];
    const head = outsideHead(tr('FlairsTech careers', 'وظائف فليرز تك'), tr('Work with us', 'اعمل معنا'), true);
    if (!q || !q.published || !isOpen(q)) return outOpen() + head + '<section class="t-out-card"><h1 class="t-out-h">' + tr('This role is not open to applications.', 'هذه الوظيفة لا تستقبل طلبات الآن.') + '</h1>' +
      '<p>' + tr('It may have been filled or taken down. Other roles are on the careers page.', 'ربما شُغلت أو أُزيلت. ستجد وظائف أخرى في صفحة الوظائف.') + '</p></section></div>';
    if (!APPLY || APPLY.req !== q.id) APPLY = { req: q.id, step: 'hello', i: 0, f: null, consent: false, wa: false };
    const said = [];
    const ai = (t) => said.push('<div class="t-chat-ai">' + mark(14) + '<p>' + t + '</p></div>');
    const you = (t) => said.push('<div class="t-chat-you"><p>' + esc(t) + '</p></div>');
    const en = (t) => '<bdi lang="en">' + t + '</bdi>';
    ai(tr('Hi. I can take your application for <b>{role}</b> right here. Drop your CV in and I will read it; you only fill in what it does not say.',
      'أهلًا. أستطيع استلام طلبك لوظيفة <b>{role}</b> هنا مباشرة. أرفق سيرتك الذاتية وسأقرؤها، ولن تملأ إلا ما لا تذكره.', { role: en(esc(q.title)) }));
    let input = '';
    if (APPLY.step === 'hello') {
      input = '<label class="t-drop t-drop-sm" for="applyFile">' + svg('upload', 18) + '<b>' + tr('Attach your CV', 'أرفق سيرتك الذاتية') + '</b><span>' + tr('PDF or Word', 'ملف PDF أو Word') + '</span>' +
        '<input class="t-file" id="applyFile" type="file" accept=".pdf,.doc,.docx" data-apply-file></label>' +
        '<p class="t-acts"><button class="s-insight-lnk" type="button" data-apply-sample>' + tr('Use a sample CV', 'استخدم سيرة ذاتية تجريبية') + '</button></p>';
    } else if (APPLY.step === 'reading') {
      you(APPLY.file);
      const r = tr('Reading your CV', 'أقرأ سيرتك الذاتية');
      said.push('<div class="t-chat-ai">' + mark(14) + '<p><span class="t-shimmer" data-text="' + esc(r) + '">' + esc(r) + '</span></p></div>');
    } else {
      you(APPLY.file);
      const f = APPLY.f;
      ai(tr('Thanks, {first}. I read {years} of experience, now {at}.', 'شكرًا يا {first}. قرأت أن لديك خبرة {years}.', { first: esc(first(f.name)), years: yearsL(f.years), at: esc(lower(f.at)) }) +
        (APPLY.cv.phone ? '' : tr(' <b>Your CV has no phone number.</b> Add one so the recruiter can call you.', ' <b>لا يوجد رقم هاتف في سيرتك الذاتية.</b> أضف رقمًا ليتصل بك فريق التوظيف.')));
      if (APPLY.step === 'done') {
        ai(tr('Sent. A person on the recruiting team reads every application, and you will hear back either way.', 'تم الإرسال. يقرأ أحد أعضاء فريق التوظيف كل طلب، وسيصلك رد في كل الأحوال.'));
        input = '<div class="t-done">' + successCheck() + '<p>' + tr('Your own profile, to see where you stand and update your details:', 'ملفك الشخصي، لتعرف أين وصل طلبك وتحدّث بياناتك:') + '</p>' +
          '<p><b class="t-link-text" dir="ltr">' + esc(profileLink(DB.byId[APPLY.cand])) + '</b></p>' +
          '<p class="t-acts"><button class="s-insight-lnk primary" type="button"' + goAttr({ me: DB.byId[APPLY.cand].pid }) + '>' + tr('Open my profile', 'افتح ملفي') + '</button></p></div>';
      } else {
        input = '<div class="t-apply-form">' +
          '<label class="dial-cap" for="applyPhone">' + tr('Phone', 'الهاتف') + '</label><input class="dial-input" id="applyPhone" type="tel" dir="ltr" data-apply-in="phone" value="' + esc(f.phone || '') + '" placeholder="+20 10 1234 5678">' +
          '<label class="dial-cap" for="applyMail">' + tr('Email', 'البريد الإلكتروني') + '</label><input class="dial-input" id="applyMail" type="email" dir="ltr" data-apply-in="email" value="' + esc(f.email || '') + '">' +
          '<div class="t-input-wrap" id="wrapConsent"><div class="t-input">' +
            '<p class="t-q"><button class="t-check' + (APPLY.consent ? ' is-on' : '') + '" type="button" data-apply-consent="consent" aria-pressed="' + APPLY.consent + '" aria-label="' + esc(tr('Agree to the use of my CV', 'الموافقة على استخدام سيرتي الذاتية')) + '">' + (APPLY.consent ? svg('check', 12) : '') + '</button>' +
              '<span>' + tr('I agree to my CV and details being used for this application. A person decides; AiMY organises. <b>Required</b>',
                'أوافق على استخدام سيرتي الذاتية وبياناتي لهذا الطلب. يقرر أحد أعضاء الفريق، وتنظّم AiMY الخطوات. <b>مطلوب</b>') + '</span></p>' +
            '<p class="t-q"><button class="t-check' + (APPLY.wa ? ' is-on' : '') + '" type="button" data-apply-consent="wa" aria-pressed="' + APPLY.wa + '" aria-label="' + esc(tr('WhatsApp updates', 'التحديثات على واتساب')) + '">' + (APPLY.wa ? svg('check', 12) : '') + '</button>' +
              '<span>' + tr('Also update me on WhatsApp about this application. Optional.', 'أرسلوا لي التحديثات عن هذا الطلب على واتساب أيضًا. اختياري.') + '</span></p>' +
          '</div><p class="t-error-msg">' + tr('Tick the first box to send your application.', 'ضع علامة في المربع الأول لإرسال طلبك.') + '</p></div>' +
          '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-apply-send>' + tr('Send my application', 'أرسل طلبي') + '</button></p></div>';
      }
    }
    return outOpen('t-out-wide') + head +
      '<div class="t-careers">' +
        '<section class="t-out-card">' +
          '<p class="t-out-kicker">' + en(esc(q.level) + ' · ' + esc(q.place)) + ' · ' + (q.acc === 'flairs' ? 'FlairsTech' : tr('For a {d} client', 'لعميل في مجال {d}', { d: en(esc(q.domain.toLowerCase())) })) + '</p>' +
          '<h1 class="t-out-h" lang="en" dir="ltr">' + esc(q.title) + '</h1>' +
          '<p lang="en" dir="ltr">' + esc(String(q.desc || '').replace(/ for [A-Z][\w ]+, a /, ' for a ')) + '</p>' +
          '<h2 class="t-out-sub">' + tr('What we look for', 'ما نبحث عنه') + '</h2><ul class="t-out-list" lang="en" dir="ltr">' + q.must.map((m) => '<li>' + esc(m) + '</li>').join('') + '</ul>' +
          '<p class="b-vfoot">' + tr('No salary is published. The recruiter talks it through on the first call.', 'لا ننشر الراتب. يناقشه معك فريق التوظيف في أول مكالمة.') +
            (isAr() ? ' وصف الوظيفة بالإنجليزية كما كتبه فريق التوظيف.' : '') + '</p>' +
        '</section>' +
        '<section class="t-out-card t-chat" aria-label="' + esc(tr('Apply with AiMY', 'قدّم مع AiMY')) + '">' + said.join('') + input + '</section>' +
      '</div></div>';
  }
  function applyRead(fileName) {
    const q = DB.reqById[APPLY.req];
    const list = SAMPLE_CVS[q.fam];
    const cv = list[(fileName ? fileName.length : 1) % list.length];
    APPLY.cv = cv;
    APPLY.file = fileName || cv.file;
    APPLY.step = 'reading';
    paint();
    setTimeout(() => {
      if (!APPLY || APPLY.step !== 'reading') return;
      APPLY.step = 'review';
      APPLY.f = { name: cv.name, phone: cv.phone || '', email: cv.email, at: cv.at, years: cv.years, place: cv.place, langs: cv.langs, skills: cv.skills };
      paint();
    }, 1800);
  }
  function applySend() {
    if (!APPLY.consent) { shake('wrapConsent'); return; }
    const q = DB.reqById[APPLY.req];
    const f = APPLY.f;
    const dup = DB.cands.filter((c) => c.name === f.name)[0];
    const id = uid('k');
    const c = { id: id, pid: dup ? dup.pid : id, name: f.name, req: q.id, stage: 'applied', exit: null, since: 0, meet: null, fb: false, nudged: null,
      years: f.years, at: f.at, place: f.place, langs: f.langs, skills: f.skills, source: 'Applied through the link', ev: evFor(q.must, f), maxAt: 'applied',
      phone: String(f.phone || '').trim() || null, email: f.email, fate: 'pass', dnc: false, badNumber: false, callback: null, applied: 0, wa: APPLY.wa,
      summary: f.years + ' years, now ' + lower(f.at) + '.' };
    addCand(c);
    note(c, 'apply', 'Applied on the careers page with AiMY. Consent given' + (APPLY.wa ? ', WhatsApp updates on.' : '.'));
    APPLY.cand = c.id;
    APPLY.step = 'done';
    paint();
  }

  /* The candidate's own profile. A one-time code to their phone opens it
     (fixture: any six digits). They see where they stand in plain words,
     never a score; they can update what they told us, take a test sent to
     them, or withdraw. */
  let ME_OK = {};
  const PLAIN = { sourced: 'We would like to talk to you', applied: 'Received, a recruiter reads it next', assess: 'An assessment is waiting for you', phone: 'A recruiter will call you',
    hr: 'Interview with HR', tech: 'Technical interview', mgr: 'Interview with the manager', sent: 'Shared with the hiring team', client: 'Interview with the hiring team',
    ctech: 'Technical interview with the hiring team', offer: 'Offer stage', accepted: 'Offer accepted', joined: 'You have started' };
  const PLAIN_AR = { sourced: 'نود التحدث معك', applied: 'استلمنا طلبك، وسيقرؤه أحد أعضاء الفريق', assess: 'هناك تقييم في انتظارك', phone: 'سيتصل بك أحد أعضاء فريق التوظيف',
    hr: 'مقابلة مع الموارد البشرية', tech: 'مقابلة فنية', mgr: 'مقابلة مع المدير', sent: 'شاركنا ملفك مع فريق التوظيف', client: 'مقابلة مع فريق التوظيف',
    ctech: 'مقابلة فنية مع فريق التوظيف', offer: 'مرحلة العرض', accepted: 'قبلت العرض', joined: 'بدأت العمل' };
  function portalMe() {
    const list = DB.cands.filter((c) => c.pid === S.me);
    const head = outsideHead(tr('Your profile', 'ملفك الشخصي'), tr('FlairsTech careers', 'وظائف فليرز تك'), true);
    if (!list.length && D.gone.some((g) => g.pid === S.me)) return outOpen() + head + '<section class="t-out-card"><h1 class="t-out-h">' + tr('Your details are deleted', 'حُذفت بياناتك') + '</h1><p>' +
      tr('We keep only your name, on a do-not-contact line, so we never find or contact you again.', 'لا نحتفظ إلا باسمك في قائمة عدم التواصل، حتى لا نعثر عليك أو نتواصل معك مرة أخرى.') + '</p></section></div>';
    if (!list.length) return outOpen() + head + '<p class="s-none">' + tr('This link has expired.', 'انتهت صلاحية هذا الرابط.') + '</p></div>';
    const p = list[0];
    if (!ME_OK[S.me]) return outOpen() + head + '<section class="t-out-card">' +
      '<h1 class="t-out-h">' + tr('Hi {first}', 'أهلًا يا {first}', { first: esc(first(p.name)) }) + '</h1><p>' +
        tr('We sent a six-digit code to {to}. Enter it to open your profile.', 'أرسلنا رمزًا من ستة أرقام إلى {to}. أدخله لفتح ملفك.',
          { to: p.phone ? '<bdi dir="ltr">' + esc(p.phone.replace(/\d(?=\d{4})/g, '•')) + '</bdi>' : tr('your email', 'بريدك الإلكتروني') }) + '</p>' +
      '<div class="t-input-wrap" id="wrapCode"><input class="dial-input t-input t-code" id="meCode" type="text" inputmode="numeric" maxlength="6" dir="ltr" placeholder="' + esc(tr('6 digits', '٦ أرقام')) + '" aria-label="' + esc(tr('Code', 'الرمز')) + '">' +
      '<p class="t-error-msg">' + tr('That needs six digits.', 'الرمز ستة أرقام.') + '</p></div>' +
      '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-me-code>' + tr('Open my profile', 'افتح ملفي') + '</button></p>' +
      '<p class="b-vfoot">' + tr('This prototype accepts any six digits.', 'هذا النموذج يقبل أي ستة أرقام.') + '</p></section></div>';
    const send = (c) => DB.sends.filter((x) => x.cand === c.id && x.status === 'sent')[0];
    const pros = list.filter((c) => c.source === 'Found on the web' && c.stage === 'sourced' && !c.exit)[0];
    /* Where each application stands, in plain words, with the date they
       will hear by (M4). A decision nobody has told them yet still reads
       as waiting, with that date: the profile never breaks the news. */
    const stand = (c) => c.exit === 'withdrew' ? tr('You withdrew', 'سحبت طلبك')
      : c.exit === 'offerno' ? tr('You turned the offer down', 'رفضت العرض')
      : c.exit && c.told !== false ? tr('Not going further this time. Thank you for your time.', 'لن نكمل هذه المرة. شكرًا على وقتك.')
      : (isAr() ? PLAIN_AR[c.stage] : PLAIN[c.stage]) + (c.stage === 'joined' || c.stage === 'accepted' ? '' : '. ' + tr('You will hear from us by {d}.', 'سيصلك رد منا قبل {d}.', { d: sayDayL(hearBy(c)) }));
    return outOpen() + head +
      '<section class="t-out-card"><h1 class="t-out-h">' + esc(p.name) + '</h1><p lang="en" dir="ltr">' + esc(p.at) + '</p>' +
        /* A prospect found on the web has applied to nothing: what we hold,
           where it came from, and the one press that deletes it (R8). */
        (pros ? '<h2 class="t-out-sub">' + tr('Why you are hearing from us', 'لماذا نتواصل معك') + '</h2>' +
          '<p>' + tr('We found your public profile on {where}. We keep only your name, your current role and that page. You have not applied to anything.',
            'وجدنا ملفك العام على {where}. لا نحتفظ إلا باسمك ووظيفتك الحالية وتلك الصفحة. لم تتقدم لأي وظيفة.', { where: '<bdi dir="ltr">' + esc(pros.page ? pros.page + ', ' + pros.link : 'a public web page') + '</bdi>' }) + '</p>' +
          '<p class="t-acts"><button class="b-ghost" type="button" data-me-forget="' + pros.id + '">' + tr('Object and delete my details', 'أعترض، احذفوا بياناتي') + '</button></p>' : '') +
        '<h2 class="t-out-sub">' + tr('Your applications', 'طلباتك') + '</h2>' +
        list.map((c) => '<div class="t-me-app"><p><b lang="en">' + esc(reqOf(c).title) + '</b></p>' +
          '<p>' + esc(stand(c)) + '</p>' +
          (send(c) ? '<p class="t-acts"><button class="s-insight-lnk primary" type="button"' + goAttr({ take: send(c).id }) + '>' + tr('Take the assessment', 'ابدأ التقييم') + '</button></p>' : '') +
          (!c.exit && c.stage !== 'joined' && c.stage !== 'accepted' ? '<p class="t-acts"><button class="b-ghost" type="button" data-me-withdraw="' + c.id + '">' + tr('Withdraw this application', 'اسحب هذا الطلب') + '</button></p>' : '') +
        '</div>').join('') +
        '<h2 class="t-out-sub">' + tr('What you told us', 'ما أخبرتنا به') + '</h2>' +
        '<div class="t-apply-form">' +
          '<label class="dial-cap" for="mePhone">' + tr('Phone', 'الهاتف') + '</label><input class="dial-input" id="mePhone" type="tel" dir="ltr" data-me-in="phone" value="' + esc(p.phone || '') + '">' +
          '<label class="dial-cap" for="meMail">' + tr('Email', 'البريد الإلكتروني') + '</label><input class="dial-input" id="meMail" type="email" dir="ltr" data-me-in="email" value="' + esc(p.email || '') + '">' +
          '<label class="dial-cap" for="mePlace">' + tr('Where you live', 'مكان السكن') + '</label><input class="dial-input" id="mePlace" type="text" data-me-in="place" value="' + esc(p.place || '') + '">' +
          '<p class="t-q"><button class="t-check' + (p.wa ? ' is-on' : '') + '" type="button" data-me-wa aria-pressed="' + !!p.wa + '" aria-label="' + esc(tr('WhatsApp updates', 'التحديثات على واتساب')) + '">' + (p.wa ? svg('check', 12) : '') + '</button>' +
            '<span>' + tr('Send me updates on WhatsApp. You can turn this off any time.', 'أرسلوا لي التحديثات على واتساب. يمكنك إيقافها في أي وقت.') + '</span></p>' +
          '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-me-save>' + tr('Save my details', 'احفظ بياناتي') + '</button></p></div>' +
        '<p class="b-vfoot">' + tr('You can ask us to delete your profile at any time by replying to any message from us.', 'يمكنك أن تطلب حذف ملفك في أي وقت بالرد على أي رسالة منا.') + '</p>' +
      '</section></div>';
  }

  /* ══ AiMY IN THE BAR ═════════════════════════════════════════════════════
     The New Operations list asks for every record to be made through an
     agent as well as the interface. The bar reads what was typed and does
     it, answering in the card above itself (Sales's peek): open a
     requisition, find candidates, add one from a CV, draft an assessment,
     call someone, or say what needs you. Anything else is a search. */
  const actBtn = (a) => '<button class="s-insight-lnk' + (a.primary ? ' primary' : '') + '" type="button"' +
    (a.go ? goAttr(a.go) : ' data-' + a.data) + ' data-peek-close>' + esc(a.label) + '</button>';
  /* An answer to something asked is also a turn in that desk's thread, so
     the canvas holds every question and its answer. While the canvas is
     open the answer lands there instead of in the card. */
  function peek(html, acts) {
    if (ASKING) {
      const ch = chatFor();
      if (!ch.title) ch.title = ASKING.length > 56 ? ASKING.slice(0, 55) + '…' : ASKING;
      ch.turns.push({ who: 'you', html: esc(ASKING) }, { who: 'aimy', html: html, acts: acts || [] });
      ASKING = null;
      saveChats();
      if (canvasShown()) { paintThread(); return; }
      UNREAD++;
      paintBadge();
    }
    byId('peekBody').innerHTML = html;
    byId('peekActs').innerHTML = (acts || []).map(actBtn).join('');
    byId('aimyPeek').hidden = false;
  }
  const peekHide = () => { byId('aimyPeek').hidden = true; };

  /* ══ THE AIMY CANVAS (Sales) ═════════════════════════════════════════════
     The bar's answers, kept: one thread per conversation, the desk's
     conversations in the column beside it, and the openers when a thread is
     empty. Stored per browser like the rest of the delta, under its own key
     so Reset in the prototype panel does not need to know about it. */
  const CHAT_KEY = 'aimy-talent:chats';
  const CHATS = (function () { try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || []; } catch (e) { return []; } })();
  let CHAT_AT = null, ASKING = null, THINK = null, UNREAD = 0, THREAD_SEEN = 0;
  const saveChats = () => { try { localStorage.setItem(CHAT_KEY, JSON.stringify(CHATS.slice(-40))); } catch (e) {} };
  const chatNow = () => CHATS.filter((x) => x.id === CHAT_AT && x.desk === DESK)[0] || null;
  const canvasShown = () => byId('aimyOverlay').classList.contains('open');
  function chatFor() {
    let ch = chatNow();
    if (!ch) { ch = { id: uid('ch'), desk: DESK, title: '', turns: [] }; CHATS.push(ch); CHAT_AT = ch.id; }
    return ch;
  }
  const SUGG = {
    rec: ['What needs me today?', 'Which requisitions are at risk?', 'Where do we lose people?', 'How long to send the first profile?'],
    hm: ['What needs me today?', 'Which requisitions are at risk?', 'Where do we lose people?', 'Open a requisition for 2 Senior Accountants'],
    hr: ['Which requisitions are at risk?', 'Where do we lose people?', 'How long to send the first profile?', 'How many dropped at the HR interview?'],
    client: ['What needs me today?', 'We need two more support engineers'],
    bu: ['What needs me today?', 'Why do clients pass?', 'Which requisitions are at risk?', 'We need two more accountants'],
  };
  const msgAvatar = (who) => who === 'you'
    ? '<div class="msg-avatar user-av">' + esc(me().name.split(' ').map((w) => w[0]).join('').slice(0, 2)) + '</div>'
    : '<div class="msg-avatar aimy-av">' + mark(14) + '</div>';
  const turnBody = (t) => t.html || (t.kind === 'brief' ? briefHtml(t) : t.kind === 'readback' ? readbackHtml(t) : '');
  const turnHtml = (t) => t.who === 'you'
    ? '<div class="chat-msg user">' + msgAvatar('you') + '<div class="msg-bubble">' + t.html + '</div></div>'
    : '<div class="chat-msg aimy">' + msgAvatar('aimy') + '<div class="msg-bubble">' + turnBody(t) +
        (t.acts && t.acts.length ? '<p class="t-acts">' + t.acts.map(actBtn).join('') + '</p>' : '') + '</div></div>';
  function paintThread() {
    const host = byId('overlayThread'), ch = chatNow();
    const turns = ch ? ch.turns : [];
    if (!turns.length && !THINK) {
      THREAD_SEEN = 0;
      host.innerHTML = '<div class="overlay-suggestions">' + SUGG[me().fn].map((q) =>
        '<button class="overlay-sugg-chip" type="button" data-ask="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>';
    } else {
      host.innerHTML = turns.map(turnHtml).join('') + (THINK
        ? turnHtml({ who: 'you', html: esc(THINK) }) + '<div class="chat-msg aimy is-thinking">' + msgAvatar('aimy') +
          '<div class="msg-bubble"><span class="t-shimmer" data-text="Reading the requisitions">Reading the requisitions</span></div></div>' : '');
      if (turns.length > THREAD_SEEN && host.lastElementChild) host.lastElementChild.classList.add('b-arrive');
      THREAD_SEEN = turns.length;
      host.scrollTop = host.scrollHeight;
    }
    paintChats();
  }
  function paintChats() {
    const mine = CHATS.filter((x) => x.desk === DESK && x.turns.length).slice().reverse();
    byId('overlayChats').innerHTML =
      '<button class="btn btn-brand btn-sm ov-chat-new" type="button" data-newchat>' + svg('plus', 14) + 'New conversation</button>' +
      (mine.length ? '<div class="ov-chat-group"><div class="ov-chat-cap">Recent</div>' + mine.map((r) =>
        '<div class="ov-chat-row"><button class="ov-chat' + (r.id === CHAT_AT ? ' is-here' : '') + '" type="button" data-chat="' + r.id + '"' + (r.id === CHAT_AT ? ' aria-current="true"' : '') + '>' +
          '<span class="ov-chat-lines"><span class="ov-chat-name">' + esc(r.title || 'New conversation') + '</span></span></button>' +
        '<button class="ov-chat-more" type="button" data-chat-del="' + r.id + '" aria-label="Delete this conversation" title="Delete">' + svg('trash', 14) + '</button></div>').join('') + '</div>'
        : '<p class="ov-chat-none">Nothing yet. Ask AiMY something and it lands here.</p>');
  }
  function paintBasis() {
    const tags = [isHR() || isBU() ? 'Every requisition' : isClient() ? accOf(deskReqs()[0] || DB.reqs[0]).name + '’s requisitions' : 'Your requisitions'];
    if (S.req && DB.reqById[S.req]) tags.push(DB.reqById[S.req].title);
    if (S.cand && DB.byId[S.cand] && sees(DB.byId[S.cand])) tags.push(DB.byId[S.cand].name);
    byId('overlayContextTags').innerHTML = tags.map((t) => '<span class="overlay-context-tag">' + esc(t) + '</span>').join('');
  }
  function paintBadge() {
    const b = document.querySelector('#canvasOpen .float-badge');
    b.hidden = !UNREAD;
    b.textContent = UNREAD;
  }
  function openCanvas() {
    peekHide();
    UNREAD = 0; paintBadge();
    if (!chatNow()) { const last = CHATS.filter((x) => x.desk === DESK && x.turns.length).slice(-1)[0]; CHAT_AT = last ? last.id : null; }
    byId('aimyOverlay').classList.add('open');
    paintBasis();
    paintThread();
    if (CALL) paintCall();
    byId('overlayInput').focus();
  }
  function closeCanvas() {
    byId('aimyOverlay').classList.remove('open');
    chatsDrawer(false);
    if (CALL) paintCall();
  }
  function chatsDrawer(on) {
    byId('overlayChats').classList.toggle('is-open', on);
    byId('ovChatsScrim').classList.toggle('is-open', on);
    byId('ovChatsToggle').setAttribute('aria-expanded', String(on));
  }
  /* Asked in the canvas: the question shows at once with AiMY reading under
     it, then the answer replaces the reading. */
  /* `.is-generating` on the bar while AiMY reads is what voice.js listens
     for: the answer is finished when it leaves (Sales's beam contract). */
  function canvasAsk(text) {
    const t = String(text || '').trim();
    if (!t || THINK) return;
    if (PENDING) { byId('overlayInput').value = ''; callCorrect(t); return; }
    const bar = document.querySelector('.overlay-input-bar');
    byId('overlayInput').value = '';
    THINK = t;
    bar.classList.add('is-generating');
    paintThread();
    setTimeout(() => { THINK = null; ask(t); paintThread(); bar.classList.remove('is-generating'); }, 600);
  }
  /* "2 Senior Accountants at Northwind", "we need two more support
     engineers": the role, its level and how many, read from plain words. */
  const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  function parseRole(t) {
    const role = ROLES.filter((r) => t.toLowerCase().indexOf(r.title.toLowerCase()) >= 0)[0];
    const tail = '(?:(\\d+|a|an|one|two|three|four|five|six)\\s+)?(?:more\\s+)?(junior|mid-level|senior|manager)?\\s*([a-z][a-z0-9 ()&/+.-]*?)(?:\\s+(?:at|for|with|in|on|by|to|starting)\\s+.*)?[.!?]?$';
    const m = new RegExp('\\b(?:need|hire|hiring|want)\\s+' + tail, 'i').exec(t) || new RegExp('\\bfor\\s+' + tail, 'i').exec(t);
    const n = m && m[1] ? (NUMW[m[1].toLowerCase()] || Number(m[1])) : 1;
    let title = role ? role.title : m && m[3] ? m[3].replace(/\b(a |an |new |requisitions?|roles?|positions?|vacanc(y|ies)|people|hires?)\b/ig, ' ').replace(/\s+/g, ' ').trim() : '';
    if (!role && n > 1) title = title.replace(/ies$/i, 'y').replace(/([^s])s$/i, '$1');
    if (!role) title = title.split(' ').map((w) => /^(of|and|for|the|in)$/i.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const level = m && m[2] ? LEVELS.filter((l) => l.toLowerCase() === m[2].toLowerCase())[0] : role ? role.level : 'Mid-level';
    return { title: title, level: level, seats: n, role: role };
  }
  function ask(text) {
    ASKING = String(text || '').trim() || null;
    try { askNow(text); } finally { ASKING = null; }
  }
  function askNow(text) {
    const t = text.trim();
    if (!t) return;
    const lc = t.toLowerCase();
    const reqMatch = DB.reqs.filter((q) => q.state !== 'draft' && lc.indexOf(q.title.toLowerCase()) >= 0)[0];
    const accMatch = ACCOUNTS.filter((a) => lc.indexOf(a.name.toLowerCase().split(' ')[0]) >= 0)[0];
    if (/\bwhy\b.*\b(pass|passed|decline|declined|turn|reject)/.test(lc) && !isClient()) {
      const said = declines(deskReqs()).filter((c) => c.decline.day >= -90), counts = declineCounts(said);
      peek(counts.length ? 'Clients gave <b>' + plural(said.length, 'reason') + '</b> in 90 days, one per decision. ' + counts.slice(0, 3).map((x) => esc(x.d.label) + ' ' + x.n).join(', ') +
        '. Each feeds matching for its own client only.' : 'No client has passed with a reason yet.', [{ label: 'Open the reports', go: { on: 'reports' }, primary: true }]);
      return;
    }
    if ((isClient() || isBU()) && /\b(need|hire|hiring|request|another|more|want)\b/.test(lc)) { clientRequest(t); return; }
    if (/\b(open|new|create|start|raise|draft)\b.*\b(requisition|req|role|position|vacancy)\b|^(we need|i need|hire)\b/.test(lc) && !isClient()) {
      const p = parseRole(t);
      const q = newReq({ title: p.title, level: p.level, acc: accMatch ? accMatch.id : undefined, seats: p.seats });
      let known = true;
      if (q && p.title) {
        const f = { title: p.title, seats: q.seats, level: p.level };
        known = aiDraft(f);
        put('reqs', q, { must: f.must.split('\n'), desc: f.desc, fam: famOf(p.title), budget: { min: BUDGETS[p.level][0], max: BUDGETS[p.level][1] } });
        EDIT = null; paint();
      }
      peek(!q ? 'I could not draft it from this desk.' : p.title
        ? 'I drafted <b>' + esc(plural(q.seats, 'seat')) + ' as ' + esc(p.level.toLowerCase()) + ' ' + esc(p.title) + '</b>' + (accMatch ? ' for ' + esc(accMatch.name) : '') + ', with a description and a success profile' +
          (known ? ' from the roles like it filled before.' : '. Nothing like it was filled here before, so <b>check the success profile</b>.') + ' Open it when it reads right.'
        : 'I started a draft' + (accMatch ? ' for ' + esc(accMatch.name) : '') + '. Name the role and I can write the rest.', []);
      return;
    }
    /* Finding is a conversation (Sales B8): the canvas asks where to look,
       reads the success profile back, and brings back a draft shortlist. */
    if (/\b(find|search|source|look for|looking for)\b/.test(lc) && (isRec() || isHR())) {
      ASKING = null;
      findChat(reqMatch ? reqMatch.id : null, t);
      return;
    }
    if (/\b(add|upload)\b.*\b(cv|candidate|resume)\b/.test(lc) && (isRec() || isHR())) { go({ on: 'add', req: reqMatch ? reqMatch.id : undefined }); return; }
    if (/\b(assessment|test|quiz)\b/.test(lc) && /\b(draft|create|make|new|write)\b/.test(lc) && (isRec() || isHR())) { newAsmt(reqMatch ? reqMatch.id : null); return; }
    if (/^call\b/.test(lc) && isRec()) {
      const who = DB.cands.filter((c) => lc.indexOf(c.name.toLowerCase()) >= 0 || lc.indexOf(first(c.name).toLowerCase() + ' ') >= 0)[0];
      if (who && startCall(who.id)) { peekHide(); return; }
    }
    if (/what needs me|what is waiting|today|my day|waiting on me/.test(lc)) {
      if (isRec()) {
        const d = decisions(), tc = toCall(), m = missed();
        peek('<b>' + plural(d.length, 'decision') + '</b> wait on you, <b>' + plural(tc.length, 'person', 'people') + '</b> to call, and <b>' + plural(m.length, 'missed call') + '</b>.' +
          (d[0] ? ' The oldest decision is ' + esc(d[0].name) + ', ' + esc(lower(STAGE[d[0].stage].label)) + '.' : ''),
          [d[0] ? { label: 'Open ' + first(d[0].name), go: { cand: d[0].id }, primary: true } : null, tc.length ? { label: 'Call them in order', data: 'call-all' } : null].filter(Boolean));
      } else {
        const a = asks();
        peek(a.length ? '<b>' + plural(a.length, 'thing') + '</b> wait on you. First: ' + esc(a[0].head) + '.' : 'Nothing waits on you today.', a[0] ? [{ label: a[0].verb, go: a[0].go, primary: true }] : []);
      }
      return;
    }
    /* Questions about the work itself, answered from the same numbers the
       reports draw (the insights layer, asked in words). */
    if (/\b(risk|risky|late|behind|overdue)\b|miss(ing)? (its|their|the) (date|target)/.test(lc) && !isClient()) {
      const open = deskReqs().filter(isOpen), risky = open.filter((q) => health(q).risk);
      peek(risky.length ? '<b>' + risky.length + ' of ' + open.length + '</b> open requisitions are likely to miss their date. ' + risky.slice(0, 3).map((q) => {
        const h = health(q);
        return esc(q.title) + ' (' + (h.left >= 0 ? days(h.left) + ' left' : days(-h.left) + ' past the target') + ', ' + (h.furthest === 'sourced' || h.furthest === 'applied' ? 'nobody screened yet' : 'furthest at ' + esc(STAGE[h.furthest].label)) + ')';
      }).join('; ') + (risky.length > 3 ? '; and ' + (risky.length - 3) + ' more.' : '.')
        : 'All ' + plural(open.length, 'open requisition') + ' are on course.', risky.length ? [{ label: 'See them', go: { on: 'reqs', q: 'risk' }, primary: true }] : []);
      return;
    }
    if (/\b(drop|drops|dropped|dropping|leak|lose|losing|lost|funnel|fall|falls|stuck)\b/.test(lc) && !isClient()) {
      const asked = STAGE_ORDER.filter((k) => lc.indexOf(STAGE[k].label.toLowerCase()) >= 0)
        .sort((a, b) => STAGE[b].label.length - STAGE[a].label.length)[0];
      const reqs = deskReqs().filter((q) => q.state !== 'draft');
      const tot = {};
      reqs.forEach((q) => { const f = funnel(q); f.forEach((x, i) => { if (i === f.length - 1) return; const s = tot[x.k] || (tot[x.k] = { n: 0, m: 0 }); s.n += x.n; s.m += f[i + 1].n; }); });
      const rows = Object.keys(tot).filter((k) => tot[k].n >= 5 && k !== 'sourced');
      const pick = asked && tot[asked] ? asked : rows.sort((a, b) => tot[a].m / tot[a].n - tot[b].m / tot[b].n)[0];
      if (!pick) { peek('Too few people have moved yet to say where they drop.', []); return; }
      const x = tot[pick];
      peek((asked ? 'At ' : 'The biggest drop comes after ') + '<b>' + esc(STAGE[pick].label) + '</b>: ' + x.m + ' of ' + x.n + ' who reached it went on to the next stage (' +
        Math.round(x.m / x.n * 100) + '%), across ' + plural(reqs.length, 'requisition') + '.', [{ label: 'Open the reports', go: { on: 'reports' }, primary: true }]);
      return;
    }
    if (/\b(how long|time to|average|days to|how fast)\b/.test(lc) && !isClient()) {
      const reqs = deskReqs().filter((q) => q.state !== 'draft'), a = avgSent(reqs);
      peek(a != null ? 'On average it takes <b>' + days(a) + '</b> from opening a requisition to sending the first profile, across ' + plural(reqs.length, 'requisition') + '.'
        : 'No profile has been sent yet, so there is no time to report.', [{ label: 'Open the reports', go: { on: 'reports' }, primary: true }]);
      return;
    }
    /* A search: names first, then requisitions. */
    const people = DB.cands.filter((c) => sees(c) && c.name.toLowerCase().indexOf(lc) >= 0 && (isHR() || deskReqs().indexOf(reqOf(c)) >= 0));
    const reqs = deskReqs().filter((q) => (q.title + ' ' + accOf(q).name).toLowerCase().indexOf(lc) >= 0);
    if (people.length === 1 && !reqs.length) { go({ cand: people[0].id }); peekHide(); return; }
    if (!people.length && !reqs.length) { peek('Nothing matches “' + esc(t) + '”. Try a name, a role or an account, or ask me to open a requisition or find candidates.', []); return; }
    peek('<b>' + plural(people.length, 'candidate') + '</b> and <b>' + plural(reqs.length, 'requisition') + '</b> match “' + esc(t) + '”.',
      [people[0] ? { label: 'Open ' + people[0].name, go: { cand: people[0].id }, primary: true } : null, { label: 'See the requisitions', go: { on: 'reqs', find: t } }].filter(Boolean));
  }

  /* After every paint: the accordions keep their state across a repaint
     only where a person opened them, so nothing to do there; the reveal
     classes are added a frame late so the transition has a start. */
  function afterPaint() {
    document.querySelectorAll('.t-reveal').forEach((el) => { void el.offsetWidth; el.classList.add('is-revealed'); });
  }

  /* ══ REQUISITIONS: CREATE, EDIT, PUBLISH, CLOSE ═════════════════════════
     Through the interface or through AiMY (New Operations list). A new one
     starts as a draft; Open puts it live. Prose sits behind Edit, atomic
     things (published, on hold) are one press on the record with Undo. */
  let EDIT = null;
  function editBuf(kind, rec, init) {
    if (!EDIT || EDIT.kind !== kind || EDIT.id !== rec.id) EDIT = { kind: kind, id: rec.id, f: init() };
    return EDIT.f;
  }
  const ROLE_BLURB = {
    support: 'You will answer customers by ticket and phone, work out what broke, and fix it or hand it on with everything the next person needs.',
    finance: 'You will keep the books straight for a growing client: invoices, collections, reconciliations and a clean month-end close.',
    ops: 'You will keep the work moving: write down how things are done, spot what slows the team, and fix it with them.',
  };
  const LEVELS = ['Junior', 'Mid-level', 'Senior', 'Manager'];
  const BUDGETS = { Junior: [14000, 20000], 'Mid-level': [20000, 32000], Senior: [32000, 48000], Manager: [40000, 60000] };
  const famOf = (title) => /account|ledger|payable|receivable|financ|payroll|audit/i.test(title) ? 'finance'
    : /operation|analyst|process|coordinator/i.test(title) ? 'ops' : 'support';
  const canEditReq = (q) => !isClient() && (isRec() || isHR() || (isHM() && q.hm === DESK));
  const money = (n) => 'EGP ' + Number(n).toLocaleString('en-US');

  /* A new requisition's date starts where its stages can actually finish,
     rounded to a week, so it is not at risk the day it opens. */
  function expDays(tpl) {
    const t = TEMPLATE[tpl];
    let n = 0;
    for (let i = 0; i < t.indexOf('accepted'); i++) n += STAGE[t[i]].exp;
    return Math.max(30, Math.ceil(n / 7) * 7);
  }
  function newReq(o) {
    o = o || {};
    if (isClient()) return;
    const acc = ACCOUNTS.filter((a) => a.id === (o.acc || (isHM() ? (ACCOUNTS.filter((x) => x.hm === DESK)[0] || {}).id : 'northwind')))[0] || ACCOUNTS[0];
    const title = o.title || '';
    const fam = o.fam || famOf(title);
    const level = o.level || 'Mid-level';
    const q = {
      id: uid('r'), title: title, fam: fam, level: level, must: o.must || [], acc: acc.id, tpl: acc.tpl, hm: acc.hm,
      rec: isRec() ? DESK : 'omar', seats: o.seats || 1, kind: o.kind || 'new', billable: acc.id !== 'flairs',
      state: 'draft', opened: 0, target: o.target || expDays(acc.tpl), place: o.place || 'Nasr City office', plan: null,
      domain: acc.domain, published: false, budget: { min: BUDGETS[level][0], max: BUDGETS[level][1] },
      desc: o.desc || '', asmt: TEMPLATE[acc.tpl].indexOf('assess') >= 0 ? (fam === 'finance' ? 'a3' : fam === 'ops' ? 'a4' : 'a1') : null,
      askedBy: DESK,
    };
    make('reqs', q);
    EDIT = null;
    go({ req: q.id });
    return q;
  }
  function cloneReq(q) {
    const c = newReq({ acc: q.acc, title: q.title, fam: q.fam, level: q.level, must: q.must.slice(), seats: q.seats,
      kind: 'replacement', place: q.place, desc: q.desc });
    if (c) toast('Cloned ' + q.title, null, 'A draft with the same profile. Change what is different, then open it.');
  }
  /* AiMY drafts the description and the success profile from the title,
     the level and similar roles filled before. */
  /* Returns false when nothing like the title was filled before: AiMY then
     writes from the title alone and says so, rather than borrowing a
     support profile for a role that is not support. */
  function aiDraft(f) {
    const title = String(f.title || '').trim();
    const exact = ROLES.filter((x) => x.title.toLowerCase() === title.toLowerCase())[0];
    const known = !title || exact || /support|help ?desk|agent/i.test(title) || famOf(title) !== 'support';
    const lead = (n) => (f.seats === 1 || n === 1 ? 'a ' : f.seats + ' people as ');
    if (!known) {
      f.must = [(f.level === 'Senior' || f.level === 'Manager' ? '5+' : f.level === 'Junior' ? '1+' : '3+') + ' years as a ' + title,
        'Shows the core skills of the role in work they can point to', 'Fluent English, spoken and written', 'Works well with a remote client team'].join('\n');
      f.desc = 'We are hiring ' + lead() + title + '. You will join the team as one of them and own your part of the work from the first week.';
      return false;
    }
    const role = exact || ROLES.filter((x) => x.fam === famOf(title))[0];
    f.must = role.must.join('\n');
    f.desc = 'We are hiring ' + lead() + (title || role.title) + '. ' + ROLE_BLURB[famOf(title || role.title)];
    if (!title) f.title = role.title;
    return true;
  }

  function reqActs(q) {
    if (isClient()) return '';
    return '<span class="b-draft-acts">' +
      (canEditReq(q) ? '<button class="b-ghost" type="button" data-edit-req="' + q.id + '">Edit</button>' : '') +
      '<button class="b-ghost" type="button" data-clone="' + q.id + '">Clone it</button>' +
      (isRec() || isHR() ? '<button class="b-ghost" type="button"' + goAttr({ on: 'find', req: q.id }) + '>Find candidates</button>' +
        '<button class="b-ghost" type="button"' + goAttr({ on: 'add', req: q.id }) + '>Add a candidate</button>' : '') +
    '</span>';
  }
  const jobLink = (q) => 'talent.flairstech.com/jobs/' + q.id;

  /* Where the requisition is posted, what state it is in, and who works it. */
  function reqStrip(q) {
    const closed = !!CLOSED[q.state];
    const a = q.asmt ? asmtOf(q.asmt) : null;
    const rec = RECRUITERS.filter((x) => x.id === q.rec)[0];
    return '<section class="s-block s-block-wide" aria-label="Posting and state">' +
      '<div class="b-cmeta t-strip">' +
        '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">On the careers page</h2><div class="b-cmeta-say">' +
          (q.published
            ? '<p class="b-cmeta-p"><b class="t-link-text">' + esc(jobLink(q)) + '</b></p><p class="b-cmeta-p">Anyone with the link can read it and apply. Post it on LinkedIn as it is.</p>' +
              '<p class="b-cmeta-p t-acts"><button class="s-insight-lnk" type="button" data-copy="' + esc('https://' + jobLink(q)) + '">Copy the link</button>' +
              '<button class="s-insight-lnk" type="button"' + goAttr({ apply: q.id }) + '>Open the page</button>' +
              (closed ? '' : '<button class="b-ghost" type="button" data-publish="' + q.id + '">Unpublish</button>') + '</p>'
            : '<p class="b-cmeta-p">Not published. Nobody outside the team can see it.</p>' +
              (closed ? '' : '<p class="b-cmeta-p t-acts"><button class="s-insight-lnk primary" type="button" data-publish="' + q.id + '">Publish it</button></p>')) +
        '</div></div>' +
        '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">State</h2><div class="b-cmeta-say">' +
          '<p class="b-cmeta-p"><b>' + esc(REQ_STATE[q.state].label) + '</b>' + (q.state === 'open' ? ' since ' + esc(sayDay(q.opened)) : '') + '</p>' +
          (canEditReq(q) ? '<p class="b-cmeta-p t-acts">' +
            (q.state === 'open' ? '<button class="b-ghost" type="button" data-req-state="' + q.id + '|hold">Put on hold</button>' : '') +
            (q.state === 'hold' || closed ? '<button class="b-ghost" type="button" data-req-state="' + q.id + '|open">Reopen</button>' : '') +
            (!closed ? '<span class="b-menu-wrap"><button class="b-ghost b-menu-open" type="button" data-pickopen="closeMenu' + q.id + '" aria-haspopup="menu">Close it' + svg('down', 14) + '</button>' +
              '<div class="b-menu" id="closeMenu' + q.id + '" role="menu" hidden>' +
                [['filled', 'Filled'], ['cclient', 'Cancelled by the client'], ['cmgr', 'Cancelled by the manager']].map((x) =>
                  '<button class="b-menu-item" type="button" role="menuitem" data-req-state="' + q.id + '|' + x[0] + '"><span class="b-menu-name">' + x[1] + '</span></button>').join('') +
              '</div></span>' : '') + '</p>' : '') +
        '</div></div>' +
        '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Recruiter</h2><div class="b-cmeta-say">' +
          '<p class="b-cmeta-p"><b>' + esc(rec ? rec.name : 'Not assigned') + '</b></p>' +
          (isHR() ? '<p class="b-cmeta-p t-acts">' + assignMenu(q) + '</p>' : '') +
        '</div></div>' +
        (a ? '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Assessment</h2><div class="b-cmeta-say">' +
          '<p class="b-cmeta-p"><button class="t-inline-link" type="button" data-asmt="' + a.id + '">' + esc(a.title) + '</button></p>' +
          '<p class="b-cmeta-p">' + (a.kind === 'live' ? 'A live interview with the AiMY agent' : 'A questionnaire') + ', before the phone screen. Pass mark ' + a.pass + '%.</p>' +
        '</div></div>' : '') +
      '</div>' +
    '</section>';
  }

  /* THE HR MANAGER ASSIGNS, with AiMY's pick and its reason (Sales's CEO
     desk: Assign, a menu of every person with what they already carry). */
  function assignMenu(q) {
    const load = (id) => DB.reqs.filter((x) => x.rec === id && isOpen(x)).length;
    const pickId = RECRUITERS.filter((x) => x.id !== q.rec).sort((a, b) => load(a.id) - load(b.id))[0].id;
    return '<span class="b-menu-wrap"><button class="b-ghost b-menu-open" type="button" data-pickopen="asgn' + q.id + '" aria-haspopup="menu">Reassign' + svg('down', 14) + '</button>' +
      '<div class="b-menu" id="asgn' + q.id + '" role="menu" hidden><span class="b-menu-cap">Open requisitions each carries</span>' +
        RECRUITERS.map((x) => '<button class="b-menu-item' + (x.id === q.rec ? ' is-on' : '') + '" type="button" role="menuitem" data-assign="' + q.id + '|' + x.id + '">' +
          '<span class="b-menu-name">' + esc(x.name) + (x.id === pickId ? ' · AiMY’s pick' : '') + '</span><span class="tel-menu-cc">' + load(x.id) + '</span></button>').join('') +
      '</div></span>';
  }

  /* The editor. One page for a draft and for Edit on a live requisition. */
  function reqEditPage(q) {
    const isDraft = q.state === 'draft';
    const f = editBuf('req', q, () => ({ title: q.title, desc: q.desc || '', must: q.must.join('\n'), level: q.level, seats: q.seats,
      target: q.target, place: q.place, acc: q.acc, tpl: q.tpl, bmin: q.budget ? q.budget.min : '', bmax: q.budget ? q.budget.max : '',
      kind: q.kind, billable: q.billable, asmt: q.asmt || null }));
    const chip = (k, v, label) => '<button class="filter-chip' + (String(f[k]) === String(v) ? ' active' : '') + '" type="button" data-set="' + k + '|' + v + '">' + esc(label) + '</button>';
    const stepper = (k, step, say) => '<span class="t-step"><button class="b-ghost" type="button" data-step="' + k + '|' + (-step) + '" aria-label="Less">−</button>' +
      '<b class="t-step-n">' + esc(say) + '</b><button class="b-ghost" type="button" data-step="' + k + '|' + step + '" aria-label="More">+</button></span>';
    const part = (cap, body, wide) => '<div class="b-cmeta-part' + (wide ? ' t-wide' : '') + '"><h2 class="b-cmeta-cap">' + esc(cap) + '</h2><div class="b-cmeta-say">' + body + '</div></div>';
    const hasAssess = TEMPLATE[f.tpl].indexOf('assess') >= 0;
    return '<div class="s-home">' +
      '<div class="b-topbar s-block-wide">' +
        (isDraft ? '<button class="s-back" type="button" data-trail>' + svg('back', 14) + 'Back</button>'
          : '<button class="s-back" type="button" data-cancel-edit>' + svg('back', 14) + 'Back to the requisition</button>') +
        '<span class="b-draft-acts">' +
          (isDraft ? '<button class="b-ghost" type="button" data-discard-req="' + q.id + '">Discard the draft</button>' +
              '<button class="btn btn-brand btn-sm" type="button" data-open-req="' + q.id + '">Open the requisition</button>'
            : '<button class="b-ghost" type="button" data-cancel-edit>Cancel</button>' +
              '<button class="btn btn-brand btn-sm" type="button" data-save-edit="' + q.id + '">Save</button>') +
        '</span></div>' +
      '<section class="s-rec-head s-block-wide">' +
        '<span class="s-rec-kind b-kinds">' + fact('req', isDraft ? 'New requisition' : 'Editing the requisition') + '</span>' +
        '<div class="t-input-wrap" id="wrapTitle"><input class="b-draft-name t-input" type="text" data-ed="title" value="' + esc(f.title) + '" ' +
          'placeholder="Name the role, like Technical Support Engineer" aria-label="Role title" spellcheck="false">' +
          '<p class="t-error-msg">Give the role a name first.</p></div>' +
        '<div class="b-cmeta t-edit-grid">' +
          part('Account', (isDraft || isHR() ? ACCOUNTS.map((a) => chip('acc', a.id, a.name)).join('') : '<p class="b-cmeta-p"><b>' + esc(accOf(q).name) + '</b></p>'), true) +
          part('Level', LEVELS.map((l) => chip('level', l, l)).join('')) +
          part('Seats', stepper('seats', 1, plural(f.seats, 'seat'))) +
          part('Target date', stepper('target', 7, sayDay(f.target)) + '<p class="b-cmeta-p">' + days(Math.max(0, f.target)) + ' from today</p>') +
          part('Replacement or new', chip('kind', 'replacement', 'Replacement') + chip('kind', 'new', 'New role')) +
          part('Billing', chip('billable', true, 'Billable') + chip('billable', false, 'Not billable')) +
          part('Where', '<input class="b-draft-in" type="text" data-ed="place" value="' + esc(f.place) + '" aria-label="Where the job is">') +
          part('Budget, EGP a month', '<span class="t-range"><input class="b-draft-in t-num" type="text" inputmode="numeric" data-ed="bmin" value="' + esc(f.bmin) + '" aria-label="Lowest">' +
            '<span>to</span><input class="b-draft-in t-num" type="text" inputmode="numeric" data-ed="bmax" value="' + esc(f.bmax) + '" aria-label="Highest"></span>') +
          part('Stages', Object.keys(TEMPLATE).map((k) => chip('tpl', k, TEMPLATE_NAME[k] || k)).join('') +
            '<p class="b-cmeta-p">' + esc(TEMPLATE[f.tpl].filter((k) => k !== 'joined').map((k) => STAGE[k].label).join(' → ')) + '</p>', true) +
          (hasAssess ? part('Assessment', DB.asmts.map((a) => chip('asmt', a.id, a.title)).join(''), true) : '') +
        '</div>' +
        '<div class="b-cmeta b-said">' +
          '<div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">About the role</span>' +
            '<button class="b-draft-ai" type="button" data-ai-draft>' + mark(12) + 'Write it with AiMY</button></div>' +
            '<div class="b-cmeta-say"><textarea class="b-draft-in b-draft-area t-area" rows="3" data-ed="desc" aria-label="About the role" placeholder="What the person will do, in two or three sentences">' + esc(f.desc) + '</textarea></div></div>' +
          '<div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">Success profile, one must-have per line</span></div>' +
            '<div class="b-cmeta-say t-input-wrap" id="wrapMust"><textarea class="b-draft-in b-draft-area t-area t-input" rows="5" data-ed="must" aria-label="Must-haves" placeholder="2+ years of L2 software support">' + esc(f.must) + '</textarea>' +
            '<p class="t-error-msg">Add at least one must-have. Candidates are read against these.</p></div></div>' +
        '</div>' +
      '</section>' +
      aimyBlock({ text: isDraft ? 'Nothing goes live until you open it, and it stays off the careers page until somebody publishes it.' : 'Saving changes the requisition for everyone on it. Candidates are re-read against a changed success profile.', from: 'how requisitions work' }) +
    '</div>';
  }
  /* The editor's buffer, back onto the requisition. */
  function reqFromBuf(q, f) {
    const must = String(f.must).split('\n').map((x) => x.trim()).filter(Boolean);
    const acc = ACCOUNTS.filter((a) => a.id === f.acc)[0];
    return { title: String(f.title).trim(), desc: String(f.desc).trim(), must: must, level: f.level, seats: f.seats, target: f.target,
      place: f.place, acc: f.acc, hm: acc.hm, domain: acc.domain, tpl: f.tpl, kind: f.kind, billable: f.billable === true || f.billable === 'true',
      fam: famOf(f.title), asmt: TEMPLATE[f.tpl].indexOf('assess') >= 0 ? (f.asmt || 'a1') : null,
      budget: { min: Number(String(f.bmin).replace(/\D/g, '')) || BUDGETS[f.level][0], max: Number(String(f.bmax).replace(/\D/g, '')) || BUDGETS[f.level][1] } };
  }
  /* A field that is wrong shakes and says why (transitions.dev error
     shake), then settles back on its own. */
  function shake(wrapId) {
    const wrap = byId(wrapId);
    if (!wrap) return;
    const input = wrap.querySelector('.t-input');
    wrap.classList.add('is-error');
    input.classList.add('is-error');
    input.classList.remove('is-shaking');
    void input.offsetWidth;
    input.classList.add('is-shaking');
    setTimeout(() => input.classList.remove('is-shaking'), 300);
    clearTimeout(wrap._revert);
    wrap._revert = setTimeout(() => { wrap.classList.remove('is-error'); input.classList.remove('is-error'); }, 3300);
    input.focus();
  }
  function saveReq(q, open) {
    const f = EDIT.f;
    const v = reqFromBuf(q, f);
    if (!v.title) { shake('wrapTitle'); return; }
    if (!v.must.length) { shake('wrapMust'); return; }
    const before = JSON.parse(JSON.stringify({ title: q.title, desc: q.desc, must: q.must, level: q.level, seats: q.seats, target: q.target,
      place: q.place, acc: q.acc, hm: q.hm, domain: q.domain, tpl: q.tpl, kind: q.kind, billable: q.billable, fam: q.fam, asmt: q.asmt, budget: q.budget, state: q.state, opened: q.opened }));
    if (open) Object.assign(v, { state: 'open', opened: 0, target: v.target > 0 ? v.target : 30 });
    put('reqs', q, v);
    /* Candidates already on it are read again against the new profile. */
    DB.byReq[q.id].forEach((c) => { if (c.ev.length !== q.must.length) write(c, { ev: q.must.map((m, i) => c.ev[i] || 'n') }); });
    EDIT = null;
    go({ req: q.id }, true);
    toast(open ? 'Opened ' + q.title : 'Saved', () => { put('reqs', q, before); paint(); },
      open ? 'It is live for the team and not on the careers page yet. Publish it when you want applications.' : null);
  }
  function setReqState(q, k) {
    const before = { state: q.state, published: q.published };
    const f = { state: k };
    if (CLOSED[k]) f.published = false;
    put('reqs', q, f);
    paint();
    toast(k === 'open' ? 'Reopened' : k === 'hold' ? 'Put on hold' : 'Closed: ' + REQ_STATE[k].label.toLowerCase(),
      () => { put('reqs', q, before); paint(); }, CLOSED[k] ? 'Taken off the careers page. Candidates still on it are told by a person, not by AiMY.' : null);
  }

  /* ── ONE ACCOUNT ── Sales's account record, as a client account: what
     they asked for, what we sent, and how much of it they took. */
  function accPage() {
    const a = ACCOUNTS.filter((x) => x.id === S.acc)[0] || ACCOUNTS[0];
    const reqs = DB.reqs.filter((q) => q.acc === a.id && q.state !== 'draft');
    const open = reqs.filter(isOpen);
    const cands = reqs.reduce((l, q) => l.concat(DB.byReq[q.id]), []);
    const sent = cands.filter((c) => { const q = reqOf(c); return rank(q, 'sent') >= 0 && rank(q, c.maxAt) >= rank(q, 'sent'); }).length;
    const met = cands.filter((c) => { const q = reqOf(c); return rank(q, 'client') >= 0 && rank(q, c.maxAt) >= rank(q, 'client'); }).length;
    const hm = HMS.filter((h) => h.id === a.hm)[0];
    const avg = avgSent(reqs);
    const n = (k) => reqs.filter((q) => q.state === k).length;
    return '<div class="s-home">' +
      '<div class="b-topbar s-block-wide"><button class="s-back" type="button" data-trail>' + svg('back', 14) + 'Back</button>' +
        (canEditReq({ hm: a.hm }) || isRec() || isHR() ? '<span class="b-draft-acts"><button class="b-ghost" type="button" data-new-req="' + a.id + '">New requisition</button></span>' : '') + '</div>' +
      '<section class="s-rec-head s-block-wide">' +
        '<span class="s-rec-kind b-kinds">' + fact('acc', 'Account') + fact('job', a.domain) + fact('cal', 'Client since ' + a.since) + '</span>' +
        '<div class="s-rec-title"><h1 class="s-rec-name">' + esc(a.name) + '</h1></div>' +
        '<div class="b-cmeta">' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Account manager</h2><div class="b-cmeta-say"><p class="b-cmeta-p"><b>' + esc(hm ? hm.name : '') + '</b></p></div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Stages they run</h2><div class="b-cmeta-say"><p class="b-cmeta-p">' + esc(TEMPLATE_NAME[a.tpl]) + '</p></div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Requests</h2><div class="b-cmeta-say"><p class="b-cmeta-p"><b>' + reqs.length + '</b>: ' +
            open.length + ' open, ' + (n('filled') + n('started')) + ' filled, ' + n('cclient') + ' cancelled by them, ' + n('hold') + ' on hold</p></div></div>' +
          (accRule(a.id) ? '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Learned from their declines</h2><div class="b-cmeta-say"><p class="b-cmeta-p">' + esc(accRule(a.id).rule) + '</p>' +
            '<p class="b-cmeta-p">Approved by ' + esc(DESKS[accRule(a.id).decidedBy] ? DESKS[accRule(a.id).decidedBy].name : 'the HR Manager') + '. ' + esc(a.name) + ' only.</p></div></div>' : '') +
        '</div>' +
      '</section>' +
      (sent ? '<section class="s-insight is-lead s-block-wide" aria-label="How much they take">' +
        '<div class="s-lead-mark"><svg class="s-insight-mark" viewBox="0 0 18 20" width="14" height="14" aria-hidden="true"><use href="#aimy-logo-small"/></svg><span class="work-state ws-detected">Read off the record</span></div>' +
        '<div class="s-lead-line"><span class="s-lead-n">' + met + '</span><span class="s-lead-say">of the <span class="s-lead-of">' + sent + '</span> profiles we sent got a client interview.</span></div>' +
        '<p class="s-lead-deck">' + (avg != null ? 'It takes ' + days(avg) + ' on average to send their first profile on a requisition.' : '') + '</p></section>' : '') +
      outcomeStrip(a.id, false) +
      reasonsBlock(accDeclines(a.id, 90), a.name, a.id) +
      '<section class="s-block s-block-wide"><div class="s-camp-list-head"><h2 class="s-block-h">Open requisitions</h2><span class="s-block-say">' + open.length + '</span></div>' +
        (open.length ? '<div class="b-grid">' + open.map((q, i) => '<div class="b-slot">' + reqCard(q, i) + '</div>').join('') + '</div>' : '<p class="s-none">Nothing open for them right now.</p>') +
      '</section>' +
    '</div>';
  }

  /* ── The prototype panel: not product UI. ── */
  function paintProto() {
    const p = byId('protoPanel');
    if (p.hidden) return;
    p.innerHTML = '<div class="proto-sec">' +
        '<div class="proto-h">Incoming calls</div>' +
        '<button class="proto-link" type="button" data-ring="known">A candidate calls in</button>' +
        '<button class="proto-link" type="button" data-ring="named">A stranger calls in, and says who they are</button>' +
        '<button class="proto-link" type="button" data-ring="anon">A stranger calls in, and will not say</button>' +
        '<button class="proto-link" type="button" data-quiet>' + (UI.quiet ? 'Sound on' : 'Sound off') + '</button>' +
      '</div>' +
      /* AiMY coaching a run: the habit the recruiter's calls carry, for the demo. */
      '<div class="proto-sec">' +
        '<div class="proto-h">AiMY coaching a run</div>' +
        [['', 'The run picks one'], ['greet', 'No hello'], ['talk', 'Talks over them'], ['rush', 'Rushes the goodbye'], ['none', 'Nothing to coach']].map((x) =>
          '<button class="proto-link" type="button" data-coachset="' + x[0] + '" aria-pressed="' + (COACH_FORCE === x[0]) + '">' + esc(x[1]) + '</button>').join('') +
      '</div>' +
      '<div class="proto-sec">' +
        '<div class="proto-h">Sample data · ' + DB.reqs.length + ' requisitions, ' + DB.cands.length + ' candidates, ' + DB.calls.length + ' calls</div>' +
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

  /* A SECTION'S HEADING IS THE EYEBROW (the research components): a caps
     label led by its icon, the icon chosen from what the heading names. */
  const CAP_ICO = [[/interview/i, 'mic'], [/offer/i, 'job'], [/call/i, 'phone'], [/proposal|learning/i, 'loop'], [/assessment|question|result/i, 'clip'],
    [/passed|why/i, 'listc'], [/funnel|how far|by role|by account|by recruiter|load/i, 'bars'], [/feedback|told|waiting|miss/i, 'clock'],
    [/AiMY may do/i, 'shield'], [/add a candidate/i, 'plus'], [/hiring with us/i, 'acc'], [/request|requisition/i, 'req'],
    [/candidate|profile|who is on|people|application|shortlist/i, 'users']];
  /* THE WAY HOME FROM ANYWHERE. A list page carries Today in its switcher;
     a record (a candidate, a requisition, an account, a test) had only
     Back, which goes one step and can lead deeper. Every page's top bar
     now starts with Today, one press to the desk's front page. */
  const homeCrumb = (html) => html.replace(/<div class="b-topbar s-block-wide">/g, (m, at) =>
    /* Where Back already leads to Today, it is the way home on its own. */
    html.slice(at, at + 600).indexOf('Back to Today</button>') >= 0 ? m
      : m + '<button class="s-back t-home" type="button" data-home>' + svg('home', 14) + 'Today</button><span class="t-crumb" aria-hidden="true">/</span>');
  const capIcons = (html) => html.replace(/<h2 class="s-block-h">([^<]*)/g, (m, t) =>
    '<h2 class="s-block-h">' + svg((CAP_ICO.filter((x) => x[0].test(t))[0] || [0, 'listc'])[1], 14) + t);
  function paint() {
    /* Somebody outside the team gets the page alone, with none of the
       product's chrome (the careers page, a profile, a test, a debrief). */
    document.body.classList.toggle('is-portal', outside());
    if (outside()) {
      byId('wbStage').innerHTML = S.apply ? portalApply() : S.me ? portalMe() : S.take ? portalTake()
        : S.debrief ? debriefPage() : approvePage();
      requestAnimationFrame(afterPaint);
      return;
    }
    paintWho();
    /* A client opening a profile sent to them is the sendout's Opened. */
    const seen = isClient() && S.cand ? DB.byId[S.cand] : null;
    if (seen && sees(seen) && seen.stage === 'sent' && !seen.exit && seen.openDay == null) {
      write(seen, { openDay: 0 });
      note(seen, 'note', 'Opened by ' + me().name + '.');
    }
    /* Adding someone carries the requisition they are for, so it is asked
       before the requisition's own page. */
    byId('wbStage').innerHTML = homeCrumb(capIcons(S.on === 'add' && isRec() ? addPage() : S.on === 'find' ? findPage()
      : S.on === 'draft' && (isRec() || isHR()) ? draftPage() : S.on === 'cands' && (isRec() || isHR()) && !S.cand ? candsPage() : S.cand ? candPage() : S.req ? reqPage() : S.asmt ? asmtPage() : S.acc ? accPage()
      : S.on === 'reqs' ? reqsPage() : S.on === 'calls' && isRec() ? callsPage()
      : S.on === 'asmts' ? asmtsPage() : S.on === 'templates' ? templatesPage()
      : S.on === 'reports' ? reportsPage() : deskHome()));
    paintRail();
    paintBell();
    paintProto();
    paintDial();
    requestAnimationFrame(placeSwitchBar);
    requestAnimationFrame(afterPaint);
  }

  /* ── The bell: what is waiting on a person, every row ending in a record. */
  /* What came back to this desk from another one, newest first. */
  const newsFor = () => D.news.filter((n) => n.to === DESK).slice(-6).reverse();
  function newsRows() {
    return newsFor().map((n) => '<li class="ntf-row' + (n.read ? ' is-read' : '') + '">' +
      '<span class="ntf-sev ' + (n.sev || 'p2') + '" aria-hidden="true"></span>' +
      '<div class="ntf-row-main"><div class="ntf-row-head"><span class="ntf-row-type">' + esc(n.type) + '</span>' +
        '<span class="ntf-row-when">' + esc(n.day === 0 ? 'today, ' + n.time : sayWhen(n.day)) + '</span></div>' +
        '<p class="ntf-row-body">' + esc(n.body) + '</p>' +
        '<button class="ntf-row-cta" type="button"' + goAttr(n.go) + '>' + esc(n.cta) + '</button></div></li>').join('');
  }
  function paintBell() {
    paintBellRows();
    /* News that came back counts and lights the dot until it is read. */
    const news = newsFor();
    if (!news.length) return;
    const rows = byId('ntfList').innerHTML.indexOf('ntf-empty') >= 0 ? '' : byId('ntfList').innerHTML;
    byId('ntfList').innerHTML = newsRows() + rows;
    const total = byId('ntfList').querySelectorAll('.ntf-row').length;
    byId('ntfCount').hidden = false;
    byId('ntfCount').textContent = total;
    if (news.some((n) => !n.read)) byId('ntfDot').hidden = false;
  }
  function paintBellRows() {
    if (!isRec()) {
      const a = asks();
      byId('ntfList').innerHTML = a.length ? a.slice(0, 8).map((x) => '<li class="ntf-row">' +
        '<span class="ntf-sev p2" aria-hidden="true"></span>' +
        '<div class="ntf-row-main"><div class="ntf-row-head"><span class="ntf-row-type">' + esc(x.head) + '</span></div>' +
        '<p class="ntf-row-body">' + esc(x.body) + '</p>' +
        '<button class="ntf-row-cta" type="button"' + goAttr(x.go) + '>' + esc(x.verb) + '</button></div></li>').join('')
        : '<li class="ntf-empty">Nothing waiting on you.</li>';
      byId('ntfDot').hidden = !a.length || !!D.read;
      byId('ntfCount').hidden = !a.length;
      byId('ntfCount').textContent = a.length;
      return;
    }
    const w = waits(), d = decisions();
    /* Sales's bell row (sev, head, body, one way in), drawn as a string. */
    const items = missed().filter((t) => DB.byId[t.cand]).slice(0, 3).map((t) => ({ c: DB.byId[t.cand], sev: 'p1', type: 'Missed call', when: t.time,
        body: DB.byId[t.cand].name + ' called and got nobody.', cta: 'Call them back', act: 'data-call="' + t.cand + '"' }))
      .concat(d.slice(0, 4).map((c) => ({ c: c, sev: 'p2', type: 'Your call', body: 'The result is in for ' + c.name + '.', cta: 'Open the requisition' })))
      .concat(w.slice(0, 4).map((c) => ({ c: c, sev: 'p3', type: 'Waiting on ' + waitWho(c), body: waitWho(c) + ' owes an answer on ' + c.name + '.', cta: 'Open the requisition' })));
    byId('ntfList').innerHTML = items.length ? items.map((x) => '<li class="ntf-row' + (D.read ? ' is-read' : '') + '">' +
      '<span class="ntf-sev ' + x.sev + '" aria-hidden="true"></span>' +
      '<div class="ntf-row-main"><div class="ntf-row-head"><span class="ntf-row-type">' + esc(x.type) + '</span>' +
        '<span class="ntf-row-when">' + esc(x.when || days(x.c.since)) + '</span></div>' +
        '<p class="ntf-row-body">' + esc(x.body) + ' ' + esc(reqOf(x.c).title) + ', ' + esc(accOf(reqOf(x.c)).name) + '.</p>' +
        '<button class="ntf-row-cta" type="button"' + (x.act ? ' ' + x.act : goAttr({ req: x.c.req })) + '>' + esc(x.cta) + '</button></div></li>').join('')
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
  function move(c, to, extra) {
    const was = { stage: c.stage, since: c.since, meet: c.meet, fb: c.fb, maxAt: c.maxAt, exit: c.exit, nudged: c.nudged,
      sentDay: c.sentDay, openDay: c.openDay, decideDay: c.decideDay, writeup: c.writeup || null };
    const q = reqOf(c);
    const fields = { stage: to, since: 0, fb: false, nudged: null,
      meet: MEETS[to] ? 2 : null, slot: c.slot || '11:00',
      maxAt: rank(q, to) > rank(q, c.maxAt) ? to : c.maxAt };
    /* The sendout starts when the profile goes, and is decided when the
       client says they want to meet. */
    if (to === 'sent') Object.assign(fields, { sentDay: 0, openDay: null, decideDay: null });
    if (c.stage === 'sent' && to === 'client') fields.decideDay = 0;
    Object.assign(fields, extra || {});
    WRITING = null;
    write(c, fields);
    /* AiMY books the next interview inside the interviewer's free slots and
       tells the candidate from the booking (do and notify). */
    const tpl = tplFor(to);
    const iv = MEETS[to] ? make('ivs', { id: uid('iv'), cand: c.id, stage: to, day: 2, slot: fields.slot, by: interviewerFor(q, to), mode: 'person',
      status: 'booked', ratings: null, notes: null, verdict: null, recording: null, tpl: tpl ? tpl.id : null }) : null;
    const o = offerOf(c);
    const oWas = o ? { status: o.status, joinDay: o.joinDay } : null;
    if (to === 'joined' && o) put('offers', o, { status: 'joined', joinDay: 0 });
    const e = note(c, 'move', to === 'sent' && fields.writeup ? 'Profile sent to ' + accOf(q).name + ' by ' + me().name + ', with the write-up they approved.' : 'Moved to ' + lower(STAGE[to].label) + ' by ' + me().name + '.');
    const n = isClient() && to === 'client' ? tellDesk(q.rec, { sev: 'p1', type: 'Client decision', cta: 'Open ' + first(c.name), go: { cand: c.id },
      body: accOf(q).name + ' wants to meet ' + c.name + ' for ' + q.title + '. AiMY booked it for ' + sayDay(2) + '.' }) : null;
    paint();
    toast('Moved ' + first(c.name) + ' to ' + lower(STAGE[to].label), () => {
      write(c, was); if (iv) unmake('ivs', iv); if (o) put('offers', o, oWas); unmake('events', e); untell(n); paint();
      toast('Put back', null, c.name + ' is at ' + lower(STAGE[was.stage].label) + ' again.');
    },
      MEETS[to] ? 'AiMY booked it for ' + sayDay(2) + ' with ' + interviewerFor(q, to) + ' and tells them from the booking.'
        : to === 'sent' ? 'Sent to ' + accOf(q).name + '. They will be asked once, and nudged if they go quiet.'
        : to === 'offer' ? 'Prepare the offer from their card.' : to === 'assess' ? 'Send the assessment from their card.' : null);
  }
  function out(c, k, why, line) {
    const was = { exit: c.exit, since: c.since, told: c.told, outWhy: c.outWhy || null };
    write(c, { exit: k, since: 0, told: NEEDS_TELLING[k] ? false : null, outWhy: why ? { why: why, note: line || '', day: 0, by: DESK } : null });
    const e = note(c, 'out', EXIT[k].label + (why ? ': ' + lower(OUT_K[why].label) + (line ? ', “' + line + '”' : '') : '') + ', marked by ' + me().name + '.');
    OUTING = null;
    paint();
    toast(first(c.name) + ': ' + EXIT[k].label.toLowerCase() + (why ? ', ' + lower(OUT_K[why].label) : ''), () => { write(c, was); unmake('events', e); paint(); toast('Put back', null, c.name + ' is in progress again.'); },
      NEEDS_TELLING[k] ? 'Nothing goes to them yet. A person sends the answer within ' + TELL_DAYS + ' days, from Not told yet on Today.' : null);
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
    if (k === 'send') { const c = d.filter((x) => x.stage === 'tech' && reqOf(x).tpl !== 'internal')[0]; return c ? go({ req: c.req, q: 'tech' }) : go({ on: 'reqs', q: 'mine' }); }
    if (k === 'screen') { const l = toCall(); return l.length ? callAll(l.map((x) => x.c.id)) : go({ on: 'calls' }); }
    if (k === 'risk') return go({ on: 'reqs', q: 'risk' });
    if (k === 'find') return findChat(null, '');
    go({});
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    const at = (sel) => t.closest(sel);
    let el;
    if ((el = at('[data-undo]'))) { const u = UNDO; toastGone(); if (u) u(); return; }
    /* ── The canvas ── */
    if (at('#canvasOpen')) { if (canvasShown()) closeCanvas(); else openCanvas(); return; }
    if (at('#peekOpen')) { openCanvas(); return; }
    if (at('[data-overlay-close]')) { closeCanvas(); return; }
    if (at('#ovChatsToggle')) { chatsDrawer(!byId('overlayChats').classList.contains('is-open')); return; }
    if (at('#ovChatsScrim')) { chatsDrawer(false); return; }
    if (at('#overlaySend')) { canvasAsk(byId('overlayInput').value); return; }
    if ((el = at('[data-ask]'))) { if (!canvasShown()) openCanvas(); canvasAsk(el.getAttribute('data-ask')); return; }
    if ((el = at('[data-newchat]'))) { CHAT_AT = null; THREAD_SEEN = 0; paintThread(); chatsDrawer(false); byId('overlayInput').focus(); return; }
    if ((el = at('[data-chat-del]'))) {
      const id = el.getAttribute('data-chat-del'), i = CHATS.findIndex((x) => x.id === id), ch = CHATS[i];
      CHATS.splice(i, 1); if (CHAT_AT === id) CHAT_AT = null; saveChats(); paintThread();
      toast('Conversation deleted', () => { CHATS.splice(i, 0, ch); saveChats(); paintThread(); });
      return;
    }
    if ((el = at('[data-chat]'))) { CHAT_AT = el.getAttribute('data-chat'); THREAD_SEEN = 1e9; paintThread(); chatsDrawer(false); return; }
    if (at('[data-peek-close]') || at('#peekClose')) peekHide();
    if (at('#peekClose')) return;
    const val = (name) => el.getAttribute(name);
    const two = (name) => val(name).split('|');
    /* ── Desks ── */
    if ((el = at('[data-as]'))) { EDIT = null; byId('asPanel').hidden = true; go({ as: val('data-as') === 'omar' ? undefined : val('data-as') }); return; }
    /* ── Requisitions ── */
    if ((el = at('[data-new-req]'))) { newReq({ acc: val('data-new-req') || undefined }); return; }
    if ((el = at('[data-client-request]'))) { clientRequest(); return; }
    if ((el = at('[data-clone]'))) { cloneReq(DB.reqById[val('data-clone')]); return; }
    if ((el = at('[data-edit-req]'))) { EDIT = null; go({ req: val('data-edit-req'), edit: '1' }); return; }
    if ((el = at('[data-cancel-edit]'))) { EDIT = null; const n = Object.assign({}, S); delete n.edit; go(n, true); return; }
    if ((el = at('[data-save-edit]'))) { saveReq(DB.reqById[val('data-save-edit')], false); return; }
    if ((el = at('[data-open-req]'))) { saveReq(DB.reqById[val('data-open-req')], true); return; }
    if ((el = at('[data-discard-req]'))) {
      const q = DB.reqById[val('data-discard-req')];
      const copy = JSON.parse(JSON.stringify(q));
      unmake('reqs', q); EDIT = null; go({ on: 'reqs' });
      toast('Draft discarded', () => { make('reqs', copy); go({ req: copy.id }); });
      return;
    }
    if ((el = at('[data-set]'))) {
      const p = two('data-set'), f = EDIT.f;
      f[p[0]] = p[1] === 'true' ? true : p[1] === 'false' ? false : p[1];
      if (p[0] === 'acc') f.tpl = ACCOUNTS.filter((a) => a.id === p[1])[0].tpl;
      if (p[0] === 'level') { f.bmin = BUDGETS[p[1]][0]; f.bmax = BUDGETS[p[1]][1]; }
      paint(); return;
    }
    if ((el = at('[data-step]'))) {
      const p = two('data-step'), f = EDIT.f;
      f[p[0]] = Math.max(1, Number(f[p[0]]) + Number(p[1]));
      paint(); return;
    }
    if ((el = at('[data-ai-draft]'))) {
      const known = aiDraft(EDIT.f); paint();
      toast('AiMY wrote the description and the success profile', null, known ? 'From the role and the ones like it you filled before. Change anything.'
        : 'From the title alone: nothing like it was filled here before. Check the success profile before you open it.');
      return;
    }
    if ((el = at('[data-publish]'))) {
      const q = DB.reqById[val('data-publish')];
      const was = q.published;
      put('reqs', q, { published: !was }); paint();
      toast(was ? 'Taken off the careers page' : 'Published', () => { put('reqs', q, { published: was }); paint(); },
        was ? 'The link stops taking applications.' : 'On the careers page now. Copy the link to post it on LinkedIn.');
      return;
    }
    if ((el = at('[data-copy]'))) {
      const t = val('data-copy');
      const done = () => toast('Copied the link', null, t);
      try { navigator.clipboard.writeText(t).then(done, () => toast('Copy this link', null, t)); } catch (err) { toast('Copy this link', null, t); }
      return;
    }
    if ((el = at('[data-req-state]'))) { const p = two('data-req-state'); setReqState(DB.reqById[p[0]], p[1]); return; }
    if ((el = at('[data-assign]'))) {
      const p = two('data-assign'), q = DB.reqById[p[0]], was = q.rec;
      if (was === p[1]) return;
      put('reqs', q, { rec: p[1] });
      const n = tellDesk(p[1], { sev: 'p1', type: 'Assigned to you', cta: 'Open it', go: { req: q.id },
        body: me().name + ' gave you ' + q.title + ' for ' + accOf(q).name + '. The reason: the lightest load on the team.' });
      paint();
      toast('Assigned to ' + RECRUITERS.filter((x) => x.id === p[1])[0].name, () => { put('reqs', q, { rec: was }); untell(n); paint(); },
        'They are told in their bell, with the reason: the lightest load on the team.');
      return;
    }
    if ((el = at('[data-acc]'))) { go({ acc: val('data-acc') }); return; }
    if ((el = at('[data-asmt]'))) { go({ asmt: val('data-asmt') }); return; }
    /* ── Candidates ── */
    if ((el = at('[data-edit-cand]'))) { EDIT = null; go({ cand: val('data-edit-cand'), edit: '1' }); return; }
    if ((el = at('[data-save-cand]'))) { saveCand(DB.byId[val('data-save-cand')]); return; }
    if ((el = at('[data-add-app]'))) {
      const p = two('data-add-app'), c0 = DB.byId[p[0]], q = DB.reqById[p[1]];
      const c = Object.assign({}, c0, { id: uid('k'), req: q.id, stage: 'applied', exit: null, since: 0, meet: null, fb: false, nudged: null,
        maxAt: 'applied', callback: null, source: 'Added by the recruiter', ev: evFor(q.must, c0), applied: 0, contactOk: true, onb: null, histSug: null });
      addCand(c);
      const e = note(c, 'apply', 'Added to ' + q.title + ' from their profile by ' + me().name + '.');
      byId('addTo' + c0.id).hidden = true;
      paint();
      toast('Added ' + first(c.name) + ' to ' + q.title, () => { unmake('events', e); dropCand(c); paint(); }, 'Same person, another application. Both show on their profile.');
      return;
    }
    if ((el = at('[data-contact-ok]'))) {
      const c = DB.byId[val('data-contact-ok')];
      write(c, { contactOk: true });
      const e = note(c, 'note', 'First contact approved by ' + me().name + '.');
      paint();
      toast('First contact approved', () => { write(c, { contactOk: false }); unmake('events', e); paint(); },
        'AiMY sends one short message on LinkedIn or by email, naming the role. Nothing about pay.');
      return;
    }
    /* ── Not progressing, with its reason ── */
    if ((el = at('[data-out-cancel]'))) { OUTING = null; paint(); return; }
    if ((el = at('[data-out-why]'))) {
      const p = two('data-out-why');
      if (p[1] === 'other') { OUTING.other = true; paint(); const f = byId('outNote'); if (f) f.focus(); return; }
      out(DB.byId[p[0]], 'out', p[1], ''); return;
    }
    if ((el = at('[data-out-other]'))) {
      const line = (byId('outNote') || {}).value || '';
      if (!line.trim()) { shake('wrapOut'); return; }
      out(DB.byId[val('data-out-other')], 'out', 'other', line.trim()); return;
    }
    /* ── Candidates: one requisition, and cards or a list ── */
    if ((el = at('[data-rq]'))) { go(Object.assign({}, S, { rq: val('data-rq') || null, p: null }), true); return; }
    if ((el = at('[data-cview]'))) { UI.cview = val('data-cview'); saveUI(); paint(); return; }
    if ((el = at('[data-cfclear]'))) { go({ on: 'cands', q: S.q }, true); return; }
    /* ── A pass with its reason ── */
    if ((el = at('[data-pass-open]'))) { PASSING = { id: val('data-pass-open'), other: false, line: '' }; paint(); return; }
    if ((el = at('[data-pass-cancel]'))) { PASSING = null; paint(); return; }
    if ((el = at('[data-pass-why]'))) {
      const p = two('data-pass-why');
      if (p[1] === 'other') { PASSING.other = true; paint(); const f = byId('passNote'); if (f) f.focus(); return; }
      passWith(DB.byId[p[0]], p[1], ''); return;
    }
    if ((el = at('[data-pass-other]'))) {
      const line = (byId('passNote') || {}).value || '';
      if (!line.trim()) { shake('wrapPass'); return; }
      passWith(DB.byId[val('data-pass-other')], 'other', line.trim()); return;
    }
    /* ── Select many, act once ── */
    if ((el = at('[data-sel]'))) { const p = two('data-sel'); if (SEL[p[0]][p[1]]) delete SEL[p[0]][p[1]]; else SEL[p[0]][p[1]] = true; paint(); return; }
    if ((el = at('[data-sel-clear]'))) { SEL[val('data-sel-clear')] = {}; paint(); return; }
    if ((el = at('[data-sel-all]'))) {
      const k = val('data-sel-all');
      if (k === 'tell') untold().forEach((c) => { SEL.tell[c.id] = true; });
      if (k === 'find') FIND.res.filter((x) => inTab(x) && !FIND.done[x.i]).forEach((x) => { SEL.find[x.i] = true; });
      if (k === 'sourced') queue().filter((c) => queueCut(c) === 'new').forEach((c) => { SEL.sourced[c.id] = true; });
      paint(); return;
    }
    if ((el = at('[data-tell]'))) { tell([val('data-tell')]); return; }
    if ((el = at('[data-tell-sel]'))) { tell(Object.keys(SEL.tell)); return; }
    if ((el = at('[data-contact-sel]'))) {
      const list = Object.keys(SEL.sourced).map((id) => DB.byId[id]).filter((c) => c && !c.contactOk);
      const es = list.map((c) => { write(c, { contactOk: true }); return note(c, 'note', 'First contact approved by ' + me().name + ', with ' + (list.length - 1) + ' others.'); });
      SEL.sourced = {};
      paint();
      toast('First contact approved for ' + plural(list.length, 'person', 'people'), () => { list.forEach((c) => write(c, { contactOk: false })); es.forEach((e) => unmake('events', e)); paint(); },
        'AiMY sends each one short message naming the role. Nothing about pay.');
      return;
    }
    if ((el = at('[data-find-sel]'))) {
      const q = DB.reqById[val('data-find-sel')];
      const made = Object.keys(SEL.find).map(Number).filter((i) => !FIND.done[i]).map((i) => ({ i: i, c: findAdd(i, q.id, true) })).filter((x) => x.c);
      SEL.find = {};
      paint();
      toast('Added ' + plural(made.length, 'person', 'people') + ' to ' + q.title, () => { made.forEach((x) => { dropCand(x.c); delete FIND.done[x.i]; }); paint(); },
        'Sourced. Prospects from the web wait for your approval before first contact.');
      return;
    }
    /* ── Check-ins and what to ask ── */
    if ((el = at('[data-checkin]'))) {
      const p = two('data-checkin'), c = DB.byId[p[0]], k = p[1] === '30' ? 'd30' : 'd90', was = c[k] || null;
      const opt = (p[1] === '30' ? CHECK30 : CHECK90).filter((x) => x[0] === p[2])[0];
      write(c, { [k]: p[2] });
      const e = note(c, 'note', 'Day-' + p[1] + ' check-in: ' + opt[1].toLowerCase() + '. Logged by ' + me().name + '.');
      paint();
      toast('Day-' + p[1] + ' check-in logged', () => { write(c, { [k]: was }); unmake('events', e); paint(); },
        p[1] === '90' ? 'It counts toward the ' + GATE + ' day-90 check-ins AiMY needs before it proposes anything.' : 'Kept apart from any probation review.');
      return;
    }
    if ((el = at('[data-ask-must]'))) {
      const p = two('data-ask-must'), c = DB.byId[p[0]], i = Number(p[1]), was = (c.asks || []).slice();
      write(c, { asks: was.concat([i]) });
      const e = note(c, 'note', 'To ask next time: ' + reqOf(c).must[i] + '. Added by ' + me().name + '.');
      paint();
      toast('Added to the next conversation', () => { write(c, { asks: was }); unmake('events', e); paint(); }, 'It shows on the next call and in the interview kit.');
      return;
    }
    if ((el = at('[data-send-asmt]'))) { sendAsmt(DB.byId[val('data-send-asmt')]); return; }
    if ((el = at('[data-book]'))) { const p = two('data-book'); bookIv(DB.byId[p[0]], Number(p[1]), p[2]); return; }
    if ((el = at('[data-nudge-iv]'))) {
      const v = DB.ivs.filter((x) => x.id === val('data-nudge-iv'))[0];
      if (v.nudged) return;
      put('ivs', v, { nudged: true }); paint();
      toast('Nudged ' + v.by.split(',')[0], () => { put('ivs', v, { nudged: false }); paint(); }, 'With the debrief link. Logged on the interview.');
      return;
    }
    if ((el = at('[data-rec-up]'))) { uploadRec(DB.ivs.filter((x) => x.id === val('data-rec-up'))[0]); return; }
    if ((el = at('[data-acc-toggle]'))) {
      const box = el.closest('.t-acc');
      const open = box.getAttribute('data-acc-open') === 'true';
      box.setAttribute('data-acc-open', String(!open));
      el.setAttribute('aria-expanded', String(!open));
      return;
    }
    if ((el = at('[data-offer-new]'))) { offerNew(DB.byId[val('data-offer-new')]); return; }
    if ((el = at('[data-offer-step]'))) { const p = two('data-offer-step'); offerStep(DB.offers.filter((o) => o.id === p[0])[0], Number(p[1])); return; }
    if ((el = at('[data-offer-send]'))) { offerSend(DB.offers.filter((o) => o.id === val('data-offer-send'))[0]); return; }
    if ((el = at('[data-offer-res]'))) { const p = two('data-offer-res'); offerRes(DB.offers.filter((o) => o.id === p[0])[0], p[1]); return; }
    if ((el = at('[data-onb]'))) {
      const p = two('data-onb'), c = DB.byId[p[0]];
      const onb = (c.onb || []).slice(); onb[Number(p[1])] = !onb[Number(p[1])];
      write(c, { onb: onb }); paint(); return;
    }
    if ((el = at('[data-hist-add]'))) { histAdd(DB.byId[val('data-hist-add')]); return; }
    if ((el = at('[data-sug-no]'))) { write(DB.byId[val('data-sug-no')], { histSug: null }); paint(); return; }
    /* ── Intake ── */
    if ((el = at('[data-intake-sample]'))) { intakeRead(null); return; }
    if ((el = at('[data-intake-create]'))) { intakeCreate(); return; }
    if ((el = at('[data-intake-reset]'))) { INTAKE = null; paint(); return; }
    /* ── Finding ── */
    if ((el = at('[data-find-req]'))) { const k = val('data-find-req'); FIND.req = FIND.req === k ? null : k; FIND.step = 'ask'; paint(); return; }
    if ((el = at('[data-find-src]'))) { const k = val('data-find-src'); FIND.src[k] = !FIND.src[k]; paint(); return; }
    if ((el = at('[data-find-go]'))) { runFind(); return; }
    if ((el = at('[data-find-tab]'))) { FIND.tab = val('data-find-tab'); paint(); return; }
    if ((el = at('[data-find-why]'))) { const i = val('data-find-why'); FIND.why[i] = !FIND.why[i]; paint(); return; }
    if ((el = at('[data-find-add]'))) { const p = two('data-find-add'); findAdd(Number(p[0]), p[1]); return; }
    if ((el = at('[data-find-top]'))) {
      const made = FIND.res.filter((x) => !FIND.done[x.i]).slice(0, 5).map((x) => ({ i: x.i, c: findAdd(x.i, FIND.req, true) })).filter((x) => x.c);
      paint();
      toast('Added ' + plural(made.length, 'person', 'people') + ' to ' + DB.reqById[FIND.req].title, () => { made.forEach((x) => { dropCand(x.c); delete FIND.done[x.i]; }); paint(); },
        'Sourced. People found outside wait for your approval before first contact.');
      return;
    }
    /* ── Assessments ── */
    if ((el = at('[data-asmt-new]'))) { newAsmt(null); return; }
    if ((el = at('[data-aset]'))) {
      const p = two('data-aset'), a = asmtOf(S.asmt);
      if (p[0] === 'pass') asmtSet(a, { pass: Math.max(30, Math.min(100, a.pass + Number(p[1]))) });
      else asmtSet(a, { kind: p[1] });
      return;
    }
    if ((el = at('[data-qtype]'))) {
      const p = two('data-qtype'), a = asmtOf(S.asmt), qs = JSON.parse(JSON.stringify(a.questions)), qq = qs[Number(p[0])];
      qq.type = p[1];
      if (p[1] === 'choice' && !qq.options) { qq.options = ['', '', '', '']; qq.right = 0; }
      if (p[1] === 'open' && !qq.points) qq.points = ['a real example'];
      asmtSet(a, { questions: qs }); return;
    }
    if ((el = at('[data-qright]'))) { const p = two('data-qright'), a = asmtOf(S.asmt), qs = JSON.parse(JSON.stringify(a.questions)); qs[Number(p[0])].right = Number(p[1]); asmtSet(a, { questions: qs }); return; }
    if ((el = at('[data-q-add]'))) {
      const a = asmtOf(val('data-q-add')), qs = JSON.parse(JSON.stringify(a.questions));
      qs.push({ q: '', type: 'choice', options: ['', '', '', ''], right: 0, fails: 0 });
      asmtSet(a, { questions: qs }); return;
    }
    if ((el = at('[data-q-del]'))) {
      const p = two('data-q-del'), a = asmtOf(p[0]), qs = JSON.parse(JSON.stringify(a.questions));
      qs.splice(Number(p[1]), 1);
      /* Results keep their answers in question order, so they drop the same one. */
      DB.sends.filter((s) => s.asmt === a.id && s.answers).forEach((s) => { const an = s.answers.slice(); an.splice(Number(p[1]), 1); put('sends', s, { answers: an }); });
      asmtSet(a, { questions: qs }, 'Removed Q' + (Number(p[1]) + 1)); return;
    }
    /* ── Learning proposals and the ladder ── */
    if ((el = at('[data-prop]'))) { const v = val('data-prop'), k = v.lastIndexOf('|'); propAct(v.slice(0, k), v.slice(k + 1)); return; }
    if ((el = at('[data-auto]'))) { const p = two('data-auto'); setAuto(p[0], p[1]); return; }
    /* ── Templates ── */
    if ((el = at('[data-tpl-toggle]'))) { const p = two('data-tpl-toggle'); toggleStage(p[0], p[1]); return; }
    if ((el = at('[data-tpl-edit]'))) { const k = val('data-tpl-edit'); TPL_EDIT[k] = !TPL_EDIT[k]; paint(); return; }
    if ((el = at('[data-tpl-add]'))) { const t = tplById(val('data-tpl-add')); put('ivtpls', t, { items: t.items.concat(['']) }); paint(); return; }
    if ((el = at('[data-tpl-del]'))) {
      const p = two('data-tpl-del'), t = tplById(p[0]), was = t.items.slice(), items = t.items.slice();
      items.splice(Number(p[1]), 1); put('ivtpls', t, { items: items }); paint();
      toast('Removed from the ' + t.title + ' agenda', () => { put('ivtpls', t, { items: was }); paint(); });
      return;
    }
    /* ── Outside: debrief, approval, test, careers page, profile ── */
    if ((el = at('[data-dr]'))) { const p = two('data-dr'); DEBRIEF.r[Number(p[0])] = p[1]; paint(); return; }
    if ((el = at('[data-dv]'))) { DEBRIEF.v = val('data-dv'); paint(); return; }
    if ((el = at('[data-dr-quote]'))) {
      const i = Number(val('data-dr-quote')), v = DB.ivs.filter((x) => x.id === DEBRIEF.id)[0];
      DEBRIEF.n[i] = v.recording.lines[i * 2 + 1][1]; paint(); return;
    }
    if ((el = at('[data-gap-ask]'))) {
      const v = DB.ivs.filter((x) => x.id === val('data-gap-ask'))[0], c = DB.byId[v.cand];
      DEBRIEF.asked = true;
      note(c, 'note', 'AiMY asked ' + first(c.name) + ' ' + viaSay(c) + ' about an agenda topic the interview missed.', { by: null });
      paint(); toast('Asked ' + first(c.name), null, 'By message, ' + viaSay(c) + '. The answer lands on their record.');
      return;
    }
    /* ── The language of the pages candidates see ── */
    if ((el = at('[data-lang]'))) { UI.lang = val('data-lang'); saveUI(); paint(); return; }
    if ((el = at('[data-me-wa]'))) {
      const list = DB.cands.filter((c) => c.pid === S.me), on = !list[0].wa;
      list.forEach((c) => write(c, { wa: on, waDay: on ? 0 : null }));
      list.forEach((c) => note(c, 'note', on ? 'Opted in to WhatsApp updates on their own profile.' : 'Turned WhatsApp updates off on their own profile.', { by: null }));
      paint();
      toast(on ? tr('WhatsApp updates on', 'تم تفعيل التحديثات على واتساب') : tr('WhatsApp updates off', 'تم إيقاف التحديثات على واتساب'), null,
        on ? tr('Recorded with today’s date. Turn it off here any time.', 'سُجّلت موافقتك بتاريخ اليوم. يمكنك إيقافها من هنا في أي وقت.') : tr('Messages come by email from now on.', 'ستصلك الرسائل بالبريد الإلكتروني من الآن.'));
      return;
    }
    if ((el = at('[data-debrief-submit]'))) { debriefSubmit(); return; }
    if ((el = at('[data-appr]'))) { const p = two('data-appr'); approve(DB.offers.filter((o) => o.id === p[0])[0], p[1], p[2]); return; }
    if ((el = at('[data-ans]'))) { const p = two('data-ans'); TAKE.a[Number(p[0])] = Number(p[1]); paint(); return; }
    if ((el = at('[data-take-submit]'))) { takeSubmit(); return; }
    if ((el = at('[data-live-send]'))) { liveSend(); return; }
    if ((el = at('[data-live-pick]'))) { const p = two('data-live-pick'); livePick(Number(p[0]), Number(p[1])); return; }
    if ((el = at('[data-apply-sample]'))) { applyRead(null); return; }
    if ((el = at('[data-apply-consent]'))) { const k = val('data-apply-consent'); APPLY[k] = !APPLY[k]; paint(); return; }
    if ((el = at('[data-apply-send]'))) { applySend(); return; }
    if ((el = at('[data-me-code]'))) { meCode(); return; }
    if ((el = at('[data-forget]'))) { forget(DB.byId[val('data-forget')], false); return; }
    if ((el = at('[data-me-forget]'))) { forget(DB.byId[val('data-me-forget')], true); return; }
    if ((el = at('[data-me-withdraw]'))) {
      const c = DB.byId[val('data-me-withdraw')];
      write(c, { exit: 'withdrew', since: 0 });
      const e = note(c, 'out', 'Withdrew on their own profile.');
      paint();
      toast(tr('Withdrawn', 'سُحب الطلب'), () => { write(c, { exit: null }); unmake('events', e); paint(); },
        tr('The recruiter is told. You can apply again any time.', 'أبلغنا فريق التوظيف. يمكنك التقديم مرة أخرى في أي وقت.'));
      return;
    }
    if ((el = at('[data-me-save]'))) {
      const f = { phone: byId('mePhone').value.trim(), email: byId('meMail').value.trim(), place: byId('mePlace').value.trim() };
      DB.cands.filter((c) => c.pid === S.me).forEach((c) => { write(c, f); });
      paint(); toast(tr('Saved your details', 'حُفظت بياناتك'), null, tr('The recruiting team sees them now.', 'يراها فريق التوظيف الآن.'));
      return;
    }
    /* ── The call ── */
    if ((el = at('[data-call]'))) { startCall(el.getAttribute('data-call')); return; }
    if ((el = at('[data-call-all]'))) { callAll(toCall().map((x) => x.c.id)); return; }
    if ((el = at('[data-callgo]'))) { callGo(); return; }
    if ((el = at('[data-call-end]'))) { endCall(); return; }
    if ((el = at('[data-call-close]'))) { dismissCall(); return; }
    if ((el = at('[data-call-skip]'))) { skipCall(); return; }
    if ((el = at('[data-call-rec]'))) {
      if (CALL.recording) { CALL.recording = false; toast('Recording stopped', null, 'What was said so far stays; nothing more is written down.'); }
      else CALL.asking = true;
      paintCall(); return;
    }
    if ((el = at('[data-call-consent]'))) {
      CALL.asking = false;
      if (el.getAttribute('data-call-consent') === 'yes') { CALL.recording = true; growTranscript(); }
      else toast('Not recording', null, 'Nothing is written down until they have been told.');
      paintCall(); return;
    }
    if ((el = at('[data-call-mute]'))) { CALL.muted = !CALL.muted; paintCall(); return; }
    if ((el = at('[data-call-mode]'))) { CALL.video = el.getAttribute('data-call-mode') === 'video'; paintCall(); if (canvasShown()) paintThread(); return; }
    if ((el = at('[data-call-cam]'))) { CALL.camOff = !CALL.camOff; paintCall(); return; }
    if ((el = at('[data-vm]'))) { vmPlay(el.getAttribute('data-vm')); return; }
    if ((el = at('[data-live-mic]'))) { liveMic(); return; }
    if ((el = at('[data-call-hold]'))) { CALL.held = !CALL.held; paintCall(); return; }
    if ((el = at('[data-call-min]'))) { callMin(!CALL_MIN); paintCall(); return; }
    if ((el = at('[data-call-line]'))) {
      UI.line = el.getAttribute('data-call-line'); saveUI();
      if (CALL && CALL.state === 'ready') CALL.from = UI.line;
      paintCall();
      if (!byId('dialPanel').hidden) dialOpen();
      return;
    }
    if ((el = at('[data-outcome]'))) { if (PENDING) { PENDING.lit = el.getAttribute('data-outcome'); paintThread(); } return; }
    if ((el = at('[data-sess-stop]'))) { stopRun(); return; }
    if ((el = at('[data-more]'))) { const k = val('data-more'); TODAY_MORE[k] = !TODAY_MORE[k]; paint(); return; }
    if ((el = at('[data-ask-date]'))) { askMove(DB.reqById[val('data-ask-date')]); return; }
    if ((el = at('[data-prep]'))) { prepMe(DB.byId[val('data-prep')]); return; }
    if ((el = at('[data-cb]'))) { if (PENDING) { PENDING.read = PENDING.read || {}; PENDING.read.when = Number(val('data-cb')); paintThread(); } return; }
    if ((el = at('[data-coach]'))) { coachAnswer(val('data-coach')); return; }
    if ((el = at('[data-coachset]'))) { COACH_FORCE = val('data-coachset'); coachRescript(); paintProto(); return; }
    /* On a phone the panel covers the conversation: it folds to its strip. */
    if ((el = at('[data-brief-open]'))) { openCanvas(); if (narrowCall()) { callMin(true); paintCall(); } return; }
    if ((el = at('[data-log]'))) { logCall(el.getAttribute('data-log') === 'stop'); return; }
    if ((el = at('[data-add-stranger]'))) { addStranger(); return; }
    if ((el = at('[data-ring-yes]'))) { answerInbound(); return; }
    if ((el = at('[data-ring-no]'))) { ringEnded('You declined'); return; }
    if ((el = at('[data-ring]'))) { ringTrigger(el.getAttribute('data-ring')); return; }
    if ((el = at('[data-quiet]'))) { UI.quiet = !UI.quiet; saveUI(); if (UI.quiet) ringToneOff(); paintProto(); return; }
    if ((el = at('[data-dial-go]'))) { dialGo(); return; }
    if ((el = at('[data-redial]'))) { dialOpen(el.getAttribute('data-redial')); return; }
    if ((el = at('#dialBtn'))) {
      if (CALL) { callMin(false); paintCall(); return; }
      if (byId('dialPanel').hidden) dialOpen(); else closeDial();
      return;
    }
    if ((el = at('[data-cand]'))) { go({ cand: el.getAttribute('data-cand') }); return; }
    if ((el = at('[data-move]'))) {
      const p = el.getAttribute('data-move').split('|'), c = DB.byId[p[0]];
      /* A profile goes to a client with its write-up, read and approved first. */
      if (p[1] === 'sent' && !isClient()) {
        if (!el.closest('#wbStage')) go({ cand: c.id });
        WRITING = { id: c.id, text: writeUp(c) }; PASSING = null;
        paint();
        return;
      }
      move(c, p[1]); return;
    }
    if ((el = at('[data-wu-send]'))) {
      const c = DB.byId[val('data-wu-send')], t = byId('wuText').value.trim();
      if (!t) { shake('wrapWu'); return; }
      move(c, 'sent', { writeup: { text: t, by: DESK, day: 0 } });
      return;
    }
    if ((el = at('[data-wu-cancel]'))) { WRITING = null; paint(); return; }
    if ((el = at('[data-out]'))) {
      const p = el.getAttribute('data-out').split('|');
      if (p[1] === 'out') { OUTING = { id: p[0], other: false, line: '' }; PASSING = null; WRITING = null; paint(); return; }
      out(DB.byId[p[0]], p[1]); return;
    }
    if ((el = at('[data-nudge]'))) { nudge(DB.byId[el.getAttribute('data-nudge')]); return; }
    if ((el = at('[data-start]'))) { start(el.getAttribute('data-start')); return; }
    /* ── Finding through the chat, and the shortlist it brings back ── */
    if ((el = at('[data-fc]'))) { fcStep(el.getAttribute('data-fc')); return; }
    if ((el = at('[data-keep]'))) { if (DRAFT) { const i = Number(el.getAttribute('data-keep')); DRAFT.keep[i] = DRAFT.keep[i] === false; paint(); } return; }
    if ((el = at('[data-draft-add]'))) { draftAdd(el.getAttribute('data-draft-add')); return; }
    if ((el = at('[data-draft-save]'))) { draftSave(); return; }
    if ((el = at('[data-draft-discard]'))) { draftDiscard(); return; }
    if ((el = at('[data-draft-stay]'))) { LEAVE = null; paint(); return; }
    if ((el = at('[data-list-del]'))) {
      const id = el.getAttribute('data-list-del'), l = D.lists.filter((x) => x.id === id)[0];
      D.lists = D.lists.filter((x) => x.id !== id); save();
      go({ on: 'find' });
      toast('Shortlist deleted', () => { D.lists.push(l); save(); paint(); });
      return;
    }
    if ((el = at('[data-quick]'))) { go({ on: 'reqs', q: el.getAttribute('data-quick') }); return; }
    if ((el = at('[data-q]'))) { go(Object.assign({}, S, { q: el.getAttribute('data-q') }), true); return; }
    /* The report's view: 90 days and every account are the plain link. */
    if ((el = at('[data-period]'))) { const p = val('data-period'); go(Object.assign({}, S, { period: p === '90' ? null : p }), true); return; }
    if ((el = at('[data-account]'))) { go(Object.assign({}, S, { account: val('data-account') || null }), true); return; }
    if ((el = at('[data-trail]'))) { go(TRAIL && !TRAIL.req ? TRAIL : { on: 'reqs' }); return; }
    if ((el = at('[data-home]'))) { go({}); return; }
    if ((el = at('[data-reset]'))) { reset(); load(); go({}, true); toast('Back to the start', null, 'Every change you made is gone.'); return; }
    if ((el = at('#protoToggle'))) { const p = byId('protoPanel'); p.hidden = !p.hidden; el.setAttribute('aria-expanded', String(!p.hidden)); paintProto(); return; }
    if ((el = at('#ntfBell'))) { const p = byId('ntfPanel'); p.hidden = !p.hidden; el.setAttribute('aria-expanded', String(!p.hidden)); return; }
    if ((el = at('#ntfClear'))) { D.read = true; D.news.forEach((n) => { if (n.to === DESK) n.read = true; }); save(); paintBell(); return; }
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
    /* A click outside the bell, the dialer or an open menu closes it. */
    if (!at('#ntfPanel') && !at('#ntfBell')) { const p = byId('ntfPanel'); if (!p.hidden) { p.hidden = true; byId('ntfBell').setAttribute('aria-expanded', 'false'); } }
    if (!at('#dialAnchor')) closeDial();
    if (!at('.b-menu-wrap')) document.querySelectorAll('.tel-menu').forEach((m) => { m.hidden = true; });
  });

  /* Find, as you type. The page repaints and the cursor stays where it was. */
  /* A line typed onto someone's history. If it reads as a pass or a no,
     AiMY offers the matching move beside it; it never makes it alone. */
  function histAdd(c) {
    const inp = byId('histNote');
    const t = inp ? inp.value.trim() : '';
    if (!t) { if (inp) inp.focus(); return; }
    const read = readNote(t);
    const e = note(c, 'note', t, { read: read });
    const was = c.histSug;
    write(c, { histSug: read ? e.id : null });
    paint();
    toast('Added to ' + first(c.name) + '’s history', () => { unmake('events', e); write(c, { histSug: was }); paint(); });
  }
  function meCode() {
    const v = (byId('meCode') || {}).value || '';
    if (!/^\d{6}$/.test(v.trim())) { shake('wrapCode'); return; }
    ME_OK[S.me] = true;
    paint();
  }
  /* A client asks for a hire; it lands with their account manager as a
     draft, to be talked through before it opens (Sales's client request). */
  /* The button asks in the bar; what they type there is the request. */
  function clientRequest(text) {
    /* The BU Director requests hires for FlairsTech's own unit (Sales S3,
       the stakeholder's Request a campaign); the client for their company. */
    const accId = isBU() ? 'flairs' : me().acc;
    if (!text) {
      const inp = byId('floatInput');
      inp.placeholder = 'Who do you need? For example: two more support engineers by December';
      inp.focus();
      peek('Tell me who you need in the bar below, in your own words. I pass it to ' + esc(HMS.filter((h) => h.id === ACCOUNTS.filter((a) => a.id === accId)[0].hm)[0].name) + ' as a draft.', []);
      return;
    }
    const acc = ACCOUNTS.filter((a) => a.id === accId)[0];
    const p = parseRole(text);
    /* The unit's own requests go to the hiring manager on the desks. */
    const hmId = isBU() ? 'rania' : acc.hm;
    const am = HMS.filter((h) => h.id === hmId)[0].name;
    const q = make('reqs', { id: uid('r'), title: p.title, fam: famOf(p.title), level: p.level, must: [], acc: acc.id, tpl: acc.tpl, hm: hmId, rec: 'omar', seats: p.seats,
      kind: 'new', billable: true, state: 'draft', opened: 0, target: expDays(acc.tpl), place: 'Nasr City office', plan: null, domain: acc.domain, published: false,
      budget: { min: BUDGETS[p.level][0], max: BUDGETS[p.level][1] }, desc: me().name + ' at ' + acc.name + ' asked: “' + text.replace(/[.!?]$/, '') + '.”', asmt: null, askedBy: DESK });
    byId('floatInput').placeholder = 'Ask AiMY, or find a requisition or a candidate…';
    peekHide();
    paint();
    const n = tellDesk(hmId, { sev: 'p1', type: 'Hiring request', body: me().name + ' asked for ' + (p.title ? plural(p.seats, 'seat') + ' as ' + p.title : 'a hire') + '. Talk it through before it opens.', cta: 'Open the draft', go: { req: q.id } });
    toast('Sent to ' + am + (isBU() ? ', to talk through first' : ', your account manager'), () => { unmake('reqs', q); untell(n); paint(); },
      (p.title ? plural(p.seats, 'seat') + ' as ' + p.title + '. ' : '') + 'It is talked through with you before it opens.');
  }
  document.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (e.target.matches('[data-cv-file]')) intakeRead(f ? f.name : null);
    if (e.target.matches('[data-apply-file]')) applyRead(f ? f.name : null);
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    const g = (n) => t.getAttribute(n);
    if (t.matches('[data-ed]') && EDIT) { EDIT.f[g('data-ed')] = t.value; return; }
    if (t.matches('[data-in]') && INTAKE && INTAKE.f) { INTAKE.f[g('data-in')] = t.value; return; }
    if (t.matches('[data-find-q]')) { FIND.q = t.value; return; }
    if (t.id === 'passNote' && PASSING) { PASSING.line = t.value; return; }
    if (t.matches('[data-drn]') && DEBRIEF) { DEBRIEF.n[Number(g('data-drn'))] = t.value; return; }
    if (t.matches('[data-anstext]') && TAKE) { TAKE.a[Number(g('data-anstext'))] = t.value; return; }
    if (t.matches('[data-apply-in]') && APPLY && APPLY.f) { APPLY.f[g('data-apply-in')] = t.value; return; }
    if (t.matches('[data-aed]')) { put('asmts', asmtOf(S.asmt), { title: t.value }); return; }
    if (t.matches('[data-qed], [data-qopt], [data-qpts]')) {
      const a = asmtOf(S.asmt), qs = JSON.parse(JSON.stringify(a.questions));
      if (t.matches('[data-qed]')) qs[Number(g('data-qed').split('|')[0])].q = t.value;
      if (t.matches('[data-qopt]')) { const p = g('data-qopt').split('|'); qs[Number(p[0])].options[Number(p[1])] = t.value; }
      if (t.matches('[data-qpts]')) qs[Number(g('data-qpts'))].points = t.value.split(',').map((x) => x.trim()).filter(Boolean);
      put('asmts', a, { questions: qs });
      return;
    }
    if (t.matches('[data-tpled]')) { const p = g('data-tpled').split('|'), tp = tplById(p[0]), items = tp.items.slice(); items[Number(p[1])] = t.value; put('ivtpls', tp, { items: items }); return; }
    /* The dialer reads the number as you type it (Sales). */
    if (e.target.id === 'dialNum') {
      DIAL_NUM = e.target.value;
      const who = byId('dialWho');
      if (who) who.innerHTML = dialWho();
      return;
    }
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
    ask(v);
  });
  byId('floatSend').addEventListener('click', () => {
    const v = byId('floatInput').value.trim();
    byId('floatInput').value = '';
    ask(v);
  });
  document.addEventListener('keydown', (e) => {
    const typing = /input|textarea/i.test((document.activeElement || {}).tagName || '');
    /* Enter means the obvious next thing at every state of a call (Sales):
       start it, log it. 1 to 8 pick the outcome while logging. */
    if (e.target.id === 'dialNum' && e.key === 'Enter') { e.preventDefault(); dialGo(); return; }
    if (e.target.id === 'histNote' && e.key === 'Enter') { e.preventDefault(); histAdd(DB.byId[S.cand]); return; }
    if (e.target.id === 'meCode' && e.key === 'Enter') { e.preventDefault(); meCode(); return; }
    if (e.target.id === 'passNote' && e.key === 'Enter' && PASSING) {
      e.preventDefault();
      if (!e.target.value.trim()) { shake('wrapPass'); return; }
      passWith(DB.byId[PASSING.id], 'other', e.target.value.trim()); return;
    }
    if (e.key === 'Escape' && PASSING) { PASSING = null; paint(); return; }
    /* A call waiting to be logged: 1 to 8 pick the outcome and Enter logs
       it, while nothing is typed; a typed sentence is a correction. */
    if (PENDING && canvasShown()) {
      const empty = e.target.id === 'overlayInput' ? !e.target.value.trim() : !typing;
      if (empty && /^[1-8]$/.test(e.key)) { e.preventDefault(); PENDING.lit = OUTCOMES[Number(e.key) - 1].k; paintThread(); return; }
      if (empty && e.key === 'Enter' && !/button/i.test(e.target.tagName)) { e.preventDefault(); logCall(); return; }
    }
    if (e.target.id === 'overlayInput' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); canvasAsk(e.target.value); return; }
    if (e.target.id === 'liveIn' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); liveSend(); return; }
    if (e.key === 'Escape' && canvasShown()) { closeCanvas(); return; }
    if (CALL && CALL.state === 'ready' && e.key === 'Enter' && !typing && !/button/i.test(e.target.tagName)) { e.preventDefault(); callGo(); return; }
    if (e.key === 'Escape') { closeDial(); document.querySelectorAll('.tel-menu').forEach((m) => { m.hidden = true; }); }
    if (e.key === 'Escape') { const p = byId('ntfPanel'); if (!p.hidden) { p.hidden = true; byId('ntfBell').setAttribute('aria-expanded', 'false'); } }
    if (e.key === '/' && !/input|textarea/i.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); byId('floatInput').focus(); }
  });
  window.addEventListener('popstate', () => {
    /* The browser's Back is caught too: an unsaved shortlist shows its gate. */
    if (DRAFT && S.on === 'draft' && !S.list && new URLSearchParams(location.search).get('on') !== 'draft') {
      history.pushState(null, '', urlOf(S)); LEAVE = {}; paint(); byId('pageScroll').scrollTop = 0; return;
    }
    parse(); paint();
  });
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

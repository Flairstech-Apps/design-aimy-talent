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
  /* By the calendar, not by 24-hour steps: across the end of summer time a
     day is 25 hours, and n steps of 24 landed on the day before. */
  const dayOf = (n) => new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + n);
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
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
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
    upload: '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
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
    sourced:  { label: 'Sourced',             who: 'me',        exp: 3, go: 'Agreed to talk',    say: 'found, not yet in touch' },
    applied:  { label: 'Applied',             who: 'me',        exp: 2, go: 'Book the call',     say: 'applied or agreed to talk' },
    assess:   { label: 'Assessment',          who: 'candidate', exp: 3, go: 'Passed the assessment', say: 'taking the assessment' },
    phone:    { label: 'Phone screen',        who: 'me',        exp: 2, go: 'Passed the call',   say: 'a screening call is due' },
    hr:       { label: 'HR interview',        who: 'me',        exp: 3, go: 'Passed the HR interview', say: 'with HR' },
    tech:     { label: 'Technical interview', who: 'interviewer', exp: 4, go: 'Send the profile', say: 'with the technical interviewer' },
    mgr:      { label: 'Managerial interview', who: 'hm',       exp: 3, go: 'Passed the managerial interview', say: 'with the hiring manager' },
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
    const out = { outcome: null, notice: null, salary: null, when: null, win: null };
    for (let i = 0; i < READ.length; i++) if (READ[i][1].test(t)) { out.outcome = READ[i][0]; break; }
    const n = /\b(one|two|three|1|2|3) months?'?s? notice|\b(start (right away|immediately|next week))/i.exec(t);
    const WORDS = { 1: 'one', 2: 'two', 3: 'three' };
    if (n && n[1]) { const w = WORDS[n[1]] || n[1].toLowerCase(); out.notice = w + (w === 'one' ? ' month’s' : ' months’') + ' notice'; }
    else if (n) out.notice = 'can ' + n[2].toLowerCase();
    const s = /(?:expect(?:ing)?|looking for|asking for)[^0-9]{0,24}([\d,]{5,7})/i.exec(t);
    if (s) out.salary = 'EGP ' + s[1] + ' a month';
    out.when = /\btomorrow\b/i.test(t) ? 1 : /\bnext week\b/i.test(t) ? 7 : /\b(later today|this (morning|afternoon|evening)|tonight|in an hour|after (six|6))\b/i.test(t) ? 0 : null;
    out.win = /\bmorning\b/i.test(t) ? 'am' : /\bafternoon\b/i.test(t) ? 'pm' : /\b(evening|tonight|after (six|6))\b/i.test(t) ? 'eve' : null;
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
    { id: 'a1', title: 'Support troubleshooting and written English', kind: 'quiz', fam: 'support', pass: 70, mins: 20, practice: true, questions: [
      { q: 'A customer says the app logs them out every few minutes. What do you check first?', type: 'choice', options: ['Their session timeout settings', 'Their screen resolution', 'Their invoice history', 'The app’s colour theme'], right: 0, fails: 0.18 },
      { q: 'Which SQL finds the 10 most recent errors in a table called logs?', type: 'choice', options: ['SELECT * FROM logs ORDER BY created_at DESC LIMIT 10', 'SELECT TOP logs 10', 'GET logs LAST 10', 'SELECT * FROM logs WHERE 10'], right: 0, fails: 0.31 },
      { q: 'Write a two-sentence reply to a customer whose ticket you must escalate.', type: 'open', points: ['says it is escalated', 'says when they will hear back', 'polite and plain'], fails: 0.22 },
      { q: 'A bug only happens for one customer. What do you ask them for?', type: 'choice', options: ['Steps to reproduce, browser and a screenshot', 'Their password', 'Nothing, close it', 'Their manager’s number'], right: 0, fails: 0.12 },
      { q: 'What does an HTTP 502 usually mean?', type: 'choice', options: ['A server upstream gave a bad response', 'The page was not found', 'The user is not logged in', 'The request was too large'], right: 0, fails: 0.79 },
      { q: 'Put these in order of urgency: a typo on the help page, checkout is down, one user cannot reset a password.', type: 'open', points: ['checkout first', 'password second', 'typo last'], fails: 0.27 },
    ] },
    { id: 'a2', title: 'German language check', kind: 'live', fam: 'support', pass: 75, mins: 12, lang: 'German', level: 'C1', feedback: true, questions: [
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
  const IV_MODES = { person: 'In person', video: 'On Teams', aimy: 'With the AiMY agent', phone: 'By phone' };
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

  const DB = { reqs: [], cands: [], byReq: {}, byId: {}, reqById: {}, calls: [], msgs: [] };

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
      c.callback = 0; c.cbWin = 'eve'; c.fate = c.fate === 'german' ? 'german' : 'pass';
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
    seedApproval();
    seedAsmtTrust();
    seedStageDays();
    seedMsgs();
  }
  /* ── WhatsApp so far (Interactions, 5 Nov) ── three threads on the
     recruiter's own desk, each with someone who opted in: a reply to the
     message after a missed call, a question from yesterday evening, and an
     interview reminder answered two days ago, which needs nothing more and
     sits outside WhatsApp's 24 hours. Drawn after everything else and from
     no random stream, so no other record moves. */
  function seedMsgs() {
    DB.msgs = [];
    let n = 0;
    const M = (c, dir, day, time, text, x) => DB.msgs.push(Object.assign({ id: 'm' + (++n), cand: c.id, dir: dir, day: day, time: time, text: text, by: dir === 'out' ? ME : null }, x || {}));
    const mine = DB.cands.filter((c) => !c.exit && DB.reqById[c.req].rec === ME && !CLOSED[DB.reqById[c.req].state] && DB.reqById[c.req].state !== 'hold');
    const optIn = (c) => { if (!c.wa) { c.wa = true; c.waDay = -6; } };
    const tried = mine.filter((c) => c.stage === 'applied' && DB.calls.some((t) => t.cand === c.id && t.day === 0 && t.outcome === 'noanswer'))[0];
    if (tried) {
      optIn(tried); tried.fuDay = 0;
      const q = DB.reqById[tried.req];
      M(tried, 'out', 0, '11:16', 'Hi ' + first(tried.name) + ', this is ' + first(RECRUITERS[0].name) + ' from FlairsTech about the ' + q.title + ' role. I tried to call you just now. When is a good time to talk?', { tpl: 'talk' });
      M(tried, 'in', 0, '11:40', 'Hi, yes I can talk after 4pm today. Thank you!');
    }
    const asks = mine.filter((c) => c.stage === 'phone' && c !== tried)[0];
    if (asks) { optIn(asks); M(asks, 'in', -1, '18:10', 'Hello, is the ' + DB.reqById[asks.req].title + ' role hybrid or fully in the office?'); }
    const booked = mine.filter((c) => c.stage === 'hr')[0];
    if (booked) {
      optIn(booked);
      M(booked, 'out', -2, '10:00', 'Hi ' + first(booked.name) + ', a reminder of your HR interview for ' + DB.reqById[booked.req].title + '. Reply here if the time no longer works. ' + first(RECRUITERS[0].name) + ', FlairsTech', { tpl: 'iv' });
      M(booked, 'in', -2, '10:20', 'Thank you, see you then.', { done: true });
    }
    /* Two interviews still to book (Outlook, 5 Nov): AiMY books most of
       them under the HR Manager's rule, so without these the seed has
       nobody for a person to book. Taken from interviews booked for a later
       day, never today's. */
    mine.filter((c) => c !== booked && (c.stage === 'hr' || c.stage === 'tech') && c.meet != null && c.meet > 0).slice(0, 2).forEach((c) => {
      DB.ivs = DB.ivs.filter((v) => !(v.cand === c.id && v.stage === c.stage));
      c.meet = null; c.slot = null; c.fb = false;
    });
    /* On Teams (5 Nov): today's first interview, so it can be joined from
       the diary, and the oldest result still owed, so its recording is
       shown come back from Teams by itself. */
    const today1 = DB.ivs.filter((v) => v.status === 'booked' && v.day === 0 && mine.some((c) => c.id === v.cand)).sort((a, b) => a.slot.localeCompare(b.slot))[0];
    if (today1) today1.mode = 'video';
    const late1 = DB.ivs.filter((v) => v.status === 'owed' && v.by.split(',')[0] !== RECRUITERS[0].name && mine.some((c) => c.id === v.cand)).sort((a, b) => a.day - b.day)[0];
    if (late1) late1.mode = 'video';
  }
  /* Days spent at each stage a person has finished (`took`), drawn from
     their id and their requisition's own pace rather than the random
     stream, so nothing else moves. Most requisitions run a stage at about
     its usual pace; about one stage in four runs slow (a busy interviewer,
     a quiet client), which is what stage health reads. Someone still at a
     stage has `since` instead: their days there so far. */
  function seedStageDays() {
    const h = (t) => { let x = 7; for (let i = 0; i < t.length; i++) x = (x * 31 + t.charCodeAt(i)) >>> 0; return x; };
    const u = (t) => (h(t) % 1000) / 1000;
    DB.cands.forEach((c) => {
      const q = DB.reqById[c.req], t = TEMPLATE[q.tpl];
      const end = t.indexOf(c.maxAt) + (c.exit ? 1 : 0);
      c.took = {};
      for (let i = 0; i < end; i++) {
        const k = t[i], exp = STAGE[k].exp;
        if (!exp) continue;
        const p = u(q.id + k), pace = p < 0.74 ? 0.7 + p * 0.65 : 1.3 + (p - 0.74) * 2.4;
        c.took[k] = Math.max(0, Math.round(exp * pace * (0.6 + u(c.id + k) * 0.8)));
      }
    });
  }
  /* Consent and integrity on the seeded results, drawn from each result's
     id rather than the random stream, so nothing else moves. Most agreed
     to AiMY scoring; about one in nine asked for a person; about one in
     four carries an integrity flag; a few asked for a review after. */
  function seedAsmtTrust() {
    const h = (t) => { let x = 7; for (let i = 0; i < t.length; i++) x = (x * 31 + t.charCodeAt(i)) >>> 0; return x; };
    DB.sends.forEach((x) => {
      if (x.status !== 'done') return;
      const n = h(x.id + 'trust'), a = DB.asmts.filter((y) => y.id === x.asmt)[0];
      x.consent = n % 9 === 0 ? 'person' : 'ai';
      x.reviewed = x.consent === 'person' && n % 2 ? { by: DB.reqById[DB.byId[x.cand].req].rec, day: Math.min(0, x.doneDay + 1) } : null;
      x.review = x.consent === 'ai' && n % 13 === 5 ? 'asked' : null;
      const q = n % a.questions.length;
      x.flags = n % 4 !== 1 ? [] : [n % 3 === 0 ? { k: 'paste', q: q } : n % 3 === 1 ? { k: 'fast', mins: Math.max(2, Math.round(a.mins / 4)) }
        : a.kind === 'live' ? { k: 'voice', q: q } : { k: 'away', n: 2 + (n % 3) }];
    });
  }
  /* One requisition waits on the BU Director, so the approver's desk has
     its case: three new seats at once, not replacements. Built without
     the random stream, so nothing else in the corpus moves. */
  function seedApproval() {
    const role = ROLES[4], acc = ACCOUNTS[0];
    const q = { id: 'r' + (DB.reqs.length + 1) + 'a', title: role.title, fam: role.fam, level: role.level, must: role.must.slice(), acc: acc.id, tpl: acc.tpl, hm: acc.hm,
      rec: ME, seats: 3, kind: 'new', billable: true, state: 'draft', opened: 0, target: 35, place: 'Nasr City office', plan: null, domain: acc.domain, published: false,
      budget: { min: 14000, max: 20000 }, asmt: 'a1', askedBy: ME,
      desc: 'We are hiring 3 people as Customer Support Agent for Northwind Software, a software client. You will answer customers by ticket and phone, work out what broke, and fix it or hand it on with everything the next person needs.' };
    const ex = reqExceptions(q);
    q.approval = { day: -1, by: ME, says: ex.map((x) => x.say(q)), wait: ex.map((x) => x.who).filter((x, i, a) => a.indexOf(x) === i), ok: [], back: null };
    DB.reqs.push(q); DB.reqById[q.id] = q; DB.byReq[q.id] = [];
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
  const fresh = () => ({ c: {}, calls: [], msgs: [], waDone: {}, added: [], x: {}, tpl: {}, auto: {}, autoLog: [], news: [], lists: [] });
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
    D.msgs = D.msgs || []; D.waDone = D.waDone || {};
    D.flags = D.flags || []; D.searches = D.searches || []; D.searchRun = D.searchRun || {}; D.searchGone = D.searchGone || [];
    Object.keys(D.tpl).forEach((k) => { TEMPLATE[k] = D.tpl[k].slice(); });
    /* A SENT ANSWER LASTS UNTIL THE PROTOTYPE RESTARTS (Engy, 29 Oct), so
       the send can be shown again: everyone it went to is owed it again on
       load, and its "Told by" line leaves their history. Nothing else a
       person did is undone; Reset to seed does that. */
    /* Only answers sent from a message: someone told on the call itself
       (logged as not a fit) stays told. */
    const ev = (D.x && D.x.events) || {};
    Object.keys(ev).forEach((id) => {
      const e = ev[id];
      if (!e._new || e.kind !== 'out' || !/^Told by /.test(e.text || '')) return;
      if (D.c[e.cand] && D.c[e.cand].told === true) D.c[e.cand].told = false;
      delete ev[id];
    });
    save();
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
    D.msgs.forEach((m) => DB.msgs.push(m));
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
  /* The interviewer and the hiring manager are nudged on Teams, the client
     by email, the candidate the way they opted in to (5 Nov). */
  const nudgeTo = (c) => {
    const w = waitsOn(c), q = reqOf(c), v = ivNow(c);
    return w === 'client' ? (accOf(q).id === 'northwind' ? first(DESKS.jana.name) : accOf(q).name) : w === 'hm' ? first(hmOf(q).name) : w === 'candidate' ? first(c.name) : v ? first(v.by.split(',')[0]) : 'the interviewer';
  };
  const nudgeSay = (c) => {
    const w = waitsOn(c);
    return w === 'client' ? 'Nudge ' + nudgeTo(c) : w === 'candidate' ? 'Nudge ' + first(c.name) : 'Nudge ' + nudgeTo(c) + ' on Teams';
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

  /* ── Stage health, per stage, over one requisition or many ──
     For each stage: how many reached it, how many are there now, how many
     moved on of those decided there (people still there are left out, so a
     busy stage is not read as a leaky one), and the days spent in it,
     counting those still there at their days so far. Each is set against
     the usual: STAGE.exp for days, PASS for moving on (FlairsTech's own
     funnel, Aug–Sep 2026). Rule-based, nothing predictive, and judged only
     on three people or more; fewer is said as too few, never guessed. */
  const HEALTH = { ok: 'On pace', warn: 'Watch', err: 'Behind', few: 'Too few to judge' };
  const HEALTH_CLS = { ok: 'is-ok', warn: 'is-warn', err: 'is-err', few: 'is-few' };
  function stageStats(reqs, ks) {
    return ks.map((k) => {
      let on = 0, n = 0, passed = 0, left = 0, here = 0;
      const d = [];
      reqs.forEach((q) => {
        const rk = rank(q, k);
        if (rk < 0) return;
        on++;
        DB.byReq[q.id].forEach((c) => {
          const r = rank(q, c.maxAt);
          if (r < rk) return;
          n++;
          const took = c.took && c.took[k] != null ? c.took[k] : null;
          if (r > rk) { passed++; if (took != null) d.push(took); }
          else if (c.exit) { left++; if (took != null) d.push(took); }
          else if (c.stage === k) { here++; d.push(c.since); }
        });
      });
      const decided = passed + left, exp = STAGE[k].exp, norm = PASS[k];
      const rate = decided ? passed / decided : null;
      const avg = d.length ? d.reduce((s, x) => s + x, 0) / d.length : null;
      const tR = d.length >= 3 && exp ? avg / exp : null;
      const pR = decided >= 3 && norm ? rate / norm : null;
      const toneOf = (x, slow) => (x == null ? null : slow ? (x > 1.5 ? 'err' : x > 1.15 ? 'warn' : 'ok') : (x < 0.7 ? 'err' : x < 0.9 ? 'warn' : 'ok'));
      const tT = toneOf(tR, true), pT = toneOf(pR, false);
      const tone = !tT && !pT ? 'few' : tT === 'err' || pT === 'err' ? 'err' : tT === 'warn' || pT === 'warn' ? 'warn' : 'ok';
      return { k: k, on: on, n: n, here: here, passed: passed, decided: decided, rate: rate, avg: avg, days: d.length, exp: exp, norm: norm, tT: tT, pT: pT, tone: tone };
    });
  }
  /* The stages a set of requisitions runs, in order: a stage one template
     has and another does not (a managerial round on FlairsTech's own roles)
     is kept, and says how many of the requisitions it is on. */
  const stagesOf = (reqs) => STAGE_ORDER.filter((k) => k !== 'joined' && reqs.some((q) => rank(q, k) >= 0));
  /* Why a stage has the colour it has, in one sentence. */
  function healthSay(s) {
    if (s.tone === 'few') return 'Fewer than three people have been through it, so it is not judged yet.';
    const dd = (x) => days(Math.round(x * 10) / 10);
    const bits = [];
    if (s.tT && s.tT !== 'ok') bits.push('slow, ' + dd(s.avg) + ' against a usual ' + days(s.exp));
    if (s.pT && s.pT !== 'ok') bits.push('fewer move on, ' + Math.round(s.rate * 100) + '% against a usual ' + Math.round(s.norm * 100) + '%');
    return bits.length ? bits.join('; ').replace(/^./, (x) => x.toUpperCase()) + '.' : 'Near the usual on ' + (s.tT && s.pT ? 'both time and moving on' : s.tT ? 'time' : 'moving on') + '.';
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

  /* WHAT EACH MUST-HAVE STANDS ON NOW (5 Nov): the CV's reading, overruled
     by the deepest interview that rated it, and capped by their years where
     the must-have asks for more ("2+ years" is not met by one). The card's
     read and the write-up both say this, so they cannot disagree. */
  const yearsAsked = (m) => { const x = /^(\d+)\+ years?/.exec(m); return x ? Number(x[1]) : 0; };
  function evNow(c) {
    const q = reqOf(c), v = verified(c);
    return q.must.map((m, i) => {
      let e = v[i].state === 'verified' ? 'm' : v[i].state === 'unproven' ? c.ev[i] : 'p';
      if (yearsAsked(m) > c.years && e === 'm') e = 'p';
      return e;
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
        text: 'Finished the assessment: ' + scoreSay(a, x) + '.' + (x.flags && x.flags.length ? ' Integrity: ' + flagsOf(a, x).join('; ') + '.' : '') });
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

  /* WHO TO CALL. Callbacks someone asked for come first (one whose window
     today has not opened waits at the end), then the phone
     screens that are due, longest waiting first, then the people who
     applied and have not been called yet. Nobody who asked not to be called,
     and nobody whose number did not work. */
  function toCall() {
    const out = [];
    myOpen().forEach((q) => activeOf(q).forEach((c) => {
      if (!canCall(c)) return;
      /* Asked for a later day: not today's call, whatever their stage. */
      if (c.callback != null && c.callback > 0) return;
      if (c.callback != null && c.callback <= 0) out.push({ c: c, why: 'callback', rank: cbLater(c) ? 3 : 0 });
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
  const KEYS = ['as', 'on', 'req', 'cand', 'asmt', 'acc', 'q', 'p', 'list', 'find', 'edit', 'th', 'lg', 'apply', 'me', 'take', 'debrief', 'approve', 'by', 'src', 'period', 'account', 'rq', 'day', 'st', 'ch'];
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
    /* A link to one chapter of the reports lands on it, once; the filters
       after it do not carry it on. */
    if (S.ch) { const k = S.ch; delete S.ch; history.replaceState(null, '', urlOf(S)); toChapter(k, true); }
  }
  function toChapter(k, now) {
    const t = byId('rpt-' + k);
    if (!t) return;
    const still = now || matchMedia('(prefers-reduced-motion: reduce)').matches;
    t.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    const h = t.querySelector('.t-ch-h');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    t.classList.remove('is-lit'); void t.offsetWidth; t.classList.add('is-lit');
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

  /* ── THE RAIL, IN SALES'S FORM (Engy, 5 Nov: "use sales method in the
     left rail"; AiMY UI side-nav, the default variant, 1.4.0, from Sales's
     railNav and tabRead, bdr.css 111, Sales d24d176). One card at the top
     of the rail, a row per page with its icon, name and count. The page you
     are on is the tinted block, and it opens to hold AiMY's reading of that
     page: where it stands in Sales's words, one sentence with the numbers
     in bold, the figures behind it as pills, and one way in. Changing page
     closes the old reading while the new one opens. It replaced QA's open
     side nav (4 Nov) and its collapsed form (5 Nov). ── */
  const TAB_ICO = { '': 'home', cands: 'users', reqs: 'req', calls: 'msg', diary: 'cal', asmts: 'goal', templates: 'doc', reports: 'bars' };
  /* Every reading stays in the rail, shut unless you are on its page, so a
     change of page can close one while the next opens (grid rows 0fr to
     1fr). The rail is painted again on each change, so the row you left is
     put back open for a frame and the two swap. */
  function putRail(html) {
    const rail = byId('appRail');
    const was = [].indexOf.call(rail.querySelectorAll('.snav-tab'), rail.querySelector('.snav-tab.is-on'));
    const n = rail.querySelectorAll('.snav-tab').length;
    rail.innerHTML = html;
    const rows = rail.querySelectorAll('.snav-tab');
    const now = [].indexOf.call(rows, rail.querySelector('.snav-tab.is-on'));
    if (was < 0 || was === now || rows.length !== n || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    rows[was].classList.add('is-on');
    if (now >= 0) rows[now].classList.remove('is-on');
    void rail.offsetWidth;
    rows[was].classList.remove('is-on');
    if (now >= 0) rows[now].classList.add('is-on');
  }
  /* THE DIARY, A CARD OF ITS OWN UNDER THE TABS (Engy, 5 Nov: "show the
     card of the diary alone like sales"). AiMY UI 1.4.0's diary door
     (RailDoor, the Rail doors page; Sales's diaryDoor): captioned Diary,
     what is next today at the size of a figure with a clock before it, who
     and what under it, and Open, since the caption already names the page.
     No sentence under it, as the library draws it. A clear day says so, and
     how much is ahead. */
  function diaryDoor() {
    const left = diaryItems(0, 0).filter((m) => !m.done && m.kind !== 'owed')
      .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
    const nx = left[0];
    /* On the Diary, the card is the page you are on: the tabs' tint and
       aria-current, as the tab it replaced had. */
    const on = S.on === 'diary';
    const door = (inner) => '<div class="rail-doors"><button class="' + (on ? 'b-door is-on' : 'b-door') + '" type="button"' + goAttr({ on: 'diary' }) + (on ? ' aria-current="page"' : '') + '>' +
      '<span class="b-door-cap">Diary</span> ' + inner + ' <span class="b-door-go">Open' + svg('go', 13) + '</span></button></div>';
    if (!nx) {
      const ahead = diaryItems(1, 14).length;
      return door('<span class="b-door-who">Nothing is in the diary <span class="b-kind">' + (ahead ? plural(ahead, 'thing') + ' in the fortnight ahead' : 'nor in the fortnight ahead') + '</span></span>');
    }
    return door((nx.time ? '<span class="b-door-fig"><span class="b-door-clock" aria-hidden="true">' + svg('clock', 24) + '</span>' + esc(nx.time) + '</span> ' : '') +
      '<span class="b-door-who">' + esc(nx.c.name) + ' <span class="b-kind">' + esc(nx.what) + '</span></span>');
  }
  /* Reports' reading: the story's speed, and where people are lost. */
  function railStory() {
    const sto = deskStory();
    if (!sto || sto.actual == null) return null;
    const late = sto.actual > SEND_TARGET;
    return { state: 'Found', tone: late ? 'warn' : 'ok',
      say: 'The first profile goes <b>' + days(sto.actual) + '</b> after a requisition opens; the target is <b>' + SEND_TARGET + '</b>.',
      ev: sto.off ? [{ val: (sto.off.decided - sto.off.passed) + '/' + sto.off.decided, cap: sto.off.k === 'offer' ? 'offers turned down' : 'lost at ' + STEP_SAY[sto.off.k] }] : [],
      act: { label: 'Read the story', go: { on: 'reports', ch: 'speed' } } };
  }
  function paintDeskRail() {
    const a = asks();
    const reqs = deskReqs().filter((q) => q.state !== 'draft');
    const open = reqs.filter(isOpen);
    const risky = open.filter((q) => health(q).risk);
    const filled = reqs.filter((q) => q.state === 'filled' || q.state === 'started').length;
    const qn = isHR() ? queue().length : 0;
    putRail(sideNav({
      '': isHR()
        ? { state: 'Found', tone: risky.length ? 'err' : 'ok',
            say: risky.length ? '<b>' + risky.length + ' of ' + open.length + '</b> open requisitions are likely to miss their date.' : 'Every open requisition is on course for its date.',
            act: risky.length ? { label: 'Show the ' + risky.length, start: 'risk' } : null }
        : a.length
          ? { state: 'Awaiting you', tone: 'warn', say: '<b>' + plural(a.length, 'thing') + '</b> ' + (a.length === 1 ? 'waits' : 'wait') + ' on you. First: ' + esc(a[0].head) + '.', act: { label: a[0].verb || 'Open it', go: a[0].go } }
          : { state: 'Done', tone: 'ok', say: 'Nothing waits on you.' },
      cands: qn ? { state: 'Awaiting you', tone: 'warn', say: '<b>' + plural(qn, 'person', 'people') + '</b> on the open requisitions.', act: { label: 'Show who waits on you', go: { on: 'cands', q: 'me' } } } : null,
      reqs: { state: 'Found', tone: 'ok', say: '<b>' + open.length + ' open</b>' + (isClient() ? '.' : ', and <b>' + filled + '</b> filled.') },
      reports: isClient() ? null : railStory(),
    }) + (isHM() ? diaryDoor() : ''));
  }
  function paintRail() {
    if (!isRec()) { paintDeskRail(); return; }
    const d = decisions();
    const open = myOpen();
    const people = open.reduce((n, q) => n + activeOf(q).length, 0);
    const t = today();
    const avg = avgSent(mine());
    const team = avgSent(DB.reqs);
    const client = waits().filter((c) => waitsOn(c) === 'client');
    const tc = toCall(), miss = missed().length, cb = tc.filter((x) => x.why === 'callback').length, wa = waOwed().length;
    const me = queue().filter((c) => queueCut(c) === 'me').length;
    putRail(sideNav({
      '': d.length
        ? { state: 'Awaiting you', tone: 'warn', say: '<b>' + plural(d.length, 'result') + '</b> ' + (d.length === 1 ? 'waits' : 'wait') + ' on your call, the oldest <b>' + days(d[0].since) + '</b>.',
            ev: [{ val: t.length, cap: t.length === 1 ? 'interview today' : 'interviews today' }], act: { label: 'Decide the oldest one', start: 'decide' } }
        : { state: 'Done', tone: 'ok', say: 'Nothing waits on your call.', ev: [{ val: t.length, cap: t.length === 1 ? 'interview today' : 'interviews today' }] },
      cands: { state: me ? 'Awaiting you' : 'Done', tone: me ? 'warn' : 'ok',
        say: '<b>' + plural(me, 'person', 'people') + '</b> ' + (me === 1 ? 'waits' : 'wait') + ' on you, of <b>' + people + '</b> on your open requisitions.',
        act: me ? { label: 'Show the ' + me, go: { on: 'cands', q: 'me' } } : null },
      reqs: { state: 'Found', tone: avg != null && avg > team ? 'warn' : 'ok',
        say: '<b>' + open.length + ' open</b>' + (avg != null ? '; your first profile goes in <b>' + days(avg) + '</b>, the team’s in ' + days(team) + '.' : '.'),
        ev: client.length ? [{ val: client.length, cap: 'owed an answer by clients' }] : [],
        act: client.length ? { label: 'Show the ' + client.length + ' with clients', go: { on: 'reqs', q: 'client' } } : null },
      calls: tc.length || miss || wa
        ? { state: 'Awaiting you', tone: 'warn', say: '<b>' + plural(tc.length, 'person', 'people') + '</b> to reach' +
            (miss || wa ? ', ' + listSay([miss ? '<b>' + plural(miss, 'missed call') + '</b>' : null, wa ? '<b>' + plural(wa, 'WhatsApp reply', 'WhatsApp replies') + '</b>' : null].filter(Boolean)) : '') + '.',
            ev: cb ? [{ val: cb, cap: cb === 1 ? 'callback due today' : 'callbacks due today' }] : [],
            act: miss || wa ? { label: 'Open the inbox', go: { on: 'calls', q: 'inbox' } } : { label: 'Call the next one', start: 'screen' } }
        : { state: 'Done', tone: 'ok', say: 'Nobody is waiting on you to call or reply.' },
      reports: railStory(),
    }) + diaryDoor());
  }

  /* ── The briefing, on Today only. Sales opens a desk on it; every other
     tab's heading is its tab switcher, with cuts and cards under it (Sales
     handoff, 'The page title is the tab switcher'). It stood above
     Requisitions and Calls as well until 28 Oct. ── */
  function topBrief() {
    const d = decisions(), w = waits(), t = today();
    const client = w.filter((c) => waitsOn(c) === 'client');
    const oldest = d[0];
    const lines = [];
    /* Today's interviews open in the Diary. A requisition likely to miss
       its date is the hiring manager's to say (Engy, 29 Oct). */
    /* One fact a sentence (5 Nov). "Results wait on your call", not
       "decisions wait on you": Candidates' "wait on you" counts everyone
       with a next step of yours, a different, larger set. */
    lines.push(d.length
      ? '<b>' + plural(d.length, 'result') + '</b> ' + (d.length === 1 ? 'waits' : 'wait') + ' on your call, the oldest <b>' + days(oldest.since) + '</b>.'
      : 'No result waits on your call.');
    if (t.length) lines.push('<button class="slv-n" type="button"' + goAttr({ on: 'diary' }) + '>' + plural(t.length, 'interview') + '</button> today, the first at <b>' + esc(t[0].slot) + '</b> with ' + esc(t[0].name) + '.');
    if (client.length) {
      lines.push('Clients owe an answer on <button class="slv-n" type="button"' + goAttr({ on: 'reqs', q: 'client' }) + '>' + plural(client.length, 'candidate') + '</button>' +
        ', the oldest waiting <b>' + days(client[0].since) + '</b>.');
    }
    const tc = toCall();
    const miss = missed();
    const waN = waOwed().length;
    if (waN && !miss.length) lines.push('<button class="slv-n" type="button"' + goAttr({ on: 'calls', q: 'inbox' }) + '>' + plural(waN, 'WhatsApp reply', 'WhatsApp replies') + '</button> ' + (waN === 1 ? 'waits' : 'wait') + ' on you.');
    if (miss.length) {
      lines.push('<button class="slv-n" type="button"' + goAttr({ on: 'calls', q: 'inbox' }) + '>' + plural(miss.length, 'person', 'people') + '</button>' +
        ' called and got nobody' + (waN ? ', <button class="slv-n" type="button"' + goAttr({ on: 'calls', q: 'inbox' }) + '>' + plural(waN, 'WhatsApp reply', 'WhatsApp replies') + '</button> ' + (waN === 1 ? 'waits' : 'wait') : '') + (tc.filter((x) => x.why === 'callback').length ? ', and <b>' + plural(tc.filter((x) => x.why === 'callback').length, 'callback') + '</b> ' +
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
      '<div class="s-starts-wrap"><div class="s-starts">' +
        starts.map((s) => '<button class="s-start" type="button" data-start="' + s.k + '">' +
          '<span class="s-start-top"><span class="s-start-label">' + esc(s.label) + '</span>' +
            '<span class="s-start-n">' + (s.n || '​') + '</span></span>' +
          '<span class="s-start-why">' + esc(s.why) + '</span></button>').join('') +
      '</div></div>' +
    '</section>';
  }

  /* ── THE TABS LIVE IN THE RAIL (Engy, 4 Nov: "it's the same"). The row
     of tabs over each page and the rail's cards beside it pointed at the
     same places, the Diary, Calls and Requisitions twice. Now the rail is
     the one way round: every tab is a rail entry with its count, and what a
     rail card used to say (the next interview, a missed call) is the line
     under its entry. The page keeps its name as a plain heading. ── */
  const TAB_NAME = { '': 'Today', cands: 'Candidates', reqs: 'Requisitions', calls: 'Interactions', diary: 'Diary', asmts: 'Assessments', templates: 'Templates', reports: 'Reports' };
  function tabsFor() {
    const open = myOpen().length;
    /* Each desk's row is the work that desk does (Sales: a surface belongs
       to whoever does the verb on it). The Diary has no row: its card under
       the tabs is the way in (Engy, 5 Nov: "remove the tab of the diary and
       keep the widget"). */
    const n = {
      cands: isRec() || isHR() ? queue().length : null,
      reqs: open,
      calls: isRec() ? toCall().length : null,
    };
    const row = isRec() ? ['', 'cands', 'reqs', 'calls', 'asmts', 'reports'] : isHM() ? ['', 'reqs', 'reports'] : isBU() ? ['', 'reqs', 'reports']
      : isHR() ? ['', 'cands', 'reqs', 'asmts', 'templates', 'reports'] : ['', 'reqs'];
    return row.map((k) => ({ k: k, label: TAB_NAME[k], n: n[k] }));
  }
  function switcher(here) {
    return '<h2 class="s-block-h">' + esc(TAB_NAME[here] || 'Today') + '</h2>';
  }
  /* The rail's card, as AiMY UI's side-nav draws Sales's tabs. `reads`
     holds each tab's reading: { state, label?, tone, say, ev?, act? }, the
     state one of Sales's six words, tone warn, err or ok; `act` goes
     somewhere ({ go }) or starts something ({ start }). Away from a tab's
     own page (a requisition, a candidate), the tab it belongs under is the
     one you are on. */
  const READ_TONE = { warn: 'snav-read-state', err: 'snav-read-state is-err', ok: 'snav-read-state is-ok' };
  function readHtml(r) {
    return '<p class="' + READ_TONE[r.tone || 'warn'] + '">' + esc(r.label || r.state) + '</p>' +
      '<p class="snav-read-text">' + r.say + '</p>' +
      (r.ev && r.ev.length ? '<ul class="snav-read-evidence">' + r.ev.map((e) => '<li class="snav-read-pill"><span class="snav-read-val">' + esc(String(e.val)) + '</span> ' + esc(e.cap) + '</li>').join('') + '</ul>' : '') +
      (r.act ? '<button class="snav-read-act" type="button"' + (r.act.start ? ' data-start="' + r.act.start + '"' : goAttr(r.act.go)) + '>' + esc(r.act.label) + '</button>' : '');
  }
  function sideNav(reads) {
    const tabs = tabsFor(), on = S.on || '';
    const here = on && tabs.some((t) => t.k === on) ? on : S.cand || on === 'find' || on === 'draft' || on === 'add' ? 'cands' : S.req || S.acc ? 'reqs' : S.asmt ? 'asmts' : on ? null : '';
    return '<div class="snav-tabs"><ul>' + tabs.map((t) => {
      const cur = t.k === here, r = reads[t.k];
      return '<li class="' + (cur ? 'snav-tab is-on' : 'snav-tab') + '">' +
        '<button class="snav-tab-link" type="button"' + goAttr(t.k ? { on: t.k } : {}) + (cur ? ' aria-current="page"' : '') + ' title="' + esc(t.label + (t.n ? ', ' + t.n : '')) + '">' +
          '<span class="snav-tab-icon" aria-hidden="true">' + svg(TAB_ICO[t.k], 16) + '</span><span class="snav-tab-name">' + esc(t.label) + '</span>' +
          (t.n ? ' <span class="snav-tab-n">' + t.n + '</span>' : '') + '</button>' +
        (r ? '<div class="snav-tab-read"' + (cur ? '' : ' inert') + '><div class="snav-tab-read-in"><div class="snav-tab-body">' + readHtml(r) + '</div></div></div>' : '') +
      '</li>';
    }).join('') + '</ul></div>';
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
      openQ('Open with', 'Say who is in the room and that it takes about 45 minutes. ' + (v && v.mode === 'video' ? 'Teams tells them it is recording; the recording and transcript come back here when it ends.' : 'Ask if they are happy for it to be recorded; nothing is recorded until they agree.')) +
      (tpl ? openQ('The agenda · ' + tpl.title, tpl.items.map((x) => esc(x)).join('<br>')) : '') +
      (probe.length ? openQ('Probe', esc(probe.join('; ')) + '. Ask for an example of each.') : '') +
      (done.length ? openQ('Already confirmed', esc(done.join('; ')) + '. No need to cover it again.') : '') +
      openQ('What they told us', said.length ? esc(said.join(', ')) + '.' : last ? esc(callSay(last)) : 'Nothing yet beyond the CV.') +
      openQ('Your verdict', 'Rate each must-have, then say proceed or not. AiMY never fills it, and other interviewers’ feedback stays hidden until you send yours.') +
    '</div>';
    callChat(null, 'Before you interview ' + c.name);
    callTurn({ who: 'aimy', html: answerBlock('Before you interview ' + c.name, body, plural(ivsOf(c).filter((x) => x.status === 'done').length, 'interview') + ' so far') +
        (v && v.mode === 'video' ? '<p class="t-acts">' + teamsJoin(v) + '</p>' : ''),
      acts: [{ label: 'Open their record', go: { cand: c.id } }] });
  }

  /* ── TODAY ── */
  /* ══ WHAT AIMY NOTICED (from the standalone recruiter home, 29 Oct) ══════
     The information from that home that this system holds, said as Sales's
     insight: AiMY's mark, a work state, one sentence with its facts in
     bold, and one button that opens the chat with the question asked and
     answered from the record. Small, two to a row. */
  let CHAT_Q = {}, CHAT_N = 0;
  function insightRow(o) {
    const k = o.k || 'q' + (++CHAT_N);
    CHAT_Q[k] = { q: o.q, html: o.a, acts: o.acts || [] };
    return '<div class="s-insight t-insight">' +
      '<svg class="s-insight-mark" viewBox="0 0 18 20" aria-hidden="true"><use href="#aimy-logo-small"/></svg>' +
      (o.ws ? '<span class="work-state ws-' + o.ws + '"><span class="ws-dot"></span>' + esc(o.wsSay) + '</span>' : '') +
      '<p class="s-insight-txt">' + o.say + '</p>' +
      '<div class="s-insight-acts"><button class="t-ask" type="button" data-chat="' + k + '">' +
        '<span class="t-ask-mark" aria-hidden="true">' + mark(12) + '</span><span class="t-ask-text">' + esc(o.q) + '</span>' +
        '<span class="t-ask-go" aria-hidden="true">' + svg('send', 11) + '</span></button></div></div>';
  }
  /* THE QUESTION GOES TO THE BAR (standalone prototype, 29 Oct): pressed, it
     lifts out of the insight and lands in the AiMY bar it is about to fill,
     then the chat opens on it. Reduced motion goes straight to the chat. */
  function flyToBar(btn, then) {
    const bar = byId('aimyFloatBar');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !bar) { then(); return; }
    btn.classList.add('is-armed'); void btn.offsetWidth;
    const a = btn.getBoundingClientRect(), b = bar.getBoundingClientRect();
    if (!a.width || !b.width) { btn.classList.remove('is-armed'); then(); return; }
    const z = parseFloat(getComputedStyle(document.body).zoom) || 1;
    const fl = document.createElement('div');
    fl.className = 't-ask-flier';
    fl.innerHTML = btn.innerHTML;
    fl.style.left = (a.left / z) + 'px'; fl.style.top = (a.top / z) + 'px';
    document.body.appendChild(fl);
    btn.style.visibility = 'hidden';
    requestAnimationFrame(() => {
      const r = fl.getBoundingClientRect();
      fl.style.transform = 'translate(' + ((b.left + 52 - r.left) / z) + 'px, ' + ((b.top + b.height / 2 - (r.top + r.height / 2)) / z) + 'px) scale(0.97)';
      fl.style.opacity = '0.04';
    });
    setTimeout(() => { fl.remove(); btn.style.visibility = ''; btn.classList.remove('is-armed'); then(); }, 420);
  }
  const listSay = (l) => l.length > 1 ? l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1] : l[0] || '';
  function todayInsights() {
    const out = [], open = myOpen(), on = (c) => !!c && open.indexOf(reqOf(c)) >= 0;
    /* Results waiting on your call and today's interviews are the briefing's
       own lines and the Decide tile above; they came off here on 5 Nov so
       each fact is said once on the page. */
    /* First contact waiting on your yes (standalone: approval queue). */
    const fc = queue().filter((c) => c.stage === 'sourced' && !c.contactOk);
    if (fc.length) {
      const reqs = open.filter((q) => fc.some((c) => c.req === q.id)), wa = fc.filter(waAuto).length;
      out.push(insightRow({ ws: 'staged', wsSay: 'Your yes',
        say: '<b>' + plural(fc.length, 'person', 'people') + '</b> found ' + (fc.length === 1 ? 'is' : 'are') + ' waiting on your yes for first contact, on ' + plural(reqs.length, 'requisition') + '. ' + (connectOn() ? '<b>' + wa + '</b> opted in to WhatsApp; the rest get an email.' : 'Each gets an email.'),
        q: 'Who is waiting on first contact?',
        a: '<p>' + reqs.map((q) => '<b>' + esc(q.title) + '</b>: ' + esc(listSay(fc.filter((c) => c.req === q.id).map((c) => c.name))) + '.').join('<br>') + ' Each gets one short message naming the role, nothing about pay, once you approve.</p>',
        acts: [{ label: 'Open them', go: { on: 'cands', q: 'new' }, primary: true }] }));
    }
    /* Screening on the busiest requisition (standalone: lanes, not a ranking). */
    const early = (q, c) => rank(q, c.stage) <= rank(q, 'phone');
    const pick = open.map((q) => ({ q: q, l: activeOf(q).filter((c) => early(q, c)) })).sort((a, b) => b.l.length - a.l.length)[0];
    if (pick && pick.l.length >= 3) {
      const all = (c) => c.ev.every((e) => e === 'm'), unk = (c) => c.ev.filter((e) => e === 'n').length * 2 > c.ev.length;
      const strong = pick.l.filter(all), info = pick.l.filter((c) => !all(c) && unk(c)), talk = pick.l.filter((c) => !all(c) && !unk(c));
      out.push(insightRow({ ws: 'recommended', wsSay: 'Screening',
        say: 'On <b>' + esc(pick.q.title) + '</b>, ' + plural(pick.l.length, 'application') + ' ' + (pick.l.length === 1 ? 'is' : 'are') + ' under review: ' +
          (strong.length ? '<b>' + strong.length + '</b> show every must-have, ' : 'none shows every must-have yet, ') + '<b>' + talk.length + '</b> answer half or more, and <b>' + info.length + '</b> leave most unknown.',
        q: 'Where do the ' + pick.q.title + ' applications stand?',
        a: '<p>' + (strong.length ? '<b>Every must-have shown:</b> ' + esc(listSay(strong.map((c) => c.name))) + '.<br>' : '') +
          (talk.length ? '<b>Worth a conversation:</b> ' + esc(listSay(talk.map((c) => c.name))) + '.<br>' : '') +
          (info.length ? '<b>Needs info:</b> ' + esc(listSay(info.map((c) => c.name))) + '. The CV is silent on most of what matters, which is not a no.' : '') + '</p>',
        acts: [{ label: 'Open them', go: { on: 'cands', rq: pick.q.id }, primary: true }] }));
    }
    /* What is on the careers page (standalone: published on the website). */
    const off = open.filter((q) => !q.published);
    out.push(insightRow({ ws: 'detected', wsSay: 'Careers page',
      say: '<b>' + (open.length - off.length) + ' of ' + open.length + '</b> open requisitions are on the careers page.' + (off.length ? ' ' + esc(off[0].title) + (off.length > 1 ? ' and ' + plural(off.length - 1, 'other') + ' stay' : ' stays') + ' off; off is the default.' : ''),
      q: 'Which requisitions are off the careers page?',
      a: '<p>' + (off.length ? off.map((q) => '<b>' + esc(q.title) + '</b>, ' + esc(accOf(q).name)).join('<br>') + '<br>Off is the default; a client-linked replacement usually stays off.' : 'Every open requisition is on the careers page.') + '</p>',
      acts: [{ label: 'Open requisitions', go: { on: 'reqs' }, primary: true }] }));
    /* The reports' story, in one line, its chapters behind the question. */
    const sto = deskStory();
    if (sto && sto.chapters.length) out.push(insightRow({ ws: 'detected', wsSay: 'Reports',
      say: sto.head,
      q: 'What do my reports say?',
      a: '<p>' + sto.chapters.map((c) => '<b>' + esc(c.cap) + '.</b> ' + esc(c.title) + '.').join('<br>') + '</p>',
      acts: [{ label: 'Open the reports', go: { on: 'reports' }, primary: true }] }));
    /* What AiMY did without asking (standalone: the closing line). */
    const booked = DB.ivs.filter((v) => v.status === 'booked' && on(DB.byId[v.cand])).length;
    const tests = DB.sends.filter((x) => x.status === 'sent' && on(DB.byId[x.cand])).length;
    if (booked + tests) out.push(insightRow({ ws: 'completed', wsSay: 'Done for you',
      say: 'Under rules a person approved, AiMY has <b>' + plural(booked, 'interview') + '</b> booked with their kits' + (tests ? ' and <b>' + plural(tests, 'assessment') + '</b> out' : '') + '. Each has an undo.',
      q: 'What did you do without asking me?',
      a: '<p>' + plural(booked, 'interview') + ' booked inside the interviewers’ free slots, each with its kit sent' + (tests ? '; ' + plural(tests, 'assessment') + ' sent from the link on the requisition' : '') +
        '. Nothing reached a candidate outside a rule ' + esc(DESKS.dina.name) + ' approved, and each can be undone from the record it sits on.</p>' }));
    return out;
  }
  function homePage() {
    const owed = untold();
    const late = owed.filter((c) => c.since >= TELL_DAYS);
    const ins = todayInsights();
    /* The briefing, then what AiMY noticed that is said nowhere else, then
       Not told yet (Engy, 5 Nov: AiMY's read stays right under the
       briefing). Not told yet lost its "Reads" line, its explainer and the
       preview's own Send: the message shows once, the rows send, and one
       button sends to everyone. */
    const noticed = ins.length ? '<section class="s-block s-block-wide" aria-label="What AiMY noticed">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">What AiMY noticed</h2>' +
          '<span class="s-block-say">each opens in the chat, with the record behind it</span></div>' +
        '<div class="t-insights">' + ins.join('') + '</div>' +
      '</section>' : '';
    return '<div class="s-home">' +
      topBrief() +
      noticed +
      (owed.length ? '<section class="s-block s-block-wide" aria-label="Not told yet">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Not told yet</h2>' +
          '<span class="s-block-say">' + plural(owed.length, 'person', 'people') + ' owed an answer · ' + (late.length ? late.length + ' past the ' + TELL_DAYS + '-day limit' : 'all inside the ' + TELL_DAYS + '-day limit') + '</span></div>' +
        msgPreview(DB.byId[Object.keys(SEL.tell)[0]] || owed[0], false) +
        '<div class="b-owed">' + topN('tell', owed).map((c, i) => '<div class="b-owed-row t-row" style="--i:' + Math.min(i, 8) + '">' + selBox('tell', c.id, c.name) +
          '<button class="b-owed-main t-row-open" type="button" data-cand="' + c.id + '"><span class="b-owed-head"><span class="b-owed-type">' + esc(c.name) + '</span>' +
            '<span class="b-owed-by">' + esc(reqOf(c).title) + ' · ' + esc(accOf(reqOf(c)).name) + '</span>' + tag(EXIT[c.exit].label, c.since >= TELL_DAYS ? 'warn' : 'neutral') + '</span>' +
            '<span class="b-owed-body">' + esc(EXIT[c.exit].label) + ' ' + esc(sayWhen(-c.since)) + (c.decline ? ': ' + esc(lower(DECLINE_K[c.decline.why].label)) : '') + '. ' +
              (c.since >= TELL_DAYS ? '<b>Past the ' + TELL_DAYS + '-day limit.</b>' : 'Tell them by ' + esc(sayDay(TELL_DAYS - c.since)) + '.') + '</span></button>' +
          '<button class="b-owed-go t-row-go" type="button" data-tell="' + c.id + '">Send the answer</button></div>').join('') + '</div>' +
        moreLinks('tell', owed.length) +
        (selN('tell') ? batchBar('tell', '<button class="s-insight-lnk primary" type="button" data-tell-sel>Send the answer to ' + plural(selN('tell'), 'person', 'people') + '</button>')
          : owed.length > 1 ? '<p class="t-acts"><button class="s-insight-lnk primary" type="button" data-tell-all="' + owed.map((c) => c.id).join(',') + '">' + svg('send', 14) + 'Send the answer to all ' + owed.length + '</button></p>' : '') +
      '</section>' : '') +
      /* Today's interviews open in the Diary; waiting on others is gone (Engy,
         29 Oct); requisitions likely to miss their date are the hiring
         manager's, on their home. */
    '</div>';
  }
  /* ══ DECIDING, ONE AT A TIME (Engy, 5 Nov) ══════════════════════════════
     Today's Decide and Send profiles tiles named a person and then opened
     their requisition, its record above them and the card three screens
     down. Now they open a run, as Call them in order does: one card with
     the result and its own buttons, the rest named under it. Deciding takes
     the card out of the list, so the next one is simply the first left;
     Skip sets one aside for the end of this run. */
  let RUN = null;
  const runList = (k) => decisions().filter((c) => k !== 'send' || (c.stage === 'tech' && reqOf(c).tpl !== 'internal'));
  function decidePage() {
    const k = S.q === 'send' ? 'send' : 'decide';
    if (!RUN || RUN.k !== k) RUN = { k: k, total: runList(k).length, skip: {} };
    const all = runList(k), left = all.filter((c) => !RUN.skip[c.id]), skipped = all.length - left.length;
    const total = Math.max(RUN.total, all.length), c = left[0];
    const head = '<div class="b-topbar s-block-wide"><button class="s-back" type="button" data-home>Today</button></div>';
    const what = k === 'send' ? 'profile' : 'decision';
    if (!c) {
      const done = total - all.length;
      return '<div class="s-home">' + head + '<section class="s-block s-block-wide t-dec-end">' +
        '<h2 class="s-block-h">' + (done ? plural(done, what) + ' done' : 'Nothing is waiting on your call') + '</h2>' +
        '<p class="b-tocall">' + (skipped ? plural(skipped, 'one') + ' set aside in this run.' : 'Every result that was in has its answer.') + '</p>' +
        '<p class="t-acts">' + (skipped ? '<button class="b-ghost" type="button" data-run-again>Go through the ' + skipped + ' set aside</button>' : '') +
          '<button class="s-insight-lnk primary" type="button" data-home>Back to Today</button></p></section></div>';
    }
    const pos = total - all.length + skipped + 1;
    return '<div class="s-home">' + head +
      '<section class="s-block s-block-wide" aria-label="' + (k === 'send' ? 'Sending profiles' : 'Deciding') + '">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">' + (k === 'send' ? 'Send profiles' : 'Your decisions') + '</h2>' +
          '<span class="s-block-say">' + pos + ' of ' + total + ', oldest first</span></div>' +
        '<div class="t-dec-card">' + candCard(c, 0) + '</div>' +
        '<p class="t-acts t-dec-acts">' + (left.length > 1 ? '<span class="t-dec-next">Then ' + esc(listSay(left.slice(1, 4).map((x) => x.name)) + (left.length > 4 ? ' and ' + plural(left.length - 4, 'other') : '')) + '</span>' : '') +
          '<button class="b-ghost" type="button" data-run-skip="' + c.id + '">' + (left.length > 1 ? 'Skip for now' : 'Set it aside') + '</button></p>' +
      '</section></div>';
  }

  /* REQUISITIONS LIKELY TO MISS THEIR DATE, rule-based, each with its reason
     and the one move. The hiring manager's (Engy, 29 Oct). */
  function riskBlock(risky, act) {
    if (!risky.length) return '';
    return '<section class="s-block s-block-wide" aria-label="At risk">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Likely to miss their date</h2>' +
          '<span class="s-block-say">rule-based · the reason is on each row</span></div>' +
        srcNote([['Target date', false], ['Stage and date', false]]) +
        '<div class="b-owed">' + topN('risk', risky).map((x, i) => '<div class="b-owed-row t-row" style="--i:' + i + '">' +
          '<span class="b-owed-sev" aria-hidden="true"></span>' +
          '<button class="b-owed-main t-row-open" type="button"' + goAttr({ req: x.q.id }) + '><span class="b-owed-head"><span class="b-owed-type">' + esc(x.q.title) + '</span>' +
            '<span class="b-owed-by">' + esc(accOf(x.q).name) + '</span>' + tag('At risk', 'warn') + '</span>' +
            '<span class="b-owed-body">' + riskSay(x.q, x.h) + '</span></button>' +
          act(x.q, x.h) + '</div>').join('') + '</div>' +
        moreLinks('risk', risky.length, { label: 'Open all ' + risky.length + ' in Requisitions', go: { on: 'reqs', q: 'risk' } }) +
      '</section>';
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
  function candsPage() {
    const rqQ = S.rq && DB.reqById[S.rq] ? DB.reqById[S.rq] : null;
    /* A stage, when a report's funnel sent you here (?st=). */
    const stK = S.st && STAGE[S.st] ? S.st : null;
    const hit = (c) => (!rqQ || c.req === rqQ.id) && (!stK || c.stage === stK) && candHit(c, S.find);
    const everyone = queue(), owedAll = untold();
    const all = everyone.filter(hit), owed = owedAll.filter(hit);
    const cut = S.q === 'untold' || QCUTS.some((x) => x.k === S.q) ? S.q : 'all';
    const list = cut === 'untold' ? owed : cut === 'all' ? all : all.filter((c) => queueCut(c) === cut);
    const n = (k) => k === 'all' ? all.length : all.filter((c) => queueCut(c) === k).length;
    /* Cards only: the list view came out (Engy, 29 Oct). */
    const per = PAGE_N;
    const pages = Math.max(1, Math.ceil(list.length / per));
    const page = Math.min(pages - 1, Math.max(0, Number(S.p) || 0));
    const from = page * per, to = Math.min(list.length, from + per);
    const left = list.length - to;
    /* The search and the requisition ride on every link on this page. */
    const keep = (o) => goAttr(Object.assign({ on: 'cands', rq: S.rq, find: S.find, st: stK || undefined }, o));
    const narrowed = !!(rqQ || S.find || stK);
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
        '</div>' +
        '<div class="b-cuts b-cuts-row">' + QCUTS.map((x) => '<button class="filter-chip' + (x.k === cut ? ' active' : '') + '" type="button"' + keep({ q: x.k === 'all' ? undefined : x.k }) + '>' +
          esc(x.label) + '<span class="b-cut-n">' + n(x.k) + '</span></button>').join('') +
          '<button class="filter-chip t-cut-apart' + (cut === 'untold' ? ' active' : '') + '" type="button"' + keep({ q: 'untold' }) + '>Not told yet<span class="b-cut-n">' + owed.length + '</span></button>' +
        '</div>' +
        (narrowed ? '<p class="b-vfoot t-cf-on">Showing ' + (rqQ ? 'the people on ' + esc(rqQ.title) + ', ' + esc(accOf(rqQ).name) : stK ? 'everyone on your open requisitions' : 'everyone') +
          (stK ? ' at the ' + esc(lower(STAGE[stK].label)) + ' now' : '') + (S.find ? ' matching “' + esc(S.find) + '”' : '') + '. ' + clear + '</p>' : '') +
        /* Where the volume is, select many and act once (Batch bar, M7); the
           answer owed is shown as it will read (Message preview, M4). */
        (cut === 'untold' && owed.length ? msgPreview(DB.byId[Object.keys(SEL.tell)[0]] || owed[0], true) +
          (selN('tell') ? batchBar('tell', '<button class="s-insight-lnk primary" type="button" data-tell-sel>Send the answer to ' + plural(selN('tell'), 'person', 'people') + '</button>')
            : '<p class="t-acts"><button class="b-ghost" type="button" data-sel-all="tell">Select all ' + owed.length + '</button></p>') : '') +
        (cut === 'new' && list.length ? trustCard(list.filter((c) => /^Found on/.test(c.source) && !c.contactOk)) : '') +
        (cut === 'new' && list.length ? (selN('sourced') ? batchBar('sourced', '<button class="s-insight-lnk primary" type="button" data-contact-sel>Approve first contact for ' + plural(selN('sourced'), 'person', 'people') + '</button>')
            : '<p class="t-acts"><button class="b-ghost" type="button" data-sel-all="sourced">Select all ' + list.length + '</button></p>') : '') +
        (list.length ? '<div class="b-grid">' + list.slice(from, to).map((c, i) => '<div class="b-slot" style="--i:' + i + '">' + candCard(c, i) + '</div>').join('') + '</div>' +
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
    const wait = q.state === 'draft' && q.approval && !q.approval.back;
    const st = wait ? { label: 'Waiting for approval', tone: 'warn' } : REQ_STATE[stateOf(q)];
    const h = health(q);
    const act = activeOf(q);
    const sent = act.filter((c) => c.stage === 'sent' || c.stage === 'client').length;
    const f = funnel(q);
    const ws = worstStep(f);
    const clock = q.state === 'draft' ? 'not open yet' : CLOSED[q.state] ? 'closed' : q.state === 'hold' ? 'paused' : h.left >= 0 ? days(h.left) + ' left' : days(-h.left) + ' past the target';
    const sentTo = DB.byReq[q.id].filter((c) => rank(q, 'sent') >= 0 && rank(q, c.maxAt) >= rank(q, 'sent'));
    const read = wait ? 'Waiting on ' + esc(namesOf(waitingOn(q.approval))) + ', because of ' + esc(q.approval.says.join(', and ')) + '.'
      : q.state === 'draft' && q.approval && q.approval.back ? esc(DESKS[q.approval.back].name) + ' sent it back. Change it, then open it again.'
      : q.state === 'draft' ? 'A draft. Nothing happens until it is opened.'
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
      (h && !isClient() ? forecastHtml(q, h) : '') +
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
      : ws ? 'The biggest drop is after the ' + lower(STAGE[ws.from].label) + ': ' + ws.m + ' of ' + ws.n + ' reached the ' + lower(STAGE[ws.to].label) + '.' +
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
      (isClient() ? '' : rulerBlock(q) + funnelBlock(q)) +
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

  /* THE FUNNEL WITH STAGE HEALTH (position funnel ticket). One component
     for one requisition and for many: per stage, how many reached it (the
     bar, to scale against the most), how many moved on, and the days spent
     in it, each with its usual beneath it, and a health dot that the
     legend names. The colour is never alone: the off value is coloured
     too, and the row says why on hover. A row someone is at now is a
     door to them. */
  function stageFunnel(rows, o) {
    const top = Math.max(1, ...rows.map((s) => s.n));
    const dd = (x) => String(Math.round(x * 10) / 10);
    const val = (cap, tone, big, usual) => '<span class="t-sf-val' + (tone && tone !== 'ok' ? ' ' + HEALTH_CLS[tone] : '') + '"><span class="t-sf-cap">' + cap + '</span><b>' + big + '</b><span>' + usual + '</span></span>';
    const legend = '<div class="t-sf-legend">' +
      ['ok', 'warn', 'err', 'few'].map((t) => '<span class="t-sf-key"><span class="t-sf-dot ' + HEALTH_CLS[t] + '" aria-hidden="true"></span>' + HEALTH[t] + '</span>').join('') + '</div>';
    return '<div class="t-sf">' + legend +
      '<div class="t-sf-row t-sf-cols" aria-hidden="true"><span>Stage</span><span></span><span>Reached</span><span>Moved on</span><span>Days in stage</span></div>' +
      '<div role="list">' + rows.map((s) => {
        const door = o.drill ? o.drill(s) : '';
        const tag = door ? 'button' : 'div';
        const sub = [s.here ? s.here + ' here now' : '', o.of && s.on < o.of ? 'on ' + s.on + ' of ' + o.of : ''].filter(Boolean).join(' · ');
        const why = STAGE[s.k].label + ': ' + HEALTH[s.tone].toLowerCase() + '. ' + healthSay(s) + (door ? o.doorSay || ' Press to see who is here.' : '');
        return '<' + tag + ' class="t-sf-row' + (door ? ' t-sf-door' : '') + '"' + (door ? ' type="button"' + door : '') + ' role="listitem" title="' + esc(why) + '" aria-label="' + esc(why) + '">' +
          '<span class="t-sf-stage"><span class="t-sf-dot ' + HEALTH_CLS[s.tone] + '" aria-hidden="true"></span><span class="t-sf-name"><span class="t-sf-label">' + esc(STAGE[s.k].label) + '</span>' +
            (sub ? '<span class="t-sf-sub">' + esc(sub) + '</span>' : '') + '</span></span>' +
          '<span class="t-fn-track"><span class="t-fn-fill" style="width:' + (s.n / top * 100).toFixed(1) + '%"></span></span>' +
          '<span class="t-sf-num"><b>' + s.n + '</b></span>' +
          (s.decided ? val('Moved on', s.pT, Math.round(s.rate * 100) + '%', (s.decided < 3 ? s.decided + ' decided · ' : '') + 'usual ' + Math.round(s.norm * 100) + '%')
            : val('Moved on', null, 'None yet', 'usual ' + Math.round(s.norm * 100) + '%')) +
          (s.days ? val('Days in stage', s.tT, dd(s.avg) + (Math.round(s.avg * 10) === 10 ? ' day' : ' days'), (s.days < 3 ? plural(s.days, 'person', 'people') + ' · ' : '') + 'usual ' + s.exp)
            : val('Days in stage', null, 'None yet', 'usual ' + s.exp)) +
        '</' + tag + '>';
      }).join('') + '</div>' +
      (o.say ? aimyBlock(o.say) : '') +
    '</div>';
  }
  /* What AiMY reads off the funnel: the stage furthest off its usual, said
     with why; otherwise the lowest moving on among the stages it can judge. */
  function stageRead(rows, from) {
    const bad = rows.filter((s) => s.tone === 'err')[0] || rows.filter((s) => s.tone === 'warn')[0];
    if (bad) return { text: '<b>' + esc(STAGE[bad.k].label) + '</b> ' + (bad.tone === 'err' ? 'is behind' : 'is worth watching') + ': ' + esc(lower(healthSay(bad).charAt(0)) + healthSay(bad).slice(1)), from: from };
    const low = rows.filter((s) => s.decided >= 3).sort((a, b) => a.rate - b.rate)[0];
    return low ? { text: 'Every stage is near its usual. The fewest move on from the ' + esc(lower(STAGE[low.k].label)) + ': <b>' + Math.round(low.rate * 100) + '%</b>.', from: from } : null;
  }
  /* The requisition's own funnel. A stage with someone at it now opens the
     candidates below at that stage. */
  function funnelBlock(q) {
    const rows = stageStats([q], tplOf(q).filter((k) => k !== 'joined'));
    return '<section class="s-block s-block-wide" aria-label="Funnel">' +
      '<div class="s-camp-list-head"><h2 class="s-block-h">How far people got</h2>' +
        '<span class="s-block-say">everyone who reached each stage · who moved on · days in it</span></div>' +
      stageFunnel(rows, { drill: (s) => (s.here ? ' data-fdrill="' + s.k + '"' : ''), say: stageRead(rows, 'every candidate on it') }) +
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
  /* ── THE STORY SO FAR, AS A TRACK (Engy, 4 Nov: iteration 1 of
     deliverables/story-funnel-iterations.html, after AiMY Sales's "The
     story so far") ── The candidate's whole path on their requisition's own
     stages, not only the moments behind them: stages passed are filled and
     dated, the one they are at is an open ring (amber when it is past its
     usual time, said in words beside it), the ones ahead stay hollow. A
     dashed mark shows where the decision passes to the client, or to the
     hiring manager on FlairsTech's own roles. A way out branches off the
     stage they left from. The client's desk sees it from Profile sent, the
     part that is theirs. Dates are read back from the days each stage took. */
  /* Longer in the stage than it usually takes: the one thing the track colours amber. */
  const slowAt = (c) => !c.exit && c.stage !== 'joined' && c.stage !== 'accepted' && c.since > STAGE[c.stage].exp;
  /* Where a way out happened, as the end of a sentence. */
  const EXIT_AT = { sourced: 'before first contact', applied: 'at the application', sent: 'after the profile went', accepted: 'before day one' };
  const exitAt = (c) => EXIT_AT[c.stage] || 'at the ' + lower(STAGE[c.stage].label);
  const EXIT_TONE = { out: 'err', clientno: 'err', offerno: 'err', withdrew: 'neutral' };
  /* Written out whole, so each class reads as itself (and the audit can pair it with its rule). */
  const TONE_CLS = { neutral: 'tone-neutral', warn: 'tone-warn', ok: 'tone-ok', err: 'tone-err' };
  function storyTrack(c) {
    const q = reqOf(c), t = tplOf(q);
    const cur = t.indexOf(c.stage);
    if (cur < 0) return '';
    const took = c.took || {};
    const enter = {};
    let d = c.exit ? -c.since - (took[c.stage] || 0) : -c.since;
    enter[c.stage] = d;
    for (let i = cur - 1; i >= 0; i--) { d -= took[t[i]] != null ? took[t[i]] : STAGE[t[i]].exp; enter[t[i]] = d; }
    const from = isClient() ? Math.max(0, t.indexOf('sent')) : 0;
    const shown = t.slice(from);
    /* The client is never shown their own lateness (5 Nov). */
    const late = !isClient() && slowAt(c);
    const tone = c.stage === 'joined' || c.stage === 'accepted' ? 'ok' : late ? 'warn' : 'neutral';
    const hi = isClient() ? -1 : t.indexOf('sent') >= 0 ? t.indexOf('sent') : t.indexOf('mgr');
    const hiWho = t[hi] === 'sent' ? 'the client decides' : 'the hiring manager decides';
    const name = (k) => JY_SHORT[k] || STAGE[k].label;
    const steps = shown.map((k) => {
      const i = t.indexOf(k);
      const st = i < cur || (i === cur && c.exit) ? 'is-done' : i === cur ? 'is-now' : '';
      const when = st === 'is-now' ? 'since ' + sayDay(enter[k]) + ' · ' + days(c.since)
        : st === 'is-done' ? sayDay(enter[k]) : '';
      const why = STAGE[k].label + (st === 'is-done' ? ', reached ' + sayDay(enter[k]) + (took[k] != null ? ', ' + days(took[k]) + ' in it' : '')
        : st === 'is-now' ? ', now, ' + days(c.since) + (late ? ', usually ' + days(STAGE[k].exp) : '') : ', ahead');
      return '<li class="t-trk-step ' + st + (i === hi ? ' is-hand' : '') + '"' + (st === 'is-now' ? ' aria-current="step"' : '') + ' title="' + esc(why) + '">' +
        '<span class="t-trk-dot" aria-hidden="true"></span><span class="t-trk-k">' + esc(name(k)) + '</span>' +
        (when ? '<span class="t-trk-t">' + esc(when) + '</span>' : '') +
        (st === 'is-now' && late ? '<span class="t-trk-late">usually ' + days(STAGE[k].exp) + '</span>' : '') +
        (i === hi ? '<span class="t-trk-split" aria-hidden="true"><span>' + esc(hiWho) + '</span></span>' : '') + '</li>';
    }).join('');
    return '<div class="t-trk-wrap"><ol class="t-trk ' + TONE_CLS[tone] + '" style="--n:' + shown.length + '" aria-label="' + esc('Their path on ' + q.title) + '">' + steps + '</ol>' +
      (c.exit ? '<p class="t-trk-exit ' + TONE_CLS[EXIT_TONE[c.exit] || 'neutral'] + '"><span class="t-trk-branch" aria-hidden="true"></span><b>' + esc(EXIT[c.exit].label) + '</b> ' + esc(exitAt(c)) + ', ' + esc(sayDay(-c.since)) + '</p>' : '') +
    '</div>';
  }
  /* THE CARD'S PROGRESS (Engy, 4 Nov: the steps of variation 6, from
     deliverables/candidate-card-progress.html; the phases bar above them
     came off on 5 Nov). The steps either side of where they are: the one
     passed, the one they are at with its days (amber past its usual time),
     and the next. A way out shows where it happened, in red. */
  function stageProgress(c) {
    const t = tplOf(reqOf(c)), cur = t.indexOf(c.stage);
    if (cur < 0) return '';
    const late = slowAt(c);
    const name = (k) => JY_SHORT[k] || STAGE[k].label;
    const prev = cur > 0 ? t[cur - 1] : null, nx = c.exit ? null : t[cur + 1];
    const step = (cls, dot, label) => '<span class="t-st ' + cls + '"><span class="t-st-dot" aria-hidden="true">' + dot + '</span><span class="t-st-k">' + label + '</span></span>';
    const steps = '<span class="t-steps">' +
      (prev ? step('is-done', svg('check', 9), esc(name(prev))) : step('is-start', '', 'Start')) + '<span class="t-st-ln"></span>' +
      (c.exit ? step('is-out', '', esc(EXIT[c.exit].label) + ' · ' + esc(name(c.stage)))
        : step('is-now' + (late ? ' is-late' : ''), '', esc(name(c.stage)))) +
      (nx ? '<span class="t-st-ln is-ahead"></span>' + step('is-next', '', esc(name(nx))) : '') + '</span>';
    return '<div class="t-prog" title="' + esc((c.exit ? EXIT[c.exit].label + ' ' + exitAt(c) : STAGE[c.stage].label) + ', stage ' + (cur + 1) + ' of ' + t.length) + '">' + steps + '</div>';
  }

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
      else if (MEETS[c.stage] && !ivNow(c) && c.meet == null) special = foot(ghostOut, '<button class="s-insight-lnk primary" type="button" data-book-chat="' + c.id + '">Book the interview</button>');
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
    return '<article class="type-card s-card b-qcard" data-open="cand:' + c.id + '" style="--i:' + Math.min(i, 8) + '">' +
      '<div class="tc-head">' + (pick1 ? selBox('sourced', c.id, c.name) : owedTell ? selBox('tell', c.id, c.name) : '') + stageTag(c) + (was ? tag('Returning', 'info') : '') + '<span class="b-kind">' + esc(c.source) + '</span></div>' +
      '<div class="b-qcard-top"><button class="tc-title s-card-title" type="button" data-cand="' + c.id + '">' + esc(c.name) + '</button></div>' +
      '<p class="tc-summary b-qcard-role">' + esc(c.at) + '</p>' +
      /* Who they are stays together under the name (Engy, 5 Nov), then
         AiMY's read of why they fit (4 Nov). */
      '<p class="b-qcard-where">' + fact('job', plural(c.years, 'year')) + fact('pin', c.place) + fact('lang', c.langs.join(', ')) + '</p>' +
      whySay(c) +
      (was ? '<p class="b-qcard-where t-before">' + fact('hist', beforeSay(was)) + '</p>' : '') +
      (isClient() ? '' : stageProgress(c)) +
      /* The days in the stage are said here once, so the steps above carry
         names only; past its usual time, the line says that too. */
      '<p class="b-qcard-where t-cnow">' + fact('clock', say + (slowAt(c) ? ' Usually ' + days(STAGE[c.stage].exp) + '.' : '') +
        (s && s.status === 'done' ? ' Assessment ' + scoreShort(asmtOf(s.asmt), s) + '.' : '')) +
        /* A client past the usual time is nudged from here (5 Nov). */
        (c.stage === 'sent' && !c.exit && slowAt(c) && (isRec() || isHR()) ? (c.nudged == null ? ' <button class="s-inline-btn" type="button" data-nudge="' + c.id + '">' + esc(nudgeSay(c)) + '</button>' : ' <span class="b-kind">Nudged ' + esc(sayWhen(c.nudged)) + '</span>') : '') + '</p>' +
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
      (o.bare ? '' : (o.amber ? '<div class="eyebrow amber">' : '<div class="eyebrow">') + svg(o.ico, 14) + ' ' + esc(o.cap) + '</div>') +
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
  /* In parts (5 Nov): one line on who they are, each must-have they meet
     with what it stands on, what is still open, and when they can start.
     Never salary, margin or an internal note. */
  function writeUp(c) {
    const q = reqOf(c), v = verified(c), ev = evNow(c);
    const on = (m, i) => v[i].state === 'verified' ? 'confirmed in the ' + lower(STAGE[v[i].seen[0].stage].label) : 'on the CV: ' + cvSays(c, m);
    const open = (m, i) => yearsAsked(m) > c.years ? plural(c.years, 'year') + ' so far, not ' + yearsAsked(m) + '+'
      : v[i].state === 'differs' ? 'the CV says so; the interview found less' : v[i].state === 'partly' || v[i].state === 'notshown' ? 'partly shown in interview'
      : c.ev[i] === 'p' ? 'partly on the CV' : 'not known yet; the CV is silent';
    const met = q.must.map((m, i) => ev[i] === 'm' ? '- ' + m + ': ' + on(m, i) : null).filter(Boolean);
    const gap = q.must.map((m, i) => ev[i] !== 'm' ? '- ' + m + ': ' + open(m, i) : null).filter(Boolean);
    return c.name + ', ' + c.at + ', ' + plural(c.years, 'year') + '. Meets ' + met.length + ' of ' + q.must.length + ' must-haves.\n\n' +
      (met.length ? 'Why they fit\n' + met.join('\n') + '\n\n' : '') +
      (gap.length ? 'Still open\n' + gap.join('\n') + '\n\n' : '') +
      'Speaks ' + c.langs.join(', ') + ' · ' + c.place + (c.notice ? ' · ' + c.notice.charAt(0).toUpperCase() + c.notice.slice(1) : '');
  }
  /* THE WRITE-UP, IN THE CHAT (Engy, 5 Nov; the UX plan). AiMY drafts it;
     it is changed in place or by saying so ("shorter", or a line to add);
     Approve and send records the sendout and lands where it lives: their
     page, or the run it was started from. */
  function wuChat(c, back) {
    aiTurn({ kind: 'wu', cand: c.id, text: writeUp(c), back: back || null }, 'A write-up for ' + accOf(reqOf(c)).name + ' · ' + c.name, null, true);
  }
  function wuTurnHtml(t) {
    const c = DB.byId[t.cand];
    if (!c) return 'They are no longer on file.';
    const a = accOf(reqOf(c));
    return '<p>The write-up ' + esc(a.name) + ' reads with <b>' + esc(c.name) + '</b>’s profile, from the CV, ' + plural(ivsOf(c).filter((v) => v.status === 'done').length, 'interview') +
        ' and the success profile. Salary, margin and internal notes are left out. Change it here, or tell me (“shorter”, or a line to add).</p>' +
      '<textarea class="input t-dr-in" rows="12" data-dr-text="' + t.id + '" aria-label="The write-up ' + esc(a.name) + ' reads">' + esc(t.text) + '</textarea>' +
      '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-wu-go="' + t.id + '">Approve and send to ' + esc(a.name) + '</button><button class="btn btn-ghost btn-sm" type="button" data-turn-leave="' + t.id + '">Leave it</button></p>';
  }
  function wuGo(t) {
    const c = DB.byId[t.cand];
    if (!c || t.done) return;
    const text = String(t.text || '').trim();
    if (!text) { toast('The client needs a line or two about them.'); return; }
    doneTurn(t, 'Sent ' + esc(c.name) + '’s profile to ' + esc(accOf(reqOf(c)).name) + ', with the write-up you approved.', [{ label: 'Open ' + first(c.name), go: { cand: c.id } }]);
    go(t.back || { cand: c.id });
    move(c, 'sent', { writeup: { text: text, by: DESK, day: 0 } });
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
          (c.openDay != null ? ev('ok', (isClient() ? 'Opened ' : 'Opened by the client ') + esc(sayDay(c.openDay)), esc(who)) : ev('wait', 'Not opened yet', 'sent ' + esc(sayWhen(c.sentDay)))) +
          (passed ? ev('err', 'Declined ' + esc(sayDay(c.decideDay != null ? c.decideDay : 0)), c.decline && c.decline.note ? '“' + esc(c.decline.note) + '”' : esc(lower(DECLINE_K[c.decline ? c.decline.why : 'other'].label)))
            : met ? ev('ok', 'Wants to meet · ' + esc(sayDay(c.decideDay)), 'the client interview is next')
            : c.openDay != null ? ev('wait', isClient() ? 'Your answer' : 'Decision', 'waiting ' + days(-c.openDay)) : '') +
          (!isClient() && c.nudged != null && !passed && !met ? ev('wait', 'Nudged ' + esc(sayDay(c.nudged)), 'by email' + (a.id === 'northwind' ? ', and in ' + esc(first(DESKS.jana.name)) + '’s bell' : '')) : '') +
        '</div>' +
        (!isClient() && !passed && !met && !c.exit && c.stage === 'sent' && c.nudged == null && c.since >= STAGE.sent.exp && (isRec() || isHR()) ? '<div class="row" style="margin-top:12px;gap:8px">' + rcBtn(nudgeSay(c), 'data-nudge="' + c.id + '"', 'small', 'mail') + '<span class="sub">' + days(c.since) + ' with them; usually ' + days(STAGE.sent.exp) + '</span></div>' : '') +
        (wu ? '<div style="margin-top:12px">' + rcCaps(isClient() ? 'What we wrote' : 'The write-up · what the client read') + rcQuote(esc(wu.text)) + '</div>' : '') +
        (passOpen(c) && !isClient() ? passPicker(c, true) : pick) +
        (passed && c.decline ? rcAimy('This is the ' + nth(Math.max(1, n)) + ' ' + esc(shortAcc(a)) + ' decline this month for ' + esc(DECLINE_K[c.decline.why].say) + '. It now counts in ' + esc(shortAcc(a)) + '’s success profile as a learning signal.',
          'Reason codes · not free text · feeds matching for this account only') : '') +
        '' });
  }

  /* ── 3. EVIDENCE PER CRITERION, AGAINST THE SUCCESS PROFILE (scoring-
     evidence-per-criterion and candidate-verified-skills, as one). The
     count is the score, never a percentage (D2); an unknown is said as
     unknown with one way to find out.

     The two cards listed every must-have twice, once for what the CV says and once for what the
     interviews found, and the page's lead counted them a third time. Now
     each must-have is one row with both: the CV quoted, what an interview
     found under it, and one status. The score on top counts what the CV
     shows and says how many an interview has confirmed. */
  const FIT_ST = { verified: ['Confirmed', 'ok', 'okc'], differs: ['Differs', 'err', 'warnc'], partly: ['Partly shown', 'warn', 'warnc'], notshown: ['Not shown', '', 'warnc'] };
  /* WHY THEY FIT, AS LABELS, NOT A SCORE (Engy, 29 Oct). One label per
     must-have the CV shows, full ones first, partly ones said; what the CV
     is silent on is counted under them, never a no. Hover a label for the
     line of the CV it rests on. The same on the card, the profile and the
     CV on hover. Mobbin: Braintrust and Upwork put match reasons on the card
     as tags; Workable and Pin list them on the profile with the evidence. */
  /* THE SAME REASONING, SAID AS A SENTENCE (Engy, 29 Oct: "sentences,
     insights, not points"). On the cards and the CV on hover, AiMY says
     why they fit in one or two sentences; the profile keeps the labels and
     the line of the CV under each. */
  function whySay(c) {
    const must = reqOf(c).must || [], f = first(c.name);
    /* Mid-sentence, a must-have keeps its capital when it starts with a
       name (German, NetSuite, SQL); otherwise it goes lower case. */
    const mid = (m) => /^(German|English|Arabic|French|Spanish|Italian)\b|^[A-Z][a-z]+[A-Z]|^[A-Z][A-Z0-9]/.test(m) ? m : m.charAt(0).toLowerCase() + m.slice(1);
    const ev = evNow(c), of = (k) => must.filter((m, i) => ev[i] === k).map(mid);
    /* A list whose items carry their own commas is joined with semicolons;
       one whose items carry their own "and" takes a comma before its last. */
    const and = (l) => l.length < 2 ? l[0] : l.some((x) => x.indexOf(',') >= 0) ? l.slice(0, -1).join('; ') + '; and ' + l[l.length - 1]
      : l.slice(0, -1).join(', ') + (l.length > 2 && l.some((x) => / and /.test(x)) ? ', and ' : ' and ') + l[l.length - 1];
    /* A must-have written as a verb ("Reads stack traces") is said as a
       noun inside AiMY's sentence ("reading stack traces"). */
    const GERUND = { reads: 'reading', writes: 'writing', runs: 'running', reports: 'reporting', calm: 'staying calm', has: '' };
    /* Short form (Engy, 4 Nov: "make them shorter"): the topic of a
       must-have without its years, examples or qualifiers, so "2+ years in
       accounts receivable" is said "accounts receivable" and "NetSuite or a
       similar ERP" is said "NetSuite". */
    const short = (m) => noun(m).replace(/^\d+\+ years? (of |in |as (an? )?)?/, '').replace(/\s*\(.*?\)/, '')
      .replace(/,.*$| or a similar .*$| to read .*$| or above$| engineers build from$| and logs$/, '').replace(/^work with/, 'working with')
      .replace(/^business analyst$/, 'business analysis').replace(/^collections with overseas clients$/, 'overseas collections').replace(/ and one scripting language$/, ' and scripting');
    const noun = (m) => m.replace(/^(\w+)\s*/, (w, v) => GERUND[v] == null ? w : GERUND[v] ? GERUND[v] + ' ' : '').replace(/^worked with/, 'work with');
    const fluent = (m) => (c.langs || []).filter((l) => m.indexOf(l) >= 0)[0];
    /* A language the CV lists but only partly shows is a fluency to check. */
    const met = of('m').map(short), part = of('p').filter((m) => !fluent(m)).map(short), q = reqOf(c);
    const unk = of('n').concat(of('p').filter(fluent));
    /* WHY THEY FIT, AS AiMY'S READ (Engy, 4 Nov: "insights or reasons why
       this candidate fits", not an audit of the CV). The card already says
       their role and years, so AiMY says only what the CV backs up, living
       near the office when it is true, and what is left to check, never a
       no. A language the CV lists is checked as fluency. Said as AiMY
       talking to the recruiter about the person (Engy, 4 Nov): "Adham looks
       strong on…", "I'd check…". */
    const near = c.place && q.place && q.place.indexOf(c.place) >= 0;
    const fit = met.length ? f + ' looks strong on <b>' + esc(and(met)) + '</b>' + (part.length ? ', and partly on <em>' + esc(and(part)) + '</em>' : '')
      : part.length ? f + ' partly matches on <em>' + esc(and(part)) + '</em>' : f + '’s CV doesn’t show the must-haves yet';
    const check = unk.map((m) => fluent(m) ? 'how fluent their ' + fluent(m) + ' is' : short(m));
    const say = fit + (near ? (met.length || part.length ? ', and lives close to the office.' : ', but lives close to the office.') : '.') +
      (check.length ? ' I’d check ' + esc(and(check)) + '.' : '');
    /* AiMY'S INSIGHT, FIRST ON THE CARD (Engy, 4 Nov: "the most important is
       the AiMY insights"; variation 4 of deliverables/candidate-card-progress
       .html). A verdict in words, never a score (29 Oct): Strong where the CV
       shows two or more must-haves, Partly fits where it shows some, Not
       shown yet where it is silent. Then the sentence, the topics it found
       tinted. No chip per must-have under it (Engy, 5 Nov): the sentence
       already names them. Distilled 5 Nov: the verdict is the block's
       heading, in its tone's colour, with no eyebrow over it and no pill;
       where the read comes from moves to the hover. */
    const verdict = met.length >= 2 ? ['Strong fit', 'is-strong'] : met.length || part.length ? ['Partly fits', 'is-part'] : ['Not shown yet', 'is-none'];
    return '<div class="t-ins" title="AiMY’s read of the CV, against the must-haves">' +
      '<p class="t-ins-h">' + mark(12) + '<span class="t-ins-v ' + verdict[1] + '">' + verdict[0] + '</span></p>' +
      '<p class="t-ins-say">' + say + '</p></div>';
  }
  function whyTags(c, bare) {
    const must = reqOf(c).must || [];
    const tags = must.map((m, i) => ({ m: m, e: c.ev[i] })).filter((x) => x.e === 'm' || x.e === 'p')
      .sort((x, y) => (x.e === 'm' ? 0 : 1) - (y.e === 'm' ? 0 : 1));
    const unk = must.filter((m, i) => c.ev[i] === 'n').length;
    return '<div class="t-why">' + (bare ? '' : '<span class="t-why-cap">Why they fit</span>') +
      (tags.length ? '<span class="t-why-tags">' + tags.map((x) => '<span class="' + (x.e === 'm' ? 't-why-tag' : 't-why-tag is-part') + '" title="' + esc('On the CV: ' + cvSays(c, x.m)) + '">' +
          svg(x.e === 'm' ? 'check' : 'dot', 12) + '<span>' + esc(x.m) + (x.e === 'p' ? ', partly' : '') + '</span></span>').join('') + '</span>'
        : '<span class="t-why-none">Nothing on the CV shows a must-have yet.</span>') +
      (unk ? '<span class="t-why-unk">' + svg('qc', 12) + plural(unk, 'must-have') + ' not known yet, not missing</span>' : '') +
    '</div>';
  }
  function fitCard(c, v) {
    const q = reqOf(c), works = isRec() || isHR(), asks = c.asks || [];
    const conf = v.filter((x) => x.state === 'verified').length, diff = v.filter((x) => x.state === 'differs').length;
    const last = v.reduce((d, x) => (x.seen[0] && (d == null || x.seen[0].day > d) ? x.seen[0].day : d), null);
    /* Why they fit, as the card says it, then each must-have with the line
       of the CV it rests on (Workable, Pin). No score, no lane. */
    /* Led by AiMY's read, the card's own words (5 Nov), not a row of tags
       that the list under it already names. */
    return rcard({ cap: 'Why they fit', ico: 'listc', label: 'Why they fit', bare: true,
      body: rcHead('Why ' + esc(first(c.name)) + ' fits', esc(q.title) + ' · ' + esc(accOf(q).name)) +
        whySay(c) +
        '<div class="row between" style="margin-top:8px;flex-wrap:wrap;gap:6px"><span class="sub">each quoted from the CV · ' + (conf ? conf + ' confirmed in interview' : 'none confirmed in interview yet') + '</span>' +
          (diff ? rcChip(diff + (diff === 1 ? ' differs' : ' differ') + ' in interview', 'err') : '') + '</div>' +
        '<div style="margin-top:12px">' + q.must.map((m, i) => {
          const e = c.ev[i], x = v[i], best = x.seen[0], st = best ? FIT_ST[x.state] : null;
          const cv = e === 'n' ? rcSay('The CV is silent here. Not the same as Not met.') : rcQuote('“' + esc(cvSays(c, m)) + '”');
          const iv = best ? rcSay('<b>' + esc(STAGE[best.stage].label) + ', ' + esc(sayDay(best.day)) + ':</b> ' + esc(best.note || RATE[best.r])) : '';
          const asked = asks.indexOf(i) >= 0, can = works && !c.exit && !best;
          const right = '<span class="row" style="gap:6px;flex-wrap:wrap;justify-content:flex-end">' +
            (st ? rcChip(st[0], st[1]) : e === 'n' ? (can ? '' : rcChip('Not known', 'dash')) : rcChip(EVW[e] + ' on the CV', e === 'm' ? 'ok' : 'warn')) +
            (can ? (asked ? rcChip('On the list') : rcBtn(e === 'n' ? 'Ask ' + first(c.name) : 'Check in interview', 'data-ask-must="' + c.id + '|' + i + '"', e === 'n' ? 'small' : 'quiet', e === 'n' ? 'msg' : null)) : '') + '</span>';
          return rcCrit(st ? st[2] : e === 'm' ? 'okc' : e === 'p' ? 'warnc' : 'qc', st ? (st[1] || 'mute') : e === 'm' ? 'ok' : 'warn', esc(m), cv + iv, right);
        }).join('') + '</div>' +
        rcFoot(svg('hist', 12) + ' Criteria v' + ((q.mustV || 0) + 1) + ' · set by ' + esc(hmOf(q).name) + ', ' + esc(sayDay(q.opened)) +
          (last != null ? ' · last checked in interview ' + esc(sayDay(last)) : ''), works ? 'Overridable · you decide' : 'Read against your success profile') +
        (isClient() ? '' : rcNote('info', 'AiMY suggests each interview finding from the transcript; the interviewer confirms it before it lands here. The candidate sees and edits only what the CV says.')) });
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
     needs, and whether that record exists today or is one Talent adds.
     Said as a line of text, not chips: it labels the block, and nothing
     on it is pressed. "New to Talent" is a record the dashboard lacks today. */
  const srcNote = (reads) => '<p class="t-src"><span class="t-src-cap">Reads</span> ' +
    esc(reads.map((x) => x[0] + (x[1] ? ' (new to Talent)' : '')).join(', ')) + '</p>';

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
  /* THE ANSWER, SHOWN AS IT WILL ARRIVE (M4, Message preview). Two parts
     only (Engy, 29 Oct: it carried too much): the message, and one line
     under it saying who it goes to, how, under which approved template,
     with the button that sends it. The row below already names the role. */
  function msgPreview(c, withSend, alone) {
    /* `alone`: the profile, where ticks on a list do not apply. */
    const many = withSend && !alone && selN('tell') > 1;
    const say = many ? 'Shown for ' + first(c.name) + '. Each of the ' + selN('tell') + ' ticked gets their own name and role.'
      : 'To ' + first(c.name) + ' by ' + (waAuto(c) ? 'WhatsApp and email' : noWaSay(c)) + ' · HR template, approved by ' + DESKS.dina.name + '.';
    return '<div class="t-msg">' +
      '<p class="t-msg-body">' + esc(tellText(c)) + '</p>' +
      '<div class="t-msg-end"><p class="t-msg-foot">' + esc(say) + '</p>' +
        (withSend && !many ? '<button class="s-insight-lnk primary" type="button" data-tell="' + c.id + '">' + svg('send', 14) + 'Send to ' + esc(first(c.name)) + '</button>' : '') +
      '</div></div>';
  }
  function tell(ids) {
    const list = ids.map((id) => DB.byId[id]).filter((c) => c && c.told === false);
    if (!list.length) return;
    const es = list.map((c) => { write(c, { told: true }); return note(c, 'out', 'Told by ' + me().name + ' under the HR decline template, by ' + (waAuto(c) ? 'WhatsApp and email.' : 'email.')); });
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
  /* AiMY CONNECT IS AN OPTION, NOT A NEED (Engy, 5 Nov). The company says,
     on the HR Manager's Templates page, whether WhatsApp goes through AiMY
     Connect. Without it Talent cannot send or hear WhatsApp on its own:
     what Talent sends by itself goes by email, and a recruiter's WhatsApp is
     their own app, which Talent opens with the message written and logs. */
  const connectOn = () => D.connect !== false;
  const waAuto = (c) => !!c.wa && connectOn();
  const noWaSay = (c) => c.wa ? 'email (WhatsApp is not connected)' : 'email (no WhatsApp opt-in)';
  const viaSay = (c) => waAuto(c) ? 'by WhatsApp and email' : 'by ' + noWaSay(c);

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
      /* Data lines, not cards (Engy, 4 Nov). */
      '<ul class="t-figs">' + tiles.map((t) => '<li class="t-fig"><span class="t-fig-head"><span class="t-fig-k">' + esc(t[0]) + '</span><b class="t-fig-v">' + esc(t[1]) + '</b></span><span class="t-fig-say">' + esc(t[2]) + '</span></li>').join('') + '</ul>' +
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
    /* On Teams the recording and transcript come back when the call ends
       (Engy, 5 Nov), so a video call is read like a recorded one. */
    c.read = (c.recording || c.video) && c.shown ? readCall(heardText(c)) : { outcome: null, notice: null, salary: null, when: null };
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
      callback: 'Logs the call and puts them back in your calls ' + cbSay(cbWhen(call)) + '.',
      noanswer: 'Logs an attempt' + (call.dir === 'out' && fuOn(call) ? ' and sends ' + first(c.name) + ' the message by ' + fuBy(c) : '') + '. They stay in your calls.',
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
    /* A call made elsewhere brings its own day, time and channel (`via`). */
    const teamsRec = !!call.video && !call.via && call.secs > 0;
    const t = { id: 'u' + Date.now().toString(36), cand: call.cand || null, phone: call.phone, who: call.who || null,
      day: call.day != null ? call.day : 0, time: call.time || time, dir: call.dir, secs: call.secs, outcome: o, by: ME, missed: false, from: call.dir === 'out' && !call.video && !call.via ? call.from : null, video: !!call.video,
      via: call.via || null, recName: call.recName || null, teamsRec: teamsRec,
      note: call.note || (rd.notice || rd.salary ? 'Said on the call: ' + [rd.notice, rd.salary ? 'expects ' + rd.salary : null].filter(Boolean).join(', ') + '.'
        : call.dir === 'in' ? 'They called in.' : OUTCOME[o].label + '.'),
      lines: call.recording || teamsRec ? call.script.slice(0, call.shown).map((l) => ({ who: l[0], text: l[1] })) : [] };
    const c = DB.byId[call.cand];
    let undo, said;
    if (c) {
      const q = reqOf(c);
      const before = { stage: c.stage, since: c.since, exit: c.exit, maxAt: c.maxAt, callback: c.callback, notice: c.notice,
        salary: c.salary, dnc: c.dnc, badNumber: c.badNumber, fb: c.fb, meet: c.meet, slot: c.slot, told: c.told, cbWin: c.cbWin || null, fuDay: c.fuDay != null ? c.fuDay : null };
      const f = { callback: null, cbWin: null };
      if (rd.notice) f.notice = rd.notice;
      if (rd.salary) f.salary = rd.salary;
      let moved = null;
      if (o === 'passed' && rank(q, c.stage) <= rank(q, 'phone')) {
        moved = 'hr';
        Object.assign(f, { stage: 'hr', since: 0, meet: 2, slot: '11:00', fb: false, maxAt: rank(q, 'hr') > rank(q, c.maxAt) ? 'hr' : c.maxAt });
      }
      call.movedTo = moved;
      if (o === 'callback') { const w = cbWhen(call); f.callback = w.day; f.cbWin = w.win; }
      if (o === 'noanswer') { f.callback = c.callback; f.cbWin = c.cbWin || null; }
      const fu = o === 'noanswer' && call.dir === 'out' && fuOn(call);
      if (fu) f.fuDay = 0;
      call.fuSent = fu;
      /* Not a fit on a call was said on the call, so they have been told. */
      if (o === 'notfit') Object.assign(f, { exit: 'out', since: 0, told: true });
      if (o === 'withdrew') Object.assign(f, { exit: 'withdrew', since: 0 });
      if (o === 'dnc') Object.assign(f, { exit: 'withdrew', since: 0, dnc: true });
      if (o === 'wrong') f.badNumber = true;
      write(c, f);
      addCall(t);
      const fe = fu ? note(c, 'msg', 'Sent by ' + fuBy(c) + ' after no answer: “' + fuText(c) + '”') : null;
      said = 'Logged the call with ' + first(c.name) + ' · ' + OUTCOME[o].label + (moved ? ', moved to the HR interview' : '') + (fu ? ', message sent' : '');
      undo = () => { dropCall(t.id); write(c, before); if (fe) unmake('events', fe); paint(); };
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
    if (sess) { (sess.log = sess.log || []).push({ cand: was, o: o, moved: !!call.movedTo, fu: !!call.fuSent }); coachNote(call); }
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
  /* A DAY AND A PART OF IT (Calls, 29 Oct): "tomorrow" was a whole day,
     and a person who asked for after six was called at ten. A callback is a
     window they asked for; a part of today that is already over is not
     offered. */
  const CB_WIN = { am: ['10:00', '12:00'], pm: ['14:00', '17:00'], eve: ['18:00', '20:00'] };
  const CB_WHEN = [
    { k: '0pm', label: 'This afternoon', day: 0, win: 'pm' },
    { k: '0eve', label: 'This evening', day: 0, win: 'eve' },
    { k: '1am', label: 'Tomorrow morning', day: 1, win: 'am' },
    { k: '1pm', label: 'Tomorrow afternoon', day: 1, win: 'pm' },
    { k: '7', label: 'Next week', day: 7, win: null },
  ];
  const hourNow = () => new Date().getHours();
  const cbOpen = () => CB_WHEN.filter((w) => w.day > 0 || hourNow() < Number(CB_WIN[w.win][1].slice(0, 2)));
  const winSay = (w) => (w ? CB_WIN[w][0] + '–' + CB_WIN[w][1] : '');
  /* The window pressed, else the one read off what was said, else the
     nearest that makes sense. */
  function cbWhen(call) {
    const rd = call.read || {}, open = cbOpen();
    const pressed = open.filter((w) => w.k === call.cb)[0];
    if (pressed) return pressed;
    const day = rd.when != null ? rd.when : rd.win ? 0 : 1;
    const win = rd.win || (day === 0 ? 'eve' : day === 1 ? 'am' : null);
    return open.filter((w) => w.day === day && w.win === win)[0] || open.filter((w) => w.day === day)[0] || open.filter((w) => w.k === '1am')[0];
  }
  const cbSay = (w) => w.label.toLowerCase() + (w.win ? ', ' + winSay(w.win) : '');
  /* Today's window has not opened yet, so the call waits for it. */
  const cbLater = (c) => c.callback === 0 && c.cbWin && hourNow() < Number(CB_WIN[c.cbWin][0].slice(0, 2));
  /* A SHORT MESSAGE AFTER NO ANSWER (Calls, 29 Oct): a missed call alone
     reads as a stranger; one line naming the role gets more call-backs.
     Shown before it goes, on by default, and it goes only when the
     recruiter logs the call: the press is the approval. By WhatsApp where
     they opted in, by email where not. */
  const fuText = (c) => 'Hi ' + first(c.name) + ', this is ' + first(me().name) + ' from FlairsTech about the ' + reqOf(c).title + ' role. I tried to call you just now. ' +
    'When is a good time to talk? ' + (waAuto(c) ? 'You can reply here or call me back on this number.' : 'You can reply to this email.');
  const fuBy = (c) => (waAuto(c) ? 'WhatsApp' : 'email');
  const fuOn = (call) => (call.fu != null ? call.fu : DB.byId[call.cand] ? DB.byId[call.cand].fuDay !== 0 : false);
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
    if (o === 'callback') rows.push(['Call back', cbSay(cbWhen(call)).replace(/^./, (x) => x.toUpperCase()), 'neutral']);
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
      (o === 'callback' ? '<div class="b-cuts t-log-row" role="group" aria-label="When to call back">' + cbOpen().map((w) => { const on = cbWhen(call).k === w.k;
        return '<button class="filter-chip' + (on ? ' active' : '') + '" type="button" data-cb="' + w.k + '" aria-pressed="' + on + '">' + esc(w.label) + (w.win ? '<span class="b-cut-n">' + winSay(w.win) + '</span>' : '') + '</button>'; }).join('') + '</div>' : '') +
      (o === 'noanswer' && c && call.dir === 'out' ? '<div class="t-fu">' +
        '<button class="filter-chip' + (fuOn(call) ? ' active' : '') + '" type="button" data-fu aria-pressed="' + fuOn(call) + '">' + (fuOn(call) ? svg('check', 12) : '') + 'Also send them a message</button>' +
        '<p class="t-fu-say">“' + esc(fuText(c)) + '”</p>' +
        '<p class="t-fu-how">By ' + fuBy(c) + (waAuto(c) ? ', which they opted in to' : c.wa ? ': WhatsApp is not connected' : ': no WhatsApp opt-in') + '. It goes when you log the call' + (c.fuDay === 0 ? '; they already had one today' : '') + '.</p></div>' : '') +
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
    if (rd.win) PENDING.read.win = rd.win;
    if (rd.when != null || rd.win) PENDING.cb = null;
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
    const body = '<p class="s-callsum-note">' + plural(log.length, 'call') + ' · <b>' + got + '</b> got through' + (sess.skipped.length ? ' · ' + sess.skipped.length + ' skipped' : '') +
      (log.some((x) => x.fu) ? ' · ' + log.filter((x) => x.fu).length + ' messaged after no answer' : '') + '.</p>' +
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
        '<button class="filter-chip' + (call.video ? ' active' : '') + '" type="button" data-call-mode="video" aria-pressed="' + !!call.video + '">' + svg('video', 14) + 'Video on Teams</button></div>' +
        (call.video ? '<p class="call-num t-call-teams">Teams tells them it is recording. When it ends, the recording and transcript come back here and AiMY reads them.</p>' : '') : '') +
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
      meta: logMeta([t.missed ? (t.vm ? 'Missed, left a message' : 'Missed') : OUTCOME[t.outcome].label, t.via ? VIA_SAY[t.via] + ', logged by hand' : t.video ? 'on Teams' : null,
        t.via && t.recName ? 'recording read by AiMY' : t.teamsRec ? 'Teams sent the recording back' : null, t.secs ? fmtClock(t.secs) : null, t.time,
        withName && c ? reqOf(c).title : null, t.from && telLine(t.from) ? 'from ' + telTag(telLine(t.from)) : null]),
      say: t.vm ? '“' + esc(t.vm.text) + '”' : esc(t.note || ''),
      vm: t.vm || null, vmId: t.id,
      act: withName ? (c ? 'data-cand="' + c.id + '"' : 'data-redial="' + esc(t.phone) + '"') : '',
      go: withName ? (c ? 'Open' : 'Call back') : '', goIco: withName && !c ? svg('phone', 14) : '',
    }, i);
  }

  /* WHAT TO GET, said on the row before the call (Calls, 29 Oct): the
     brief says it too, but only once the call is open. The screen's two
     facts not on file yet, then the must-haves the CV is silent on. */
  function getLine(c) {
    const q = reqOf(c);
    if (rank(q, c.stage) > rank(q, 'phone')) return 'A follow-up: nothing on this call moves their stage.';
    const want = [c.notice ? null : 'their notice', c.salary ? null : 'the salary they expect'].filter(Boolean);
    const silent = q.must.filter((m, i) => c.ev[i] === 'n');
    const facts = want.length ? want.join(' and ').replace(/^./, (x) => x.toUpperCase()) + '.' : 'Their notice and salary are on file.';
    /* The must-have is quoted whole: some carry a comma of their own. */
    return facts + (silent.length ? ' Ask about “' + silent[0] + '”' + (silent.length > 1 ? ', and ' + (silent.length - 1) + ' more the CV is silent on.' : '; the CV is silent on it.') : '');
  }
  /* THE RUN'S SIZE: how many it calls, and about how long that takes, said
     before it starts. A screen takes about ten minutes and a call nobody
     answers about one; about six in ten pick up. */
  const RUN_N = [5, 10, 0];
  const runN = (n) => { const k = UI.runN != null ? UI.runN : 10; return k && k < n ? k : n; };
  const runMins = (n) => Math.max(5, Math.round(n * (0.6 * 10 + 0.4) / 5) * 5);
  /* ══ INTERACTIONS: WHATSAPP, AND CALLS MADE ELSEWHERE (Engy, 5 Nov) ═════
     Calls became Interactions (named so on 5 Nov): every way the recruiter and a candidate
     talk, in one place. WhatsApp runs through AiMY Connect, which checks
     the person's own opt-in before anything goes. Within 24 hours of their
     last message a reply is free text; after that only an approved template
     may open the conversation again (WhatsApp's own rule). A call made
     outside AiMY, on a mobile, a WhatsApp call or Teams, is logged by hand,
     and its recording, uploaded with their agreement, is read like AiMY's. */
  const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const msgsOf = (id) => DB.msgs.filter((m) => m.cand === id).sort((a, b) => callKey(a) - callKey(b));
  /* Hours of WhatsApp's window left after their last message; 0 is shut. */
  function waHrs(c) {
    const l = msgsOf(c.id).filter((m) => m.dir === 'in').pop();
    if (!l) return 0;
    const t = l.time.split(':').map(Number), d = new Date();
    const since = -l.day * 24 + d.getHours() + d.getMinutes() / 60 - (t[0] + t[1] / 60);
    return Math.max(0, Math.min(24, Math.floor(24 - since)));
  }
  /* THE INBOX'S WHATSAPP: a thread whose last word is theirs, on your desk,
     until you reply or say it needs nothing (Done). */
  function waOwed() {
    const last = {};
    DB.msgs.forEach((m) => { if (!last[m.cand] || callKey(m) >= callKey(last[m.cand])) last[m.cand] = m; });
    return Object.keys(last).map((k) => last[k]).filter((m) => {
      const c = DB.byId[m.cand];
      return m.dir === 'in' && !m.done && !D.waDone[m.id] && c && reqOf(c).rec === ME;
    }).sort((a, b) => callKey(b) - callKey(a));
  }
  const myMsgs = () => DB.msgs.filter((m) => DB.byId[m.cand] && reqOf(DB.byId[m.cand]).rec === ME);
  /* The HR Manager's approved WhatsApp templates (AiMY Connect's list). */
  const WA_TPL = [
    { k: 'talk', label: 'A good time to talk', text: 'Hi {first}, this is {me} from FlairsTech about the {role} role. When is a good time for a short call?' },
    { k: 'update', label: 'An update', text: 'Hi {first}, an update on your application for {role}: it is with us and moving. I will be in touch this week. {me}, FlairsTech' },
    { k: 'iv', label: 'Your interview', text: 'Hi {first}, a reminder of your interview for {role}. Reply here if the time no longer works. {me}, FlairsTech' },
  ];
  const waFill = (t, c) => t.split('{first}').join(first(c.name)).split('{me}').join(first(me().name)).split('{role}').join(reqOf(c).title);
  function msgRow(m, i, inbox) {
    const c = DB.byId[m.cand];
    return logRow({ tone: '', ico: svg('msg'), who: c.name,
      meta: logMeta(['WhatsApp', m.dir === 'in' ? 'they wrote' : 'you wrote', m.time, reqOf(c).title]),
      say: '“' + esc(m.text) + '”', act: goAttr({ on: 'calls', th: c.id }).trim(), go: inbox ? 'Reply' : 'Open', goIco: inbox ? svg('msg', 14) : '' }, i);
  }

  /* ONE WHATSAPP THREAD (?on=calls&th=): their messages left, yours right,
     by day; under it the reply, free text inside the 24 hours and a template
     outside them. Somebody who never opted in gets no box at all. */
  let WA_TPL_ON = null, WA_ADD = null;
  function threadPage(c) {
    const ms = msgsOf(c.id), hrs = c.wa ? waHrs(c) : 0, last = ms[ms.length - 1];
    const owed = last && last.dir === 'in' && !last.done && !D.waDone[last.id];
    let day = null;
    const list = ms.map((m) => {
      const h = m.day !== day ? '<p class="t-wa-day">' + esc(dayLabel(m.day)) + '</p>' : '';
      day = m.day;
      return h + '<div class="t-wa-m ' + (m.dir === 'out' ? 'is-out' : 'is-in') + '"><p class="t-wa-text">' + esc(m.text) + '</p>' +
        '<span class="t-wa-t">' + esc(m.dir === 'out' ? 'You' + (m.tpl ? ', template' : '') + (m.own ? ', from your WhatsApp' : '') : first(c.name) + (m.added ? ', added by you' : '')) + ' · ' + esc(m.time) + '</span></div>';
    }).join('');
    const tpl = WA_TPL.filter((x) => x.k === WA_TPL_ON)[0];
    /* Without AiMY Connect: no 24 hours and no templates, since it is their
       own number. The box writes the message, Open in WhatsApp hands it to
       their app and logs it here, and a reply is pasted in by hand. */
    const own = c.wa && !connectOn();
    const adding = WA_ADD === c.id;
    const ownBox = '<div class="t-wa-box"><textarea class="input t-wa-in" id="waText" rows="3" placeholder="Write to ' + esc(first(c.name)) + '…" aria-label="Your message to ' + esc(c.name) + '"></textarea>' +
        '<div class="t-wa-end"><p class="t-wa-win">Opens WhatsApp with this message on your own number; it is logged here when you press it.</p>' +
        '<button class="s-insight-lnk primary" type="button" data-wa-open="' + c.id + '">' + svg('send', 14) + 'Open in WhatsApp</button></div>' +
        (adding ? '<div class="t-wa-add"><textarea class="input t-wa-in" id="waReply" rows="2" placeholder="Paste what ' + esc(first(c.name)) + ' wrote" aria-label="Their reply"></textarea>' +
          '<p class="t-acts"><button class="b-ghost" type="button" data-wa-add="">Cancel</button><button class="s-insight-lnk" type="button" data-wa-addgo="' + c.id + '">Add their reply</button></p></div>'
          : '<p class="t-acts t-wa-done"><button class="b-ghost" type="button" data-wa-add="' + c.id + '">Add their reply</button></p>') + '</div>';
    const box = own ? ownBox : !c.wa ? '<p class="t-wa-win">' + esc(first(c.name)) + ' has not opted in to WhatsApp, so nothing can go there. Email reaches them at ' + esc(c.email || 'the address on file') + '.</p>'
      : hrs ? '<div class="t-wa-box"><textarea class="input t-wa-in" id="waText" rows="3" placeholder="Write to ' + esc(first(c.name)) + '…" aria-label="Your reply to ' + esc(c.name) + '"></textarea>' +
          '<div class="t-wa-end"><p class="t-wa-win">Open for ' + plural(hrs, 'more hour') + '. After that, only an approved template can start it again.</p>' +
          '<button class="s-insight-lnk primary" type="button" data-wa-send="' + c.id + '">' + svg('send', 14) + 'Send</button></div></div>'
      : '<div class="t-wa-box"><p class="t-wa-win">' + (ms.length ? 'More than 24 hours since ' + esc(first(c.name)) + ' last wrote' : 'No conversation yet') + ', so it opens with one of ' + esc(DESKS.dina.name) + '’s approved templates.</p>' +
          '<div class="b-cuts t-wa-tpls" role="group" aria-label="Templates">' + WA_TPL.map((x) => '<button class="filter-chip' + (WA_TPL_ON === x.k ? ' active' : '') + '" type="button" data-wa-tpl="' + x.k + '" aria-pressed="' + (WA_TPL_ON === x.k) + '">' + esc(x.label) + '</button>').join('') + '</div>' +
          (tpl ? '<div class="t-msg"><p class="t-msg-body">' + esc(waFill(tpl.text, c)) + '</p><div class="t-msg-end"><p class="t-msg-foot">To ' + esc(first(c.name)) + ' on WhatsApp · template approved by ' + esc(DESKS.dina.name) + '.</p>' +
            '<button class="s-insight-lnk primary" type="button" data-wa-send="' + c.id + '">' + svg('send', 14) + 'Send the template</button></div></div>' : '') + '</div>';
    return '<div class="s-home">' +
      '<div class="b-topbar s-block-wide"><button class="s-back" type="button"' + goAttr({ on: 'calls', q: 'inbox' }) + '>' + svg('back', 14) + 'Interactions</button>' +
        '<span class="b-draft-acts"><button class="b-ghost" type="button" data-draft-chat="' + c.id + '">Write it with AiMY</button>' + (canCall(c) ? '<button class="b-ghost" type="button" data-call="' + c.id + '">' + svg('phone', 14) + 'Call</button>' : '') +
          '<button class="b-ghost" type="button"' + goAttr({ on: 'calls', lg: c.id }) + '>Log a call from elsewhere</button></span></div>' +
      '<section class="s-block s-block-wide" aria-label="WhatsApp with ' + esc(c.name) + '">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">' + esc(c.name) + '</h2>' +
          '<span class="s-block-say">WhatsApp · ' + esc(c.wa ? 'opted in ' + sayWhen(c.waDay != null ? c.waDay : -3) + (connectOn() ? '' : ' · your own number') : 'no opt-in') + ' · ' + esc(reqOf(c).title) + ', ' + esc(accOf(reqOf(c)).name) + '</span></div>' +
        '<div class="t-wa">' + (list || '<p class="b-vfoot">Nothing on WhatsApp yet.</p>') + '</div>' +
        (owed ? '<p class="t-acts t-wa-done"><button class="b-ghost" type="button" data-wa-done="' + last.id + '">Needs no reply</button></p>' : '') +
        box +
      '</section></div>';
  }
  function sendWa(c) {
    const hrs = waHrs(c), tpl = WA_TPL.filter((x) => x.k === WA_TPL_ON)[0];
    const el = byId('waText');
    const text = hrs ? (el ? el.value.trim() : '') : tpl ? waFill(tpl.text, c) : '';
    if (!text) { toast(hrs ? 'Write something first.' : 'Pick a template first.'); return; }
    const m = { id: 'w' + Date.now().toString(36), cand: c.id, dir: 'out', day: 0, time: nowHM(), text: text, by: ME, tpl: hrs ? null : tpl.k };
    D.msgs.push(m); DB.msgs.push(m);
    const e = note(c, 'msg', 'On WhatsApp to ' + first(c.name) + ': “' + text + '”');
    WA_TPL_ON = null;
    paint();
    toast('Sent to ' + first(c.name) + ' on WhatsApp', () => { D.msgs = D.msgs.filter((x) => x.id !== m.id); DB.msgs = DB.msgs.filter((x) => x.id !== m.id); unmake('events', e); save(); paint(); },
      'Through AiMY Connect. It is on their history too.');
  }

  /* THEIR OWN WHATSAPP: wa.me opens the app or WhatsApp Web with the text
     written; the recruiter presses send there. The log is made on the press,
     with Undo for the time it was not sent after all. */
  function openWa(c) {
    const el = byId('waText'), text = el ? el.value.trim() : '';
    if (!text) { toast('Write something first.'); return; }
    try { window.open('https://wa.me/' + String(c.phone || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(text), '_blank', 'noopener'); } catch (e) {}
    const m = { id: 'w' + Date.now().toString(36), cand: c.id, dir: 'out', day: 0, time: nowHM(), text: text, by: ME, own: true };
    D.msgs.push(m); DB.msgs.push(m);
    const e = note(c, 'msg', 'On WhatsApp from ' + first(me().name) + '’s own number to ' + first(c.name) + ': “' + text + '”');
    paint();
    toast('Opened WhatsApp with the message', () => { D.msgs = D.msgs.filter((x) => x.id !== m.id); DB.msgs = DB.msgs.filter((x) => x.id !== m.id); unmake('events', e); save(); paint(); },
      'Logged on ' + first(c.name) + '’s thread. Undo if you did not send it.');
  }
  function addWaReply(c) {
    const el = byId('waReply'), text = el ? el.value.trim() : '';
    if (!text) { toast('Paste what they wrote first.'); return; }
    const m = { id: 'w' + Date.now().toString(36), cand: c.id, dir: 'in', day: 0, time: nowHM(), text: text, by: null, added: true };
    D.msgs.push(m); DB.msgs.push(m);
    WA_ADD = null;
    paint();
    toast('Added ' + first(c.name) + '’s reply', () => { D.msgs = D.msgs.filter((x) => x.id !== m.id); DB.msgs = DB.msgs.filter((x) => x.id !== m.id); save(); paint(); });
  }
  /* The company's choice, on the HR Manager's Templates page. */
  function connectBlock() {
    const on = connectOn();
    return '<section class="s-block s-block-wide" aria-label="How Talent reaches candidates">' +
      '<div class="s-camp-list-head"><h2 class="s-block-h">How Talent reaches candidates</h2><span class="s-block-say">for everyone in the company · set by the HR Manager</span></div>' +
      '<div class="b-cuts" role="group" aria-label="WhatsApp">' +
        '<button class="filter-chip' + (on ? ' active' : '') + '" type="button" data-connect="on" aria-pressed="' + on + '">WhatsApp through AiMY Connect</button>' +
        '<button class="filter-chip' + (on ? '' : ' active') + '" type="button" data-connect="off" aria-pressed="' + !on + '">Each recruiter’s own WhatsApp</button></div>' +
      '<p class="b-tocall">' + (on ? 'Talent sends and receives WhatsApp through AiMY Connect, for people who opted in. Replies land in each recruiter’s Inbox, and what Talent sends by itself (the message after a missed call, answers, invites) goes there too.'
        : 'Talent has no WhatsApp of its own. Recruiters use their own: Talent opens WhatsApp with the message written and logs it, and they add replies by hand. Everything Talent sends by itself goes by email.') + '</p>' +
    '</section>';
  }
  function setConnect(on) {
    const was = D.connect;
    D.connect = on ? undefined : false;
    save(); paint();
    toast(on ? 'WhatsApp goes through AiMY Connect' : 'Recruiters use their own WhatsApp', () => { D.connect = was; save(); paint(); },
      on ? 'For everyone in the company.' : 'Talent sends by email; WhatsApp is logged by hand.');
  }

  /* A CALL MADE ELSEWHERE (?on=calls&lg=): on the recruiter's own mobile,
     a WhatsApp call or Teams outside AiMY. Logged by hand, the same
     outcomes as the call panel, with the same effects and Undo. A recording
     is optional, and only one they agreed to: AiMY transcribes it, picks
     the outcome it heard and keeps what they said about notice and pay. */
  let EL = null;
  const EL_VIA = [['mobile', 'My mobile'], ['wa', 'WhatsApp call'], ['teams', 'Teams']];
  const VIA_SAY = { mobile: 'on your mobile', wa: 'a WhatsApp call', teams: 'on Teams' };
  function elsewherePage() {
    const pre = S.lg && DB.byId[S.lg] ? S.lg : null;
    if (!EL || EL.for !== S.lg) EL = { for: S.lg, cand: pre, via: 'mobile', day: 0, time: nowHM(), consent: false, rec: null, busy: false, read: null, lit: null };
    const c = EL.cand ? DB.byId[EL.cand] : null;
    const people = [];
    myOpen().forEach((q) => activeOf(q).forEach((x) => people.push(x)));
    people.sort((a, b) => a.name.localeCompare(b.name));
    const row = (cap, body) => '<div class="t-el-row"><span class="t-el-cap">' + cap + '</span><div class="t-el-body">' + body + '</div></div>';
    const chips = (k, list, on) => '<div class="b-cuts" role="group" aria-label="' + k + '">' + list.map((x) => '<button class="filter-chip' + (on === x[0] ? ' active' : '') + '" type="button" data-el="' + k + '|' + x[0] + '" aria-pressed="' + (on === x[0]) + '">' + esc(x[1]) + '</button>').join('') + '</div>';
    const rd = EL.read;
    const recBody = EL.busy ? '<p class="t-el-note">' + svg('upload', 14) + 'Transcribing ' + esc(EL.rec) + ' and reading it against the role…</p>'
      : rd ? '<p class="t-el-note">' + sayMark() + '<span><b>Read from ' + esc(EL.rec) + '.</b> ' + (rd.outcome ? 'AiMY heard: ' + esc(OUTCOME[rd.outcome].label.toLowerCase()) + '. ' : 'AiMY could not tell the outcome; pick it below. ') +
          [rd.notice ? esc(rd.notice.charAt(0).toUpperCase() + rd.notice.slice(1)) : null, rd.salary ? 'expects ' + esc(rd.salary) : null].filter(Boolean).join(', ') + (rd.notice || rd.salary ? '.' : '') + '</span></p>'
      : '<p class="t-q"><button class="t-check' + (EL.consent ? ' is-on' : '') + '" type="button" data-el-consent aria-pressed="' + EL.consent + '" aria-label="They agreed to be recorded">' + (EL.consent ? svg('check', 12) : '') + '</button>' +
          '<span>They agreed to be recorded' + (EL.via === 'teams' ? ' (Teams said so on the call)' : '') + '.</span></p>' +
        (EL.consent ? '<label class="t-drop t-drop-sm" for="elFile">' + svg('upload', 18) + '<b>Add the recording</b><span>Audio or video. AiMY transcribes it, picks the outcome it heard and keeps notice and salary.</span>' +
          '<input class="t-file" id="elFile" type="file" accept=".mp3,.m4a,.wav,.ogg,.mp4,.webm" data-el-file></label>' : '<p class="t-el-note">Optional. Without one, the log is your word.</p>');
    const call = c ? { cand: c.id, lit: EL.lit, dir: 'out', fu: false, read: rd || {} } : null;
    return '<div class="s-home">' +
      '<div class="b-topbar s-block-wide"><button class="s-back" type="button"' + goAttr(c && pre ? { cand: c.id } : { on: 'calls' }) + '>' + svg('back', 14) + 'Back</button></div>' +
      '<section class="s-block s-block-wide" aria-label="Log a call from elsewhere">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Log a call from elsewhere</h2>' +
          '<span class="s-block-say">a call outside AiMY, so it is on their record like any other</span></div>' +
        row('With', pre ? '<b>' + esc(c.name) + '</b> <span class="b-kind">' + esc(reqOf(c).title) + '</span>'
          : '<span class="b-menu-wrap"><button class="b-ghost b-menu-open" type="button" data-pickopen="elWhoMenu" aria-haspopup="menu" aria-expanded="false">' +
              esc(c ? c.name + ' · ' + reqOf(c).title : 'Choose the candidate') + svg('down', 14) + '</button>' +
            '<div class="b-menu" id="elWhoMenu" role="menu" hidden><span class="b-menu-cap">On your open requisitions</span>' +
              people.map((x) => '<button class="b-menu-item" type="button" role="menuitem" data-el="who|' + x.id + '"' + (EL.cand === x.id ? ' aria-current="true"' : '') + '>' +
                '<span class="b-menu-name">' + esc(x.name) + '</span><span class="tel-menu-cc">' + esc(reqOf(x).title) + '</span></button>').join('') + '</div></span>') +
        row('On', chips('via', EL_VIA, EL.via)) +
        row('When', chips('day', [['0', 'Today'], ['-1', 'Yesterday']], String(EL.day)) + '<input class="input t-el-time" id="elTime" type="time" value="' + esc(EL.time) + '" aria-label="What time">') +
        row('Recording', recBody) +
        row('What happened', '<div class="b-cuts" role="group" aria-label="What happened">' + OUTCOMES.map((o) => '<button class="filter-chip' + (EL.lit === o.k ? ' active' : '') + '" type="button" data-el="o|' + o.k + '" aria-pressed="' + (EL.lit === o.k) + '">' + esc(o.label) + '</button>').join('') + '</div>' +
          (call ? '<p class="t-el-note">' + esc(willSay(call)) + '</p>' : '')) +
        row('Note', '<textarea class="input" id="elNote" rows="2" placeholder="Anything worth keeping (optional)" aria-label="A note on the call"></textarea>') +
        '<p class="t-acts t-el-acts"><button class="b-ghost" type="button"' + goAttr(c && pre ? { cand: c.id } : { on: 'calls' }) + '>Cancel</button>' +
          '<button class="s-insight-lnk primary" type="button" data-el-log' + (c && EL.lit && !EL.busy ? '' : ' disabled') + '>Log it</button></p>' +
      '</section></div>';
  }
  function elRead(name) {
    if (!EL || !name || !EL.cand) return;
    EL.rec = name; EL.busy = true; paint();
    setTimeout(() => {
      if (!EL || EL.rec !== name) return;
      const c = DB.byId[EL.cand];
      EL.read = readCall(scriptFor(c).map((l) => l[1]).join(' '));
      EL.lit = EL.read.outcome || EL.lit;
      EL.busy = false; paint();
    }, 1600);
  }
  function logElsewhere() {
    if (!EL || !EL.cand || !EL.lit || EL.busy) return;
    if (busy()) return;
    const c = DB.byId[EL.cand], t = byId('elTime'), n = byId('elNote');
    const script = EL.read ? scriptFor(c) : [];
    PENDING = { cand: c.id, phone: c.phone, dir: 'out', secs: EL.read ? 420 : 0, lit: EL.lit, read: EL.read || {}, video: EL.via === 'teams', via: EL.via,
      recording: !!EL.read, script: script, shown: script.length, note: n && n.value.trim() ? n.value.trim() : '', fu: false,
      day: EL.day, time: t && t.value ? t.value : nowHM(), recName: EL.rec };
    const back = S.lg && DB.byId[S.lg] ? { cand: c.id } : { on: 'calls', q: 'log' };
    EL = null;
    go(back, true);
    logCall();
  }

  /* ══ OUTLOOK, AND WORK DONE IN THE CHAT (Engy, 5 Nov) ═══════════════════
     The split, from Sales and QA: what AiMY writes or runs happens in the
     chat, said back before it commits (a booking, a message, a call told in
     a sentence); one press with Undo, records, threads and lists stay on
     pages; once committed you land where the result now lives.

     OUTLOOK. The diary is the recruiter's Outlook calendar. A time is free
     when it is free in both Outlook calendars, the interviewer's and the
     recruiter's; booking sends an Outlook invite to the candidate and the
     interviewer, on Teams with its link or in person at the office. Busy
     times are drawn from a hash of who, day and time, so a demo walked
     twice finds the same calendar. */
  const OUT_TIMES = ['10:00', '11:30', '13:00', '14:30', '16:00'];
  const hashU = (t) => { let x = 7; for (let i = 0; i < t.length; i++) x = (x * 31 + t.charCodeAt(i)) >>> 0; return (x % 1000) / 1000; };
  const outBusy = (who, d, t) => DB.ivs.some((v) => v.status === 'booked' && v.day === d && v.slot === t && v.by.split(',')[0] === who) || hashU(who + '|' + d + '|' + t) < 0.4;
  const needsBook = (c) => !c.exit && MEETS[c.stage] && !ivNow(c) && c.meet == null;
  function freeSlots(c, n) {
    const by = interviewerFor(reqOf(c), c.stage).split(',')[0], mine = me().name, out = [];
    for (let d = 1; d <= 12 && out.length < n; d++) {
      const g = dayOf(d).getDay();
      if (g === 5 || g === 6) continue;
      OUT_TIMES.forEach((t) => { if (out.length < n && !outBusy(by, d, t) && (by === mine || !outBusy(mine, d, t))) out.push({ d: d, t: t }); });
    }
    return out;
  }
  const slotSay = (d, t) => DAY_FULL[dayOf(d).getDay()] + ' ' + sayDay(d) + ', ' + t;
  const MODE_SAY = { video: 'On Teams', person: 'In person' };
  /* The invite as it will go, in the read-back's rows. */
  function inviteRows(c, d, t, mode) {
    const q = reqOf(c), by = interviewerFor(q, c.stage).split(',')[0];
    const rows = [['Subject', STAGE[c.stage].label + ' · ' + q.title + ' · FlairsTech'], ['When', slotSay(d, t) + ', 45 minutes'],
      ['Where', mode === 'video' ? 'Microsoft Teams; the link is in the invite' : 'FlairsTech, Maadi office'],
      ['To', c.name + (c.email ? ' (' + c.email + ')' : '') + (by === me().name ? '' : ', and ' + by)]];
    if (waAuto(c)) rows.push(['Also', 'A WhatsApp reminder the day before']);
    return '<div class="s-callsum-in-turn"><div class="s-callsum"><div class="s-callsum-rows">' + rows.map((r) =>
      '<div class="s-callsum-row"><span class="s-callsum-cap">' + esc(r[0]) + '</span><span class="s-callsum-val">' + esc(r[1]) + '</span></div>').join('') + '</div></div></div>';
  }

  /* A turn of AiMY's in the chat, opening it; a press on a page starts a
     conversation of its own, a question asked keeps the one it is in. */
  function aiTurn(turn, title, asked, fresh) {
    if (fresh) CHAT_AT = null;
    const ch = chatFor();
    if (!ch.title) ch.title = title;
    if (asked) ch.turns.push({ who: 'you', html: esc(asked) });
    turn.id = uid('t'); turn.who = 'aimy';
    ch.turns.push(turn);
    saveChats();
    if (canvasShown()) paintThread(); else openCanvas();
    return turn;
  }
  const turnById = (id) => { for (const ch of CHATS) { const t = ch.turns.filter((x) => x.id === id)[0]; if (t) return t; } return null; };
  const doneTurn = (t, html, acts) => { t.done = true; t.html = html; t.acts = acts || []; saveChats(); };
  /* Who a sentence names: a full name first, then a first name, on this desk. */
  function candIn(lc) {
    const mine = DB.cands.filter((c) => sees(c) && (isHR() || deskReqs().indexOf(reqOf(c)) >= 0));
    return mine.filter((c) => lc.indexOf(c.name.toLowerCase()) >= 0).sort((a, b) => (a.exit ? 1 : 0) - (b.exit ? 1 : 0))[0] ||
      mine.filter((c) => !c.exit && new RegExp('\\b' + first(c.name).toLowerCase() + '\\b').test(lc))[0] || null;
  }
  /* "Thursday", "tomorrow", "at 11", "2pm", "14:30". */
  function whenIn(lc) {
    let d = /\btomorrow\b/.test(lc) ? 1 : null;
    DAY_FULL.forEach((n, g) => { if (d == null && lc.indexOf(n.toLowerCase()) >= 0) { for (let i = 1; i <= 7; i++) if (dayOf(i).getDay() === g) { d = i; break; } } });
    const m = /\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(lc.replace(/\b(19|20)\d{2}\b/g, ''));
    let t = null;
    if (m && (m[2] || m[3] || /\bat\s*\d/.test(lc))) {
      let h = Number(m[1]);
      if (m[3] === 'pm' && h < 12) h += 12;
      if (!m[3] && h < 8) h += 12;
      t = String(h).padStart(2, '0') + ':' + (m[2] || '00');
    }
    return { d: d, t: t };
  }

  /* BOOKING, IN THE CHAT. With nobody named, AiMY lists who is waiting for
     an interview; with somebody, the first time free in both calendars (or
     the one asked for, when it is free), the other free times, Teams or in
     person, and the invite as it will go. Put it in books it, sends the
     invite and lands on that day in the diary (Sales: "something went into
     the calendar, so the calendar is what you want to see"). */
  function bookChat(c, asked, keep) {
    /* Picked from AiMY's own list, it carries on in that conversation. */
    const fresh = !asked && !keep;
    if (!c) {
      const wait = [];
      myOpen().forEach((q) => activeOf(q).forEach((x) => { if (needsBook(x)) wait.push(x); }));
      aiTurn({ html: wait.length ? '<b>' + plural(wait.length, 'person', 'people') + '</b> ' + (wait.length === 1 ? 'is' : 'are') + ' waiting for an interview to be booked. Who is it for?' : 'Nobody is waiting for an interview to be booked.',
        acts: wait.slice(0, 6).map((x) => ({ label: x.name + ', ' + lower(STAGE[x.stage].label), data: 'book-chat="' + x.id + '"' })) }, 'Booking an interview', asked, fresh);
      return;
    }
    if (!needsBook(c)) {
      const v = ivNow(c);
      aiTurn({ html: esc(c.name) + (v && v.status === 'booked' ? '’s ' + esc(lower(STAGE[c.stage].label)) + ' is already booked, ' + esc(slotSay(v.day, v.slot)) + '.' : ' has no interview to book at ' + esc(lower(STAGE[c.stage].label)) + '.'),
        acts: [{ label: 'Open ' + first(c.name), go: { cand: c.id } }] }, 'Booking ' + c.name, asked, fresh);
      return;
    }
    const want = asked ? whenIn(asked.toLowerCase()) : { d: null, t: null };
    const slots = freeSlots(c, 6), by = interviewerFor(reqOf(c), c.stage).split(',')[0];
    const hit = slots.filter((x) => (want.d == null || x.d === want.d) && (want.t == null || x.t === want.t))[0];
    const note = want.d != null || want.t != null ? (hit ? '' : 'That time is taken in ' + (by === me().name ? 'your' : by + '’s or your') + ' Outlook calendar, so here is the nearest free one. ') : '';
    const pick = hit || slots[0];
    if (!pick) { aiTurn({ html: 'Nothing is free in both calendars in the next two weeks. Open the diary to find a time by hand.', acts: [{ label: 'Open the diary', go: { on: 'diary' } }] }, 'Booking ' + c.name, asked, fresh); return; }
    aiTurn({ kind: 'book', cand: c.id, d: pick.d, t: pick.t, mode: 'video', note: note, slots: slots }, 'Booking ' + c.name + '’s ' + lower(STAGE[c.stage].label), asked, fresh);
  }
  function bookTurnHtml(t) {
    const c = DB.byId[t.cand];
    if (!c) return 'They are no longer on file.';
    const by = interviewerFor(reqOf(c), c.stage).split(',')[0];
    return '<p>' + esc(t.note || '') + 'I looked in Outlook for times when ' + (by === me().name ? 'you are free' : esc(by) + ' and you are both free') + ' for ' + esc(c.name) + '’s <b>' + esc(lower(STAGE[c.stage].label)) + '</b>. This is the first; pick another if it suits better.</p>' +
      '<div class="b-cuts t-log-row" role="group" aria-label="Free times">' + t.slots.map((x) => { const on = x.d === t.d && x.t === t.t;
        return '<button class="filter-chip' + (on ? ' active' : '') + '" type="button" data-bk-slot="' + t.id + '|' + x.d + '|' + x.t + '" aria-pressed="' + on + '">' + esc(slotSay(x.d, x.t)) + '</button>'; }).join('') + '</div>' +
      '<div class="b-cuts t-log-row" role="group" aria-label="Where">' + ['video', 'person'].map((m) => '<button class="filter-chip' + (t.mode === m ? ' active' : '') + '" type="button" data-bk-mode="' + t.id + '|' + m + '" aria-pressed="' + (t.mode === m) + '">' + MODE_SAY[m] + '</button>').join('') + '</div>' +
      inviteRows(c, t.d, t.t, t.mode) +
      '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-bk-go="' + t.id + '">Put it in and send the invite</button><button class="btn btn-ghost btn-sm" type="button" data-turn-leave="' + t.id + '">Leave it</button></p>';
  }
  function bookGo(t) {
    const c = DB.byId[t.cand];
    if (!c || t.done) return;
    const by = interviewerFor(reqOf(c), c.stage).split(',')[0];
    bookIv(c, t.d, t.t, t.mode, () => { doneTurn(t, 'Booked, then undone. Nothing was sent.'); });
    doneTurn(t, 'Booked ' + esc(c.name) + '’s ' + esc(lower(STAGE[c.stage].label)) + ', ' + esc(slotSay(t.d, t.t)) + ', ' + esc(MODE_SAY[t.mode].toLowerCase()) + '. The Outlook invite went to ' + esc(first(c.name)) + (by === me().name ? '' : ' and ' + esc(by)) + '.',
      [{ label: 'Open the diary on that day', go: { on: 'diary', day: String(t.d) } }]);
    go({ on: 'diary', day: String(t.d) });
  }

  /* WRITING TO SOMEONE, IN THE CHAT (Sales's email draft). AiMY drafts from
     what was asked; it is changed in place or by saying so ("shorter"), and
     goes the one way open to this person: WhatsApp through AiMY Connect (an
     approved template once 24 hours have passed), their own WhatsApp
     without Connect, or email with no opt-in. It ends with the way to the
     thread where it now lives. */
  function draftFor(c, about) {
    const a = String(about || '').toLowerCase(), q = reqOf(c), fill = (x) => waFill(x, c);
    if (/interview|remind|meeting/.test(a) && c.meet != null && c.meet >= 0) return 'Hi ' + first(c.name) + ', a reminder of your ' + lower(STAGE[c.stage].label) + ' for ' + q.title + ', ' + slotSay(c.meet, c.slot) + '. Reply here if the time no longer works. ' + first(me().name) + ', FlairsTech';
    if (/update|news|status|where (it|things) stand/.test(a)) return fill(WA_TPL[1].text);
    if (/interview|remind/.test(a)) return fill(WA_TPL[2].text);
    /* What was asked is quoted only when it is a real sentence; otherwise
       the draft says what fits where they are. */
    const rest = a.replace(/^.*?\babout\b\s*/, '').replace(/[.?!]+$/, '').trim();
    if (rest.split(/\s+/).length >= 4 && !/call|talk|good time|next step/.test(rest)) return 'Hi ' + first(c.name) + ', this is ' + first(me().name) + ' from FlairsTech about the ' + q.title + ' role. ' + rest.charAt(0).toUpperCase() + rest.slice(1) + '. ' + first(me().name);
    const sign = ' ' + first(me().name) + ', FlairsTech';
    if (MEETS[c.stage] && c.meet == null) return 'Hi ' + first(c.name) + ', good news on the ' + q.title + ' role: you are through to the ' + lower(STAGE[c.stage].label) + '. I will send you the invite with the time shortly.' + sign;
    if (c.stage === 'sent' || c.stage === 'client' || c.stage === 'ctech') return fill(WA_TPL[1].text);
    if (c.stage === 'offer') return 'Hi ' + first(c.name) + ', a quick note on your offer for ' + q.title + ': reply here with any questions and I will answer them.' + sign;
    if ((c.stage === 'applied' || c.stage === 'sourced') && /next step/.test(a)) return 'Hi ' + first(c.name) + ', thank you for applying for ' + q.title + '. The next step is a short call of about ten minutes. When is a good time for you?' + sign;
    return fill(WA_TPL[0].text);
  }
  const tplFrom = (text) => /reminder of your/.test(text) ? 'iv' : /an update on/.test(text) ? 'update' : 'talk';
  function draftChat(c, about, asked) {
    aiTurn({ kind: 'draft', cand: c.id, text: draftFor(c, about || asked) }, 'Writing to ' + c.name, asked, !asked);
  }
  function draftTurnHtml(t) {
    const c = DB.byId[t.cand];
    if (!c) return 'They are no longer on file.';
    const shut = waAuto(c) && !waHrs(c), tpl = shut ? WA_TPL.filter((x) => x.k === tplFrom(t.text))[0] : null;
    const how = waAuto(c) ? (shut ? 'It has been more than 24 hours since ' + first(c.name) + ' wrote, so it goes as ' + DESKS.dina.name + '’s approved template “' + tpl.label + '”, shown here as it will read.' : 'It goes on WhatsApp through AiMY Connect.')
      : c.wa ? 'It opens your own WhatsApp with this text, and is logged on ' + first(c.name) + '’s thread.' : first(c.name) + ' has not opted in to WhatsApp, so it goes by email to ' + (c.email || 'the address on file') + '.';
    const go = waAuto(c) ? 'Send on WhatsApp' : c.wa ? 'Open in WhatsApp' : 'Send by email';
    return '<p>A draft to <b>' + esc(c.name) + '</b>. Change it here, or tell me what to change (“shorter”, or what it should say).</p>' +
      '<textarea class="input t-dr-in" rows="4" data-dr-text="' + t.id + '" aria-label="The message to ' + esc(c.name) + '"' + (shut ? ' readonly' : '') + '>' + esc(shut ? waFill(tpl.text, c) : t.text) + '</textarea>' +
      '<p class="t-log-will">' + esc(how) + '</p>' +
      '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-dr-go="' + t.id + '">' + esc(go) + '</button><button class="btn btn-ghost btn-sm" type="button" data-turn-leave="' + t.id + '">Leave it</button></p>';
  }
  function draftGo(t) {
    const c = DB.byId[t.cand];
    if (!c || t.done) return;
    const shut = waAuto(c) && !waHrs(c), tk = shut ? tplFrom(t.text) : null;
    const text = shut ? waFill(WA_TPL.filter((x) => x.k === tk)[0].text, c) : String(t.text || '').trim();
    if (!text) { toast('Write something first.'); return; }
    let m = null, e;
    if (c.wa) {
      if (!waAuto(c)) { try { window.open('https://wa.me/' + String(c.phone || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(text), '_blank', 'noopener'); } catch (x) {} }
      m = { id: 'w' + Date.now().toString(36), cand: c.id, dir: 'out', day: 0, time: nowHM(), text: text, by: ME, tpl: tk, own: !waAuto(c) };
      D.msgs.push(m); DB.msgs.push(m);
      e = note(c, 'msg', 'On WhatsApp ' + (waAuto(c) ? '' : 'from ' + first(me().name) + '’s own number ') + 'to ' + first(c.name) + ': “' + text + '”');
    } else {
      e = note(c, 'msg', 'Email to ' + first(c.name) + ': “' + text + '”');
    }
    const how = waAuto(c) ? 'on WhatsApp' : c.wa ? 'from your own WhatsApp' : 'by email';
    doneTurn(t, 'Sent to ' + esc(first(c.name)) + ' ' + how + ': “' + esc(text) + '”',
      c.wa ? [{ label: 'See it in ' + first(c.name) + '’s thread', go: { on: 'calls', th: c.id } }] : [{ label: 'Open ' + first(c.name), go: { cand: c.id } }]);
    paint(); paintThread();
    toast((c.wa && !waAuto(c) ? 'Opened WhatsApp with the message' : 'Sent to ' + first(c.name) + ' ' + how), () => {
      if (m) { D.msgs = D.msgs.filter((x) => x.id !== m.id); DB.msgs = DB.msgs.filter((x) => x.id !== m.id); }
      unmake('events', e); save(); doneTurn(t, 'Sent, then undone.'); paint(); paintThread();
    }, c.wa ? 'It is on their thread and their history.' : 'It is on their history.');
  }
  /* A sentence typed while a draft is open changes the draft. */
  function wuCorrect(text) {
    const ch = chatNow(), last = ch && ch.turns[ch.turns.length - 1];
    if (!last || last.kind !== 'wu' || last.done) return false;
    if (/\b(book|schedule|called|spoke|find|search|what|which|how|why|who)\b/i.test(text)) return false;
    const body = /\b(short|shorter|brief|less)\b/i.test(text)
      ? last.text.split('\n').map((l) => l.replace(/^(- [^:]+):.*$/, '$1')).join('\n')
      : last.text + '\n\n' + text.replace(/^(add|mention|say|include)( that)?\s*/i, '').replace(/^./, (x) => x.toUpperCase()).replace(/([^.?!])$/, '$1.');
    doneTurn(last, 'Rewritten below.');
    ch.turns.push({ who: 'you', html: esc(text) });
    aiTurn({ kind: 'wu', cand: last.cand, text: body, back: last.back }, '', null);
    return true;
  }
  function draftCorrect(text) {
    const ch = chatNow(), last = ch && ch.turns[ch.turns.length - 1];
    if (!last || last.kind !== 'draft' || last.done) return false;
    const c = DB.byId[last.cand];
    /* A new request is not a correction: someone else named, or another
       verb (book, log a call, find, a question). */
    const other = candIn(text.toLowerCase());
    if ((other && other !== c) || /\b(book|schedule|called|spoke|talked|rang|find|search|what|which|how|why|who)\b/i.test(text)) return false;
    const shorter = /\b(short|shorter|brief|less)\b/i.test(text);
    const body = shorter ? last.text.split(/(?<=[.?!])\s+/).filter((x, i, a) => i === 0 || i === a.length - 1 || /\?$/.test(x)).join(' ') : draftFor(c, text);
    doneTurn(last, 'Rewritten below.');
    ch.turns.push({ who: 'you', html: esc(text) });
    aiTurn({ kind: 'draft', cand: c.id, text: body }, '', null);
    return true;
  }

  /* A CALL TOLD IN A SENTENCE: "I called Karim on my mobile, he passed, one
     month's notice". AiMY says it back (who, the channel, the outcome,
     notice and pay) and Log it logs it as the form would, with Undo; then
     their page opens, where the call now lives. */
  function logSayChat(c, text) {
    const lc = text.toLowerCase(), rd = readCall(text);
    const via = /whatsapp/.test(lc) ? 'wa' : /\bteams\b/.test(lc) ? 'teams' : 'mobile';
    aiTurn({ kind: 'logsay', cand: c.id, via: via, lit: rd.outcome || null, read: rd, said: text }, 'A call with ' + c.name, text);
  }
  function logSayHtml(t) {
    const c = DB.byId[t.cand];
    if (!c) return 'They are no longer on file.';
    const rd = t.read || {}, call = { cand: c.id, lit: t.lit, dir: 'out', fu: false, read: rd };
    const rows = [['Who', c.name], ['On', VIA_SAY[t.via].replace(/^a /, '').replace(/^./, (x) => x.toUpperCase())], ['When', 'Today, ' + nowHM()], ['Outcome', t.lit ? OUTCOME[t.lit].label : 'Not picked yet']];
    if (rd.notice) rows.push(['Notice', rd.notice]);
    if (rd.salary) rows.push(['Expects', rd.salary]);
    return (t.lit ? 'I have it as a call ' + esc(VIA_SAY[t.via]) + ' with <b>' + esc(c.name) + '</b>: <b>' + esc(OUTCOME[t.lit].label.toLowerCase()) + '</b>. Is that right?' : 'I could not tell how the call with <b>' + esc(c.name) + '</b> went. Pick it below.') +
      '<div class="s-callsum-in-turn"><div class="s-callsum"><div class="s-callsum-rows">' + rows.map((r) =>
        '<div class="s-callsum-row"><span class="s-callsum-cap">' + esc(r[0]) + '</span><span class="s-callsum-val">' + esc(r[1]) + '</span></div>').join('') + '</div></div></div>' +
      '<div class="b-cuts t-log-row" role="group" aria-label="What happened">' + OUTCOMES.map((x) => '<button class="filter-chip' + (t.lit === x.k ? ' active' : '') + '" type="button" data-lg-o="' + t.id + '|' + x.k + '" aria-pressed="' + (t.lit === x.k) + '">' + esc(x.label) + '</button>').join('') + '</div>' +
      (t.lit ? '<p class="t-log-will">' + esc(willSay(call)) + '</p>' : '') +
      '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-lg-go="' + t.id + '"' + (t.lit ? '' : ' disabled') + '>Log it</button><button class="btn btn-ghost btn-sm" type="button" data-turn-leave="' + t.id + '">Leave it</button></p>';
  }
  function logSayGo(t) {
    const c = DB.byId[t.cand];
    if (!c || t.done || !t.lit) return;
    if (busy()) return;
    PENDING = { cand: c.id, phone: c.phone, dir: 'out', secs: 0, lit: t.lit, read: t.read || {}, video: t.via === 'teams', via: t.via, recording: false, script: [], shown: 0,
      note: t.said, fu: false, day: 0, time: nowHM() };
    doneTurn(t, 'Logged the call ' + esc(VIA_SAY[t.via]) + ' with ' + esc(c.name) + ': ' + esc(OUTCOME[t.lit].label.toLowerCase()) + '.', [{ label: 'Open ' + first(c.name), go: { cand: c.id } }]);
    go({ cand: c.id }, false);
    logCall();
  }

  /* ── INTERACTIONS ── who to reach, what came in, and everything said. */
  function callsPage() {
    /* A thread and the call-from-elsewhere form are pages of their own. */
    if (S.lg) return elsewherePage();
    if (S.th && DB.byId[S.th]) return threadPage(DB.byId[S.th]);
    const list = toCall(), miss = missed(), log = myCalls(), owed = waOwed();
    /* "missed" was the Inbox's old name; links to it still land. */
    const tab = S.q === 'missed' || S.q === 'inbox' ? 'inbox' : S.q === 'log' ? 'log' : 'tocall';
    const n = { tocall: list.length, inbox: miss.length + owed.length, log: null };
    const TABS = [['tocall', 'To reach'], ['inbox', 'Inbox'], ['log', 'History']];
    const counts = { callback: 0, screen: 0, applied: 0 };
    list.forEach((x) => counts[x.why]++);
    const WHY = { callback: 'asked for a callback', screen: 'phone screen due', applied: 'applied, not called yet' };
    let body;
    if (tab === 'tocall') {
      body = list.length
        ? aimyBlock({ text: '<b>' + plural(list.length, 'person', 'people') + '</b> to call: ' +
            [counts.callback ? counts.callback + ' asked for a callback' : null, counts.screen ? counts.screen + ' due a phone screen' : null,
              counts.applied ? counts.applied + ' applied and not called yet' : null].filter(Boolean).join(', ') + '. Callbacks first. ' +
            /* The run's size and its time ride on AiMY's line and the one
               button, not on a row of their own: the tabs above are the
               page's only filter. */
            (runN(list.length) < list.length ? 'The first ' + runN(list.length) + ' take' : list.length === 1 ? 'It takes' : 'All ' + list.length + ' take') +
            ' about <b>' + runMins(runN(list.length)) + ' minutes</b>, if about six in ten pick up. You press Call for each one.' }, true) +
          '<div class="b-acts t-run">' +
            '<button class="s-insight-lnk primary" type="button" data-call-all>' + svg('phone', 14) + (runN(list.length) < list.length ? 'Call the first ' + runN(list.length) + ' in order' : 'Call ' + (list.length === 1 ? 'them' : 'all ' + list.length + ' in order')) + '</button>' +
            (list.length > RUN_N[0] ? '<span class="b-menu-wrap"><button class="b-ghost t-run-more" type="button" data-pickopen="runMenu" aria-haspopup="menu" aria-expanded="false">How many' + svg('down', 14) + '</button>' +
              '<div class="b-menu" id="runMenu" role="menu" hidden><span class="b-menu-cap">How many to call</span>' + RUN_N.filter((k) => k < list.length).map((k) => {
                const n = k || list.length, on = runN(list.length) === n;
                return '<button class="b-menu-item" type="button" role="menuitem" data-runn="' + k + '"' + (on ? ' aria-current="true"' : '') + '><span class="b-menu-name">' + (k ? 'The first ' + k : 'All ' + list.length) + '</span>' +
                  '<span class="tel-menu-cc">about ' + runMins(n) + ' min</span></button>'; }).join('') + '</div></span>' : '') +
          '</div>' +
          '<div class="b-log">' + list.map((x, i) => logRow({
            tone: '', ico: svg('phone'), who: x.c.name,
            meta: logMeta([x.why === 'callback' && x.c.cbWin ? (cbLater(x.c) ? 'call back from ' + CB_WIN[x.c.cbWin][0] : 'call back ' + winSay(x.c.cbWin)) : WHY[x.why], x.c.phone, reqOf(x.c).title + ', ' + accOf(reqOf(x.c)).name]),
            say: '<b>Get:</b> ' + esc(getLine(x.c)) + ' ' + (lastCall(x.c) ? esc(callSay(lastCall(x.c))) : 'Not called yet.') +
              (x.c.fuDay != null ? ' Messaged by ' + fuBy(x.c) + ' ' + esc(sayWhen(x.c.fuDay)) + '.' : ''),
            aimy: true, act: 'data-call="' + x.c.id + '"', go: 'Call', goIco: svg('phone', 14),
          }, i)).join('') + '</div>'
        : '<p class="b-vfoot">Nobody is waiting for a call from you.</p>';
    } else if (tab === 'inbox') {
      /* Missed calls and WhatsApp replies, newest first: calling back or
         replying clears each one. */
      const items = miss.map((t) => ({ k: 'call', t: t, day: t.day, time: t.time })).concat(owed.map((m) => ({ k: 'msg', m: m, day: m.day, time: m.time })))
        .sort((a, b) => callKey(b) - callKey(a));
      body = items.length
        ? aimyBlock({ text: [miss.length ? '<b>' + plural(miss.length, 'missed call') + '</b>' : null, owed.length ? '<b>' + plural(owed.length, 'WhatsApp reply', 'WhatsApp replies') + '</b>' : null].filter(Boolean).join(' and ') +
            ' waiting on you. Calling back or replying clears each one.' }, true) +
          '<div class="b-log">' + logDays(items, (x, i) => {
            if (x.k === 'msg') return msgRow(x.m, i, true);
            const t = x.t;
            const c = DB.byId[t.cand];
            return c ? logRow({ tone: 'is-missed', ico: svg('callin'), who: c.name, meta: logMeta([t.vm ? 'Missed, left a message' : 'Missed', c.phone, t.time]),
              say: t.vm ? '“' + esc(t.vm.text) + '”' : ringRead(c), aimy: !t.vm, act: 'data-call="' + c.id + '"', go: 'Call them back', goIco: svg('phone', 14),
              vm: t.vm || null, vmId: t.id }, i)
              : logRow({ tone: 'is-missed', ico: svg('callin'), who: t.phone, meta: logMeta(['Missed', 'not on file', t.time]),
              say: 'Nobody on file has this number. Calling back puts it in the dialer.', aimy: true,
              act: 'data-redial="' + esc(t.phone) + '"', go: 'Call them back', goIco: svg('phone', 14) }, i);
          }) + '</div>'
        : '<p class="b-vfoot">Every call and message that came in has its answer.</p>';
    } else {
      /* Every channel in one history: calls in AiMY, calls logged from
         elsewhere, Teams, and WhatsApp both ways. */
      const all = log.map((t) => ({ k: 'call', t: t, day: t.day, time: t.time })).concat(myMsgs().map((m) => ({ k: 'msg', m: m, day: m.day, time: m.time })))
        .sort((a, b) => callKey(b) - callKey(a));
      const shown = all.slice(0, 40);
      body = shown.length ? '<div class="b-log">' + logDays(shown, (x, i) => x.k === 'msg' ? msgRow(x.m, i, false) : callRow(x.t, i, true)) + '</div>' +
        '<p class="b-vfoot">The last ' + shown.length + ' of ' + all.length + ' calls and messages.</p>' : '<p class="b-vfoot">Nothing yet.</p>';
    }
    return '<div class="s-home">' +
      '<section class="s-block s-block-wide" aria-label="Interactions">' +
        '<div class="s-camp-list-head">' + switcher('calls') +
          '<span class="b-draft-acts"><button class="b-ghost" type="button"' + goAttr({ on: 'calls', lg: 'new' }) + '>Log a call from elsewhere</button></span></div>' +
        '<p class="t-scope">' + tag('Design target', 'warn') + '<span>' + (connectOn() ? 'Calls wait on AiMY Phone, and WhatsApp on AiMY Connect’s templates being approved.' : 'Calls wait on AiMY Phone. WhatsApp is each recruiter’s own, logged here.') + ' This shows where it is going, not what ships first.</span></p>' +
        '<div class="b-cuts b-log-tabs">' + TABS.map((x) => '<button class="filter-chip' + (tab === x[0] ? ' active' : '') + '" type="button" data-q="' + x[0] + '"' +
          (tab === x[0] ? ' aria-current="true"' : '') + '>' + esc(x[1]) + (n[x[0]] != null ? '<span class="b-cut-n">' + n[x[0]] + '</span>' : '') + '</button>').join('') + '</div>' +
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
  const CAND_MQ = window.matchMedia ? window.matchMedia('(max-width: 1180px)') : null;
  const candNarrow = () => !!(CAND_MQ && CAND_MQ.matches);
  if (CAND_MQ && CAND_MQ.addEventListener) CAND_MQ.addEventListener('change', () => { if (S.cand) paint(); });
  function candPage() {
    const c = DB.byId[S.cand];
    if (!c || !sees(c)) return '<div class="s-home"><section class="s-block s-block-wide"><p class="s-none">This candidate has not been sent to you.</p></section></div>';
    if (S.edit && !isClient()) return candEditPage(c);
    const q = reqOf(c);
    const nx = nextOf(c);
    const calls = callsOf(c.id);
    const v = verified(c);
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
      '</section>' +
      /* THE WORK LEFT, ABOUT THEM RIGHT (Engy, 5 Nov). The decision was a
         screen down, under eight blocks of reference. Now the left column
         is the work, from where they are and the move; the right column is
         who they are and how to reach them, and stays in view. The profile
         link and consent fold away there, so the column stays short. */
      '<div class="t-cand-grid s-block-wide">' +
      /* Too narrow for two columns, About them folds to one line under the
         name (the phone number), so the decision is still near the top. */
      '<aside class="t-cand-about" aria-label="About them">' + (candNarrow() ? '<details class="t-cand-fold"><summary class="t-cand-more-sum">About them' + (c.phone && !isClient() ? ' · ' + esc(c.phone) : '') + '</summary><div class="t-cand-fold-in">' : '') +
        (isClient() ? '' : part('Reach them', p('<b>' + esc(c.phone || 'No phone yet') + '</b>') + p(esc(c.email || '')) +
          p(esc(c.dnc ? 'Asked not to be called again.' : c.badNumber ? 'This number did not work.' : c.callback != null && c.callback <= 0 ? 'Asked to be called back today' + (c.cbWin ? ', ' + winSay(c.cbWin) : '') + '.' : plural(calls.length, 'call') + ' so far.')) +
          /* Call is beside the decision, in Where they are; not twice. */
          (works ? '<div class="t-cand-acts">' +
            (c.wa ? '<button class="b-ghost" type="button"' + goAttr({ on: 'calls', th: c.id }) + '>' + svg('msg', 14) + 'WhatsApp' + (msgsOf(c.id).length ? ' (' + msgsOf(c.id).length + ')' : '') + '</button>' : '') +
            (isRec() ? '<button class="b-ghost" type="button" data-draft-chat="' + c.id + '">Write with AiMY</button>' : '') +
            (isRec() && needsBook(c) ? '<button class="b-ghost" type="button" data-book-chat="' + c.id + '">Book the interview</button>' : '') +
            '<button class="b-ghost" type="button"' + goAttr({ on: 'calls', lg: c.id }) + '>Log a call from elsewhere</button></div>' : ''))) +
        part('Now', p(esc(c.at)) + p(esc(plural(c.years, 'year')) + ' of experience')) +
        (isClient() ? '' : part('Said on calls', c.notice || c.salary ? (c.notice ? p(esc(c.notice.charAt(0).toUpperCase() + c.notice.slice(1))) : '') +
          (c.salary ? p('Expects ' + esc(c.salary)) : '') : '<p class="b-cmeta-p b-draft-none">Nothing yet. The phone screen asks.</p>')) +
        part('Languages and skills', p(esc(c.langs.join(', '))) + p(esc((c.skills || []).join(', ')))) +
        part('Summary', p(esc(c.summary || ''))) +
        (works ? '<details class="t-cand-more"><summary class="t-cand-more-sum">Their profile and consent</summary>' +
          '<div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">Their own profile</span>' +
            '<button class="b-draft-ai" type="button" data-copy="' + esc('https://' + profileLink(c)) + '">Copy the link</button></div>' +
            '<div class="b-cmeta-say">' + p('<b class="t-link-text">' + esc(profileLink(c)) + '</b>') +
            p('They open it with a one-time code sent to their phone, see where they stand, update their details and take any test sent to them. <button class="t-inline-link" type="button"' + goAttr({ me: c.pid }) + '>See what they see</button>') + '</div></div>' +
          '<div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">Consent</span></div><div class="b-cmeta-say">' + consentList(c) + '</div></div>' +
        '</details>' : '') +
      (candNarrow() ? '</div></details>' : '') + '</aside>' +
      '<div class="t-cand-work">' +
      '<section class="s-insight is-lead s-block-wide" aria-label="Where they are">' +
        '<div class="s-lead-mark"><svg class="s-insight-mark" viewBox="0 0 18 20" width="14" height="14" aria-hidden="true"><use href="#aimy-logo-small"/></svg>' +
          '<span class="work-state ws-detected">Read off the record</span></div>' +
        '<p class="s-lead-deck">' + esc(c.exit ? exitSay(c).charAt(0).toUpperCase() + exitSay(c).slice(1) + '.' +
            (c.told === false && !isClient() ? ' Not told yet; they hear by ' + sayDay(hearBy(c)) + '.' : c.told ? ' They have been told.' : '')
          : isClient() && c.stage === 'sent' ? 'Waiting on your answer since ' + sayDay(c.sentDay != null ? c.sentDay : -c.since) + '.' : candSay(c)) + '</p>' +
        /* The move straight under the sentence that is its reason, the path
           after it (5 Nov): on a phone the path runs down the screen and
           pushed the buttons a screen away. */
        /* Message preview (component library): what they will read, before Send. */
        /* The same message as the lists, sent from inside it. */
        (c.exit && c.told === false && works ? msgPreview(c, true, true) : '') +
        /* The client's decision, in the words of their Today (5 Nov). */
        (isClient() && !c.exit && c.stage === 'sent' ? (passOpen(c) ? passPicker(c) : '<div class="s-lead-acts"><button class="s-insight-lnk primary" type="button" data-move="' + c.id + '|client">Meet them</button>' +
          '<button class="b-ghost" type="button" data-pass-open="' + c.id + '">Pass</button></div>') : '') +
        /* With a sendout, the reasons open inside its card instead. */
        (c.exit || !works ? '' : passOpen(c) && c.sentDay == null ? passPicker(c) : outPicking(c) ? outPicker(c) : writeOpen(c) ? writeBox(c) : '<div class="s-lead-acts">' +
          (isRec() && canCall(c) ? '<button class="s-insight-lnk' + (early ? ' primary' : '') + '" type="button" data-call="' + c.id + '">' + svg('phone', 14) + 'Call ' + esc(first(c.name)) + '</button>' : '') +
          (nx && !early && (w === 'me' || w === 'client' || w === 'candidate') && c.stage !== 'offer' ? '<button class="s-insight-lnk primary" type="button" data-move="' + c.id + '|' + nx + '">' + esc(goSay(c)) + '</button>' : '') +
          exitBtn(c, outK) +
        '</div>') +
        storyTrack(c) +
      '</section>' +
      ivTodayBlock(c) +
      (works && /^Found on/.test(c.source) && c.stage === 'sourced' ? trustCard([c], first(c.name) + ', a web prospect', c) : '') +
      sendoutCard(c) +
      fitCard(c, v) +
      (others.length ? appsBlock(c, others) : '') +
      (isClient() ? '' : asmtBlock(c)) +
      ivBlock(c) +
      (isClient() ? '' : offerBlock(c)) +
      (isClient() ? '' : historyBlock(c)) +
      '</div></div>' +
    '</div>';
  }

  /* INTERVIEW TODAY, on the profile and for the hiring manager (Engy, 29
     Oct): it stood on the recruiter's Today as a list. The interviewer gets
     the time, who is in the room, and the brief to read before it. */
  function ivTodayBlock(c) {
    if (!isHM() || c.exit || !MEETS[c.stage] || c.meet !== 0) return '';
    const q = reqOf(c), v = ivsOf(c).filter((x) => x.status === 'booked' && x.day === 0)[0];
    return '<section class="s-block s-block-wide" aria-label="Interview today">' +
      '<div class="s-camp-list-head"><h2 class="s-block-h">Interview today</h2></div>' +
      srcNote([['Bookings calendar', false]]) +
      '<div class="b-cal-agenda"><div class="b-cal-ev is-plain t-cal-ev">' +
        '<span class="t-cal-open"><span class="b-cal-evtop"><span class="b-cal-dot k-meeting"></span><span class="b-cal-etime">' + esc(c.slot) + '</span>' +
          '<span class="b-kind">' + esc(STAGE[c.stage].label) + '</span></span>' +
          '<span class="b-cal-ename"><b>' + esc(c.name) + '</b><span class="b-cal-ewhat">' + esc(q.title) + ' · ' + esc(accOf(q).name) +
            (v ? ' · with ' + esc(v.by) + (v.mode === 'video' ? ', on Teams' : ', in person') : '') + '</span></span></span>' +
        '<button class="s-inline-btn t-prep-btn" type="button" data-prep="' + c.id + '">' + mark(12) + 'Prepare me</button>' +
      '</div></div></section>';
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
    else body = '<p class="b-cmeta-p"><b>' + esc(scoreSay(a, s)) + '</b>.' + (s.probed && s.probed.length ? ' Taken live; AiMY asked for more on ' + s.probed.map((i) => 'Q' + (i + 1)).join(' and ') + '.' : '') + '</p>' +
      /* How it was scored, and by whom: their consent is part of the result. */
      '<p class="b-cmeta-p">' + (s.consent === 'person' ? (s.reviewed ? 'They asked for a person to score it; ' + esc(DESKS[s.reviewed.by] ? DESKS[s.reviewed.by].name : 'a recruiter') + ' did, ' + esc(sayWhen(s.reviewed.day)) + '.'
          : 'They asked for a person to score it. AiMY’s suggestion above does not count until a person confirms it.')
        : 'Scored by AiMY ' + esc(sayWhen(s.doneDay != null ? s.doneDay : s.day)) + ', with their consent' + (s.review === 'asked' ? (s.reviewed ? '; reviewed by ' + esc(DESKS[s.reviewed.by] ? DESKS[s.reviewed.by].name : 'a recruiter') + ' at their request.' : '. They asked for a person to review it.') : '.')) + '</p>' +
      /* Integrity, said apart: what happened, never a verdict. */
      '<p class="b-cmeta-p t-integ"><b>Integrity, apart from the score:</b> ' + (flagsOf(a, s).length ? esc(flagsOf(a, s).join('; ')) + '. Look at the answer; a flag never changes the score.' : 'nothing to look at.') + '</p>' +
      (needsPerson(s) && works ? '<p class="b-cmeta-p t-acts"><button class="s-insight-lnk primary" type="button" data-asmt-review="' + s.id + '">Confirm ' + esc(scoreShort(a, s)) + ' as the score</button></p>' : '') +
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
      /* Free in both Outlook calendars; a press books it on Teams and sends
         the invite, with Undo (5 Nov). In person, or a time said in words,
         is the chat's. */
      (needsBooking ? '<div class="t-book"><p class="b-tocall"><b>' + esc(STAGE[c.stage].label) + '</b> is next. These times are free in ' + (interviewerFor(q, c.stage).split(',')[0] === me().name ? 'your' : esc(interviewerFor(q, c.stage).split(',')[0]) + '’s and your') + ' Outlook calendar. A press books it on Teams and sends ' + esc(first(c.name)) + ' the Outlook invite.</p>' +
        '<div class="b-cuts t-slots">' + freeSlots(c, 6).map((x) => '<button class="filter-chip" type="button" data-book="' + c.id + '|' + x.d + '|' + x.t + '">' + esc(slotSay(x.d, x.t)) + '</button>').join('') + '</div>' +
        '<p class="t-acts"><button class="s-inline-btn" type="button" data-book-chat="' + c.id + '">In person, or another time? Book it with AiMY</button></p>' +
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
          (v.status !== 'done' && works ? '<button class="s-insight-lnk' + (v.status === 'owed' ? ' primary' : '') + '" type="button"' + goAttr({ debrief: v.id }) + '>' + (v.status === 'owed' ? (ivMine(v) ? 'Write your result' : 'Open the debrief') : 'The debrief link') + '</button>' : '') +
          (v.status === 'owed' && (isRec() || isHR()) && !ivMine(v) ? '<button class="b-ghost" type="button" data-nudge-iv="' + v.id + '">' + (v.nudged ? 'Nudged' : 'Nudge ' + esc(first(v.by)) + ' on Teams') + '</button>' : '') +
          (v.status !== 'booked' && !rec && works && !isClient() ? '<button class="b-ghost" type="button" data-rec-up="' + v.id + '">Upload the recording</button>' : '') +
          (v.status === 'done' || rec ? '<button class="b-ghost t-acc-head" type="button" aria-expanded="false" data-acc-toggle>Details<span class="t-acc-chevron">' + svg('down', 14) + '</span></button>' : '') +
        '</span>' +
      '</div>' +
      (v.status === 'done' || rec ? '<div class="t-acc-panel"><div class="t-acc-panel-inner">' +
        (v.ratings ? '<div class="t-qlist">' + reqOf(c).must.map((m, i) => '<p class="t-q"><span class="tag tag-' + (v.ratings[i] === 'm' ? 'ok' : v.ratings[i] === 'p' ? 'warn' : 'neutral') + '">' + RATE[v.ratings[i]] + '</span>' +
          '<span>' + esc(m) + '. ' + esc(v.notes ? v.notes[i] : '') + '</span></p>').join('') + '</div>' : '') +
        (rec ? '<div class="t-rec">' + aimyBlock({ text: '<b>' + (rec.teams ? 'Teams sent the recording back' : 'Recording') + ', ' + rec.mins + ' minutes, transcribed.</b> ' + esc(rec.summary || 'Summarised and matched to the success profile.'), from: rec.teams ? 'the Teams recording, read by AiMY' : 'the recording, read by AiMY' }) +
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
        ' aria-pressed="' + !!done[i] + '" aria-label="' + esc(x[0].replace('{via}', waAuto(c) ? 'on WhatsApp' : 'by email')) + '">' + (done[i] ? svg('check', 12) : '') + '</button><span>' +
        esc(x[0].replace('{via}', waAuto(c) ? 'on WhatsApp' : 'by email')) + '</span><span class="b-kind">' + esc(x[1]) + '</span></p>').join('') +
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
  /* ONE HISTORY, IN TABS (Engy, 5 Nov). History, Calls with them and the
     interviews each told the same events. Now one place: All, Calls (the
     call log's own rows, so a message they left still plays), WhatsApp (the
     thread's messages, both ways), Interviews (and tests) and Notes. */
  let HIST_TAB = 'all', HIST_FOR = null;
  const HIST_TABS = [['all', 'All'], ['calls', 'Calls'], ['wa', 'WhatsApp'], ['iv', 'Interviews'], ['note', 'Notes']];
  function historyBlock(c) {
    if (HIST_FOR !== c.id) { HIST_FOR = c.id; HIST_TAB = 'all'; }
    const calls = callsOf(c.id), ms = msgsOf(c.id).slice().reverse();
    /* A WhatsApp send is in the thread itself, so its note does not show twice. */
    const all = historyOf(c).filter((x) => !(x.kind === 'msg' && /^On WhatsApp /.test(x.text)))
      .concat(ms.map((m) => ({ day: m.day, time: m.time, kind: 'wa', text: (m.dir === 'in' ? first(c.name) + ' wrote' + (m.added ? ' (added by hand)' : '') : 'You wrote' + (m.own ? ' from your WhatsApp' : '')) + ': “' + m.text + '”' })))
      .sort((a, b) => b.day - a.day || String(b.time).localeCompare(String(a.time)));
    const pick = { all: all, iv: all.filter((x) => x.kind === 'iv' || x.kind === 'asmt'), note: all.filter((x) => x.kind === 'note') };
    const n = { all: all.length, calls: calls.length, wa: ms.length, iv: pick.iv.length, note: pick.note.length };
    const tab = HIST_TAB;
    const h = tab === 'calls' || tab === 'wa' ? [] : pick[tab];
    const ICO = { apply: 'user', call: 'phone', asmt: 'goal', iv: 'users', offer: 'job', move: 'go', out: 'go', note: 'req', msg: 'msg', wa: 'msg' };
    const TONE = { apply: 'brand', call: 'brand', asmt: 'acc', iv: 'acc', offer: 'ok', move: 'ok', out: 'err', note: 'mute', msg: 'brand', wa: 'brand' };
    let day = null;
    const sug = c.histSug ? DB.events.filter((e) => e.id === c.histSug)[0] : null;
    const tabs = '<div class="b-cuts t-hist-tabs" role="group" aria-label="What to show">' + HIST_TABS.map((x) =>
      '<button class="filter-chip' + (tab === x[0] ? ' active' : '') + '" type="button" data-hist-tab="' + x[0] + '" aria-pressed="' + (tab === x[0]) + '">' + esc(x[1]) + '<span class="b-cut-n">' + n[x[0]] + '</span></button>').join('') + '</div>';
    const rows = tab === 'calls' ? (calls.length ? '<div class="b-log">' + logDays(calls, (t, i) => callRow(t, i, false)) + '</div>' : '<p class="b-vfoot">No calls yet.</p>')
      : tab === 'wa' ? (ms.length ? '<div class="t-wa">' + ms.slice().reverse().map((m) => '<div class="t-wa-m ' + (m.dir === 'out' ? 'is-out' : 'is-in') + '"><p class="t-wa-text">' + esc(m.text) + '</p>' +
          '<span class="t-wa-t">' + esc((m.dir === 'out' ? 'You' : first(c.name)) + ' · ' + dayLabel(m.day) + ', ' + m.time) + '</span></div>').join('') + '</div>' : '<p class="b-vfoot">' + (c.wa ? 'Nothing on WhatsApp yet.' : 'No WhatsApp opt-in.') + '</p>') +
        (c.wa ? '<p class="t-acts"><button class="s-inline-btn" type="button"' + goAttr({ on: 'calls', th: c.id }) + '>Open the thread</button></p>' : '')
      : null;
    return rcard({ cap: 'History', ico: 'hist', label: 'History', bare: true,
      body: rcHead('History · ' + esc(c.name), 'newest first', '') + tabs +
      ((isRec() || isHR() || isHM()) ? '<div class="t-addnote"><input class="dial-input" id="histNote" type="text" autocomplete="off" spellcheck="false" ' +
          'placeholder="Add something that happened, like: interviewed by the client on Teams, they said yes" aria-label="Add to their history">' +
        rcBtn('Add', 'data-hist-add="' + c.id + '"', 'primary') + '</div>' : '') +
      (sug && sug.read && !c.exit ? rcAimy('I read “' + esc(sug.text) + '” as <b>' + (sug.read === 'yes' ? 'they passed' : 'they did not pass') + '</b>.', 'from your note',
        (sug.read === 'yes' && nextOf(c) ? rcBtn('Move them to ' + lower(STAGE[nextOf(c)].label), 'data-move="' + c.id + '|' + nextOf(c) + '"', 'psmall')
          : sug.read === 'no' ? rcBtn('Mark as not progressing', 'data-out="' + c.id + '|out"', 'psmall') : '') +
        rcBtn('Leave it', 'data-sug-no="' + c.id + '"', 'small')) : '') +
      (rows != null ? rows : !h.length ? '<p class="b-vfoot">Nothing here yet.</p>' : '<div style="margin-top:4px">' + h.map((x) => {
        const head = x.day !== day ? '<div class="divider">' + esc(dayLabel(x.day)) + '</div>' : '';
        day = x.day;
        const meta = [x.time, x.by && DESKS[x.by] ? DESKS[x.by].name : null].filter(Boolean).join(' · ');
        return head + '<div class="crit" style="border-top:0;padding:8px 0"><span class="' + (RC_ICO[TONE[x.kind]] || 'ico mute') + '">' + svg(ICO[x.kind] || 'req', 18) + '</span>' +
          '<div><b>' + esc(x.text) + '</b>' + (meta ? rcSay(esc(meta)) : '') + '</div><span></span></div>';
      }).join('') + '</div>') });
  }
  /* A note says someone passed or did not, in plain words. */
  const readNote = (t) => /\b(not|didn'?t|did not|no)\b.{0,20}\b(pass|proceed|fit|good)|\bsaid no\b|\brejected\b|\bnot a fit\b/i.test(t) ? 'no'
    : /\b(passed|proceed|said yes|liked (him|her|them)|good fit|move (him|her|them) on|approved)\b/i.test(t) ? 'yes' : null;

  /* ══ THE CV ON HOVER ═════════════════════════════════════════════════════
     Resting on a candidate's name shows their CV, small, beside it. It
     carries what the card has no room for (Engy, 30 Oct: "more info, to add
     value"): each must-have with the line of the CV it rests on and what an
     interview found, what they said on calls and how the last call went,
     and the latest that happened. The card's sentence is not repeated. The
     client sees the must-haves and skills only, as on their desk. It is for
     reading; a click on the name is still the profile. A mouse rests, and
     keyboard focus shows it too; a touch screen has no hover, so there the
     name is the profile as before. */
  const CV_NAMES = '.tc-title[data-cand], .t-row-open, h4 > [data-cand]';
  let CV_T = null, CV_ON = null;
  const CV_EV = { m: ['check', 'is-m'], p: ['dot', 'is-p'], n: ['qc', 'is-n'] };
  const CV_IV = { ok: 't-cv-iv is-ok', warn: 't-cv-iv is-warn', err: 't-cv-iv is-err' };
  function cvCard(c) {
    const q = reqOf(c), inside = !isClient();
    const sec = (cap, body) => '<div class="t-cv-sec"><span class="t-cv-cap">' + cap + '</span>' + body + '</div>';
    const v = verified(c);
    const musts = (q.must || []).length ? sec('The CV, against the must-haves', '<ul class="t-cv-musts">' + q.must.map((m, i) => {
      const e = c.ev[i], st = v[i].seen[0] ? FIT_ST[v[i].state] : null;
      return '<li class="t-cv-must ' + CV_EV[e][1] + '">' + svg(CV_EV[e][0], 12) + '<span><span class="t-cv-mhead"><b>' + esc(m) + '</b>' +
        (st ? '<span class="' + (CV_IV[st[1]] || 't-cv-iv') + '" title="What the interview found">' + esc(st[0]) + '</span>' : '') + '</span>' +
        '<span class="t-cv-line">' + (e === 'n' ? 'Not on the CV, so not known yet' : '“' + esc(cvSays(c, m)) + '”') + '</span></span></li>';
    }).join('') + '</ul>') : '';
    /* What the phone screen got, and how the last call went. */
    const last = lastCall(c), n = callsOf(c.id).length;
    const reach = c.dnc ? 'Asked not to be called again.' : c.badNumber ? 'This number did not work.'
      : last ? plural(n, 'call') + ', the last ' + dayLabel(last.day).replace(/^[TY]/, (x) => x.toLowerCase()) + ': ' + (last.missed ? 'got nobody' : lower(OUTCOME[last.outcome].label)) + '.'
      : 'Not called yet.';
    const said = [c.notice ? c.notice.charAt(0).toUpperCase() + c.notice.slice(1) : '', c.salary ? 'Expects ' + c.salary : ''].filter(Boolean).join(' · ');
    const calls = inside ? sec('On calls', '<p>' + (c.phone && !c.dnc ? '<b>' + esc(c.phone) + '</b> · ' : '') + esc(reach) + '</p>' +
      '<p class="' + (said ? '' : 't-cv-none') + '">' + esc(said || 'Notice and salary not asked yet.') + '</p>') : '';
    /* The newest thing that happened, calls apart since they are above
       and applying apart since the foot says where they came from. */
    const lately = inside ? historyOf(c).filter((x) => x.kind !== 'call' && x.kind !== 'apply').slice(0, 1) : [];
    const was = inside ? before(c) : null;
    /* Distilled 5 Nov, as the card: who they are as one group, then each
       section by space alone, no rules between them and no chips. */
    return '<div class="t-cv-who"><div class="t-cv-head"><span class="t-cv-name">' + esc(c.name) + '</span>' + stageTag(c) + '</div>' +
      '<p class="t-cv-role">' + esc(c.at) + '</p>' +
      '<p class="t-cv-facts">' + fact('job', plural(c.years, 'year')) + fact('pin', c.place) + fact('lang', c.langs.join(', ')) + '</p></div>' +
      musts +
      ((c.skills || []).length ? sec('Skills', '<p>' + esc(c.skills.join(' · ')) + '</p>') : '') +
      calls +
      (lately.length ? sec('Lately', lately.map((x) => '<p class="t-cv-event"><span>' + esc(dayLabel(x.day)) + '</span>' + esc(x.text) + '</p>').join('')) : '') +
      '<p class="t-cv-foot">' + esc(c.source) + ' · for ' + esc(q.title) + (was ? '<br>' + esc(beforeSay(was)) + '.' : '') + '</p>';
  }
  /* Under the name, or over it when the window has no room below. The page
     sits inside the shell's zoom, so the name's box is read back into it. */
  function cvShow(el) {
    const c = DB.byId[el.getAttribute('data-cand')];
    if (!c || !sees(c) || !el.isConnected) return;
    const pop = byId('cvPop');
    if (CV_ON !== el) { if (CV_ON) CV_ON.removeAttribute('aria-describedby'); pop.innerHTML = cvCard(c); CV_ON = el; }
    pop.hidden = false;
    el.setAttribute('aria-describedby', 'cvPop');
    const z = parseFloat(getComputedStyle(document.body).zoom) || 1;
    const r = el.getBoundingClientRect(), w = pop.offsetWidth * z, h = pop.offsetHeight * z;
    const below = r.bottom + 8 + h <= innerHeight - 8, above = r.top - 8 - h >= 8;
    /* Neither: beside the name, on the side with room, never over it. */
    const side = !below && !above ? (r.right + 12 + w <= innerWidth - 8 ? r.right + 12 : Math.max(8, r.left - 12 - w)) : null;
    const x = side != null ? side : Math.min(Math.max(8, r.left), innerWidth - w - 8);
    const y = below ? r.bottom + 8 : above ? r.top - 8 - h : Math.min(Math.max(8, r.top - 24), innerHeight - h - 8);
    pop.style.left = (x / z) + 'px';
    pop.style.top = (y / z) + 'px';
  }
  function cvHide() {
    clearTimeout(CV_T);
    if (!CV_ON) return;
    CV_ON.removeAttribute('aria-describedby');
    CV_ON = null;
    byId('cvPop').hidden = true;
  }
  /* A short rest before it shows, so passing over a list does not flash a
     card per name; once one is up, the next name answers at once. */
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (e.target.closest('#cvPop')) { clearTimeout(CV_T); return; }
    const el = e.target.closest(CV_NAMES);
    if (!el) return;
    clearTimeout(CV_T);
    CV_T = setTimeout(() => cvShow(el), CV_ON ? 0 : 350);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const from = e.target.closest(CV_NAMES + ', #cvPop');
    if (!from || (e.relatedTarget && from.contains(e.relatedTarget))) return;
    clearTimeout(CV_T);
    CV_T = setTimeout(cvHide, 150);
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest && e.target.closest(CV_NAMES);
    if (el && el.matches(':focus-visible')) cvShow(el); else cvHide();
  });
  document.addEventListener('focusout', (e) => { if (e.target === CV_ON) cvHide(); });
  document.addEventListener('click', cvHide, true);
  byId('pageScroll').addEventListener('scroll', cvHide, { passive: true });

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
      /* "3+ years of experience", with no field named, is met by the years alone (5 Nov). */
      if (yr) return p.years >= Number(yr[1]) ? (hit || /support|account|operation|analyst/.test(t) || /years? of experience$/.test(t) ? 'm' : 'p') : 'p';
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
  function bookIv(c, d, slot, mode, onUndo) {
    const q = reqOf(c);
    const tpl = tplFor(c.stage);
    mode = mode || 'video';
    const v = make('ivs', { id: uid('iv'), cand: c.id, stage: c.stage, day: d, slot: slot, by: interviewerFor(q, c.stage), mode: mode, invite: 'outlook',
      status: 'booked', ratings: null, notes: null, verdict: null, recording: null, tpl: tpl ? tpl.id : null });
    const was = { meet: c.meet, slot: c.slot, fb: c.fb };
    write(c, { meet: d, slot: slot, fb: false });
    const by = v.by.split(',')[0];
    const e = note(c, 'iv', 'Booked the ' + lower(STAGE[c.stage].label) + ' with ' + v.by + ', ' + sayWhen(d) + ' at ' + slot + (mode === 'video' ? ', on Teams' : ', in person') + '. Outlook invite sent to ' + first(c.name) + (by === me().name ? '' : ' and ' + by) + '.');
    paint();
    toast('Booked ' + sayWhen(d) + ' at ' + slot + ', invite sent', () => { unmake('ivs', v); unmake('events', e); write(c, was); if (onUndo) onUndo(); paint(); if (canvasShown()) paintThread(); },
      'Outlook invite to ' + first(c.name) + (by === me().name ? '' : ' and ' + by) + '. Undo cancels it.');
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
  function recBuild(v) {
    const c = DB.byId[v.cand], q = reqOf(c);
    const sug = c.ev.map((x, i) => (i % 3 === 2 && x === 'm' ? 'p' : x === 'n' && i % 2 ? 'p' : x));
    const lines = [];
    q.must.forEach((m, i) => { lines.push(['you', 'Give me an example for this one: ' + lower(m) + '.']); lines.push(['them', ANSWER[sug[i]]]); });
    const strong = q.must.filter((m, i) => sug[i] === 'm'), weak = q.must.filter((m, i) => sug[i] !== 'm');
    return { mins: 26 + (v.id.length % 17), at: 0, lines: lines,
      summary: (strong.length ? 'Clear examples on ' + strong.join('; ') + '. ' : '') + (weak.length ? 'Less to go on for ' + weak.join('; ') + '.' : ''), suggests: sug };
  }
  /* AN INTERVIEW ON TEAMS BRINGS ITS RECORDING BACK (5 Nov), as a Teams
     call does: once it has been held, the recording and transcript are on
     the interview, read the same way an upload is. Teams announced the
     recording in the meeting, so nothing is uploaded by hand. */
  function teamsRecs() {
    DB.ivs.forEach((v) => { if (v.mode === 'video' && v.status !== 'booked' && !v.recording && DB.byId[v.cand]) v.recording = Object.assign(recBuild(v), { teams: true }); });
  }
  function uploadRec(v) {
    if (REC_BUSY[v.id] || v.recording) return;
    REC_BUSY[v.id] = true;
    paint();
    toast('Uploading the recording', null, 'Transcribing it and matching what was said to the success profile.');
    setTimeout(() => {
      delete REC_BUSY[v.id];
      const c = DB.byId[v.cand];
      put('ivs', v, { recording: recBuild(v) });
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
    if ((DEBRIEF.sent || (v.status === 'done' && v.verdict)) && v.by.split(',')[0] === DESKS.omar.name) {
      return '<div class="t-out">' + outsideHead('Interview debrief', 'For ' + v.by) +
        '<section class="t-out-card t-done">' + successCheck() + '<h1 class="t-out-h">Saved. The result is in.</h1>' +
          '<p>You said <b>' + (v.verdict === 'yes' ? 'proceed' : 'do not proceed') + '</b> for ' + esc(c.name) + '. It waits on your call with the other results.</p>' +
          '<p class="t-acts"><button class="s-insight-lnk primary" type="button"' + goAttr({ cand: c.id }) + '>Back to ' + esc(first(c.name)) + '</button></p></section></div>';
    }
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
    /* Nobody is told of their own debrief. */
    if (v.by.split(',')[0] !== (DESKS[q.rec] || {}).name) tellDesk(q.rec, { sev: 'p1', type: 'Debrief in', cta: 'Decide', go: { cand: c.id },
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
      (waAuto(c) ? 'By WhatsApp and email' : 'By ' + noWaSay(c)) + ', with their link. AiMY scores it when they finish.');
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
    { k: 'signal', label: 'SignalHire', say: 'Not in use yet', parked: true },
  ];
  const WEB_PAGES = [['Public GitHub profile', 'github.com/'], ['Portfolio', 'behance.net/'], ['Company team page', 'team page, '], ['Conference speaker page', 'speaker, ']];
  const KEYS_TO_MUST = [
    [/german/i, 'German at C1 or above'], [/english/i, 'Fluent English'], [/\bsql\b/i, 'SQL to read logs and data'],
    [/zendesk|freshdesk|ticket/i, 'Ticketing tools (Zendesk or Freshdesk)'], [/support|helpdesk|customer/i, 'Software support experience'],
    [/netsuite|erp|oracle/i, 'NetSuite or a similar ERP'], [/receivable|collection/i, 'Accounts receivable and collections'],
    [/excel/i, 'Advanced Excel'], [/reconcil/i, 'Bank reconciliations'], [/month.?end|closing the books/i, 'Month-end close'], [/ledger/i, 'General ledger work'],
    [/process|operation/i, 'Process documentation'],
    [/jira/i, 'Jira'], [/api/i, 'REST APIs'],
  ];
  let FIND = { q: '', req: null, src: { pool: true, web: true, apollo: true, signal: false }, step: 'ask', i: 0, res: [], done: {}, tab: 'pool', why: {},
    mode: null, like: null, cl: [], clKey: null, need: null, flagOpen: null };
  /* LIKE THE PERSON WHO LEFT (Find, 29 Oct; R3). 82% of requests replace
     someone, so the first way in is the person: their role's success
     profile becomes the criteria, and an open requisition for the same
     role and account takes whoever is added. */
  const pastOf = (id) => DB.past.filter((p) => p.id === id)[0] || null;
  const leavers = () => DB.past.filter((p) => !p.stayed && deskAccs().some((a) => a.id === p.acc));
  const reqFor = (p) => DB.reqs.filter((q) => isOpen(q) && q.title === p.title && q.acc === p.acc && (isHR() || q.rec === DESK))[0] || null;
  function findCriteria() {
    const lp = FIND.mode === 'like' ? pastOf(FIND.like) : null;
    const lr = lp && ROLES.filter((r) => r.title === lp.title)[0];
    if (lr) return lr.must.slice();
    if (FIND.req && DB.reqById[FIND.req]) return DB.reqById[FIND.req].must.slice();
    const t = FIND.q || '';
    const out = KEYS_TO_MUST.filter((x) => x[0].test(t)).map((x) => x[1]);
    const y = /(\d+)\+?\s*years?/i.exec(t);
    if (y) out.unshift(y[1] + '+ years of experience');
    return out.slice(0, 6);
  }
  /* THE CRITERIA, SHOWN BEFORE THE SEARCH AND EDITABLE (R3: four to six,
     drafted from the job and the last hire, each marked required or
     preferred). Drafted again whenever where they come from changes; an
     edit holds until then. */
  const critKey = () => FIND.mode + '|' + (FIND.mode === 'like' ? FIND.like : FIND.mode === 'req' ? FIND.req : FIND.q);
  function critList() {
    if (FIND.clKey !== critKey()) { FIND.cl = findCriteria().map((t) => ({ t: t, need: true })); FIND.clKey = critKey(); }
    return FIND.cl;
  }
  function critBlock() {
    const cl = critList(), lp = FIND.mode === 'like' ? pastOf(FIND.like) : null, q = FIND.req ? DB.reqById[FIND.req] : null;
    const from = lp ? 'from ' + lp.name + '’s role' : FIND.mode === 'req' && q ? 'from the success profile for ' + q.title : FIND.q.trim() ? 'read from what you wrote' : '';
    if (!cl.length) return '<div class="t-crit" id="findCrit"><p class="b-vfoot">' + (FIND.mode === 'like' ? 'Pick who left, and their role becomes what to look for.'
      : FIND.mode === 'req' ? 'Pick a requisition, and its success profile becomes what to look for.' : 'Write what to look for, and it is read into criteria here.') + '</p></div>';
    return '<div class="t-crit" id="findCrit"><div class="t-crit-head"><span class="t-crit-cap">Read against</span><span class="t-crit-from">' + esc(from) + ' · change any line · four to six works best</span></div>' +
      cl.map((c, i) => '<div class="t-crit-row"><input class="b-draft-in t-crit-in" type="text" data-crit-ed="' + i + '" value="' + esc(c.t) + '" aria-label="Criterion ' + (i + 1) + '" spellcheck="false">' +
        '<span class="t-crit-need" role="group" aria-label="How much it matters">' + [[1, 'Required'], [0, 'Preferred']].map((o) => { const on = !!c.need === !!o[0];
          return '<button class="t-crit-opt' + (on ? ' is-on' : '') + '" type="button" data-crit-need="' + i + '|' + o[0] + '" aria-pressed="' + on + '">' + o[1] + '</button>'; }).join('') + '</span>' +
        '<button class="t-crit-x" type="button" data-crit-del="' + i + '" aria-label="Remove ' + esc(c.t) + '">' + svg('x', 14) + '</button></div>').join('') +
      (cl.length < 8 ? '<div class="t-crit-row t-crit-add"><input class="b-draft-in t-crit-in" type="text" id="critNew" placeholder="Add one, like Arabic and English" aria-label="Add a criterion" spellcheck="false">' +
        '<button class="b-ghost" type="button" data-crit-add>Add</button></div>' : '') +
      (cl.length > 6 ? '<p class="b-vfoot">' + cl.length + ' criteria. Past six, most profiles are silent on enough of them that the strongest people read as weak.</p>' : '') +
    '</div>';
  }
  /* REPORT WRONG DATA (R3, R8): a public page can be about someone else,
     or out of date. A report keeps that page from being used for them
     again and reaches the data team; Not this person takes them out. */
  const FLAG_WHY = [['person', 'Not this person'], ['job', 'Wrong job or company'], ['email', 'Wrong email'], ['old', 'Out of date']];
  const flagOf = (x) => D.flags.filter((f) => f.name === x.name && f.page === x.page)[0] || null;
  const WEB_AT = ['Support Engineer at a payments startup', 'Customer Success Specialist at a SaaS company', 'Accountant at a logistics group',
    'Operations Analyst at an e-commerce company', 'Technical Support Lead at a telecom', 'AR Specialist at a hospital group', 'Helpdesk Engineer at a bank'];
  function runFind() {
    const cl = critList().filter((c) => String(c.t).trim());
    const crit = cl.map((c) => String(c.t).trim());
    if (!crit.length) { if (byId('wrapFind')) shake('wrapFind'); else toast('Pick where to start first', null, 'Who left, a requisition, or what you wrote.'); return; }
    FIND.crit = crit;
    FIND.need = cl.map((c) => !!c.need);
    FIND.flagOpen = null;
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
    (FIND.q + '|' + (FIND.req || '') + '|' + (FIND.mode === 'like' ? FIND.like : '')).split('').forEach((ch) => { h = (h * 33 + ch.charCodeAt(0)) >>> 0; });
    const r = rng(h);
    /* The role's family decides whose pool is searched (5 Nov): like the
       person who left, it is their role's, never the default an empty text
       box gives, which sent an accountant search to support people. */
    const lp = FIND.mode === 'like' ? pastOf(FIND.like) : null;
    const fam = FIND.req ? DB.reqById[FIND.req].fam : lp ? famOf(lp.title) : famOf(FIND.q + ' ' + crit.join(' '));
    const res = [];
    const fromPerson = (p, src, extra) => {
      if (D.gone.some((g) => g.name === p.name)) return;
      const ev = evFor(crit, { langs: p.langs, skills: p.skills || [], years: p.years });
      /* A required criterion counts twice what a preferred one does. */
      const wt = (k) => (FIND.need && FIND.need.length === crit.length && !FIND.need[k] ? 1 : 2);
      const o = Object.assign({ src: src, name: p.name, at: p.at, place: p.place, years: p.years, langs: p.langs, skills: p.skills || [], ev: ev,
        score: ev.reduce((sum, x, k) => sum + wt(k) * (x === 'm' ? 1 : x === 'p' ? 0.5 : 0), 0), phone: p.phone || null, email: p.email || null }, extra || {});
      if (src === 'web') o.seen = -1 - (vmHash(p.name) % 60);
      const fl = src === 'web' ? flagOf(o) : null;
      if (fl && fl.why === 'person') return;
      if (fl) { o.flag = fl.why; o.score -= 100; }
      res.push(o);
    };
    if (FIND.src.pool) {
      const seen = {};
      /* The most recent leavers first: they are the warmest, and a saved
         search counts them as new. */
      DB.cands.filter((c) => (c.exit === 'out' || c.exit === 'clientno' || c.exit === 'withdrew') && reqOf(c).fam === fam).sort((a, b) => a.since - b.since).forEach((c) => {
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
    /* Anyone meeting none of it is left out and counted, not listed under
       "who fits" (5 Nov). The pool first, then the web, each strongest first. */
    FIND.out = { pool: res.filter((x) => x.src === 'pool' && x.score <= 0).length, web: res.filter((x) => x.src !== 'pool' && x.score <= 0).length };
    const kept = res.filter((x) => x.score > 0);
    kept.sort((a, b) => (a.src === 'pool' ? 0 : 1) - (b.src === 'pool' ? 0 : 1) || b.score - a.score);
    kept.forEach((x, i) => { x.i = i; });
    return kept;
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
  /* WHO FIRST (Engy, 5 Nov). It asked pool or web before anything, and a
     brief typed there read as "Nothing matches". Now: who (a requisition,
     someone who left, or typed), read back as criteria, then Find them,
     the pool first and the web after, with Only the pool or Only the web
     beside it for when that matters. */
  function findChat(reqId, text) {
    CHAT_AT = null;
    FC = { req: reqId || null, q: text || '', like: null, src: 'both', waiting: false };
    peekHide();
    if (!canvasShown()) openCanvas();
    if (!chatNow() || !chatNow().title) chatFor().title = text || 'Find people';
    if (text) fcSay('you', text);
    if (fcCrit().length) { fcRead(); return; }
    fcAskWho();
  }
  function fcAskWho() {
    const open = DB.reqs.filter(isOpen).filter((q) => isHR() || q.rec === DESK);
    FC.waiting = true;
    fcSay('aimy', 'Who are you looking for? Pick a requisition or someone who left, or type what you need, like “accountants with month-end close, 3 years”.',
      open.slice(0, 4).map((q) => ({ label: q.title + ' · ' + accOf(q).name, data: 'fc="req:' + q.id + '"' }))
        .concat(leavers().slice(0, 3).map((x) => ({ label: 'Like ' + x.name + ', who left', data: 'fc="like:' + x.id + '"' }))));
  }
  function fcRead() {
    FC.waiting = false;
    const crit = fcCrit(), lp = FC.like ? pastOf(FC.like) : null;
    fcSay('aimy', 'I read that as ' + (FC.req ? 'the success profile for <b>' + esc(DB.reqById[FC.req].title) + '</b>' : lp ? '<b>' + esc(lp.name) + '</b>’s role, ' + esc(lp.title) : 'what you wrote') + ': ' +
      crit.map((m) => '<b>' + esc(m) + '</b>').join(', ') + '. I look in your pool first, then on public pages. Each person comes back with how many of these they meet; a profile that is silent on one reads Not known, not No.',
      [{ label: 'Find them', data: 'fc="go:both"', primary: true }, { label: 'Only the pool', data: 'fc="go:pool"' }, { label: 'Only the public web', data: 'fc="go:web"' }]);
  }
  /* A brief typed while AiMY waits for who. */
  function fcTyped(text) {
    if (!FC || !FC.waiting) return false;
    FC.q = text; FC.req = null; FC.like = null;
    fcSay('you', text);
    if (!fcCrit().length) { fcSay('aimy', 'I could not read what to look for in that. Name a skill, a tool or a language, or pick a requisition above.', []); return true; }
    fcRead();
    return true;
  }
  function fcCrit() {
    FIND.q = FC.q; FIND.req = FC.req; FIND.like = FC.like; FIND.mode = FC.req ? 'req' : FC.like ? 'like' : 'text'; FIND.need = null;
    return findCriteria();
  }
  function fcStep(v) {
    if (!FC) return;
    const open = DB.reqs.filter(isOpen).filter((q) => isHR() || q.rec === DESK);
    if (v.indexOf('req:') === 0) { FC.req = v.slice(4); FC.like = null; FC.q = ''; fcSay('you', DB.reqById[FC.req].title); fcRead(); return; }
    if (v.indexOf('like:') === 0) { FC.like = v.slice(5); FC.req = null; FC.q = ''; const lp = pastOf(FC.like); fcSay('you', 'Like ' + (lp ? lp.name : 'them')); fcRead(); return; }
    if (v === 'enough') v = 'go:both';
    if (v.indexOf('go:') === 0) {
      FC.src = v.slice(3);
      fcSay('you', { both: 'Find them', pool: 'Only the pool', web: 'Only the public web' }[FC.src]);
      FIND.src = { pool: FC.src !== 'web', web: FC.src !== 'pool', apollo: true, signal: false };
      const crit = fcCrit();
      const res = gatherFind(crit);
      /* Named for what was asked: the requisition, who left, or the brief itself. */
      const lp = FC.like ? pastOf(FC.like) : null, brief = String(FC.q || '').trim();
      const title = (FC.req ? DB.reqById[FC.req].title : lp ? 'Like ' + lp.name : brief ? (brief.length > 40 ? brief.slice(0, 40).replace(/[ ,]+\S*$/, '') + '…' : brief) : crit[0] || 'People') + ', ' + sayDay(0);
      FC.res = res; FC.crit = crit; FC.name = title;
      const pool = res.filter((x) => x.src === 'pool').length;
      const out = FIND.out || { pool: 0, web: 0 };
      fcSay('aimy', res.length ? '<b>' + plural(res.length, 'person', 'people') + '</b> came back: ' + pool + ' from your pool, ' + (res.length - pool) + ' from public pages, each page named' +
          (out.pool + out.web ? '; ' + (out.pool + out.web) + ' more met none of it and are left out' : '') + '. I would call it “' + esc(title) + '”.'
        : 'Nobody met any of it, in your pool or on public pages. Loosen one of the criteria, or try a requisition.',
        res.length ? [{ label: 'Curate the list', data: 'fc="curate"', primary: true }] : []);
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
  /* AiMY's read on a shortlist card, in the Candidates card's own form
     (5 Nov): the verdict, then one sentence on what shows and what to check. */
  function shortRead(x, crit) {
    const lc = (m) => /^(German|English|Arabic|NetSuite|SQL|Jira|REST|Advanced Excel)\b/.test(m) ? m : m.charAt(0).toLowerCase() + m.slice(1);
    const met = crit.filter((m, k) => x.ev[k] === 'm').map(lc), part = crit.filter((m, k) => x.ev[k] === 'p').map(lc), unk = crit.filter((m, k) => x.ev[k] === 'n').map(lc);
    const v = met.length >= 2 ? ['Strong fit', 'is-strong'] : met.length || part.length ? ['Partly fits', 'is-part'] : ['Not shown yet', 'is-none'];
    const f = first(x.name);
    const say = (met.length ? f + ' shows <b>' + esc(listSay(met)) + '</b>' + (part.length ? ', and partly <em>' + esc(listSay(part)) + '</em>' : '') : part.length ? f + ' partly shows <em>' + esc(listSay(part)) + '</em>' : f + '’s profile is silent on these') + '.' +
      (unk.length ? ' I’d check ' + esc(listSay(unk)) + '.' : '');
    return '<div class="t-ins" title="AiMY’s read of ' + (x.src === 'pool' ? 'their history with us' : 'a public page, named on the card') + '">' +
      '<p class="t-ins-h">' + mark(12) + '<span class="t-ins-v ' + v[1] + '">' + v[0] + '</span></p><p class="t-ins-say">' + say + '</p></div>';
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
      shortRead(x, d.crit) +
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
    if (S.req && S.req !== FIND.req && FIND.step !== 'results') { FIND.req = S.req; FIND.mode = 'req'; }
    if (!FIND.mode) FIND.mode = leavers().length ? 'like' : 'req';
    const open = DB.reqs.filter(isOpen).filter((q) => isHR() || q.rec === DESK);
    const left = leavers();
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
        '<div class="s-camp-list-head"><h2 class="s-block-h">Find candidates</h2></div>' +
        '<p class="b-tocall">Start from:</p>' +
        '<div class="b-cuts t-find-mode" role="group" aria-label="Start from">' + [['like', 'Like the person who left'], ['req', 'An open requisition'], ['text', 'Describe or paste']].map((m) =>
          '<button class="filter-chip' + (FIND.mode === m[0] ? ' active' : '') + '" type="button" data-find-mode="' + m[0] + '" aria-pressed="' + (FIND.mode === m[0]) + '">' + m[1] + '</button>').join('') + '</div>' +
        (FIND.mode === 'like' ? (left.length ? '<div class="b-cuts">' + left.map((p) => '<button class="filter-chip' + (FIND.like === p.id ? ' active' : '') + '" type="button" data-find-like="' + p.id + '">' +
            esc(p.name) + '<span class="b-cut-n">' + esc(p.title) + ' · ' + esc(accOf(p).name) + '</span></button>').join('') + '</div>' +
            (pastOf(FIND.like) ? '<p class="b-vfoot">' + esc(first(pastOf(FIND.like).name)) + ' left: ' + esc(lower(pastOf(FIND.like).why)) + '.' +
              (FIND.req ? ' Whoever you add goes on ' + esc(DB.reqById[FIND.req].title) + ', the open requisition for this role.' : ' No open requisition for this role yet; you pick one when you add someone.') + '</p>' : '')
          : '<p class="b-vfoot">Nobody has left on your accounts. Start from a requisition instead.</p>')
        : FIND.mode === 'req' ? '<div class="b-cuts">' + open.map((q) => '<button class="filter-chip' + (FIND.req === q.id ? ' active' : '') + '" type="button" data-find-req="' + q.id + '">' + esc(q.title) + ' · ' + esc(accOf(q).name) + '</button>').join('') + '</div>'
        : '<div class="t-input-wrap" id="wrapFind"><textarea class="dial-input t-area t-input t-findq" rows="3" data-find-q aria-label="What to look for" ' +
          'placeholder="Paste a job description or a CV, or list skills: German, Zendesk, SQL, 3 years">' + esc(FIND.q) + '</textarea>' +
          '<p class="t-error-msg">Tell me what to look for.</p></div>') +
        '<p class="b-tocall">Where to look:</p>' +
        '<div class="b-cuts">' + FIND_SOURCES.map((s) => s.parked
          ? '<button class="filter-chip t-parked" type="button" disabled title="Consent and accuracy complaints. Kept off until decision D10.">' + esc(s.label) + '<span class="b-cut-n">' + esc(s.say) + '</span></button>'
          : '<button class="filter-chip' + (FIND.src[s.k] ? ' active' : '') + '" type="button" data-find-src="' + s.k + '" aria-pressed="' + !!FIND.src[s.k] + '">' + esc(s.label) + '<span class="b-cut-n">' + esc(s.say) + '</span></button>').join('') + '</div>' +
        critBlock() +
        '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-find-go>' + (FIND.step === 'results' ? 'Search again' : 'Find candidates') + '</button>' +
          (FIND.step === 'results' ? '<button class="b-ghost" type="button" data-find-save>Save this search</button>' : '') +
          '<button class="b-ghost" type="button" data-start="find">Or ask AiMY in the chat</button></p>' +
        body +
      '</section>' + after + searchesBlock() +
      (D.lists.length ? '<section class="s-block s-block-wide" aria-label="Saved shortlists"><div class="s-camp-list-head"><h2 class="s-block-h">Saved shortlists</h2><span class="s-block-say">' + D.lists.length + '</span></div>' +
        '<div class="b-owed">' + D.lists.slice().reverse().map((l, i) => '<button class="b-owed-row" type="button"' + goAttr({ on: 'draft', list: l.id }) + ' style="--i:' + Math.min(i, 8) + '">' +
          '<span class="b-owed-sev" aria-hidden="true"></span><span class="b-owed-main"><span class="b-owed-head"><span class="b-owed-type">' + esc(l.name) + '</span>' +
            '<span class="b-owed-by">' + plural(l.res.length, 'person', 'people') + (l.req && DB.reqById[l.req] ? ' · ' + esc(DB.reqById[l.req].title) : '') + '</span></span>' +
            '<span class="b-owed-body">Saved ' + esc(sayWhen(l.day)) + ' by ' + esc(DESKS[l.by] ? DESKS[l.by].name : 'you') + '.</span></span>' +
          '<span class="b-owed-go">Open it</span></button>').join('') + '</div></section>' : '') +
    '</div>';
  }
  /* ══ SAVED SEARCHES THAT SAY WHAT IS NEW (Find, 29 Oct; R3) ══════════════
     A search is kept with where it started, its criteria and its sources.
     Each time Find opens it is run again quietly, and anyone in the pool
     who left a requisition after it was last run counts as new: said on
     the row and as the count on the Find candidates tab. Running it marks
     them seen. One sample search ships, so the count has something to say. */
  const SEED_SEARCHES = [{ id: 'ss1', name: 'Support people with German or SQL', mode: 'text', q: 'German, Zendesk, SQL, 2 years', req: null, like: null, cl: null,
    src: { pool: true, web: true, apollo: true, signal: false }, day: -4, by: 'omar' }];
  const searches = () => SEED_SEARCHES.filter((x) => D.searchGone.indexOf(x.id) < 0).concat(D.searches).filter((x) => x.by === DESK || isHR());
  const lastRun = (x) => (D.searchRun[x.id] != null ? D.searchRun[x.id] : x.day);
  /* Runs a saved search without touching the page's own search. */
  function searchRes(x) {
    const keep = { q: FIND.q, req: FIND.req, mode: FIND.mode, like: FIND.like, src: FIND.src, need: FIND.need };
    Object.assign(FIND, { q: x.q || '', req: x.req, mode: x.mode, like: x.like, src: x.src, need: x.cl ? x.cl.map((c) => !!c.need) : null });
    const crit = x.cl ? x.cl.map((c) => c.t) : findCriteria();
    const res = crit.length ? gatherFind(crit) : [];
    Object.assign(FIND, keep);
    return res;
  }
  /* New in the pool: they left a requisition after the search last ran. */
  const searchNew = (x) => searchRes(x).filter((r) => r.src === 'pool' && r.pid && DB.cands.some((c) => c.pid === r.pid && c.exit && -c.since > lastRun(x)));
  function searchesBlock() {
    const list = searches();
    if (!list.length) return '';
    return '<section class="s-block s-block-wide" aria-label="Saved searches"><div class="s-camp-list-head"><h2 class="s-block-h">Saved searches</h2>' +
      '<span class="s-block-say">run again each time you open Find · new people in your pool are counted</span></div>' +
      '<div class="b-owed">' + list.map((x, i) => {
        const fresh = searchNew(x);
        return '<div class="b-owed-row t-row" style="--i:' + Math.min(i, 8) + '"><span class="b-owed-sev" aria-hidden="true"></span>' +
          '<button class="b-owed-main t-row-open" type="button" data-search-run="' + x.id + '"><span class="b-owed-head"><span class="b-owed-type">' + esc(x.name) + '</span>' +
            '<span class="b-owed-by">' + (x.cl ? plural(x.cl.length, 'criterion', 'criteria') : 'criteria read from what was written') + ' · saved ' + esc(sayWhen(x.day)) + '</span>' +
            (fresh.length ? tag(fresh.length + ' new', 'info') : '') + '</span>' +
            '<span class="b-owed-body">' + (fresh.length ? '<b>' + plural(fresh.length, 'person', 'people') + '</b> in your pool ' + (fresh.length === 1 ? 'matches' : 'match') + ' it since ' + esc(sayWhen(lastRun(x))) + ': ' + esc(fresh.map((r) => r.name).join(', ')) + '.'
              : 'Nothing new in your pool since ' + esc(sayWhen(lastRun(x))) + '.') + '</span></button>' +
          '<span class="t-acts"><button class="s-inline-btn" type="button" data-search-run="' + x.id + '">Run it</button><button class="s-inline-btn" type="button" data-search-del="' + x.id + '">Delete</button></span></div>';
      }).join('') + '</div></section>';
  }
  function saveSearch() {
    const q = FIND.req ? DB.reqById[FIND.req] : null, lp = FIND.mode === 'like' ? pastOf(FIND.like) : null;
    const name = lp ? 'Like ' + lp.name + ', ' + lp.title : FIND.mode === 'req' && q ? 'People for ' + q.title : (FIND.q.trim().split('\n')[0] || 'A search').slice(0, 60);
    const x = { id: uid('ss'), name: name, mode: FIND.mode, q: FIND.q, req: FIND.req, like: FIND.like, cl: critList().map((c) => ({ t: c.t, need: !!c.need })),
      src: Object.assign({}, FIND.src), day: 0, by: DESK };
    D.searches.push(x); save(); paint();
    toast('Search saved', () => { D.searches = D.searches.filter((y) => y !== x); save(); paint(); }, 'It runs again whenever you open Find, and new people in your pool are counted on the tab.');
  }
  function runSearch(id) {
    const x = searches().filter((y) => y.id === id)[0];
    if (!x) return;
    Object.assign(FIND, { q: x.q || '', req: x.req, mode: x.mode, like: x.like, src: Object.assign({}, x.src), step: 'ask' });
    FIND.clKey = critKey();
    FIND.cl = x.cl ? x.cl.map((c) => ({ t: c.t, need: c.need })) : findCriteria().map((t) => ({ t: t, need: true }));
    D.searchRun[x.id] = 0; save();
    if (S.on !== 'find') go({ on: 'find' });
    runFind();
  }
  function delSearch(id) {
    const x = searches().filter((y) => y.id === id)[0];
    if (!x) return;
    const seeded = SEED_SEARCHES.indexOf(x) >= 0;
    if (seeded) D.searchGone.push(id); else D.searches = D.searches.filter((y) => y !== x);
    save(); paint();
    toast('Search deleted', () => { if (seeded) D.searchGone = D.searchGone.filter((y) => y !== id); else D.searches.push(x); save(); paint(); });
  }
  function flagFind(i, why) {
    const x = FIND.res[i];
    if (!x) return;
    const f = { id: uid('f'), name: x.name, page: x.page, link: x.link, why: why, day: 0, by: DESK };
    D.flags.push(f); save();
    x.flag = why; FIND.flagOpen = null;
    paint();
    const label = FLAG_WHY.filter((w) => w[0] === why)[0][1];
    toast('Reported: ' + lower(label), () => { D.flags = D.flags.filter((y) => y !== f); delete x.flag; save(); paint(); },
      why === 'person' ? 'They are left out of searches from now on, and the data team sees the report.' : 'AiMY stops using this page for them, and the data team sees the report.');
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
    const lp = FIND.mode === 'like' ? pastOf(FIND.like) : null;
    const asked = FIND.q.trim() && FIND.mode === 'text' ? FIND.q.trim().split('\n')[0] : q ? 'People who fit ' + q.title : lp ? 'Like ' + lp.name + ', ' + lp.title : 'People who fit what you wrote';
    const out = FIND.out || { pool: 0, web: 0 };
    const mails = web.filter((x) => x.emailFrom).length;
    /* Met, and what their profile is silent on, said apart (unknown is not a no). */
    const req = (k) => !FIND.need || FIND.need[k] !== false;
    const known = (x) => { const rk = x.ev.map((e, k) => k).filter(req), pk = x.ev.map((e, k) => k).filter((k) => !req(k));
      const m = rk.filter((k) => x.ev[k] === 'm').length, u = x.ev.filter((e) => e === 'n').length;
      return m + ' of ' + rk.length + (pk.length ? ' required' : '') + ' met' + (pk.length ? ', ' + pk.filter((k) => x.ev[k] === 'm').length + ' of ' + pk.length + ' preferred' : '') + (u ? ', ' + u + ' not known yet' : ''); };
    const why = (x) => '<div class="reasons" style="grid-column:2 / -1;margin-top:0">' + FIND.crit.map((m, k) => rcChip(EVW[x.ev[k]] + ' · ' + m + (req(k) ? '' : ' (preferred)'), x.ev[k] === 'm' ? 'ok' : x.ev[k] === 'p' ? 'warn' : 'dash')).join('') + '</div>';
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
          ', read ' + esc(sayWhen(x.seen)) + (x.emailFrom ? ' · work email from ' + esc(x.emailFrom) : '') + '</div></div>',
          (x.flag ? rcChip('Reported: ' + lower(FLAG_WHY.filter((f) => f[0] === x.flag)[0][1]), 'warn') : rcChip('Prospect', 'dash')) +
          (x.flag ? '' : rcBtn('Wrong data?', 'data-find-flag="' + x.i + '" aria-expanded="' + (FIND.flagOpen === x.i) + '"', 'quiet')) + add(x)) +
        (FIND.flagOpen === x.i ? '<div class="reasons t-flag" role="group" aria-label="What is wrong">' + FLAG_WHY.map((f) => '<button class="chip" type="button" data-find-flagwhy="' + x.i + '|' + f[0] + '">' + esc(f[1]) + '</button>').join('') + '</div>' : '')).join('');
    return '<section class="rc s-block-wide" aria-label="What AiMY found">' +
      '<div class="eyebrow">' + svg('find', 14) + ' Sourcing and search</div>' +
      '<div class="search">' + svg('find', 16) + '<span>' + esc(asked) + '</span>' + (q ? '<span style="margin-left:auto" class="chip acc">' + svg('doc', 12) + ' from ' + esc(q.title) + '</span>' : '') + '</div>' +
      '<div class="tabs" role="tablist">' + [['pool', 'In your pool', pool.length], ['web', 'Web prospects', web.length]].map((t) =>
        (t[0] === tab ? '<button class="on" type="button" role="tab" aria-selected="true"' : '<button type="button" role="tab" aria-selected="false"') + ' data-find-tab="' + t[0] + '">' + t[1] + '<b>' + t[2] + '</b></button>').join('') + '</div>' +
      '<div class="card" style="padding:4px 16px 12px">' + (rows || '<div class="person" style="border-top:0"><div class="av g" aria-hidden="true">' + svg('find', 15) + '</div><div><h4>' + (tab === 'pool' ? 'Nobody in your pool meets any of these' : 'Nobody on public pages meets any of these') + '</h4><div class="sub">Loosen a criterion above, or look in the other source</div></div><span></span></div>') +
        (out[tab] ? '<p class="sub t-find-out">' + plural(out[tab], 'other') + (tab === 'pool' ? ' in your pool' : ' on public pages') + ' met none of these, so they are left out.</p>' : '') +
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
  /* A LANGUAGE CHECK GIVES A LEVEL (Assessments, 29 Oct; R4). Clients ask
     for "German at C1", so the result is said on the CEFR scale the
     requisition uses, read off the spoken answers, and the pass is the
     level, not a percentage. */
  const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const cefrOf = (score) => (score >= 90 ? 'C2' : score >= 78 ? 'C1' : score >= 62 ? 'B2' : score >= 45 ? 'B1' : score >= 30 ? 'A2' : 'A1');
  const asmtPass = (a, x) => (a.lang ? CEFR.indexOf(cefrOf(x.score)) >= CEFR.indexOf(a.level || 'C1') : x.score >= a.pass);
  const scoreShort = (a, x) => (a.lang ? cefrOf(x.score) + ' ' + a.lang : x.score + '%');
  const scoreSay = (a, x) => (a.lang ? cefrOf(x.score) + ' in spoken ' + a.lang + (asmtPass(a, x) ? ', at or above the ' + (a.level || 'C1') + ' needed' : ', under the ' + (a.level || 'C1') + ' needed')
    : x.score + '%, ' + (asmtPass(a, x) ? 'a pass' : 'under the ' + a.pass + '% pass mark'));
  const passSayOf = (a) => (a.lang ? (a.level || 'C1') + ' or above' : a.pass + '%');
  /* INTEGRITY, APART FROM THE SCORE (R4). What happened while they took
     it, said as what happened, never folded into the score and never a
     verdict: a person looks at the answer and decides. */
  const FLAG_SAY = {
    paste: (f) => 'Q' + (f.q + 1) + ' was answered by pasting text in',
    fast: (f, a) => 'finished in ' + plural(f.mins, 'minute') + ' of the ' + a.mins + ' it usually takes',
    away: (f) => 'left the test page ' + f.n + ' times',
    voice: (f) => 'a second voice was heard on Q' + (f.q + 1),
  };
  const flagsOf = (a, x) => (x.flags || []).map((f) => FLAG_SAY[f.k](f, a));
  /* Waiting on a person: they asked for one to score it, or for a review. */
  const needsPerson = (x) => x.status === 'done' && !x.reviewed && (x.consent === 'person' || x.review === 'asked');
  /* WHAT KEEPS PEOPLE FINISHING, AND KEEPS IT FAIR (R4): ten to fifteen
     minutes, workable on a phone, a practice question first, a note for
     everyone after, and consent before AiMY scores. Each line says why,
     and the ones that are a setting are one press. */
  const ASMT_GOOD = 15;
  function asmtChecks(a) {
    const open = a.questions.filter((qq) => qq.type === 'open').length;
    return [
      { k: 'length', ok: a.mins <= ASMT_GOOD, label: 'About ' + a.mins + ' minutes',
        say: a.mins <= ASMT_GOOD ? 'Inside the 10 to 15 minutes that most people finish.' : 'Past 15 minutes, more people stop before the end. Drop a question or split it in two.' },
      { k: 'phone', ok: a.kind === 'live' || open <= 2, label: a.kind === 'live' ? 'Works on a phone' : open <= 2 ? 'Works on a phone' : 'Long typing on a phone',
        say: a.kind === 'live' ? 'Spoken, so a phone is enough.' : open <= 2 ? 'Choices and ' + plural(open, 'short written answer') + '.' : plural(open, 'written answer') + ': most people take these on a phone, where typing is slow.' },
      { k: 'practice', ok: !!a.practice, label: a.practice ? 'A practice question first' : 'No practice question',
        say: a.practice ? 'Not scored. People see how it works before it counts.' : 'One unscored question first lowers the nerves that cost good people marks.' },
      { k: 'feedback', ok: !!a.feedback, label: a.feedback ? 'Everyone hears how they did' : 'Nobody hears how they did',
        say: a.feedback ? 'A short note within five days, pass or not.' : 'A short note to everyone, pass or not, is what people remember about a test.' },
      { k: 'consent', ok: true, label: 'Consent before AiMY scores',
        say: 'Asked on the first screen; anyone can choose a person to score it instead, or ask for a review after.' },
    ];
  }
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
            '<p class="tc-summary b-qcard-what b-fact">' + svg('goal') + '<span>' + plural(a.questions.length, 'question') + ' · pass ' + esc(passSayOf(a)) + '</span></p>' +
            (function () { const ck = asmtChecks(a), ok = ck.filter((x) => x.ok).length;
              return '<p class="b-qcard-where t-checks">' + ck.filter((x) => x.k === 'length' || x.k === 'phone').map((x) => '<span class="t-check-say' + (x.ok ? '' : ' is-warn') + '">' + esc(x.label) + '</span>').join('') +
                '<span class="t-check-say' + (ok === ck.length ? '' : ' is-warn') + '">' + ok + ' of ' + ck.length + ' checks</span></p>'; })() +
            '<div class="b-qcard-why"><b>' + r.length + '</b> taken' + (avg != null ? ', average ' + (a.lang ? cefrOf(avg) : avg + '%') : '') + ' · on ' + plural(used, 'open requisition') +
              (r.some(needsPerson) ? ' · <b>' + r.filter(needsPerson).length + '</b> waiting on a person' : '') + '</div>' +
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
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Pass mark</h2><div class="b-cmeta-say">' + (a.lang ? (edit
            ? CEFR.slice(2).map((l) => '<button class="filter-chip' + ((a.level || 'C1') === l ? ' active' : '') + '" type="button" data-aset="level|' + l + '">' + l + '</button>').join('')
            : '<p class="b-cmeta-p"><b>' + esc(a.level || 'C1') + ' or above</b> in spoken ' + esc(a.lang) + ', on the CEFR scale the requisition uses</p>') : edit
            ? '<span class="t-step"><button class="b-ghost" type="button" data-aset="pass|-5" aria-label="Lower">−</button><b class="t-step-n">' + a.pass + '%</b><button class="b-ghost" type="button" data-aset="pass|5" aria-label="Higher">+</button></span>'
            : '<p class="b-cmeta-p"><b>' + a.pass + '%</b></p>') + '</div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Link to share</h2><div class="b-cmeta-say"><p class="b-cmeta-p"><b class="t-link-text">' + esc(link) + '</b></p>' +
            '<p class="b-cmeta-p t-acts"><button class="s-insight-lnk" type="button" data-copy="https://' + esc(link) + '">Copy the link</button></p></div></div>' +
        '</div>' +
      '</section>' +
      (edit ? '' : checksCard(a)) +
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
      (r.length && !edit ? '<section class="s-block s-block-wide" aria-label="Results"><div class="s-camp-list-head"><h2 class="s-block-h">Results</h2><span class="s-block-say">' + r.length + ', newest first · ' +
          plural(r.filter((x) => x.flags && x.flags.length).length, 'with an integrity flag', 'with an integrity flag') + ', said apart: a flag never changes a score</span></div>' +
        '<div class="b-log">' + r.slice().sort((x, y) => (y.doneDay || 0) - (x.doneDay || 0)).slice(0, 20).map((s, i) => { const c = DB.byId[s.cand];
          return c ? logRow({ tone: '', ico: svg('goal'), who: c.name, meta: logMeta([scoreShort(a, s), asmtPass(a, s) ? 'a pass' : 'under the pass mark',
              s.flags && s.flags.length ? plural(s.flags.length, 'integrity flag') : null, needsPerson(s) ? (s.consent === 'person' ? 'asked for a person to score it' : 'asked for a review') : s.consent === 'person' ? 'scored by a person' : null,
              reqOf(c).title, sayWhen(s.doneDay != null ? s.doneDay : s.day)]),
            act: 'data-cand="' + c.id + '"', go: 'Open' }, i) : ''; }).join('') + '</div></section>' : '') +
    '</div>';
  }
  function checksCard(a) {
    const ck = asmtChecks(a), ok = ck.filter((x) => x.ok).length, can = isRec() || isHR();
    return rcard({ cap: 'Assessments · before anyone takes it', ico: 'shield', label: 'Checklist',
      body: rcHead('What keeps people finishing, and keeps it fair', 'From the assessment research (R4) · the settings are one press', rcChip(ok + ' of ' + ck.length, ok === ck.length ? 'ok' : 'warn')) +
        '<div style="margin-top:12px">' + ck.map((x) => rcGate(x.ok ? 'okc' : 'warnc', x.ok ? 'ok' : 'warn', esc(x.label), esc(x.say),
          (x.k === 'practice' || x.k === 'feedback') && can ? rcBtn(x.ok ? 'Turn it off' : x.k === 'practice' ? 'Add one' : 'Turn it on', 'data-asmt-check="' + a.id + '|' + x.k + '"', x.ok ? 'quiet' : 'small')
            : x.k === 'length' && !x.ok && can ? rcBtn('Shorten it', goAttr({ asmt: a.id, edit: '1' }).trim(), 'small') : rcChip(x.ok ? 'Done' : 'To do', x.ok ? 'ok' : 'warn'))).join('') + '</div>' });
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
    const before = JSON.parse(JSON.stringify({ title: a.title, kind: a.kind, pass: a.pass, questions: a.questions, level: a.level || null, practice: !!a.practice, feedback: !!a.feedback }));
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
      '<h1 class="t-out-h">Thank you, ' + esc(first(c.name)) + '. It is in.</h1><p>The recruiting team will be in touch about next steps. ' +
        (s.consent === 'person' ? 'A person scores it, as you asked.' : 'AiMY scored it and a person reads every result.') + (a.feedback ? ' You will get a short note on how you did within five days.' : '') + '</p>' +
        (s.consent === 'ai' && !s.review ? '<p class="t-acts"><button class="btn btn-ghost btn-sm" type="button" data-take-review="' + s.id + '">Ask a person to look at it again</button></p>'
          : s.review === 'asked' ? '<p class="b-vfoot">You asked for a person to look again. They will.</p>' : '') + '</section></div>';
    if (!TAKE || TAKE.id !== s.id) TAKE = { id: s.id, a: [] };
    /* CONSENT BEFORE AiMY SCORES (R4, the EU AI Act's line for hiring):
       what scores it, that a person decides, and the choice of a person
       instead, before the first question. */
    if (!TAKE.consent) return '<div class="t-out">' + outsideHead('Assessment', 'FlairsTech careers') +
      '<section class="t-out-card">' +
        '<p class="t-out-kicker">Before you start · about ' + a.mins + ' minutes</p>' +
        '<h1 class="t-out-h">' + esc(a.title) + '</h1>' +
        '<p>For ' + esc(reqOf(c).title) + '. ' + (a.kind === 'live' ? 'AiMY asks the questions; you answer out loud or typed, on a phone or a computer.' : 'Answer every question; there is no trick to it.') +
          (a.practice ? ' A practice question comes first and is not scored.' : '') + '</p>' +
        '<div class="t-consent"><p class="t-consent-h">How your answers are scored</p>' +
          '<p>AiMY, our AI, scores each answer against what a good answer covers' + (a.lang ? ', and gives your ' + esc(a.lang) + ' a level from A1 to C2' : '') + '. A person at FlairsTech reads every result and makes the decision; AiMY never decides on its own.</p>' +
          '<p>If you would rather, a person scores it instead. It takes a few days longer, and it is never held against you. You can also ask for a person to look again after.</p>' +
          '<p class="t-consent-keep">We keep your answers and the result for this application only. ' + (a.feedback ? 'Everyone gets a short note on how they did.' : '') + '</p></div>' +
        '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-take-consent="ai">Start: AiMY scores it, a person decides</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-take-consent="person">Start: a person scores it</button></p>' +
      '</section></div>';
    if (a.kind === 'live') return liveTake(s, a, c);
    return '<div class="t-out">' + outsideHead('Assessment', 'FlairsTech careers') +
      '<section class="t-out-card">' +
        '<p class="t-out-kicker">' + esc(ASMT_KIND[a.kind]) + ' · about ' + a.mins + ' minutes</p>' +
        '<h1 class="t-out-h">' + esc(a.title) + '</h1>' +
        '<p>For ' + esc(reqOf(c).title) + '. ' + (a.kind === 'live' ? 'AiMY asks each question; answer in your own words, out loud or typed.' : 'Answer every question. There is no trick to it.') + '</p>' +
        (a.practice ? '<div class="t-dr t-practice"><p class="t-dr-must">Practice, not scored. Which day comes after Monday?</p>' +
          (TAKE.practiced ? '<p class="b-vfoot">That is how it works. The questions below count.</p>'
            : '<div class="b-cuts t-col">' + ['Sunday', 'Tuesday', 'Friday'].map((d) => '<button class="filter-chip" type="button" data-take-practice>' + d + '</button>').join('') + '</div>') + '</div>' : '') +
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
    const mins = TAKE.t0 ? (Date.now() - TAKE.t0) / 60000 : null;
    const pasted = Object.keys(TAKE.paste || {}).map(Number)[0];
    const flags = [pasted != null ? { k: 'paste', q: pasted } : null, mins != null && mins < a.mins / 4 ? { k: 'fast', mins: Math.max(1, Math.round(mins)) } : null,
      TAKE.away >= 2 ? { k: 'away', n: TAKE.away } : null].filter(Boolean);
    put('sends', s, { status: 'done', answers: answers, score: score, doneDay: 0, probed: TAKE.live ? Object.keys(TAKE.live.probed).map(Number) : null,
      consent: TAKE.consent, flags: flags, review: null, reviewed: null });
    note(c, 'asmt', 'Finished the ' + a.title + ' assessment: ' + scoreSay(a, { score: score }) + '.' + (TAKE.consent === 'person' ? ' Asked for a person to score it.' : ''));
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
      (isHR() ? connectBlock() + ladder() : '') +
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

  /* ══ THE STORY (V6; Engy, 4 Nov: "a diagram or something that makes it
     storytelling, not just data") ════════════════════════════════════════
     Read together, the figures say a few things; the page says them first,
     in AiMY's voice, a chapter each, every chapter with its own picture and
     its own move: the journey (how many), the ruler (how long), the lanes
     (whose desk), the offer and the client's reasons (what is lost), and
     day 90 (what lasts). Built from the same records as the 13 figures,
     which keep their place at the foot, whole. Nothing is predicted; the
     one estimate, sending sooner, is said as one. The iterations and their
     references: deliverables/reports-iterations.html. */
  const SEND_TARGET = 7, DECLINE_TARGET = 15, DAY90_TARGET = 85;
  const dd = (x) => Math.round(x * 10) / 10;
  const dSay = (x) => (x === 1 ? '1 day' : x + ' days');
  const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  /* A stage as a step in a sentence: "lost at sourcing", not "at the sourced". */
  const STEP_SAY = { sourced: 'sourcing', applied: 'applications', assess: 'the assessment', phone: 'the phone screen', hr: 'the HR interview', tech: 'the technical interview',
    mgr: 'the managerial interview', sent: 'the client’s choice', client: 'the client interview', ctech: 'the client’s technical interview', offer: 'the offer', accepted: 'the wait to start' };
  /* Why an earlier hire left, as the rest of a sentence. */
  const LEFT_SAY = { 'Left for a higher salary elsewhere': 'left for a higher salary elsewhere', 'Did not pass probation': 'did not pass probation', 'Moved abroad': 'moved abroad', 'The client ended the project': 'left when the client ended the project' };
  /* Who the work waits on, in the reader's words: the recruiter is "you" on
     their own desk, the hiring manager on theirs. */
  const LANES = ['me', 'interviewer', 'hm', 'client', 'candidate'];
  const laneSay = (w) => w === 'me' ? (isRec() ? 'You' : isHR() ? 'The recruiters' : 'The recruiter')
    : w === 'hm' ? (isHM() ? 'You' : 'The hiring manager') : w === 'interviewer' ? 'The interviewer' : w === 'client' ? 'The client' : 'The candidate';
  const ownSay = () => (isRec() ? 'your own steps' : isHR() ? 'the recruiters’ own steps' : 'the recruiter’s own steps');
  /* A question for the chat, set from a chapter, as Today's insights set theirs. */
  function askBtn(q, html, acts) {
    const k = 'q' + (++CHAT_N);
    CHAT_Q[k] = { q: q, html: html, acts: acts || [] };
    return '<button class="t-ask" type="button" data-chat="' + k + '"><span class="t-ask-mark" aria-hidden="true">' + mark(12) + '</span><span class="t-ask-text">' + esc(q) + '</span>' +
      '<span class="t-ask-go" aria-hidden="true">' + svg('send', 11) + '</span></button>';
  }

  /* HOW LONG: the steps before a profile can go, laid end to end at the
     days each took, against the target and the day it really went. Shared
     by the reports and one requisition's page. */
  function speedOf(reqs) {
    const sreqs = reqs.filter((q) => rank(q, 'sent') >= 0);
    if (!sreqs.length) return null;
    const ks = stagesOf(sreqs).filter((k) => STAGE_ORDER.indexOf(k) < STAGE_ORDER.indexOf('sent'));
    const segs = stageStats(sreqs, ks).map((s) => ({ k: s.k, d: s.avg != null ? dd(s.avg) : s.exp, usual: s.exp, guess: s.avg == null,
      part: s.on < sreqs.length, on: s.on,
      /* Slow is a day or more over its usual, or half again as long: half a day is noise. */
      slow: s.avg != null && (s.tT === 'err' || s.tT === 'warn' && s.avg - s.exp >= 1) }));
    const total = dd(segs.reduce((t, s) => t + s.d, 0));
    let t = 0, runs = null;
    segs.forEach((s) => { if (!runs && t + s.d > SEND_TARGET) runs = s; t += s.d; });
    const slow = segs.filter((s) => s.slow).sort((a, b) => b.d / b.usual - a.d / a.usual)[0] || null;
    const tech = segs.filter((s) => s.k === 'tech')[0], hr = segs.filter((s) => s.k === 'hr')[0], as = segs.filter((s) => s.k === 'assess')[0];
    return { reqs: sreqs, segs: segs, total: total, runs: runs, slow: slow, as: as,
      /* Sending after HR, while the technical interview is booked: the
         technical days come off the path. A model from the averages. */
      est: tech && hr ? Math.round(total - tech.d) : null, est2: tech && hr && as && as.part ? Math.round(total - tech.d - as.d) : null };
  }
  /* `end` is where the line falls (the first profile, or today), said by `lab`. */
  function rulerPic(sp, end, lab, one) {
    const max = Math.ceil(Math.max(sp.total, end || 0, SEND_TARGET) / 2) * 2 + 2;
    const at = (d) => (d / max * 100).toFixed(2) + '%';
    const segs = sp.segs.map((s) => '<span class="t-ru-seg' + (s.part ? ' is-part' : '') + (s.slow ? ' is-slow' : '') + '" style="width:' + at(s.d) + '" title="' +
        esc(STAGE[s.k].label + ': ' + (s.guess ? 'nobody through it yet; its usual ' + dSay(s.usual) : dSay(s.d) + (one ? '' : ' on average') + ', usual ' + dSay(s.usual)) + (s.part ? '. On ' + s.on + ' of ' + sp.reqs.length + ' requisitions.' : '.')) + '">' +
      '<span class="t-ru-bar"><b>' + esc(s.k === 'tech' ? 'Technical' : s.k === 'phone' ? 'Phone' : s.k === 'hr' ? 'HR' : STAGE[s.k].label) + '</b><span>' + (s.guess ? 'usual ' + s.usual : s.d) + ' d</span></span>' +
      '<span class="t-ru-usual">usual ' + s.usual + '</span></span>').join('');
    const ticks = [];
    for (let d = 0; d <= max; d += 2) ticks.push('<span style="left:' + at(d) + '">' + d + '</span>');
    return '<div class="t-ru-wrap"><div class="t-ru" role="img" aria-label="' + esc('Days before the first profile: ' + sp.segs.map((s) => STAGE[s.k].label + ' ' + s.d).join(', ') + '. Target ' + SEND_TARGET + ' days. ' + lab + '.') + '">' +
      '<span class="t-ru-late" style="left:' + at(SEND_TARGET) + '" aria-hidden="true"></span>' +
      '<div class="t-ru-track" aria-hidden="true">' + segs + (end > sp.total ? '<span class="t-ru-gap" style="width:' + at(end - sp.total) + '"></span>' : '') + '</div>' +
      '<span class="t-ru-line is-target" style="left:' + at(SEND_TARGET) + '" aria-hidden="true"><span>Target ' + SEND_TARGET + ' days</span></span>' +
      '<span class="t-ru-line is-end ' + (end > SEND_TARGET ? 'is-late' : 'is-met') + '" style="left:' + at(end) + '" aria-hidden="true"><span>' + esc(lab) + '</span></span>' +
      '<div class="t-ru-axis" aria-hidden="true">' + ticks.join('') + '</div>' +
    '</div></div>' +
    '<p class="t-pic-key">Under each step, its usual time.' + (sp.segs.some((s) => s.part) ? ' Striped: on some of the requisitions only.' : '') + (sp.segs.some((s) => s.slow) ? ' Amber: slower than usual.' : '') + '</p>';
  }
  /* HOW MANY: a band per stage that narrows as people leave (the sheet's
     V1, Engy, 4 Nov: "like the html file"). The counts and names are text
     in a grid over the drawing; the bars and the fading bands under them
     carry the shape, the people who did not go on are said under each gap,
     and the two places the story turns are called out on the drawing, the
     one beating its norm in green and the one behind it in amber. */
  const JY_SHORT = { hr: 'HR', tech: 'Technical', mgr: 'Managerial', ctech: 'Client technical' };
  function journeyPic(rows, off, canDrill, leftOut) {
    const n = rows.length, W = 100, B = 22, H = 200;
    const top = Math.max(1, ...rows.map((x) => x.n));
    const h = (v) => Math.max(4, v / top * (H - 12));
    const pct = (u) => (u / (n * W) * 100).toFixed(2) + '%';
    /* The one that beats its norm most, past the first two steps. */
    const good = rows.filter((x, i) => i > 1 && x !== off && x.pT === 'ok' && x.decided >= 3 && x.rate / x.norm >= 1.15)
      .sort((x, y) => y.rate / y.norm - x.rate / x.norm)[0] || null;
    const notes = [];
    if (good) notes.push({ s: good, cls: 'is-ok', y: 104,
      head: good.k === 'sent' ? good.passed + ' of ' + good.decided + ' profiles met' : good.passed + ' of ' + good.decided + ' moved on',
      sub: good.k === 'sent' ? 'above the 1 in ' + Math.round(1 / good.norm) + ' norm' : 'above the usual ' + Math.round(good.norm * 100) + '%' });
    if (off) notes.push({ s: off, cls: 'is-off', y: good ? 150 : 120,
      head: off.k === 'offer' ? (off.decided - off.passed) + ' of ' + off.decided + ' offers declined' : off.passed + ' of ' + off.decided + ' moved on',
      sub: off.k === 'offer' ? 'usually 1 in ' + Math.round(1 / (1 - off.norm)) : 'usually ' + Math.round(off.norm * 100) + '%' });
    /* A note goes on the drawing only where its bar leaves room above it. */
    const placed = notes.filter((x) => h(x.s.n) + 26 < x.y);
    let shapes = '', drops = '';
    rows.forEach((x, i) => {
      const nx = rows[i + 1];
      if (nx) {
        const x0 = i * W + B, x1 = (i + 1) * W, m = (x0 + x1) / 2;
        shapes += '<path class="t-jy-band" style="--i:' + i + '" d="M' + x0 + ' 0L' + x1 + ' 0L' + x1 + ' ' + h(nx.n).toFixed(1) + 'C' + m + ' ' + h(nx.n).toFixed(1) + ' ' + m + ' ' + h(x.n).toFixed(1) + ' ' + x0 + ' ' + h(x.n).toFixed(1) + 'Z"/>';
        if (x.n > nx.n) drops += '<span class="t-jy-drop" style="left:' + pct(m) + ';top:' + ((h(x.n) + h(nx.n)) / 2 + 8).toFixed(0) + 'px">−' + (x.n - nx.n) + '</span>';
      }
      shapes += '<rect class="t-jy-bar' + (x === off ? ' is-off' : '') + '" style="--i:' + i + '" x="' + i * W + '" y="0" width="' + B + '" height="' + h(x.n).toFixed(1) + '" rx="4"/>';
    });
    placed.forEach((x) => {
      const i = rows.indexOf(x.s), bx = i * W + B / 2, tx = Math.max(0, i * W - 70);
      shapes += '<line class="t-jy-lead ' + x.cls + '" x1="' + bx + '" y1="' + h(x.s.n).toFixed(1) + '" x2="' + (tx + 14) + '" y2="' + (x.y - 4) + '" vector-effect="non-scaling-stroke"/>';
      drops += '<span class="t-jy-note ' + x.cls + '" style="left:' + pct(tx) + ';top:' + x.y + 'px"><b>' + esc(x.head) + '</b>' + esc(x.sub) + '</span>';
    });
    const stage = (x) => {
      const door = canDrill && x.here ? ' data-fdrill="' + x.k + '"' : '';
      const tag = door ? 'button' : 'div';
      const noted = placed.some((y) => y.s === x);
      const sub = x === off && !noted ? (x.k === 'offer' ? (x.decided - x.passed) + ' of ' + x.decided + ' declined · usually 1 in ' + Math.round(1 / (1 - x.norm)) : x.passed + ' of ' + x.decided + ' moved on · usual ' + Math.round(x.norm * 100) + '%')
        : x.on < rows[0].on ? 'on ' + x.on + ' of ' + rows[0].on : '';
      const why = STAGE[x.k].label + ': ' + x.n + ' reached it. ' + healthSay(x) + (door ? ' Press to see who is at it now.' : '');
      return '<' + tag + ' class="t-jy-stage' + (x === off ? ' is-off' : '') + (door ? ' is-door' : '') + '"' + (door ? ' type="button"' + door : '') + ' title="' + esc(why) + '" aria-label="' + esc(why) + '">' +
        '<b>' + x.n + '</b><span class="t-jy-name">' + esc(JY_SHORT[x.k] || STAGE[x.k].label) + '</span>' + (sub ? '<span class="t-jy-sub">' + esc(sub) + '</span>' : '') + '</' + tag + '>';
    };
    return '<div class="t-jy-wrap"><div class="t-jy" style="--n:' + n + '">' +
      '<div class="t-jy-row">' + rows.map(stage).join('') + '</div>' +
      '<div class="t-jy-draw" aria-hidden="true">' +
        '<svg class="t-jy-svg" viewBox="0 0 ' + n * W + ' ' + H + '" preserveAspectRatio="none">' +
          '<defs><linearGradient id="jyBand" x1="0" x2="1"><stop offset="0" class="t-jy-stop-a"/><stop offset="1" class="t-jy-stop-b"/></linearGradient></defs>' + shapes + '</svg>' +
        drops +
      '</div>' +
    '</div></div>' +
    '<p class="t-pic-key">Under each gap: the people who did not go on, or have not yet.' +
      (leftOut && leftOut.length ? ' Left out of the line, as most requisitions do not run ' + (leftOut.length === 1 ? 'it' : 'them') + ': ' + esc(listSay(leftOut.map((x) => lower(STAGE[x.k].label) + ' (on ' + x.on + ' of ' + rows[0].on + ')'))) + '.' : '') +
      (canDrill ? ' Press a stage to see who is at it now.' : '') + '</p>';
  }
  /* WHOSE DESK: one lane per person the work waits on, the steps across, a
     circle where days have piled up past the usual time. The reader's own
     lane is violet, everyone else's amber. */
  function lanesPic(w) {
    const cols = STAGE_ORDER.filter((k) => w.lanes.some((l) => l.cells[k]));
    const r = (d) => Math.min(44, 16 + d * 4);
    return '<div class="t-ln-wrap"><div class="t-ln" role="table" aria-label="Days past the usual time, by who it waits on" style="--c:' + cols.length + '">' +
      '<div class="t-ln-row t-ln-head" role="row"><span role="columnheader">Waiting on</span>' + cols.map((k) => '<span role="columnheader" title="' + esc(STAGE[k].label) + '">' + esc(JY_SHORT[k] || STAGE[k].label) + '</span>').join('') + '<span role="columnheader">Days</span></div>' +
      w.lanes.map((l) => '<div class="t-ln-row' + (l.w === 'me' ? ' is-mine' : '') + '" role="row"><span class="t-ln-who" role="rowheader">' + esc(laneSay(l.w)) + '</span>' +
        cols.map((k) => { const c = l.cells[k];
          return '<span class="t-ln-cell" role="cell">' + (c ? '<span class="t-ln-dot" style="--r:' + r(c.d) + 'px" title="' + esc(plural(c.n, 'person', 'people') + ' at the ' + lower(STAGE[k].label) + ', ' + dSay(c.d) + ' past the usual time') + '">' + c.d + 'd</span>' : '') + '</span>'; }).join('') +
        '<span class="t-ln-sum" role="cell"><b>' + l.d + '</b></span></div>').join('') +
    '</div></div>' +
    '<p class="t-pic-key">Days past the usual time for the step, on the open requisitions in view, now. Violet: ' + esc(lower(ownSay())) + '. Amber: waiting on someone else.</p>';
  }

  /* The story of a set of requisitions: its headline, its chapters in
     order, and the slides it shares as. `past` is the earlier hires whose
     day 90 has passed, on the same accounts. */
  function story(reqs, past) {
    const st = rstats(reqs);
    const canQueue = isRec() || isHR();
    const ch = [];
    /* 1. The journey, on the stages most of the requisitions run, so the line only narrows. */
    const jrAll = stageStats(reqs, stagesOf(reqs));
    const jr = jrAll.filter((s) => s.on * 2 > reqs.length);
    const judged = jr.filter((s) => s.pT);
    const off = judged.filter((s) => s.pT !== 'ok').sort((a, b) => a.rate / a.norm - b.rate / b.norm)[0] || null;
    const found = jr.length ? jr[0].n : 0;
    const acc = jr.filter((s) => s.k === 'accepted')[0];
    const hired = acc ? acc.n : st.hiredO.length;
    if (found) {
      const rest = judged.filter((s) => s !== off);
      const restOk = rest.length && rest.every((s) => s.pT === 'ok');
      const offL = off ? STEP_SAY[off.k] : '';
      ch.push({ k: 'journey', cap: 'The journey', ask: 'How far do people get?',
        title: off ? (restOk ? (jr.indexOf(off) >= jr.length - 3 ? 'Near or above the usual at every step, until ' : 'Near or above the usual at every step but ') + offL : 'Fewer move on than usual at ' + offL) : 'Every step keeps its usual share of people',
        say: '<b>' + found + '</b> ' + (found === 1 ? 'person' : 'people') + ' found, ' + (hired ? '<b>' + hired + '</b> accepted. ' : 'none accepted yet. ') +
          (off ? (off.k === 'offer' ? '<b>' + (off.decided - off.passed) + ' of ' + off.decided + '</b> turned the offer down, where usually about 1 in ' + Math.round(1 / (1 - off.norm)) + ' does'
              : capFirst(esc(offL)) + ' kept <b>' + off.passed + ' of ' + off.decided + '</b>, where it usually keeps ' + Math.round(off.norm * 100) + '%') +
            (restOk ? '; every other step keeps its usual share or more.' : '.')
            : 'No step loses more people than it usually does.'),
        from: 'every requisition in view · moved on is of the people decided at each step',
        pic: journeyPic(jr, off, canQueue, jrAll.filter((s) => s.on && s.on * 2 <= reqs.length && s.k !== 'joined')) });
    }
    /* 2. Speed, where profiles go to a client. */
    const sp = speedOf(reqs), actual = sp ? avgSent(sp.reqs) : null;
    if (sp && actual != null) {
      const late = actual > SEND_TARGET;
      const slowL = sp.slow ? STEP_SAY[sp.slow.k] : '';
      const noSendN = reqs.filter(noSend);
      ch.push({ k: 'speed', cap: 'Speed', ask: 'Where do the ' + dSay(actual) + ' go?',
        title: !late ? dSay(actual) + ' to the first profile, inside the target of ' + SEND_TARGET
          : sp.slow ? dSay(actual) + ' to the first profile; ' + slowL + ' runs slow'
          : dSay(actual) + ' to the first profile: ' + sp.segs.length + ' steps, each near its usual time',
        say: !late ? 'The first profile goes out within the target, on average, across ' + plural(sp.reqs.length, 'requisition') + '.'
          : 'The ' + SEND_TARGET + '-day target runs out during <b>' + esc(sp.runs ? STEP_SAY[sp.runs.k] : 'the last step') + '</b>' +
            (sp.slow ? ', and ' + esc(slowL) + ' takes <b>' + dSay(sp.slow.d) + '</b> against a usual ' + dSay(sp.slow.usual) + '.' : '; no step is slow, there are just ' + sp.segs.length + ' of them before a profile can go.') +
            (sp.est != null && sp.est < actual ? ' Sending the profile after HR, while the technical interview is booked, would bring it near <b>' + dSay(sp.est) + '</b>' +
              (sp.est2 != null ? ', and near ' + dSay(sp.est2) + ' where there is no assessment' : '') + '.' : ''),
        from: 'days in each stage, on the ' + plural(sp.reqs.length, 'requisition') + ' in view that send profiles' + (late && sp.est != null ? ' · the estimate is a model from the step averages, not a measured result' : ''),
        pic: rulerPic(sp, actual, 'First profile sent: ' + dSay(actual)),
        act: canQueue && noSendN.length ? '<button class="s-insight-lnk" type="button"' + goAttr({ on: 'reqs', q: 'nosend' }) + '>Open the ' + plural(noSendN.length, 'requisition') + ' with no profile after ' + NOSEND_DAYS + ' days</button>' : '' });
    }
    /* 3. What is lost: offers turned down, and why clients passed. */
    const decl = declines(reqs), counts = declineCounts(decl);
    const offs = st.offers.filter((o) => o.status === 'declined');
    const offRate = rate(st.declined, st.made);
    if (st.made || decl.length) {
      /* Judged against its target on three offers or more, as a rate is everywhere here. */
      const offBad = st.made >= TREND_MIN && offRate > DECLINE_TARGET;
      const counter = offs.filter((o) => /counter/i.test(o.note || '')).length;
      const under = offs.filter((o) => o.expects && o.salary < o.expects).length;
      const top = counts[0];
      const dp = canQueue ? dProposals().filter((x) => reqs.some((q) => q.acc === x.acc))[0] : null;
      const bars = counts.length ? '<p class="t-pic-cap">When clients passed, why · one reason each · ' + plural(decl.length, 'decline') + '</p><div class="t-funnel">' +
        counts.map((x) => '<div class="t-fn-row' + (x === top && top.n >= 2 ? ' is-top' : '') + '"><span class="t-fn-label">' + esc(x.d.label) + '</span>' +
          '<span class="t-fn-track"><span class="t-fn-fill" style="width:' + (x.n / top.n * 100).toFixed(1) + '%"></span></span><span class="t-fn-n"><b>' + x.n + '</b></span></div>').join('') + '</div>' : '';
      const offPic = st.made ? '<div class="t-of" role="img" aria-label="' + esc(st.declined + ' of ' + st.made + ' offers turned down') + '">' +
        st.offers.filter((o) => o.sentDay != null).sort((a, b) => (a.status === 'declined') - (b.status === 'declined')).map((o) => '<span class="t-of-dot' + (o.status === 'declined' ? ' is-lost' : '') + '"></span>').join('') +
        '<span class="t-of-say">' + st.declined + ' of ' + st.made + ' offers turned down · target ' + DECLINE_TARGET + '% or fewer</span></div>' : '';
      ch.push({ k: 'loss', cap: 'What is lost', ask: 'Why do we lose people?',
        title: offBad ? st.declined + ' of ' + st.made + ' offers turned down' : top ? 'Clients passed on ' + plural(decl.length, 'profile') + ', ' + lower(top.d.label) + ' the reason ' + (top.n === decl.length ? 'each time' : 'most')
          : plural(st.made, 'offer') + ' made, ' + (st.declined ? st.declined + ' turned down' : 'none turned down'),
        say: (st.made ? (st.made === 1 ? 'The one offer made was ' + (st.declined ? '<b>turned down</b>' : 'not turned down') : '<b>' + st.declined + ' of ' + st.made + '</b> offers were turned down') +
            (st.made < TREND_MIN ? ', too few to set against the target' : ', ' + (offBad ? 'against' : 'inside') + ' a target of ' + DECLINE_TARGET + '% or fewer') +
            (counter ? '; ' + (counter === offs.length ? (counter === 1 ? 'they' : 'each') : counter) + ' took a counter-offer from their current employer' : '') +
            (under ? ', and ' + (under === offs.length ? (under === 1 ? 'they' : 'all ' + under) : under) + ' had been offered less than they asked' : '') + '. ' : '') +
          (top ? (top.n === decl.length && decl.length > 1 ? (decl.length === 2 ? 'Both' : 'All ' + decl.length) + ' clients who passed named ' + esc(lower(top.d.label)) + '.'
            : 'When clients passed, <b>' + top.n + ' of ' + decl.length + '</b> named ' + esc(lower(top.d.label)) + '.') : '') +
          (dp ? ' ' + dp.evidence + ' ' + esc(dp.rule) : ''),
        from: 'offers sent, and every client decline with a reason',
        pic: offPic + bars,
        act: (offs.length ? askBtn('Why were the offers turned down?', '<p>' + offs.map((o) => { const c = DB.byId[o.cand];
            return '<b>' + esc(c.name) + '</b>, ' + esc(reqOf(c).title) + ': offered ' + o.salary.toLocaleString('en') + (o.expects ? ' against ' + o.expects.toLocaleString('en') + ' asked' : '') + '. ' + esc(o.note || 'No reason given.'); }).join('<br>') + '</p>',
            [{ label: 'Open ' + first(DB.byId[offs[0].cand].name), go: { cand: offs[0].cand } }]) : '') +
          (dp ? (isHR() ? '<button class="s-insight-lnk primary" type="button" data-prop="' + esc(dp.key) + '|approve">Approve the rule</button>'
            : dp.rec && dp.rec.state === 'waiting' ? '<span class="t-of-say">The rule waits on ' + esc(DESKS.dina.name) + '</span>'
            : '<button class="s-insight-lnk" type="button" data-prop="' + esc(dp.key) + '|send">Send the rule to ' + esc(DESKS.dina.name) + '</button>') : '') });
    }
    /* 4. Whose desk it is on, now. */
    const lanes = {};
    let all = 0;
    reqs.filter(isOpen).forEach((q) => activeOf(q).forEach((c) => {
      const w = waitsOn(c), d = lostDays(c);
      if (LANES.indexOf(w) < 0 || !d) return;
      const l = lanes[w] || (lanes[w] = { w: w, d: 0, cells: {}, cs: [] });
      const cell = l.cells[c.stage] || (l.cells[c.stage] = { d: 0, n: 0, cs: [] });
      l.d += d; cell.d += d; cell.n++; cell.cs.push(c); l.cs.push(c); all += d;
    }));
    const ll = LANES.filter((w) => lanes[w]).map((w) => lanes[w]);
    if (all) {
      const them = ll.filter((l) => l.w !== 'me').reduce((s, l) => s + l.d, 0);
      const mineL = lanes.me;
      const topL = ll.filter((l) => l.w !== 'me').sort((a, b) => b.d - a.d)[0] || null;
      const topC = topL ? Object.keys(topL.cells).map((k) => Object.assign({ k: k }, topL.cells[k])).sort((a, b) => b.d - a.d)[0] : null;
      const accs = topC ? topC.cs.map((c) => accOf(reqOf(c)).name).filter((x, i, a) => a.indexOf(x) === i) : [];
      const maxMine = mineL ? Math.max(...Object.keys(mineL.cells).map((k) => mineL.cells[k].d)) : 0;
      const toNudge = topL && canQueue && topL.w !== 'me' ? topL.cs.filter((c) => c.nudged == null) : [];
      const nudgeN = toNudge.every((c) => c.stage === 'sent') ? plural(toNudge.length, 'profile') : plural(toNudge.length, 'person', 'people');
      const whoN = topL ? (topL.w === 'client' ? listSay(accs) : topL.w === 'interviewer' ? 'the interviewers' : topL.w === 'hm' ? 'the hiring manager' : 'the candidates') : '';
      ch.push({ k: 'wait', cap: 'Waiting', ask: 'Who is the work waiting on?',
        title: !topL ? 'All ' + all + ' late days are on ' + ownSay()
          : mineL && mineL.d > them ? mineL.d + ' of ' + all + ' late days are on ' + ownSay() + '; the rest wait mostly on ' + lower(laneSay(topL.w))
          : topL.d + ' of ' + all + ' late days are with ' + lower(laneSay(topL.w)),
        say: (topL ? '<b>' + them + ' of ' + all + '</b> days past the usual time wait on someone else’s answer, and <b>' + topC.d + '</b> of those are ' +
            (topC.k === 'sent' ? plural(topC.n, 'profile') + ' waiting on ' + esc(listSay(accs)) : plural(topC.n, 'person', 'people') + ' at ' + esc(STEP_SAY[topC.k]) + (topL.w === 'client' ? ', with ' + esc(listSay(accs)) : '')) + '.' :'Nothing waits on anyone else past its usual time.') +
          (mineL ? ' The other <b>' + mineL.d + '</b> are on ' + ownSay() + ', no more than ' + dSay(maxMine) + ' at any one step.' : ''),
        from: 'the open requisitions in view, now · in FlairsTech’s own data, 46 of 105 lost days were spent waiting',
        pic: lanesPic({ lanes: ll }),
        act: toNudge.length ? '<button class="s-insight-lnk primary" type="button" data-nudge-all="' + toNudge.map((c) => c.id).join(',') + '">Nudge ' + esc(whoN) + ' on ' + nudgeN + '</button>'
          : topL && canQueue ? '<span class="t-of-say">Nudged today</span>' : '' });
    }
    /* 5. What lasts: day 90 for the earlier hires, and who starts next. */
    const stayed = past.filter((p) => p.stayed).length, d90 = rate(stayed, past.length);
    if (past.length) {
      const left = past.filter((p) => !p.stayed);
      const whys = {};
      left.forEach((p) => { whys[p.why] = (whys[p.why] || 0) + 1; });
      const topWhy = Object.keys(whys).sort((a, b) => whys[b] - whys[a])[0];
      const ns = st.notStarted.length;
      ch.push({ k: 'after', cap: 'After the hire', ask: 'Do our hires stay?',
        title: stayed + ' of ' + past.length + ' earlier hires stayed to day 90',
        say: '<b>' + d90 + '%</b>, ' + (d90 >= DAY90_TARGET ? 'meeting' : 'against') + ' a target of ' + DAY90_TARGET + '% or more.' +
          (topWhy ? ' Of the ' + left.length + ' who left, ' + (whys[topWhy] === left.length ? (left.length === 1 ? 'they' : 'all') : whys[topWhy]) + ' ' + esc(LEFT_SAY[topWhy] || lower(topWhy)) + (whys[topWhy] < left.length && whys[topWhy] > 1 ? ', the reason given most' : '') + '.' : '') +
          (ns ? ' ' + plural(ns, 'person', 'people') + ' hired in this period ' + (ns === 1 ? 'has' : 'have') + ' day one still ahead.' : ''),
        from: 'billed hires whose day 90 has passed, on these accounts · older than any period here',
        pic: '<div class="t-d90" role="img" aria-label="' + esc(stayed + ' of ' + past.length + ' stayed to day 90') + '">' +
          past.slice().sort((a, b) => b.stayed - a.stayed).map((p) => '<span class="t-d90-dot' + (p.stayed ? '' : ' is-left') + '" title="' + esc(p.name + ', ' + p.title + (p.stayed ? ': stayed' : ': ' + lower(p.why))) + '"></span>').join('') +
          '<span class="t-of-say">Filled: stayed. Hollow: left before day 90.</span></div>',
        act: left.length ? askBtn('Who left before day 90?', '<p>' + left.map((p) => '<b>' + esc(p.name) + '</b>, ' + esc(p.title) + ' at ' + esc((ACCOUNTS.filter((a) => a.id === p.acc)[0] || {}).name || '') + ': ' + esc(p.why) + '.').join('<br>') + '</p>') : '' });
    }
    /* The headline: what happened, then the one or two things that matter
       most, each a figure some chapter below draws. */
    const bits = [];
    if (sp && actual != null && actual > SEND_TARGET) bits.push('the first profile takes <mark class="t-mk">' + dSay(actual) + '</mark>' + (sp.slow ? ', most of it lost at ' + esc(STEP_SAY[sp.slow.k]) : ' because the path is long, not slow'));
    if (off) bits.push(off.k === 'offer' ? '<mark class="t-mk">offers</mark> are where people are lost' : '<mark class="t-mk">' + esc(STEP_SAY[off.k]) + '</mark> is where people are lost');
    const wt = ch.filter((c) => c.k === 'wait')[0];
    if (bits.length < 2 && wt && lanes.client && lanes.client.d * 3 >= all) bits.push('the longest wait is with <mark class="t-mk">the client</mark>');
    const head = (found ? plural(found, 'person', 'people') + ' found, ' + (hired ? '<mark class="t-mk is-ok">' + hired + ' hired</mark>. ' : 'none hired yet. ') : '') +
      (bits.length ? capFirst(bits.join(', and ')) + '.' : 'Every step is near its usual time and share.');
    /* The same chapters as slides, one sentence each (V5), to share. */
    const slides = [{ k: 'The period', big: plural(hired, 'person', 'people'), say: 'hired from ' + found + ' found, on ' + plural(reqs.length, 'requisition') + '.', foot: st.seats + ' seats · ' + st.openSeats + ' still open' }];
    if (sp && actual != null) slides.push({ k: 'Speed', big: dSay(actual), say: 'to the first profile. The target is ' + SEND_TARGET + '.', foot: sp.slow ? STEP_SAY[sp.slow.k] + ' runs slow' : sp.segs.length + ' steps, each near its usual time' });
    if (st.made) slides.push({ k: 'The offer', big: st.declined + ' of ' + st.made, say: 'offers were turned down.', foot: counts[0] ? 'clients named ' + lower(counts[0].d.label) + ' most, ' + counts[0].n + ' of ' + decl.length : 'target ' + DECLINE_TARGET + '% or fewer' });
    if (past.length) slides.push({ k: 'After', big: stayed + ' of ' + past.length, say: 'earlier hires stayed to day 90.', foot: d90 + '% · target ' + DAY90_TARGET + '%' });
    return { head: head, chapters: ch, slides: slides, st: st, sp: sp, actual: actual, off: off, found: found, hired: hired };
  }
  /* A chapter as a block: what it says first, then its picture, then AiMY's
     reading with its source, then the move. */
  const chapterBlock = (c, n) => '<section class="s-block s-block-wide t-ch" id="rpt-' + c.k + '" aria-labelledby="rpt-' + c.k + '-h">' +
    '<span class="t-ch-cap">' + (n ? 'Chapter ' + n + ' · ' : '') + esc(c.cap) + '</span>' +
    '<h3 class="t-ch-h" id="rpt-' + c.k + '-h">' + esc(c.title) + '</h3>' +
    c.pic + aimyBlock({ text: c.say, from: c.from }) +
    (c.act ? '<p class="t-acts">' + c.act + '</p>' : '') +
  '</section>';
  /* The recap as text, for Copy the recap. */
  let RECAP = '';
  /* The story the Reports page last drew, and for whom: what its questions answer. */
  let STORY_NOW = null;
  /* A CHAPTER, ASKED, AS QA ANSWERS IN ITS CANVAS: a type label, the
     chart, AiMY's reading under it, the source, then what to do and what
     to ask next as prompts that open the next answer in the same thread. */
  function storyAnswer(k) {
    const sto = STORY_NOW ? STORY_NOW.sto : deskStory();
    const scope = STORY_NOW ? STORY_NOW.scope : 'the last 90 days';
    const c = sto && sto.chapters.filter((x) => x.k === k)[0];
    if (!c) return null;
    const next = sto.chapters.filter((x) => x !== c).map((x) => '<button class="entry-action em-investigate" type="button" data-story="' + x.k + '">' + mark(11) + esc(x.ask) + '</button>').join('');
    return { q: c.ask, html: '<div class="canvas-render t-cr">' +
      '<div class="canvas-type-label">Chart · ' + esc(c.cap) + ' · ' + esc(scope) + '</div>' +
      '<p class="t-cr-h">' + esc(c.title) + '</p>' +
      '<div class="canvas-chart">' + c.pic + '</div>' +
      '<div class="t-cr-say">' + c.say + '</div>' +
      '<p class="t-cr-from">' + esc(c.from) + '</p>' +
      (c.act ? '<div class="canvas-action-row">' + c.act + '</div>' : '') +
      '<div class="canvas-action-row t-cr-next">' + next + '<button class="entry-action em-investigate" type="button"' + goAttr({ on: 'reports', ch: k }) + '>Show it on the page</button></div>' +
    '</div>' };
  }
  function storyAsk(btn, k) {
    const a = storyAnswer(k);
    if (!a) return;
    flyToBar(btn, () => { if (!canvasShown()) openCanvas(); ASKING = a.q; peek(a.html, []); });
  }

  /* ONE REQUISITION'S RULER, on its own page: not averages but one real
     path, the person whose profile went first, step by step from their
     record; or, before any has gone, the person furthest along so far. */
  function rulerBlock(q) {
    if (rank(q, 'sent') < 0) return '';
    const pre = tplOf(q).filter((k) => STAGE_ORDER.indexOf(k) < STAGE_ORDER.indexOf('sent'));
    const sent = DB.byReq[q.id].filter((c) => rank(q, c.maxAt) >= rank(q, 'sent') && c.sentDay != null).sort((x, y) => x.sentDay - y.sentDay)[0] || null;
    const lead = sent || (isOpen(q) ? activeOf(q).filter((c) => rank(q, c.stage) < rank(q, 'sent')).sort((x, y) => rank(q, y.stage) - rank(q, x.stage) || y.since - x.since)[0] : null);
    if (!lead) return '';
    const segs = [];
    pre.forEach((k) => {
      const d = lead.took && lead.took[k] != null ? lead.took[k] : !sent && lead.stage === k ? lead.since : null;
      if (d == null) return;
      segs.push({ k: k, d: d, usual: STAGE[k].exp, on: 1, slow: d - STAGE[k].exp >= 1 && d / STAGE[k].exp > 1.15 });
    });
    if (!segs.length) return '';
    const total = segs.reduce((t, x) => t + x.d, 0);
    let t = 0, runs = null;
    segs.forEach((x) => { if (!runs && t + x.d > SEND_TARGET) runs = x; t += x.d; });
    const slow = segs.filter((x) => x.slow).sort((x, y) => y.d / y.usual - x.d / x.usual)[0];
    const over = total > SEND_TARGET;
    return '<section class="s-block s-block-wide" aria-label="Time to the first profile"><div class="s-camp-list-head"><h2 class="s-block-h">Time to the first profile</h2>' +
      '<span class="s-block-say">' + (sent ? 'the path of the profile that went first' : 'the furthest path so far') + ', step by step · target ' + SEND_TARGET + ' days</span></div>' +
      rulerPic({ reqs: [q], segs: segs, total: total }, total, (sent ? 'Sent after ' : 'So far: ') + dSay(total), true) +
      aimyBlock({ text: (sent ? '<b>' + esc(lead.name) + '</b>’s profile went first, after <b>' + dSay(total) + '</b> of steps from being found'
          : 'No profile has gone yet. The furthest along, <b>' + esc(lead.name) + '</b>, is at ' + esc(STEP_SAY[lead.stage]) + ' after <b>' + dSay(total) + '</b> of steps') +
        (over ? ', ' + dSay(total - SEND_TARGET) + ' past the target, which ran out during ' + esc(STEP_SAY[runs.k]) + '.' : ', inside the target.') +
        (slow ? ' ' + capFirst(esc(STEP_SAY[slow.k])) + ' took ' + dSay(slow.d) + ' against a usual ' + dSay(slow.usual) + '.' : over ? ' No step was slow; there are ' + segs.length + ' of them.' : ''),
        from: 'the days each step took for ' + first(lead.name) + ', from their record' }) +
      '<p class="t-acts"><button class="s-insight-lnk" type="button" data-cand="' + lead.id + '">Open ' + esc(first(lead.name)) + '</button></p>' +
    '</section>';
  }
  /* The story, for a desk's last 90 days on every account: what Today, the
     rail and the chat say of it. */
  function deskStory() {
    const reqs = deskReqs().filter((q) => q.state !== 'draft' && openedIn(q, 0, 90));
    if (!reqs.length) return null;
    const accs = ACCOUNTS.filter((a) => reqs.some((q) => q.acc === a.id));
    return story(reqs, DB.past.filter((p) => p.billable && accs.some((a) => a.id === p.acc)));
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
    /* The widest view this desk has, for a card the period leaves empty. */
    const stWide = rstats(inAcc);
    const reached = st.reached;
    const offers = st.offers;
    const num = (x) => (x == null ? '·' : String(x));
    const pcS = (x) => (x == null ? '·' : x + '%');
    const TARGET_BY = 'Set by ' + DESKS.dina.name + ', the HR Manager. A sample until the team sets its own.';
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
      { cap: 'Days to send profiles', none: () => 'None sent yet', v: (s) => s.sendAvg, base: (s) => s.sentN0, show: num, tgt: { v: 7, dir: 'le', unit: 'days' },
        say: (s) => 'from opening to the first profile sent, on average · ' + plural(s.sentN0, 'requisition'),
        def: (s) => [['Unit', 'Requisition'], ['Starts', 'The requisition opens'], ['Stops', 'Its first profile is sent to the client'], ['Counts', plural(s.sentN0, 'requisition') + ' that have sent one. The rest are still waiting and are left out.']] },
      { cap: 'Days to hire', none: () => 'No hire yet', v: (s) => s.toHire, base: (s) => s.hiredO.length, show: num, tgt: { v: 30, dir: 'le', unit: 'days' },
        say: (s) => 'from opening to the offer, on average · ' + plural(s.hiredO.length, 'person', 'people'),
        def: (s) => [['Unit', 'Person'], ['Starts', 'Their requisition opens'], ['Stops', 'The offer is sent'], ['Counts', plural(s.hiredO.length, 'person', 'people') + ' with an accepted offer. Fewer than the requisitions above, so the two are not one timeline.']] },
      { cap: 'Days to join', none: () => 'No hire yet', v: (s) => s.toJoin, base: (s) => s.hiredO.length, show: num, tgt: { v: 60, dir: 'le', unit: 'days' },
        say: (s) => 'from opening to day one, on average · ' + plural(s.hiredO.length, 'person', 'people'),
        def: () => [['Unit', 'Person'], ['Starts', 'Their requisition opens'], ['Stops', 'Their first day at work'], ['Counts', 'People with an accepted offer; a date not reached yet is the agreed start date.'], ['Why 60', 'Most notice periods here are one or two months.']] },
      { cap: 'HR after the phone screen', none: () => 'No screens yet', v: (s, m) => rate(s.reached('hr'), s.phones, m), show: pcS, tgt: { v: 70, dir: 'ge', unit: '%' },
        say: (s) => 'of people who passed the call went on to HR · ' + plural(s.phones, 'person', 'people'),
        def: (s) => [['Unit', 'Person'], ['Of', plural(s.phones, 'person', 'people') + ' who finished a phone screen: went on to HR, or left at it'], ['Counts', 'Those who reached the HR interview']] },
      { cap: 'Technical after HR', none: () => 'Nobody at HR yet', v: (s, m) => rate(s.reached('tech'), s.reached('hr'), m), show: pcS, tgt: { v: 55, dir: 'ge', unit: '%' },
        say: (s) => 'of people past HR reached the technical round · ' + plural(s.reached('hr'), 'person', 'people'),
        def: (s) => [['Unit', 'Person'], ['Of', plural(s.reached('hr'), 'person', 'people') + ' who reached the HR interview'], ['Counts', 'Those who reached the technical interview']] },
      { cap: 'Client interview per profile sent', none: () => 'None sent yet', v: (s, m) => rate(s.reached('client'), s.reached('sent'), m), show: pcS, tgt: { v: 25, dir: 'ge', unit: '%' },
        say: (s) => 'of profiles sent got a client interview · ' + plural(s.reached('sent'), 'profile'),
        def: (s) => [['Unit', 'Person'], ['Of', plural(s.reached('sent'), 'profile') + ' sent to a client'], ['Counts', 'Those the client agreed to meet'], ['Norm', 'About 3 to 5 profiles per client interview is usual for agencies; a weak benchmark. 25% is one in four.']] },
    ];
    /* THE STAFFING NUMBERS (R2, R6) the dashboard does not show: what it
       takes to make a hire, the hires lost after the count, and the client's
       side. Billed hires are never shown alone, always beside who stayed to
       day 90 (M10), as they are on the client's own page. */
    const staffing = [
      { cap: 'Profiles sent per hire', none: (s) => (s.reached('sent') ? s.reached('sent') + ' sent, no hire' : 'None sent yet'), v: (s, m) => (s.hiresSent && s.hiresSent >= (m || 1) ? Math.round(s.reached('sent') / s.hiresSent * 10) / 10 : null), show: num, tgt: { v: 6, dir: 'le', unit: '' },
        say: (s) => s.reached('sent') + ' profiles sent for ' + plural(s.hiresSent, 'hire'),
        def: () => [['Unit', 'Profile, per person hired'], ['Of', 'People with an accepted offer, on requisitions that send profiles to a client'], ['Counts', 'Every profile sent on those requisitions, hired or not'], ['Why 6', 'About 3 to 5 profiles per client interview, and most client interviews end in a hire.']] },
      { cap: 'Offers declined', none: () => 'No offers yet', v: (s, m) => rate(s.declined, s.made, m), show: pcS, tgt: { v: 15, dir: 'le', unit: '%' },
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
    /* THE FIGURES AS DATA, NOT CARDS (Engy, 4 Nov: "I don't want to see
       this kind of cards ever; make it normal data text in the chat"). One
       line each: the measure and its number, its target and how far off,
       then what it counts and its three months (Engy, 4 Nov: no How it is
       counted). Every figure still says something (29 Oct):
       a period with nothing to count from reads over all 90 days, and says
       so; nothing at all says what there is ("No hire yet"). */
    const figLine = (t) => {
      let v = t.v(st), lead = '';
      if (v == null && stWide.reqs.length > st.reqs.length && t.v(stWide) != null) { v = t.v(stWide); lead = 'Over all 90 days; none in the last ' + per + ' yet. '; }
      const none = v == null && t.none ? t.none(st) : null;
      const say = lead ? lead + t.say(stWide).replace(/^./, (x) => x.toUpperCase()) : t.say(st);
      const tv = WS.map((x) => (t.base && t.base(x) < TREND_MIN ? null : t.v(x, TREND_MIN)));
      const tg = t.tgt ? tgtSay(t.tgt, t.tgtV ? t.tgtV(st) : v, t.tgtLead) : '';
      const tone = /is-warn/.test(tg) ? ' is-warn' : /is-ok/.test(tg) ? ' is-ok' : '';
      return '<li class="t-fig"><span class="t-fig-head"><span class="t-fig-k">' + esc(t.cap) + '</span>' +
        '<b class="t-fig-v">' + esc(none || t.show(v)) + '</b>' + (tg ? '<span class="t-fig-tgt' + tone + '">' + tg.replace(/<[^>]+>/g, '') + '</span>' : '') + '</span>' +
        '<span class="t-fig-say">' + esc(say) + (tv.every((x) => x != null) ? ' · by month ' + tv.map((x) => esc(t.show(x))).join(' → ') : '') + '</span></li>';
    };
    const board = (label, list) => '<ul class="t-figs" aria-label="' + esc(label) + '">' + list.map(figLine).join('') + '</ul>';
    /* THE SCOPE, SAID AS A SENTENCE, IS THE FILTER (Engy, 4 Nov: option 1
       of deliverables/reports-filters.html). The line under the title
       already said the view in words; its two phrases now open a menu each,
       with how many requisitions every choice holds, so the two rows of
       pills are gone and the page starts as it reads: what it covers, then
       what happened (Deel, Homerun; fill in the blanks). One account only,
       and the account is said, not offered. */
    const whose = isHR() ? 'Everyone’s requisitions' : isHM() ? 'The requisitions you asked for' : 'Your requisitions';
    const blank = (id, label, cap, items) => '<span class="b-menu-wrap t-blank-wrap"><button class="t-blank" type="button" data-pickopen="' + id + '" aria-haspopup="menu" aria-expanded="false">' +
        esc(label) + svg('down', 13) + '</button>' +
      /* A span, not a div: it sits inside the sentence's paragraph. */
      '<span class="b-menu t-rpt-menu" id="' + id + '" role="menu" hidden><span class="b-menu-cap">' + esc(cap) + '</span>' + items + '</span></span>';
    const item = (attr, on, name, n) => '<button class="b-menu-item" type="button" role="menuitemradio" aria-checked="' + on + '" ' + attr + (on ? ' aria-current="true"' : '') + '>' +
      '<span class="t-rpt-tick" aria-hidden="true">' + (on ? svg('check', 13) : '') + '</span><span class="b-menu-name">' + esc(name) + '</span><span class="tel-menu-cc">' + n + '</span></button>';
    const perBlank = blank('perMenu', 'the last ' + per + ' days', 'Opened in', PERIODS.map((x) =>
      item('data-period="' + x[0] + '"', per === x[0], 'The last ' + x[0] + ' days', inAcc.filter((q) => openedIn(q, 0, x[0])).length)).join(''));
    const accBlank = accs.length > 1 ? blank('accMenu', accIn ? accIn.name : 'every account', 'Account · ' + accs.length + ' in view',
      item('data-account=""', !accIn, 'Every account', pool.filter((q) => openedIn(q, 0, per)).length) + '<span class="t-rpt-sep" aria-hidden="true"></span>' +
      accs.map((x) => item('data-account="' + x.id + '"', accIn === x, x.name, pool.filter((q) => q.acc === x.id && openedIn(q, 0, per)).length)).join('')) : accs[0] ? esc(accs[0].name) : '';
    const head = '<div class="s-camp-list-head t-rpt-head">' + switcher('reports') +
      '<p class="t-rpt-scope">' + esc(whose) + ' opened in ' + perBlank + (accBlank ? ', on ' + accBlank : '') + '.</p></div>';
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
    const dropped = offers.filter((o) => o.status === 'declined').length;
    const repl = reqs.filter((q) => q.kind === 'replacement').length;
    const bill = reqs.filter((q) => q.billable).length;
    const bar = (v, max, tone) => '<span class="t-fn-track"><span class="t-fn-fill' + (tone ? ' ' + tone : '') + '" style="width:' + (v / max * 100).toFixed(1) + '%"></span></span>';
    /* THE STORY LEADS (V6). The headline, a contents line to each chapter,
       the chapters; then the figures behind them, whole, one press down. */
    const sto = story(reqs, past);
    const chs = sto.chapters;
    STORY_NOW = { sto: sto, scope: whose + ', the last ' + per + ' days' + (accIn ? ', ' + accIn.name : '') };
    let n = 0;
    const lead = '<div class="t-story">' +
        '<p class="t-story-h">' + sto.head + '</p>' +
        '<p class="t-story-from">' + mark(11) + '<span>AiMY · from the ' + plural(reqs.length, 'requisition') + ' in view · every figure below is one press from its definition</span></p>' +
        /* Each chapter, asked: the answer opens in AiMY's canvas, drawn as
           QA draws its answers (Engy, 4 Nov). */
        '<nav class="t-story-toc" aria-label="Ask AiMY about a chapter">' + chs.map((c) => '<button class="t-ask" type="button" data-story="' + c.k + '">' +
          '<span class="t-ask-mark" aria-hidden="true">' + mark(12) + '</span><span class="t-ask-text">' + esc(c.ask) + '</span><span class="t-ask-go" aria-hidden="true">' + svg('send', 11) + '</span></button>').join('') + '</nav>' +
      '</div>';
    const scope = whose + ', the last ' + per + ' days' + (accIn ? ', ' + accIn.name : '');
    RECAP = sto.slides.map((x) => x.k + ': ' + x.big + ' ' + x.say + ' (' + x.foot + ')').join('\n');
    /* BEHIND THE STORY, ASKED (Engy, 4 Nov: "like the AiMY insights, to open
       the chat"). The figures, the breakdowns and the recap were rows that
       opened in place; now each is one of AiMY's insights, the finding in a
       sentence and a question that opens the canvas, where the answer is
       drawn as QA draws one: a type label, the content, and the other two
       questions to ask next. */
    const K = { figs: 'q' + (++CHAT_N), cuts: 'q' + (++CHAT_N), recap: 'q' + (++CHAT_N) };
    const QS = { figs: 'Show me all 13 figures', cuts: 'Break it down stage by stage', recap: 'Make the month’s recap' };
    const crAns = (k, label, title, body) => '<div class="canvas-render t-cr"><div class="canvas-type-label">' + esc(label) + ' · ' + esc(scope) + '</div>' +
      (title ? '<p class="t-cr-h">' + title + '</p>' : '') + body +
      '<div class="canvas-action-row t-cr-next">' + Object.keys(K).filter((x) => x !== k).map((x) =>
        '<button class="entry-action em-investigate" type="button" data-chat="' + K[x] + '">' + mark(11) + esc(QS[x]) + '</button>').join('') + '</div></div>';
    const sec = (title, say, body) => '<div class="t-appx-sec"><p class="t-cr-sub">' + esc(title) + (say ? '<span>' + esc(say) + '</span>' : '') + '</p>' + body + '</div>';
    /* The figures: how many of those with a target miss it, by name. */
    const missed = tiles.concat(staffing).filter((t) => {
      if (!t.tgt) return false;
      const v = t.tgtV ? t.tgtV(st) : t.v(st);
      return v != null && !(t.tgt.dir === 'le' ? v <= t.tgt.v : v >= t.tgt.v);
    });
    const withTgt = tiles.concat(staffing).filter((t) => t.tgt).length;
    const missSay = missed.length ? '<b>' + missed.length + ' of the ' + withTgt + '</b> with a target miss it: ' + esc(listSay(missed.map((t) => lower(t.cap)))) + '.' : 'Every one with a target meets it.';
    /* The breakdown: the funnel for every position in view, then the cuts. */
    const fRows = stageStats(reqs, stagesOf(reqs));
    const fRead = stageRead(fRows, 'every requisition in view');
    const facts = ' ' + dropped + ' offers were declined. ' + repl + ' of ' + reqs.length + ' requests were replacements, and ' + bill + ' are billable.';
    const cuts = sec('The funnel', 'everyone who reached each stage, across ' + plural(reqs.length, 'position') + ' · who moved on · days in it',
        stageFunnel(fRows, { of: reqs.length, doorSay: ' Press to see who is at it now, on all your open requisitions.', drill: (x) => (x.here && (isRec() || isHR()) ? ' data-fdrill="' + x.k + '"' : ''),
          say: fRead ? { text: fRead.text + facts, from: fRead.from } : null })) +
      (accIn ? '' : sec('By account', 'requests · open · filled', '<div class="t-funnel">' + byAcc.map((x) => '<button class="t-fn-row t-fn-btn" type="button" data-acc="' + x.a.id + '"><span class="t-fn-label">' + esc(x.a.name) + '</span>' + bar(x.n, maxAcc) +
          '<span class="t-fn-n"><b>' + x.n + '</b> · ' + x.open + ' · ' + x.hired + '</span></button>').join('') + '</div>')) +
      sec('By role', 'requests', '<div class="t-funnel">' + byTitle.map((x) => '<div class="t-fn-row"><span class="t-fn-label">' + esc(x.t) + '</span>' + bar(x.n, byTitle[0].n) + '<span class="t-fn-n"><b>' + x.n + '</b></span></div>').join('') + '</div>') +
      /* Counts, alphabetical, no bars: nothing here can be read as a
         ranking until decision D5 (P6; rank incentives cut productivity in
         a field experiment, R6). The same period and account as the rest. */
      (isHR() ? sec('By recruiter', 'alphabetical · not a ranking',
        aimyBlock({ text: 'The same numbers the dashboard shows today, as counts. Whether per-person numbers stay in Talent is decision D5; the research leans to team views here and coaching one person at a time in AiMY QA.', from: 'the UI/UX plan, P6' }) +
        '<div class="t-tbl" role="table" aria-label="By recruiter"><div class="t-tbl-row t-tbl-head" role="row"><span role="columnheader">Recruiter</span><span role="columnheader">Open requisitions</span><span role="columnheader">People in progress</span><span role="columnheader">Days to send profiles</span></div>' +
        RECRUITERS.slice().sort((x, y) => x.name.localeCompare(y.name)).map((rc) => { const mineR = reqs.filter((q) => q.rec === rc.id);
          const act = mineR.filter(isOpen).reduce((t, q) => t + activeOf(q).length, 0);
          return '<div class="t-tbl-row" role="row"><span role="cell">' + esc(rc.name) + '</span><span role="cell">' + mineR.filter(isOpen).length + '</span><span role="cell">' + act + '</span><span role="cell">' + (avgSent(mineR) != null ? avgSent(mineR) : '·') + '</span></div>'; }).join('') + '</div>') : '');
    const deck = '<div class="t-deck">' + sto.slides.map((x) => '<div class="t-slide"><span class="t-slide-k">' + esc(x.k) + '</span><span class="t-slide-s"><em>' + esc(x.big) + '</em>' + esc(x.say) + '</span><span class="t-slide-f">' + esc(x.foot) + '</span></div>').join('') + '</div>' +
      '<div class="canvas-action-row"><button class="s-insight-lnk primary" type="button" data-recap-copy>Copy the recap</button><span class="t-of-say">as text, to paste into an email or a chat</span></div>';
    const behind = [
      insightRow({ k: K.figs, ws: 'detected', wsSay: 'All 13 figures', q: QS.figs,
        say: 'The <b>13 figures</b> behind the story, each with its target and trend. ' + missSay,
        a: crAns('figs', 'Figures · 13', missSay, board('Reports', tiles) + sec('Staffing', 'what a hire takes, and what happens after it', board('Staffing', staffing))) }),
      insightRow({ k: K.cuts, ws: 'detected', wsSay: 'Stage by stage', q: QS.cuts,
        say: (fRead ? fRead.text : 'Every stage is near its usual.') + ' Then by account and role' + (isHR() ? ', and by recruiter' : '') + '.',
        a: crAns('cuts', 'Breakdown', fRead ? fRead.text : '', cuts) }),
      insightRow({ k: K.recap, ws: 'drafted', wsSay: 'Share the month', q: QS.recap,
        say: 'The month in <b>' + plural(sto.slides.length, 'slide') + '</b>, one sentence each, ready to send to a BU director or a client.',
        a: crAns('recap', 'Recap · ' + plural(sto.slides.length, 'slide'), '', deck) }),
    ];
    return '<div class="s-home">' +
      '<section class="s-block s-block-wide" aria-label="Reports">' + head + lead + '</section>' +
      chs.map((c) => chapterBlock(c, c.k === 'journey' ? 0 : ++n)).join('') +
      '<section class="s-block s-block-wide" aria-label="Behind the story"><div class="s-camp-list-head"><h2 class="s-block-h">Behind the story</h2></div>' +
        '<div class="t-insights">' + behind.join('') + '</div>' +
      '</section>' +
    '</div>';
  }

  /* ══ THE DIARY (Sales B11, for recruiting; Engy, 29 Oct) ═════════════════
     Today says what needs you now; the diary is the week and the month.
     Sales's own calendar, as its markup and styles have it: a month grid
     with a dot per thing on each day, the chosen day's agenda beside it,
     and what is next under that. What lands here is what a recruiter's
     week is made of: interviews (with Prepare me), callbacks in the window
     the person asked for, start dates, and the day-30 and day-90 check-ins.
     Under it, Sales's "Missing details" as recruiting has it: Results not
     in, every interview that happened with no result, oldest first, each
     with its nudge (or, on the hiring manager's desk, their own debrief).
     The recruiter reads their requisitions; the hiring manager theirs,
     and only the people they can see. */
  const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  /* Monday first; the weekend is Friday and Saturday, as it is in Cairo. */
  const WD_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DIARY_DOT = { iv: 'b-cal-dot k-meeting', client: 'b-cal-dot k-demo', callback: 'b-cal-dot k-callback', start: 'b-cal-dot k-held', check: 'b-cal-dot k-dinner', owed: 'b-cal-dot k-owed' };
  const DIARY_KIND = { iv: 'Interview', client: 'Client interview', callback: 'Callback', start: 'Start date', check: 'Check-in', owed: 'Result not in' };
  const dOff = (d) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - TODAY) / DAY_MS);
  const diaryReqs = () => (isHM() ? deskReqs() : mine());
  /* Everything in the diary between two days, in day and time order. */
  function diaryItems(from, to) {
    const out = [], reqs = diaryReqs(), inR = (d) => d != null && d >= from && d <= to;
    const ok = (c) => c && reqs.indexOf(reqOf(c)) >= 0 && (!isHM() || sees(c));
    const ivKind = (s) => (s === 'client' || s === 'ctech' ? 'client' : 'iv');
    reqs.forEach((q) => DB.byReq[q.id].forEach((c) => {
      if (!ok(c) || c.exit) return;
      /* Booked: today or ahead. */
      if (MEETS[c.stage] && c.meet != null && c.meet >= 0 && inR(c.meet)) out.push({ day: c.meet, time: c.slot, kind: ivKind(c.stage), c: c, what: STAGE[c.stage].label });
      /* A callback is the recruiter's, in the window they asked for. */
      if (isRec() && c.callback != null && canCall(c)) {
        const d = Math.max(0, c.callback);
        if (inR(d)) out.push({ day: d, time: c.cbWin ? CB_WIN[c.cbWin][0] : null, until: c.cbWin ? CB_WIN[c.cbWin][1] : null, kind: 'callback', c: c, what: 'Asked to be called back' });
      }
    }));
    /* Held: with the result in, or still owed. */
    DB.ivs.forEach((v) => {
      const c = DB.byId[v.cand];
      if (!ok(c) || !inR(v.day) || v.status === 'booked') return;
      out.push(v.status === 'owed' ? { day: v.day, time: v.slot, kind: 'owed', c: c, v: v, what: STAGE[v.stage].label + ' with ' + v.by.split(',')[0] }
        : { day: v.day, time: v.slot, kind: ivKind(v.stage), c: c, v: v, done: true, what: STAGE[v.stage].label + ' with ' + v.by.split(',')[0] });
    });
    /* A start date, and the two check-ins after it. */
    DB.offers.forEach((o) => {
      const c = DB.byId[o.cand];
      if (!ok(c) || o.joinDay == null || (o.status !== 'accepted' && o.status !== 'joined')) return;
      if (inR(o.joinDay)) out.push({ day: o.joinDay, time: null, kind: 'start', c: c, what: (o.joinDay <= 0 ? 'Started' : 'Starts') + ' at ' + accOf(reqOf(c)).name });
      [[30, 'd30'], [90, 'd90']].forEach((x) => {
        const d = o.joinDay + x[0];
        if (inR(d)) out.push({ day: d, time: null, kind: 'check', c: c, what: 'Day-' + x[0] + ' check-in' + (c[x[1]] ? ', recorded' : d < 0 ? ', not recorded yet' : '') });
      });
    });
    return out.sort((a, b) => a.day - b.day || String(a.time || '99').localeCompare(String(b.time || '99')));
  }
  /* Every interview that happened with no result, oldest first. */
  const resultsOwed = () => diaryItems(-400, -1).filter((m) => m.kind === 'owed').sort((a, b) => a.day - b.day);
  /* The one thing to do about a result not in: the hiring manager writes
     their own; for anyone else, the recruiter nudges, once, and it says so. */
  /* Held by the person at this desk: theirs to write, not to nudge (5 Nov). */
  const ivMine = (v) => v.by.split(',')[0] === me().name;
  function owedAct(m) {
    const c = m.c, v = m.v;
    if (isHM() && ivMine(v)) return '<button class="s-inline-btn t-prep-btn" type="button"' + goAttr({ debrief: v.id }) + '>Write it</button>';
    if (isRec() && ivMine(v)) return '<button class="s-inline-btn t-prep-btn" type="button"' + goAttr({ debrief: v.id }) + '>Write your result</button>';
    if (c.nudged != null) return '<span class="b-kind">Nudged ' + esc(sayWhen(c.nudged)) + '</span>';
    return isRec() ? '<button class="s-inline-btn t-prep-btn" type="button" data-nudge="' + c.id + '">' + esc(nudgeSay(c)) + '</button>' : '';
  }
  /* Today's interview on Teams is joined from where it is listed (5 Nov). */
  const teamsJoin = (v) => v && v.mode === 'video' && v.status === 'booked' && v.day === 0
    ? '<button class="s-inline-btn t-prep-btn" type="button" data-teams-join="' + v.id + '">' + svg('video', 12) + 'Join on Teams</button>' : '';
  function diaryRow(m, i) {
    const c = m.c;
    const bv = (m.kind === 'iv' || m.kind === 'client') && !m.done ? ivsOf(c).filter((x) => x.status === 'booked' && x.day === m.day)[0] : null;
    const act = m.kind === 'callback' && m.day <= 0 ? '<button class="s-inline-btn t-prep-btn" type="button" data-call="' + c.id + '">' + svg('phone', 12) + 'Call ' + esc(first(c.name)) + '</button>'
      : (m.kind === 'iv' || m.kind === 'client') && !m.done ? teamsJoin(bv) + '<button class="s-inline-btn t-prep-btn" type="button" data-prep="' + c.id + '">' + mark(12) + 'Prepare me</button>'
      : m.kind === 'owed' ? owedAct(m) : '';
    return '<div class="b-cal-ev is-plain t-cal-ev" style="--i:' + Math.min(i, 8) + '">' +
      '<button class="t-cal-open" type="button"' + goAttr({ cand: c.id }) + '>' +
        '<span class="b-cal-evtop"><span class="' + DIARY_DOT[m.kind] + '"></span>' +
          '<span class="b-cal-etime">' + esc(m.time ? m.time + (m.until ? '–' + m.until : '') : 'All day') + '</span>' +
          '<span class="b-kind">' + esc(DIARY_KIND[m.kind] + (m.done ? ', result in' : '')) + '</span></span>' +
        '<span class="b-cal-ename"><b>' + esc(c.name) + '</b><span class="b-cal-ewhat">' + esc(m.what) + ' · ' + esc(reqOf(c).title) + '</span></span>' +
      '</button>' + act + '</div>';
  }
  function diaryPage() {
    const sel = Number(S.day) || 0;
    const d = dayOf(sel), y = d.getFullYear(), mo = d.getMonth();
    const first1 = new Date(y, mo, 1), lead = (first1.getDay() + 6) % 7;
    const start = dOff(first1) - lead;
    const n = lead + new Date(y, mo + 1, 0).getDate() > 35 ? 42 : 35;
    const all = diaryItems(start, start + n - 1);
    const byDay = {};
    all.forEach((m) => { (byDay[m.day] = byDay[m.day] || []).push(m); });
    const inMonth = all.filter((m) => dayOf(m.day).getMonth() === mo).length;
    const grid = Array.from({ length: n }, (x, i) => {
      const off = start + i, dt = dayOf(off), on = byDay[off] || [];
      const out = dt.getMonth() !== mo, end = dt.getDay() === 5 || dt.getDay() === 6;
      return '<button class="b-cal-day' + (out ? ' is-out' : '') + (off === sel ? ' is-sel' : '') + (off === 0 ? ' is-today' : '') + (end ? ' is-end' : '') + '" type="button" data-diary-day="' + off + '" ' +
        'aria-label="' + esc(sayDay(off) + ', ' + plural(on.length, 'thing')) + '"' + (off === sel ? ' aria-current="date"' : '') + ' style="--i:' + (i % 7) + '">' +
        '<span class="b-cal-bg"></span><span class="b-cal-num">' + dt.getDate() + '</span>' +
        '<span class="b-cal-dots">' + on.slice(0, 3).map((m) => '<span class="' + DIARY_DOT[m.kind] + '"></span>').join('') + '</span></button>';
    }).join('');
    const day = diaryItems(sel, sel), soon = diaryItems(sel + 1, sel + 60).slice(0, 3);
    const step = (k) => dOff(new Date(y, mo + k, 1));
    const week = diaryItems(0, 6), owed = resultsOwed(), dec = isRec() ? decisions() : [];
    const cnt = (k) => week.filter((m) => m.kind === k && !m.done).length;
    const said = [[cnt('iv') + cnt('client'), 'interview'], [cnt('callback'), 'callback'], [cnt('start'), 'start date'], [cnt('check'), 'check-in']]
      .filter((x) => x[0]).map((x) => '<b>' + plural(x[0], x[1]) + '</b>');
    const lead1 = aimyBlock({ text: (said.length ? 'This week: ' + said.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.' : 'Nothing is in the diary this week.') +
      (owed.length ? ' <b>' + plural(owed.length, 'result') + '</b> not in yet, the oldest from ' + esc(sayWhen(owed[0].day)) + '.' : ' Every interview so far has its result.'),
      from: 'the interviews, callbacks and offers on ' + (isHM() ? 'the requisitions you asked for' : 'your requisitions') }, true);
    const keyRow = '<p class="t-diary-key">' + ['iv', 'client', 'callback', 'start', 'check', 'owed'].filter((k) => isRec() || k !== 'callback')
      .map((k) => '<span><span class="' + DIARY_DOT[k] + '"></span>' + esc(DIARY_KIND[k]) + '</span>').join('') + '</p>';
    const cal = '<div class="b-cal"><div class="b-cal-panel">' +
      '<div class="b-cal-head"><h3 class="b-cal-month">' + MONTH_FULL[mo] + ' ' + y + '<span class="b-cal-count">' + inMonth + '</span></h3>' +
        '<div class="b-cal-nav"><button class="b-cal-btn is-word" type="button" data-diary-day="0">Today</button>' +
          '<button class="b-cal-btn" type="button" data-diary-day="' + step(-1) + '" aria-label="The month before">' + svg('back') + '</button>' +
          '<button class="b-cal-btn" type="button" data-diary-day="' + step(1) + '" aria-label="The month after">' + svg('go') + '</button></div></div>' +
      '<div class="b-cal-mo"><div class="b-cal-week">' + WD_SHORT.map((w, i) => '<span class="' + (i === 4 || i === 5 ? 'b-cal-wd is-end' : 'b-cal-wd') + '">' + w + '</span>').join('') + '</div>' +
        '<div class="b-cal-grid" role="grid" aria-label="' + esc(MONTH_FULL[mo] + ' ' + y) + '">' + grid + '</div>' + keyRow + '</div>' +
      '<div class="b-cal-side"><h4 class="b-cal-cap">' + esc((sel === 0 ? 'Today' : DAY_FULL[d.getDay()]) + ', ' + sayDay(sel)) + ' · ' + esc(plural(day.length, 'thing')) + '</h4>' +
        '<div class="b-cal-agenda">' + (day.length ? day.map(diaryRow).join('') : '<p class="b-cal-none">Nothing on this day.</p>') + '</div>' +
        (soon.length ? '<div class="b-cal-next"><h4 class="b-cal-cap">Next in the diary</h4><div class="b-cal-agenda">' + soon.map((m, i) =>
          '<button class="b-cal-nrow" type="button" data-diary-day="' + m.day + '" style="--i:' + i + '"><span class="' + DIARY_DOT[m.kind] + '"></span>' +
            '<span class="b-cal-nwhen">' + esc(sayDay(m.day)) + (m.time ? ' · ' + esc(m.time) : '') + '</span><span class="b-cal-nwho">' + esc(m.c.name) + '</span></button>').join('') + '</div></div>' : '') +
      '</div></div></div>';
    return '<div class="s-home">' +
      '<section class="s-block s-block-wide" aria-label="The diary"><div class="s-camp-list-head">' + switcher('diary') +
        (isRec() ? '<span class="b-draft-acts"><button class="b-ghost" type="button" data-book-chat="">Book an interview</button></span>' : '') + '</div>' +
        (isRec() ? '<p class="t-scope">' + tag('Outlook', 'info') + '<span>Your Outlook calendar. Interviews booked here send Outlook invites, and a time is offered only when it is free in both calendars.</span></p>' : '') + lead1 +
        '<div class="b-diary">' + cal + '</div></section>' +
      /* Results that are in and wait on your move, beside the ones that are
         not. They stood under Today's tabs until 29 Oct. */
      (isRec() ? '<section class="s-block s-block-wide" aria-label="Results in"><div class="s-camp-list-head"><h2 class="s-block-h">Results in</h2></div>' +
        /* Said as Today says it, with the same run (5 Nov). */
        '<p class="b-tocall">' + (dec.length ? '<b>' + plural(dec.length, 'result') + '</b> ' + (dec.length === 1 ? 'waits' : 'wait') + ' on your call, oldest first. Each is one press, and each can be undone.'
          : 'No result waits on your call.') + '</p>' +
        (dec.length > 1 ? '<p class="t-acts"><button class="s-insight-lnk primary" type="button" data-start="decide">Decide them one at a time</button></p>' : '') +
        (dec.length ? '<div class="b-owed">' + topN('decide', dec).map((c, i) => workRow(c, i)).join('') + '</div>' + moreLinks('decide', dec.length) : '') +
      '</section>' : '') +
      '<section class="s-block s-block-wide" aria-label="Results not in"><div class="s-camp-list-head"><h2 class="s-block-h">Results not in</h2>' +
        '<span class="s-block-say">interviews that happened with no result yet · oldest first</span></div>' +
        (owed.length ? '<div class="b-owed">' + owed.map((m, i) => '<div class="b-owed-row t-row" style="--i:' + Math.min(i, 8) + '"><span class="b-owed-sev" aria-hidden="true"></span>' +
          '<button class="b-owed-main t-row-open" type="button"' + goAttr({ cand: m.c.id }) + '><span class="b-owed-head"><span class="b-owed-type">' + esc(m.c.name) + '</span>' +
            '<span class="b-owed-by">' + esc(reqOf(m.c).title) + ' · ' + esc(accOf(reqOf(m.c)).name) + '</span></span>' +
            '<span class="b-owed-body">' + esc(STAGE[m.v.stage].label) + ' with ' + (ivMine(m.v) ? 'you' : esc(m.v.by)) + ', ' + esc(sayWhen(m.day)) + '. <b>' + days(-m.day) + '</b> without a result.</span></button>' +
          '<span class="t-acts">' + owedAct(m) + '</span></div>').join('') + '</div>'
          : '<p class="s-none">Every interview so far has its result.</p>') +
      '</section>' +
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
      /* The target date is theirs, so the requisitions likely to miss it are
         too: the move is changing the date, or the requisition. */
      riskBlock(risky.map((q) => ({ q: q, h: health(q) })), (q, h) => '<button class="b-owed-go t-row-go" type="button" data-edit-req="' + q.id + '">' +
        (q.askedMove != null ? esc(first(DESKS[q.rec] ? DESKS[q.rec].name : 'The recruiter')) + ' asks to move it' : 'Change the date') + '</button>') +
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
      approvalsBlock() +
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
      approvalsBlock() +
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
            (passOpen(c) ? passPicker(c, true) : '<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">' + rcBtn('Meet them', 'data-move="' + c.id + '|client"', 'primary', 'cal') + rcBtn('Pass', 'data-pass-open="' + c.id + '"') + '</div>') +
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
  const turnBody = (t) => t.html || (t.kind === 'brief' ? briefHtml(t) : t.kind === 'readback' ? readbackHtml(t)
    : t.kind === 'book' ? bookTurnHtml(t) : t.kind === 'wu' ? wuTurnHtml(t) : t.kind === 'draft' ? draftTurnHtml(t) : t.kind === 'logsay' ? logSayHtml(t) : '');
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
    /* The thread is a main reading surface, so it asks for the scroll dot
       the rest of the canvas no longer gets, with QA's clickable track and
       Latest pill (QA aimy-canvas.js). */
    if (window.AimyScroll) window.AimyScroll.attach(byId('overlayThread'), { track: true, latest: true });
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
    if (fcTyped(t)) { byId('overlayInput').value = ''; return; }
    if (draftCorrect(t) || wuCorrect(t)) { byId('overlayInput').value = ''; return; }
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
        '. Each feeds matching for its own client only.' : 'No client has passed with a reason yet.', [{ label: 'Open the reports', go: { on: 'reports', ch: 'loss' }, primary: true }]);
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
    /* Done in the chat, said back before it commits (5 Nov). */
    const named = candIn(lc);
    if (isRec() && /\b(book|schedule|arrange|set up)\b/.test(lc) && (named || /\binterview/.test(lc))) { ASKING = null; bookChat(named, t); return; }
    if (isRec() && named && /\b(message|whatsapp|text|write to|email|remind)\b/.test(lc)) { ASKING = null; draftChat(named, t, t); return; }
    if (isRec() && named && !/^call\b/.test(lc) && /\b(called|spoke (to|with)|talked (to|with)|rang|had a call)\b/.test(lc)) { ASKING = null; logSayChat(named, t); return; }
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
        /* Said as Today says it (5 Nov): results on your call, then who to
           reach, then what came in. */
        const d = decisions(), tc = toCall(), m = missed(), wa = waOwed();
        peek('<b>' + plural(d.length, 'result') + '</b> ' + (d.length === 1 ? 'waits' : 'wait') + ' on your call, <b>' + plural(tc.length, 'person', 'people') + '</b> to reach, ' +
          listSay(['<b>' + plural(m.length, 'missed call') + '</b>', '<b>' + plural(wa.length, 'WhatsApp reply', 'WhatsApp replies') + '</b>']) + '.' +
          (d[0] ? ' The oldest result is ' + esc(d[0].name) + ', ' + esc(lower(STAGE[d[0].stage].label)) + '.' : ''),
          [d.length ? { label: 'Decide the oldest one', go: { on: 'decide' }, primary: true } : null, tc.length ? { label: 'Call them in order', data: 'call-all' } : null,
            m.length + wa.length ? { label: 'Open the inbox', go: { on: 'calls', q: 'inbox' } } : null].filter(Boolean));
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
        Math.round(x.m / x.n * 100) + '%), across ' + plural(reqs.length, 'requisition') + '.', [{ label: 'Open the reports', go: { on: 'reports', ch: 'journey' }, primary: true }]);
      return;
    }
    if (/\b(how long|time to|average|days to|how fast)\b/.test(lc) && !isClient()) {
      const reqs = deskReqs().filter((q) => q.state !== 'draft'), a = avgSent(reqs);
      peek(a != null ? 'On average it takes <b>' + days(a) + '</b> from opening a requisition to sending the first profile, across ' + plural(reqs.length, 'requisition') + '.'
        : 'No profile has been sent yet, so there is no time to report.', [{ label: 'Open the reports', go: { on: 'reports', ch: 'speed' }, primary: true }]);
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
      domain: acc.domain, published: false, budget: o.budget || { min: BUDGETS[level][0], max: BUDGETS[level][1] },
      desc: o.desc || '', from: o.from || null, asmt: TEMPLATE[acc.tpl].indexOf('assess') >= 0 ? (fam === 'finance' ? 'a3' : fam === 'ops' ? 'a4' : 'a1') : null,
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
  /* ══ WHERE A REQUISITION STARTS (Requisitions, 29 Oct) ══════════════════
     82% of requests replace someone who left, so that is the first start:
     the role, its must-haves and its account come from the person, and the
     recruiter changes what is different. The second is the briefing, as
     Greenhouse's kickoff and Workable's job brief agents do: the notes from
     the call, pasted, read into a draft that says what it could not find.
     Starting from nothing stays, as a link. */
  const deskAccs = () => (isHR() ? ACCOUNTS : isHM() ? ACCOUNTS.filter((a) => a.hm === DESK) : ACCOUNTS.filter((a) => mine().some((q) => q.acc === a.id)));
  function newReqPage() {
    const accIn = ACCOUNTS.filter((a) => a.id === S.account)[0] || null;
    const accs = deskAccs();
    const left = DB.past.filter((p) => !p.stayed && (accIn ? p.acc === accIn.id : accs.some((a) => a.id === p.acc)));
    const live = DB.reqs.filter((q) => q.state !== 'draft');
    const share = Math.round(live.filter((q) => q.kind === 'replacement').length / Math.max(1, live.length) * 100);
    return '<div class="s-home">' +
      '<div class="b-topbar s-block-wide"><button class="s-back" type="button" data-trail>' + svg('back', 14) + 'Back</button></div>' +
      '<section class="s-block s-block-wide" aria-label="New requisition">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">New requisition' + (accIn ? ' for ' + esc(accIn.name) : '') + '</h2>' +
          '<span class="s-block-say">' + share + '% of requests replace someone, so that comes first</span></div>' +
        '<div class="t-starts">' +
          '<div class="t-start">' +
            '<h3 class="t-start-h">Replace someone who left</h3>' +
            '<p class="t-start-say">The role, its must-haves and its account come from theirs. You change what is different.</p>' +
            (left.length ? '<div class="b-log">' + left.map((p, i) => logRow({ tone: '', ico: svg('user'), who: p.name,
                meta: logMeta([p.title, accOf(p).name, 'joined ' + sayDay(p.join)]), say: 'Why they left: ' + esc(lower(p.why)) + '.',
                act: 'data-replace="' + p.id + '"', go: 'Replace' }, i)).join('') + '</div>'
              : '<p class="s-none">Nobody has left on ' + (accIn ? esc(accIn.name) : 'these accounts') + '.</p>') +
          '</div>' +
          '<div class="t-start">' +
            '<h3 class="t-start-h">From a briefing</h3>' +
            '<p class="t-start-say">Paste the notes from the kickoff call or the hiring manager’s email. AiMY drafts it and says what it could not find.</p>' +
            '<div class="t-input-wrap" id="wrapBrief"><textarea class="b-draft-in b-draft-area t-area t-input" id="briefText" rows="6" aria-label="The briefing" ' +
              'placeholder="For example: Northwind needs two German-speaking support agents, C1, at least a year of software support, by mid-December. Budget up to 30,000."></textarea>' +
              '<p class="t-error-msg">Paste or type the briefing first.</p></div>' +
            '<p class="t-acts"><button class="s-insight-lnk primary" type="button" data-brief-read>' + mark(12) + 'Draft it from this</button></p>' +
          '</div>' +
        '</div>' +
        '<p class="b-vfoot">Or <button class="t-inline-link" type="button" data-new-blank>start from nothing</button>.</p>' +
      '</section></div>';
  }
  function replaceFrom(p) {
    if (!p) return;
    const role = ROLES.filter((x) => x.title === p.title)[0];
    const fam = role ? role.fam : famOf(p.title);
    /* The careers page never names the person who left. */
    const q = newReq({ acc: p.acc, title: p.title, fam: fam, level: role ? role.level : 'Mid-level', must: role ? role.must.slice() : [], kind: 'replacement',
      desc: 'We are hiring a ' + p.title + '. ' + ROLE_BLURB[fam],
      from: { kind: 'replace', who: p.id, say: 'Drafted from ' + p.name + '’s role on ' + accOf(p).name + ': the same title, level and must-haves. They left: ' + lower(p.why) + '.' +
        (/salary/i.test(p.why) ? ' Worth checking the budget before it opens.' : '') } });
    if (q) toast('A draft to replace ' + first(p.name), () => { unmake('reqs', q); go({ on: 'newreq', account: S.account }, true); }, 'Change what is different, then open it.');
  }
  /* What a briefing says, read into fields; whatever it does not say is
     named, not guessed silently. */
  const MONTH_N = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function readBrief(text) {
    const t = String(text), lc = t.toLowerCase();
    const words = (x) => x.toLowerCase().replace(/[()]/g, '').split(/\s+/).filter((w) => w.length > 3);
    const scored = ROLES.map((r) => ({ r: r, n: words(r.title).filter((w) => lc.indexOf(w) >= 0 || lc.indexOf(w.replace(/s$/, '')) >= 0).length })).sort((a, b) => b.n - a.n);
    const role = scored[0].n >= 2 ? scored[0].r : null;
    const title = role ? role.title : parseRole(t).title;
    const acc = ACCOUNTS.filter((a) => lc.indexOf(a.name.toLowerCase().split(' ')[0]) >= 0)[0] || null;
    const level = LEVELS.filter((l) => lc.indexOf(l.toLowerCase()) >= 0)[0] || null;
    const sm = /\b(\d+|one|two|three|four|five|six)\s+(?:more\s+)?(?:[a-z-]+\s+){0,3}?(?:people|agents?|engineers?|specialists?|accountants?|analysts?|seats|hires|leads?)\b/i.exec(t);
    const seats = sm ? (NUMW[sm[1].toLowerCase()] || Number(sm[1])) : null;
    let target = null;
    const mm = /\b(?:by|before)\s+(mid-?|end of |the end of |early )?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.exec(t);
    if (mm) {
      const day = mm[1] && /mid/i.test(mm[1]) ? 15 : mm[1] && /end/i.test(mm[1]) ? 28 : 1;
      let d = new Date(TODAY.getFullYear(), MONTH_N[mm[2].toLowerCase()], day);
      if (d <= TODAY) d = new Date(TODAY.getFullYear() + 1, MONTH_N[mm[2].toLowerCase()], day);
      target = Math.round((d - TODAY) / DAY_MS);
    }
    const wk = /\bin\s+(\d+|two|three|four|six)\s+weeks\b/i.exec(t);
    if (target == null && wk) target = (NUMW[wk[1].toLowerCase()] || Number(wk[1])) * 7;
    const bm = /\b(\d{2})[,.]?(\d{3})\b/.exec(t);
    const budget = bm ? Number(bm[1] + bm[2]) : null;
    const lang = ['German', 'French', 'Spanish', 'Italian', 'Dutch'].filter((l) => new RegExp('\\b' + l, 'i').test(t))[0] || null;
    const cefr = /\b([ABC][12])\b/.exec(t);
    const kind = /\b(replac|left|leaving|resign|backfill)/i.test(t) ? 'replacement' : /\b(new (seat|role|headcount|position)s?|additional|extra)\b/i.test(t) ? 'new' : null;
    return { title: title, role: role, acc: acc, level: level, seats: seats, target: target, budget: budget, lang: lang, cefr: cefr ? cefr[1] : null, kind: kind };
  }
  function fromBrief(text) {
    if (!String(text).trim()) { shake('wrapBrief'); return; }
    const b = readBrief(text);
    if (!b.title) { shake('wrapBrief'); toast('I could not find the role in it', null, 'Name it, like “two German-speaking support agents”.'); return; }
    const acc = b.acc || deskAccs()[0] || ACCOUNTS[0];
    const level = b.level || (b.role ? b.role.level : 'Mid-level');
    const must = b.role ? b.role.must.slice() : [];
    if (b.lang) {
      const line = b.lang + ' at ' + (b.cefr || 'C1') + ' or above';
      const at = must.findIndex((m) => m.indexOf(b.lang) === 0);
      if (at >= 0) must[at] = line; else must.unshift(line);
    }
    const band = BUDGETS[level];
    const got = [b.title, b.acc ? acc.name : null, b.seats ? plural(b.seats, 'seat') : null, b.level ? level.toLowerCase() : null,
      b.target != null ? 'by ' + sayDay(b.target) : null, b.budget ? 'up to ' + money(b.budget) : null, b.lang ? b.lang + ' at ' + (b.cefr || 'C1') : null,
      b.kind ? (b.kind === 'new' ? 'a new seat' : 'a replacement') : null].filter(Boolean);
    const miss = [b.acc ? null : 'the account (set to ' + acc.name + ')', b.target != null ? null : 'a date (set to the usual ' + expDays(acc.tpl) + ' days)',
      b.budget ? null : 'a budget (set to the ' + level.toLowerCase() + ' band)', b.kind ? null : 'whether it replaces someone (set as a replacement, the usual case)',
      b.role ? null : 'must-haves AiMY knows for this role'].filter(Boolean);
    const q = newReq({ acc: acc.id, title: b.title, fam: b.role ? b.role.fam : famOf(b.title), level: level, must: must, seats: b.seats || 1, kind: b.kind || 'replacement',
      target: b.target != null ? b.target : undefined, budget: b.budget ? { min: Math.min(band[0], b.budget), max: b.budget } : undefined,
      desc: 'We are hiring ' + (b.seats > 1 ? b.seats + ' people as ' : 'a ') + b.title + '. ' + ROLE_BLURB[b.role ? b.role.fam : famOf(b.title)],
      from: { kind: 'brief', text: String(text).trim(), say: 'Read from your briefing: ' + got.join(', ') + '.' + (miss.length ? ' Not in it: ' + miss.join('; ') + '.' : '') } });
    if (q) toast('Drafted from the briefing', () => { unmake('reqs', q); go({ on: 'newreq', account: S.account }, true); }, miss.length ? plural(miss.length, 'thing') + ' it did not say, set to the usual. Check ' + (miss.length === 1 ? 'it' : 'them') + ' before you open it.' : 'Check it, then open it.');
  }

  /* ══ APPROVAL BY EXCEPTION (Requisitions, 29 Oct) ════════════════════════
     As Ashby and Lever do it: a requisition opens straight away unless
     something about it is an exception, and only the person who answers for
     that exception is asked. A replacement inside its band, billable, for
     one or two seats, needs nobody. The rules are said where it opens. */
  const REQ_RULES = [
    { k: 'new', who: 'hesham', test: (v) => v.kind === 'new', say: () => 'a new seat, not a replacement' },
    { k: 'seats', who: 'hesham', test: (v) => v.seats > 2, say: (v) => plural(v.seats, 'seat') + ' at once' },
    { k: 'budget', who: 'hesham', test: (v) => !!v.budget && !!BUDGETS[v.level] && v.budget.max > BUDGETS[v.level][1],
      say: (v) => 'a budget up to ' + money(v.budget.max) + ', above the ' + v.level.toLowerCase() + ' band of ' + money(BUDGETS[v.level][1]) },
    { k: 'unbilled', who: 'dina', test: (v) => !v.billable && v.acc !== 'flairs', say: () => 'a client role that is not billable' },
  ];
  const reqExceptions = (v) => REQ_RULES.filter((r) => r.test(v));
  const RULES_SAY = 'Only a new seat, more than two seats, a budget above its band or an unbilled client role needs approval.';
  /* What a requisition that needs nobody is, said when it opens. */
  const passSay = (v) => [v.kind === 'replacement' ? 'a replacement' : null, plural(v.seats, 'seat'),
    v.budget && BUDGETS[v.level] && v.budget.max <= BUDGETS[v.level][1] ? 'inside the ' + v.level.toLowerCase() + ' band' : null,
    v.acc === 'flairs' ? 'an internal role' : v.billable ? 'billable' : null].filter(Boolean).join(', ');
  const waitingOn = (a) => a.wait.filter((w) => a.ok.indexOf(w) < 0);
  const namesOf = (ids) => ids.map((w) => DESKS[w].name).join(' and ');
  function approveReq(q) {
    const a = q && q.approval;
    if (!a || a.back || waitingOn(a).indexOf(DESK) < 0) return;
    const before = { approval: a, state: q.state, opened: q.opened };
    const ok = a.ok.concat(DESK), done = a.wait.every((w) => ok.indexOf(w) >= 0);
    put('reqs', q, done ? { approval: Object.assign({}, a, { ok: ok, done: 0 }), state: 'open', opened: 0 } : { approval: Object.assign({}, a, { ok: ok }) });
    const n = done ? tellDesk(a.by, { sev: 'p1', type: 'Requisition approved', body: me().name + ' approved ' + q.title + ' for ' + accOf(q).name + '. It is open now.', cta: 'Open it', go: { req: q.id } }) : null;
    paint();
    toast(done ? 'Approved and opened: ' + q.title : 'Approved. Still waiting on ' + namesOf(waitingOn(q.approval)), () => { put('reqs', q, before); untell(n); paint(); });
  }
  function backReq(q) {
    const a = q && q.approval;
    if (!a || a.back || waitingOn(a).indexOf(DESK) < 0) return;
    const before = { approval: a };
    put('reqs', q, { approval: Object.assign({}, a, { back: DESK }) });
    const n = tellDesk(a.by, { sev: 'p1', type: 'Requisition sent back', body: me().name + ' sent back ' + q.title + ' for ' + accOf(q).name + ' because of ' + a.says.join(', and ') + '. Change it, or talk it through, then open it again.', cta: 'Open it', go: { req: q.id } });
    paint();
    toast('Sent back to ' + DESKS[a.by].name, () => { put('reqs', q, before); untell(n); paint(); }, 'It stays a draft until they open it again.');
  }
  /* The approval, said on the draft: who it waits on and why, with the two
     answers for the person it waits on. */
  function apprBanner(q) {
    const a = q.approval;
    if (!a || q.state !== 'draft') return '';
    const mineToAnswer = !a.back && waitingOn(a).indexOf(DESK) >= 0;
    const say = a.back ? '<b>' + esc(DESKS[a.back].name) + ' sent it back.</b> It needed approval because of ' + esc(a.says.join(', and ')) + '. Change that, or talk it through, then open it again.'
      : '<b>' + (mineToAnswer ? 'Waiting on you.' : 'Waiting on ' + esc(namesOf(waitingOn(a))) + '.') + '</b> ' + esc(DESKS[a.by].name) + ' asked ' + esc(sayWhen(a.day)) +
        '. It needs approval because of ' + esc(a.says.join(', and ')) + '. ' + RULES_SAY;
    return '<section class="s-insight s-block-wide t-appr" aria-label="Approval">' +
      '<div class="s-lead-mark"><svg class="s-insight-mark" viewBox="0 0 18 20" width="14" height="14" aria-hidden="true"><use href="#aimy-logo-small"/></svg>' +
        '<span class="work-state ws-detected">' + (a.back ? 'Sent back' : 'Approval by exception') + '</span></div>' +
      '<p class="s-lead-deck">' + say + '</p>' +
      (mineToAnswer ? '<div class="s-lead-acts"><button class="s-insight-lnk primary" type="button" data-req-ok="' + q.id + '">Approve' + (waitingOn(a).length === 1 ? ' and open it' : '') + '</button>' +
        '<button class="b-ghost" type="button" data-req-back="' + q.id + '">Send it back</button></div>' : '') +
    '</section>';
  }
  /* For the approver's own desk: only the exceptions reach it. */
  function approvalsBlock() {
    const list = DB.reqs.filter((q) => q.state === 'draft' && q.approval && !q.approval.back && waitingOn(q.approval).indexOf(DESK) >= 0);
    if (!list.length) return '';
    return '<section class="s-block s-block-wide" aria-label="Requisitions to approve"><div class="s-camp-list-head"><h2 class="s-block-h">Requisitions to approve</h2>' +
      '<span class="s-block-say">only the exceptions reach you</span></div>' +
      '<div class="b-log">' + list.map((q, i) => logRow({ tone: '', ico: svg('req'), who: q.title + ', ' + accOf(q).name,
        meta: logMeta([plural(q.seats, 'seat'), 'asked by ' + DESKS[q.approval.by].name, sayWhen(q.approval.day)]),
        say: 'Needs you because of ' + esc(q.approval.says.join(', and ')) + '.', aimy: true, act: 'data-req="' + q.id + '"', go: 'Open it' }, i)).join('') + '</div></section>';
  }

  /* ══ THE FORECAST ON EACH CARD (Requisitions, 29 Oct; R6) ═══════════════
     When it is likely to fill, against the date promised, and the days to
     the first profile against the seven-day target the report uses. Rule
     based, the same arithmetic as at risk: the usual days from the furthest
     person's stage to an accepted offer. */
  const FIRST_TARGET = 7;
  function forecastHtml(q, h) {
    const gap = h.left - h.need;
    const rows = [['At this pace', sayDay(h.need), h.risk ? days(-gap) + ' after the ' + sayDay(q.target) + ' target' : gap ? days(gap) + ' before the ' + sayDay(q.target) + ' target' : 'on the target', h.risk]];
    if (rank(q, 'sent') >= 0) {
      const sd = sentDays(q), age = -q.opened;
      rows.push(sd != null ? ['First profile', 'Day ' + sd, sd <= FIRST_TARGET ? 'inside the ' + FIRST_TARGET + '-day target' : days(sd - FIRST_TARGET) + ' past the ' + FIRST_TARGET + '-day target', sd > FIRST_TARGET]
        : ['First profile', 'Not yet', 'day ' + age + (age > FIRST_TARGET ? ', ' + days(age - FIRST_TARGET) + ' past the ' + FIRST_TARGET + '-day target' : ' of ' + FIRST_TARGET), age > FIRST_TARGET]);
    }
    return '<div class="t-fc">' + rows.map((r) => '<div class="t-fc-row' + (r[3] ? ' is-late' : '') + '"><span class="t-fc-cap">' + esc(r[0]) + '</span><b class="t-fc-n">' + esc(r[1]) + '</b>' +
      '<span class="t-fc-say">' + esc(r[2]) + '</span></div>').join('') + '</div>';
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
          '<p class="b-cmeta-p">' + (a.kind === 'live' ? 'A live interview with the AiMY agent' : 'A questionnaire') + ', before the phone screen. Pass ' + esc(passSayOf(a)) + '.</p>' +
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
              (q.approval && !q.approval.back ? '<span class="b-kind">Waiting for approval</span>' : '<button class="btn btn-brand btn-sm" type="button" data-open-req="' + q.id + '">Open the requisition</button>')
            : '<button class="b-ghost" type="button" data-cancel-edit>Cancel</button>' +
              '<button class="btn btn-brand btn-sm" type="button" data-save-edit="' + q.id + '">Save</button>') +
        '</span></div>' +
      apprBanner(q) +
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
      aimyBlock({ text: isDraft ? (q.from ? esc(q.from.say) + ' ' : '') + (q.approval && !q.approval.back ? '' : (function () {
          const v = reqFromBuf(q, f), ex = reqExceptions(v).filter((r) => r.who !== DESK);
          return ex.length ? 'Opening it sends it to ' + esc(namesOf(ex.map((r) => r.who).filter((x, i, a) => a.indexOf(x) === i))) + ' first, because of ' + esc(ex.map((r) => r.say(v)).join(', and ')) + '. '
            : 'Opens straight away: ' + esc(passSay(v)) + '. ';
        })()) + 'Nothing goes live until it opens, and it stays off the careers page until somebody publishes it.'
        : 'Saving changes the requisition for everyone on it. Candidates are re-read against a changed success profile.', from: q.from && q.from.kind === 'brief' ? 'your briefing, and how requisitions work' : 'how requisitions work' }) +
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
      place: q.place, acc: q.acc, hm: q.hm, domain: q.domain, tpl: q.tpl, kind: q.kind, billable: q.billable, fam: q.fam, asmt: q.asmt, budget: q.budget, state: q.state, opened: q.opened, approval: q.approval || null }));
    /* An exception goes to whoever answers for it; an approver opening
       their own exception is not asked to approve themselves. */
    const ex = open ? reqExceptions(v).filter((r) => r.who !== DESK) : [];
    if (ex.length) {
      const wait = ex.map((r) => r.who).filter((x, i, a) => a.indexOf(x) === i);
      v.approval = { day: 0, by: DESK, says: ex.map((r) => r.say(v)), wait: wait, ok: [], back: null };
      put('reqs', q, v);
      const ns = wait.map((w) => tellDesk(w, { sev: 'p1', type: 'Requisition to approve', cta: 'Open it', go: { req: q.id },
        body: me().name + ' wants to open ' + v.title + ' for ' + accOf(v).name + '. It needs you because of ' + ex.filter((r) => r.who === w).map((r) => r.say(v)).join(', and ') + '.' }));
      EDIT = null;
      go({ req: q.id }, true);
      toast('Sent to ' + namesOf(wait) + ' to approve', () => { put('reqs', q, before); ns.forEach(untell); paint(); }, 'Because of ' + v.approval.says.join(', and ') + '. Everything else opens without one.');
      return;
    }
    if (open) Object.assign(v, { state: 'open', opened: 0, target: v.target > 0 ? v.target : 30, approval: q.approval ? Object.assign({}, q.approval, { done: 0 }) : null });
    put('reqs', q, v);
    /* Candidates already on it are read again against the new profile. */
    DB.byReq[q.id].forEach((c) => { if (c.ev.length !== q.must.length) write(c, { ev: q.must.map((m, i) => c.ev[i] || 'n') }); });
    EDIT = null;
    go({ req: q.id }, true);
    toast(open ? 'Opened ' + q.title : 'Saved', () => { put('reqs', q, before); paint(); },
      open ? 'No approval needed: ' + passSay(v) + '. It is live for the team and not on the careers page yet.' : null);
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
        '<button class="proto-link" type="button" data-connect="' + (connectOn() ? 'off' : 'on') + '">' + (connectOn() ? 'Without AiMY Connect' : 'With AiMY Connect') + '</button>' +
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

  /* WHERE YOU ARE, AND HOW YOU GOT THERE (Engy, 29 Oct). Every page's
     top bar is a trail by the product's own hierarchy, not by history:
     Today / Requisitions / AI Business Analyst / Rana Tawfik. Each step up
     is a link; the page you are on is named last, set apart, and is not a
     link. Where the old Back did more than move (leaving an edit unsaved,
     a shortlist gate), the step it pointed to keeps its own handler. */
  function crumbTrail(back) {
    const up = [], add = (label, attr) => up.push({ label: label, attr: attr });
    const reqs = () => add('Requisitions', goAttr({ on: 'reqs' }).trim());
    const reqStep = (q, attr) => add(q.title || 'Untitled draft', attr || 'data-req="' + q.id + '"');
    if (S.on === 'add') { const q = S.req && DB.reqById[S.req]; if (q) { reqs(); reqStep(q); } return { up: up, now: 'Add a candidate' }; }
    if (S.on === 'find') { add('Candidates', goAttr({ on: 'cands' }).trim()); return { up: up, now: 'Find candidates' }; }
    if (S.on === 'decide') return { up: up, now: S.q === 'send' ? 'Sending profiles' : 'Deciding' };
    if (S.on === 'calls' && (S.th || S.lg)) {
      add('Interactions', goAttr({ on: 'calls' }).trim());
      return { up: up, now: S.lg ? 'Log a call from elsewhere' : (DB.byId[S.th] || {}).name || 'WhatsApp' };
    }
    if (S.on === 'newreq') { reqs(); const a = ACCOUNTS.filter((x) => x.id === S.account)[0]; return { up: up, now: 'New requisition' + (a ? ' for ' + a.name : '') }; }
    if (S.on === 'draft') { add('Candidates', goAttr({ on: 'cands' }).trim()); add('Find candidates', goAttr({ on: 'find' }).trim()); const l = S.list ? D.lists.filter((x) => x.id === S.list)[0] : DRAFT; return { up: up, now: l ? l.name : 'Shortlist' }; }
    if (S.cand && DB.byId[S.cand]) {
      const c = DB.byId[S.cand], q = reqOf(c);
      reqs(); reqStep(q);
      if (S.edit) { add(c.name, back); return { up: up, now: 'Edit' }; }
      return { up: up, now: c.name };
    }
    if (S.req && DB.reqById[S.req]) {
      const q = DB.reqById[S.req];
      reqs();
      if (q.state === 'draft') return { up: up, now: q.title || 'New requisition' };
      if (S.edit) { reqStep(q, back); return { up: up, now: 'Edit' }; }
      return { up: up, now: q.title };
    }
    if (S.asmt) { const a = asmtOf(S.asmt); add('Assessments', goAttr({ on: 'asmts' }).trim()); if (S.edit && a) { add(a.title, goAttr({ asmt: a.id }).trim()); return { up: up, now: 'Edit' }; } return { up: up, now: a ? a.title : 'Assessment' }; }
    if (S.acc) { const a = ACCOUNTS.filter((x) => x.id === S.acc)[0]; reqs(); return { up: up, now: a ? a.name : 'Account' }; }
    return null;
  }
  /* The top bar's first Back becomes the trail; the bar's own actions stay. */
  const homeCrumb = (html) => html.replace(/<div class="b-topbar s-block-wide">(?:<button class="s-back" type="button"([^>]*)>[\s\S]*?<\/button>)?/g, (m, attr) => {
    const t = crumbTrail((attr || '').trim());
    if (!t) return m;
    return '<div class="b-topbar s-block-wide"><nav class="t-crumbs" aria-label="Where you are"><ol>' +
      '<li><button class="t-crumb-link" type="button" data-home>' + svg('home', 14) + 'Today</button></li>' +
      t.up.map((u) => '<li><button class="t-crumb-link" type="button" ' + u.attr + '>' + esc(u.label) + '</button></li>').join('') +
      '<li><span class="t-crumb-now" aria-current="page">' + esc(t.now) + '</span></li></ol></nav>';
  });
  function paint() {
    /* The name a CV card hangs from is about to be redrawn. */
    cvHide();
    teamsRecs();
    CHAT_Q = {}; CHAT_N = 0;
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
    byId('wbStage').innerHTML = homeCrumb((S.on === 'add' && isRec() ? addPage() : S.on === 'find' ? findPage()
      : S.on === 'newreq' && !isClient() && !isBU() ? newReqPage()
      : S.on === 'diary' && (isRec() || isHM()) ? diaryPage()
      : S.on === 'decide' && isRec() ? decidePage()
      : S.on === 'draft' && (isRec() || isHR()) ? draftPage() : S.on === 'cands' && (isRec() || isHR()) && !S.cand ? candsPage() : S.cand ? candPage() : S.req ? reqPage() : S.asmt ? asmtPage() : S.acc ? accPage()
      : S.on === 'reqs' ? reqsPage() : S.on === 'calls' && isRec() ? callsPage()
      : S.on === 'asmts' ? asmtsPage() : S.on === 'templates' ? templatesPage()
      : S.on === 'reports' ? reportsPage() : deskHome()));
    paintRail();
    paintBell();
    paintProto();
    paintDial();
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
      sentDay: c.sentDay, openDay: c.openDay, decideDay: c.decideDay, writeup: c.writeup || null, took: c.took || {} };
    const q = reqOf(c);
    /* The days at the stage being left are kept, for stage health. */
    const took = Object.assign({}, c.took);
    took[c.stage] = c.since;
    const fields = { stage: to, since: 0, fb: false, nudged: null, took: took,
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
    const was = { exit: c.exit, since: c.since, told: c.told, outWhy: c.outWhy || null, took: c.took || {} };
    const took = Object.assign({}, c.took);
    took[c.stage] = c.since;
    write(c, { exit: k, since: 0, took: took, told: NEEDS_TELLING[k] ? false : null, outWhy: why ? { why: why, note: line || '', day: 0, by: DESK } : null });
    const e = note(c, 'out', EXIT[k].label + (why ? ': ' + lower(OUT_K[why].label) + (line ? ', “' + line + '”' : '') : '') + ', marked by ' + me().name + '.');
    OUTING = null;
    paint();
    toast(first(c.name) + ': ' + EXIT[k].label.toLowerCase() + (why ? ', ' + lower(OUT_K[why].label) : ''), () => { write(c, was); unmake('events', e); paint(); toast('Put back', null, c.name + ' is in progress again.'); },
      NEEDS_TELLING[k] ? 'Nothing goes to them yet. A person sends the answer within ' + TELL_DAYS + ' days, from Not told yet on Today.' : null);
  }
  function nudge(c) {
    if (c.nudged != null) return;
    write(c, { nudged: 0 });
    const w = waitsOn(c), v = ivNow(c), q = reqOf(c);
    /* A client is nudged by email, and on Northwind's desk it is in Jana's bell too. */
    const n = w === 'client' && accOf(q).id === 'northwind' ? tellDesk('jana', { sev: 'p1', type: 'A profile waits on you', cta: 'Open ' + first(c.name), go: { cand: c.id },
      body: c.name + ' for ' + q.title + ', sent ' + sayDay(c.sentDay != null ? c.sentDay : -c.since) + '. Meet them, or pass with a reason.' }) : null;
    paint();
    toast(nudgeSay(c).replace('Nudge', 'Nudged'), () => { write(c, { nudged: null }); untell(n); paint(); },
      w === 'client' ? '“Hi ' + nudgeTo(c) + ', a reminder about ' + c.name + '’s profile for ' + q.title + ', sent ' + sayDay(c.sentDay != null ? c.sentDay : -c.since) + '. Meet them, or pass with a reason.” By email.'
      : w === 'candidate' ? 'About ' + c.name + '. Logged on the requisition.'
        : '“Hi ' + nudgeTo(c) + ', ' + first(c.name) + '’s ' + lower(STAGE[c.stage].label) + (v ? ' was ' + sayWhen(v.day) : ' result is still owed') + '. Your result takes about two minutes: the debrief link is here.”');
  }

  function start(k) {
    const d = decisions();
    /* Both open the run from its start (Engy, 5 Nov). */
    if (k === 'decide' && d.length) { RUN = null; return go({ on: 'decide' }); }
    if (k === 'send') { RUN = null; return runList('send').length ? go({ on: 'decide', q: 'send' }) : go({ on: 'reqs', q: 'mine' }); }
    if (k === 'screen') { const l = toCall(); return l.length ? callAll(l.slice(0, runN(l.length)).map((x) => x.c.id)) : go({ on: 'calls' }); }
    if (k === 'risk') return go({ on: 'reqs', q: 'risk' });
    if (k === 'find') return findChat(null, '');
    go({});
  }

  /* THE RAIL AS A DRAWER, below 1080px (sales.css). Its button had no
     handler, which mattered once the tabs moved into the rail: on a narrow
     screen it is the only way to another page. Picking an entry, the scrim
     or Escape closes it. Every row and reading in it is a way out of it
     (Sales: railOpen(false) on every move). */
  function railDrawer(on) {
    const rail = byId('appRail');
    rail.classList.toggle('is-open', on);
    byId('railScrim').classList.toggle('is-open', on);
    byId('railToggle').setAttribute('aria-expanded', String(on));
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') railDrawer(false); });
  document.addEventListener('click', (e) => {
    const t = e.target;
    const at = (sel) => t.closest(sel);
    let el;
    if (at('#railToggle')) { railDrawer(!byId('appRail').classList.contains('is-open')); return; }
    if (at('#railScrim')) { railDrawer(false); return; }
    if (at('.snav-tab-link, .snav-read-act, .rail-doors .b-door')) railDrawer(false);
    if ((el = at('[data-undo]'))) { const u = UNDO; toastGone(); if (u) u(); return; }
    /* ── The canvas ── */
    if (at('#canvasOpen')) { if (canvasShown()) closeCanvas(); else openCanvas(); return; }
    if (at('#peekOpen')) { openCanvas(); return; }
    if (at('[data-overlay-close]')) { closeCanvas(); return; }
    if (at('#ovChatsToggle')) { chatsDrawer(!byId('overlayChats').classList.contains('is-open')); return; }
    if (at('#ovChatsScrim')) { chatsDrawer(false); return; }
    if (at('#overlaySend')) { canvasAsk(byId('overlayInput').value); return; }
    /* An insight's button: the chat opens with its question and the answer. */
    if ((el = at('[data-chat]'))) { const a = CHAT_Q[el.getAttribute('data-chat')]; if (!a) return; flyToBar(el, () => { if (!canvasShown()) openCanvas(); ASKING = a.q; peek(a.html, a.acts); }); return; }
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
    if ((el = at('[data-new-req]'))) { go({ on: 'newreq', account: val('data-new-req') || undefined }); return; }
    if ((el = at('[data-new-blank]'))) { newReq({ acc: S.account || undefined }); return; }
    if ((el = at('[data-replace]'))) { replaceFrom(DB.past.filter((p) => p.id === val('data-replace'))[0]); return; }
    if ((el = at('[data-brief-read]'))) { fromBrief((byId('briefText') || {}).value || ''); return; }
    if ((el = at('[data-req-ok]'))) { approveReq(DB.reqById[val('data-req-ok')]); return; }
    if ((el = at('[data-req-back]'))) { backReq(DB.reqById[val('data-req-back')]); return; }
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
    if ((el = at('[data-rq]'))) {
      /* On Reports the position menu sits low on the page; choosing one keeps your place. */
      const y = S.on === 'reports' ? byId('pageScroll').scrollTop : 0;
      go(Object.assign({}, S, { rq: val('data-rq') || null, p: null }), true);
      if (y) byId('pageScroll').scrollTop = y;
      return;
    }
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
    if ((el = at('[data-tell-all]'))) { tell(val('data-tell-all').split(',')); return; }
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
      toast('Nudged ' + first(v.by.split(',')[0]) + ' on Teams', () => { put('ivs', v, { nudged: false }); paint(); }, 'With the debrief link. Logged on the interview.');
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
    if ((el = at('[data-find-req]'))) { const k = val('data-find-req'); FIND.req = FIND.req === k ? null : k; FIND.mode = 'req'; FIND.step = 'ask'; paint(); return; }
    if ((el = at('[data-find-mode]'))) { const m = val('data-find-mode'); FIND.mode = m; FIND.step = 'ask'; if (m !== 'req') FIND.req = m === 'like' && pastOf(FIND.like) ? (reqFor(pastOf(FIND.like)) || {}).id || null : null; paint(); return; }
    if ((el = at('[data-find-like]'))) { const p = pastOf(val('data-find-like')); FIND.like = p.id; FIND.req = (reqFor(p) || {}).id || null; FIND.step = 'ask'; paint(); return; }
    if ((el = at('[data-crit-need]'))) { const p = two('data-crit-need'); critList()[Number(p[0])].need = p[1] === '1'; paint(); return; }
    if ((el = at('[data-crit-del]'))) { critList().splice(Number(val('data-crit-del')), 1); paint(); return; }
    if ((el = at('[data-crit-add]'))) { const v = ((byId('critNew') || {}).value || '').trim(); if (!v) { byId('critNew').focus(); return; } critList().push({ t: v, need: false }); paint(); const n = byId('critNew'); if (n) n.focus(); return; }
    if ((el = at('[data-find-flag]'))) { const i = Number(val('data-find-flag')); FIND.flagOpen = FIND.flagOpen === i ? null : i; paint(); return; }
    if ((el = at('[data-find-flagwhy]'))) { const p = two('data-find-flagwhy'); flagFind(Number(p[0]), p[1]); return; }
    if ((el = at('[data-find-save]'))) { saveSearch(); return; }
    if ((el = at('[data-search-run]'))) { runSearch(val('data-search-run')); return; }
    if ((el = at('[data-search-del]'))) { delSearch(val('data-search-del')); return; }
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
      else if (p[0] === 'level') asmtSet(a, { level: p[1] });
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
    if ((el = at('[data-take-consent]'))) { TAKE.consent = val('data-take-consent'); TAKE.t0 = Date.now(); TAKE.away = 0; TAKE.paste = {}; paint(); return; }
    if ((el = at('[data-take-practice]'))) { TAKE.practiced = true; paint(); return; }
    if ((el = at('[data-take-review]'))) { const x = DB.sends.filter((y) => y.id === val('data-take-review'))[0]; put('sends', x, { review: 'asked' }); paint(); return; }
    if ((el = at('[data-asmt-review]'))) {
      const x = DB.sends.filter((y) => y.id === val('data-asmt-review'))[0], a = asmtOf(x.asmt), was = x.reviewed || null;
      put('sends', x, { reviewed: { by: DESK, day: 0 } });
      const e = note(DB.byId[x.cand], 'asmt', 'Score confirmed by ' + me().name + ': ' + scoreSay(a, x) + '.');
      paint();
      toast('Confirmed ' + scoreShort(a, x), () => { put('sends', x, { reviewed: was }); unmake('events', e); paint(); }, 'It counts now. They are not told the score; they hear the decision.');
      return;
    }
    if ((el = at('[data-asmt-check]'))) {
      const p = two('data-asmt-check'), a = asmtOf(p[0]), on = !a[p[1]];
      asmtSet(a, { [p[1]]: on }, (p[1] === 'practice' ? (on ? 'Practice question added' : 'Practice question taken off') : on ? 'Everyone hears how they did' : 'No note after'));
      return;
    }
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
    if ((el = at('[data-call-all]'))) { const l = toCall(); callAll(l.slice(0, runN(l.length)).map((x) => x.c.id)); return; }
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
    /* Prepare me travels to the bar like an insight's question, then the
       brief opens in the chat (find-animation-opportunities, 29 Oct). */
    if ((el = at('[data-prep]'))) { const c = DB.byId[val('data-prep')]; flyToBar(el, () => prepMe(c)); return; }
    if ((el = at('[data-cb]'))) { if (PENDING) { PENDING.cb = val('data-cb'); paintThread(); } return; }
    if ((el = at('[data-fu]'))) { if (PENDING) { PENDING.fu = !fuOn(PENDING); paintThread(); } return; }
    if ((el = at('[data-runn]'))) { UI.runN = Number(val('data-runn')); saveUI(); paint(); return; }
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
      if (p[1] === 'sent' && !isClient()) { wuChat(c, S.on === 'decide' ? { on: 'decide', q: S.q } : null); return; }
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
    if ((el = at('[data-diary-day]'))) { const v = val('data-diary-day'); go(Object.assign({}, S, { day: v === '0' ? null : v }), true); return; }
    if ((el = at('[data-nudge]'))) { nudge(DB.byId[el.getAttribute('data-nudge')]); return; }
    if ((el = at('[data-start]'))) { start(el.getAttribute('data-start')); return; }
    /* ── Interactions: WhatsApp and calls made elsewhere ── */
    if ((el = at('[data-teams-join]'))) { try { window.open('https://teams.microsoft.com/l/meetup-join/' + val('data-teams-join'), '_blank', 'noopener'); } catch (e) {} toast('Opening the meeting in Teams', null, 'Teams tells them it is recording; the recording comes back here when it ends.'); return; }
    if ((el = at('[data-hist-tab]'))) { HIST_TAB = val('data-hist-tab'); paint(); return; }
    if ((el = at('[data-book-chat]'))) { bookChat(DB.byId[val('data-book-chat')] || null, null, !!el.closest('#overlayThread')); return; }
    if ((el = at('[data-draft-chat]'))) { draftChat(DB.byId[val('data-draft-chat')], ''); return; }
    if ((el = at('[data-bk-slot]'))) { const p = val('data-bk-slot').split('|'), t = turnById(p[0]); if (t && !t.done) { t.d = Number(p[1]); t.t = p[2]; saveChats(); paintThread(); } return; }
    if ((el = at('[data-bk-mode]'))) { const p = val('data-bk-mode').split('|'), t = turnById(p[0]); if (t && !t.done) { t.mode = p[1]; saveChats(); paintThread(); } return; }
    if ((el = at('[data-bk-go]'))) { const t = turnById(val('data-bk-go')); if (t) bookGo(t); return; }
    if ((el = at('[data-wu-go]'))) { const t = turnById(val('data-wu-go')); if (t) wuGo(t); return; }
    if ((el = at('[data-dr-go]'))) { const t = turnById(val('data-dr-go')); if (t) draftGo(t); return; }
    if ((el = at('[data-lg-o]'))) { const p = val('data-lg-o').split('|'), t = turnById(p[0]); if (t && !t.done) { t.lit = t.lit === p[1] ? null : p[1]; saveChats(); paintThread(); } return; }
    if ((el = at('[data-lg-go]'))) { const t = turnById(val('data-lg-go')); if (t) logSayGo(t); return; }
    if ((el = at('[data-turn-leave]'))) { const t = turnById(val('data-turn-leave')); if (t && !t.done) { doneTurn(t, 'Left it. Nothing was ' + (t.kind === 'book' ? 'booked or sent.' : t.kind === 'draft' || t.kind === 'wu' ? 'sent.' : 'logged.')); paintThread(); } return; }
    if ((el = at('[data-connect]'))) { setConnect(val('data-connect') === 'on'); return; }
    if ((el = at('[data-wa-open]'))) { openWa(DB.byId[val('data-wa-open')]); return; }
    if ((el = at('[data-wa-addgo]'))) { addWaReply(DB.byId[val('data-wa-addgo')]); return; }
    if ((el = at('[data-wa-add]'))) { WA_ADD = val('data-wa-add') || null; paint(); const r = byId('waReply'); if (r) r.focus(); return; }
    if ((el = at('[data-wa-send]'))) { sendWa(DB.byId[val('data-wa-send')]); return; }
    if ((el = at('[data-wa-tpl]'))) { const k = val('data-wa-tpl'); WA_TPL_ON = WA_TPL_ON === k ? null : k; paint(); return; }
    if ((el = at('[data-wa-done]'))) { const id = val('data-wa-done'); D.waDone[id] = 1; save(); paint(); toast('Set aside: it needs no reply', () => { delete D.waDone[id]; save(); paint(); }); return; }
    if ((el = at('[data-el-consent]'))) { if (EL) { EL.consent = !EL.consent; paint(); } return; }
    if ((el = at('[data-el-log]'))) { logElsewhere(); return; }
    if ((el = at('[data-el]'))) {
      const p = val('data-el').split('|');
      if (EL) { if (p[0] === 'via') EL.via = p[1]; if (p[0] === 'who') { EL.cand = p[1]; EL.read = null; EL.rec = null; EL.consent = false; } if (p[0] === 'day') EL.day = Number(p[1]); if (p[0] === 'o') EL.lit = EL.lit === p[1] ? null : p[1];
        const t = byId('elTime'); if (t) EL.time = t.value; paint(); }
      return;
    }
    if ((el = at('[data-run-skip]'))) { if (RUN) RUN.skip[el.getAttribute('data-run-skip')] = 1; paint(); return; }
    if ((el = at('[data-run-again]'))) { if (RUN) RUN.skip = {}; paint(); return; }
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
    /* A stage on a funnel opens who is at it now: below it on a
       requisition, on the one requisition a report is narrowed to, or in
       the Candidates queue from a report across many. */
    if ((el = at('[data-fdrill]'))) {
      const p = el.getAttribute('data-fdrill').split('|'), k = p[0], rq = p[1];
      if (!rq && !S.req) { go({ on: 'cands', st: k }); return; }
      if (rq) go({ req: rq, q: k }); else go(Object.assign({}, S, { q: k }), true);
      const cs = document.querySelector('section[aria-label="Candidates"]');
      if (cs) cs.scrollIntoView({ block: 'start' });
      return;
    }
    if ((el = at('[data-q]'))) { go(Object.assign({}, S, { q: el.getAttribute('data-q') }), true); return; }
    /* The report's view: 90 days and every account are the plain link. */
    /* ── Reports: a chapter from the contents line, the recap, nudging a lane ── */
    if ((el = at('[data-story]'))) { storyAsk(el, val('data-story')); return; }
    if ((el = at('[data-recap-copy]'))) {
      const done = () => toast('The recap is copied', null, 'Paste it into an email or a chat.');
      if (navigator.clipboard) navigator.clipboard.writeText(RECAP).then(done, () => toast('Could not copy', null, 'Select the slides and copy them instead.')); else done();
      return;
    }
    if ((el = at('[data-nudge-all]'))) {
      const cs = val('data-nudge-all').split(',').map((id) => DB.byId[id]).filter((c) => c && c.nudged == null);
      cs.forEach((c) => write(c, { nudged: 0 }));
      paint();
      toast('Nudged about ' + plural(cs.length, 'person', 'people'), () => { cs.forEach((c) => write(c, { nudged: null })); paint(); }, 'Each one is logged on its requisition.');
      return;
    }
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
      document.querySelectorAll('.t-rpt-menu:not([hidden])').forEach((x) => { if (x !== m) { x.hidden = true; x.previousElementSibling.setAttribute('aria-expanded', 'false'); } });
      m.hidden = !m.hidden; el.setAttribute('aria-expanded', String(!m.hidden)); return;
    }
    if ((el = at('[data-req]'))) { go({ req: el.getAttribute('data-req') }); return; }
    if ((el = at('[data-go]'))) { go(JSON.parse(el.getAttribute('data-go'))); return; }
    /* The whole card is a door, written as the trailing fallback so any
       control inside it wins (Sales's rule). */
    if ((el = at('[data-open]'))) { const p = el.getAttribute('data-open').split(':'); if (p[0] === 'req') go({ req: p[1] }); else if (p[0] === 'cand') go({ cand: p[1] }); return; }
    /* A click outside the bell, the dialer or an open menu closes it. */
    if (!at('#ntfPanel') && !at('#ntfBell')) { const p = byId('ntfPanel'); if (!p.hidden) { p.hidden = true; byId('ntfBell').setAttribute('aria-expanded', 'false'); } }
    if (!at('#dialAnchor')) closeDial();
    if (!at('.b-menu-wrap')) document.querySelectorAll('.tel-menu').forEach((m) => { m.hidden = true; });
    /* The scope's menus close on a press anywhere but the one that is open. */
    document.querySelectorAll('.t-rpt-menu:not([hidden])').forEach((m) => { if (!m.parentNode.contains(e.target)) { m.hidden = true; m.previousElementSibling.setAttribute('aria-expanded', 'false'); } });
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
    /* Only the criteria are redrawn, so a press on Find candidates that
       ends the typing still lands. */
    if (e.target.matches('[data-find-q]')) { const b = byId('findCrit'); if (b) b.outerHTML = critBlock(); }
    if (e.target.matches('[data-apply-file]')) applyRead(f ? f.name : null);
    if (e.target.matches('[data-el-file]')) elRead(f ? f.name : null);
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    const g = (n) => t.getAttribute(n);
    if (t.matches('[data-ed]') && EDIT) { EDIT.f[g('data-ed')] = t.value; return; }
    if (t.matches('[data-dr-text]')) { const x = turnById(g('data-dr-text')); if (x && !x.done) { x.text = t.value; saveChats(); } return; }
    if (t.matches('[data-in]') && INTAKE && INTAKE.f) { INTAKE.f[g('data-in')] = t.value; return; }
    if (t.matches('[data-find-q]')) { FIND.q = t.value; return; }
    if (t.matches('[data-crit-ed]')) { const c = critList()[Number(g('data-crit-ed'))]; if (c) c.t = t.value; return; }
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
  /* What happens while a test is open, kept as it happened, for the
     integrity line: an answer pasted in, the page left. */
  document.addEventListener('paste', (e) => {
    if (!TAKE || !TAKE.t0) return;
    const t = e.target;
    if (t.matches && t.matches('[data-anstext]')) TAKE.paste[Number(t.getAttribute('data-anstext'))] = true;
    else if (t.id === 'liveIn') TAKE.paste[liveAt().i] = true;
  });
  document.addEventListener('visibilitychange', () => { if (TAKE && TAKE.t0 && document.hidden) TAKE.away = (TAKE.away || 0) + 1; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'critNew') { e.preventDefault(); const b = document.querySelector('[data-crit-add]'); if (b) b.click(); } });
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
    if (e.key === 'Escape' && CV_ON) { cvHide(); return; }
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
  /* A shared link to one chapter of the reports opens on it. */
  if (S.ch) { const k = S.ch; delete S.ch; history.replaceState(null, '', urlOf(S)); toChapter(k, true); }
  window.TALENT ={ DB: DB, S: S, decisions: decisions, waits: waits, health: health, funnel: funnel };
})();

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
  const lower = (t) => /^[A-Z]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);

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
    skip: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
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
    out.when = /\btomorrow\b/i.test(t) ? 1 : /\bnext week\b/i.test(t) ? 7 : null;
    return out;
  }
  /* A stranger's name, read off what they said (Sales's READ_WHO, cut down). */
  function readWho(lines) {
    const said = lines.filter((l) => l[0] === 'them').map((l) => l[1]).join(' ');
    const m = /(?:[Mm]y name is|[Yy]ou are speaking to|[Tt]his is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+){1,2})/.exec(said);
    return m ? m[1] : null;
  }


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

  const DB = { reqs: [], cands: [], byReq: {}, byId: {}, reqById: {}, calls: [] };

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
      T(c, i ? -1 : 0, { dir: 'in', missed: true, outcome: 'noanswer', time: i === 0 ? '12:05' : i === 1 ? '17:20' : '15:10', note: 'They called. Nobody picked up.' });
    });
  }


  /* ══ 4. THE STORE ═══════════════════════════════════════════════════════
     The delta, never the corpus. `D.c[id]` holds the fields a person changed
     on one candidate; `D.log` is the record of moves, newest last. */
  const KEY = 'aimy-talent:db:v1';
  /* `calls` are the calls you logged, appended to the seed's history.
     `added` are candidates a call brought in (a stranger who rang). */
  const fresh = () => ({ c: {}, calls: [], added: [] });
  let D = fresh();
  function load() {
    try { const s = localStorage.getItem(KEY); if (s) D = JSON.parse(s); } catch (e) { D = fresh(); }
    if (!D || !D.c) D = fresh();
    D.calls = D.calls || []; D.added = D.added || [];
    D.added.forEach((c) => { if (!DB.byId[c.id] && DB.byReq[c.req]) { DB.cands.push(c); DB.byId[c.id] = c; DB.byReq[c.req].push(c); } });
    Object.keys(D.c).forEach((id) => { if (DB.byId[id]) Object.assign(DB.byId[id], D.c[id]); });
    D.calls.forEach((t) => DB.calls.push(t));
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }
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
  function dropCand(c) {
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
  const KEYS = ['on', 'req', 'cand', 'q', 'find'];
  function parse() {
    const p = new URLSearchParams(location.search);
    S = {};
    KEYS.forEach((k) => { if (p.get(k)) S[k] = p.get(k); });
    if (S.req && !DB.reqById[S.req]) delete S.req;
    if (S.cand && !DB.byId[S.cand]) delete S.cand;
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
        ' is likely to miss its date: <b>' + days(h.left) + '</b> left, and the furthest candidate is at the ' + esc(lower(STAGE[h.furthest].label)) + '.');
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
    const ready = d.filter((c) => c.stage === 'tech' && reqOf(c).tpl === 'client');
    const starts = [
      { k: 'decide', label: 'Decide the oldest one', n: d.length, why: oldest ? oldest.name + ', ' + lower(STAGE[oldest.stage].label) : 'nothing is waiting' },
      { k: 'send', label: 'Send profiles', n: ready.length, why: ready.length ? 'technical results are in for ' + plural(ready.length, 'candidate') : 'none ready yet' },
      { k: 'screen', label: 'Call the next one', n: tc.length, why: tc.length ? tc[0].c.name + (tc[0].why === 'callback' ? ' asked for a callback' : ', ' + lower(STAGE[tc[0].c.stage].label)) : 'nobody is waiting' },
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
      { k: 'calls', label: 'Calls', n: toCall().length },
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
      esc(lower(STAGE[h.furthest].label)) + ', and from there an accepted offer usually takes <b>' + days(h.need) + '</b>.';
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
      : ws ? '<b>' + ws.m + ' of ' + ws.n + '</b> moved on from the ' + esc(lower(STAGE[ws.from].label)) + ', the biggest drop here.'
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
      : ws ? 'The biggest drop is after the ' + lower(STAGE[ws.from].label) + ': ' + ws.m + ' of ' + ws.n + ' moved on.'
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
      (ws ? aimyBlock({ text: '<b>' + Math.round(ws.rate * 100) + '%</b> got past the ' + esc(lower(STAGE[ws.from].label)) + ', the lowest of any stage on this requisition.', from: 'every candidate on it' }) : '') +
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
      '<div class="b-qcard-top"><button class="tc-title s-card-title" type="button" data-cand="' + c.id + '">' + esc(c.name) + '</button></div>' +
      '<p class="tc-summary b-qcard-role">' + esc(c.at) + '</p>' +
      '<p class="b-qcard-where">' + fact('job', plural(c.years, 'year') + ' of experience') + fact('pin', c.place) + '</p>' +
      '<p class="b-qcard-where">' + fact('lang', c.langs.join(', ')) + '</p>' +
      aimyBlock({ text: esc(say) + ' ' + evSay(c) + '.', from: 'the CV, read against the success profile' }) +
      /* AT THE SCREEN, THE CALL IS THE MOVE. Someone who applied or is due a
         phone screen moves forward by being called and the call being
         logged, so the card's one verb is Call, not a stage button. */
      (!c.exit && (c.stage === 'applied' || c.stage === 'phone') ? '<div class="tc-gov b-qcard-foot">' +
        '<button class="b-ghost" type="button" data-out="' + c.id + '|out">' + esc(EXIT.out.label) + '</button>' +
        (canCall(c) ? '<button class="s-insight-lnk primary" type="button" data-call="' + c.id + '">' + svg('phone', 14) + 'Call ' + esc(first(c.name)) + '</button>'
          : '<span class="b-kind">' + esc(c.dnc ? 'Asked not to be called' : 'Number did not work') + '</span>') +
      '</div>'
      : canMove ? '<div class="tc-gov b-qcard-foot">' +
        '<button class="b-ghost" type="button" data-out="' + c.id + '|' + outK + '">' + esc(EXIT[outK].label) + '</button>' +
        '<button class="s-insight-lnk primary" type="button" data-move="' + c.id + '|' + nx + '">' + esc(goSay(c)) + '</button>' +
      '</div>' : '') +
    '</article>';
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
    if (CALL && CALL.state === 'logging') { toast('Log the last call first.'); return true; }
    if (CALL) { toast('You are already on a call. One line at a time.'); return true; }
    if (RINGING) { toast('Your phone is ringing. Answer it or let it go first.'); return true; }
    return false;
  };

  function startCall(id, sess) {
    const c = DB.byId[id];
    if (!c || busy()) return false;
    if (c.dnc) { toast(c.name + ' asked not to be called again.'); return false; }
    if (c.badNumber) { toast('The number on file for ' + c.name + ' did not work.'); return false; }
    clearCallTimers();
    CALL = { cand: id, state: 'ready', secs: 0, dir: 'out', from: UI.line, phone: c.phone,
      script: scriptFor(c), shown: 0, note: '', recording: false, asking: false, muted: false,
      held: false, sess: sess || null, lit: null, read: null };
    document.body.classList.add('is-calling');
    callMin(false);
    paintCall();
    return true;
  }
  function callGo() {
    const c = CALL;
    if (!c || c.state !== 'ready') return;
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

  /* Hanging up turns the panel into the log. A call stopped while it was
     still connecting is a call nobody answered. */
  function endCall() {
    const c = CALL;
    if (!c || c.state === 'ready' || c.state === 'logging') return;
    clearCallTimers();
    const wasDialing = c.state === 'connecting';
    c.state = 'logging';
    c.read = c.recording && c.shown ? readCall(heardText(c)) : { outcome: null, notice: null, salary: null, when: null };
    c.lit = wasDialing ? 'noanswer' : c.read.outcome || (c.dir === 'in' && c.cand ? 'reached' : null);
    if (!c.cand) c.who = readWho(c.script.slice(0, c.shown));
    callMin(false);
    paintCall();
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
      callback: 'Logs the call and puts them back in your calls ' + ((call.read && call.read.when) === 7 ? 'next week.' : 'tomorrow.'),
      noanswer: 'Logs an attempt. They stay in your calls.',
      notfit: 'Logs the call and takes them out as not a fit. Nothing is sent to them until a person approves the message.',
      withdrew: 'Logs the call and takes them out: they are not interested.',
      wrong: 'Logs the call and marks the number as not working.',
      dnc: 'Logs the call and takes them out. Nobody calls this number again.',
    }[o];
  }

  function logCall(stop) {
    const call = CALL;
    if (!call || call.state !== 'logging') return;
    const o = call.lit;
    if (!o) { toast('Pick what happened first.'); return; }
    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const rd = call.read || {};
    const t = { id: 'u' + Date.now().toString(36), cand: call.cand || null, phone: call.phone, who: call.who || null,
      day: 0, time: time, dir: call.dir, secs: call.secs, outcome: o, by: ME, missed: false, from: call.dir === 'out' ? call.from : null,
      note: call.note || (rd.notice || rd.salary ? 'Said on the call: ' + [rd.notice, rd.salary ? 'expects ' + rd.salary : null].filter(Boolean).join(', ') + '.'
        : call.dir === 'in' ? 'They called in.' : OUTCOME[o].label + '.'),
      lines: call.recording ? call.script.slice(0, call.shown).map((l) => ({ who: l[0], text: l[1] })) : [] };
    const c = DB.byId[call.cand];
    let undo, said;
    if (c) {
      const q = reqOf(c);
      const before = { stage: c.stage, since: c.since, exit: c.exit, maxAt: c.maxAt, callback: c.callback, notice: c.notice,
        salary: c.salary, dnc: c.dnc, badNumber: c.badNumber, fb: c.fb, meet: c.meet, slot: c.slot };
      const f = { callback: null };
      if (rd.notice) f.notice = rd.notice;
      if (rd.salary) f.salary = rd.salary;
      let moved = null;
      if (o === 'passed' && rank(q, c.stage) <= rank(q, 'phone')) {
        moved = 'hr';
        Object.assign(f, { stage: 'hr', since: 0, meet: 2, slot: '11:00', fb: false, maxAt: rank(q, 'hr') > rank(q, c.maxAt) ? 'hr' : c.maxAt });
      }
      if (o === 'callback') f.callback = rd.when || 1;
      if (o === 'noanswer') f.callback = c.callback;
      if (o === 'notfit') Object.assign(f, { exit: 'out', since: 0 });
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
    closeCall();
    paint();
    toast(said, undo);
    if (sess && !stop) advance(sess, was);
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
    const sess = { ids: live, done: [], skipped: [] };
    if (startCall(live[0], sess)) callGo();
  }
  function advance(sess, was) {
    if (was && sess.done.indexOf(was) < 0) sess.done.push(was);
    const next = sess.ids.filter((id) => sess.done.indexOf(id) < 0 && sess.skipped.indexOf(id) < 0 && canCall(DB.byId[id]))[0];
    if (!next) { toast('That is everyone', null, plural(sess.done.length, 'call') + ' logged' + (sess.skipped.length ? ', ' + sess.skipped.length + ' skipped.' : '.')); return; }
    if (startCall(next, sess)) callGo();
  }
  function skipCall() {
    const call = CALL;
    if (!call || !call.sess || call.state !== 'ready') return;
    call.sess.skipped.push(call.cand);
    const sess = call.sess;
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

  /* What to get on this call, before it starts. */
  function prepHtml(c) {
    const q = reqOf(c);
    /* Silent means Not evidenced; Partly met is said apart from it. */
    const silent = q.must.filter((m, i) => c.ev[i] === 'n');
    const partly = q.must.filter((m, i) => c.ev[i] === 'p');
    const last = lastCall(c);
    const what = c.callback != null && c.callback <= 0 ? 'They asked to be called back today. ' : '';
    const early = rank(q, c.stage) <= rank(q, 'phone');
    return '<div class="b-prep">' +
      '<p class="b-prep-id">' + esc(q.title) + ' · ' + esc(accOf(q).name) + '</p>' +
      '<blockquote class="b-open"><span class="b-open-cap">What to get</span>' +
        '<p class="b-open-say">' + esc(what) + (early
          ? 'Their notice, the salary they expect' + (silent.length ? ', and what the CV is silent on: ' + esc(silent.join('; ')) + '.' : '.') +
            (partly.length ? ' The CV only partly shows: ' + esc(partly.join('; ')) + '.' : '')
          : 'A follow-up. They are at the ' + esc(lower(STAGE[c.stage].label)) + ', and nothing on this call moves their stage.') + '</p>' +
      '</blockquote>' +
      (last ? '<p class="b-prep-line">' + esc(callSay(last)) + (last.note && !last.missed ? ' ' + esc(last.note) : '') + '</p>' : '') +
    '</div>';
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
          : st === 'logging' ? '<span class="call-timer">Ended · ' + fmtClock(call.secs) + '</span>' : '') +
        (sess ? '<span class="call-of">' + at + ' of ' + sess.ids.length + '</span>' : '') +
      '</div></div>' +
      '<p class="call-sub">' + esc(sub) + '</p>' +
      '<p class="call-num">' + esc(call.phone) + '</p>' +
      (call.dir === 'in' ? '<p class="call-from-on">They called you</p>'
        : st !== 'ready' && from ? '<p class="call-from-on">From ' + esc(from.num) + ', ' + esc(from.cc) + '</p>' : '') +
    '</div>';

    if (st === 'logging') {
      const rd = call.read || {};
      const heard = call.recording && call.shown;
      const facts = [['What happened', call.lit ? OUTCOME[call.lit].label : 'Not picked yet', call.lit ? 'ok' : 'warn']];
      if (rd.notice) facts.push(['Notice', rd.notice, 'neutral']);
      if (rd.salary) facts.push(['Expects', rd.salary, 'neutral']);
      return head +
        '<div class="call-lines t-call-log" id="callLines">' +
          aimyBlock({ text: heard ? (rd.outcome ? 'I heard <b>' + esc(OUTCOME[rd.outcome].label.toLowerCase()) + '</b>' +
              (rd.notice || rd.salary ? ', with ' + esc([rd.notice, rd.salary ? 'expects ' + rd.salary : null].filter(Boolean).join(' and ')) : '') + '. Is that right?'
              : 'I could not tell how it went from what was said. Pick it below.')
            : 'Nothing was recorded, so I have nothing to read. Pick what happened, or type it.' }, true) +
          '<div class="s-callsum"><div class="s-callsum-rows">' + facts.map((f) => '<div class="s-callsum-row">' +
            '<span class="s-callsum-cap">' + esc(f[0]) + '</span><span class="s-callsum-val tone-' + f[2] + '">' + esc(f[1]) + '</span></div>').join('') +
          '</div>' +
          (heard ? '<details class="s-trace"><summary class="s-trace-sum">Transcript<span class="s-trace-n">' + call.shown + '</span></summary>' +
            '<div class="s-said-lines">' + transcriptHtml(call) + '</div></details>' : '') +
          '</div>' +
          /* Inside the scrolling region, so the Log button below is never
             pushed out of a short panel. */
          '<div class="b-cuts t-log-row" role="group" aria-label="What happened">' + OUTCOMES.map((o) =>
            '<button class="filter-chip' + (call.lit === o.k ? ' active' : '') + '" type="button" data-outcome="' + o.k + '" aria-pressed="' + (call.lit === o.k) + '">' +
              '<span class="t-key" aria-hidden="true">' + OUTCOME[o.k].n + '</span>' + esc(o.label) + '</button>').join('') + '</div>' +
          '<input class="dial-input t-log-note" id="callNote" type="text" autocomplete="off" spellcheck="false" ' +
            'placeholder="Say what happened, or correct me" aria-label="Say what happened" value="' + esc(call.note) + '">' +
          '<p class="t-log-will">' + esc(willSay(call)) + '</p>' +
        '</div>' +
        '<div class="call-tools t-log-acts">' +
          (!c && call.who ? '<button class="btn btn-ghost btn-sm" type="button" data-add-stranger>Add ' + esc(first(call.who)) + ' as a candidate</button>' : '') +
          /* Calling down a list, the way out is always one press away. */
          (sessNext(call) ? '<button class="btn btn-ghost btn-sm" type="button" data-log="stop">Log it and stop</button>' : '') +
          '<button class="btn btn-brand btn-sm" type="button" data-log>' + esc(sessNext(call) ? 'Log it and call ' + first(sessNext(call).name) : 'Log it') + '</button>' +
        '</div>';
    }

    return head +
      '<div class="call-lines" id="callLines">' + (st === 'ready' ? (c ? prepHtml(c) : '') : transcriptHtml(call)) + '</div>' +
      (call.asking ? '<div class="call-consent" role="group" aria-labelledby="callConsentSay">' +
        '<p class="call-consent-say" id="callConsentSay">They have to be told before this can start. Have you told them?</p>' +
        '<div class="call-consent-acts"><button class="btn btn-ghost btn-sm" type="button" data-call-consent="no">Not yet</button>' +
        '<button class="btn btn-brand btn-sm" type="button" data-call-consent="yes">I have told them</button></div></div>' : '') +
      (st === 'ready' && call.dir === 'out' ? '<div class="call-from"><span class="call-from-cap">From</span>' + telPick('Call') + '</div>' : '') +
      '<div class="call-tools">' +
        (st === 'ready' ? (sess ? '<button class="call-tool" type="button" data-call-skip aria-label="Skip to the next one" title="Skip to the next one">' + svg('skip') + '</button>' : '') +
            '<button class="call-end call-go" type="button" data-callgo aria-label="Start the call to ' + esc(name) + ' from ' + esc(from.num) + '">' +
            svg('phone') + 'Call from ' + esc(telTag(from)) + '</button>'
          : '<button class="call-tool' + (call.recording ? ' is-rec' : '') + '" type="button" data-call-rec aria-pressed="' + call.recording + '" aria-label="' +
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
    const call = CALL;
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
    paintCall();
    paint();
    toast('Added ' + c.name + ' to ' + q.title, () => { dropCand(c); if (CALL && CALL.cand === c.id) { CALL.cand = null; paintCall(); } paint(); },
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
    return dialSay('That is <b>' + esc(c.name) + '</b>, at the ' + esc(lower(STAGE[c.stage].label)) + ' for ' + esc(reqOf(c).title) + '. The call goes on their record.');
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
        : '<div class="b-log-row t-log-static">' + inner + '</div>') + '</div>';
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
    const ico = t.dir === 'in' ? svg('callin') : svg('callout');
    return logRow({
      tone: t.missed ? 'is-missed' : '', ico: ico,
      who: withName ? (c ? c.name : t.who || t.phone) : (t.dir === 'in' ? (t.missed ? 'Missed call' : 'They called') : 'You called'),
      meta: logMeta([t.missed ? 'Missed' : OUTCOME[t.outcome].label, t.secs ? fmtClock(t.secs) : null, t.time,
        withName && c ? reqOf(c).title : null, t.from && telLine(t.from) ? 'from ' + telTag(telLine(t.from)) : null]),
      say: esc(t.note || ''),
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
            return c ? logRow({ tone: 'is-missed', ico: svg('callin'), who: c.name, meta: logMeta(['Missed', c.phone, t.time]),
              say: ringRead(c), aimy: true, act: 'data-call="' + c.id + '"', go: 'Call them back', goIco: svg('phone', 14) }, i)
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
    return '<div class="s-home">' + topBrief() +
      '<section class="s-block s-block-wide" aria-label="Calls">' +
        '<div class="s-camp-list-head">' + switcher('calls') + '</div>' +
        '<div class="b-cuts b-log-tabs">' + TABS.map((x) => '<button class="filter-chip' + (tab === x[0] ? ' active' : '') + '" type="button" data-q="' + x[0] + '"' +
          (tab === x[0] ? ' aria-current="true"' : '') + '>' + esc(x[1]) + '<span class="b-cut-n">' + n[x[0]] + '</span></button>').join('') + '</div>' +
        body +
      '</section></div>';
  }

  /* ── ONE CANDIDATE ── the contact record, as a candidate: who they are,
     what they said on calls, the evidence against the success profile, and
     every call. */
  const EVW = { m: 'Met', p: 'Partly met', n: 'Not evidenced' };
  function candPage() {
    const c = DB.byId[S.cand];
    const q = reqOf(c);
    const nx = nextOf(c);
    const calls = callsOf(c.id);
    const silent = q.must.filter((m, i) => c.ev[i] === 'n');
    const early = !c.exit && rank(q, c.stage) <= rank(q, 'phone');
    const outK = c.stage === 'sent' || c.stage === 'client' ? 'clientno' : c.stage === 'offer' ? 'offerno' : 'out';
    const w = waitsOn(c);
    return '<div class="s-home">' +
      '<div class="b-topbar s-block-wide"><button class="s-back" type="button" data-req="' + q.id + '">' + svg('back', 14) + 'Back to ' + esc(q.title) + '</button></div>' +
      '<section class="s-rec-head s-block-wide">' +
        '<span class="s-rec-kind b-kinds">' + fact('user', 'Candidate') + fact('req', q.title) + fact('acc', accOf(q).name) + fact('pin', c.place) + '</span>' +
        '<div class="s-rec-title"><h1 class="s-rec-name">' + esc(c.name) + '</h1>' +
          '<span class="s-meta-st tone-' + (c.exit ? 'neutral' : 'ok') + '">' + esc(c.exit ? EXIT[c.exit].label : STAGE[c.stage].label) + '</span>' +
          '<span class="b-kind">' + esc(c.source) + '</span></div>' +
        '<div class="b-cmeta">' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Now</h2><div class="b-cmeta-say"><p class="b-cmeta-p">' + esc(c.at) + '</p>' +
            '<p class="b-cmeta-p">' + esc(plural(c.years, 'year')) + ' of experience · ' + esc(c.langs.join(', ')) + '</p></div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Phone</h2><div class="b-cmeta-say"><p class="b-cmeta-p"><b>' + esc(c.phone) + '</b></p>' +
            '<p class="b-cmeta-p">' + esc(c.dnc ? 'Asked not to be called again.' : c.badNumber ? 'This number did not work.' : c.callback != null && c.callback <= 0 ? 'Asked to be called back today.' : plural(calls.length, 'call') + ' so far.') + '</p></div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Said on calls</h2><div class="b-cmeta-say">' +
            (c.notice || c.salary ? (c.notice ? '<p class="b-cmeta-p">' + esc(c.notice.charAt(0).toUpperCase() + c.notice.slice(1)) + '</p>' : '') +
              (c.salary ? '<p class="b-cmeta-p">Expects ' + esc(c.salary) + '</p>' : '')
              : '<p class="b-cmeta-p b-draft-none">Nothing yet. The phone screen asks.</p>') + '</div></div>' +
        '</div>' +
        '<div class="b-cmeta b-said"><div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">Against the success profile</span></div>' +
          '<div class="b-cmeta-say">' + q.must.map((m, i) => '<p class="b-cmeta-p">' + esc(m) + ' <span class="s-meta-st tone-' +
            (c.ev[i] === 'm' ? 'ok' : c.ev[i] === 'p' ? 'warn' : 'neutral') + '">' + esc(EVW[c.ev[i]]) + '</span></p>').join('') +
          '</div></div></div>' +
      '</section>' +
      '<section class="s-insight is-lead s-block-wide" aria-label="Where they are">' +
        '<div class="s-lead-mark"><svg class="s-insight-mark" viewBox="0 0 18 20" width="14" height="14" aria-hidden="true"><use href="#aimy-logo-small"/></svg>' +
          '<span class="work-state ws-detected">Read off the record</span></div>' +
        '<div class="s-lead-line"><span class="s-lead-n">' + evMet(c) + '</span><span class="s-lead-say">of the <span class="s-lead-of">' + c.ev.length + '</span> must-haves met in the CV.</span></div>' +
        '<p class="s-lead-deck">' + esc(c.exit ? EXIT[c.exit].say.charAt(0).toUpperCase() + EXIT[c.exit].say.slice(1) + '.'
          : silent.length ? 'The CV is silent on: ' + silent.join('; ') + '. ' + (early ? 'Ask on the phone screen.' : 'The interview kit should probe it.')
          : 'Every must-have has something in the CV behind it.') + '</p>' +
        (c.exit ? '' : '<div class="s-lead-acts">' +
          (canCall(c) ? '<button class="s-insight-lnk' + (early ? ' primary' : '') + '" type="button" data-call="' + c.id + '">' + svg('phone', 14) + 'Call ' + esc(first(c.name)) + '</button>' : '') +
          (nx && !early && (w === 'me' || w === 'client' || w === 'candidate') ? '<button class="s-insight-lnk primary" type="button" data-move="' + c.id + '|' + nx + '">' + esc(goSay(c)) + '</button>' : '') +
          '<button class="b-ghost" type="button" data-out="' + c.id + '|' + outK + '">' + esc(EXIT[outK].label) + '</button>' +
        '</div>') +
      '</section>' +
      '<section class="s-block s-block-wide" aria-label="Calls with them">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Calls with them</h2><span class="s-block-say">' + plural(calls.length, 'call') + ' · newest first</span></div>' +
        (calls.length ? '<div class="b-log">' + logDays(calls, (t, i) => callRow(t, i, false)) + '</div>' : '<p class="b-vfoot">Nobody has called them yet.</p>') +
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

  function paint() {
    paintWho();
    byId('wbStage').innerHTML = S.cand ? candPage() : S.req ? reqPage() : S.on === 'reqs' ? reqsPage()
      : S.on === 'calls' ? callsPage() : homePage();
    paintRail();
    paintBell();
    paintProto();
    paintDial();
    requestAnimationFrame(placeSwitchBar);
  }

  /* ── The bell: what is waiting on a person, every row ending in a record. */
  function paintBell() {
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
  function move(c, to) {
    const was = { stage: c.stage, since: c.since, meet: c.meet, fb: c.fb, maxAt: c.maxAt, exit: c.exit, nudged: c.nudged };
    const q = reqOf(c);
    const fields = { stage: to, since: 0, fb: false, nudged: null,
      meet: MEETS[to] ? 2 : null, slot: c.slot || '11:00',
      maxAt: rank(q, to) > rank(q, c.maxAt) ? to : c.maxAt };
    write(c, fields);
    paint();
    toast('Moved ' + first(c.name) + ' to ' + lower(STAGE[to].label), () => { write(c, was); paint(); toast('Put back', null, c.name + ' is at ' + lower(STAGE[was.stage].label) + ' again.'); },
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
    if (k === 'screen') { const l = toCall(); return l.length ? callAll(l.map((x) => x.c.id)) : go({ on: 'calls' }); }
    if (k === 'risk') return go({ on: 'reqs', q: 'risk' });
    go({});
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    const at = (sel) => t.closest(sel);
    let el;
    if ((el = at('[data-undo]'))) { const u = UNDO; toastGone(); if (u) u(); return; }
    /* ── The call ── */
    if ((el = at('[data-call]'))) { startCall(el.getAttribute('data-call')); return; }
    if ((el = at('[data-call-all]'))) { callAll(toCall().map((x) => x.c.id)); return; }
    if ((el = at('[data-callgo]'))) { callGo(); return; }
    if ((el = at('[data-call-end]'))) { endCall(); return; }
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
    if ((el = at('[data-call-hold]'))) { CALL.held = !CALL.held; paintCall(); return; }
    if ((el = at('[data-call-min]'))) { callMin(!CALL_MIN); paintCall(); return; }
    if ((el = at('[data-call-line]'))) {
      UI.line = el.getAttribute('data-call-line'); saveUI();
      if (CALL && CALL.state === 'ready') CALL.from = UI.line;
      paintCall();
      if (!byId('dialPanel').hidden) dialOpen();
      return;
    }
    if ((el = at('[data-outcome]'))) { CALL.lit = el.getAttribute('data-outcome'); paintCall(); return; }
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
    /* A click outside the bell, the dialer or an open menu closes it. */
    if (!at('#ntfPanel') && !at('#ntfBell')) { const p = byId('ntfPanel'); if (!p.hidden) { p.hidden = true; byId('ntfBell').setAttribute('aria-expanded', 'false'); } }
    if (!at('#dialAnchor')) closeDial();
    if (!at('.b-menu-wrap')) document.querySelectorAll('.tel-menu').forEach((m) => { m.hidden = true; });
  });

  /* Find, as you type. The page repaints and the cursor stays where it was. */
  document.addEventListener('input', (e) => {
    /* The dialer reads the number as you type it (Sales). */
    if (e.target.id === 'dialNum') {
      DIAL_NUM = e.target.value;
      const who = byId('dialWho');
      if (who) who.innerHTML = dialWho();
      return;
    }
    /* The note is read as you type, and what it says overrides what the
       transcript said (Sales's per-axis rule). */
    if (e.target.id === 'callNote' && CALL) {
      const v = e.target.value, pos = e.target.selectionStart;
      CALL.note = v;
      const rd = readCall(v);
      CALL.read = CALL.read || {};
      if (rd.outcome) CALL.lit = rd.outcome;
      if (rd.notice) CALL.read.notice = rd.notice;
      if (rd.salary) CALL.read.salary = rd.salary;
      if (rd.when) CALL.read.when = rd.when;
      paintCall();
      const f = byId('callNote');
      if (f) { f.focus(); f.setSelectionRange(pos, pos); }
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
    go({ on: 'reqs', find: v || undefined });
  });
  byId('floatSend').addEventListener('click', () => {
    const v = byId('floatInput').value.trim();
    byId('floatInput').value = '';
    go({ on: 'reqs', find: v || undefined });
  });
  document.addEventListener('keydown', (e) => {
    const typing = /input|textarea/i.test((document.activeElement || {}).tagName || '');
    /* Enter means the obvious next thing at every state of a call (Sales):
       start it, log it. 1 to 8 pick the outcome while logging. */
    if (e.target.id === 'dialNum' && e.key === 'Enter') { e.preventDefault(); dialGo(); return; }
    if (CALL && CALL.state === 'logging') {
      if (e.key === 'Enter' && (e.target.id === 'callNote' || !typing) && !/button/i.test(e.target.tagName)) { e.preventDefault(); logCall(); return; }
      if (!typing && /^[1-8]$/.test(e.key)) { CALL.lit = OUTCOMES[Number(e.key) - 1].k; paintCall(); return; }
    }
    if (CALL && CALL.state === 'ready' && e.key === 'Enter' && !typing && !/button/i.test(e.target.tagName)) { e.preventDefault(); callGo(); return; }
    if (e.key === 'Escape') { closeDial(); document.querySelectorAll('.tel-menu').forEach((m) => { m.hidden = true; }); }
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

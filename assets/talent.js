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
    out.when = /\btomorrow\b/i.test(t) ? 1 : /\bnext week\b/i.test(t) ? 7 : null;
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
    dina:  { id: 'dina',  name: 'Dina Ragab',   ini: 'DR', role: 'HR Manager',     fn: 'hr' },
    jana:  { id: 'jana',  name: 'Jana Weber',   ini: 'JW', role: 'Northwind Software', fn: 'client', acc: 'northwind' },
  };
  const DESK_ORDER = ['omar', 'rania', 'dina', 'jana'];

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
      /* Offers. */
      const oi = t.indexOf('offer');
      if (at >= oi || c.exit === 'offerno') {
        const lo = q.budget ? q.budget.min : 20000, hi = q.budget ? q.budget.max : 30000;
        const salary = Math.round((lo + (hi - lo) * (0.35 + r() * 0.5)) / 500) * 500;
        const offer = { id: 'o' + (++on), cand: c.id, salary: salary, notice: c.notice || 'one month’s notice',
          expects: c.salary || null, hm: 'ok', bu: 'ok', sentDay: null, status: 'draft', joinDay: null, note: null };
        if (c.exit === 'offerno') Object.assign(offer, { status: 'declined', sentDay: -between(r, 5, 20), note: 'Took a counter-offer from their current employer.' });
        else if (c.stage === 'offer') {
          if (chance(r, 0.5)) Object.assign(offer, { hm: chance(r, 0.5) ? 'ok' : 'waiting', bu: 'waiting', status: 'approving' });
          else Object.assign(offer, { status: 'sent', sentDay: -c.since });
        } else if (c.stage === 'accepted') Object.assign(offer, { status: 'accepted', sentDay: -between(r, 10, 30), joinDay: between(r, 3, 35) });
        else if (c.stage === 'joined') Object.assign(offer, { status: 'joined', sentDay: -between(r, 40, 80), joinDay: -between(r, 5, 30) });
        DB.offers.push(offer);
      }
    });
  }


  /* ══ 4. THE STORE ═══════════════════════════════════════════════════════
     The delta, never the corpus. `D.c[id]` holds the fields a person changed
     on one candidate; `D.log` is the record of moves, newest last. */
  const KEY = 'aimy-talent:db:v1';
  /* `calls` are the calls you logged, appended to the seed's history.
     `added` are candidates a call brought in (a stranger who rang). */
  const fresh = () => ({ c: {}, calls: [], added: [], x: {}, tpl: {} });
  /* Every other collection keeps its changes the same way: `D.x[col][id]`
     holds the fields a person changed, and a record made here carries
     `_new` so it is rebuilt on load. */
  const COLS = ['reqs', 'ivs', 'sends', 'offers', 'asmts', 'ivtpls', 'events'];
  let D = fresh();
  function load() {
    try { const s = localStorage.getItem(KEY); if (s) D = JSON.parse(s); } catch (e) { D = fresh(); }
    if (!D || !D.c) D = fresh();
    D.calls = D.calls || []; D.added = D.added || [];
    D.added.forEach((c) => { if (!DB.byId[c.id] && DB.byReq[c.req]) { DB.cands.push(c); DB.byId[c.id] = c; DB.byReq[c.req].push(c); } });
    D.x = D.x || {}; D.tpl = D.tpl || {};
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
  /* WHOSE REQUISITIONS. The recruiter's are the ones they fill, the hiring
     manager's the ones they asked for, the client's the ones for their
     company, and the HR Manager reads all of them. */
  function deskReqs() {
    const d = me();
    if (d.fn === 'rec') return DB.reqs.filter((q) => q.rec === d.id);
    if (d.fn === 'hm') return DB.reqs.filter((q) => q.hm === d.id);
    if (d.fn === 'client') return DB.reqs.filter((q) => q.acc === d.acc && q.state !== 'draft');
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
    if (isHM()) return reached >= t.indexOf('tech');
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
  const VSTATE = {
    verified: { label: 'Verified in interview', tone: 'ok' },
    partly:   { label: 'Partly shown in interview', tone: 'warn' },
    notshown: { label: 'Not shown in interview', tone: 'neutral' },
    differs:  { label: 'CV and interview differ', tone: 'warn' },
    unproven: { label: 'Not checked yet', tone: 'neutral' },
  };

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
  const KEYS = ['as', 'on', 'req', 'cand', 'asmt', 'acc', 'q', 'find', 'edit', 'apply', 'me', 'take', 'debrief', 'approve', 'by', 'src'];
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
  function go(over, replace) {
    const next = Object.assign({}, over);
    /* The desk travels with every link inside the product, and never onto a
       screen somebody outside it opens. */
    if (DESK !== 'omar' && !('as' in over) && !OUTSIDE.some((k) => !!next[k])) next.as = DESK;
    if (!replace) TRAIL = Object.assign({}, S);
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
    /* Each desk's row is the work that desk does (Sales: a surface belongs
       to whoever does the verb on it). */
    const all = {
      '': { label: 'Today' },
      reqs: { label: 'Requisitions', n: open },
      calls: { label: 'Calls', n: isRec() ? toCall().length : null },
      find: { label: 'Find candidates' },
      asmts: { label: 'Assessments' },
      templates: { label: 'Templates' },
      reports: { label: 'Reports' },
    };
    const row = isRec() ? ['', 'reqs', 'calls', 'find', 'asmts', 'reports'] : isHM() ? ['', 'reqs', 'reports']
      : isHR() ? ['', 'reqs', 'asmts', 'templates', 'reports'] : ['', 'reqs'];
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
      (isRec() ? topBrief() : '') +
      '<section class="s-block s-block-wide">' +
        '<div class="s-camp-list-head">' + switcher('reqs') +
          '<label class="b-find">' + svg('find', 14) +
            '<input type="text" data-find value="' + esc(S.find || '') + '" placeholder="Find a requisition, an account or a candidate" spellcheck="false" aria-label="Find a requisition, an account or a candidate"></label>' +
          (isClient() ? '<button class="b-ghost" type="button" data-client-request>Ask for a hire</button>' : '<button class="b-ghost" type="button" data-new-req>New requisition</button>') +
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
      : ws ? 'The biggest drop is after the ' + lower(STAGE[ws.from].label) + ': ' + ws.m + ' of ' + ws.n + ' moved on.'
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
            q.must.map((m) => '<p class="b-cmeta-p">' + esc(m) + '</p>').join('') + '</div></div>' +
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
    const canMove = !c.exit && nx && (w === 'me' || w === 'client' || w === 'candidate' || c.stage === 'sourced') && (isRec() || isHR());
    const outK = c.stage === 'sent' || c.stage === 'client' || c.stage === 'ctech' ? 'clientno' : c.stage === 'offer' ? 'offerno' : 'out';
    const foot = (l, r) => '<div class="tc-gov b-qcard-foot">' + l + r + '</div>';
    const ghostOut = '<button class="b-ghost" type="button" data-out="' + c.id + '|' + outK + '">' + esc(EXIT[outK].label) + '</button>';
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
    if (!c.exit && isClient() && c.stage === 'sent') special = foot('<button class="b-ghost" type="button" data-out="' + c.id + '|clientno">Pass</button>',
      '<button class="s-insight-lnk primary" type="button" data-move="' + c.id + '|client">Meet them</button>');
    return '<article class="type-card s-card b-qcard" style="--i:' + Math.min(i, 8) + '">' +
      '<div class="tc-head">' + stageTag(c) + '<span class="b-kind">' + esc(c.source) + '</span></div>' +
      '<div class="b-qcard-top"><button class="tc-title s-card-title" type="button" data-cand="' + c.id + '">' + esc(c.name) + '</button></div>' +
      '<p class="tc-summary b-qcard-role">' + esc(c.at) + '</p>' +
      '<p class="b-qcard-where">' + fact('job', plural(c.years, 'year') + ' of experience') + fact('pin', c.place) + '</p>' +
      '<p class="b-qcard-where">' + fact('lang', c.langs.join(', ')) + '</p>' +
      aimyBlock({ text: esc(say) + ' ' + evSay(c) + '.' + (s && s.status === 'done' ? ' Assessment ' + s.score + '%.' : ''), from: 'the CV, read against the success profile' }) +
      /* AT THE SCREEN, THE CALL IS THE MOVE. Someone who applied or is due a
         phone screen moves forward by being called and the call being
         logged, so the card's one verb is Call, not a stage button. */
      (special ? special : !c.exit && isRec() && (c.stage === 'applied' || c.stage === 'phone') ? '<div class="tc-gov b-qcard-foot">' +
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
      script: scriptFor(c), shown: 0, note: '', recording: false, asking: false, muted: false,
      held: false, sess: sess || null, lit: null, read: null, video: false, camOff: false };
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
      day: 0, time: time, dir: call.dir, secs: call.secs, outcome: o, by: ME, missed: false, from: call.dir === 'out' && !call.video ? call.from : null, video: !!call.video,
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
          : 'A follow-up. They are ' + esc(atStage(c.stage)) + ', and nothing on this call moves their stage.') + '</p>' +
      '</blockquote>' +
      (last ? '<p class="b-prep-line">' + esc(callSay(last)) + (last.note && !last.missed ? ' ' + esc(last.note) : '') + '</p>' : '') +
      (CALL && CALL.video ? videoBlock(c) : '') +
    '</div>';
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
          : st === 'logging' ? '<span class="call-timer">Ended · ' + fmtClock(call.secs) + '</span>' : '') +
        (sess ? '<span class="call-of">' + at + ' of ' + sess.ids.length + '</span>' : '') +
      '</div></div>' +
      '<p class="call-sub">' + esc(sub) + '</p>' +
      (call.video ? '<p class="call-num call-vid">' + svg('video') + 'Video call on Teams' + (call.camOff && st === 'live' ? ' · your camera is off' : '') + '</p>'
        : '<p class="call-num">' + esc(call.phone) + '</p>') +
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
    return '<div class="s-home">' + topBrief() +
      '<section class="s-block s-block-wide" aria-label="Calls">' +
        '<div class="s-camp-list-head">' + switcher('calls') + '</div>' +
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
  const EVW = { m: 'Met', p: 'Partly met', n: 'Not evidenced' };
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
          (isClient() ? '' : '<span class="b-kind">' + esc(c.source) + ', ' + esc(sayWhen(c.applied != null ? c.applied : -3)) + '</span>') + '</div>' +
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
        '</div>' +
      '</section>' +
      '<section class="s-insight is-lead s-block-wide" aria-label="Where they are">' +
        '<div class="s-lead-mark"><svg class="s-insight-mark" viewBox="0 0 18 20" width="14" height="14" aria-hidden="true"><use href="#aimy-logo-small"/></svg>' +
          '<span class="work-state ws-detected">Read off the record</span></div>' +
        '<div class="s-lead-line"><span class="s-lead-n">' + ok + '</span><span class="s-lead-say">of the <span class="s-lead-of">' + v.length + '</span> must-haves verified in interview. The CV meets ' + evMet(c) + '.</span></div>' +
        '<p class="s-lead-deck">' + esc(c.exit ? EXIT[c.exit].say.charAt(0).toUpperCase() + EXIT[c.exit].say.slice(1) + '.'
          : differs.length ? 'The CV and the interview differ on ' + differs.map((x) => x.must).join('; ') + '. Worth asking about in the next round.'
          : !ok ? (early ? 'Nothing is checked in an interview yet. The phone screen comes first.' : 'Nothing is checked in an interview yet.')
          : 'What the CV says has held up in interview so far.') + '</p>' +
        (c.exit || !works ? '' : '<div class="s-lead-acts">' +
          (isRec() && canCall(c) ? '<button class="s-insight-lnk' + (early ? ' primary' : '') + '" type="button" data-call="' + c.id + '">' + svg('phone', 14) + 'Call ' + esc(first(c.name)) + '</button>' : '') +
          (nx && !early && (w === 'me' || w === 'client' || w === 'candidate') && c.stage !== 'offer' ? '<button class="s-insight-lnk primary" type="button" data-move="' + c.id + '|' + nx + '">' + esc(goSay(c)) + '</button>' : '') +
          '<button class="b-ghost" type="button" data-out="' + c.id + '|' + outK + '">' + esc(EXIT[outK].label) + '</button>' +
        '</div>') +
      '</section>' +
      verifiedBlock(c, v) +
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

  /* Each must-have: what the CV says, and what each interview found. */
  function verifiedBlock(c, v) {
    return '<section class="s-block s-block-wide" aria-label="Against the success profile">' +
      '<div class="s-camp-list-head"><h2 class="s-block-h">Against the success profile</h2>' +
        '<span class="s-block-say">the CV, then each interview that rated it</span></div>' +
      '<div class="t-vlist">' + v.map((x) => {
        const s = VSTATE[x.state];
        const iv = x.seen[0];
        return '<div class="t-vrow">' +
          '<span class="t-vmust">' + esc(x.must) + '</span>' +
          '<span class="t-vcol"><span class="t-vcap">CV says</span><span class="s-meta-st tone-' + (x.cv === 'm' ? 'ok' : x.cv === 'p' ? 'warn' : 'neutral') + '">' + EVW[x.cv] + '</span></span>' +
          '<span class="t-vcol"><span class="t-vcap">Interview found</span>' + (iv
            ? '<span class="s-meta-st tone-' + (iv.r === 'm' ? 'ok' : iv.r === 'p' ? 'warn' : 'neutral') + '">' + RATE[iv.r] + '</span><span class="t-vnote">' + esc(iv.note) + ' ' + esc(iv.by) + '.</span>'
            : '<span class="t-vnote">Not asked yet.</span>') + '</span>' +
          '<span class="tag tag-' + s.tone + '">' + esc(s.label) + '</span>' +
        '</div>';
      }).join('') + '</div>' +
    '</section>';
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
        appr(BU_DIRECTOR, 'BU Director: send', 'bu') +
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
  const ONBOARD = [
    ['IT access, as a Freshdesk ticket to the IT team', 'IT'],
    ['Contract signed', 'HR'],
    ['Documents collected on WhatsApp', 'AiMY'],
    ['A buddy on the team', 'Hiring manager'],
    ['The day-one schedule sent', 'AiMY'],
  ];
  function onboardHtml(c, o) {
    const done = c.onb || [];
    const works = isRec() || isHR();
    return '<div class="t-onb"><h3 class="b-month">Before day one</h3>' +
      ONBOARD.map((x, i) => '<p class="t-q"><button class="t-check' + (done[i] ? ' is-on' : '') + '" type="button" ' + (works ? 'data-onb="' + c.id + '|' + i + '"' : 'disabled') +
        ' aria-pressed="' + !!done[i] + '" aria-label="' + esc(x[0]) + '">' + (done[i] ? svg('check', 12) : '') + '</button><span>' + esc(x[0]) + '</span><span class="b-kind">' + esc(x[1]) + '</span></p>').join('') +
      '<h3 class="b-month">Check-ins</h3>' +
      '<p class="t-q"><span class="tag tag-neutral">Day 30</span><span>With ' + esc(hmOf(reqOf(c)).name) + ' and with ' + esc(first(c.name)) + ', separately. Kept apart from any probation review.</span></p>' +
      '<p class="t-q"><span class="tag tag-neutral">Day 90</span><span>The second check-in, and whether they stayed. Then Employee Self-Service takes over.</span></p>' +
    '</div>';
  }

  /* ── The history, and a line to add to it ── */
  function historyBlock(c) {
    const h = historyOf(c);
    const ICO = { apply: 'user', call: 'phone', asmt: 'goal', iv: 'users', offer: 'job', move: 'go', out: 'go', note: 'req' };
    let day = null;
    const sug = c.histSug ? DB.events.filter((e) => e.id === c.histSug)[0] : null;
    return '<section class="s-block s-block-wide" aria-label="History">' +
      '<div class="s-camp-list-head"><h2 class="s-block-h">History</h2><span class="s-block-say">everything, newest first</span></div>' +
      ((isRec() || isHR() || isHM()) ? '<div class="t-addnote"><input class="dial-input" id="histNote" type="text" autocomplete="off" spellcheck="false" ' +
          'placeholder="Add something that happened, like: interviewed by the client on Teams, they said yes" aria-label="Add to their history">' +
        '<button class="btn btn-brand btn-sm" type="button" data-hist-add="' + c.id + '">Add</button></div>' : '') +
      (sug && sug.read && !c.exit ? '<div class="t-sug">' + aimyBlock({ text: 'I read “' + esc(sug.text) + '” as <b>' + (sug.read === 'yes' ? 'they passed' : 'they did not pass') + '</b>.', from: 'your note' }) +
        '<p class="t-acts">' + (sug.read === 'yes' && nextOf(c) ? '<button class="s-insight-lnk primary" type="button" data-move="' + c.id + '|' + nextOf(c) + '">Move them to ' + esc(lower(STAGE[nextOf(c)].label)) + '</button>'
          : sug.read === 'no' ? '<button class="s-insight-lnk primary" type="button" data-out="' + c.id + '|out">Mark as not progressing</button>' : '') +
        '<button class="b-ghost" type="button" data-sug-no="' + c.id + '">Leave it</button></p></div>' : '') +
      '<div class="b-log">' + h.map((x, i) => {
        const head = x.day !== day ? '<h3 class="b-month">' + esc(dayLabel(x.day)) + '</h3>' : '';
        day = x.day;
        return head + logRow({ tone: '', ico: svg(ICO[x.kind] || 'req'), who: x.text, meta: logMeta([x.time, x.by && DESKS[x.by] ? DESKS[x.by].name : null]) }, i);
      }).join('') + '</div>' +
    '</section>';
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
  function outsideHead(title, sub) {
    return '<header class="t-out-head"><span class="t-out-mark">' + mark(22) + '</span><span><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></span></header>';
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
    return '<div class="t-out">' + outsideHead('Interview debrief', 'For ' + v.by) +
      '<section class="t-out-card">' +
        '<p class="t-out-kicker">' + esc(STAGE[v.stage].label) + ' · ' + esc(sayWhen(v.day)) + ' at ' + esc(v.slot) + '</p>' +
        '<h1 class="t-out-h">' + esc(c.name) + '</h1>' +
        '<p>' + esc(q.title) + ' for ' + esc(accOf(q).name) + '. About two minutes. Your answers are quoted back as you wrote them.</p>' +
        (tpl ? '<h2 class="t-out-sub">The agenda</h2><ol class="t-out-list">' + tpl.items.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' : '') +
        (gaps.length ? '<h2 class="t-out-sub">What the CV is silent on</h2>' + aimyBlock({ text: 'Ask for an example of: ' + esc(gaps.join('; ')) + '.', from: 'the CV against the success profile' }) : '') +
        '<h2 class="t-out-sub">How did they do?</h2>' +
        '<div class="t-input-wrap" id="wrapDebrief"><div class="t-input">' + q.must.map((m, i) => '<div class="t-dr">' +
          '<p class="t-dr-must">' + esc(m) + (rec && rec.suggests ? '<span class="b-kind">The recording suggests ' + RATE[rec.suggests[i]].toLowerCase() + '</span>' : '') + '</p>' +
          '<div class="b-cuts">' + ['m', 'p', 'n'].map((k) => '<button class="filter-chip' + (DEBRIEF.r[i] === k ? ' active' : '') + '" type="button" data-dr="' + i + '|' + k + '">' + RATE[k] + '</button>').join('') + '</div>' +
          '<input class="dial-input" type="text" data-drn="' + i + '" value="' + esc(DEBRIEF.n[i] || '') + '" placeholder="One line on what you saw" aria-label="What you saw on ' + esc(m) + '">' +
        '</div>').join('') + '</div><p class="t-error-msg">Rate every line, then say proceed or not.</p></div>' +
        '<h2 class="t-out-sub">Your call</h2>' +
        '<div class="b-cuts">' + [['yes', 'Proceed'], ['no', 'Do not proceed']].map((x) => '<button class="filter-chip' + (DEBRIEF.v === x[0] ? ' active' : '') + '" type="button" data-dv="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
        '<p class="b-vfoot">Other interviewers’ feedback stays hidden until yours is in.</p>' +
        '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-debrief-submit>Send my debrief</button>' +
          (rec ? '' : '<button class="b-ghost" type="button" data-rec-up="' + v.id + '">' + (REC_BUSY[v.id] ? 'Transcribing…' : 'Upload the recording') + '</button>') + '</p>' +
      '</section></div>';
  }
  function debriefSubmit() {
    const v = DB.ivs.filter((x) => x.id === DEBRIEF.id)[0];
    const c = DB.byId[v.cand], q = reqOf(c);
    if (q.must.some((m, i) => !DEBRIEF.r[i]) || !DEBRIEF.v) { shake('wrapDebrief'); return; }
    put('ivs', v, { status: 'done', ratings: DEBRIEF.r.slice(), notes: q.must.map((m, i) => DEBRIEF.n[i] || IV_NOTE[DEBRIEF.r[i]][0]), verdict: DEBRIEF.v,
      day: v.status === 'booked' && v.day > 0 ? 0 : v.day });
    if (c.stage === v.stage && !c.exit) write(c, { fb: true, meet: Math.min(0, c.meet == null ? 0 : c.meet) });
    note(c, 'iv', v.by + ' sent the debrief: ' + (DEBRIEF.v === 'yes' ? 'proceed.' : 'do not proceed.'), { by: null });
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
      'AiMY answers their questions from the offer facts on WhatsApp. Anything about money comes to you.');
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
    return '<div class="t-out">' + outsideHead('Offer approval', 'For ' + who) +
      '<section class="t-out-card">' +
        '<p class="t-out-kicker">' + esc(by === 'hm' ? 'Your call: the fit and the salary' : 'Your call: can this offer be sent') + '</p>' +
        '<h1 class="t-out-h">' + esc(c.name) + '</h1>' +
        '<p>' + esc(q.title) + ' for ' + esc(accOf(q).name) + '. ' + esc(otherWho) + ' approves the same packet at the same time' + (other === 'ok' ? ', and already has.' : '.') + '</p>' +
        '<div class="b-cmeta t-out-meta">' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Monthly gross</h2><div class="b-cmeta-say"><p class="b-cmeta-p"><b>' + money(o.salary) + '</b></p>' +
            (q.budget ? '<p class="b-cmeta-p">Budget ' + money(q.budget.min) + ' to ' + money(q.budget.max).replace('EGP ', '') + '</p>' : '') +
            (o.expects ? '<p class="b-cmeta-p">They expect ' + esc(o.expects) + '</p>' : '') + '</div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Notice</h2><div class="b-cmeta-say"><p class="b-cmeta-p">' + esc(o.notice) + '</p></div></div>' +
          '<div class="b-cmeta-part"><h2 class="b-cmeta-cap">Interviews</h2><div class="b-cmeta-say"><p class="b-cmeta-p">' + plural(ivs.length, 'interview') + ', ' +
            ivs.filter((x) => x.verdict === 'yes').length + ' said proceed</p><p class="b-cmeta-p">' + v.filter((x) => x.state === 'verified').length + ' of ' + v.length + ' must-haves verified</p></div></div>' +
        '</div>' +
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
      'By WhatsApp and email, with their link. AiMY scores it when they finish.');
  }

  /* ══ FINDING CANDIDATES ══════════════════════════════════════════════════
     Search by a job description, a CV ("someone like this"), a list of
     skills, or an open requisition; across our own pool and the web,
     Apollo and SignalHire (New Operations list). Every result carries its
     score as its own explanation: "3 of 4 must-haves met", with Why behind
     it, never a bare percentage (audit, decision 2). People found outside
     have not applied, so first contact needs a person's approval. */
  const FIND_SOURCES = [
    { k: 'pool', label: 'Our talent pool', say: 'People who applied before', tag: 'Talent pool' },
    { k: 'web', label: 'The web', say: 'LinkedIn, GitHub and portfolios', tag: 'Found on the web' },
    { k: 'apollo', label: 'Apollo', say: 'Work emails and phones', tag: 'Apollo' },
    { k: 'signal', label: 'SignalHire', say: 'Mobile numbers', tag: 'SignalHire' },
  ];
  const KEYS_TO_MUST = [
    [/german/i, 'German at C1 or above'], [/english/i, 'Fluent English'], [/\bsql\b/i, 'SQL to read logs and data'],
    [/zendesk|freshdesk|ticket/i, 'Ticketing tools (Zendesk or Freshdesk)'], [/support|helpdesk|customer/i, 'Software support experience'],
    [/netsuite|erp|oracle/i, 'NetSuite or a similar ERP'], [/receivable|collection/i, 'Accounts receivable and collections'],
    [/excel/i, 'Advanced Excel'], [/reconcil/i, 'Bank reconciliations'], [/process|operation/i, 'Process documentation'],
    [/jira/i, 'Jira'], [/api/i, 'REST APIs'],
  ];
  let FIND = { q: '', req: null, src: { pool: true, web: true, apollo: true, signal: false }, step: 'ask', i: 0, res: [], done: {} };
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
    let h = 7;
    (FIND.q + '|' + (FIND.req || '')).split('').forEach((ch) => { h = (h * 33 + ch.charCodeAt(0)) >>> 0; });
    const r = rng(h);
    const fam = FIND.req ? DB.reqById[FIND.req].fam : famOf(FIND.q);
    const res = [];
    const fromPerson = (p, src, extra) => {
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
    const make1 = (src, n) => {
      for (let i = 0; i < n; i++) {
        const woman = chance(r, 0.5);
        const p = { name: pick(r, woman ? WOMEN : MEN) + ' ' + pick(r, LAST), at: pick(r, WEB_AT), place: pick(r, PLACES), years: between(r, 1, 9),
          langs: chance(r, 0.25) ? ['Arabic', 'English', 'German'] : ['Arabic', 'English'], skills: SKILLS[fam].filter(() => chance(r, 0.45)).slice(0, 4) };
        fromPerson(p, src, {
          phone: src === 'signal' || (src === 'apollo' && chance(r, 0.6)) ? '+20 1' + pick(r, ['0', '1', '2']) + ' ' + between(r, 1000, 9999) + ' ' + between(r, 1000, 9999) : null,
          email: src === 'apollo' ? p.name.toLowerCase().split(' ').join('.') + '@company.com' : null,
          link: src === 'web' ? pick(r, ['linkedin.com/in/', 'github.com/', 'behance.net/']) + p.name.toLowerCase().split(' ').join('') : null,
          consent: 'Has not applied. First contact needs your approval.' });
      }
    };
    if (FIND.src.web) make1('web', between(r, 5, 8));
    if (FIND.src.apollo) make1('apollo', between(r, 2, 4));
    if (FIND.src.signal) make1('signal', between(r, 2, 3));
    res.sort((a, b) => b.score - a.score);
    res.forEach((x, i) => { x.i = i; });
    FIND.res = res;
    paint();
    clearInterval(FIND.timer);
    const steps = findSteps();
    FIND.timer = setInterval(() => {
      FIND.i++;
      if (FIND.i >= steps.length) { clearInterval(FIND.timer); FIND.step = 'results'; FIND.reveal = true; }
      if (S.on === 'find') paint();
    }, 620);
  }
  const findSteps = () => ['Reading what to look for'].concat(FIND_SOURCES.filter((s) => FIND.src[s.k]).map((s) => 'Searching ' + (s.k === 'pool' || s.k === 'web' ? lower(s.label) : s.label)))
    .concat(['Reading each profile against the criteria']);
  function findPage() {
    if (S.req && S.req !== FIND.req && FIND.step !== 'results') FIND.req = S.req;
    const open = DB.reqs.filter(isOpen).filter((q) => isHR() || q.rec === DESK);
    const crit = findCriteria();
    let body = '';
    if (FIND.step === 'searching') {
      const steps = findSteps();
      body = '<div class="t-steps">' + steps.map((s, i) => '<p class="t-stepline' + (i < FIND.i ? ' is-done' : i === FIND.i ? ' is-now' : '') + '">' +
        '<span class="t-stepmark">' + (i < FIND.i ? svg('check', 12) : '') + '</span>' +
        (i === FIND.i ? '<span class="t-shimmer" data-text="' + esc(s) + '">' + esc(s) + '</span>' : '<span>' + esc(s) + '</span>') + '</p>').join('') + '</div>' +
        '<div class="b-grid">' + [0, 1, 2].map(() => '<div class="b-slot"><div class="b-skel s-skel-card"><div class="s-skel-line skeleton"></div><div class="s-skel-line skeleton"></div><div class="s-skel-line skeleton"></div><div class="s-skel-line skeleton"></div></div></div>').join('') + '</div>';
    } else if (FIND.step === 'results') {
      const bySrc = (k) => FIND.res.filter((x) => x.src === k).length;
      const added = Object.keys(FIND.done).length;
      body = aimyBlock({ text: '<b>' + plural(FIND.res.length, 'person', 'people') + '</b> found: ' + FIND_SOURCES.filter((s) => FIND.src[s.k]).map((s) => bySrc(s.k) + ' from ' + (s.k === 'pool' || s.k === 'web' ? lower(s.label) : s.label)).join(', ') +
        '. Sorted by how many of the ' + FIND.crit.length + ' must-haves each one meets.' + (added ? ' ' + plural(added, 'person', 'people') + ' added so far.' : ''), from: 'the sources you picked' }) +
        '<div class="b-cuts">' + FIND.crit.map((m) => '<span class="filter-chip t-static">' + esc(m) + '</span>').join('') + '</div>' +
        '<p class="t-acts">' + (FIND.req ? '<button class="s-insight-lnk primary" type="button" data-find-top>Add the 5 strongest to ' + esc(DB.reqById[FIND.req].title) + '</button>' : '') +
          '<button class="b-ghost" type="button" data-find-again>Search again</button></p>' +
        '<div class="b-grid' + (FIND.reveal ? ' t-reveal' : '') + '">' + FIND.res.map((x, i) => '<div class="b-slot">' + findCard(x, i) + '</div>').join('') + '</div>';
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
        '<div class="b-cuts">' + FIND_SOURCES.map((s) => '<button class="filter-chip' + (FIND.src[s.k] ? ' active' : '') + '" type="button" data-find-src="' + s.k + '" aria-pressed="' + !!FIND.src[s.k] + '">' + esc(s.label) + '<span class="b-cut-n">' + esc(s.say) + '</span></button>').join('') + '</div>' +
        (crit.length ? '<p class="b-vfoot">Read against: ' + esc(crit.join('; ')) + '.</p>' : '') +
        '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-find-go>' + (FIND.step === 'results' ? 'Search again' : 'Find candidates') + '</button></p>' +
        body +
      '</section></div>';
  }
  function findCard(x, i) {
    const src = FIND_SOURCES.filter((s) => s.k === x.src)[0];
    const met = x.ev.filter((e) => e === 'm').length;
    const added = FIND.done[x.i];
    const open = DB.reqs.filter(isOpen).filter((q) => isHR() || q.rec === DESK);
    return '<article class="type-card s-card b-qcard" style="--i:' + Math.min(i, 8) + '">' +
      '<div class="tc-head">' + tag(src.tag, x.src === 'pool' ? 'ok' : 'neutral') + (x.was ? '<span class="b-kind">' + esc(x.was) + '</span>' : x.link ? '<span class="b-kind">' + esc(x.link) + '</span>' : '') + '</div>' +
      '<div class="b-qcard-top"><span class="tc-title s-card-title">' + esc(x.name) + '</span></div>' +
      '<p class="tc-summary b-qcard-role">' + esc(x.at) + '</p>' +
      '<p class="b-qcard-where">' + fact('job', plural(x.years, 'year')) + fact('pin', x.place) + fact('lang', x.langs.join(', ')) + '</p>' +
      '<div class="t-acc" data-acc-open="false">' +
        '<div class="b-aimy"><svg class="b-aimy-mark" width="13" height="15" viewBox="0 0 18 20" aria-hidden="true"><use href="#aimy-logo-small"/></svg>' +
          '<span class="b-aimy-say"><b>' + met + ' of ' + x.ev.length + '</b> must-haves met' + (x.ev.filter((e) => e === 'p').length ? ', ' + x.ev.filter((e) => e === 'p').length + ' partly' : '') + '. ' +
          '<button class="t-inline-link t-acc-head" type="button" aria-expanded="false" data-acc-toggle>Why<span class="t-acc-chevron">' + svg('down', 12) + '</span></button></span></div>' +
        '<div class="t-acc-panel"><div class="t-acc-panel-inner"><div class="t-qlist">' + FIND.crit.map((m, k) => '<p class="t-q"><span class="tag tag-' + (x.ev[k] === 'm' ? 'ok' : x.ev[k] === 'p' ? 'warn' : 'neutral') + '">' + EVW[x.ev[k]] + '</span>' +
          '<span>' + esc(m) + (x.ev[k] !== 'n' ? '. Their profile names ' + esc((x.skills.filter((s) => m.toLowerCase().indexOf(s.toLowerCase().split(' ')[0]) >= 0)[0]) || (x.years + ' years')) + '.' : '. Their profile says nothing about it.') + '</span></p>').join('') + '</div></div></div>' +
      '</div>' +
      '<p class="b-vfoot">' + esc(x.consent) + (x.phone ? ' Phone found.' : '') + (x.email ? ' Email found.' : '') + '</p>' +
      '<div class="tc-gov b-qcard-foot">' +
        (added ? '<span class="b-kind">Added to ' + esc(added) + '</span>'
          : FIND.req ? '<button class="s-insight-lnk primary" type="button" data-find-add="' + x.i + '|' + FIND.req + '">Add to ' + esc(DB.reqById[FIND.req].title) + '</button>'
          : '<span class="b-menu-wrap"><button class="s-insight-lnk primary b-menu-open" type="button" data-pickopen="fa' + x.i + '" aria-haspopup="menu">Add to a requisition' + svg('down', 14) + '</button>' +
            '<div class="b-menu" id="fa' + x.i + '" role="menu" hidden>' + open.map((q) => '<button class="b-menu-item" type="button" role="menuitem" data-find-add="' + x.i + '|' + q.id + '"><span class="b-menu-name">' + esc(q.title) + '</span><span class="tel-menu-cc">' + esc(accOf(q).name) + '</span></button>').join('') + '</div></span>') +
      '</div>' +
    '</article>';
  }
  function findAdd(i, reqId, quiet) {
    const x = FIND.res[i];
    const q = DB.reqById[reqId];
    if (!x || !q || FIND.done[i]) return null;
    const id = uid('k');
    const c = { id: id, pid: x.pid || id, name: x.name, req: q.id, stage: 'sourced', exit: null, since: 0, meet: null, fb: false, nudged: null,
      years: x.years, at: x.at, place: x.place, langs: x.langs, skills: x.skills, source: x.src === 'pool' ? 'From the talent pool' : 'Found on ' + (x.src === 'web' ? 'the web' : FIND_SOURCES.filter((s) => s.k === x.src)[0].label),
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
      (worst != null && rates[worst] < 40 && !edit ? '<section class="s-insight is-lead s-block-wide" aria-label="What to fix">' +
        '<div class="s-lead-mark"><svg class="s-insight-mark" viewBox="0 0 18 20" width="14" height="14" aria-hidden="true"><use href="#aimy-logo-small"/></svg><span class="work-state ws-detected">Read off every result</span></div>' +
        '<div class="s-lead-line"><span class="s-lead-n">' + (100 - rates[worst]) + '%</span><span class="s-lead-say">of the people who took it got Q' + (worst + 1) + ' wrong.</span></div>' +
        '<p class="s-lead-deck">When nearly everyone misses one question, the question is usually the problem. AiMY can reword it in plainer terms, or you can drop it. Either change is yours to approve.</p>' +
        '<div class="s-lead-acts"><button class="s-insight-lnk primary" type="button" data-q-reword="' + a.id + '|' + worst + '">Reword it with AiMY</button>' +
          '<button class="b-ghost" type="button" data-q-del="' + a.id + '|' + worst + '">Drop Q' + (worst + 1) + '</button></div></section>' : '') +
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
              (qq.type === 'choice' ? '<p class="b-vfoot">Right answer: ' + esc(qq.options[qq.right]) + '</p>' : '<p class="b-vfoot">A good answer covers: ' + esc((qq.points || []).join('; ')) + '</p>')) +
          '</div>' +
          (rates[i] != null && !edit ? '<span class="t-asq-rate' + (rates[i] < 40 ? ' is-low' : '') + '"><b>' + rates[i] + '%</b> right</span>' : '') +
        '</div>').join('') + '</div>' : '<p class="s-none">No questions yet.</p>') +
        (edit ? '<p class="t-acts"><button class="s-insight-lnk" type="button" data-q-add="' + a.id + '">Add a question</button></p>' : '') +
      '</section>' +
      (r.length && !edit ? '<section class="s-block s-block-wide" aria-label="Results"><div class="s-camp-list-head"><h2 class="s-block-h">Results</h2><span class="s-block-say">' + r.length + ', newest first</span></div>' +
        '<div class="b-log">' + r.slice().sort((x, y) => (y.doneDay || 0) - (x.doneDay || 0)).slice(0, 20).map((s, i) => { const c = DB.byId[s.cand];
          return c ? logRow({ tone: '', ico: svg('goal'), who: c.name, meta: logMeta([s.score + '%', s.score >= a.pass ? 'a pass' : 'under the pass mark', reqOf(c).title, sayWhen(s.doneDay != null ? s.doneDay : s.day)]),
            act: 'data-cand="' + c.id + '"', go: 'Open' }, i) : ''; }).join('') + '</div></section>' : '') +
    '</div>';
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
  function templatesPage() {
    const busy = (k, s) => DB.reqs.some((q) => q.tpl === k && isOpen(q) && DB.byReq[q.id].some((c) => !c.exit && c.stage === s));
    return '<div class="s-home">' +
      '<section class="s-block s-block-wide" aria-label="Stage templates">' +
        '<div class="s-camp-list-head">' + switcher('templates') + '</div>' +
        aimyBlock({ text: 'Each account runs one of these. A requisition takes its account’s stages when it opens.', from: 'how stages work' }, false) +
        Object.keys(TEMPLATE).map((k) => '<div class="t-tpl">' +
          '<h3 class="b-month">' + esc(TEMPLATE_NAME[k] || k) + ' <span class="b-kind">' + ACCOUNTS.filter((a) => a.tpl === k).map((a) => a.name).join(', ') + '</span></h3>' +
          '<div class="b-cuts">' + STAGE_ORDER.map((s) => {
            const on = TEMPLATE[k].indexOf(s) >= 0;
            const locked = STAGE_FIXED[s];
            return '<button class="filter-chip' + (on ? ' active' : '') + '" type="button"' + (locked ? ' disabled title="Every pipeline needs this stage"' : ' data-tpl-toggle="' + k + '|' + s + '"') +
              ' aria-pressed="' + on + '">' + esc(STAGE[s].label) + (busy(k, s) && on ? '<span class="b-cut-n">in use</span>' : '') + '</button>';
          }).join('') + '</div></div>').join('') +
      '</section>' +
      '<section class="s-block s-block-wide" aria-label="Interview templates">' +
        '<div class="s-camp-list-head"><h2 class="s-block-h">Interview templates</h2><span class="s-block-say">the agenda each interviewer follows · AiMY adds what the CV is silent on</span></div>' +
        DB.ivtpls.map((t) => '<div class="t-tpl"><h3 class="b-month">' + esc(t.title) + '</h3>' +
          t.items.map((x, i) => '<p class="t-q"><span class="t-asq-n">' + (i + 1) + '</span><input class="b-draft-in t-grow" type="text" data-tpled="' + t.id + '|' + i + '" value="' + esc(x) + '" aria-label="Agenda item ' + (i + 1) + '">' +
            '<button class="b-ghost" type="button" data-tpl-del="' + t.id + '|' + i + '" aria-label="Remove">Remove</button></p>').join('') +
          '<p class="t-acts"><button class="s-insight-lnk" type="button" data-tpl-add="' + t.id + '">Add an item</button></p></div>').join('') +
      '</section></div>';
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
  function reportsPage() {
    const reqs = deskReqs().filter((q) => q.state !== 'draft');
    const cands = reqs.reduce((l, q) => l.concat(DB.byReq[q.id]), []);
    const reached = (k) => cands.filter((c) => { const q = reqOf(c); return rank(q, k) >= 0 && rank(q, c.maxAt) >= rank(q, k); }).length;
    const n = (k) => reqs.filter((q) => q.state === k).length;
    const seats = reqs.reduce((s, q) => s + q.seats, 0);
    const hiredSeats = reqs.filter((q) => q.state === 'filled' || q.state === 'started').reduce((s, q) => s + q.seats, 0);
    const offers = DB.offers.filter((o) => DB.byId[o.cand] && reqs.indexOf(reqOf(DB.byId[o.cand])) >= 0);
    const hiredO = offers.filter((o) => o.status === 'accepted' || o.status === 'joined');
    const toHire = hiredO.length ? Math.round(hiredO.reduce((s, o) => s + (o.sentDay - reqOf(DB.byId[o.cand]).opened), 0) / hiredO.length) : null;
    const toJoin = hiredO.length ? Math.round(hiredO.reduce((s, o) => s + (o.joinDay - reqOf(DB.byId[o.cand]).opened), 0) / hiredO.length) : null;
    const sendAvg = avgSent(reqs);
    const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : 'none yet');
    const phones = reached('hr') + cands.filter((c) => c.stage === 'phone' && c.exit).length;
    const tiles = [
      ['Requisitions', reqs.length, n('cclient') + ' cancelled by the client, ' + n('cmgr') + ' by the manager'],
      ['Seats', seats, hiredSeats + ' hired, ' + reqs.filter(isOpen).reduce((s, q) => s + q.seats, 0) + ' still open'],
      ['Days to send profiles', sendAvg != null ? sendAvg : '·', 'from opening to the first profile sent, on average'],
      ['Days to hire', toHire != null ? toHire : '·', 'from opening to the offer, on average'],
      ['Days to join', toJoin != null ? toJoin : '·', 'from opening to day one, on average'],
      ['HR after the phone screen', pct(reached('hr'), phones), 'of people who passed the call went on to HR'],
      ['Technical after HR', pct(reached('tech'), reached('hr')), 'of people past HR reached the technical round'],
      ['Client after technical', pct(reached('client'), reached('sent')), 'of profiles sent got a client interview'],
    ];
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
    return '<div class="s-home">' +
      '<section class="s-block s-block-wide" aria-label="Reports">' +
        '<div class="s-camp-list-head">' + switcher('reports') + '<span class="s-block-say">' + esc(isHR() ? 'Everyone’s requisitions' : isHM() ? 'The requisitions you asked for' : 'Your requisitions') + '</span></div>' +
        '<div class="t-kpis">' + tiles.map((t) => '<div class="t-kpi"><span class="t-kpi-cap">' + esc(t[0]) + '</span><b class="t-kpi-n">' + esc(t[1]) + '</b><span class="t-kpi-say">' + esc(t[2]) + '</span></div>').join('') + '</div>' +
      '</section>' +
      '<section class="s-block s-block-wide" aria-label="Funnel"><div class="s-camp-list-head"><h2 class="s-block-h">The funnel</h2><span class="s-block-say">everyone who reached each stage · share of the stage before</span></div>' +
        '<div class="t-funnel">' + f.map((s, i) => '<div class="t-fn-row' + (i && f[i - 1].n && s.n / f[i - 1].n < 0.4 ? ' is-leak' : '') + '"><span class="t-fn-label">' + esc(STAGE[s.k].label) + '</span>' +
          bar(s.n, Math.max(1, f[0].n)) + '<span class="t-fn-n"><b>' + s.n + '</b>' + (i && f[i - 1].n ? ' · ' + Math.round(s.n / f[i - 1].n * 100) + '%' : '') + '</span></div>').join('') + '</div>' +
        aimyBlock({ text: 'The biggest drop is at the client: <b>' + pct(reached('client'), reached('sent')) + '</b> of profiles sent got an interview. ' + dropped + ' offers were declined. ' +
          repl + ' of ' + reqs.length + ' requests were replacements, and ' + bill + ' are billable.', from: 'every requisition in view' }) +
      '</section>' +
      '<section class="s-block s-block-wide" aria-label="By account"><div class="s-camp-list-head"><h2 class="s-block-h">By account</h2><span class="s-block-say">requests · open · filled</span></div>' +
        '<div class="t-funnel">' + byAcc.map((x) => '<button class="t-fn-row t-fn-btn" type="button" data-acc="' + x.a.id + '"><span class="t-fn-label">' + esc(x.a.name) + '</span>' + bar(x.n, maxAcc) +
          '<span class="t-fn-n"><b>' + x.n + '</b> · ' + x.open + ' · ' + x.hired + '</span></button>').join('') + '</div>' +
      '</section>' +
      '<section class="s-block s-block-wide" aria-label="By role"><div class="s-camp-list-head"><h2 class="s-block-h">By role</h2><span class="s-block-say">requests</span></div>' +
        '<div class="t-funnel">' + byTitle.map((x) => '<div class="t-fn-row"><span class="t-fn-label">' + esc(x.t) + '</span>' + bar(x.n, byTitle[0].n) + '<span class="t-fn-n"><b>' + x.n + '</b></span></div>').join('') + '</div>' +
      '</section>' +
      (isHR() ? '<section class="s-block s-block-wide" aria-label="By recruiter"><div class="s-camp-list-head"><h2 class="s-block-h">By recruiter</h2><span class="s-block-say">open requisitions · people in progress · days to send profiles</span></div>' +
        aimyBlock({ text: 'Per-person numbers, as the dashboard shows them today. Whether these move to AiMY QA is still a decision for the team.', from: 'the audit, decision 5' }) +
        '<div class="t-funnel">' + RECRUITERS.map((rc) => { const mineR = DB.reqs.filter((q) => q.rec === rc.id);
          const act = mineR.filter(isOpen).reduce((s, q) => s + activeOf(q).length, 0);
          return '<div class="t-fn-row"><span class="t-fn-label">' + esc(rc.name) + '</span>' + bar(mineR.filter(isOpen).length, 8) + '<span class="t-fn-n"><b>' + mineR.filter(isOpen).length + '</b> · ' + act + ' · ' + (avgSent(mineR) != null ? avgSent(mineR) : '·') + '</span></div>'; }).join('') + '</div>' +
      '</section>' : '') +
    '</div>';
  }

  /* ══ THE OTHER DESKS ═════════════════════════════════════════════════════ */
  function deskHome() { return isHM() ? hmHome() : isHR() ? hrHome() : isClient() ? clientHome() : homePage(); }
  /* What waits on this desk, each with the one way to answer it. Feeds the
     home page, the rail and the bell alike, so they cannot disagree. */
  function asks() {
    const out = [];
    if (isHM()) {
      DB.offers.filter((o) => o.status === 'approving' && o.hm !== 'ok' && DB.byId[o.cand] && reqOf(DB.byId[o.cand]).hm === DESK).forEach((o) => {
        const c = DB.byId[o.cand];
        out.push({ k: 'offer', c: c, head: 'Approve ' + first(c.name) + '’s offer', body: money(o.salary) + ' for ' + reqOf(c).title + '. ' + BU_DIRECTOR + ' approves the same packet at the same time.', go: { approve: o.id, by: 'hm' }, verb: 'Open the packet' });
      });
      DB.ivs.filter((v) => v.status === 'owed' && v.by.indexOf(me().name) === 0).forEach((v) => {
        const c = DB.byId[v.cand];
        out.push({ k: 'debrief', c: c, head: 'Your debrief on ' + c.name, body: STAGE[v.stage].label + ' ' + sayWhen(v.day) + '. About two minutes.', go: { debrief: v.id }, verb: 'Write it' });
      });
      deskReqs().filter(isOpen).forEach((q) => activeOf(q).filter((c) => c.stage === 'tech' && c.since <= 2).forEach((c) => {
        out.push({ k: 'new', c: c, head: c.name + ' is on your shortlist', body: 'Advanced to the technical round for ' + q.title + '. ' + evMet(c) + ' of ' + c.ev.length + ' must-haves met in the CV.', go: { cand: c.id }, verb: 'See them' });
      }));
      /* A client's request lands here as a draft, to be talked through. */
      DB.reqs.filter((q) => q.state === 'draft' && q.hm === DESK && DESKS[q.askedBy] && DESKS[q.askedBy].fn === 'client').forEach((q) => {
        out.push({ k: 'request', c: null, head: DESKS[q.askedBy].name + ' asked for ' + (q.title ? plural(q.seats, 'seat') + ' as ' + q.title : 'a hire'),
          body: q.desc + ' Talk it through with them, then open it.', go: { req: q.id }, verb: 'Open the draft' });
      });
    } else if (isClient()) {
      deskReqs().filter(isOpen).forEach((q) => activeOf(q).filter((c) => c.stage === 'sent').forEach((c) => {
        out.push({ k: 'sent', c: c, head: c.name + ' for ' + q.title, body: 'Sent ' + days(c.since) + ' ago. ' + evMet(c) + ' of ' + c.ev.length + ' must-haves met, verified in our interviews.', go: { cand: c.id }, verb: 'Decide', yes: true });
      }));
      DB.ivs.filter((v) => v.status === 'owed' && (v.stage === 'client' || v.stage === 'ctech') && reqOf(DB.byId[v.cand]).acc === me().acc).forEach((v) => {
        const c = DB.byId[v.cand];
        out.push({ k: 'debrief', c: c, head: 'How did ' + first(c.name) + '’s interview go?', body: STAGE[v.stage].label + ' ' + sayWhen(v.day) + '. Your feedback goes to the recruiter.', go: { debrief: v.id }, verb: 'Give feedback' });
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
      (x.yes ? '<span class="t-acts"><button class="b-ghost" type="button" data-out="' + x.c.id + '|clientno">Pass</button>' +
        '<button class="b-owed-go t-row-go" type="button" data-move="' + x.c.id + '|client">Meet them</button></span>'
        : '<button class="b-owed-go t-row-go" type="button"' + goAttr(x.go) + '>' + esc(x.verb) + '</button>') +
    '</div>').join('') + '</div>';
  }
  function hmHome() {
    const a = asks();
    const reqs = deskReqs().filter((q) => q.state !== 'draft');
    const open = reqs.filter(isOpen);
    const risky = open.filter((q) => health(q).risk);
    const accs = ACCOUNTS.filter((x) => open.some((q) => q.acc === x.id));
    return '<div class="s-home">' +
      deskBrief('Today', [
        a.length ? '<b>' + plural(a.length, 'ask') + '</b> waiting on you: ' + ['request', 'offer', 'debrief', 'new'].map((k) => { const n = a.filter((x) => x.k === k).length; return n ? n + ' ' + { offer: n === 1 ? 'offer to approve' : 'offers to approve', debrief: n === 1 ? 'debrief' : 'debriefs', new: 'new on your shortlists', request: n === 1 ? 'request from a client' : 'requests from clients' }[k] : null; }).filter(Boolean).join(', ') + '.' : 'Nothing waits on you today.',
        '<b>' + plural(open.length, 'requisition') + '</b> open across ' + plural(accs.length, 'account') + (risky.length ? ', and <b>' + risky.length + '</b> ' + (risky.length === 1 ? 'is' : 'are') + ' likely to miss the date.' : '.'),
        'You see candidates once the recruiter advances them; until then they are a count.',
      ], [
        { label: 'Approve offers', n: a.filter((x) => x.k === 'offer').length, why: 'one packet, approved in parallel', go: a.filter((x) => x.k === 'offer')[0] ? a.filter((x) => x.k === 'offer')[0].go : { on: 'reqs' } },
        { label: 'Debriefs you owe', n: a.filter((x) => x.k === 'debrief').length, why: 'two minutes each', go: a.filter((x) => x.k === 'debrief')[0] ? a.filter((x) => x.k === 'debrief')[0].go : { on: 'reqs' } },
        { label: 'Ask for a hire', why: 'or clone one you had before', data: 'new-req' },
        { label: 'Reports', why: 'your requisitions, in numbers', go: { on: 'reports' } },
      ]) +
      '<section class="s-block s-block-wide"><div class="s-camp-list-head">' + switcher('') + '</div>' +
        (a.length ? askRows(a) : '<p class="s-none">Nothing is waiting on you.</p>') + '</section>' +
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
    const load = RECRUITERS.map((rc) => ({ rc: rc, n: DB.reqs.filter((q) => q.rec === rc.id && isOpen(q)).length,
      p: DB.reqs.filter((q) => q.rec === rc.id && isOpen(q)).reduce((s, q) => s + activeOf(q).length, 0) })).sort((x, y) => y.n - x.n);
    const avgLoad = load.reduce((s, x) => s + x.n, 0) / load.length;
    const lp = DB.asmts.map((a) => { const r = qRates(a); const w = r.reduce((m, x, k) => (x != null && (m == null || x < r[m]) ? k : m), null); return w != null && r[w] < 40 ? { a: a, i: w, r: r[w] } : null; }).filter(Boolean);
    return '<div class="s-home">' +
      deskBrief('Today', [
        '<b>' + risky.length + ' of ' + open.length + '</b> open requisitions are likely to miss their date.',
        appr.length ? '<b>' + plural(appr.length, 'offer') + '</b> ' + (appr.length === 1 ? 'is' : 'are') + ' waiting on an approver. ' + (owed.length ? '<b>' + plural(owed.length, 'debrief') + '</b> ' + (owed.length === 1 ? 'is' : 'are') + ' owed, the oldest from ' + sayWhen(owed[0].day) + '.' : '') : 'No offer is waiting on an approver.',
        load[0].n > avgLoad * 1.4 ? '<b>' + esc(load[0].rc.name) + '</b> carries ' + load[0].n + ' open requisitions against an average of ' + Math.round(avgLoad) + '.' : 'The load is even across the team.',
      ], [
        { label: 'At risk', n: risky.length, why: 'each with its reason', go: { on: 'reqs', q: 'risk' } },
        { label: 'Templates', why: 'stages and interview agendas', go: { on: 'templates' } },
        { label: 'Assessments', n: lp.length || null, why: lp.length ? 'questions most people fail' : 'all reading well', go: { on: 'asmts' } },
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
      '<section class="s-block s-block-wide"><div class="s-camp-list-head"><h2 class="s-block-h">The team’s load</h2><span class="s-block-say">open requisitions · people in progress</span></div>' +
        '<div class="t-funnel">' + load.map((x) => '<div class="t-fn-row"><span class="t-fn-label">' + esc(x.rc.name) + '</span><span class="t-fn-track"><span class="t-fn-fill" style="width:' + (x.n / Math.max(1, load[0].n) * 100).toFixed(1) + '%"></span></span>' +
          '<span class="t-fn-n"><b>' + x.n + '</b> · ' + x.p + '</span></div>').join('') + '</div></section>' +
      (lp.length ? '<section class="s-block s-block-wide"><div class="s-camp-list-head"><h2 class="s-block-h">Learning proposals</h2><span class="s-block-say">AiMY proposes, you approve</span></div>' +
        '<div class="b-owed">' + lp.map((x, i) => '<div class="b-owed-row t-row" style="--i:' + i + '"><span class="b-owed-sev" aria-hidden="true"></span>' +
          '<button class="b-owed-main t-row-open" type="button" data-asmt="' + x.a.id + '"><span class="b-owed-head"><span class="b-owed-type">Reword Q' + (x.i + 1) + ' of ' + esc(x.a.title) + '</span></span>' +
          '<span class="b-owed-body">Only ' + x.r + '% get it right. When nearly everyone misses one question, the question is usually the problem.</span></button>' +
          '<button class="b-owed-go t-row-go" type="button" data-q-reword="' + x.a.id + '|' + x.i + '">Reword it</button></div>').join('') + '</div></section>' : '') +
    '</div>';
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
        (a.length ? askRows(a) : '<p class="s-none">Nothing is waiting on you.</p>') + '</section>' +
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
  let APPLY = null;
  function portalApply() {
    const q = DB.reqById[S.apply];
    const head = outsideHead('FlairsTech careers', 'Work with us');
    if (!q || !q.published || !isOpen(q)) return '<div class="t-out">' + head + '<section class="t-out-card"><h1 class="t-out-h">This role is not open to applications.</h1>' +
      '<p>It may have been filled or taken down. Other roles are on the careers page.</p></section></div>';
    if (!APPLY || APPLY.req !== q.id) APPLY = { req: q.id, step: 'hello', i: 0, f: null, consent: false, wa: false };
    const said = [];
    const ai = (t) => said.push('<div class="t-chat-ai">' + mark(14) + '<p>' + t + '</p></div>');
    const you = (t) => said.push('<div class="t-chat-you"><p>' + esc(t) + '</p></div>');
    ai('Hi. I can take your application for <b>' + esc(q.title) + '</b> right here. Drop your CV in and I will read it; you only fill in what it does not say.');
    let input = '';
    if (APPLY.step === 'hello') {
      input = '<label class="t-drop t-drop-sm" for="applyFile">' + svg('upload', 18) + '<b>Attach your CV</b><span>PDF or Word</span><input class="t-file" id="applyFile" type="file" accept=".pdf,.doc,.docx" data-apply-file></label>' +
        '<p class="t-acts"><button class="s-insight-lnk" type="button" data-apply-sample>Use a sample CV</button></p>';
    } else if (APPLY.step === 'reading') {
      you(APPLY.file);
      said.push('<div class="t-chat-ai">' + mark(14) + '<p><span class="t-shimmer" data-text="Reading your CV">Reading your CV</span></p></div>');
    } else {
      you(APPLY.file);
      const f = APPLY.f;
      ai('Thanks, ' + esc(first(f.name)) + '. I read ' + plural(f.years, 'year') + ' of experience, now ' + esc(lower(f.at)) + '.' +
        (APPLY.cv.phone ? '' : ' <b>Your CV has no phone number.</b> Add one so the recruiter can call you.'));
      if (APPLY.step === 'done') {
        ai('Sent. A person on the recruiting team reads every application, and you will hear back either way.');
        input = '<div class="t-done">' + successCheck() + '<p>Your own profile, to see where you stand and update your details:</p>' +
          '<p><b class="t-link-text">' + esc(profileLink(DB.byId[APPLY.cand])) + '</b></p>' +
          '<p class="t-acts"><button class="s-insight-lnk primary" type="button"' + goAttr({ me: DB.byId[APPLY.cand].pid }) + '>Open my profile</button></p></div>';
      } else {
        input = '<div class="t-apply-form">' +
          '<label class="dial-cap" for="applyPhone">Phone</label><input class="dial-input" id="applyPhone" type="tel" data-apply-in="phone" value="' + esc(f.phone || '') + '" placeholder="+20 10 1234 5678">' +
          '<label class="dial-cap" for="applyMail">Email</label><input class="dial-input" id="applyMail" type="email" data-apply-in="email" value="' + esc(f.email || '') + '">' +
          '<div class="t-input-wrap" id="wrapConsent"><div class="t-input">' +
            '<p class="t-q"><button class="t-check' + (APPLY.consent ? ' is-on' : '') + '" type="button" data-apply-consent="consent" aria-pressed="' + APPLY.consent + '" aria-label="Agree to the use of my CV">' + (APPLY.consent ? svg('check', 12) : '') + '</button>' +
              '<span>I agree to my CV and details being used for this application. A person decides; AiMY organises. <b>Required</b></span></p>' +
            '<p class="t-q"><button class="t-check' + (APPLY.wa ? ' is-on' : '') + '" type="button" data-apply-consent="wa" aria-pressed="' + APPLY.wa + '" aria-label="WhatsApp updates">' + (APPLY.wa ? svg('check', 12) : '') + '</button>' +
              '<span>Also update me on WhatsApp about this application. Optional.</span></p>' +
          '</div><p class="t-error-msg">Tick the first box to send your application.</p></div>' +
          '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-apply-send>Send my application</button></p></div>';
      }
    }
    return '<div class="t-out t-out-wide">' + head +
      '<div class="t-careers">' +
        '<section class="t-out-card">' +
          '<p class="t-out-kicker">' + esc(q.level) + ' · ' + esc(q.place) + ' · ' + esc(q.acc === 'flairs' ? 'FlairsTech' : 'For a ' + q.domain.toLowerCase() + ' client') + '</p>' +
          '<h1 class="t-out-h">' + esc(q.title) + '</h1>' +
          '<p>' + esc(String(q.desc || '').replace(/ for [A-Z][\w ]+, a /, ' for a ')) + '</p>' +
          '<h2 class="t-out-sub">What we look for</h2><ul class="t-out-list">' + q.must.map((m) => '<li>' + esc(m) + '</li>').join('') + '</ul>' +
          '<p class="b-vfoot">No salary is published. The recruiter talks it through on the first call.</p>' +
        '</section>' +
        '<section class="t-out-card t-chat" aria-label="Apply with AiMY">' + said.join('') + input + '</section>' +
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
  function portalMe() {
    const list = DB.cands.filter((c) => c.pid === S.me);
    const head = outsideHead('Your profile', 'FlairsTech careers');
    if (!list.length) return '<div class="t-out">' + head + '<p class="s-none">This link has expired.</p></div>';
    const p = list[0];
    if (!ME_OK[S.me]) return '<div class="t-out">' + head + '<section class="t-out-card">' +
      '<h1 class="t-out-h">Hi ' + esc(first(p.name)) + '</h1><p>We sent a six-digit code to ' + esc(p.phone ? p.phone.replace(/\d(?=\d{4})/g, '•') : 'your email') + '. Enter it to open your profile.</p>' +
      '<div class="t-input-wrap" id="wrapCode"><input class="dial-input t-input t-code" id="meCode" type="text" inputmode="numeric" maxlength="6" placeholder="6 digits" aria-label="Code">' +
      '<p class="t-error-msg">That needs six digits.</p></div>' +
      '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-me-code>Open my profile</button></p>' +
      '<p class="b-vfoot">This prototype accepts any six digits.</p></section></div>';
    const send = (c) => DB.sends.filter((x) => x.cand === c.id && x.status === 'sent')[0];
    return '<div class="t-out">' + head +
      '<section class="t-out-card"><h1 class="t-out-h">' + esc(p.name) + '</h1><p>' + esc(p.at) + '</p>' +
        '<h2 class="t-out-sub">Your applications</h2>' +
        list.map((c) => '<div class="t-me-app"><p><b>' + esc(reqOf(c).title) + '</b></p>' +
          '<p>' + esc(c.exit ? (c.exit === 'withdrew' ? 'You withdrew' : 'Not going further this time. Thank you for your time.') : PLAIN[c.stage]) + '</p>' +
          (send(c) ? '<p class="t-acts"><button class="s-insight-lnk primary" type="button"' + goAttr({ take: send(c).id }) + '>Take the assessment</button></p>' : '') +
          (!c.exit && c.stage !== 'joined' && c.stage !== 'accepted' ? '<p class="t-acts"><button class="b-ghost" type="button" data-me-withdraw="' + c.id + '">Withdraw this application</button></p>' : '') +
        '</div>').join('') +
        '<h2 class="t-out-sub">What you told us</h2>' +
        '<div class="t-apply-form">' +
          '<label class="dial-cap" for="mePhone">Phone</label><input class="dial-input" id="mePhone" type="tel" data-me-in="phone" value="' + esc(p.phone || '') + '">' +
          '<label class="dial-cap" for="meMail">Email</label><input class="dial-input" id="meMail" type="email" data-me-in="email" value="' + esc(p.email || '') + '">' +
          '<label class="dial-cap" for="mePlace">Where you live</label><input class="dial-input" id="mePlace" type="text" data-me-in="place" value="' + esc(p.place || '') + '">' +
          '<p class="t-acts"><button class="btn btn-brand btn-sm" type="button" data-me-save>Save my details</button></p></div>' +
        '<p class="b-vfoot">You can ask us to delete your profile at any time by replying to any message from us.</p>' +
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
  };
  const msgAvatar = (who) => who === 'you'
    ? '<div class="msg-avatar user-av">' + esc(me().name.split(' ').map((w) => w[0]).join('').slice(0, 2)) + '</div>'
    : '<div class="msg-avatar aimy-av">' + mark(14) + '</div>';
  const turnHtml = (t) => t.who === 'you'
    ? '<div class="chat-msg user">' + msgAvatar('you') + '<div class="msg-bubble">' + t.html + '</div></div>'
    : '<div class="chat-msg aimy">' + msgAvatar('aimy') + '<div class="msg-bubble">' + t.html +
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
    const tags = [isHR() ? 'Every requisition' : isClient() ? accOf(deskReqs()[0] || DB.reqs[0]).name + '’s requisitions' : 'Your requisitions'];
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
    byId('overlayInput').focus();
  }
  function closeCanvas() {
    byId('aimyOverlay').classList.remove('open');
    chatsDrawer(false);
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
    if (isClient() && /\b(need|hire|hiring|request|another|more|want)\b/.test(lc)) { clientRequest(t); return; }
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
    if (/\b(find|search|source|look for|looking for)\b/.test(lc) && (isRec() || isHR())) {
      FIND.q = t; FIND.req = reqMatch ? reqMatch.id : null; FIND.step = 'ask';
      go({ on: 'find' });
      runFind();
      peekHide();
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
        '</div>' +
      '</section>' +
      (sent ? '<section class="s-insight is-lead s-block-wide" aria-label="How much they take">' +
        '<div class="s-lead-mark"><svg class="s-insight-mark" viewBox="0 0 18 20" width="14" height="14" aria-hidden="true"><use href="#aimy-logo-small"/></svg><span class="work-state ws-detected">Read off the record</span></div>' +
        '<div class="s-lead-line"><span class="s-lead-n">' + met + '</span><span class="s-lead-say">of the <span class="s-lead-of">' + sent + '</span> profiles we sent got a client interview.</span></div>' +
        '<p class="s-lead-deck">' + (avg != null ? 'It takes ' + days(avg) + ' on average to send their first profile on a requisition.' : '') + '</p></section>' : '') +
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
    /* Adding someone carries the requisition they are for, so it is asked
       before the requisition's own page. */
    byId('wbStage').innerHTML = S.on === 'add' && isRec() ? addPage() : S.cand ? candPage() : S.req ? reqPage() : S.asmt ? asmtPage() : S.acc ? accPage()
      : S.on === 'reqs' ? reqsPage() : S.on === 'calls' && isRec() ? callsPage() : S.on === 'find' ? findPage()
      : S.on === 'asmts' ? asmtsPage() : S.on === 'templates' ? templatesPage()
      : S.on === 'reports' ? reportsPage() : deskHome();
    paintRail();
    paintBell();
    paintProto();
    paintDial();
    requestAnimationFrame(placeSwitchBar);
    requestAnimationFrame(afterPaint);
  }

  /* ── The bell: what is waiting on a person, every row ending in a record. */
  function paintBell() {
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
  function move(c, to) {
    const was = { stage: c.stage, since: c.since, meet: c.meet, fb: c.fb, maxAt: c.maxAt, exit: c.exit, nudged: c.nudged };
    const q = reqOf(c);
    const fields = { stage: to, since: 0, fb: false, nudged: null,
      meet: MEETS[to] ? 2 : null, slot: c.slot || '11:00',
      maxAt: rank(q, to) > rank(q, c.maxAt) ? to : c.maxAt };
    write(c, fields);
    /* AiMY books the next interview inside the interviewer's free slots and
       tells the candidate from the booking (do and notify). */
    const tpl = tplFor(to);
    const iv = MEETS[to] ? make('ivs', { id: uid('iv'), cand: c.id, stage: to, day: 2, slot: fields.slot, by: interviewerFor(q, to), mode: 'person',
      status: 'booked', ratings: null, notes: null, verdict: null, recording: null, tpl: tpl ? tpl.id : null }) : null;
    const o = offerOf(c);
    const oWas = o ? { status: o.status, joinDay: o.joinDay } : null;
    if (to === 'joined' && o) put('offers', o, { status: 'joined', joinDay: 0 });
    const e = note(c, 'move', 'Moved to ' + lower(STAGE[to].label) + ' by ' + me().name + '.');
    paint();
    toast('Moved ' + first(c.name) + ' to ' + lower(STAGE[to].label), () => {
      write(c, was); if (iv) unmake('ivs', iv); if (o) put('offers', o, oWas); unmake('events', e); paint();
      toast('Put back', null, c.name + ' is at ' + lower(STAGE[was.stage].label) + ' again.');
    },
      MEETS[to] ? 'AiMY booked it for ' + sayDay(2) + ' with ' + interviewerFor(q, to) + ' and tells them from the booking.'
        : to === 'sent' ? 'Sent to ' + accOf(q).name + '. They will be asked once, and nudged if they go quiet.'
        : to === 'offer' ? 'Prepare the offer from their card.' : to === 'assess' ? 'Send the assessment from their card.' : null);
  }
  function out(c, k) {
    const was = { exit: c.exit, since: c.since };
    write(c, { exit: k, since: 0 });
    const e = note(c, 'out', EXIT[k].label + ', marked by ' + me().name + '.');
    paint();
    toast(first(c.name) + ': ' + EXIT[k].label.toLowerCase(), () => { write(c, was); unmake('events', e); paint(); toast('Put back', null, c.name + ' is in progress again.'); },
      k === 'out' ? 'Nothing is sent to them until a person approves the message.' : k === 'clientno' && isClient() ? 'The recruiter sees your answer at once.' : null);
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
      put('reqs', q, { rec: p[1] }); paint();
      toast('Assigned to ' + RECRUITERS.filter((x) => x.id === p[1])[0].name, () => { put('reqs', q, { rec: was }); paint(); },
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
    if ((el = at('[data-find-again]'))) { FIND.step = 'ask'; paint(); return; }
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
    if ((el = at('[data-q-reword]'))) {
      const p = two('data-q-reword'), a = asmtOf(p[0]), qs = JSON.parse(JSON.stringify(a.questions)), i = Number(p[1]);
      const qq = qs[i];
      qq.q = qq.type === 'choice' ? 'In one line: ' + qq.q.replace(/^what does /i, 'what does ').replace(/\?$/, '') + '? Pick the closest answer.' : qq.q + ' Answer with one example from your own work.';
      if (qq.type === 'choice' && qq.options) qq.options = qq.options.map((o, k) => (k === qq.right ? o + ' (the most common cause)' : o));
      DB.sends.filter((s) => s.asmt === a.id && s.answers).forEach((s) => { const an = s.answers.slice(); an[i] = null; put('sends', s, { answers: an }); });
      asmtSet(a, { questions: qs }, 'AiMY reworded Q' + (i + 1));
      if (!S.asmt) go({ asmt: a.id });
      return;
    }
    /* ── Templates ── */
    if ((el = at('[data-tpl-toggle]'))) { const p = two('data-tpl-toggle'); toggleStage(p[0], p[1]); return; }
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
    if ((el = at('[data-me-withdraw]'))) {
      const c = DB.byId[val('data-me-withdraw')];
      write(c, { exit: 'withdrew', since: 0 });
      const e = note(c, 'out', 'Withdrew on their own profile.');
      paint();
      toast('Withdrawn', () => { write(c, { exit: null }); unmake('events', e); paint(); }, 'The recruiter is told. You can apply again any time.');
      return;
    }
    if ((el = at('[data-me-save]'))) {
      const f = { phone: byId('mePhone').value.trim(), email: byId('meMail').value.trim(), place: byId('mePlace').value.trim() };
      DB.cands.filter((c) => c.pid === S.me).forEach((c) => { write(c, f); });
      paint(); toast('Saved your details', null, 'The recruiting team sees them now.');
      return;
    }
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
    if ((el = at('[data-call-mode]'))) { CALL.video = el.getAttribute('data-call-mode') === 'video'; paintCall(); return; }
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
    if (!text) {
      const inp = byId('floatInput');
      inp.placeholder = 'Who do you need? For example: two more support engineers by December';
      inp.focus();
      peek('Tell me who you need in the bar below, in your own words. I pass it to ' + esc(HMS.filter((h) => h.id === ACCOUNTS.filter((a) => a.id === me().acc)[0].hm)[0].name) + ' as a draft.', []);
      return;
    }
    const acc = ACCOUNTS.filter((a) => a.id === me().acc)[0];
    const p = parseRole(text);
    const am = HMS.filter((h) => h.id === acc.hm)[0].name;
    const q = make('reqs', { id: uid('r'), title: p.title, fam: famOf(p.title), level: p.level, must: [], acc: acc.id, tpl: acc.tpl, hm: acc.hm, rec: 'omar', seats: p.seats,
      kind: 'new', billable: true, state: 'draft', opened: 0, target: expDays(acc.tpl), place: 'Nasr City office', plan: null, domain: acc.domain, published: false,
      budget: { min: BUDGETS[p.level][0], max: BUDGETS[p.level][1] }, desc: me().name + ' at ' + acc.name + ' asked: “' + text.replace(/[.!?]$/, '') + '.”', asmt: null, askedBy: DESK });
    byId('floatInput').placeholder = 'Ask AiMY, or find a requisition or a candidate…';
    peekHide();
    paint();
    toast('Sent to ' + am + ', your account manager', () => { unmake('reqs', q); paint(); },
      (p.title ? plural(p.seats, 'seat') + ' as ' + p.title + '. ' : '') + 'She talks it through with you before it opens.');
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
    if (e.target.id === 'overlayInput' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); canvasAsk(e.target.value); return; }
    if (e.target.id === 'liveIn' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); liveSend(); return; }
    if (e.key === 'Escape' && canvasShown()) { closeCanvas(); return; }
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

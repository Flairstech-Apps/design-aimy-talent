/* AiMY Talent v2 · vocabulary and seed data.
   Days are whole numbers relative to today (0 = Tue 27 Oct 2026; -3 = three
   days ago). Every person and company is invented. The reports' Aug–Sep
   figures are the stakeholder's real dashboard (39 requests, 6 recruiters). */
(function () {
  const T = (window.T = window.T || {});

  T.TODAY = new Date(2026, 9, 27);

  // Who uses the product. Desks are switched from the profile pill; the
  // candidate, the interviewer and the approvers arrive from a link instead.
  T.STAFF = {
    omar:    { name: 'Omar Saeed',    role: 'Recruiter' },
    lina:    { name: 'Lina Fathy',    role: 'Recruiter' },
    karim:   { name: 'Karim Adel',    role: 'Recruiter' },
    rania:   { name: 'Rania Samir',   role: 'Hiring manager' },
    dina:    { name: 'Dina Ragab',    role: 'HR Manager' },
    hesham:  { name: 'Hesham Nabil',  role: 'BU Director' },
    jana:    { name: 'Jana Weber',    role: 'Client · Northwind Software' },
    mostafa: { name: 'Mostafa Hamdy', role: 'Technical interviewer' },
    sara:    { name: 'Sara Lotfy',    role: 'HR interviewer' },
  };
  T.DESKS = [
    { id: 'omar',  label: 'Recruiter',      home: 'today' },
    { id: 'rania', label: 'Hiring manager', home: 'asks' },
    { id: 'dina',  label: 'HR Manager',     home: 'hr' },
    { id: 'jana',  label: 'Client',         home: 'client' },
  ];

  // Stage library. `who` is who the next move waits on, `exp` the usual days
  // before it counts as waiting too long, `go` the verb that moves it on.
  T.STAGES = {
    sourced:  { label: 'Sourced',               who: 'me',          exp: 3,  go: 'They want to talk' },
    applied:  { label: 'Applied',               who: 'me',          exp: 2,  go: 'Book the call' },
    assess:   { label: 'Assessment',            who: 'candidate',   exp: 3,  go: 'Passed the assessment' },
    phone:    { label: 'Phone screen',          who: 'me',          exp: 2,  go: 'Passed the call' },
    hr:       { label: 'HR interview',          who: 'me',          exp: 3,  go: 'Passed HR' },
    tech:     { label: 'Technical interview',   who: 'interviewer', exp: 4,  go: 'Send the profile' },
    mgr:      { label: 'Managerial interview',  who: 'manager',     exp: 3,  go: 'Passed' },
    sent:     { label: 'Profile sent',          who: 'client',      exp: 3,  go: 'Client wants to meet' },
    client:   { label: 'Client interview',      who: 'client',      exp: 5,  go: 'Client said yes' },
    ctech:    { label: 'Client technical',      who: 'client',      exp: 5,  go: 'Client said yes' },
    offer:    { label: 'Offer',                 who: 'candidate',   exp: 4,  go: 'Accepted' },
    accepted: { label: 'Accepted',              who: 'candidate',   exp: 40, go: 'Joined' },
    joined:   { label: 'Joined',                who: null,          exp: 0,  go: null },
  };
  // One template per account, drawn from the one library, so reports can
  // count by stage key across clients.
  T.TEMPLATES = {
    client:    { label: 'Client roles',       stages: ['sourced','applied','phone','hr','tech','sent','client','offer','accepted','joined'] },
    northwind: { label: 'Northwind Software', stages: ['sourced','applied','assess','phone','hr','tech','sent','client','ctech','offer','accepted','joined'] },
    internal:  { label: 'FlairsTech roles',   stages: ['sourced','applied','phone','hr','tech','mgr','offer','accepted','joined'] },
  };
  T.FIXED = ['sourced','applied','phone','offer','accepted','joined'];

  // Exits are reasons, not stages.
  T.EXITS = {
    out:      'Not progressing',
    withdrew: 'Withdrew',
    clientno: 'Client declined',
    offerno:  'Offer declined',
  };
  // A held exit is owed an answer within this many days (M4).
  T.TELL_WITHIN = 5;

  // The fixed list a client picks one from when they pass (P1).
  T.REASONS = {
    lang:   'Spoken language below need',
    exp:    'Experience too junior',
    salary: 'Salary above range',
    notice: 'Notice period too long',
    skills: 'Skills gap',
    other:  'Other',
  };
  T.REASON_SHORT = { lang: 'spoken language', exp: 'experience', salary: 'salary', notice: 'notice period', skills: 'a skills gap', other: 'another reason' };

  T.VERDICT = {
    meets:   { label: 'Meets',     tone: 'ok' },
    partly:  { label: 'Partly',    tone: 'warn' },
    not:     { label: 'Not met',   tone: 'bad' },
    unknown: { label: 'Not known', tone: 'muted' },
  };
  T.CHECK = {
    confirmed: { label: 'Confirmed',   tone: 'ok' },
    differs:   { label: 'Differs',     tone: 'warn' },
    unchecked: { label: 'Not checked', tone: 'muted' },
  };

  // What AiMY may do, per action (m4). Only a person moves a rung up; an
  // override moves it down. Decline and offer are a person's every time.
  T.RUNGS = ['Suggest', 'Do with Undo', 'Do and tell'];

  // Each figure has one definition: unit, start event, stop event (D11).
  T.METRICS = [
    { k: 'Days to send profiles', unit: 'requisition', start: 'Requisition opened', stop: 'First profile sent to the client', v: '14 days', note: 'The number clients feel.' },
    { k: 'Days to hire',          unit: 'person',      start: 'Requisition opened', stop: 'Offer accepted', v: '32 days', note: '' },
    { k: 'Days to join',          unit: 'person',      start: 'Requisition opened', stop: 'First day at work', v: '54 days', note: 'Joining, not acceptance, is the finish line.' },
    { k: 'Hired',                 unit: 'person',      start: '', stop: 'Offer accepted', v: '21', note: 'The old tile said 13: that counted vacancies filled, a different unit.' },
    { k: 'Vacancies filled',      unit: 'vacancy',     start: '', stop: 'Seat has a person who joined', v: '13', note: '' },
    { k: 'Profiles per client interview', unit: 'sendout', start: 'Profile sent', stop: 'Client interview held', v: '3.4', note: 'Agency norm 3 to 5; the benchmark is weak.' },
    { k: '90-day retention',      unit: 'person',      start: 'Joined', stop: 'Still employed on day 90', v: '—', note: 'Shown once 20 day-90 check-ins exist.' },
  ];

  // The stakeholder's Power BI dashboard, Aug–Sep 2026.
  T.HISTORY = {
    scope: 'Requests opened Aug–Sep 2026 · 39 requests · 45 vacancies · 6 recruiters',
    funnel: [
      ['Passed phone screen', 268], ['Accepted at HR', 190], ['Accepted at technical', 102],
      ['Profile sent to client', 81], ['Accepted at client interview', 24], ['Hired', 21],
    ],
  };

  T.seed = function seed() {
    const DB = { v: 3, seq: 100 };

    DB.accounts = {
      nw: { id: 'nw', name: 'Northwind Software', template: 'northwind', contact: 'jana', billable: true,
            news: 'Opening a second support hub in Leipzig in Q1: expect more German-speaking roles.' },
      ks: { id: 'ks', name: 'Kestrel Labs',       template: 'client',    contact: null, billable: true },
      vm: { id: 'vm', name: 'Valmont Accounting', template: 'client',    contact: null, billable: true },
      ft: { id: 'ft', name: 'FlairsTech',         template: 'internal',  contact: null, billable: false },
    };

    const crit = (id, text, must) => ({ id, text, must });
    DB.reqs = {
      r1: { id: 'r1', title: 'Bilingual Technical Support (German)', acc: 'nw', seats: 3, owner: 'omar', hm: 'rania',
            opened: -24, target: 6, state: 'open', published: true, kind: 'Replacement', budget: '28–34k EGP a month',
            criteria: [crit('c1', 'Spoken German, C1', true), crit('c2', 'Ticketing tool, 1 year+ (Zendesk or Freshdesk)', true),
                       crit('c3', 'L2 troubleshooting', true), crit('c4', 'Rotating shifts', true), crit('c5', 'Networking basics', false)],
            critVer: 'v3 · Rania Samir, 14 Oct', firstSent: -3 },
      r2: { id: 'r2', title: 'Senior Accountant', acc: 'vm', seats: 2, owner: 'omar', hm: 'rania',
            opened: -18, target: 12, state: 'open', published: true, kind: 'New role', budget: '40–48k EGP a month',
            criteria: [crit('c1', 'IFRS reporting, 4 years+', true), crit('c2', 'Month-end close', true),
                       crit('c3', 'English, written', true), crit('c4', 'Oracle NetSuite', false)],
            critVer: 'v1 · Rania Samir, 9 Oct', firstSent: -5 },
      r3: { id: 'r3', title: 'Customer Support Agent (English)', acc: 'ks', seats: 4, owner: 'lina', hm: 'rania',
            opened: -30, target: -2, state: 'open', published: true, kind: 'Replacement', budget: '18–22k EGP a month',
            criteria: [crit('c1', 'English, C1', true), crit('c2', 'Customer-facing, 1 year+', true), crit('c3', 'Night shifts', true)],
            critVer: 'v2 · Rania Samir, 2 Oct', firstSent: -12 },
      r4: { id: 'r4', title: 'Operations Coordinator', acc: 'ft', seats: 1, owner: 'omar', hm: 'rania',
            opened: -9, target: 21, state: 'open', published: false, kind: 'New role', budget: '22–26k EGP a month',
            criteria: [crit('c1', 'Scheduling across teams', true), crit('c2', 'Excel, advanced', true), crit('c3', 'Arabic and English', true)],
            critVer: 'v1 · Dina Ragab, 18 Oct', firstSent: null },
      r5: { id: 'r5', title: 'Technical Support L1 (Arabic and English)', acc: 'nw', seats: 2, owner: 'karim', hm: 'rania',
            opened: -12, target: 18, state: 'open', published: true, kind: 'Replacement', budget: '20–24k EGP a month',
            criteria: [crit('c1', 'Arabic and English, spoken', true), crit('c2', 'Ticketing tool', true), crit('c3', 'Windows troubleshooting', true)],
            critVer: 'v1 · Rania Samir, 15 Oct', firstSent: null },
      r6: { id: 'r6', title: 'IT Helpdesk Engineer', acc: 'ks', seats: 1, owner: 'omar', hm: 'rania',
            opened: -40, target: -5, state: 'onhold', published: false, kind: 'Replacement', budget: '24–28k EGP a month',
            criteria: [crit('c1', 'Active Directory', true), crit('c2', 'Hardware support', true)],
            critVer: 'v1 · Rania Samir, 17 Sep', firstSent: -20, holdNote: 'Kestrel froze hiring until their budget review on 10 Nov.' },
      r0: { id: 'r0', title: 'Technical Support (German), summer intake', acc: 'nw', seats: 4, owner: 'omar', hm: 'rania',
            opened: -110, target: -60, state: 'filled', published: false, kind: 'Replacement', budget: '28–34k EGP a month',
            criteria: [crit('c1', 'Spoken German, C1', true), crit('c2', 'Ticketing tool', true)],
            critVer: 'v2', firstSent: -98 },
    };

    // Candidates: one lifelong record. `cv` is what the CV says per criterion
    // (the candidate's own layer); `found` is what an interview or assessment
    // verified (ours). Consent is dated; WhatsApp only with an opt-in (P9).
    const P = (id, name, city, headline, source, consent, extra) =>
      Object.assign({ id, name, city, headline, source, consent, found: {}, notes: [] }, extra || {});
    const C = (cv, wa, rec) => ({ cv, wa, rec });

    DB.cands = {
      mariam: P('mariam', 'Mariam Khaled', 'Cairo', 'L2 support engineer, German and English', 'Talent pool', C(-30, -30, -10), {
        cvSays: { c1: 'C1, fluent', c2: 'Zendesk admin, 2 years', c3: 'L2 engineer at a SaaS firm', c4: 'Worked 24/7 rota', c5: 'CCNA coursework' },
        found: {
          c1: { text: 'B2 on technical terms; strong otherwise', status: 'differs', src: 'Technical interview, 12 Oct · 14:32' },
          c2: { text: 'Built triggers and SLAs', status: 'confirmed', src: 'HR interview, 8 Oct · 06:10' },
          c3: { text: 'Solved the scenario in 6 of 8 steps', status: 'confirmed', src: 'Assessment, 5 Oct · Q2–Q4' },
        } }),
      youssef: P('youssef', 'Youssef Adel', 'Giza', 'Technical support, German C1 (Goethe certificate)', 'Applied · careers link', C(-16, -16, null), {
        cvSays: { c1: 'C1, Goethe certificate 2024', c2: 'Freshdesk, 18 months', c3: 'L1 to L2 escalations', c4: 'Not stated', c5: 'Home lab' },
        found: { c1: { text: 'Fluent on a 10-minute technical call', status: 'confirmed', src: 'Phone screen, 19 Oct' } } }),
      nour: P('nour', 'Nour Hassan', 'Alexandria', 'Bilingual service desk analyst', 'Talent pool', C(-40, -40, -14), {
        cvSays: { c1: 'Native-level, grew up in Munich', c2: 'ServiceNow and Zendesk', c3: 'Network and VPN tickets', c4: 'Night shifts for 2 years', c5: 'Not stated' },
        found: { c1: { text: 'Native speaker, confirmed', status: 'confirmed', src: 'HR interview, 13 Oct' },
                 c3: { text: 'Walked through a VPN outage end to end', status: 'confirmed', src: 'Technical interview, 16 Oct' } } }),
      ahmed: P('ahmed', 'Ahmed Fawzy', 'Cairo', 'Support engineer, German B2–C1', 'Referral', C(-14, null, -1), {
        cvSays: { c1: 'C1', c2: 'Zendesk, 1 year', c3: 'L2 for a hosting company', c4: 'Yes', c5: 'Linux and DNS' } }),
      salma: P('salma', 'Salma Ibrahim', 'Cairo', 'Customer support, German and English', 'Applied · careers link', C(-9, -9, null), {
        cvSays: { c1: 'C1', c2: 'Freshdesk, 1 year', c3: 'Not stated', c4: 'Yes', c5: 'Not stated' } }),
      hana: P('hana', 'Hana Mostafa', 'Mansoura', 'IT support, German B2', 'Applied · careers link', C(-7, -7, null), {
        cvSays: { c1: 'B2, studying for C1', c2: 'Jira Service Management, 2 years', c3: 'L2 desktop and network', c4: 'Yes', c5: 'CompTIA Network+' } }),
      tarek: P('tarek', 'Tarek Samy', 'Cairo', 'Helpdesk technician, German', 'Talent pool', C(-60, null, null), {
        cvSays: { c1: 'C1', c2: 'Zendesk', c3: 'Not stated', c4: 'Not stated', c5: 'Not stated' } }),
      laila: P('laila', 'Laila Sherif', 'Cairo', 'Support specialist, German and Arabic', 'Applied · careers link', C(-1, -1, null), {
        cvSays: { c1: 'C1, studied in Berlin', c2: 'Zendesk, 3 years', c3: 'L2 for payments', c4: 'Yes', c5: 'Not stated' } }),
      reda: P('reda', 'Mohamed Reda', 'Cairo', 'Technical support lead, German speaker', 'Public web · company page', { cv: null, wa: null, rec: null }, {
        prospect: true, webSrc: 'Team page, nilecloud.example', cvSays: { c1: 'German speaker (page bio)', c2: 'Not stated', c3: 'Leads an L2 team', c4: 'Not stated', c5: 'Not stated' } }),
      habiba: P('habiba', 'Habiba Lotfy', 'Giza', 'Support engineer, German', 'Public web · GitHub', { cv: null, wa: null, rec: null }, {
        prospect: true, webSrc: 'GitHub profile README', cvSays: { c1: '"Deutsch: fließend" in profile', c2: 'Not stated', c3: 'Writes support tooling', c4: 'Not stated', c5: 'Networking scripts' } }),
      karimm: P('karimm', 'Karim Mansour', 'Cairo', 'Support agent, German', 'Talent pool', C(-50, -50, -30), {
        cvSays: { c1: 'C1', c2: 'Zendesk', c3: 'L2', c4: 'Yes', c5: 'No' } }),
      rana: P('rana', 'Rana Adel', 'Cairo', 'Support engineer, German B2', 'Applied · careers link', C(-35, -35, null), {
        cvSays: { c1: 'B2+', c2: 'Freshdesk', c3: 'L2', c4: 'Yes', c5: 'Yes' } }),
      dalia: P('dalia', 'Dalia Fouad', 'Tanta', 'Customer care, German A2', 'Applied · careers link', C(-15, -15, null), {
        cvSays: { c1: 'A2', c2: 'Not stated', c3: 'Not stated', c4: 'Yes', c5: 'Not stated' } }),
      sherif: P('sherif', 'Sherif Gamal', 'Cairo', 'Field technician, German B1', 'Talent pool', C(-70, null, null), {
        cvSays: { c1: 'B1', c2: 'Not stated', c3: 'Hardware repair', c4: 'Yes', c5: 'Yes' } }),
      mona: P('mona', 'Mona Saber', 'Cairo', 'Senior accountant, IFRS, Big Four', 'Talent pool', C(-25, -25, -12), {
        cvSays: { c1: '6 years, IFRS 15 and 16', c2: 'Led month-end for 3 entities', c3: 'Yes', c4: 'NetSuite, 2 years' },
        found: { c1: { text: 'Explained IFRS 16 lease restatement clearly', status: 'confirmed', src: 'Technical interview, 15 Oct' } } }),
      hossam: P('hossam', 'Hossam Ali', 'Giza', 'Accountant, 5 years', 'Applied · careers link', C(-20, -20, null), {
        cvSays: { c1: '5 years', c2: 'Yes', c3: 'Yes', c4: 'Not stated' } }),
      aya: P('aya', 'Aya Kamal', 'Cairo', 'Financial reporting analyst', 'Applied · careers link', C(-4, null, null), {
        cvSays: { c1: '4 years, local GAAP and IFRS', c2: 'Yes', c3: 'Yes', c4: 'Not stated' } }),
      fady: P('fady', 'Fady Wahba', 'Cairo', 'Junior accountant', 'Applied · careers link', C(-14, -14, null), {
        cvSays: { c1: '2 years', c2: 'Supported', c3: 'Yes', c4: 'No' } }),
      eman: P('eman', 'Eman Gaber', 'Cairo', 'Operations assistant', 'Applied · careers link', C(-2, -2, null), {
        cvSays: { c1: 'Rosters for 40 staff', c2: 'Pivot tables, macros', c3: 'Both, native Arabic' } }),
      amr: P('amr', 'Amr Ezzat', 'Cairo', 'L1 support, Arabic and English', 'Applied · careers link', C(-5, -5, null), {
        cvSays: { c1: 'Both', c2: 'Zendesk', c3: 'Yes' } }),
      reem: P('reem', 'Reem Tawfik', 'Cairo', 'Service desk, Arabic and English', 'Talent pool', C(-30, -30, null), {
        cvSays: { c1: 'Both', c2: 'Freshdesk', c3: 'Yes' } }),
      nadine: P('nadine', 'Nadine Samir', 'Cairo', 'Customer support, English C1', 'Applied · careers link', C(-28, -28, -20), {
        cvSays: { c1: 'C1', c2: '2 years', c3: 'Yes' } }),
      bassem: P('bassem', 'Bassem Youssef', 'Cairo', 'Technical support, German C1', 'Talent pool', C(-120, -120, -100), {
        cvSays: { c1: 'C1', c2: 'Zendesk' },
        found: { c1: { text: 'C1 confirmed on a technical call', status: 'confirmed', src: 'Client interview, 14 Aug' },
                 c2: { text: 'Configured macros and views', status: 'confirmed', src: 'Technical interview, 9 Aug' } } }),
    };

    // Applications: a candidate on one requisition. `ev` is the evidence per
    // criterion, one letter each in criteria order: m meets, p partly, n not, u not known.
    let n = 0;
    const A = (cand, req, stage, since, ev, extra) => {
      const id = 'a' + (++n);
      return [id, Object.assign({ id, cand, req, stage, since, ev, exit: null, hist: [] }, extra || {})];
    };
    DB.apps = Object.fromEntries([
      A('mariam',  'r1', 'sent',    -3, 'pmmmu', { sendout: { sent: -3, opened: -2, decided: null, by: 'omar', writeup: 'Two years as Zendesk admin, built triggers and SLAs; solved the L2 scenario in 6 of 8 steps. Her German is fluent; on technical terms it was B2 in our interview.' } }),
      A('youssef', 'r1', 'sent',    -1, 'mmmum', { sendout: { sent: -1, opened: null, decided: null, by: 'omar', writeup: 'Goethe C1, confirmed fluent on our technical call. 18 months on Freshdesk handling L1 to L2 escalations. Shifts not yet confirmed.' } }),
      A('nour',    'r1', 'client',  -4, 'mmmmu', { sendout: { sent: -9, opened: -8, decided: -4, result: 'meet', by: 'omar', writeup: 'Native-level German. Walked through a VPN outage end to end in our technical interview.' } }),
      A('ahmed',   'r1', 'tech',    -6, 'mmmmm'),
      A('salma',   'r1', 'hr',      -2, 'mmumu'),
      A('hana',    'r1', 'phone',   -4, 'pmmmm'),
      A('tarek',   'r1', 'assess',  -2, 'mmuuu'),
      A('laila',   'r1', 'applied', -1, 'mmmmu'),
      A('reda',    'r1', 'sourced',  0, 'pumuu', { prospect: true }),
      A('habiba',  'r1', 'sourced',  0, 'muuum', { prospect: true }),
      A('karimm',  'r1', 'sent',   -20, 'mmmmn', { exit: 'clientno', exitDay: -18, toldDay: -17, decline: { why: 'lang', note: 'Hesitant on the technical call in German', day: -18 },
                                                 sendout: { sent: -20, opened: -19, decided: -18, result: 'pass', by: 'omar' } }),
      A('rana',    'r1', 'sent',   -12, 'pmmmm', { exit: 'clientno', exitDay: -10, toldDay: -9, decline: { why: 'lang', note: '', day: -10 },
                                                 sendout: { sent: -12, opened: -11, decided: -10, result: 'pass', by: 'omar' } }),
      A('dalia',   'r1', 'hr',      -9, 'nuumu', { exit: 'out', exitDay: -7, exitNote: 'German at A2, the role needs C1' }),
      A('sherif',  'r1', 'phone',   -8, 'puumm', { exit: 'out', exitDay: -6, exitNote: 'Wants field work, not a desk role' }),
      A('mona',    'r2', 'offer',   -2, 'mmmm'),
      A('hossam',  'r2', 'sent',    -5, 'mmmu', { sendout: { sent: -5, opened: -4, decided: null, by: 'omar', writeup: 'Five years in reporting, month-end close for two entities.' } }),
      A('aya',     'r2', 'phone',   -1, 'mmmu'),
      A('fady',    'r2', 'phone',  -10, 'nmmn', { exit: 'out', exitDay: -8, exitNote: 'Two years of experience; the role asks four' }),
      A('eman',    'r4', 'applied', -2, 'mmm'),
      A('amr',     'r5', 'phone',   -1, 'mmm'),
      A('reem',    'r5', 'hr',      -1, 'mmm'),
      A('nadine',  'r3', 'accepted',-10, 'mmm', { joinDay: 5, onboard: { laptop: true, contract: true, access: false, buddy: false } }),
      A('bassem',  'r0', 'joined', -35, 'mm', { joinDay: -35, checkins: [ { day: 30, due: -5, done: -5, outcome: 'On track', note: 'Handles L2 queue alone since week 3.' }, { day: 90, due: 55, done: null } ] }),
    ]);

    // History lines, derived so every record has a timeline.
    for (const a of Object.values(DB.apps)) {
      const tpl = T.TEMPLATES[DB.accounts[DB.reqs[a.req].acc].template].stages;
      const upto = tpl.indexOf(a.stage);
      const start = Math.min(a.since - 2 * upto - 2, a.since);
      for (let i = 0; i <= upto; i++) {
        const d = i === upto ? a.since : Math.round(start + (a.since - start) * i / Math.max(upto, 1));
        a.hist.push({ day: d, text: i === 0 ? (a.prospect ? 'Found on the public web: ' + DB.cands[a.cand].webSrc : 'Added: ' + DB.cands[a.cand].source)
                                            : 'Moved to ' + T.STAGES[tpl[i]].label, who: i === 0 && a.prospect ? 'AiMY' : 'Omar Saeed' });
      }
      if (a.exit) a.hist.push({ day: a.exitDay, text: T.EXITS[a.exit] + (a.decline ? ': ' + T.REASONS[a.decline.why] : a.exitNote ? ': ' + a.exitNote : ''), who: a.exit === 'clientno' ? 'Jana Weber' : 'Omar Saeed' });
      if (a.toldDay != null) a.hist.push({ day: a.toldDay, text: 'Told, under the HR template', who: 'Omar Saeed' });
    }

    DB.interviews = {
      i1: { id: 'i1', app: 'a4', kind: 'tech',   day: -1, time: '11:00', who: 'mostafa', mode: 'On Teams', recording: true,  debrief: null,
            others: [ { by: 'Sara Lotfy', kind: 'HR interview', verdict: 'Proceed', note: 'Clear, calm, good German small talk.' } ],
            quotes: { c1: { q: '"Ich würde zuerst die Logs prüfen und dann den Kunden zurückrufen." Fluent, one pause on "Lastverteilung".', at: '04:12' },
                      c2: { q: '"We used Zendesk macros for the top 20 ticket types and I owned the views."', at: '09:40' },
                      c3: { q: 'Diagnosed the DNS scenario: checked propagation, then the CNAME, then caching.', at: '16:05' },
                      c4: { q: '"Shifts are fine, I did nights for a year."', at: '21:30' } },
            gap: 'Networking basics: the template asks about subnets and VPN; it did not come up.' },
      i2: { id: 'i2', app: 'a5', kind: 'hr',     day: 0,  time: '14:00', who: 'sara',    mode: 'On Teams', recording: false, debrief: null, others: [] },
      i3: { id: 'i3', app: 'a3', kind: 'client', day: 2,  time: '10:30', who: 'jana',    mode: 'On Teams', recording: false, debrief: null, others: [] },
      i4: { id: 'i4', app: 'a21',kind: 'hr',     day: 1,  time: '12:00', who: 'sara',    mode: 'In person', recording: false, debrief: null, others: [] },
    };

    // Offers: the hiring manager approves fit and salary, the BU Director the
    // budget and headcount, in parallel on one packet (M3). No margin.
    DB.offers = {
      o1: { id: 'o1', app: 'a15', salary: '44,000 EGP a month', band: '40–48k EGP a month', notice: '30 days', start: 35,
            approvals: { hm: null, bu: null }, sent: null },
    };

    // Client declines over 90 days, for the reason counts and the P1/P5 loop.
    // Northwind: 18 declines, 7 for spoken language.
    const past = (acc, why, day, req) => ({ acc, why, day, req });
    DB.declines = [
      ...['lang','lang','lang','lang','lang','exp','exp','exp','skills','skills','skills','salary','salary','notice','other','skills'].map((w, i) => past('nw', w, -85 + i * 5, 'r0')),
      ...['salary','exp','skills','salary','notice','exp'].map((w, i) => past('ks', w, -80 + i * 12, 'r3')),
      ...['exp','salary','notice'].map((w, i) => past('vm', w, -60 + i * 15, 'r2')),
    ];
    // Plus the two seeded on applications above (Karim Mansour, Rana Adel).
    for (const a of Object.values(DB.apps)) if (a.decline) DB.declines.push({ acc: DB.reqs[a.req].acc, why: a.decline.why, day: a.decline.day, req: a.req, app: a.id });

    // Assessments. Item results come with the funnel outcome of the people
    // who took them, so a question can be tied to client acceptance (P3).
    DB.asmts = {
      a1: { id: 'a1', title: 'Support troubleshooting', kind: 'Questionnaire', reqs: ['r1','r5'], pass: '6 of 8', taken: 34, sentToClient: 12,
        qs: [
          { id: 'q1', text: 'A customer cannot log in after a password reset. List your first three checks.', right: 0.82, out: null },
          { id: 'q2', text: 'Read this log excerpt. Which service failed first?', right: 0.71, out: { right: [6, 11], wrong: [1, 9], n: 20 } },
          { id: 'q3', text: 'Write the reply to a customer whose refund failed twice.', right: 0.88, out: null },
          { id: 'q4', text: 'A VPN connects but no internal site loads. What do you check?', right: 0.65, out: null },
          { id: 'q5', text: 'A customer sees HTTP 502 on checkout. What do you check first?', right: 0.21, out: null,
            versions: [ { v: 1, text: 'A customer sees HTTP 502 on checkout. What do you check first?', by: 'Dina Ragab', day: -60 } ] },
          { id: 'q6', text: 'Escalate or solve: the ticket mentions a data export for a GDPR request.', right: 0.59, out: null },
          { id: 'q7', text: 'Prioritise these five tickets and say why.', right: 0.77, out: null },
          { id: 'q8', text: 'Explain DNS propagation to a non-technical customer.', right: 0.68, out: null },
        ] },
      a2: { id: 'a2', title: 'German speaking check', kind: 'Live with the AiMY agent', reqs: ['r1'], pass: 'B2 on technical terms', taken: 15, sentToClient: 5,
        qs: [
          { id: 'q1', text: 'Erklären Sie einem Kunden, warum sein Passwort zurückgesetzt werden muss.', right: 0.80, out: null },
          { id: 'q2', text: 'Beschreiben Sie einen schwierigen Kundenfall und wie Sie ihn gelöst haben.', right: 0.60, out: null },
          { id: 'q3', text: 'Ein Kunde ist verärgert über eine Ausfallzeit. Was sagen Sie?', right: 0.53, out: null },
        ] },
    };

    // Learning proposals: changes to AiMY's own rules, drafted from outcome
    // evidence, approved by the HR Manager. They never touch one person.
    DB.props = [
      { id: 'p1', kind: 'decline', acc: 'nw', status: 'open', day: -1,
        title: 'Add a spoken German check before a profile goes to Northwind',
        why: 'Spoken language below need is behind 7 of 18 Northwind declines in 90 days.',
        change: 'Every Northwind requisition with German as a must-have adds the 10-minute German speaking check before Profile sent.',
        scope: 'Northwind Software only' },
      { id: 'p2', kind: 'question', asmt: 'a1', q: 'q5', status: 'open', day: -2, by: 'Lina Fathy',
        title: 'Reword Q5 in Support troubleshooting',
        why: '79% of 34 people got it wrong, including 5 of the 6 who later met the client.',
        change: 'A customer sees "502 Bad Gateway" when paying. Which part of the system do you check first, and why?',
        scope: 'Support troubleshooting, from the next invite' },
    ];
    // Day-90 check-ins on past hires: the gate for outcome proposals (P7).
    DB.checkins90 = 12;
    DB.CHECKIN_GATE = 20;

    DB.autonomy = [
      { k: 'remind',  label: 'Remind interviewers who owe a debrief', rung: 2, lock: false, log: [] },
      { k: 'book',    label: 'Book interviews in Bookings',           rung: 1, lock: false, log: [] },
      { k: 'asmt',    label: 'Send assessment invites',              rung: 1, lock: false, log: [ { day: -9, text: 'Moved down from Do and tell: Omar Saeed cancelled 3 invites in a week.' } ] },
      { k: 'contact', label: 'First contact with prospects',          rung: 0, lock: false, log: [] },
      { k: 'decline', label: 'Tell a candidate they are not progressing', rung: 0, lock: true, log: [] },
      { k: 'offer',   label: 'Send an offer',                         rung: 0, lock: true, log: [] },
    ];

    // Things the client asked for, which land with the account manager.
    DB.asks = [
      { id: 'k1', acc: 'nw', from: 'jana', day: -3, text: 'Can you add two more German seats from January for the Leipzig hub?', status: 'open' },
    ];
    DB.log = []; // AiMY bar conversation
    return DB;
  };
})();

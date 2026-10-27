/* AiMY Talent v2 · pages reached from a link, outside the desks: the careers
   page, the candidate's own profile, the interviewer's debrief and the
   approvers' page. Plus the AiMY bar. */
(function () {
  const T = window.T;
  const V = T.views;
  const e = T.esc;
  const DB = () => T.DB;

  // Arabic on the pages candidates see (M9). Needs a native read.
  const AR = {
    'Careers at FlairsTech': 'الوظائف في فليرز تك',
    'Apply with AiMY': 'قدّم مع AiMY',
    'Drop your CV here. AiMY reads it and asks only for what it lacks.': 'ضع سيرتك الذاتية هنا. يقرأها AiMY ويسأل فقط عمّا ينقصها.',
    'Use a sample CV': 'استخدم سيرة ذاتية نموذجية',
    'What AiMY read': 'ما قرأه AiMY',
    'One thing is missing: a phone number.': 'ينقص شيء واحد: رقم الهاتف.',
    'Phone number': 'رقم الهاتف',
    'Your permission': 'موافقتك',
    'Keep and read my CV for this and future roles (needed to apply)': 'الاحتفاظ بسيرتي الذاتية وقراءتها لهذه الوظيفة ولوظائف مستقبلية (مطلوب للتقديم)',
    'Send me updates on WhatsApp (optional; otherwise by email)': 'أرسلوا لي التحديثات عبر واتساب (اختياري؛ وإلا فبالبريد الإلكتروني)',
    'Send my application': 'أرسل طلبي',
    'Sent. You will hear from us by': 'تم الإرسال. ستسمع منا قبل',
    'Open my profile': 'افتح ملفي',
    'Your applications': 'طلباتك',
    'You will hear by': 'ستسمع منا قبل',
    'Your details': 'بياناتك',
    'What your CV says. You can change this; our interview notes are separate.': 'ما تقوله سيرتك الذاتية. يمكنك تعديله؛ ملاحظات المقابلات منفصلة.',
    'Updates on WhatsApp': 'التحديثات عبر واتساب',
    'Withdraw': 'سحب الطلب',
    'Withdrawn': 'تم سحب الطلب',
    'Enter the code we sent you': 'أدخل الرمز الذي أرسلناه لك',
    'Open': 'فتح',
    'With the recruiter': 'لدى مسؤول التوظيف',
    'Interview booked': 'تم حجز مقابلة',
    'With the hiring company': 'لدى الشركة',
    'Offer': 'عرض عمل',
    'Closed. Thank you for your time.': 'أُغلق الطلب. شكرًا لوقتك.',
    'Hello': 'مرحبًا',
    'On': 'مفعّل',
    'Off': 'متوقف',
  };
  const t = s => T.UI.lang === 'ar' ? (AR[s] || s) : s;
  const langSwitch = () => `<div class="lang" role="group" aria-label="Language"><button data-act="lang" data-to="en" class="${T.UI.lang !== 'ar' ? 'on' : ''}">English</button><button data-act="lang" data-to="ar" class="${T.UI.lang === 'ar' ? 'on' : ''}" lang="ar">العربية</button></div>`;

  const frame = (who, body, opts = {}) => `<div class="outside ${opts.cls || ''}">
    <div class="demo-strip">${T.icon('link', 13)} Outside link · seen by ${e(who)} <a href="#/${T.DESKS.find(d => d.id === T.UI.desk).home}">Back to the desks</a></div>
    <header class="out-top"><span class="brand">${T.mark(24)}<span>FlairsTech <b>Careers</b></span></span>${opts.lang ? langSwitch() : ''}</header>
    <main class="out-page">${body}</main></div>`;

  V.outside = r => {
    const ar = ['apply', 'me'].includes(r.name) && T.UI.lang === 'ar';
    document.documentElement.dir = ar ? 'rtl' : 'ltr';
    document.documentElement.lang = ar ? 'ar' : 'en';
    return ({ apply, me, debrief, approve })[r.name](r);
  };

  // ---------- careers page: apply with AiMY ----------
  function apply(r) {
    const req = T.req(r.args[0]);
    if (!req || !req.published) return frame('a candidate', `<div class="out-card">${T.empty('This role is not open to applications.')}</div>`, { lang: true });
    const st = T.UI.applyStep || 0;
    const cv = { name: 'Yara Mansour', exp: '3 years in technical support', lang: 'German C1, English C1, Arabic native', skills: 'Zendesk, L2 troubleshooting, night shifts' };
    return frame('a candidate', `<div class="out-card">
      <p class="eyebrow">${t('Careers at FlairsTech')}</p>
      <h1>${e(req.title)}</h1>
      <p class="sub">Cairo · on site · for a software company · ${req.criteria.filter(c => c.must).map(c => e(c.text)).join(' · ')}</p>
      <div class="chat">
        <div class="msg aimy-msg">${T.mark(18)}<p>${t('Drop your CV here. AiMY reads it and asks only for what it lacks.')}</p></div>
        ${st === 0 ? `<div class="drop">${T.icon('doc', 22)}<button class="btn primary" data-act="apply-cv">${t('Use a sample CV')}</button></div>` : `<div class="msg me-msg"><p>${T.icon('doc', 15)} yara-mansour-cv.pdf</p></div>`}
        ${st >= 1 ? `<div class="msg aimy-msg">${T.mark(18)}<div><p><b>${t('What AiMY read')}</b></p><ul class="read"><li>${e(cv.name)}</li><li>${e(cv.exp)}</li><li>${e(cv.lang)}</li><li>${e(cv.skills)}</li></ul><p>${t('One thing is missing: a phone number.')}</p></div></div>` : ''}
        ${st === 1 ? `<form class="msg me-msg form" data-form="apply-phone"><label class="label" for="ph">${t('Phone number')}</label><input class="input" id="ph" name="ph" value="+20 100 555 0142" dir="ltr"><button class="btn primary sm">${T.icon('arrow', 14)}</button></form>` : ''}
        ${st >= 2 ? `<div class="msg me-msg"><p dir="ltr">+20 100 555 0142</p></div>` : ''}
        ${st === 2 ? `<form class="msg aimy-msg form consent-form" data-form="apply-send">${T.mark(18)}<div><p><b>${t('Your permission')}</b></p>
            <label class="check"><input type="checkbox" name="cv" checked required> ${t('Keep and read my CV for this and future roles (needed to apply)')}</label>
            <label class="check"><input type="checkbox" name="wa"> ${t('Send me updates on WhatsApp (optional; otherwise by email)')}</label>
            <button class="btn primary">${t('Send my application')}</button></div></form>` : ''}
        ${st === 3 ? `<div class="msg aimy-msg">${T.mark(18)}<div><p>${T.icon('check', 15)} ${t('Sent. You will hear from us by')} <b>${T.fmt(T.TELL_WITHIN)}</b>.</p><a class="btn sm" href="#/me/${T.UI.applied || 'laila'}">${t('Open my profile')}</a></div></div>` : ''}
      </div>
      <p class="faint mt">Your CV is read as data, never as instructions. Nothing here decides about you: a person does.</p>
    </div>`, { lang: true });
  }

  // ---------- the candidate's own profile, behind a one-time code ----------
  function me(r) {
    const c = T.cand(r.args[0]); if (!c) return frame('a candidate', T.empty('No such profile.'), { lang: true });
    if (!T.UI.meOk) return frame('a candidate', `<div class="out-card narrow"><h1>${t('Enter the code we sent you')}</h1>
      <p class="sub">${c.consent.wa != null ? 'By WhatsApp' : 'By email'} · valid for 10 minutes</p>
      <form data-form="me-code" class="code"><input class="input" name="code" value="482 913" dir="ltr" aria-label="Code"><button class="btn primary">${t('Open')}</button></form></div>`, { lang: true });
    const apps = T.appsFor(c.id);
    // The candidate's own words for where they stand. A held exit is never
    // broken here first: it shows the date they will hear by (M4).
    const status = a => {
      if (a.exit === 'withdrew') return [t('Withdrawn'), null];
      if (a.exit && a.toldDay != null) return [t('Closed. Thank you for your time.'), null];
      if (a.exit) return [t('With the recruiter'), Math.max(1, a.exitDay + T.TELL_WITHIN)];
      const iv = Object.values(DB().interviews).find(i => i.app === a.id && i.day >= 0);
      if (iv) return [t('Interview booked') + ' · ' + T.wday(iv.day) + ' ' + iv.time, null];
      if (['sent', 'client', 'ctech'].includes(a.stage)) return [t('With the hiring company'), Math.max(1, a.since + 7)];
      if (['offer', 'accepted', 'joined'].includes(a.stage)) return [t('Offer'), null];
      return [t('With the recruiter'), Math.max(1, a.since + (T.STAGES[a.stage].exp || 3) + 2)];
    };
    return frame('the candidate', `<div class="out-card">
      <p class="eyebrow">${t('Hello')}, ${e(T.first(c.name))}</p><h1>${t('Your applications')}</h1>
      ${apps.map(a => { const [s, by] = status(a); return `<div class="row"><span class="row-main"><span><b>${e(T.req(a.req).title)}</b><small>${e(s)}</small></span></span>
        <span class="row-meta">${by != null ? `<span>${t('You will hear by')} <b>${T.fmt(by)}</b></span>` : ''}</span>
        <span class="row-act">${!a.exit && T.active(a) ? T.btn(t('Withdraw'), 'withdraw', { app: a.id }, 'ghost sm') : ''}</span></div>`; }).join('')}
      <h2 class="mt-l">${t('Your details')}</h2><p class="sub">${t('What your CV says. You can change this; our interview notes are separate.')}</p>
      <dl class="facts">${Object.entries(c.cvSays || {}).slice(0, 4).map(([k, v]) => { const cr = T.req(apps[0].req).criteria.find(x => x.id === k); return cr ? `<div><dt>${e(cr.text)}</dt><dd>${e(v)}</dd></div>` : ''; }).join('')}</dl>
      <div class="row"><span class="row-main"><span><b>${t('Updates on WhatsApp')}</b><small>${c.consent.wa != null ? 'Since ' + T.fmt(c.consent.wa) : 'Messages come by email'}</small></span></span>
        <span class="row-act"><button class="switch ${c.consent.wa != null ? 'on' : ''}" data-act="wa-toggle" data-c="${c.id}" role="switch" aria-checked="${c.consent.wa != null}"><span></span>${c.consent.wa != null ? t('On') : t('Off')}</button></span></div>
    </div>`, { lang: true });
  }

  // ---------- the interviewer's debrief: AI fills facts, you give the verdict ----------
  function debrief(r) {
    const iv = DB().interviews[r.args[0]]; if (!iv) return frame('an interviewer', T.empty('No such interview.'));
    const a = T.app(iv.app), c = T.cand(a.cand), req = T.req(a.req);
    const f = T.UI.db && T.UI.db.id === iv.id ? T.UI.db : (T.UI.db = { id: iv.id, v: {}, proceed: null, edits: {} });
    const must = req.criteria.filter(x => x.must);
    if (iv.debrief) {
      return frame(T.person(iv.who), `<div class="out-card"><p class="eyebrow">Debrief sent ${T.fmt(iv.debrief.day)}</p><h1>Thank you, ${e(T.first(T.person(iv.who)))}</h1>
        <p class="sub">${e(c.name)} · ${e(T.STAGES[iv.kind].label)} · you said <b>${iv.debrief.proceed ? 'proceed' : 'do not proceed'}</b></p>
        <h2 class="mt-l">Others' feedback, now visible</h2>
        ${iv.others.map(o => `<div class="row"><span class="row-main"><span><b>${e(o.by)}</b><small>${e(o.kind)} · “${e(o.note)}”</small></span></span>${T.chip(o.verdict, 'ok')}</div>`).join('') || T.empty('No one else has submitted.')}
        <p class="faint mt">Your confirmed findings now sit in ${e(T.first(c.name))}'s verified record beside what the CV says.</p></div>`);
    }
    const all = must.every(x => f.v[x.id]) && f.proceed != null;
    return frame(T.person(iv.who), `<div class="out-card">
      <p class="eyebrow">${e(T.STAGES[iv.kind].label)} · ${T.wday(iv.day)} ${iv.time} · ${e(iv.mode)}</p>
      <h1>${e(c.name)}</h1><p class="sub">${e(req.title)} · ${e(T.acc(req.acc).name)}${iv.recording ? ` · recorded with consent (${T.fmt(c.consent.rec)})` : ''}</p>
      <p class="note">${T.icon('info', 15)} AiMY quotes the recording; check each quote. The verdict is yours and starts empty.</p>
      ${must.map(cr => { const q = (iv.quotes || {})[cr.id]; return `<div class="dq">
        <div class="dq-h"><b>${e(cr.text)}</b><span class="faint">CV says: ${e((c.cvSays || {})[cr.id] || 'Not stated')}</span></div>
        ${q ? `<div class="dq-quote">${T.chip('Check it', 'warn')} <span class="faint">${q.at}</span><textarea class="input" rows="2" data-db-edit="${cr.id}">${e(f.edits[cr.id] ?? q.q)}</textarea></div>` : '<p class="faint">No quote found in the recording.</p>'}
        <div class="seg" role="group" aria-label="Your verdict">${[['met', 'Met'], ['partly', 'Partly met'], ['not', 'Not shown']].map(([k, l]) => `<button class="${f.v[cr.id] === k ? 'on' : ''}" data-act="db-v" data-c="${cr.id}" data-to="${k}">${l}</button>`).join('')}</div>
      </div>`; }).join('')}
      ${iv.gap ? `<div class="note warn">${T.icon('alert', 15)} <span><b>Not covered.</b> ${e(iv.gap)}</span>${T.UI.gapAsked ? T.chip('Asked by message', 'ok') : T.btn('Ask by message', 'gap-ask', {}, 'ghost sm')}</div>` : ''}
      <div class="dq"><div class="dq-h"><b>Should ${e(T.first(c.name))} go on?</b></div>
        <div class="seg">${[['yes', 'Proceed'], ['no', 'Do not proceed']].map(([k, l]) => `<button class="${f.proceed === k ? 'on' : ''}" data-act="db-p" data-to="${k}">${l}</button>`).join('')}</div></div>
      <p class="hidden-note">${T.icon('lock', 14)} ${T.plural(iv.others.length, 'other interviewer has', 'other interviewers have')} submitted. Theirs shows after yours, so your view stays your own.</p>
      <button class="btn primary" data-act="db-send" ${all ? '' : 'disabled'}>Send my debrief</button>
      ${all ? '' : '<span class="faint"> Rate each must-have and say proceed or not.</span>'}
    </div>`);
  }

  // ---------- approvers: two approvers, two questions (M3) ----------
  function approve(r) {
    const o = DB().offers[r.args[0]], by = r.args[1] === 'bu' ? 'bu' : 'hm';
    if (!o) return frame('an approver', T.empty('No such offer.'));
    const a = T.app(o.app), c = T.cand(a.cand), req = T.req(a.req);
    const mine = o.approvals[by], other = o.approvals[by === 'bu' ? 'hm' : 'bu'];
    const who = by === 'bu' ? 'hesham' : 'rania';
    const filled = T.appsOf(req.id).filter(x => ['accepted', 'joined'].includes(x.stage)).length;
    return frame(T.person(who), `<div class="out-card narrow">
      <p class="eyebrow">${e(T.person(who))} · ${e(T.STAFF[who].role)}</p>
      <h1>${by === 'bu' ? `Is there budget and headcount for this hire?` : `Is ${e(c.name)} the right person at this salary?`}</h1>
      ${by === 'bu' ? `<dl class="facts"><div><dt>Requisition</dt><dd>${e(req.title)} · ${e(T.acc(req.acc).name)}</dd></div><div><dt>Seats</dt><dd>${req.seats} · ${filled} filled</dd></div><div><dt>Budget band</dt><dd>${e(o.band)}</dd></div><div><dt>This offer</dt><dd>${e(o.salary)}</dd></div></dl>
        <p class="faint">Fit is the hiring manager's question, not yours. Decision D7 may move this to when the requisition opens.</p>`
      : `<dl class="facts"><div><dt>Role</dt><dd>${e(req.title)}</dd></div><div><dt>Evidence</dt><dd>${e(T.evCount(a).text)}</dd></div><div><dt>Salary</dt><dd>${e(o.salary)}</dd></div><div><dt>Budget band</dt><dd>${e(o.band)}</dd></div><div><dt>Notice</dt><dd>${e(o.notice)}</dd></div><div><dt>Start</dt><dd>${T.fmt(o.start)}</dd></div></dl>
        ${T.criteriaRows(a, { readonly: true, foot: false })}`}
      ${mine ? `<p class="note ${mine.ok ? 'ok' : 'warn'}">${mine.ok ? 'You approved ' + T.fmt(mine.day) : 'You said not yet: ' + e(mine.note)}</p>`
        : `<div class="btns">${T.btn('Approve', 'approve', { o: o.id, by, ok: 1 }, 'primary')}<input class="input sm" id="nyet" placeholder="Not yet, because…">${T.btn('Not yet', 'approve', { o: o.id, by, ok: 0 }, 'ghost')}</div>`}
      <p class="faint mt">In parallel: ${e(T.person(by === 'bu' ? 'rania' : 'hesham'))} ${other ? (other.ok ? 'approved ' + T.fmt(other.day) : 'said not yet') : 'has not answered yet'}. A person sends the offer once both approve.</p>
    </div>`);
  }

  // ---------- the AiMY bar ----------
  V.bar = () => {
    if (!T.UI.bar) return '';
    const log = T.UI.chat || [];
    const sugg = { omar: ['What is waiting on me?', 'Why do clients pass?', 'Where do we lose people?', 'Find someone like Bassem Youssef', 'Called Hana, she passed the call'],
      rania: ['What is waiting on me?', 'Which requisitions are at risk?', 'Why do clients pass?'],
      dina: ['Which requisitions are at risk?', 'Why do clients pass?', 'Where do we lose people?'],
      jana: ['Where are my requests?', 'Open a requisition for 2 German support agents'] }[T.UI.desk];
    return `<div class="scrim" data-act="bar-close"></div>
    <aside class="drawer" role="dialog" aria-label="AiMY">
      <header class="drawer-h">${T.mark(22)}<b>AiMY</b><span class="faint">answers from the records it names</span><button class="icon-btn" data-act="bar-close" aria-label="Close">${T.icon('x')}</button></header>
      <div class="convo" id="convo">${log.length ? log.map(m => `<div class="msg ${m.me ? 'me-msg' : 'aimy-msg'}">${m.me ? '' : T.mark(16)}<div>${m.html}</div></div>`).join('') : `<p class="faint">Ask a question, or tell AiMY what happened in a sentence.</p>`}</div>
      <div class="sugg">${sugg.map(s => `<button class="pill sm" data-act="bar-say" data-say="${e(s)}">${e(s)}</button>`).join('')}</div>
      <form data-form="bar" class="bar-form"><input class="input" id="bar-in" name="t" autocomplete="off" placeholder="Ask AiMY…" value="${e(T.UI.barSay || '')}"><button class="btn primary">${T.icon('send', 15)}</button></form>
    </aside>`;
  };

  // A few intents, answered from the store, each naming what it read.
  T.answer = text => {
    const s = text.toLowerCase();
    const me = T.UI.desk;
    const link = (h, l) => `<a href="${h}" data-act="bar-close">${e(l)}</a>`;
    if (/wait|today|my desk/.test(s) && me !== 'jana') {
      const apps = Object.values(DB().apps).filter(a => T.waitOn(a) === 'me' && T.req(a.req).owner === 'omar').sort((a, b) => a.since - b.since);
      return `<p>${T.plural(apps.length, 'decision waits', 'decisions wait')} on Omar, oldest first:</p><ul>${apps.map(a => `<li>${link('#/cand/' + a.id, T.cand(a.cand).name)} · ${e(T.STAGES[a.stage].label)}, ${T.age(a.since)}</li>`).join('')}</ul><p class="aimy-foot">Read: applications and debriefs.</p>`;
    }
    if (/risk/.test(s)) {
      const r = Object.values(DB().reqs).filter(T.atRisk);
      return `<p>${T.plural(r.length, 'requisition is', 'requisitions are')} at risk:</p><ul>${r.map(x => `<li>${link('#/req/' + x.id, x.title)} · target ${T.fmt(x.target)}</li>`).join('')}</ul><p class="aimy-foot">Read: targets, and how many people are with the client against the seats.</p>`;
    }
    if (/why|pass|declin|turn down|reject/.test(s)) {
      const nw = T.declinesFor('nw'), top = T.reasonCounts(nw)[0];
      return `<p>Clients gave ${T.declinesFor(null).length} reasons in 90 days. At Northwind, <b>${e(T.REASONS[top[0]])}</b> is behind ${top[1]} of ${nw.length}. A learning proposal for Northwind is with the HR Manager.</p><p class="aimy-foot">Read: one reason per client decision. ${link('#/reports', 'Open the reports')}</p>`;
    }
    if (/lose|drop|funnel|where/.test(s) && !/request/.test(s)) {
      return `<p>Upstream, mostly: 268 passed the phone screen and 81 profiles went to clients (Aug–Sep), and the first profile took 14 days. At the client, 3.4 profiles per interview is inside the usual 3 to 5.</p><p class="aimy-foot">Read: the Aug–Sep dashboard. ${link('#/reports', 'See the funnel')}</p>`;
    }
    if (/where are my requests/.test(s)) {
      return `<p>${Object.values(DB().reqs).filter(r => r.acc === 'nw' && T.isOpen(r)).map(r => e(r.title)).join(' and ')} are open. Two profiles wait for your decision.</p>`;
    }
    const open = s.match(/open a requisition for (\d+)?\s*(.+?)(?: at ([a-z ]+))?$/);
    if (open) {
      const n = Number(open[1] || 1), title = open[2].replace(/\b\w/g, c => c.toUpperCase()).replace(/s$/, ''), accName = (open[3] || (me === 'jana' ? 'northwind' : 'northwind')).trim();
      const acc = Object.values(DB().accounts).find(a => a.name.toLowerCase().startsWith(accName)) || T.acc('nw');
      const id = T.id('r');
      T.commit(`Draft requisition: ${n} × ${title} at ${acc.name}.`, () => {
        DB().reqs[id] = { id, title, acc: acc.id, seats: n, owner: 'omar', hm: 'rania', opened: 0, target: 21, state: 'draft', published: false, kind: 'New role', budget: 'To agree at intake',
          criteria: [{ id: 'c1', text: 'To draft with the hiring manager', must: true }], critVer: 'v0 · draft', firstSent: null };
      }, { aimy: 'Draft until it is opened. Nothing is published.' });
      return `<p>I drafted ${link('#/req/' + id, n + ' × ' + title + ' at ' + acc.name)}. It stays a draft, unpublished, until a person opens it.</p>`;
    }
    if (/find|someone like|search/.test(s)) {
      T.UI.find = { req: 'r1', brief: text, ran: true };
      return `<p>Searching your talent pool first, then the public web, for Bilingual Technical Support (German). ${link('#/find?req=r1', 'See the results')}</p>`;
    }
    const m = s.match(/(?:called|spoke to|talked to)?\s*([a-z]+).*?(passed|not interested|withdrew|no show)/);
    if (m) {
      const a = Object.values(DB().apps).find(x => T.active(x) && T.first(T.cand(x.cand).name).toLowerCase() === m[1]);
      if (a) {
        const verb = m[2] === 'passed' ? 'advance' : 'withdrew';
        return `<p>I read that as: <b>${e(T.cand(a.cand).name)}</b>, ${e(T.req(a.req).title)}, ${m[2] === 'passed' ? 'passed the ' + e(T.STAGES[a.stage].label.toLowerCase()) : 'withdrew'}.</p>
          <div class="btns">${T.btn(m[2] === 'passed' ? 'Yes, move to ' + e(T.STAGES[T.nextStage(a)].label) : 'Yes, mark withdrew', verb === 'advance' ? 'advance' : 'exit-withdrew', { app: a.id }, 'primary sm')}${link('#/cand/' + a.id, 'Open the record')}</div>`;
      }
    }
    return `<p>I can answer what is waiting, what is at risk, why clients pass and where people drop; find people; open a requisition; or log what happened (“Called Hana, she passed the call”).</p>`;
  };
})();

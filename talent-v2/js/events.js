/* AiMY Talent v2 · every press. One handler per data-act; writes go through
   T.commit so each lands with Undo. */
(function () {
  const T = window.T;
  const DB = () => T.DB;
  const ME = () => T.person(T.UI.desk === 'jana' ? 'jana' : T.UI.desk === 'rania' ? 'rania' : T.UI.desk === 'dina' ? 'dina' : 'omar');
  const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

  const INTERVIEWER = { hr: 'sara', tech: 'mostafa', mgr: 'rania', client: 'jana', ctech: 'jana' };

  // Move one stage on. The stage only goes forward; Undo is the way back.
  function advance(a) {
    const next = T.nextStage(a); if (!next) return '';
    const c = T.cand(a.cand);
    a.stage = next; a.since = 0;
    a.hist.push({ day: 0, text: 'Moved to ' + T.STAGES[next].label, who: ME() });
    let say = '';
    if (a.prospect && next === 'applied') { a.prospect = false; c.prospect = false; c.consent.cv = 0; }
    if (INTERVIEWER[next]) {
      const book = DB().autonomy.find(x => x.k === 'book');
      if (book.rung >= 1) {
        const id = T.id('i');
        DB().interviews[id] = { id, app: a.id, kind: next, day: 2, time: '10:00', who: INTERVIEWER[next], mode: 'On Teams', recording: false, debrief: null, others: [] };
        say = `Booked ${T.wday(2)} 10:00 with ${T.person(INTERVIEWER[next])} in Bookings. Undo removes it.`;
      } else say = `I suggest ${T.wday(2)} 10:00 with ${T.person(INTERVIEWER[next])}. Booking is set to Suggest.`;
    }
    if (next === 'assess') say = c.consent.wa != null ? 'Assessment invite sent on WhatsApp (opted in ' + T.fmt(c.consent.wa) + ').' : 'Assessment invite sent by email: there is no WhatsApp opt-in.';
    if (next === 'offer') {
      const id = T.id('o');
      DB().offers[id] = { id, app: a.id, salary: 'To confirm', band: T.req(a.req).budget, notice: (c.cvSays && c.cvSays.notice) || '30 days', start: 30, approvals: { hm: null, bu: null }, sent: null };
      say = 'Offer packet drafted. Rania Samir and Hesham Nabil approve it in parallel.';
    }
    if (next === 'accepted') { a.joinDay = 30; a.onboard = { contract: false, laptop: false, access: false, buddy: false }; say = 'Onboarding opened. Accepted to joined is tracked as its own stage.'; }
    if (next === 'joined') { a.joinDay = 0; a.checkins = [{ day: 30, due: 30, done: null }, { day: 90, due: 90, done: null }]; say = 'Day-30 and day-90 check-ins scheduled.'; }
    return say;
  }

  function exit(a, kind, note) {
    a.exit = kind; a.exitDay = 0; if (note) a.exitNote = note;
    a.hist.push({ day: 0, text: T.EXITS[kind] + (note ? ': ' + note : ''), who: ME() });
  }

  function passWith(a, why, note, who) {
    const r = T.req(a.req), acc = T.acc(r.acc);
    a.exit = 'clientno'; a.exitDay = 0;
    a.decline = { why, note, day: 0 };
    a.sendout.decided = 0; a.sendout.result = 'pass';
    if (a.sendout.opened == null) a.sendout.opened = 0;
    a.hist.push({ day: 0, text: 'Client declined: ' + T.REASONS[why] + (note ? ' · ' + note : ''), who: who === 'client' ? T.person('jana') : ME() + ', for the client' });
    DB().declines.push({ acc: acc.id, why, day: 0, req: r.id, app: a.id });
    const n = DB().declines.filter(d => d.acc === acc.id && d.why === why && d.day >= -30).length;
    const short = acc.name.split(' ')[0];
    return `${T.ord(n)} ${short} decline this month for ${T.REASON_SHORT[why]}. It feeds matching for ${short} only.`;
  }

  const A = {
    undo: () => T._undo && T._undo(),
    'toast-close': () => (document.getElementById('toast').className = 'toast'),
    'nav-toggle': () => document.querySelector('.shell').classList.toggle('nav-open'),
    theme: () => { const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; T.UI.theme = next; document.documentElement.dataset.theme = next; T.save(); T.render(); },
    'desk-menu': () => { const m = document.getElementById('desk-menu'); m.hidden = !m.hidden; },
    desk: el => { T.UI.desk = el.dataset.id; T.UI.sel = {}; T.UI.open = {}; T.save(); location.hash = '#/' + T.DESKS.find(d => d.id === el.dataset.id).home; T.render(); },
    reset: () => { T.UI.open = {}; T.UI.sel = {}; T.UI.asked = {}; T.UI.applyStep = 0; T.UI.meOk = false; T.UI.db = null; T.UI.gapAsked = false; T.UI.chat = []; T.reset(); },
    toggle: el => { T.UI.open[el.dataset.k] = !T.UI.open[el.dataset.k]; T.render(); },
    'sel-clear': () => { T.UI.sel = {}; T.render(); },

    advance: el => { const a = T.app(el.dataset.app); const c = T.cand(a.cand); let say; const to = T.STAGES[T.nextStage(a)].label; T.UI.readback = null;
      T.commit(`${c.name} moved to ${to}.`, () => { say = advance(a); }, {}); if (say) T.toast(`${c.name} moved to ${to}.`, T._undo, say); },
    'exit-out': el => { const a = T.app(el.dataset.app); const c = T.cand(a.cand);
      T.commit(`${c.name}: not progressing.`, () => exit(a, 'out', 'Recruiter decision'), { aimy: `${T.first(c.name)} hears within ${T.TELL_WITHIN} days. Find them in Not told yet on Today.` }); },
    'exit-withdrew': el => { const a = T.app(el.dataset.app); T.UI.readback = null; T.commit(`${T.cand(a.cand).name} withdrew.`, () => { exit(a, 'withdrew'); a.toldDay = 0; }); },

    'writeup-open': el => { T.UI.open['wu' + el.dataset.app] = true; T.render(); },
    'writeup-close': el => { T.UI.open['wu' + el.dataset.app] = false; T.render(); },
    'send-profile': el => { const a = T.app(el.dataset.app), r = T.req(a.req), text = val('wu-' + a.id);
      T.UI.open['wu' + a.id] = false;
      T.commit(`Profile sent to ${T.acc(r.acc).name}.`, () => {
        a.stage = 'sent'; a.since = 0; a.sendout = { sent: 0, opened: null, decided: null, by: 'omar', writeup: text };
        if (r.firstSent == null) r.firstSent = 0;
        a.hist.push({ day: 0, text: 'Profile sent, write-up approved', who: ME() });
      }, { aimy: `The sendout is a record now: sent today; I mark it opened when ${T.acc(r.acc).name} opens it.` }); },
    'offer-send': el => { const a = T.app(el.dataset.app), o = T.offerOf(a.id);
      T.commit(`Offer sent to ${T.cand(a.cand).name}.`, () => { o.sent = 0; a.hist.push({ day: 0, text: 'Offer sent', who: ME() }); },
        { aimy: T.cand(a.cand).consent.wa != null ? 'Questions about the offer come back on WhatsApp; anything about money goes to you.' : 'Sent by email: there is no WhatsApp opt-in.' }); },

    tell: el => { const a = T.app(el.dataset.app), c = T.cand(a.cand);
      T.commit(`Answer sent to ${c.name} by ${c.consent.wa != null ? 'WhatsApp' : 'email'}.`, () => { a.toldDay = 0; a.hist.push({ day: 0, text: 'Told, under the HR template', who: ME() }); }); },
    'tell-batch': () => { const ids = (T.UI.sel.untold || []).slice(); T.UI.sel.untold = [];
      T.commit(`${T.plural(ids.length, 'answer')} sent under the HR template.`, () => ids.forEach(id => { const a = T.app(id); a.toldDay = 0; a.hist.push({ day: 0, text: 'Told, under the HR template (batch)', who: ME() }); }), { aimy: 'One Undo takes back the whole batch.' }); },
    'contact-batch': () => { const ids = (T.UI.sel.prospects || []).slice(); T.UI.sel.prospects = [];
      T.commit(`First contact approved for ${T.plural(ids.length, 'prospect')}.`, () => ids.forEach(id => { const a = T.app(id); a.contacted = true; a.hist.push({ day: 0, text: 'First contact approved; sent by email', who: ME() }); }), { aimy: 'Sent by email. No WhatsApp: none of them has opted in.' }); },
    'contact-one': el => { const a = T.app(el.dataset.app);
      T.commit(`First contact approved for ${T.cand(a.cand).name}.`, () => { a.contacted = true; a.hist.push({ day: 0, text: 'First contact approved; sent by email', who: ME() }); }, { aimy: 'Sent by email. No WhatsApp before an opt-in.' }); },

    'ask-them': el => { T.UI.asked[el.dataset.app + el.dataset.c] = true; T.render(); T.toast('Added to the questions for the next call or interview.'); },
    publish: el => { const r = T.req(el.dataset.req);
      T.commit(r.published ? `${r.title} is no longer published.` : `${r.title} is published.`, () => (r.published = !r.published), { aimy: r.published ? 'Off the careers page. The link stops taking applications.' : 'On the careers page, with a link to share on LinkedIn.' }); },
    'req-state': el => { const r = T.req(el.dataset.req), to = el.dataset.to;
      T.commit(`${r.title}: ${to === 'onhold' ? 'on hold' : 'open'}.`, () => (r.state = to)); },
    call: () => T.toast('Calls are a design target: telephony for Talent is on hold with AiMY Phone (P8).'),
    'copy-link': () => { try { navigator.clipboard.writeText(location.origin + location.pathname + '#/apply/r1'); } catch (e) {} T.toast('Link copied.'); },

    'pass-open': el => { T.UI.open['pass' + el.dataset.app] = true; T.UI.open['so' + el.dataset.app] = true; T.render(); },
    'pass-cancel': el => { T.UI.open['pass' + el.dataset.app] = false; T.render(); },
    'pass-why': el => { const a = T.app(el.dataset.app), why = el.dataset.why, note = why === 'other' ? val('other-' + a.id) : '';
      if (why === 'other' && !note) { const i = document.getElementById('other-' + a.id); i.classList.add('shake'); i.focus(); setTimeout(() => i.classList.remove('shake'), 400); return; }
      let say; T.UI.open['pass' + a.id] = false;
      T.commit(`Passed on ${T.cand(a.cand).name}: ${T.REASONS[why].toLowerCase()}.`, () => { say = passWith(a, why, note, el.dataset.who); });
      T.toast(`Passed on ${T.cand(a.cand).name}: ${T.REASONS[why].toLowerCase()}.`, T._undo, say); },
    meet: el => { const a = T.app(el.dataset.app);
      T.commit(`You want to meet ${T.cand(a.cand).name}.`, () => {
        a.sendout.decided = 0; a.sendout.result = 'meet'; if (a.sendout.opened == null) a.sendout.opened = 0;
        a.stage = 'client'; a.since = 0; a.hist.push({ day: 0, text: 'Client wants to meet', who: T.person('jana') });
        const id = T.id('i'); DB().interviews[id] = { id, app: a.id, kind: 'client', day: 3, time: '14:00', who: 'jana', mode: 'On Teams', recording: false, debrief: null, others: [] };
      }, { aimy: `Booked ${T.wday(3)} 14:00 on Teams. ${T.first(T.cand(a.cand).name)} gets the invite from FlairsTech.` }); },
    'so-open': el => { const a = T.app(el.dataset.app); T.UI.open['so' + a.id] = true;
      if (a.sendout.opened == null) { a.sendout.opened = 0; a.hist.push({ day: 0, text: 'Opened by the client', who: T.person('jana') }); T.save(); }
      T.render(); },

    enrich: el => { T.UI.enriched = T.UI.enriched || {}; T.UI.enriched[el.dataset.id] = true; T.render(); T.toast('Apollo added a work email. No phone number, and no WhatsApp without an opt-in.'); },
    'find-add': el => { const ids = (T.UI.sel.find || []).slice(), req = T.req(el.dataset.req); T.UI.sel.find = [];
      T.commit(`${T.plural(ids.length, 'person', 'people')} added to ${req.title}.`, () => ids.forEach(key => {
        const [kind, pid] = key.split(':'); const p = (kind === 'pool' ? T.FIND.POOL : T.FIND.WEB).find(x => x.id === pid);
        if (!DB().cands[pid]) DB().cands[pid] = { id: pid, name: p.name, city: 'Cairo', headline: p.head, source: kind === 'pool' ? 'Talent pool' : 'Public web', webSrc: p.src, prospect: kind === 'web',
          consent: kind === 'pool' ? { cv: -120, wa: p.wa ? -120 : null, rec: null } : { cv: null, wa: null, rec: null }, cvSays: {}, found: {}, notes: [] };
        const id = T.id('a'); const ev = p.ev.slice(0, req.criteria.length).padEnd(req.criteria.length, 'u');
        DB().apps[id] = { id, cand: pid, req: req.id, stage: 'sourced', since: 0, ev, exit: null, prospect: kind === 'web', hist: [{ day: 0, text: kind === 'pool' ? 'Added from the talent pool' : 'Found on the public web: ' + p.src, who: ME() }] };
      }), { aimy: ids.some(k => k.startsWith('web')) ? 'Web people wait in First contact to approve, on Today.' : 'They are on the requisition at Sourced.' }); },

    'q-propose': el => { const a = DB().asmts[el.dataset.a], q = a.qs.find(x => x.id === el.dataset.q), reword = el.dataset.how === 'reword';
      T.commit('Sent to Dina Ragab for approval.', () => DB().props.push({ id: T.id('p'), kind: 'question', how: el.dataset.how, asmt: a.id, q: q.id, status: 'open', day: 0, by: ME(),
        title: (reword ? 'Reword ' : 'Drop ') + 'Q' + (a.qs.indexOf(q) + 1) + ' in ' + a.title,
        why: Math.round((1 - q.right) * 100) + '% of ' + a.taken + ' people got it wrong.',
        change: reword ? 'A customer sees "502 Bad Gateway" when paying. Which part of the system do you check first, and why?' : 'Drop the question; the pass mark becomes 5 of 7.',
        scope: a.title + ', from the next invite' }), { aimy: 'Nothing changes until she approves. The question keeps its current wording as a version.' }); },

    nudge: el => { const a = T.app(el.dataset.app);
      T.commit(`Nudged ${T.acc(T.req(a.req).acc).name} about ${T.cand(a.cand).name}.`, () => { a.nudged = 0; a.hist.push({ day: 0, text: 'Client nudged by email', who: ME() }); }); },
    'ask-draft': el => { const k = DB().asks.find(x => x.id === el.dataset.id); const id = T.id('r');
      T.commit('Draft requisition opened from Jana Weber’s ask.', () => { k.status = 'drafted';
        DB().reqs[id] = { id, title: 'Bilingual Technical Support (German), Leipzig hub', acc: k.acc, seats: 2, owner: 'omar', hm: 'rania', opened: 0, target: 60, state: 'draft', published: false, kind: 'New role', budget: 'To agree with Northwind',
          criteria: T.req('r1').criteria.map(c => Object.assign({}, c)), critVer: 'v1 · cloned from Bilingual Technical Support (German)', firstSent: null }; },
        { aimy: 'Cloned from the current German requisition. It stays a draft until you open it.' }); location.hash = '#/req/' + id; },
    reassign: el => { const r = T.req(el.dataset.req), order = ['karim', 'lina', 'omar'], to = order[(order.indexOf(r.owner) + 1) % order.length];
      T.commit(`${r.title} reassigned to ${T.person(to)}.`, () => (r.owner = to)); },
    prop: el => { const p = DB().props.find(x => x.id === el.dataset.id), ok = el.dataset.to === 'approved';
      T.commit(ok ? 'Approved: ' + p.title + '.' : 'Not now: ' + p.title + '.', () => {
        p.status = el.dataset.to; p.decided = 0;
        if (!ok) return;
        if (p.kind === 'question') { const q = DB().asmts[p.asmt].qs.find(x => x.id === p.q);
          if (p.how === 'drop') q.dropped = true;
          else { q.versions = q.versions || [{ v: 1, text: q.text, by: 'Dina Ragab', day: -60 }]; q.versions.push({ v: q.versions.length + 1, text: p.change, by: T.person('dina'), day: 0 }); q.text = p.change; } }
        if (p.kind === 'decline') { const r = T.req('r1'); r.extraCheck = 'German speaking check before Profile sent · approved by Dina Ragab ' + T.fmt(0); r.critVer = 'v4 · Dina Ragab, ' + T.fmt(0); }
      }, { aimy: ok ? (p.kind === 'decline' ? 'The success profile gets a new version. Earlier scores keep theirs.' : 'The question keeps its earlier wording as a version.') : 'Kept as evidence; AiMY will not propose it again for 30 days.' }); },
    rung: el => { const x = DB().autonomy.find(y => y.k === el.dataset.k), to = Number(el.dataset.to); if (to === x.rung) return;
      T.commit(`${x.label}: ${T.RUNGS[to]}.`, () => { x.log.push({ day: 0, text: (to > x.rung ? 'Moved up to ' : 'Moved down to ') + T.RUNGS[to] + ' by ' + T.person('dina') + (to > x.rung ? '. AiMY\'s reason: no overrides in 30 days.' : '.') }); x.rung = to; }); },
    'tpl-stage': el => { const t = T.TEMPLATES[el.dataset.t], s = el.dataset.s, lib = Object.keys(T.STAGES);
      const on = t.stages.includes(s);
      t.stages = on ? t.stages.filter(x => x !== s) : lib.filter(x => t.stages.includes(x) || x === s);
      T.render(); T.toast(`${T.STAGES[s].label} ${on ? 'removed from' : 'added to'} ${t.label}.`, () => { t.stages = on ? lib.filter(x => t.stages.includes(x) || x === s) : t.stages.filter(x => x !== s); T.render(); }); },

    // outside pages
    lang: el => { T.UI.lang = el.dataset.to; T.save(); T.render(); },
    'apply-cv': () => { T.UI.applyStep = 1; T.render(); },
    withdraw: el => { const a = T.app(el.dataset.app);
      T.commit('Your application is withdrawn.', () => { exit(a, 'withdrew'); a.toldDay = 0; a.hist[a.hist.length - 1].who = T.cand(a.cand).name; }); },
    'wa-toggle': el => { const c = T.cand(el.dataset.c);
      T.commit(c.consent.wa != null ? 'WhatsApp updates off. We will use email.' : 'WhatsApp updates on.', () => (c.consent.wa = c.consent.wa != null ? null : 0)); },
    'db-v': el => { T.UI.db.v[el.dataset.c] = el.dataset.to; T.render(); },
    'db-p': el => { T.UI.db.proceed = el.dataset.to; T.render(); },
    'gap-ask': () => { T.UI.gapAsked = true; T.render(); T.toast('AiMY will ask by message: “Tell us how you would set up a VPN for a new office.”'); },
    'db-send': () => { const f = T.UI.db, iv = DB().interviews[f.id], a = T.app(iv.app), c = T.cand(a.cand), req = T.req(a.req);
      T.commit('Debrief sent. Others\' feedback is now visible.', () => {
        iv.debrief = { by: iv.who, v: Object.assign({}, f.v), proceed: f.proceed === 'yes', day: 0 };
        req.criteria.forEach((cr, i) => { const v = f.v[cr.id]; if (!v) return;
          const q = (iv.quotes || {})[cr.id];
          c.found[cr.id] = { text: (f.edits[cr.id] ?? (q ? q.q : 'Rated ' + v)).replace(/^"|"$/g, '').slice(0, 90), status: v === 'met' ? 'confirmed' : 'differs', src: T.STAGES[iv.kind].label + ', ' + T.fmt(iv.day) + (q ? ' · ' + q.at : '') };
          a.ev = a.ev.slice(0, i) + ({ met: 'm', partly: 'p', not: 'n' })[v] + a.ev.slice(i + 1); });
        a.hist.push({ day: 0, text: 'Debrief in: ' + (f.proceed === 'yes' ? 'proceed' : 'do not proceed'), who: T.person(iv.who) });
      }, { aimy: `Back with Omar Saeed to decide. The findings sit in ${T.first(c.name)}'s verified record.` }); },
    approve: el => { const o = DB().offers[el.dataset.o], by = el.dataset.by, ok = el.dataset.ok === '1', note = val('nyet');
      if (!ok && !note) { const i = document.getElementById('nyet'); i.classList.add('shake'); i.focus(); setTimeout(() => i.classList.remove('shake'), 400); return; }
      T.commit(ok ? 'Approved.' : 'Sent back: ' + note, () => (o.approvals[by] = { ok, day: 0, note })); },

    // the AiMY bar
    'bar-open': el => { T.UI.bar = true; T.UI.barSay = el.dataset.say || ''; T.render(); },
    'bar-close': () => { T.UI.bar = false; T.render(); },
    'bar-say': el => ask(el.dataset.say),
    'log-note': el => { const a = T.app(el.dataset.app); T.UI.readback = null; T.commit('Logged.', () => a.hist.push({ day: 0, text: el.dataset.t, who: ME() })); },
  };

  function ask(text) {
    T.UI.chat = T.UI.chat || [];
    T.UI.chat.push({ me: true, html: T.esc(text) });
    T.UI.barSay = '';
    const html = T.answer(text);
    T.UI.chat.push({ me: false, html });
    T.UI.bar = true;
    T.render();
  }

  const FORMS = {
    find: f => { T.UI.find = { req: f.req.value, brief: f.brief.value, ran: true }; T.UI.sel = {}; location.hash = '#/find?req=' + f.req.value; T.render(); },
    log: f => {
      const a = T.app(f.dataset.app), t = f.t.value.trim(); if (!t) return;
      const s = t.toLowerCase(), next = T.nextStage(a);
      let html;
      const btn = (l, act, data) => T.btn(l, act, Object.assign({ app: a.id }, data || {}), 'sm');
      if (/withdr|not interested|took another/.test(s)) html = `Reads as: <b>withdrew</b>.` + btn('Yes, mark withdrew', 'exit-withdrew');
      else if (/pass|good|strong|great|went well/.test(s) && next) html = `Reads as: <b>${T.esc(T.STAGES[a.stage].go.toLowerCase())}</b>. Move to ${T.esc(T.STAGES[next].label)}?` + btn('Yes, move', 'advance');
      else html = `Reads as a note, no move.`;
      T.UI.readback = { app: a.id, html: `<div class="readback">${T.mark(14)} <span>${html}</span>${btn('Just log it', 'log-note', { t })}</div>` };
      T.render();
    },
    'client-ask': f => { const t = f.t.value.trim(); if (!t) return;
      T.commit('Sent to Rania Samir, your account manager.', () => DB().asks.push({ id: T.id('k'), acc: 'nw', from: 'jana', day: 0, text: t, status: 'open' }), { aimy: 'She talks it through with you before anything opens.' }); },
    'apply-phone': () => { T.UI.applyStep = 2; T.render(); },
    'apply-send': f => {
      if (!f.cv.checked) return;
      const wa = f.wa.checked;
      if (!DB().cands.yara) {
        DB().cands.yara = { id: 'yara', name: 'Yara Mansour', city: 'Cairo', headline: 'Technical support, German C1', source: 'Applied · careers link', consent: { cv: 0, wa: wa ? 0 : null, rec: null },
          cvSays: { c1: 'C1', c2: 'Zendesk, 3 years', c3: 'L2 troubleshooting', c4: 'Night shifts', c5: 'Not stated' }, found: {}, notes: [] };
        const id = T.id('a');
        DB().apps[id] = { id, cand: 'yara', req: 'r1', stage: 'applied', since: 0, ev: 'mmmmu', exit: null, hist: [{ day: 0, text: 'Applied through the careers page with AiMY', who: 'Yara Mansour' }] };
      }
      T.UI.applyStep = 3; T.UI.applied = 'yara'; T.UI.meOk = false; T.save(); T.render();
    },
    'me-code': () => { T.UI.meOk = true; T.render(); },
    bar: f => { const t = f.t.value.trim(); if (t) ask(t); },
  };

  document.addEventListener('click', ev => {
    const menu = document.getElementById('desk-menu');
    if (menu && !menu.hidden && !ev.target.closest('.desk')) menu.hidden = true;
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = A[el.dataset.act];
    if (!fn) return;
    if (el.tagName === 'A' && el.dataset.act === 'bar-close') { T.UI.bar = false; return; } // let the link navigate
    ev.preventDefault();
    fn(el, ev);
  });
  document.addEventListener('submit', ev => {
    const f = ev.target.closest('[data-form]'); if (!f) return;
    ev.preventDefault();
    FORMS[f.dataset.form] && FORMS[f.dataset.form](f);
  });
  document.addEventListener('change', ev => {
    const el = ev.target;
    if (el.dataset.sel) {
      T.UI.sel = T.UI.sel || {};
      const g = (T.UI.sel[el.dataset.sel] = T.UI.sel[el.dataset.sel] || []);
      if (el.checked) g.push(el.value); else g.splice(g.indexOf(el.value), 1);
      T.render();
    }
  });
  document.addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.dbEdit && T.UI.db) T.UI.db.edits[el.dataset.dbEdit] = el.value;
    if (el.id === 'bar-in') T.UI.barSay = el.value;
  });
  document.addEventListener('keydown', ev => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (ev.key === '/' && !typing) { ev.preventDefault(); T.UI.bar = true; T.render(); }
    if (ev.key === 'Escape' && T.UI.bar) { T.UI.bar = false; T.render(); }
  });
  window.addEventListener('hashchange', () => { T.UI.readback = null; document.querySelector('.shell') && document.querySelector('.shell').classList.remove('nav-open'); T.render(); window.scrollTo(0, 0); });

  T.after = () => {
    if (T.UI.bar) { const c = document.getElementById('convo'); if (c) c.scrollTop = c.scrollHeight; const i = document.getElementById('bar-in'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  };

  // theme: the person's pick, else the system's
  const sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = T.UI.theme || sys;
  T.render();
})();

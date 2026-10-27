/* AiMY Talent v2 · the recruiter's screens, and the pages every internal
   desk shares: requisitions, a candidate, assessments, reports. */
(function () {
  const T = window.T;
  const V = (T.views = T.views || {});
  const e = T.esc;
  const DB = () => T.DB;

  // A decision row: who, where, how long, and the one press that moves it on.
  function decisionRow(a, opts = {}) {
    const c = T.cand(a.cand), r = T.req(a.req), next = T.nextStage(a);
    const ev = T.evCount(a);
    const late = T.overdue(a);
    let primary = '';
    const w = T.waitOn(a);
    if (w === 'me' && a.stage === 'tech') primary = T.btn('Send the profile', 'writeup-open', { app: a.id }, 'primary sm');
    else if (w === 'me' && a.stage === 'offer') primary = T.btn('Send the offer', 'offer-send', { app: a.id }, 'primary sm');
    else if (w === 'me' && next) primary = T.btn(e(T.STAGES[a.stage].go), 'advance', { app: a.id }, 'primary sm');
    return `<div class="row">
      <a class="row-main" href="#/cand/${a.id}">${T.av(c.name)}<span><b>${e(c.name)}</b><small>${e(r.title)} · ${e(T.STAGES[a.stage].label)}</small></span></a>
      <span class="row-meta"><span class="${late ? 'warn-t' : 'faint'}">${T.age(a.since)} in stage${late ? ' · usually ' + T.STAGES[a.stage].exp : ''}</span><span class="faint">${e(ev.text)}</span></span>
      <span class="row-act">${opts.noAct ? '' : primary}${opts.noAct || a.stage === 'offer' ? '' : T.btn('Not progressing', 'exit-out', { app: a.id }, 'ghost sm')}</span>
      ${T.UI.open['wu' + a.id] ? writeupBox(a) : ''}
    </div>`;
  }

  // The recruiter approves every write-up before a profile goes (Client desk).
  function writeupBox(a) {
    const c = T.cand(a.cand), r = T.req(a.req);
    const ev = T.evidence(a).filter(x => x.c.must);
    const draft = `${c.name}: ${ev.filter(x => x.v === 'meets').map(x => x.c.text.toLowerCase()).join(', ')}. ` +
      (ev.some(x => x.v !== 'meets') ? 'Still to confirm: ' + ev.filter(x => x.v !== 'meets').map(x => x.c.text.toLowerCase()).join(', ') + '.' : 'Every must-have met in interview.');
    return `<div class="writeup">
      <p class="label">${T.mark(14)} AiMY's write-up for ${e(T.acc(r.acc).name)} · you approve it before it goes</p>
      <textarea class="input" id="wu-${a.id}" rows="3">${e(draft)}</textarea>
      <p class="faint">Goes with the evidence per criterion. No salary, no internal notes.</p>
      <div class="btns">${T.btn('Approve and send', 'send-profile', { app: a.id }, 'primary sm')}${T.btn('Cancel', 'writeup-close', { app: a.id }, 'ghost sm')}</div></div>`;
  }
  T.decisionRow = decisionRow;

  // The HR template, filled in (M4).
  T.declineMessage = a => {
    const c = T.cand(a.cand), r = T.req(a.req);
    return `Dear ${T.first(c.name)}, thank you for your time on the ${r.title} role. We have decided not to move forward with your application for this role. We will keep your profile, with your permission, and contact you about roles that fit it better. Kind regards, ${T.person(r.owner)}, FlairsTech Recruitment`;
  };

  // ---------- Today ----------
  V.today = () => {
    const me = 'omar';
    const apps = Object.values(DB().apps).filter(a => T.req(a.req).owner === me);
    const mine = apps.filter(a => T.waitOn(a) === 'me').sort((a, b) => a.since - b.since);
    const oldest = mine.length ? -mine[0].since : 0;
    const untold = T.untold().filter(a => T.req(a.req).owner === me).sort((a, b) => a.exitDay - b.exitDay);
    const ivs = Object.values(DB().interviews).filter(i => T.req(T.app(i.app).req).owner === me);
    const todayIv = ivs.filter(i => i.day >= 0 && i.day <= 2).sort((a, b) => a.day - b.day);
    const owed = ivs.filter(i => i.day < 0 && !i.debrief);
    const others = apps.filter(a => ['client', 'interviewer', 'candidate', 'approvers'].includes(T.waitOn(a)) && !a.prospect);
    const risk = T.myReqs(me).filter(T.atRisk);
    const prospects = apps.filter(a => T.waitOn(a) === 'approval');
    const sel = T.UI.sel || {};

    const day = [];
    const sentOpen = apps.filter(a => a.stage === 'sent' && !a.exit && a.sendout && !a.sendout.decided);
    if (sentOpen.length) day.push(`${T.plural(sentOpen.length, 'profile')} ${sentOpen.length === 1 ? 'is' : 'are'} with the client; ${e(T.first(T.cand(sentOpen[0].cand).name))}'s has waited ${T.age(sentOpen[0].sendout.sent)}.`);
    if (owed.length) day.push(`${e(T.person(owed[0].who))} owes the debrief on ${e(T.cand(T.app(owed[0].app).cand).name)} from ${T.rel(owed[0].day)}; I sent a reminder at 9:00.`);
    if (untold.length) day.push(`${T.plural(untold.length, 'person is', 'people are')} owed an answer, the oldest due ${T.fmt(untold[0].exitDay + T.TELL_WITHIN)}.`);

    const owedBy = a => a.exitDay + T.TELL_WITHIN;
    const selU = sel.untold || [];

    return `
    <div class="page-h"><div><p class="eyebrow">${T.wday(0)} · Recruiter</p><h1>Good morning, Omar</h1></div></div>
    ${T.aimy(day.join(' ') || 'Nothing is waiting on you.', 'Reads applications, interviews and sendouts. Updated 8:30.')}

    <div class="hero">
      <div><span class="hero-n">${mine.length}</span><span class="hero-l">decisions waiting on you</span></div>
      <div class="hero-side"><span>Oldest: <b>${T.plural(oldest, 'day')}</b></span><span class="faint">Only a press of yours moves this number.</span></div>
    </div>

    <div class="grid">
      <div class="col">
        ${T.block('Decisions waiting on you', mine.length ? mine.map(a => decisionRow(a)).join('') : T.empty('None. Everything is with someone else.'), { src: 'applications, debriefs and offer approvals', sub: 'Oldest first' })}

        ${T.block('Not told yet', untold.length ? `
          ${T.batchBar(selU.length, T.btn('Send ' + T.plural(selU.length, 'answer'), 'tell-batch', {}, 'primary sm'))}
          ${untold.map(a => {
            const c = T.cand(a.cand), late = owedBy(a) < 0, open = T.UI.open['msg' + a.id];
            return `<div class="row">
              <label class="row-main"><input type="checkbox" data-sel="untold" value="${a.id}" ${selU.includes(a.id) ? 'checked' : ''}>${T.av(c.name)}<span><b>${e(c.name)}</b><small>${e(T.req(a.req).title)} · ${e(a.exitNote || T.EXITS[a.exit])}</small></span></label>
              <span class="row-meta"><span class="${late ? 'bad-t' : 'warn-t'}">Owed by ${T.fmt(owedBy(a))}${late ? ' · late' : ''}</span><span class="faint">By ${c.consent.wa != null ? 'WhatsApp' : 'email'}</span></span>
              <span class="row-act">${T.btn(open ? 'Hide message' : 'See message', 'toggle', { k: 'msg' + a.id }, 'ghost sm')}${T.btn('Send', 'tell', { app: a.id }, 'sm')}</span>
              ${open ? `<div class="msg-preview"><p class="label">HR template · not progressing</p><p>${e(T.declineMessage(a))}</p><p class="faint">The reason stays internal. A person sends it; AiMY never declines on its own.</p></div>` : ''}
            </div>`; }).join('')}`
          : T.empty('Everyone who left the process has heard back.'), { sub: `Everyone who leaves the process hears within ${T.TELL_WITHIN} days`, src: 'exits and the HR decline template' })}

        ${T.block('First contact to approve', prospects.length ? `
          ${T.batchBar((sel.prospects || []).length, T.btn('Approve first contact', 'contact-batch', {}, 'primary sm'))}
          ${prospects.map(a => { const c = T.cand(a.cand); return `<div class="row">
            <label class="row-main"><input type="checkbox" data-sel="prospects" value="${a.id}" ${(sel.prospects || []).includes(a.id) ? 'checked' : ''}>${T.av(c.name)}<span><b>${e(c.name)}</b><small>Prospect · ${e(c.webSrc)}</small></span></label>
            <span class="row-meta"><span class="faint">${e(T.evCount(a).text)}</span><span class="faint">Email only. No WhatsApp before an opt-in</span></span>
            <span class="row-act"><a class="btn ghost sm" href="#/cand/${a.id}">Open</a></span></div>`; }).join('')}`
          : T.empty('No prospects waiting.'), { sub: 'Web-found people are prospects until they reply. You approve the list once.', src: 'Find results you added' })}
      </div>

      <div class="col">
        ${T.block('Interviews', todayIv.map(i => { const a = T.app(i.app), c = T.cand(a.cand); return `<div class="row compact">
            <a class="row-main" href="#/cand/${a.id}"><span class="when"><b>${i.day === 0 ? i.time : T.fmt(i.day)}</b><small>${i.day === 0 ? 'Today' : T.wday(i.day).split(' ')[0]}</small></span><span><b>${e(c.name)}</b><small>${e(T.STAGES[i.kind].label)} · ${e(T.person(i.who))} · ${e(i.mode)}</small></span></a></div>`; }).join('')
          + (owed.length ? `<p class="label mt">Debriefs owed</p>` + owed.map(i => { const a = T.app(i.app), c = T.cand(a.cand); return `<div class="row compact">
            <a class="row-main" href="#/cand/${a.id}">${T.icon('clock', 16)}<span><b>${e(c.name)}</b><small>${e(T.person(i.who))} · ${T.rel(i.day)}</small></span></a>
            <span class="row-act"><a class="btn ghost sm" href="#/debrief/${i.id}">Debrief link</a></span></div>`; }).join('') : ''),
          { src: 'Bookings and the interview record' })}

        ${T.block('Waiting on others', others.length ? others.map(a => { const c = T.cand(a.cand), w = T.waitOn(a); const label = { client: T.acc(T.req(a.req).acc).name, interviewer: 'Interviewer', candidate: T.first(c.name), approvers: 'Approvers' }[w];
            return `<div class="row compact"><a class="row-main" href="#/cand/${a.id}"><span><b>${e(c.name)}</b><small>${e(T.STAGES[a.stage].label)} · waiting on ${e(label)} ${T.age(a.sendout && a.stage === 'sent' ? (a.sendout.opened ?? a.sendout.sent) : a.since)}</small></span></a></div>`; }).join('') : T.empty('Nothing.'),
          { src: 'sendouts, interviews and offers' })}

        ${T.block('Requisitions at risk', risk.length ? risk.map(r => `<div class="row compact"><a class="row-main" href="#/req/${r.id}"><span><b>${e(r.title)}</b><small>${e(T.acc(r.acc).name)} · target ${T.fmt(r.target)} (${T.rel(r.target)})</small></span></a></div>`).join('') : T.empty('None at risk.'),
          { src: 'requisition targets and the stages people are at' })}
      </div>
    </div>`;
  };

  // ---------- Requisitions ----------
  const CUTS = [
    ['open', 'Open', r => T.isOpen(r)],
    ['risk', 'At risk', r => T.atRisk(r)],
    ['client', 'Waiting on the client', r => T.appsOf(r.id).some(a => T.waitOn(a) === 'client')],
    ['noprofile', 'No profile after 10 days', r => T.isOpen(r) && r.opened <= -10 && r.firstSent == null],
    ['draft', 'Drafts', r => r.state === 'draft'],
    ['hold', 'On hold', r => r.state === 'onhold'],
    ['closed', 'Closed', r => ['filled', 'cancelled'].includes(r.state)],
  ];
  function visibleReqs() {
    const d = T.UI.desk, all = Object.values(DB().reqs);
    if (d === 'omar') return all.filter(r => r.owner === 'omar');
    if (d === 'rania') return all.filter(r => r.hm === 'rania');
    if (d === 'jana') return all.filter(r => r.acc === 'nw');
    return all;
  }
  V.reqs = (r) => {
    const cut = r.q.get('cut') || 'open';
    const list = visibleReqs();
    const fn = (CUTS.find(c => c[0] === cut) || CUTS[0])[2];
    const shown = list.filter(fn);
    return `<div class="page-h"><div><p class="eyebrow">${T.UI.desk === 'dina' ? 'Every requisition' : T.UI.desk === 'rania' ? 'Requisitions you manage' : 'Assigned to you'}</p><h1>Requisitions</h1></div>
      <button class="btn primary" data-act="bar-open" data-say="Open a requisition for 2 Technical Support agents at Northwind">${T.icon('plus', 16)} New requisition</button></div>
      <div class="tabs">${CUTS.map(([k, l, f]) => `<a href="#/reqs?cut=${k}" class="${cut === k ? 'on' : ''}">${l} <span>${list.filter(f).length}</span></a>`).join('')}</div>
      <div class="cards">${shown.length ? shown.map(reqCard).join('') : T.empty('No requisitions in this cut.')}</div>`;
  };
  function reqCard(r) {
    const apps = T.appsOf(r.id).filter(T.active);
    const by = k => apps.filter(a => a.stage === k).length;
    const hired = T.appsOf(r.id).filter(a => ['accepted', 'joined'].includes(a.stage)).length;
    const st = r.state === 'onhold' ? T.chip('On hold', 'warn') : r.state === 'draft' ? T.chip('Draft', 'muted') : r.state === 'filled' ? T.chip('Filled', 'ok') : T.atRisk(r) ? T.chip('At risk', 'bad') : T.chip('Open', 'brand');
    return `<a class="card" href="#/req/${r.id}">
      <div class="card-h"><div><b>${e(r.title)}</b><small>${e(T.acc(r.acc).name)} · ${T.plural(r.seats, 'seat')} · ${e(T.person(r.owner))}</small></div>${st}</div>
      <div class="mini-funnel">${[['In screening', apps.filter(a => ['sourced', 'applied', 'assess', 'phone', 'hr', 'tech', 'mgr'].includes(a.stage)).length], ['With the client', by('sent') + by('client') + by('ctech')], ['Offer', by('offer')], ['Hired', hired]]
        .map(([l, n]) => `<span><b>${n}</b><small>${l}</small></span>`).join('')}</div>
      <div class="card-f"><span class="${r.target < 0 && T.isOpen(r) ? 'bad-t' : 'faint'}">Target ${T.fmt(r.target)}</span>${r.published ? T.chip('Published', 'ok') : T.chip('Not published', 'muted')}</div></a>`;
  }

  // One requisition: Sales's campaign record.
  V.req = (r) => {
    const req = T.req(r.args[0]); if (!req) return T.empty('No such requisition.');
    const acc = T.acc(req.acc), tpl = T.tpl(req);
    const all = T.appsOf(req.id), active = all.filter(T.active), exits = all.filter(a => a.exit);
    const internal = T.UI.desk !== 'jana';
    const reached = k => all.filter(a => tpl.indexOf(a.stage) >= tpl.indexOf(k) && !a.prospect).length;
    const funnel = tpl.filter(k => k !== 'sourced').map(k => [k, reached(k)]);
    let drop = null, dmax = 0;
    for (let i = 1; i < funnel.length; i++) { const d = funnel[i - 1][1] - funnel[i][1]; if (d > dmax && funnel[i - 1][1] > 0) { dmax = d; drop = funnel[i][0]; } }
    const fmax = Math.max(1, ...funnel.map(f => f[1]));
    const decl = T.declinesFor(req.acc);
    const top = T.reasonCounts(decl)[0];
    const prop = DB().props.find(p => p.kind === 'decline' && p.acc === req.acc);
    const lead = req.firstSent != null
      ? `The first profile went ${req.firstSent - req.opened} days after the request opened (target 7). ${active.filter(a => a.stage === 'sent').length} ${active.filter(a => a.stage === 'sent').length === 1 ? 'profile is' : 'profiles are'} with ${e(acc.name)} now.`
      : `No profile has gone to ${e(acc.name)} yet, ${-req.opened} days after the request opened.`;

    return `<a class="crumb" href="#/reqs">${T.icon('back', 15)} Requisitions</a>
    <div class="page-h"><div><p class="eyebrow">${e(acc.name)} · ${e(req.kind)} · ${T.plural(req.seats, 'seat')}</p><h1>${e(req.title)}</h1>
      <p class="sub">Owner ${e(T.person(req.owner))} · hiring manager ${e(T.person(req.hm))} · target ${T.fmt(req.target)} (${T.rel(req.target)})${internal ? ' · budget ' + e(req.budget) : ''}</p></div>
      ${internal ? `<div class="btns">
        ${T.btn(req.published ? T.icon('globe', 15) + ' Published' : 'Not published', 'publish', { req: req.id }, req.published ? 'ok' : 'ghost')}
        ${req.state === 'onhold' ? T.btn('Resume', 'req-state', { req: req.id, to: 'open' }, 'ghost') : req.state === 'draft' ? T.btn('Open it', 'req-state', { req: req.id, to: 'open' }, 'primary') : T.btn('Put on hold', 'req-state', { req: req.id, to: 'onhold' }, 'ghost')}
        <a class="btn primary" href="#/find?req=${req.id}">${T.icon('find', 15)} Find people</a></div>` : ''}
    </div>
    ${req.holdNote && req.state === 'onhold' ? `<p class="note warn">${T.icon('alert', 15)} ${e(req.holdNote)}</p>` : ''}
    ${internal ? T.aimy(lead, 'Reads the sendouts on this requisition.') : ''}
    <div class="grid">
      <div class="col">
        ${T.block('People on this requisition', tpl.slice().reverse().map(k => {
          const here = active.filter(a => a.stage === k);
          if (!here.length) return '';
          return `<p class="label stage-label">${e(T.STAGES[k].label)} <span>${here.length}</span></p>` + here.map(a => internal ? decisionRow(a, { noAct: T.waitOn(a) !== 'me' }) : `<div class="row"><a class="row-main" href="#/cand/${a.id}">${T.av(T.cand(a.cand).name)}<span><b>${e(T.cand(a.cand).name)}</b><small>${e(T.evCount(a).text)}</small></span></a></div>`).join('');
        }).join('') + (exits.length && internal ? `<details class="exits"><summary>${T.plural(exits.length, 'exit')} · not stages</summary>${exits.map(a => `<div class="row compact"><a class="row-main" href="#/cand/${a.id}"><span><b>${e(T.cand(a.cand).name)}</b><small>${e(T.EXITS[a.exit])}${a.decline ? ': ' + e(T.REASONS[a.decline.why]) : a.exitNote ? ': ' + e(a.exitNote) : ''} · ${T.fmt(a.exitDay)}</small></span></a></div>`).join('')}</details>` : ''),
          { sub: 'Latest stage first. No board to drag: the stage moves by one press, with Undo.', src: 'applications' })}
      </div>
      <div class="col">
        ${T.block('Where people drop', `<div class="funnel">${funnel.map(([k, n]) => `<div class="f-row ${k === drop ? 'drop' : ''}"><span class="f-l">${e(T.STAGES[k].label)}</span><span class="bar"><span style="width:${n / fmax * 100}%"></span></span><span class="f-n">${n}</span></div>`).join('')}</div>
          ${drop ? `<p class="faint mt">Biggest step down: into ${e(T.STAGES[drop].label)} (${dmax} fewer).</p>` : ''}`, { sub: 'People who reached each stage', src: 'applications, counted by stage key' })}
        ${internal ? T.block(`Why ${e(acc.name)} passed`, T.reasonBars(decl) + (top ? `<p class="mt">${e(T.REASONS[top[0]])} is behind <b>${top[1]} of ${decl.length}</b> declines in 90 days.</p>` : '') +
          (prop ? `<a class="link-row" href="#/${T.UI.desk === 'dina' ? 'learning' : 'reqs'}">${T.icon('spark', 15)} Learning proposal: ${e(prop.title)} · ${prop.status === 'open' ? 'waiting for the HR Manager' : prop.status}</a>` : ''),
          { sub: 'One reason per decline, picked by the client. Last 90 days, this account only.', src: 'client decisions on sendouts' }) : ''}
        ${T.block('Success profile', `<ul class="sp">${req.criteria.map(c => `<li>${c.must ? T.chip('Must', 'brand') : T.chip('Nice', 'muted')} ${e(c.text)}</li>`).join('')}</ul>
          <p class="faint mt">Criteria ${e(req.critVer)}. Every score on this requisition stores this version.</p>
          ${req.extraCheck ? `<p class="note ok mt">${T.icon('check', 15)} ${e(req.extraCheck)}</p>` : ''}`, { sub: 'The rubric screening is evidence against' })}
        ${internal ? T.block('Stages', `<div class="stages">${tpl.map(k => `<span class="${T.FIXED.includes(k) ? 'fixed' : ''}">${e(T.STAGES[k].label)}</span>`).join('')}</div>
          <p class="faint mt">From the ${e(T.TEMPLATES[acc.template].label)} template, set by the HR Manager.</p>`) : ''}
      </div>
    </div>`;
  };

  // ---------- one candidate on one requisition ----------
  V.cand = (r) => {
    const a = T.app(r.args[0]); if (!a) return T.empty('No such record.');
    const c = T.cand(a.cand), req = T.req(a.req), acc = T.acc(req.acc);
    const internal = T.UI.desk !== 'jana';
    const next = T.nextStage(a), w = T.waitOn(a);
    const other = T.appsFor(c.id).filter(x => x.id !== a.id);
    const offer = T.offerOf(a.id);
    const ivs = Object.values(DB().interviews).filter(i => i.app === a.id);

    let actions = '';
    if (internal && T.active(a)) {
      if (w === 'approval') actions += T.btn('Approve first contact', 'contact-one', { app: a.id }, 'primary');
      else if (w === 'me' && a.stage === 'tech') actions += T.btn('Send the profile', 'writeup-open', { app: a.id }, 'primary');
      else if (w === 'me' && a.stage === 'offer') actions += T.btn('Send the offer', 'offer-send', { app: a.id }, 'primary');
      else if (next && a.stage !== 'sent' && a.stage !== 'offer') actions += T.btn(e(T.STAGES[a.stage].go), 'advance', { app: a.id }, w === 'me' ? 'primary' : 'ghost');
      if (a.stage === 'sent') actions += T.btn('Client declined', 'pass-open', { app: a.id }, 'ghost');
      if (!['offer', 'accepted'].includes(a.stage)) actions += T.btn('Not progressing', 'exit-out', { app: a.id }, 'ghost');
      actions += `<span class="call-wrap">${T.btn(T.icon('phone', 15) + ' Call', 'call', { app: a.id }, 'ghost')}${T.chip('Design target', 'warn', 'title="Telephony is on hold with AiMY Phone (P8)"')}</span>`;
    }

    const verified = req.criteria.map(cr => {
      const f = (c.found || {})[cr.id], st = f ? f.status : 'unchecked';
      return `<tr><td><b>${e(cr.text)}</b></td><td>${e((c.cvSays || {})[cr.id] || 'Not stated')}</td><td>${f ? e(f.text) : '<span class="faint">Not asked yet</span>'}</td>
        <td>${T.chip(T.CHECK[st].label, T.CHECK[st].tone)}</td>
        <td>${f ? `<span class="evi">${T.icon(f.src.startsWith('Assessment') ? 'doc' : 'play', 14)} ${e(f.src)}</span>` : internal ? (T.UI.asked[a.id + cr.id] ? T.chip('In the next interview', 'brand') : T.btn('Ask in the next interview', 'ask-them', { app: a.id, c: cr.id }, 'link')) : ''}</td></tr>`;
    }).join('');

    return `<a class="crumb" href="#/req/${req.id}">${T.icon('back', 15)} ${e(req.title)}</a>
    <div class="page-h cand-h"><div class="who">${T.av(c.name)}<div><p class="eyebrow">${e(c.source)}${c.prospect ? ' · prospect' : ''}</p><h1>${e(c.name)}</h1><p class="sub">${e(c.headline)} · ${e(c.city)}</p></div></div>
      <div class="cand-stage">${T.stageChip(a)}<span class="faint">${a.exit ? T.fmt(a.exitDay) : T.age(a.since) + ' in stage'}${w && internal ? ' · waiting on ' + ({ me: 'you', approval: 'your approval', booked: 'the interview' }[w] || w) : ''}</span></div></div>
    ${actions ? `<div class="btns actions">${actions}</div>` : ''}
    ${T.UI.open['wu' + a.id] ? writeupBox(a) : ''}
    ${T.UI.open['pass' + a.id] ? `<div class="block">${T.reasonPicker(a.id, 'recruiter')}</div>` : ''}
    <div class="grid">
      <div class="col">
        ${a.sendout ? T.block('The sendout', T.sendoutLine(a, { client: !internal }) + (a.sendout.writeup && internal ? `<p class="quote">“${e(a.sendout.writeup)}”</p>` : ''), { sub: `Profile sent to ${e(acc.name)}: a record, not a remark`, src: 'the sendout record' }) : ''}
        ${offer && internal ? offerBlock(offer) : ''}
        ${['accepted', 'joined'].includes(a.stage) ? onboardBlock(a) : ''}
        ${T.block('Against the success profile', T.criteriaRows(a, { readonly: !internal }), { sub: T.evCount(a).text + '. Counts, never a percentage.', src: 'the CV, read as data' })}
        ${T.block('What we verified', `<div class="table-wrap"><table class="tbl"><thead><tr><th>Skill or experience</th><th>CV says</th><th>Interview found</th><th></th><th>Evidence</th></tr></thead><tbody>${verified}</tbody></table></div>
          <p class="faint mt">${T.icon('info', 13)} AiMY suggests each finding from the transcript; the interviewer confirms it before it lands here. The candidate sees and edits only their own layer: what the CV says.</p>`,
          { sub: 'Across every interview and assessment. Every new requisition starts here.', src: 'debriefs and assessment results' })}
      </div>
      <div class="col">
        ${internal ? T.block('Consent', T.consentList(c), { src: 'the candidate record' }) : ''}
        ${ivs.length ? T.block('Interviews', ivs.map(i => `<div class="row compact"><span class="row-main"><span><b>${e(T.STAGES[i.kind].label)}</b><small>${T.wday(i.day)} ${i.time} · ${e(T.person(i.who))} · ${e(i.mode)}${i.recording ? ' · recorded' : ''}</small></span></span>
            <span class="row-act">${i.debrief ? T.chip('Debrief in: ' + (i.debrief.proceed ? 'proceed' : 'stop'), i.debrief.proceed ? 'ok' : 'bad') : i.day < 0 ? `<a class="btn ghost sm" href="#/debrief/${i.id}">Debrief link</a>` : T.chip('Booked', 'brand')}</span></div>`).join(''), { src: 'Bookings and debriefs' }) : ''}
        ${other.length ? T.block('Other applications', other.map(x => `<div class="row compact"><a class="row-main" href="#/cand/${x.id}"><span><b>${e(T.req(x.req).title)}</b><small>${e(T.acc(T.req(x.req).acc).name)}</small></span></a>${T.stageChip(x)}</div>`).join('')) : ''}
        ${internal ? T.block('History', `<form class="logline" data-form="log" data-app="${a.id}"><input class="input" name="t" placeholder="Log what happened, in a sentence: “Called her, she passed the call”"><button class="btn sm">Log</button></form>
          ${T.UI.readback && T.UI.readback.app === a.id ? T.UI.readback.html : ''}
          <ol class="hist">${a.hist.slice().sort((x, y) => y.day - x.day).map(h => `<li><span class="faint">${T.fmt(h.day)}</span> ${e(h.text)} <span class="faint">· ${e(h.who)}</span></li>`).join('')}</ol>`, { sub: 'Logging is a sentence. AiMY reads it back; you confirm.' }) : ''}
      </div>
    </div>`;
  };

  function offerBlock(o) {
    const st = v => v == null ? T.chip('Waiting', 'muted') : v.ok ? T.chip('Approved ' + T.fmt(v.day), 'ok') : T.chip('Not yet: ' + v.note, 'bad');
    return T.block('Offer', `<dl class="facts"><div><dt>Salary</dt><dd>${e(o.salary)}</dd></div><div><dt>Budget band</dt><dd>${e(o.band)}</dd></div><div><dt>Notice</dt><dd>${e(o.notice)}</dd></div><div><dt>Start</dt><dd>${T.fmt(o.start)}</dd></div></dl>
      <div class="approvals"><div><b>${e(T.person('rania'))}</b><small>Fit and salary</small>${st(o.approvals.hm)}<a class="link" href="#/approve/${o.id}/hm">Approval link</a></div>
        <div><b>${e(T.person('hesham'))}</b><small>Budget and headcount</small>${st(o.approvals.bu)}<a class="link" href="#/approve/${o.id}/bu">Approval link</a></div></div>
      ${o.sent != null ? `<p class="note ok">${T.icon('send', 15)} Sent ${T.fmt(o.sent)} by a person.</p>` : '<p class="faint">Both approve the same packet, in parallel. A person sends it. No margin in the packet.</p>'}`,
      { sub: 'One packet, two approvers, two questions', src: 'the offer record' });
  }

  function onboardBlock(a) {
    const c = T.cand(a.cand);
    const ob = a.onboard;
    const items = ob ? [['contract', 'Contract signed'], ['laptop', 'Laptop ordered'], ['access', 'IT access ticket (Freshdesk)'], ['buddy', 'Buddy named']] : [];
    const checks = a.checkins || [{ day: 30, due: (a.joinDay || 0) + 30, done: null }, { day: 90, due: (a.joinDay || 0) + 90, done: null }];
    return T.block(a.stage === 'joined' ? 'Day 1 to day 90' : 'Before day 1', `
      ${a.stage === 'accepted' ? `<p>Joins <b>${T.wday(a.joinDay)}</b> (${T.rel(a.joinDay)}). Accepted to joined is its own stage: dropped offers happen here.</p>
        <ul class="checklist">${items.map(([k, l]) => `<li>${ob[k] ? T.icon('check', 15) : '<span class="dot"></span>'} ${l}</li>`).join('')}</ul>` : ''}
      <p class="label mt">Check-ins</p>
      ${checks.map(k => `<div class="row compact"><span class="row-main"><span><b>Day ${k.day}</b><small>${k.done != null ? 'Done ' + T.fmt(k.done) + ' · ' + e(k.outcome) + (k.note ? ' · “' + e(k.note) + '”' : '') : 'Due ' + T.fmt(k.due) + ' · with the hiring manager and ' + e(T.first(c.name)) + ', separately'}</small></span></span>
        ${k.done != null ? T.chip(k.outcome, 'ok') : T.chip('Not yet', 'muted')}</div>`).join('')}
      <p class="faint mt">Check-ins are separate from probation. Only ${e(T.first(c.name))} and the HR Manager see individual answers; AiMY learns from them only in aggregate.</p>`,
      { src: 'onboarding plan and check-ins' });
  }

  // ---------- Find people (P4, M7) ----------
  const POOL = [
    { id: 'ingy', name: 'Ingy Farouk', head: 'Technical support, German C1', touch: 'Reached Technical interview for Northwind in May · client declined: notice period', ev: 'mmmmu', wa: true },
    { id: 'mahmoud', name: 'Mahmoud Saad', head: 'Service desk lead, German B2', touch: 'Applied for IT Helpdesk in June · withdrew', ev: 'pmmuu', wa: false },
    { id: 'rewan', name: 'Rewan Ali', head: 'Customer success, German C1', touch: 'Phone screen in April · passed, role cancelled by the client', ev: 'muumm', wa: true },
  ];
  const WEB = [
    { id: 'hegazy', name: 'Omar Hegazy', head: 'Support engineer, speaks German', src: 'Speaker page, cairotechmeetup.example', ev: 'puuuu' },
    { id: 'nesma', name: 'Nesma Adly', head: 'L2 support, Zendesk certified', src: 'Personal portfolio site', ev: 'umuuu' },
    { id: 'fouad', name: 'Fouad Kamel', head: 'IT support, German C1', src: 'Company team page, deltadesk.example', ev: 'muumu' },
  ];
  V.find = (r) => {
    const reqId = r.q.get('req') || (T.UI.find && T.UI.find.req) || 'r1';
    const req = T.req(reqId);
    const f = T.UI.find;
    const ran = f && f.ran && f.req === reqId;
    const sel = (T.UI.sel || {}).find || [];
    const evFor = s => s.slice(0, req.criteria.length).padEnd(req.criteria.length, 'u');
    const countOf = s => { const ev = evFor(s); const must = req.criteria.map((c, i) => c.must ? ev[i] : null).filter(Boolean); return { met: must.filter(x => x === 'm').length, of: must.length, unk: must.filter(x => x === 'u').length }; };
    const on = new Set(T.appsOf(reqId).map(a => a.cand));
    const pool = POOL.filter(p => !on.has(p.id)), web = WEB.filter(p => !on.has(p.id));
    const row = (p, kind) => {
      const k = countOf(p.ev), id = kind + ':' + p.id, enriched = (T.UI.enriched || {})[p.id];
      const open = T.UI.open['fr' + p.id];
      return `<div class="row">
        <label class="row-main"><input type="checkbox" data-sel="find" value="${id}" ${sel.includes(id) ? 'checked' : ''}>${T.av(p.name)}<span><b>${e(p.name)}</b><small>${e(p.head)}</small></span></label>
        <span class="row-meta"><span>${k.met} of ${k.of} must-haves met${k.unk ? ' · ' + k.unk + ' not known' : ''}</span>
          <span class="src-label">${kind === 'pool' ? T.icon('db', 12) + ' Talent pool · ' + e(p.touch) : T.icon('globe', 12) + ' ' + e(p.src)}</span></span>
        <span class="row-act">${kind === 'web' ? (enriched ? T.chip('Work email · Apollo', 'ok') : T.btn('Add work email', 'enrich', { id: p.id }, 'ghost sm')) : ''}${T.btn(open ? 'Hide why' : 'Why', 'toggle', { k: 'fr' + p.id }, 'ghost sm')}</span>
        ${open ? `<div class="crit inline">${req.criteria.map((c, i) => { const v = T.VERDICT[{ m: 'meets', p: 'partly', n: 'not', u: 'unknown' }[evFor(p.ev)[i]]]; return `<div class="crit-row"><div class="crit-name">${e(c.text)}</div><div class="crit-v">${T.chip(v.label, v.tone)}</div><div class="crit-q">${v.label === 'Not known' ? '<span class="faint">Nothing on the page says.</span>' : ''}</div><div></div></div>`; }).join('')}</div>` : ''}
      </div>`;
    };
    const reqOpts = T.myReqs(T.UI.desk === 'omar' ? 'omar' : null).length ? T.myReqs('omar') : Object.values(DB().reqs);
    return `<div class="page-h"><div><p class="eyebrow">Sourcing</p><h1>Find people</h1></div></div>
      <div class="block find-form">
        <form data-form="find" class="find-row">
          <label class="label" for="find-req">For</label>
          <select class="input" id="find-req" name="req">${reqOpts.filter(x => T.isOpen(x)).map(x => `<option value="${x.id}" ${x.id === reqId ? 'selected' : ''}>${e(x.title)} · ${e(T.acc(x.acc).name)}</option>`).join('')}</select>
          <input class="input grow" name="brief" value="${e((f && f.req === reqId && f.brief) || 'Someone like Bassem Youssef, who joined in August')}" aria-label="Describe who you want">
          <button class="btn primary">${T.icon('find', 15)} Search</button>
        </form>
        <div class="sources">
          <span>${T.icon('db', 14)} <b>Talent pool</b> first</span>
          <span>${T.icon('globe', 14)} <b>Public web</b> second: public profiles and company pages, never LinkedIn scraping</span>
          <span>${T.icon('link', 14)} <b>Apollo</b>: adds a work email to a result, after you pick it</span>
          <span class="parked">${T.icon('lock', 14)} <b>SignalHire</b> · Parked (D10)</span>
          <span class="parked">${T.icon('lock', 14)} <b>LinkedIn Recruiter</b> · Parked (D10)</span>
        </div>
      </div>
      ${ran ? `
        ${T.aimy(`I read that as the success profile for <b>${e(req.title)}</b>: ${req.criteria.filter(c => c.must).map(c => '<span class="chip brand">' + e(c.text) + '</span>').join(' ')} and searched your pool first.`, 'Edit the success profile on the requisition to change what counts.')}
        ${T.batchBar(sel.length, T.btn('Add ' + sel.length + ' to ' + e(req.title), 'find-add', { req: reqId }, 'primary sm'))}
        ${T.block('From your talent pool', pool.map(p => row(p, 'pool')).join('') || T.empty('No one new in the pool.'), { sub: 'People we already know, with their history', src: 'the talent pool' })}
        ${T.block('From the public web', web.map(p => row(p, 'web')).join('') || T.empty('No new web results.'), { sub: 'Prospects until they reply. You approve first contact once per list. No WhatsApp before an opt-in.', src: 'public pages, each named' })}`
      : T.empty('Pick a requisition or describe who you want, then search.')}`;
  };
  T.FIND = { POOL, WEB };

  // ---------- Assessments ----------
  V.asmts = () => `<div class="page-h"><div><p class="eyebrow">Assessments</p><h1>Assessments</h1></div></div>
    <div class="cards">${Object.values(DB().asmts).map(a => {
      const worst = a.qs.slice().sort((x, y) => x.right - y.right)[0];
      return `<a class="card" href="#/asmt/${a.id}"><div class="card-h"><div><b>${e(a.title)}</b><small>${e(a.kind)} · pass mark ${e(a.pass)}</small></div>${T.chip(a.taken + ' taken', 'muted')}</div>
      <p class="faint">Used on ${a.reqs.map(id => e(T.req(id).title)).join(', ')}</p>
      <div class="card-f"><span>${Math.round((1 - worst.right) * 100)}% got Q${a.qs.indexOf(worst) + 1} wrong</span>${T.chip('Link to share', 'brand')}</div></a>`; }).join('')}</div>`;

  V.asmt = (r) => {
    const a = DB().asmts[r.args[0]]; if (!a) return T.empty('No such assessment.');
    const worst = a.qs.slice().sort((x, y) => x.right - y.right)[0], wi = a.qs.indexOf(worst) + 1;
    const pending = DB().props.find(p => p.kind === 'question' && p.asmt === a.id && p.q === worst.id && p.status === 'open');
    return `<a class="crumb" href="#/asmts">${T.icon('back', 15)} Assessments</a>
    <div class="page-h"><div><p class="eyebrow">${e(a.kind)} · pass mark ${e(a.pass)} · ${a.taken} taken</p><h1>${e(a.title)}</h1></div>
      <div class="btns">${T.btn(T.icon('link', 15) + ' Copy the link', 'copy-link', { what: 'assessment' }, 'ghost')}</div></div>
    ${T.aimy(`${Math.round((1 - worst.right) * 100)}% of ${a.taken} people got <b>Q${wi}</b> wrong. Either the question is unclear, or it tests something the role does not need.`,
      pending ? `A rewording is waiting for ${e(T.person('dina'))}'s approval.` : 'Changing a question is a learning proposal: the HR Manager approves it, and the question keeps its earlier wording as a version.')}
    ${pending ? '' : `<div class="btns actions">${T.btn('Propose a rewording', 'q-propose', { a: a.id, q: worst.id, how: 'reword' }, 'primary')}${T.btn('Propose dropping it', 'q-propose', { a: a.id, q: worst.id, how: 'drop' }, 'ghost')}</div>`}
    ${T.block('Questions', `<div class="qs">${a.qs.map((q, i) => `<div class="q ${q === worst && !q.dropped ? 'flag' : ''} ${q.dropped ? 'dropped' : ''}">
        <div class="q-h"><b>Q${i + 1}</b><span>${e(q.text)}</span>${q.dropped ? T.chip('Dropped · approved by Dina Ragab', 'muted') : ''}</div>
        <div class="q-stats"><span class="bar"><span style="width:${q.right * 100}%"></span></span><span>${Math.round(q.right * 100)}% right</span></div>
        <div class="q-out">${q.out && q.out.n >= 20 ? `${T.icon('link', 13)} Right on Q${i + 1}: <b>${q.out.right[0]} of ${q.out.right[1]}</b> met the client. Wrong: <b>${q.out.wrong[0]} of ${q.out.wrong[1]}</b>.`
          : T.gate(a.sentToClient, 20, 'outcomes so far. AiMY ties a question to client decisions once 20 people who took it have been sent.')}</div>
        ${q.versions && q.versions.length > 1 ? `<details class="vers"><summary>${T.icon('hist', 13)} v${q.versions[q.versions.length - 1].v}, approved by ${e(q.versions[q.versions.length - 1].by)}, ${T.fmt(q.versions[q.versions.length - 1].day)}</summary>${q.versions.slice(0, -1).reverse().map(v => `<p class="faint">v${v.v} · ${e(v.by)} · ${T.fmt(v.day)}: “${e(v.text)}”</p>`).join('')}</details>` : ''}
      </div>`).join('')}</div>`, { src: 'assessment results and the sendouts of the people who took it' })}`;
  };

  // ---------- Reports (P2, P6) ----------
  V.reports = () => {
    const H = T.HISTORY.funnel;
    const max = H[0][1];
    const decl = T.declinesFor(null);
    const byAcc = Object.values(DB().accounts).filter(a => a.billable).map(acc => {
      const reqs = Object.values(DB().reqs).filter(r => r.acc === acc.id);
      const apps = Object.values(DB().apps).filter(a => T.req(a.req).acc === acc.id);
      const sent = apps.filter(a => a.sendout).length, met = apps.filter(a => a.sendout && a.sendout.result === 'meet').length;
      const top = T.reasonCounts(T.declinesFor(acc.id))[0];
      return `<tr><td><b>${e(acc.name)}</b></td><td>${reqs.filter(T.isOpen).length}</td><td>${sent}</td><td>${met}</td><td>${top ? e(T.REASONS[top[0]]) + ' (' + top[1] + ')' : '—'}</td></tr>`;
    }).join('');
    const recruiters = ['karim', 'lina', 'omar'].map(k => T.STAFF[k].name).sort();
    const rk = Object.fromEntries(Object.entries(T.STAFF).map(([k, v]) => [v.name, k]));
    const showPeople = T.UI.desk === 'dina';
    return `<div class="page-h"><div><p class="eyebrow">${e(T.HISTORY.scope)}</p><h1>Reports</h1></div></div>
    <section class="insight">
      <p class="label">${T.mark(14)} Where people are lost</p>
      <p class="insight-t">Most people are lost <b>before the client sees them</b>: 268 passed the phone screen and 81 profiles were sent, and sending the first profile took <b>14 days</b> on average.</p>
      <p>At the client, 81 profiles led to 24 interviews: <b>3.4 profiles per client interview</b>, inside the usual agency range of 3 to 5, and clients hired 21 of the 24 they met. That benchmark is weak (vendor blogs and a 2018 survey), so read it as a range, not a target.</p>
      <div class="insight-a"><span class="faint">One action</span><a class="btn primary sm" href="#/reqs?cut=noprofile">See requisitions with no profile after 10 days</a></div>
    </section>
    <div class="tiles">${T.METRICS.slice(0, 5).map(m => `<div class="tile"><span class="tile-n">${e(m.v)}</span><span class="tile-l">${e(m.k)}</span><span class="tile-d">${e(m.unit)} · ${m.start ? e(m.start) + ' → ' : ''}${e(m.stop)}</span></div>`).join('')}</div>
    <div class="grid">
      <div class="col">
        ${T.block('The funnel, Aug–Sep', `<div class="funnel">${H.map(([l, n], i) => `<div class="f-row ${i === 3 ? 'drop' : ''}"><span class="f-l">${e(l)}</span><span class="bar"><span style="width:${n / max * 100}%"></span></span><span class="f-n">${n}</span><span class="f-p">${i ? Math.round(n / H[i - 1][1] * 100) + '%' : ''}</span></div>`).join('')}</div>
          <p class="faint mt">Share of the stage before. Nothing before the phone screen was measured; calls before it are counted from now on.</p>`, { src: 'the Power BI export, one definition per count' })}
        ${T.block('Why clients pass', T.reasonBars(decl) + `<p class="faint mt">${decl.length} declines in 90 days, each with one reason the client picked. Free text only for Other.</p>`, { src: 'client decisions on sendouts' })}
      </div>
      <div class="col">
        ${T.block('By account', `<div class="table-wrap"><table class="tbl"><thead><tr><th>Account</th><th>Open</th><th>Sent</th><th>Met</th><th>Top reason to pass</th></tr></thead><tbody>${byAcc}</tbody></table></div>`, { src: 'requisitions and sendouts' })}
        ${showPeople ? T.block('By recruiter', `<div class="table-wrap"><table class="tbl"><thead><tr><th>Recruiter</th><th>Open requisitions</th><th>Profiles sent</th><th>Hired</th></tr></thead><tbody>${recruiters.map(n => {
            const k = rk[n], reqs = Object.values(DB().reqs).filter(r => r.owner === k), apps = Object.values(DB().apps).filter(a => reqs.includes(T.req(a.req)));
            return `<tr><td>${e(n)}</td><td>${reqs.filter(T.isOpen).length}</td><td>${apps.filter(a => a.sendout).length}</td><td>${apps.filter(a => ['accepted', 'joined'].includes(a.stage)).length}</td></tr>`; }).join('')}</tbody></table></div>
          <p class="faint mt">Counts, in alphabetical order. Not a ranking: decision D5 may move per-person views to AiMY QA.</p>`) : ''}
        ${T.block('What each number means', `<div class="table-wrap"><table class="tbl dict"><thead><tr><th>Metric</th><th>Unit</th><th>From → to</th></tr></thead><tbody>${T.METRICS.map(m => `<tr><td><b>${e(m.k)}</b>${m.note ? `<small>${e(m.note)}</small>` : ''}</td><td>${e(m.unit)}</td><td>${m.start ? e(m.start) + ' → ' : ''}${e(m.stop)}</td></tr>`).join('')}</tbody></table></div>`, { sub: 'One definition per count, before any number is shown' })}
      </div>
    </div>`;
  };
})();

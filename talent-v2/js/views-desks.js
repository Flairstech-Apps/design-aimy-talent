/* AiMY Talent v2 · the hiring manager's, HR Manager's and client's desks.
   The more senior the desk, the more it sees and the less it changes; the
   client's desk subtracts: no salary, no internal notes, no other clients. */
(function () {
  const T = window.T;
  const V = T.views;
  const e = T.esc;
  const DB = () => T.DB;

  // ---------- Hiring manager: asks by account, oldest first (M11) ----------
  V.asks = () => {
    const items = [];
    for (const o of Object.values(DB().offers)) {
      const a = T.app(o.app);
      if (!o.approvals.hm && o.sent == null) items.push({ acc: T.req(a.req).acc, day: a.since, html: `<div class="row"><span class="row-main">${T.icon('check', 16)}<span><b>Approve the offer to ${e(T.cand(a.cand).name)}</b><small>${e(T.req(a.req).title)} · ${e(o.salary)} against ${e(o.band)}</small></span></span><span class="row-act"><a class="btn primary sm" href="#/approve/${o.id}/hm">Review offer</a></span></div>` });
    }
    for (const k of DB().asks.filter(k => k.status === 'open')) items.push({ acc: k.acc, day: k.day, html: `<div class="row"><span class="row-main">${T.icon('msg', 16)}<span><b>${e(T.person(k.from))} asked for a hire</b><small>“${e(k.text)}”</small></span></span><span class="row-act">${T.btn('Open as a draft requisition', 'ask-draft', { id: k.id }, 'primary sm')}</span></div>` });
    for (const a of Object.values(DB().apps)) {
      if (a.stage === 'sent' && !a.exit && a.sendout && !a.sendout.decided && T.req(a.req).hm === 'rania') {
        const since = a.sendout.opened ?? a.sendout.sent, acc = T.acc(T.req(a.req).acc);
        items.push({ acc: acc.id, day: since, html: `<div class="row"><a class="row-main" href="#/cand/${a.id}">${T.icon('clock', 16)}<span><b>${e(acc.name)} owes an answer on ${e(T.cand(a.cand).name)}</b><small>${a.sendout.opened != null ? 'Opened ' + T.rel(a.sendout.opened) : 'Not opened, sent ' + T.rel(a.sendout.sent)} · ${e(T.req(a.req).title)}</small></span></a>
          <span class="row-act">${a.nudged != null ? T.chip('Nudged ' + T.rel(a.nudged), 'muted') : T.btn('Nudge the client', 'nudge', { app: a.id }, 'ghost sm')}</span></div>` });
      }
    }
    const groups = {};
    for (const it of items) (groups[it.acc] = groups[it.acc] || []).push(it);
    const order = Object.entries(groups).map(([acc, list]) => [acc, list.sort((a, b) => a.day - b.day)]).sort((a, b) => a[1][0].day - b[1][0].day);
    const oldest = items.length ? Math.max(...items.map(i => -i.day)) : 0;
    const advanced = Object.values(DB().apps).filter(a => T.req(a.req).hm === 'rania' && T.active(a) && ['sent', 'client', 'ctech', 'offer', 'accepted'].includes(a.stage));
    const under = Object.values(DB().apps).filter(a => T.req(a.req).hm === 'rania' && T.active(a) && !advanced.includes(a) && !a.prospect).length;
    return `<div class="page-h"><div><p class="eyebrow">${T.wday(0)} · Hiring manager</p><h1>Good morning, Rania</h1></div></div>
    <div class="hero"><div><span class="hero-n">${items.length}</span><span class="hero-l">asks waiting on you</span></div>
      <div class="hero-side"><span>Oldest: <b>${T.plural(oldest, 'day')}</b></span><span class="faint">Grouped by account, oldest first.</span></div></div>
    <div class="grid">
      <div class="col">${order.map(([acc, list]) => T.block(e(T.acc(acc).name), list.map(i => i.html).join(''), { sub: T.plural(list.length, 'ask') + ' · oldest ' + T.age(list[0].day) })).join('') || T.block('Asks', T.empty('Nothing waits on you.'))}</div>
      <div class="col">
        ${T.block('Advanced to you', advanced.map(a => `<div class="row compact"><a class="row-main" href="#/cand/${a.id}"><span><b>${e(T.cand(a.cand).name)}</b><small>${e(T.req(a.req).title)} · ${e(T.evCount(a).text)}</small></span></a>${T.stageChip(a)}</div>`).join('') || T.empty('None yet.'),
          { sub: `Only people the recruiter advanced. ${under} more under review with recruiters, not shown.`, src: 'applications at Profile sent and later' })}
      </div>
    </div>`;
  };

  // ---------- HR Manager ----------
  V.hr = () => {
    const reqs = Object.values(DB().reqs);
    const risk = reqs.filter(T.atRisk);
    const owed = Object.values(DB().interviews).filter(i => i.day < 0 && !i.debrief);
    const props = DB().props.filter(p => p.status === 'open');
    const untold = T.untold();
    const recruiters = ['karim', 'lina', 'omar'].map(k => [k, T.STAFF[k].name]).sort((a, b) => a[1].localeCompare(b[1]));
    const cause = r => r.target < 0 ? 'Past its target date' : r.firstSent == null ? 'No profile sent yet' : 'Fewer people with the client than seats';
    return `<div class="page-h"><div><p class="eyebrow">${T.wday(0)} · HR Manager</p><h1>Good morning, Dina</h1></div></div>
    ${T.aimy(`${T.plural(risk.length, 'requisition is', 'requisitions are')} at risk. ${props.length ? T.plural(props.length, 'learning proposal waits', 'learning proposals wait') + ' for you; the Northwind one comes from 18 client declines.' : ''} ${untold.length} ${untold.length === 1 ? 'person is' : 'people are'} owed an answer across the team.`, 'Reads requisitions, client declines and exits.')}
    <div class="hero"><div><span class="hero-n">${risk.length}</span><span class="hero-l">requisitions at risk</span></div>
      <div class="hero-side"><span>Target dates moved this month: <b>2</b></span><span class="faint">Shown beside each other so moving a date does not hide a risk.</span></div></div>
    <div class="grid">
      <div class="col">
        ${T.block('At risk', risk.map(r => `<div class="row"><a class="row-main" href="#/req/${r.id}"><span><b>${e(r.title)}</b><small>${e(T.acc(r.acc).name)} · ${e(T.person(r.owner))} · ${e(cause(r))}</small></span></a>
          <span class="row-meta"><span class="${r.target < 0 ? 'bad-t' : 'warn-t'}">Target ${T.fmt(r.target)}</span></span>
          <span class="row-act">${T.btn('Reassign', 'reassign', { req: r.id }, 'ghost sm')}</span></div>`).join('') || T.empty('None.'), { src: 'requisition targets and sendouts' })}
        ${T.block('Learning proposals', props.map(p => `<a class="row" href="#/learning"><span class="row-main">${T.icon('spark', 16)}<span><b>${e(p.title)}</b><small>${e(p.why)}</small></span></span></a>`).join('') || T.empty('None waiting.'), { sub: 'Changes AiMY proposes to its own rules. You approve each.', right: `<a class="link" href="#/learning">Open</a>` })}
      </div>
      <div class="col">
        ${T.block('Debriefs owed', owed.map(i => { const a = T.app(i.app); return `<div class="row compact"><span class="row-main"><span><b>${e(T.person(i.who))}</b><small>${e(T.cand(a.cand).name)} · ${e(T.STAGES[i.kind].label)} · ${T.rel(i.day)}</small></span></span>${T.chip('Reminded 9:00', 'muted')}</div>`; }).join('') || T.empty('None.'), { src: 'the interview record' })}
        ${T.block('Team load', `<div class="table-wrap"><table class="tbl"><thead><tr><th>Recruiter</th><th>Open requisitions</th><th>People in process</th><th>Not told yet</th></tr></thead><tbody>${recruiters.map(([k, n]) => {
            const rs = reqs.filter(r => r.owner === k && T.isOpen(r)); const ap = Object.values(DB().apps).filter(a => rs.includes(T.req(a.req)) && T.active(a));
            return `<tr><td>${e(n)}</td><td>${rs.length}</td><td>${ap.length}</td><td>${untold.filter(a => T.req(a.req).owner === k).length}</td></tr>`; }).join('')}</tbody></table></div>
          <p class="faint mt">For reassigning work. Alphabetical; not a league table.</p>`, { src: 'requisitions and applications' })}
      </div>
    </div>`;
  };

  // Learning proposals (P1→P5, P7).
  V.learning = () => {
    const props = DB().props;
    const card = p => {
      const done = p.status !== 'open';
      return `<div class="prop ${done ? 'done' : ''}">
        <div class="prop-h">${T.icon('spark', 16)}<b>${e(p.title)}</b>${done ? T.chip(p.status === 'approved' ? 'Approved ' + T.fmt(p.decided) : 'Not now', p.status === 'approved' ? 'ok' : 'muted') : T.chip(p.kind === 'decline' ? 'From client declines' : 'From assessment results', 'brand')}</div>
        <p><span class="label">Evidence</span>${e(p.why)}</p>
        <p><span class="label">Change</span>${p.kind === 'question' ? '“' + e(p.change) + '”' : e(p.change)}</p>
        ${p.kind === 'question' ? `<p class="faint">Was: “${e(DB().asmts[p.asmt].qs.find(q => q.id === p.q).versions[0].text)}”</p>` : ''}
        <p class="faint">Scope: ${e(p.scope)}. ${p.by ? 'Proposed by ' + e(p.by) + ' with AiMY' : 'Drafted by AiMY'}, ${T.fmt(p.day)}. Never applied to one person's record.</p>
        ${done ? '' : `<div class="btns">${T.btn('Approve', 'prop', { id: p.id, to: 'approved' }, 'primary sm')}${T.btn('Not now', 'prop', { id: p.id, to: 'declined' }, 'ghost sm')}</div>`}
      </div>`;
    };
    return `<div class="page-h"><div><p class="eyebrow">HR Manager</p><h1>Learning proposals</h1><p class="sub">AiMY drafts changes to its own rules from outcome evidence. A person approves each one.</p></div></div>
      <div class="grid">
        <div class="col">${T.block('Waiting for you', props.filter(p => p.status === 'open').map(card).join('') || T.empty('Nothing waiting.'))}
          ${props.some(p => p.status !== 'open') ? T.block('Decided', props.filter(p => p.status !== 'open').map(card).join('')) : ''}</div>
        <div class="col">
          ${T.block('From day-90 check-ins', `${T.gate(DB().checkins90, DB().CHECKIN_GATE, 'day-90 check-ins')}
            <p class="mt">AiMY drafts nothing from check-ins until there are ${DB().CHECKIN_GATE}. At about 21 hires in two months, a pattern needs months of data.</p>
            <p class="faint mt">Check-ins are separate from probation; they never feed one person's record.</p>`, { sub: 'Gated by sample size', src: 'check-ins on past hires' })}
          ${T.block('How a client decline becomes a rule', `<ol class="steps"><li>The client picks one reason when they pass.</li><li>When one reason is behind at least 3 of 5 or more declines in 90 days, and a third of them, AiMY drafts a proposal for that client only.</li><li>You approve it. The success profile gets a new version; earlier scores keep theirs.</li></ol>`)}
        </div>
      </div>`;
  };

  // What AiMY may do (m4): a person moves a rung up; overrides move it down.
  V.autonomy = () => `<div class="page-h"><div><p class="eyebrow">HR Manager</p><h1>What AiMY may do</h1><p class="sub">Per action: suggest, do with Undo, or do and tell. Only a person moves an action up.</p></div></div>
    ${T.block('Actions', DB().autonomy.map(x => `<div class="ladder">
        <div class="ladder-h"><b>${e(x.label)}</b>${x.lock ? `<span class="faint">${T.icon('lock', 13)} A person decides each time</span>` : ''}</div>
        <div class="rungs" role="group" aria-label="${e(x.label)}">${T.RUNGS.map((l, i) => `<button class="rung ${i === x.rung ? 'on' : ''}" ${x.lock && i ? 'disabled' : ''} data-act="rung" data-k="${x.k}" data-to="${i}">${l}</button>`).join('')}</div>
        ${x.log.length ? `<p class="faint">${x.log.map(l => T.fmt(l.day) + ': ' + e(l.text)).join(' · ')}</p>` : ''}
      </div>`).join(''), { src: 'the autonomy settings and override log' })}`;

  V.templates = () => `<div class="page-h"><div><p class="eyebrow">HR Manager</p><h1>Stage templates</h1><p class="sub">One per client account, drawn from one library so reports count across clients. A requisition takes its account's stages when it opens.</p></div></div>
    ${Object.entries(T.TEMPLATES).map(([k, t]) => T.block(e(t.label), `<div class="stages edit">${Object.keys(T.STAGES).map(s => {
        const on = t.stages.includes(s), fixed = T.FIXED.includes(s);
        const busy = Object.values(DB().apps).filter(a => a.stage === s && T.active(a) && T.acc(T.req(a.req).acc).template === k).length;
        return `<button class="${on ? 'on' : ''} ${fixed ? 'fixed' : ''}" ${fixed || (on && busy) ? 'disabled' : ''} data-act="tpl-stage" data-t="${k}" data-s="${s}" title="${fixed ? 'Every template keeps this stage' : on && busy ? busy + ' people are at this stage' : ''}">${e(T.STAGES[s].label)}</button>`; }).join('')}</div>
      <p class="faint mt">Used by ${Object.values(DB().accounts).filter(a => a.template === k).map(a => e(a.name)).join(', ') || 'no account'}. Greyed stages are fixed, or have people at them.</p>`)).join('')}`;

  // ---------- Client desk (Jana, Northwind) ----------
  V.client = () => {
    const apps = Object.values(DB().apps).filter(a => T.req(a.req).acc === 'nw' && a.sendout);
    const waiting = apps.filter(a => !a.sendout.decided && !a.exit).sort((a, b) => a.sendout.sent - b.sendout.sent);
    const decided = apps.filter(a => a.sendout.decided != null).sort((a, b) => b.sendout.decided - a.sendout.decided);
    const ivs = Object.values(DB().interviews).filter(i => i.who === 'jana');
    const reqs = Object.values(DB().reqs).filter(r => r.acc === 'nw' && T.isOpen(r));
    const card = a => {
      const c = T.cand(a.cand), r = T.req(a.req), open = T.UI.open['so' + a.id];
      return `<div class="so">
        <div class="so-h">${T.av(c.name)}<div><b>${e(c.name)}</b><small>${e(r.title)} · sent ${T.rel(a.sendout.sent)}</small></div>
          ${a.sendout.decided != null ? T.chip(a.sendout.result === 'pass' ? 'You passed' : 'You want to meet', a.sendout.result === 'pass' ? 'bad' : 'ok') : open ? '' : T.btn('Open profile', 'so-open', { app: a.id }, 'primary sm')}</div>
        ${open || a.sendout.decided != null ? `
          ${T.sendoutLine(a, { client: true })}
          ${a.sendout.writeup ? `<p class="quote">“${e(a.sendout.writeup)}”<span class="faint"> · ${e(T.person(a.sendout.by))}, FlairsTech</span></p>` : ''}
          ${a.sendout.decided == null ? `${T.criteriaRows(a, { readonly: true })}
            ${T.UI.open['pass' + a.id] ? T.reasonPicker(a.id, 'client') : `<div class="btns">${T.btn('Meet them', 'meet', { app: a.id }, 'primary')}${T.btn('Pass', 'pass-open', { app: a.id }, 'ghost')}</div>`}` : ''}` : ''}
      </div>`;
    };
    return `<div class="page-h"><div><p class="eyebrow">Northwind Software · Client</p><h1>Hello, Jana</h1></div></div>
    <div class="hero"><div><span class="hero-n">${waiting.length}</span><span class="hero-l">${waiting.length === 1 ? 'profile waits' : 'profiles wait'} for your decision</span></div>
      <div class="hero-side"><span class="faint">You see the evidence against your success profile. Salaries and our internal notes stay with FlairsTech.</span></div></div>
    <div class="grid">
      <div class="col">
        ${T.block('Profiles sent to you', waiting.map(card).join('') || T.empty('Nothing waits for you.'), { sub: 'Oldest first' })}
        ${decided.length ? T.block('Decided', decided.map(card).join('')) : ''}
      </div>
      <div class="col">
        ${T.block('Your interviews', ivs.map(i => { const a = T.app(i.app); return `<div class="row compact"><span class="row-main"><span class="when"><b>${i.time}</b><small>${T.wday(i.day).split(' ')[0]} ${T.fmt(i.day)}</small></span><span><b>${e(T.cand(a.cand).name)}</b><small>${e(T.STAGES[i.kind].label)} · ${e(i.mode)}</small></span></span></div>`; }).join('') || T.empty('None booked.'))}
        ${T.block('Your requests', reqs.map(r => { const ap = T.appsOf(r.id).filter(T.active); const n = ks => ap.filter(a => ks.includes(a.stage)).length;
          return `<div class="row compact"><span class="row-main"><span><b>${e(r.title)}</b><small>${T.plural(r.seats, 'seat')} · ${n(['applied', 'assess', 'phone', 'hr', 'tech'])} in screening at FlairsTech · ${n(['sent'])} with you · ${n(['client', 'ctech'])} interviewing</small></span></span></div>`; }).join(''))}
        ${T.block('Ask for a hire', `<form data-form="client-ask" class="logline"><input class="input" name="t" placeholder="Say it in a sentence: “Two more German seats from January”"><button class="btn sm">Send</button></form>
          <p class="faint mt">Goes to your account manager, ${e(T.person('rania'))}, who talks it through with you before it opens.</p>`)}
      </div>
    </div>`;
  };

  // Your hiring with us (M10): billed hires beside acceptance and retention.
  V['client-hiring'] = () => {
    const decl = T.declinesFor('nw');
    return `<div class="page-h"><div><p class="eyebrow">Northwind Software · last 6 months</p><h1>Your hiring with us</h1></div></div>
    <div class="tiles">
      <div class="tile"><span class="tile-n">4</span><span class="tile-l">Hires billed</span><span class="tile-d">person · candidate proceeded after the first interview</span></div>
      <div class="tile"><span class="tile-n">3.6</span><span class="tile-l">Profiles per interview</span><span class="tile-d">18 sent · 5 you interviewed</span></div>
      <div class="tile"><span class="tile-n">3 of 3</span><span class="tile-l">Still with you at day 90</span><span class="tile-d">1 more hire has not reached day 90</span></div>
      <div class="tile"><span class="tile-n">2 of 3</span><span class="tile-l">Requests with a profile in 7 days</span><span class="tile-d">our promise to you</span></div>
    </div>
    <div class="grid"><div class="col">
      ${T.block('Why you passed', T.reasonBars(decl) + `<p class="mt">Spoken German is behind ${decl.filter(d => d.why === 'lang').length} of ${decl.length} of your declines. ${DB().props.find(p => p.id === 'p1' && p.status === 'approved') ? 'We added a spoken German check before a profile reaches you.' : 'We are reviewing a spoken German check before a profile reaches you.'}</p>`, { sub: 'Your own decisions, last 90 days' })}
    </div><div class="col">
      ${T.block('What is coming', T.aimy(e(T.acc('nw').news), 'From your news. A German-speaking hiring forecast follows from it.'))}
    </div></div>`;
  };
})();

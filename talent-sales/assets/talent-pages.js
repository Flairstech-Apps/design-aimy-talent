/* AiMY Talent on Sales · 2 of 3: painting. Every page is drawn in Sales's
   markup: the Today block (.slv) and its Start strip, the title that is the
   tab switcher (.b-switch), cut chips, queue cards (.b-qcard), the pager of
   fifteen, record pages (.s-rec-head), and the lead insight (.s-insight). */
(function () {
  const T = window.T;
  const e = T.esc;
  const D = () => T.DB;
  const P = (T.pages = {});
  const PAGE = 15;

  // ---------- shared parts ----------
  const slvN = (label, go) => `<button class="slv-n" type="button" data-go='${JSON.stringify(go)}'>${e(label)}</button>`;
  const starts = list => `<div class="s-starts-wrap"><span class="s-starts-cap">Start</span><div class="s-starts" role="group" aria-label="Ways to start">${list.map(s =>
      `<button class="s-start" type="button"${T.attr(s.data)}><span class="s-start-top"><span class="s-start-label">${e(s.label)}</span>${s.n != null ? `<span class="s-start-n">${s.n}</span>` : ''}</span><span class="s-start-why">${e(s.why)}</span></button>`).join('')}</div></div>`;
  const todayBlock = (lines, st) => `<section class="slv s-block-wide">
      <div class="slv-head">${T.logo(26, 29)}<h1 class="slv-title">Today</h1><span class="slv-time">${T.fmt(0)}</span></div>
      <div class="slv-body">${lines.filter(Boolean).map(l => `<p class="slv-line">${l}</p>`).join('')}</div>${starts(st)}</section>`;

  // The heading is the tab switcher (Sales: "the page title is the tab switcher").
  const switcher = (tabs, on, find) => `<div class="s-camp-list-head"><h2 class="b-switch">${tabs.map(([k, l, n]) =>
      `<button class="b-switch-btn${k === on ? ' is-on' : ''}" type="button" data-go='${JSON.stringify({ on: k })}'${k === on ? ' aria-current="page"' : ''}>${e(l)}${n != null ? `<span class="b-switch-n">${n}</span>` : ''}</button>`).join('')}<span class="b-switch-bar"></span></h2>
      ${find ? `<label class="b-find">${T.ic('web', 13)}<input type="search" placeholder="${e(find)}" data-find aria-label="${e(find)}"></label>` : ''}</div>`;

  const cuts = (list, on, apart) => `<div class="b-cuts b-cuts-row">${list.map(([k, l, n]) =>
      `<button class="filter-chip${k === on ? ' active' : ''}" type="button" data-q="${k}">${e(l)}<span class="b-cut-n">${n}</span></button>`).join('')}${apart || ''}</div>`;

  const pager = (total, page, noun) => {
    const pages = Math.max(1, Math.ceil(total / PAGE)), from = total ? page * PAGE + 1 : 0, to = Math.min(total, (page + 1) * PAGE);
    const left = total - to;
    return `<div class="b-pager"><span class="b-vfoot">${from}–${to} of ${T.plural(total, noun)} · page ${page + 1} of ${pages}</span><span class="b-pager-go">
      ${page > 0 ? `<button class="s-inline-btn" type="button" data-page="${page - 1}">Previous 15</button>` : ''}
      ${left > 0 ? `<button class="s-inline-btn" type="button" data-page="${page + 1}">Next ${Math.min(PAGE, left)}</button>` : ''}</span></div>`;
  };
  const paged = (list, render, noun) => {
    const page = Math.max(0, Number(T.url().p) || 0);
    return `<div class="b-grid">${list.slice(page * PAGE, (page + 1) * PAGE).map((x, i) => `<div class="b-slot" style="--i:${i}">${render(x, i)}</div>`).join('') ||
      `<p class="s-block-say">Nothing here.</p>`}</div>${list.length ? pager(list.length, page, noun) : ''}`;
  };
  const block = (title, say, body, cls = '') => `<section class="s-block s-block-wide ${cls}"><div class="s-camp-list-head"><h2 class="s-block-h">${title}</h2>${say ? `<span class="s-block-say">${say}</span>` : ''}</div>${body}</section>`;
  T.block = block;
  const aimySay = html => `<div class="b-aimy">${T.logo(13, 14)}<span class="b-aimy-say">${html}</span></div>`;
  const lead = (mark, n, say, deck, acts) => `<section class="s-insight is-lead s-block-wide">
      <div class="s-lead-mark">${T.logo(14, 14)}<span class="work-state ws-detected">${e(mark)}</span></div>
      <div class="s-lead-line"><span class="s-lead-n">${n}</span><span class="s-lead-say">${say}</span></div>
      ${deck ? `<p class="s-lead-deck">${deck}</p>` : ''}${acts ? `<div class="s-lead-acts">${acts}</div>` : ''}</section>`;
  const btn = (label, data, cls = 's-insight-lnk') => `<button class="${cls}" type="button"${T.attr(data)}>${label}</button>`;
  const dl = rows => `<dl class="b-about-dl">${rows.map(([k, v]) => `<div class="b-about-row"><dt>${e(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  T.dl = dl;
  const story = steps => `<ol class="b-story-line">${steps.map(s => `<li class="b-story-step${s.now ? ' is-now' : ''}"><span class="b-story-dot tone-${s.tone || 'neutral'}"></span><span class="b-story-k">${e(s.k)}</span><span class="b-story-t">${s.t}</span></li>`).join('')}</ol>`;

  // ---------- the candidate card ----------
  function why(a) {
    const c = T.cand(a.cand), r = T.req(a.req), w = T.waitOn(a);
    if (a.exit && a.toldDay == null) return `Owed an answer by <b>${T.fmt(Math.max(a.exitDay + T.TELL_WITHIN, a.exitDay))}</b>. ${e(a.decline ? T.REASONS[a.decline.why] : a.exitNote || '')}.`;
    if (a.exit) return `${e(T.EXITS[a.exit])} ${T.fmt(a.exitDay)}.`;
    if (w === 'approval') return `Found on ${e(c.webSrc)}. A prospect: nothing is sent until you approve.`;
    if (w === 'interviewer') { const iv = Object.values(D().interviews).find(i => i.app === a.id && i.kind === a.stage); return `${e(T.person(iv.who))} owes the debrief from <b>${T.rel(iv.day)}</b>.`; }
    if (w === 'booked') { const iv = Object.values(D().interviews).find(i => i.app === a.id && i.kind === a.stage); return `${e(T.STAGES[iv.kind].label)} <b>${T.wday(iv.day)} ${iv.time}</b> with ${e(T.person(iv.who))}.`; }
    if (a.stage === 'sent' && a.sendout) return `With ${e(T.acc(r.acc).name)} since ${T.fmt(a.sendout.sent)}; ${a.sendout.opened != null ? 'opened <b>' + T.rel(a.sendout.opened) + '</b>' : '<b>not opened yet</b>'}.`;
    if (w === 'approvers') return `The offer waits for ${e(T.person('rania'))} and ${e(T.person('hesham'))}.`;
    if (w === 'candidate') return `Waiting on ${e(T.first(c.name))} since <b>${T.fmt(a.since)}</b>.`;
    const unk = T.evidence(a).filter(x => x.v === 'unknown' && x.c.must).map(x => x.c.text.toLowerCase());
    return (T.overdue(a) ? `Waited <b>${T.age(a.since)}</b> at ${e(T.STAGES[a.stage].label)}, usually ${T.STAGES[a.stage].exp}.` : `At ${e(T.STAGES[a.stage].label)} since <b>${T.rel(a.since)}</b>.`) +
      (unk.length ? ` The CV is silent on ${e(unk[0])}.` : '');
  }
  T.why = why;
  // The one obvious press on a card.
  T.primary = a => {
    const w = T.waitOn(a);
    if (a.exit && a.toldDay == null) return ['Tell them', { tell: a.id }];
    if (w === 'approval') return ['Approve first contact', { contact: a.id }];
    if (w !== 'me') return ['Open', { con: a.id }];
    if (a.stage === 'phone') return ['Call', { call: a.id }];
    if (a.stage === 'tech') return ['Send the profile', { con: a.id, write: 1 }];
    if (a.stage === 'offer') return ['Send the offer', { offersend: a.id }];
    return [T.STAGES[a.stage].go, { advance: a.id }];
  };
  T.card = (a, opts = {}) => {
    const c = T.cand(a.cand), r = T.req(a.req), acc = T.acc(r.acc);
    const label = a.exit ? (a.toldDay == null ? 'Not told yet' : T.EXITS[a.exit]) : a.prospect && !a.contacted ? 'Prospect' : T.STAGES[a.stage].label;
    const [pl, pd] = opts.client ? (a.sendout && a.sendout.decided == null ? ['Open the profile', { con: a.id }] : ['Open', { con: a.id }]) : T.primary(a);
    return `<article class="type-card s-card b-qcard" data-open="${a.id}">
      <div class="tc-head">${T.tag(label, a.exit && a.toldDay == null ? 'warn' : T.stageTone(a) === 'info' ? 'info' : T.stageTone(a))}${T.fact('req', e(r.title))}</div>
      <div class="b-qcard-top"><button class="tc-title s-card-title" type="button" data-con="${a.id}">${e(c.name)}</button></div>
      <p class="tc-summary b-qcard-role">${e(c.headline)}</p>
      <p class="b-qcard-where">${opts.client ? '' : T.fact('acc', e(acc.name))}${T.fact('pin', e(c.city))}</p>
      ${aimySay(opts.client ? clientWhy(a) : why(a))}
      <div class="tc-gov b-qcard-foot"><span class="b-qcard-num b-fact">${T.ic('ev')}<span>${e(T.evCount(a).met + ' of ' + T.evCount(a).of + ' met')}</span></span>${btn(e(pl), pd, 's-insight-lnk primary')}</div></article>`;
  };
  function clientWhy(a) {
    const s = a.sendout;
    if (s.decided == null) return `Sent ${T.fmt(s.sent)}. ${e(T.evCount(a).text)}.`;
    return s.result === 'pass' ? `You passed ${T.fmt(s.decided)}: ${e(T.REASONS[a.decline.why].toLowerCase())}.` : `You chose to meet them ${T.fmt(s.decided)}.`;
  }

  // ---------- the recruiter: Omar ----------
  const mine = () => Object.values(D().apps).filter(a => T.req(a.req).owner === 'omar');
  const RCUTS = {
    all: a => T.active(a),
    me: a => T.waitOn(a) === 'me',
    client: a => T.active(a) && ['client'].includes(T.waitOn(a)),
    others: a => T.active(a) && ['interviewer', 'candidate', 'approvers', 'booked'].includes(T.waitOn(a)),
    prospects: a => T.waitOn(a) === 'approval',
    untold: a => a.exit && a.toldDay == null,
  };
  const order = list => list.slice().sort((x, y) => (T.waitOn(x) === 'me' ? 0 : 1) - (T.waitOn(y) === 'me' ? 0 : 1) || x.since - y.since);

  P.omar = (u) => {
    const apps = mine();
    const meList = order(apps.filter(RCUTS.me));
    const untold = apps.filter(RCUTS.untold).sort((a, b) => a.exitDay - b.exitDay);
    const sent = apps.filter(a => a.stage === 'sent' && T.active(a));
    const owed = Object.values(D().interviews).filter(i => i.day < 0 && !i.debrief && T.req(T.app(i.app).req).owner === 'omar');
    const phone = meList.find(a => a.stage === 'phone');
    const tabs = [['', 'Candidates', apps.filter(RCUTS.all).length], ['iv', 'Interviews', Object.values(D().interviews).filter(i => T.req(T.app(i.app).req).owner === 'omar').length], ['reqs', 'Requisitions', T.mineReqs().length], ['lists', 'Shortlists', D().lists.length]];
    let top = '';
    if (!u.on) top = todayBlock([
      `${slvN(T.plural(meList.length, 'decision'), { q: 'me' })} ${meList.length === 1 ? 'waits' : 'wait'} on you; the oldest, ${e(meList[0] ? T.cand(meList[0].cand).name : '')}, has waited ${meList[0] ? T.age(meList[0].since) : ''}.`,
      `${slvN(T.plural(sent.length, 'profile'), { q: 'client' })} ${sent.length === 1 ? 'is' : 'are'} with the client${sent[0] && sent[0].sendout.opened != null ? `; ${e(T.cand(sent[0].cand).name)}'s was opened ${T.rel(sent[0].sendout.opened)}` : ''}.`,
      untold.length ? `${slvN(T.plural(untold.length, 'person', 'people'), { q: 'untold' })} ${untold.length === 1 ? 'is' : 'are'} owed an answer, the oldest due ${T.fmt(untold[0].exitDay + T.TELL_WITHIN)}.` : '',
    ], [
      { label: 'Screen the next one', n: apps.filter(a => a.stage === 'phone' && T.waitOn(a) === 'me').length, why: phone ? `${T.cand(phone.cand).name} is top of the queue` : 'nobody waits for a call', data: phone ? { call: phone.id } : { q: 'me' } },
      { label: 'Tell the people who are waiting', n: untold.length, why: `everyone hears within ${T.TELL_WITHIN} days`, data: { q: 'untold' } },
      { label: 'Say what happened', n: owed.length, why: owed[0] ? `${T.person(owed[0].who)} owes ${T.first(T.cand(T.app(owed[0].app).cand).name)}'s debrief` : 'log a call or an interview in a sentence', data: { say: 'Called Hana, she passed the call' } },
      { label: 'Find people', why: 'describe who to look for; what comes back is a shortlist', data: { findchat: 1 } },
    ]);
    return `<div class="s-home">${top}<section class="s-block s-block-wide">${switcher(tabs, u.on, u.on ? '' : 'Find a name or a requisition')}${recruiterTab(u, apps)}</section></div>`;
  };
  T.mineReqs = () => Object.values(D().reqs).filter(r => r.owner === 'omar' && r.state !== 'filled');

  function recruiterTab(u, apps) {
    if (u.on === 'iv') return interviewsTab(Object.values(D().interviews).filter(i => T.req(T.app(i.app).req).owner === 'omar'));
    if (u.on === 'reqs') return reqsTab(T.mineReqs());
    if (u.on === 'lists') return listsTab();
    const q = RCUTS[u.q] ? u.q : 'all';
    const f = T.UI.find ? T.UI.find.toLowerCase() : '';
    let list = order(apps.filter(RCUTS[q]));
    if (f) list = list.filter(a => (T.cand(a.cand).name + ' ' + T.req(a.req).title).toLowerCase().includes(f));
    const n = k => apps.filter(RCUTS[k]).length;
    return cuts([['all', 'All', n('all')], ['me', 'Waiting on you', n('me')], ['client', 'With the client', n('client')], ['others', 'Waiting on others', n('others')], ['prospects', 'Prospects', n('prospects')]], q,
        `<button class="filter-chip${q === 'untold' ? ' active' : ''}" type="button" data-q="untold" style="margin-inline-start:auto">Not told yet<span class="b-cut-n">${n('untold')}</span></button>`) +
      (q === 'untold' && list.length ? `<div class="b-cuts b-cuts-row">${btn('Tell all ' + list.length + ' under the HR template', { tellall: 1 }, 'b-ghost b-cuts-go')}</div>` : '') +
      (q === 'prospects' && list.length ? `<div class="b-cuts b-cuts-row">${btn('Approve first contact for all ' + list.length, { contactall: 1 }, 'b-ghost b-cuts-go')}</div>` : '') +
      paged(list, a => T.card(a), 'candidate');
  }

  function interviewsTab(ivs) {
    const ahead = ivs.filter(i => i.day >= 0).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
    const owed = ivs.filter(i => i.day < 0 && !i.debrief);
    const card = i => { const a = T.app(i.app), c = T.cand(a.cand); return `<article class="type-card s-card b-qcard">
        <div class="tc-head">${T.tag(i.day < 0 ? 'Debrief owed' : T.wday(i.day), i.day < 0 ? 'warn' : 'info')}${T.fact('clock', i.time + ' · ' + e(i.mode))}</div>
        <div class="b-qcard-top"><button class="tc-title s-card-title" type="button" data-con="${a.id}">${e(c.name)}</button></div>
        <p class="tc-summary b-qcard-role">${e(T.STAGES[i.kind].label)} · ${e(T.req(a.req).title)}</p>
        ${aimySay(i.day < 0 ? `${e(T.person(i.who))} has not written it up. AiMY sent a reminder at 9:00.` : `${e(T.person(i.who))} gets the kit: the template's agenda and what the CV is silent on.`)}
        <div class="tc-gov b-qcard-foot"><span class="b-qcard-num b-fact">${T.ic('clock')}<span>${T.rel(i.day)}</span></span>${i.day < 0 ? btn('Open the debrief link', { debrief: i.id }, 's-insight-lnk primary') : btn('Prepare me', { prep: i.id }, 's-insight-lnk primary')}</div></article>`; };
    return (owed.length ? `<p class="b-tocall"><b>${owed.length}</b> ${owed.length === 1 ? 'interview has' : 'interviews have'} been and gone with nothing written</p>` : '') +
      `<div class="b-grid">${owed.concat(ahead).map((i, k) => `<div class="b-slot" style="--i:${k}">${card(i)}</div>`).join('') || '<p class="s-block-say">No interviews.</p>'}</div>`;
  }

  function reqsTab(reqs) {
    return paged(reqs, r => {
      const ap = T.appsOf(r.id).filter(T.active), acc = T.acc(r.acc);
      const tone = r.state === 'onhold' ? 'warn' : r.state === 'draft' ? 'neutral' : T.atRisk(r) ? 'err' : 'ok';
      const st = r.state === 'onhold' ? 'On hold' : r.state === 'draft' ? 'Draft' : T.atRisk(r) ? 'At risk' : 'Open';
      return `<article class="type-card s-card b-qcard">
        <div class="tc-head">${T.tag(st, tone)}${T.fact('acc', e(acc.name))}</div>
        <div class="b-qcard-top"><button class="tc-title s-card-title" type="button" data-req="${r.id}">${e(r.title)}</button></div>
        <p class="tc-summary b-qcard-role">${T.plural(r.seats, 'seat')} by ${T.fmt(r.target)} · ${e(T.person(r.owner))}</p>
        ${aimySay(r.firstSent != null ? `The first profile went <b>${r.firstSent - r.opened} days</b> after it opened (target 7).` : `No profile sent yet, <b>${-r.opened} days</b> after it opened.`)}
        <div class="tc-gov b-qcard-foot"><span class="b-qcard-num b-fact">${T.ic('ev')}<span>${ap.length} in process</span></span>${btn('Open', { req: r.id }, 's-insight-lnk primary')}</div></article>`;
    }, 'requisition');
  }

  function listsTab() {
    return paged(D().lists, l => `<article class="type-card s-card b-qcard">
        <div class="tc-head">${T.tag(l.req ? 'On a requisition' : 'Not on one', l.req ? 'ok' : 'neutral')}${T.fact('src', T.plural(l.people.length, 'person', 'people'))}</div>
        <div class="b-qcard-top"><button class="tc-title s-card-title" type="button" data-list="${l.id}">${e(l.name)}</button></div>
        <p class="tc-summary b-qcard-role">${l.req ? e(T.req(l.req).title) : 'Saved by ' + e(T.person(l.by))}</p>
        ${aimySay(`Saved ${T.fmt(l.day)}. Pool people first, web people as prospects.`)}
        <div class="tc-gov b-qcard-foot"><span class="b-qcard-num b-fact">${T.ic('clock')}<span>${T.rel(l.day)}</span></span>${btn('Open', { list: l.id }, 's-insight-lnk primary')}</div></article>`, 'shortlist');
  }

  // ---------- the hiring manager: Rania (Sales manager) ----------
  function asks() {
    const items = [];
    for (const o of Object.values(D().offers)) { const a = T.app(o.app); if (!o.approvals.hm && o.sent == null) items.push({ acc: T.req(a.req).acc, day: a.since, kind: 'Offer to approve', title: T.cand(a.cand).name, sub: T.req(a.req).title, say: `${e(o.salary)} against a band of ${e(o.band)}. Fit and salary are your question.`, act: ['Review the offer', { approve: o.id, by: 'hm' }] }); }
    for (const k of D().asks.filter(k => k.status === 'open')) items.push({ acc: k.acc, day: k.day, kind: 'Client ask', title: T.person(k.from), sub: T.acc(k.acc).name, say: `“${e(k.text)}” Talk it through before anything opens.`, act: ['Open it as a draft', { askdraft: k.id }] });
    for (const a of Object.values(D().apps)) if (a.stage === 'sent' && T.active(a) && a.sendout && a.sendout.decided == null && T.req(a.req).hm === 'rania') {
      const acc = T.acc(T.req(a.req).acc);
      items.push({ acc: acc.id, day: a.sendout.opened ?? a.sendout.sent, kind: 'A client owes an answer', title: T.cand(a.cand).name, sub: T.req(a.req).title, say: `${a.sendout.opened != null ? 'Opened ' + T.rel(a.sendout.opened) : 'Not opened; sent ' + T.rel(a.sendout.sent)}. ${a.nudged != null ? 'Nudged ' + T.rel(a.nudged) + '.' : ''}`, act: a.nudged != null ? ['Open', { con: a.id }] : ['Nudge ' + acc.name.split(' ')[0], { nudge: a.id }] });
    }
    // Grouped by account, oldest first (M11).
    const by = {}; for (const i of items) (by[i.acc] = by[i.acc] || []).push(i);
    return Object.values(by).map(l => l.sort((a, b) => a.day - b.day)).sort((a, b) => a[0].day - b[0].day).flat();
  }
  T.asks = asks;
  const askCard = i => `<article class="type-card s-card b-qcard">
      <div class="tc-head">${T.tag(i.kind, i.kind.startsWith('Offer') ? 'warn' : 'info')}${T.fact('acc', e(T.acc(i.acc).name))}</div>
      <div class="b-qcard-top"><span class="tc-title s-card-title">${e(i.title)}</span></div>
      <p class="tc-summary b-qcard-role">${e(i.sub)}</p>${aimySay(i.say)}
      <div class="tc-gov b-qcard-foot"><span class="b-qcard-num b-fact">${T.ic('clock')}<span>${T.age(i.day)}</span></span>${btn(e(i.act[0]), i.act[1], 's-insight-lnk primary')}</div></article>`;

  P.rania = (u) => {
    const list = asks();
    const adv = Object.values(D().apps).filter(a => T.req(a.req).hm === 'rania' && T.active(a) && ['sent', 'client', 'ctech', 'offer', 'accepted'].includes(a.stage));
    const reqs = Object.values(D().reqs).filter(r => r.hm === 'rania' && r.state !== 'filled');
    const tabs = [['', 'Asks', list.length], ['cands', 'Candidates', adv.length], ['reqs', 'Requisitions', reqs.length]];
    const top = u.on ? '' : todayBlock([
      `${slvN(T.plural(list.length, 'ask'), {})} ${list.length === 1 ? 'waits' : 'wait'} on you, grouped by client, the oldest ${list[0] ? T.age(list[0].day) : ''}.`,
      `${slvN(T.plural(adv.length, 'candidate'), { on: 'cands' })} ${adv.length === 1 ? 'has' : 'have'} been advanced to you. You see only who the recruiter advanced.`,
    ], [
      { label: 'Review the offer', n: list.filter(i => i.kind.startsWith('Offer')).length, why: 'fit and salary, on the same packet as the BU Director', data: { approve: 'o1', by: 'hm' } },
      { label: 'Talk the client ask through', n: list.filter(i => i.kind === 'Client ask').length, why: 'a client request is talked through before it opens', data: { q: '' } },
      { label: 'Read the reports', why: 'where people are lost, one definition per number', data: { go: JSON.stringify({ on: 'reports' }) } },
    ]);
    let body;
    if (u.on === 'cands') body = paged(adv, a => T.card(a), 'candidate');
    else if (u.on === 'reqs') body = reqsTab(reqs);
    else body = `<div class="b-grid">${list.map((i, k) => `<div class="b-slot" style="--i:${k}">${askCard(i)}</div>`).join('') || '<p class="s-block-say">Nothing waits on you.</p>'}</div>`;
    return `<div class="s-home">${top}<section class="s-block s-block-wide">${switcher(tabs, u.on)}${body}</section></div>`;
  };

  // ---------- the BU Director: Hesham (Stakeholder) ----------
  P.hesham = (u) => {
    const reqs = Object.values(D().reqs).filter(r => r.state !== 'filled' && r.acc !== 'ft');
    const offers = Object.values(D().offers);
    const waiting = offers.filter(o => !o.approvals.bu && o.sent == null);
    const decl = T.declinesFor(null), top = T.reasonCounts(decl);
    const tabs = [['', 'Requisitions', reqs.length], ['offers', 'Offers', offers.length]];
    const head = u.on ? '' : todayBlock([
      waiting.length ? `${slvN(T.plural(waiting.length, 'offer'), { on: 'offers' })} ${waiting.length === 1 ? 'waits' : 'wait'} for your budget and headcount answer.` : 'No offer waits for you.',
      `Clients gave ${slvN(T.plural(decl.length, 'reason'), { on: 'reports' })} for passing in 90 days; the most common is ${e(T.REASONS[top[0][0]].toLowerCase())}.`,
    ], [
      { label: 'Answer the budget question', n: waiting.length, why: waiting[0] ? `${T.cand(T.app(waiting[0].app).cand).name}, ${T.req(T.app(waiting[0].app).req).title}` : 'nothing waits', data: waiting[0] ? { approve: waiting[0].id, by: 'bu' } : { on: 'offers' } },
      { label: 'Request a hire', why: 'it goes to a hiring manager, to talk through first', data: { say: 'Request a hire: ' } },
      { label: 'Ask why clients pass', why: 'one reason per decision, across every client', data: { say: 'Why do clients pass?' } },
    ]);
    const why = block('What clients say when they pass', `${decl.length} declines, last 90 days`, dl(top.map(([k, n]) => [T.REASONS[k], `<b>${n}</b> of ${decl.length}`])), 'b-about');
    const offerCard = o => { const a = T.app(o.app); return `<article class="type-card s-card b-qcard"><div class="tc-head">${T.tag(o.approvals.bu ? (o.approvals.bu.ok ? 'You approved' : 'You said not yet') : 'Waiting for you', o.approvals.bu ? 'ok' : 'warn')}${T.fact('req', e(T.req(a.req).title))}</div>
      <div class="b-qcard-top"><span class="tc-title s-card-title">${e(T.cand(a.cand).name)}</span></div><p class="tc-summary b-qcard-role">${e(o.salary)} · band ${e(o.band)}</p>
      ${aimySay(`Budget and headcount are your question; fit is ${e(T.person('rania'))}'s.`)}
      <div class="tc-gov b-qcard-foot"><span class="b-qcard-num b-fact">${T.ic('acc')}<span>${T.req(a.req).seats} seats</span></span>${btn(o.approvals.bu ? 'Open' : 'Answer it', { approve: o.id, by: 'bu' }, 's-insight-lnk primary')}</div></article>`; };
    return `<div class="s-home">${head}<section class="s-block s-block-wide">${switcher(tabs, u.on)}${u.on === 'offers' ? `<div class="b-grid">${offers.map((o, i) => `<div class="b-slot" style="--i:${i}">${offerCard(o)}</div>`).join('')}</div>` : reqsTab(reqs)}</section>${u.on ? '' : why}</div>`;
  };

  // ---------- the client: Jana ----------
  P.jana = (u) => {
    const apps = Object.values(D().apps).filter(a => T.req(a.req).acc === 'nw' && a.sendout);
    const waiting = apps.filter(a => a.sendout.decided == null && !a.exit).sort((a, b) => a.sendout.sent - b.sendout.sent);
    const ivs = Object.values(D().interviews).filter(i => i.who === 'jana' && i.day >= 0);
    const reqs = Object.values(D().reqs).filter(r => r.acc === 'nw' && T.isOpen(r));
    const tabs = [['', 'Profiles', apps.length], ['iv', 'Interviews', ivs.length], ['reqs', 'Requisitions', reqs.length]];
    const top = u.on ? '' : todayBlock([
      `${slvN(T.plural(waiting.length, 'profile'), {})} ${waiting.length === 1 ? 'waits' : 'wait'} for your decision${waiting[0] ? `; ${e(T.cand(waiting[0].cand).name)}'s since ${T.fmt(waiting[0].sendout.sent)}` : ''}.`,
      ivs[0] ? `${e(T.cand(T.app(ivs[0].app).cand).name)}'s interview is ${slvN(T.wday(ivs[0].day) + ' at ' + ivs[0].time, { on: 'iv' })}.` : '',
    ], [
      { label: 'Decide on the next profile', n: waiting.length, why: 'meet them, or pass with one reason', data: waiting[0] ? { con: waiting[0].id } : { q: '' } },
      { label: 'Ask for a hire', why: 'it goes to Rania Samir, who talks it through with you', data: { say: 'Ask for a hire: ' } },
      { label: 'Read your hiring with us', why: 'hires beside acceptance and day-90 retention', data: { go: JSON.stringify({ on: 'hiring' }) } },
    ]);
    let body;
    if (u.on === 'iv') body = `<div class="b-grid">${ivs.map((i, k) => { const a = T.app(i.app); return `<div class="b-slot" style="--i:${k}"><article class="type-card s-card b-qcard"><div class="tc-head">${T.tag(T.wday(i.day), 'info')}${T.fact('clock', i.time + ' · ' + e(i.mode))}</div><div class="b-qcard-top"><button class="tc-title s-card-title" type="button" data-con="${a.id}">${e(T.cand(a.cand).name)}</button></div><p class="tc-summary b-qcard-role">${e(T.STAGES[i.kind].label)} · ${e(T.req(a.req).title)}</p>${aimySay('FlairsTech sent the invite. Your feedback after it is one press and a reason.')}</article></div>`; }).join('') || '<p class="s-block-say">No interviews booked.</p>'}</div>`;
    else if (u.on === 'reqs') body = paged(reqs, r => { const ap = T.appsOf(r.id).filter(T.active); const n = ks => ap.filter(a => ks.includes(a.stage)).length; return `<article class="type-card s-card b-qcard"><div class="tc-head">${T.tag('Open', 'ok')}${T.fact('clock', 'by ' + T.fmt(r.target))}</div><div class="b-qcard-top"><span class="tc-title s-card-title">${e(r.title)}</span></div><p class="tc-summary b-qcard-role">${T.plural(r.seats, 'seat')}</p>${aimySay(`${n(['applied', 'assess', 'phone', 'hr', 'tech'])} in screening with us, <b>${n(['sent'])}</b> with you, ${n(['client', 'ctech'])} interviewing.`)}</article>`; }, 'requisition');
    else body = paged(waiting.concat(apps.filter(a => !waiting.includes(a)).sort((a, b) => (b.sendout.decided ?? 0) - (a.sendout.decided ?? 0))), a => T.card(a, { client: true }), 'profile');
    return `<div class="s-home">${top}<section class="s-block s-block-wide">${switcher(tabs, u.on)}${body}</section></div>`;
  };

  // ---------- the HR Manager: Dina (CEO) ----------
  P.dina = (u) => {
    const reqs = Object.values(D().reqs).filter(r => r.state !== 'filled');
    const risk = reqs.filter(T.atRisk);
    const props = D().props.filter(p => p.status === 'open');
    const tabs = [['', 'Requisitions', reqs.length], ['cands', 'Candidates', Object.values(D().apps).filter(T.active).length], ['learning', 'Learning', props.length], ['autonomy', 'What AiMY may do', D().autonomy.length]];
    const top = u.on ? '' : todayBlock([
      `${slvN(T.plural(risk.length, 'requisition'), { q: 'risk' })} ${risk.length === 1 ? 'is' : 'are'} at risk; 2 target dates moved this month.`,
      props.length ? `${slvN(T.plural(props.length, 'learning proposal'), { on: 'learning' })} ${props.length === 1 ? 'waits' : 'wait'} for you; the Northwind one comes from 18 client declines.` : '',
      `${T.plural(T.untold().length, 'person is', 'people are')} owed an answer across the team.`,
    ], [
      { label: 'Approve what AiMY learned', n: props.length, why: 'changes to its own rules, from outcomes', data: { go: JSON.stringify({ on: 'learning' }) } },
      { label: 'Read the reports', why: 'where people are lost, and one action', data: { go: JSON.stringify({ on: 'reports' }) } },
      { label: 'Set what AiMY may do', why: 'only a person moves an action up', data: { go: JSON.stringify({ on: 'autonomy' }) } },
    ]);
    let body;
    if (u.on === 'cands') body = paged(order(Object.values(D().apps).filter(T.active)), a => T.card(a), 'candidate');
    else if (u.on === 'learning') body = learning();
    else if (u.on === 'autonomy') body = autonomy();
    else {
      const list = u.q === 'risk' ? risk : reqs;
      body = cuts([['', 'All', reqs.length], ['risk', 'At risk', risk.length]], u.q || '') + paged(list, r => {
        const sugg = ['karim', 'lina', 'omar'].filter(k => k !== r.owner).sort((a, b) => T.load(a) - T.load(b))[0];
        return `<article class="type-card s-card b-qcard"><div class="tc-head">${T.tag(T.atRisk(r) ? 'At risk' : r.state === 'onhold' ? 'On hold' : 'Open', T.atRisk(r) ? 'err' : r.state === 'onhold' ? 'warn' : 'ok')}${T.fact('acc', e(T.acc(r.acc).name))}</div>
          <div class="b-qcard-top"><button class="tc-title s-card-title" type="button" data-req="${r.id}">${e(r.title)}</button></div>
          <p class="tc-summary b-qcard-role">${e(T.person(r.owner))} has it · target ${T.fmt(r.target)}</p>
          ${aimySay(T.atRisk(r) ? `${r.target < 0 ? 'Past its target.' : 'Fewer people with the client than seats.'} ${e(T.first(T.person(sugg)))} carries the least: ${T.load(sugg)} open requisitions.` : `${T.appsOf(r.id).filter(T.active).length} in process.`)}
          <div class="tc-gov b-qcard-foot"><span class="b-qcard-num b-fact">${T.ic('clock')}<span>${T.rel(r.target)}</span></span>${T.atRisk(r) ? btn('Reassign to ' + e(T.first(T.person(sugg))), { reassign: r.id, to: sugg }, 's-insight-lnk primary') : btn('Open', { req: r.id }, 's-insight-lnk primary')}</div></article>`;
      }, 'requisition');
    }
    const teams = block('Teams', 'Alphabetical. Counts, not a ranking (D5)', dl(['karim', 'lina', 'omar'].map(k => [T.person(k), `${T.load(k)} open requisitions · ${Object.values(D().apps).filter(a => T.req(a.req).owner === k && T.active(a)).length} people in process · ${T.untold().filter(a => T.req(a.req).owner === k).length} not told yet`])), 'b-about');
    return `<div class="s-home">${top}<section class="s-block s-block-wide">${switcher(tabs, u.on)}${body}</section>${u.on ? '' : teams}</div>`;
  };
  T.load = k => Object.values(D().reqs).filter(r => r.owner === k && T.isOpen(r)).length;

  function learning() {
    const card = p => `<article class="type-card s-card b-qcard"><div class="tc-head">${T.tag(p.status === 'open' ? (p.kind === 'decline' ? 'From client declines' : 'From assessment results') : p.status === 'approved' ? 'Approved ' + T.fmt(p.decided) : 'Not now', p.status === 'open' ? 'accent' : p.status === 'approved' ? 'ok' : 'neutral')}${T.fact('ev', e(p.scope))}</div>
        <div class="b-qcard-top"><span class="tc-title s-card-title">${e(p.title)}</span></div>
        <p class="tc-summary b-qcard-role">${e(p.why)}</p>${aimySay(p.kind === 'question' ? '“' + e(p.change) + '”' : e(p.change))}
        <div class="tc-gov b-qcard-foot"><span class="b-qcard-num b-fact">${T.ic('clock')}<span>${T.rel(p.day)}</span></span>${p.status === 'open' ? btn('Not now', { prop: p.id, to: 'declined' }, 'b-ghost') + btn('Approve', { prop: p.id, to: 'approved' }, 's-insight-lnk primary') : ''}</div></article>`;
    const g = D().checkins90, of = D().CHECKIN_GATE;
    return `<div class="b-grid">${D().props.map((p, i) => `<div class="b-slot" style="--i:${i}">${card(p)}</div>`).join('')}</div>` +
      lead('Waiting for data', `${g} of ${of}`, 'day-90 check-ins so far. AiMY drafts nothing from check-ins until there are 20.', 'At about 21 hires in two months, a pattern needs months of data. Check-ins are separate from probation and never feed one person\'s record.');
  }
  function autonomy() {
    return `<div class="b-grid">${D().autonomy.map((x, i) => `<div class="b-slot" style="--i:${i}"><article class="type-card s-card b-qcard">
      <div class="tc-head">${T.tag(T.RUNGS[x.rung], x.rung === 2 ? 'ok' : x.rung === 1 ? 'info' : 'neutral')}${x.lock ? T.fact('lock', 'A person, each time') : ''}</div>
      <div class="b-qcard-top"><span class="tc-title s-card-title">${e(x.label)}</span></div>
      ${aimySay(x.log.length ? e(x.log[x.log.length - 1].text) : x.lock ? 'Declines and offers are decided by a person every time.' : 'No overrides in 30 days.')}
      <div class="tc-gov b-qcard-foot">${x.lock ? '<span></span>' : `<span class="b-cuts" style="gap:4px">${T.RUNGS.map((l, k) => `<button class="filter-chip${k === x.rung ? ' active' : ''}" type="button" data-rung="${x.k}" data-to="${k}">${l}</button>`).join('')}</span>`}</div></article></div>`).join('')}</div>`;
  }

  // ---------- a candidate on one requisition (Sales: contact page) ----------
  P.con = (u) => {
    const a = T.app(u.con); if (!a) return '<p class="s-block-say">No such record.</p>';
    const c = T.cand(a.cand), r = T.req(a.req), acc = T.acc(r.acc), desk = T.desk();
    const client = desk === 'jana', w = T.waitOn(a), next = T.nextStage(a);
    const recruiter = desk === 'omar' || desk === 'dina';
    const st = a.exit ? T.st(a.toldDay == null ? T.EXITS[a.exit] + ' · not told yet' : T.EXITS[a.exit], a.exit === 'clientno' ? 'err' : 'neutral') : T.st(T.STAGES[a.stage].label, T.stageTone(a));
    let acts = '';
    if (recruiter && T.active(a)) {
      const [pl, pd] = T.primary(a);
      if (pd.con && pd.write) acts += btn('Send the profile', { write: a.id }, 's-insight-lnk primary');
      else if (!pd.con) acts += btn(e(pl === 'Call' ? 'Call ' + T.first(c.name) : pl), pd, 's-insight-lnk primary');
      const qn = order(mine().filter(RCUTS.me)).find(x => x.id !== a.id);
      if (qn) acts += btn(`Next in the queue: ${e(T.cand(qn.cand).name)} →`, { con: qn.id }, 's-inline-btn b-next');
    }
    if (recruiter && a.exit && a.toldDay == null) acts += btn('Tell them', { tell: a.id }, 's-insight-lnk primary');
    // "What happened?" — what a person saw is one press.
    let ask = '';
    if (recruiter && T.active(a) && !a.prospect) {
      const opts = [];
      if (next && !['sent', 'offer', 'tech'].includes(a.stage)) opts.push([T.STAGES[a.stage].go, { advance: a.id }]);
      if (a.stage === 'sent') { opts.push(['Client wants to meet', { meet: a.id }]); opts.push(['Client declined', { passopen: a.id }]); }
      opts.push(['Withdrew', { withdrew: a.id }]);
      ask = `<div class="b-ask"><span class="b-ask-cap">What happened?</span>${opts.map(([l, d]) => btn(e(l), d, 'b-ghost')).join('')}</div>`;
    }
    if (client && a.sendout && a.sendout.decided == null) ask = `<div class="b-ask"><span class="b-ask-cap">Your decision</span>${btn('Meet them', { meet: a.id }, 's-insight-lnk primary')}${btn('Pass', { passopen: a.id }, 'b-ghost')}</div>`;
    // One reason from a fixed list (P1), drawn as Sales's "What happened?" row.
    const passMenu = T.UI.open['pass' + a.id] ? `<div class="b-ask" style="flex-wrap:wrap"><span class="b-ask-cap">Why? Pick one</span>${Object.entries(T.REASONS).filter(([k]) => k !== 'other').map(([k, v]) => `<button class="b-ghost" type="button" data-pass="${a.id}" data-why="${k}">${e(v)}</button>`).join('')}
        <input class="b-draft-in" id="other-${a.id}" placeholder="Other: one line" style="max-width:220px"><button class="b-ghost" type="button" data-pass="${a.id}" data-why="other">Pass</button>
        <button class="s-inline-btn" type="button" data-passcancel="${a.id}">Keep them</button></div>` : '';
    const end = recruiter && T.active(a) && !['offer', 'accepted'].includes(a.stage) ? `<span class="b-menu-wrap b-end"><button class="b-ghost b-end-open" type="button" data-endopen="${a.id}"><span class="b-end-word">Not progressing</span></button>
        <div class="b-menu b-end-pop" ${T.UI.open['end' + a.id] ? '' : 'hidden'}><span class="b-menu-cap">End it here</span><p class="b-end-say">${e(T.first(c.name))} leaves the process and hears from you within ${T.TELL_WITHIN} days, under the HR template.</p>
        <div class="b-end-acts"><button class="b-ghost b-end-go" type="button" data-out="${a.id}">Yes, not progressing</button><button class="s-inline-btn" type="button" data-endopen="${a.id}">Keep them</button></div></div></span>` : '';

    const write = T.UI.open['wu' + a.id] ? block('The write-up for ' + e(acc.name), 'You approve it before it goes. No salary, no internal notes.', `<div class="b-cmeta b-said"><div class="b-cmeta-part"><div class="b-cmeta-say"><textarea class="b-draft-in b-draft-area" id="wu-${a.id}" rows="3">${e(writeup(a))}</textarea></div></div></div>
        <div class="s-rec-actions">${btn('Approve and send', { sendprofile: a.id }, 's-insight-lnk primary')}${btn('Not yet', { writeclose: a.id }, 'b-ghost')}</div>`) : '';

    const evid = block('Against the success profile', e(T.evCount(a).text) + ' · criteria ' + e(r.critVer), dl(T.evidence(a).map(x => {
      const tone = { meets: 'ok', partly: 'warn', not: 'err', unknown: 'neutral' }[x.v];
      const said = (c.cvSays || {})[x.c.id];
      return [x.c.text + (x.c.must ? '' : ' (nice to have)'), `${T.tag(T.VERDICT[x.v].label, tone)} ${x.v === 'unknown' ? 'The CV is silent here.' + (recruiter ? ' ' + (T.UI.asked[a.id + x.c.id] ? '<b>In the next call.</b>' : `<button class="s-inline-btn" type="button" data-askthem="${a.id}" data-c="${x.c.id}">Ask them</button>`) : '') : said ? '“' + e(said) + '”' : ''}`];
    })) + `<p class="s-block-say" style="margin-top:8px">Not known is not Not met. Counts, never a percentage.</p>`, 'b-about');
    const verified = block('What we verified', 'CV says, beside what an interview found', dl(r.criteria.map(cr => {
      const f = (c.found || {})[cr.id], s = f ? f.status : 'unchecked';
      return [cr.text, `CV says “${e((c.cvSays || {})[cr.id] || 'Not stated')}”. ${f ? `Found: ${e(f.text)} ${T.tag(T.CHECK[s].label, s === 'confirmed' ? 'ok' : 'warn')} <span class="s-block-say">${e(f.src)}</span>` : T.tag('Not checked', 'neutral')}`];
    })) + `<p class="s-block-say" style="margin-top:8px">AiMY suggests each finding from the transcript; the interviewer confirms it before it lands. The candidate sees only their own layer: what the CV says.</p>`, 'b-about');
    const sendout = a.sendout ? block('The sendout', `Profile sent to ${e(acc.name)}: a record, not a remark`, story([
      { k: 'Sent ' + T.fmt(a.sendout.sent), t: client ? 'by ' + e(T.person(a.sendout.by)) : `${a.sendout.sent - r.opened} days after it opened (target 7) · write-up approved by ${e(T.person(a.sendout.by))}`, tone: 'ok' },
      { k: a.sendout.opened != null ? 'Opened ' + T.fmt(a.sendout.opened) : 'Not opened yet', t: a.sendout.opened != null ? e(T.person(acc.contact) || 'the client') : '', tone: a.sendout.opened != null ? 'ok' : 'neutral' },
      { k: a.sendout.decided != null ? (a.sendout.result === 'pass' ? 'Declined ' : 'Wants to meet · ') + T.fmt(a.sendout.decided) : 'Decision', t: a.sendout.decided != null ? (a.decline ? e(T.REASONS[a.decline.why]) + (a.decline.note ? ' · “' + e(a.decline.note) + '”' : '') : '') : 'waiting ' + T.age(a.sendout.opened ?? a.sendout.sent), tone: a.sendout.decided != null ? (a.sendout.result === 'pass' ? 'err' : 'ok') : 'neutral', now: a.sendout.decided == null },
    ]) + (a.sendout.writeup ? aimySay('“' + e(a.sendout.writeup) + '”') : ''), 'b-story') : '';
    const offer = T.offerOf(a.id);
    const offerB = offer && !client ? block('Offer', 'One packet, two approvers, two questions. No margin.', dl([
      ['Salary', e(offer.salary) + ' · band ' + e(offer.band)], ['Notice and start', e(offer.notice) + ' · ' + T.fmt(offer.start)],
      [T.person('rania') + ' · fit and salary', offer.approvals.hm ? T.tag(offer.approvals.hm.ok ? 'Approved ' + T.fmt(offer.approvals.hm.day) : 'Not yet', offer.approvals.hm.ok ? 'ok' : 'warn') : `${T.tag('Waiting', 'neutral')} <button class="s-inline-btn" type="button" data-approve="${offer.id}" data-by="hm">Approval link</button>`],
      [T.person('hesham') + ' · budget and headcount', offer.approvals.bu ? T.tag(offer.approvals.bu.ok ? 'Approved ' + T.fmt(offer.approvals.bu.day) : 'Not yet', offer.approvals.bu.ok ? 'ok' : 'warn') : `${T.tag('Waiting', 'neutral')} <button class="s-inline-btn" type="button" data-approve="${offer.id}" data-by="bu">Approval link</button>`],
      ['Sent', offer.sent != null ? 'by a person, ' + T.fmt(offer.sent) : 'not yet'],
    ]), 'b-about') : '';
    const checks = ['accepted', 'joined'].includes(a.stage) ? block(a.stage === 'joined' ? 'Day 1 to day 90' : 'Before day 1', a.stage === 'accepted' ? `Joins ${T.wday(a.joinDay)}. Accepted to joined is its own stage.` : 'Separate from probation', dl((a.checkins || [{ day: 30, due: a.joinDay + 30 }, { day: 90, due: a.joinDay + 90 }]).map(k => ['Day ' + k.day, k.done != null ? `${T.tag(k.outcome, 'ok')} ${T.fmt(k.done)}${k.note ? ' · “' + e(k.note) + '”' : ''}` : 'Due ' + T.fmt(k.due) + ', with the hiring manager and ' + e(T.first(c.name)) + ' separately'])), 'b-about') : '';
    const consent = !client ? block('Consent', c.prospect ? 'A prospect: minimal data until they reply' : 'Dated, from the candidate', dl([
      ['Keep and read the CV', c.consent.cv != null ? T.tag('Yes · ' + T.fmt(c.consent.cv), 'ok') : T.tag('No', 'neutral')],
      ['Updates on WhatsApp', c.consent.wa != null ? T.tag('Yes · ' + T.fmt(c.consent.wa), 'ok') : T.tag('No', 'neutral') + ' Messages go by email.'],
      ['Interviews recorded', c.consent.rec != null ? T.tag('Yes · ' + T.fmt(c.consent.rec), 'ok') : T.tag('No', 'neutral')],
    ]), 'b-about') : '';
    const hist = !client ? block('The story so far', `${e(r.title)} · ${a.hist.length} steps`, story(a.hist.slice().sort((x, y) => x.day - y.day).map((h, i, all) => ({ k: h.text, t: T.fmt(h.day) + ' · ' + e(h.who), now: i === all.length - 1 })))
      , 'b-story') : '';
    return `<div class="s-home">
      <div class="b-topbar s-block-wide">${T.back()}${end}</div>
      <section class="s-rec-head s-block-wide">
        <div class="s-rec-title"><h1 class="s-rec-name">${e(c.name)}</h1>${st}${!client && T.active(a) ? `<span class="b-kind">${T.age(a.since)} in stage</span>` : ''}</div>
        <div class="s-rec-facts"><div>${T.fact('req', e(r.title))}${client ? '' : T.fact('acc', e(acc.name))}${T.fact('pin', e(c.city))}${client ? '' : T.fact(c.prospect ? 'web' : 'src', e(c.source))}</div></div>
        <p class="tc-summary">${e(c.headline)}</p>
        ${acts ? `<div class="s-rec-actions">${acts}${recruiter && a.stage === 'phone' ? `<span class="b-kind">${T.ic('phone', 12)} Calls are a design target</span>` : ''}</div>` : ''}
        ${ask}${passMenu}
      </section>
      ${write}${sendout}${offerB}${checks}${evid}${verified}${consent}${hist}</div>`;
  };
  function writeup(a) {
    const c = T.cand(a.cand), ev = T.evidence(a).filter(x => x.c.must);
    const met = ev.filter(x => x.v === 'meets').map(x => x.c.text.toLowerCase()), rest = ev.filter(x => x.v !== 'meets').map(x => x.c.text.toLowerCase());
    return `${c.name}: ${met.join(', ')}.` + (rest.length ? ` Still to confirm: ${rest.join(', ')}.` : ' Every must-have met in interview.');
  }

  // ---------- a requisition (Sales: campaign page) ----------
  P.req = (u) => {
    const r = T.req(u.req); if (!r) return '<p class="s-block-say">No such requisition.</p>';
    const acc = T.acc(r.acc), tpl = T.tpl(r), all = T.appsOf(r.id), active = all.filter(T.active);
    const desk = T.desk(), internal = desk !== 'jana';
    const st = r.state === 'onhold' ? T.st('On hold', 'warn') : r.state === 'draft' ? T.st('Draft', 'neutral') : T.atRisk(r) ? T.st('At risk', 'err') : T.st('Open', 'ok');
    const decl = T.declinesFor(r.acc), top = T.reasonCounts(decl);
    const reached = k => all.filter(a => tpl.indexOf(a.stage) >= tpl.indexOf(k) && !a.prospect).length;
    const q = ['me', 'client', 'others', 'prospects'].includes(u.q) ? u.q : 'all';
    const list = order(all.filter(RCUTS[q]));
    const n = k => all.filter(RCUTS[k]).length;
    const toScreen = order(active.filter(a => T.waitOn(a) === 'me'));
    return `<div class="s-home">
      <div class="b-topbar s-block-wide">${T.back()}</div>
      <section class="s-rec-head s-block-wide">
        <span class="s-rec-kind b-kinds">${T.fact('req', 'Requisition')}${T.fact('acc', e(acc.name))}</span>
        <div class="s-rec-title"><h1 class="s-rec-name">${e(r.title)}</h1>${st}<span class="b-kind">${r.target >= 0 ? T.plural(r.target, 'day') + ' left' : -r.target + ' days past target'}</span></div>
        <div class="b-cmeta"><div class="b-cmeta-part"><h2 class="b-cmeta-cap">The goal</h2><div class="b-cmeta-say"><p class="b-cmeta-p">${T.plural(r.seats, 'seat')} for ${e(acc.name)} by ${T.fmt(r.target)}. ${e(r.kind)}${internal ? ' · budget ' + e(r.budget) : ''}.</p></div></div></div>
        <div class="b-cmeta b-said"><div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">Success profile</span></div><div class="b-cmeta-say"><p class="b-cmeta-p">${r.criteria.map(c => `${c.must ? '<b>' + e(c.text) + '</b>' : e(c.text) + ' (nice to have)'}`).join(' · ')}</p>
          <p class="b-cmeta-p" style="opacity:.85">Criteria ${e(r.critVer)}. Every score stores this version.${r.extraCheck ? ' ' + e(r.extraCheck) + '.' : ''}</p></div></div></div>
        <div class="b-team"><div class="b-team-head"><span class="b-cmeta-cap b-team-cap">The team</span></div>
          <div class="b-mate">${T.face(T.person(r.owner), 28)}<span class="b-mate-t"><span class="b-mate-name">${e(T.person(r.owner))}</span><span class="b-mate-role">Recruiter</span></span></div>
          <div class="b-mate">${T.face(T.person(r.hm), 28)}<span class="b-mate-t"><span class="b-mate-name">${e(T.person(r.hm))}</span><span class="b-mate-role">Hiring manager</span></span></div></div>
        ${internal ? `<div class="s-rec-actions">${toScreen[0] ? btn('Screen the next one', T.primary(toScreen[0])[1], 's-insight-lnk primary') : ''}${btn('Find more for this requisition', { findchat: r.id }, 'b-ghost')}${btn(r.published ? 'Published · take it down' : 'Not published · publish it', { publish: r.id }, 'b-ghost')}${r.state === 'draft' ? btn('Open it', { reqstate: r.id, to: 'open' }, 'b-ghost') : r.state === 'onhold' ? btn('Resume', { reqstate: r.id, to: 'open' }, 'b-ghost') : btn('Put on hold', { reqstate: r.id, to: 'onhold' }, 'b-ghost')}</div>` : ''}
      </section>
      ${internal ? lead('Read off the record', r.firstSent != null ? r.firstSent - r.opened : -r.opened, r.firstSent != null ? `days from the request to the first profile <span class="s-lead-of">target 7</span>` : 'days open, and no profile has gone yet',
        top[0] ? `${e(T.REASONS[top[0][0]])} is behind <b>${top[0][1]} of ${decl.length}</b> of ${e(acc.name)}'s declines in 90 days.` : '',
        D().props.some(p => p.kind === 'decline' && p.acc === r.acc && p.status === 'open') ? btn('Read the learning proposal', { go: JSON.stringify({ as: 'dina', on: 'learning' }) }) : '') : ''}
      <section class="s-block s-block-wide"><div class="s-camp-list-head"><h2 class="s-block-h">${internal ? 'People on it' : 'Where it stands'}</h2></div>
        ${internal ? `<p class="b-tocall"><b>${n('me')}</b> waiting on you</p>${cuts([['all', 'All', n('all')], ['me', 'Waiting on you', n('me')], ['client', 'With the client', n('client')], ['others', 'Waiting on others', n('others')], ['prospects', 'Prospects', n('prospects')]], q)}${paged(list, a => T.card(a), 'candidate')}` : ''}
      </section>
      ${block('Where people drop', 'People who reached each stage', dl(tpl.filter(k => k !== 'sourced').map(k => [T.STAGES[k].label, '<b>' + reached(k) + '</b>'])), 'b-about')}
      ${internal ? block(`Why ${e(acc.name)} passed`, 'One reason per decline, picked by the client. 90 days.', dl(top.map(([k, c]) => [T.REASONS[k], `<b>${c}</b> of ${decl.length}`])), 'b-about') : ''}
      ${internal ? block('Stages', 'From the ' + e(T.TEMPLATES[acc.template].label) + ' template', `<p class="b-cmeta-p">${tpl.map(k => e(T.STAGES[k].label)).join(' → ')}</p>`) : ''}
    </div>`;
  };

  // ---------- shortlists (Sales: lists, and the draft from the chat) ----------
  P.list = (u) => {
    const draft = u.list === 'draft' ? T.UI.draft : null;
    const l = draft || D().lists.find(x => x.id === u.list);
    if (!l) return '<p class="s-block-say">No such shortlist.</p>';
    const people = draft ? draft.people : l.people.map(id => T.FIND_ALL.find(p => p.id === id) || { id, name: T.cand(id) ? T.cand(id).name : id, head: T.cand(id) ? T.cand(id).headline : '', kind: 'pool', touch: 'In the pool', ev: 'mmmuu' });
    const req = T.req(draft ? draft.req : l.req || 'r1');
    const gate = draft && T.UI.leaving ? `<section class="s-insight is-lead b-lead-slim b-gate s-block-wide" aria-label="Not saved"><div class="s-lead-mark">${T.logo(14, 14)}<span class="work-state ws-staged">Awaiting You</span></div>
      <p class="s-lead-deck">This shortlist is not saved. <b>${T.plural(people.length, 'person', 'people')}</b> came back and nobody is working them.</p>
      <p class="b-gate-note">Leaving throws them away. Save it and it is yours; put it on the requisition and they join your queue.</p>
      <div class="s-lead-acts">${btn('Save', { listsave: 1 }, 's-insight-lnk primary')}${btn('Discard', { listdiscard: 1 })}${btn('Stay', { liststay: 1 }, 's-inline-btn')}</div></section>` : '';
    const card = p => { const keep = draft ? draft.keep[p.id] !== false : true; const ev = (p.ev || '').slice(0, req.criteria.length).padEnd(req.criteria.length, 'u'); const met = req.criteria.filter((c, i) => c.must && ev[i] === 'm').length, of = req.criteria.filter(c => c.must).length;
      return `<article class="type-card s-card b-qcard"><div class="tc-head">${T.tag(p.kind === 'web' ? 'Prospect' : 'Talent pool', p.kind === 'web' ? 'neutral' : 'info')}${T.fact(p.kind === 'web' ? 'web' : 'src', e(p.kind === 'web' ? p.src : 'Pool'))}</div>
        <div class="b-qcard-top"><span class="tc-title s-card-title">${e(p.name)}</span></div><p class="tc-summary b-qcard-role">${e(p.head)}</p>
        ${aimySay(p.kind === 'web' ? 'Public page, named. Apollo can add a work email; no WhatsApp before an opt-in.' : e(p.touch || ''))}
        <div class="tc-gov b-qcard-foot"><span class="b-qcard-num b-fact">${T.ic('ev')}<span>${met} of ${of} met</span></span>${draft ? `<button class="filter-chip${keep ? ' active' : ''}" type="button" data-keep="${p.id}">${keep ? 'Keep ✓' : 'Keep'}</button>` : ''}</div></article>`; };
    return `<div class="s-home">${gate}
      <div class="b-topbar s-block-wide">${T.back()}</div>
      <section class="s-rec-head s-block-wide">
        <span class="s-rec-kind b-kinds">${T.fact('src', 'Shortlist')}${draft ? T.tag('Not saved yet', 'warn') : ''}</span>
        <div class="s-rec-title"><h1 class="s-rec-name">${e(l.name)}</h1></div>
        <div class="b-cmeta"><div class="b-cmeta-part"><h2 class="b-cmeta-cap">Who came back</h2><div class="b-cmeta-say"><p class="b-cmeta-p">${people.filter(p => p.kind !== 'web').length} from the talent pool, ${people.filter(p => p.kind === 'web').length} from public pages, for ${e(req.title)}. SignalHire and LinkedIn Recruiter are parked (D10); nothing was scraped.</p></div></div></div>
        ${draft ? `<div class="s-rec-actions">${btn('Add to ' + e(req.title), { listadd: 1 }, 's-insight-lnk primary')}${btn('Save', { listsave: 1 }, 'b-ghost')}${btn('Discard', { listdiscard: 1 }, 'b-ghost')}</div>` : ''}
      </section>
      <section class="s-block s-block-wide"><div class="s-camp-list-head"><h2 class="s-block-h">Who is on it</h2><span class="s-block-say">${draft ? 'Untick anyone you do not want to keep' : ''}</span></div>${paged(people, card, 'person')}</section></div>`;
  };
  T.FIND_ALL = [
    { id: 'ingy', name: 'Ingy Farouk', head: 'Technical support, German C1', kind: 'pool', touch: 'Reached Technical for Northwind in May; client declined on notice period.', ev: 'mmmmu', wa: true },
    { id: 'mahmoud', name: 'Mahmoud Saad', head: 'Service desk lead, German B2', kind: 'pool', touch: 'Applied for IT Helpdesk in June, then withdrew.', ev: 'pmmuu', wa: false },
    { id: 'rewan', name: 'Rewan Ali', head: 'Customer success, German C1', kind: 'pool', touch: 'Passed a phone screen in April; the role was cancelled by the client.', ev: 'muumm', wa: true },
    { id: 'hegazy', name: 'Omar Hegazy', head: 'Support engineer, speaks German', kind: 'web', src: 'Speaker page, cairotechmeetup.example', ev: 'puuuu' },
    { id: 'nesma', name: 'Nesma Adly', head: 'L2 support, Zendesk certified', kind: 'web', src: 'Personal portfolio site', ev: 'umuuu' },
    { id: 'fouad', name: 'Fouad Kamel', head: 'IT support, German C1', kind: 'web', src: 'Company team page, deltadesk.example', ev: 'muumu' },
  ];

  // ---------- reports (Sales: Financials) ----------
  P.reports = () => {
    const H = T.HISTORY.funnel, decl = T.declinesFor(null);
    return `<div class="s-home"><div class="b-topbar s-block-wide">${T.back()}</div>
      <section class="s-rec-head s-block-wide"><span class="s-rec-kind b-kinds">${T.fact('ev', 'Reports')}</span><div class="s-rec-title"><h1 class="s-rec-name">How hiring is going</h1></div>
        <p class="tc-summary">${e(T.HISTORY.scope)}</p></section>
      ${lead('Read off the record', '268 → 81', 'passed the phone screen, then profiles sent: most people are lost <b>before the client sees them</b>',
        'Sending the first profile took <b>14 days</b> on average. At the client, 3.4 profiles per interview is inside the usual agency range of 3 to 5, and clients hired 21 of the 24 they met. That benchmark is weak (vendor blogs, a 2018 survey).',
        btn('No profile after 10 days', { go: JSON.stringify({ on: 'reqs' }) }, 's-insight-lnk primary'))}
      ${block('The funnel, Aug–Sep', 'Share of the stage before', dl(H.map(([l, n], i) => [l, `<b>${n}</b>${i ? ' · ' + Math.round(n / H[i - 1][1] * 100) + '%' : ''}`])), 'b-about')}
      ${block('Why clients pass', `${decl.length} declines in 90 days, one reason each`, dl(T.reasonCounts(decl).map(([k, n]) => [T.REASONS[k], `<b>${n}</b> of ${decl.length}`])), 'b-about')}
      ${block('What each number means', 'One definition per count', dl(T.METRICS.map(m => [m.k, `<b>${e(m.v)}</b> · ${e(m.unit)} · ${m.start ? e(m.start) + ' → ' : ''}${e(m.stop)}${m.note ? ' · ' + e(m.note) : ''}`])), 'b-about')}
    </div>`;
  };

  // Your hiring with us (Sales: Your journey with AiMY).
  P.hiring = () => {
    const decl = T.declinesFor('nw');
    const added = D().props.find(p => p.id === 'p1' && p.status === 'approved');
    return `<div class="s-home"><div class="b-topbar s-block-wide">${T.back()}</div>
      <section class="s-rec-head s-block-wide"><span class="s-rec-kind b-kinds">${T.fact('acc', 'Northwind Software')}</span><div class="s-rec-title"><h1 class="s-rec-name">Your hiring with us</h1>${T.st('Last 6 months', 'neutral')}</div></section>
      ${lead('How it is going', '4', 'hires billed, beside what happened to them', '18 profiles sent, 5 you interviewed: <b>3.6 profiles per interview</b>. <b>3 of 3</b> hires who reached day 90 are still with you. A profile reached you within 7 days on <b>2 of 3</b> requests.', '')}
      ${block('Why you passed', 'Your own decisions, last 90 days', dl(T.reasonCounts(decl).map(([k, n]) => [T.REASONS[k], `<b>${n}</b> of ${decl.length}`])) + aimySay(`Spoken German is behind ${decl.filter(d => d.why === 'lang').length} of ${decl.length}. ${added ? 'We added a spoken German check before a profile reaches you.' : 'We are reviewing a spoken German check before a profile reaches you.'}`), 'b-about')}
      ${block('What is coming', 'From your news', aimySay(e(T.acc('nw').news) + ' A German-speaking hiring forecast follows from it.'))}</div>`;
  };

  // ---------- outside links: debrief, approval, careers, own profile ----------
  const outside = who => `<div class="b-topbar s-block-wide">${T.back('Back to the desks')}<span class="b-kind">${T.ic('web', 12)} Outside link · seen by ${e(who)}</span></div>`;
  P.debrief = (u) => {
    const iv = D().interviews[u.debrief]; if (!iv) return '<p class="s-block-say">No such interview.</p>';
    const a = T.app(iv.app), c = T.cand(a.cand), r = T.req(a.req);
    const f = T.UI.db && T.UI.db.id === iv.id ? T.UI.db : (T.UI.db = { id: iv.id, v: {}, proceed: null, edits: {} });
    const must = r.criteria.filter(x => x.must);
    const done = iv.debrief;
    const all = must.every(x => f.v[x.id]) && f.proceed != null;
    return `<div class="s-home">${outside(T.person(iv.who))}
      <section class="s-rec-head s-block-wide"><span class="s-rec-kind b-kinds">${T.fact('clock', e(T.STAGES[iv.kind].label) + ' · ' + T.wday(iv.day) + ' ' + iv.time)}</span>
        <div class="s-rec-title"><h1 class="s-rec-name">${e(c.name)}</h1>${done ? T.st('Debrief sent', 'ok') : T.st('Your debrief', 'info')}</div>
        <p class="tc-summary">${e(r.title)} · ${e(T.acc(r.acc).name)}${iv.recording ? ' · recorded with consent, ' + T.fmt(c.consent.rec) : ''}</p></section>
      ${done ? block("Others' feedback, now visible", '', dl(iv.others.map(o => [o.by + ' · ' + o.kind, `${T.tag(o.verdict, 'ok')} “${e(o.note)}”`])) + aimySay(`Your findings now sit in ${e(T.first(c.name))}'s verified record, beside what the CV says.`), 'b-about') : `
      ${aimySay('AiMY quotes the recording. Check each quote; the verdict is yours and starts empty.')}
      ${must.map(cr => { const q = (iv.quotes || {})[cr.id]; return block(e(cr.text), 'CV says “' + e((c.cvSays || {})[cr.id] || 'Not stated') + '”', `
        ${q ? `<div class="b-cmeta b-said"><div class="b-cmeta-part"><div class="b-draft-caprow"><span class="b-cmeta-cap">${T.tag('Check it', 'warn')} ${q.at}</span></div><div class="b-cmeta-say"><textarea class="b-draft-in b-draft-area" rows="2" data-dbedit="${cr.id}">${e(f.edits[cr.id] ?? q.q)}</textarea></div></div></div>` : '<p class="s-block-say">No quote found in the recording.</p>'}
        <div class="b-cuts b-cuts-row">${[['met', 'Met'], ['partly', 'Partly met'], ['not', 'Not shown']].map(([k, l]) => `<button class="filter-chip${f.v[cr.id] === k ? ' active' : ''}" type="button" data-dbv="${cr.id}" data-to="${k}">${l}</button>`).join('')}</div>`); }).join('')}
      ${iv.gap ? lead('Not covered', '1', 'agenda topic did not come up', e(iv.gap), T.UI.gapAsked ? T.tag('Asked by message', 'ok') : btn('Ask by message', { gapask: 1 })) : ''}
      ${block('Should ' + e(T.first(c.name)) + ' go on?', `${T.plural(iv.others.length, 'other interviewer has', 'other interviewers have')} submitted. Theirs shows after yours.`, `<div class="b-cuts b-cuts-row">${[['yes', 'Proceed'], ['no', 'Do not proceed']].map(([k, l]) => `<button class="filter-chip${f.proceed === k ? ' active' : ''}" type="button" data-dbp="${k}">${l}</button>`).join('')}</div>
        <div class="s-rec-actions" style="margin-top:12px"><button class="s-insight-lnk primary" type="button" data-dbsend ${all ? '' : 'disabled'}>Send my debrief</button>${all ? '' : '<span class="s-block-say">Rate each must-have and say proceed or not.</span>'}</div>`)}`}
    </div>`;
  };
  P.approve = (u) => {
    const o = D().offers[u.approve], by = u.by === 'bu' ? 'bu' : 'hm';
    if (!o) return '<p class="s-block-say">No such offer.</p>';
    const a = T.app(o.app), c = T.cand(a.cand), r = T.req(a.req), who = by === 'bu' ? 'hesham' : 'rania';
    const mine = o.approvals[by], other = o.approvals[by === 'bu' ? 'hm' : 'bu'];
    const filled = T.appsOf(r.id).filter(x => ['accepted', 'joined'].includes(x.stage)).length;
    return `<div class="s-home">${outside(T.person(who))}
      <section class="s-rec-head s-block-wide"><span class="s-rec-kind b-kinds">${T.fact('ev', 'Offer approval · ' + e(T.STAFF[who].role))}</span>
        <div class="s-rec-title"><h1 class="s-rec-name">${by === 'bu' ? 'Is there budget and headcount for this hire?' : `Is ${e(c.name)} the right person at this salary?`}</h1></div>
        ${mine ? '' : `<div class="s-rec-actions">${btn('Approve', { approveok: o.id, by }, 's-insight-lnk primary')}<input class="b-draft-in" id="nyet" placeholder="Not yet, because…" style="max-width:260px">${btn('Not yet', { approveno: o.id, by }, 'b-ghost')}</div>`}
        ${mine ? `<p class="tc-summary">${mine.ok ? 'You approved ' + T.fmt(mine.day) : 'You said not yet: ' + e(mine.note)}.</p>` : ''}
      </section>
      ${block(by === 'bu' ? 'The budget' : 'The person and the money', `In parallel: ${e(T.person(by === 'bu' ? 'rania' : 'hesham'))} ${other ? (other.ok ? 'approved ' + T.fmt(other.day) : 'said not yet') : 'has not answered yet'}`, dl(by === 'bu'
        ? [['Requisition', e(r.title) + ' · ' + e(T.acc(r.acc).name)], ['Seats', r.seats + ' · ' + filled + ' filled'], ['Budget band', e(o.band)], ['This offer', e(o.salary)]]
        : [['Role', e(r.title)], ['Evidence', e(T.evCount(a).text)], ['Salary', e(o.salary) + ' · band ' + e(o.band)], ['Notice and start', e(o.notice) + ' · ' + T.fmt(o.start)]]) +
        (by === 'bu' ? aimySay('Fit is the hiring manager\'s question, not yours. Decision D7 may move this to when the requisition opens.') : ''), 'b-about')}</div>`;
  };
  const AR = { 'Careers at FlairsTech': 'الوظائف في فليرز تك', 'Apply with AiMY': 'قدّم مع AiMY', 'Your applications': 'طلباتك', 'You will hear by': 'ستسمع منا قبل', 'With the recruiter': 'لدى مسؤول التوظيف', 'With the hiring company': 'لدى الشركة', 'Interview booked': 'تم حجز مقابلة', 'Withdraw': 'سحب الطلب', 'Updates on WhatsApp': 'التحديثات عبر واتساب', 'Closed. Thank you for your time.': 'أُغلق الطلب. شكرًا لوقتك.', 'Use a sample CV': 'استخدم سيرة ذاتية نموذجية', 'Send my application': 'أرسل طلبي', 'Keep and read my CV (needed to apply)': 'الاحتفاظ بسيرتي الذاتية وقراءتها (مطلوب للتقديم)', 'Updates on WhatsApp (optional; otherwise email)': 'التحديثات عبر واتساب (اختياري؛ وإلا فبالبريد)', 'Withdrawn': 'تم سحب الطلب' };
  const t = s => T.UI.lang === 'ar' ? (AR[s] || s) : s;
  const lang = () => `<span class="b-cuts" style="gap:4px"><button class="filter-chip${T.UI.lang !== 'ar' ? ' active' : ''}" type="button" data-lang="en">English</button><button class="filter-chip${T.UI.lang === 'ar' ? ' active' : ''}" type="button" data-lang="ar" lang="ar">العربية</button></span>`;
  P.apply = (u) => {
    const r = T.req(u.apply), stp = T.UI.applyStep || 0;
    return `<div class="s-home" ${T.UI.lang === 'ar' ? 'dir="rtl" lang="ar"' : ''}>${outside('a candidate')}
      <section class="s-rec-head s-block-wide"><span class="s-rec-kind b-kinds">${T.fact('web', t('Careers at FlairsTech'))}${lang()}</span>
        <div class="s-rec-title"><h1 class="s-rec-name">${e(r.title)}</h1></div><p class="tc-summary">Cairo · ${r.criteria.filter(c => c.must).map(c => e(c.text)).join(' · ')}</p></section>
      ${!r.published ? block('Not open', '', '<p class="s-block-say">This role is not open to applications.</p>') : block(t('Apply with AiMY'), 'Your CV is read as data, never as instructions. A person decides, not AiMY.',
        stp === 0 ? `${aimySay('Drop your CV here. AiMY reads it and asks only for what it lacks.')}<div class="s-rec-actions">${btn(t('Use a sample CV'), { applycv: 1 }, 's-insight-lnk primary')}</div>`
        : stp === 1 ? `${aimySay('I read: <b>Yara Mansour</b> · 3 years in technical support · German C1, English C1, Arabic native · Zendesk, L2, night shifts. One thing is missing: a phone number.')}
          <div class="s-rec-actions"><input class="b-draft-in" id="ph" value="+20 100 555 0142" dir="ltr" style="max-width:220px">${btn('That is it', { applyphone: 1 }, 's-insight-lnk primary')}</div>`
        : stp === 2 ? `${dl([[t('Keep and read my CV (needed to apply)'), '<input type="checkbox" id="ccv" checked>'], [t('Updates on WhatsApp (optional; otherwise email)'), '<input type="checkbox" id="cwa">']])}<div class="s-rec-actions">${btn(t('Send my application'), { applysend: 1 }, 's-insight-lnk primary')}</div>`
        : `${aimySay(`Sent. You will hear from us by <b>${T.fmt(T.TELL_WITHIN)}</b>.`)}<div class="s-rec-actions">${btn('Open my profile', { me: 'yara' }, 's-insight-lnk primary')}</div>`)}</div>`;
  };
  P.me = (u) => {
    const c = T.cand(u.me); if (!c) return '<p class="s-block-say">No such profile.</p>';
    if (!T.UI.meOk) return `<div class="s-home">${outside('the candidate')}<section class="s-rec-head s-block-wide"><div class="s-rec-title"><h1 class="s-rec-name">Enter the code we sent you</h1></div><p class="tc-summary">${c.consent.wa != null ? 'By WhatsApp' : 'By email'} · valid for 10 minutes</p><div class="s-rec-actions"><input class="b-draft-in" value="482 913" dir="ltr" style="max-width:160px;letter-spacing:.2em">${btn('Open', { meok: 1 }, 's-insight-lnk primary')}</div></section></div>`;
    const apps = T.appsFor(c.id);
    const status = a => {
      if (a.exit === 'withdrew') return [t('Withdrawn'), null];
      if (a.exit && a.toldDay != null) return [t('Closed. Thank you for your time.'), null];
      if (a.exit) return [t('With the recruiter'), Math.max(1, a.exitDay + T.TELL_WITHIN)];
      const iv = Object.values(D().interviews).find(i => i.app === a.id && i.day >= 0);
      if (iv) return [t('Interview booked') + ' · ' + T.wday(iv.day) + ' ' + iv.time, null];
      if (['sent', 'client', 'ctech'].includes(a.stage)) return [t('With the hiring company'), Math.max(1, a.since + 7)];
      return [t('With the recruiter'), Math.max(1, a.since + (T.STAGES[a.stage].exp || 3) + 2)];
    };
    return `<div class="s-home" ${T.UI.lang === 'ar' ? 'dir="rtl" lang="ar"' : ''}>${outside('the candidate')}
      <section class="s-rec-head s-block-wide"><span class="s-rec-kind b-kinds">${lang()}</span><div class="s-rec-title"><h1 class="s-rec-name">${t('Your applications')}</h1></div><p class="tc-summary">${e(c.name)}</p></section>
      ${block(t('Your applications'), 'We never break news here first', dl(apps.map(a => { const [s, by] = status(a); return [T.req(a.req).title, `${e(s)}${by != null ? ` · ${t('You will hear by')} <b>${T.fmt(by)}</b>` : ''} ${!a.exit && T.active(a) ? `<button class="s-inline-btn" type="button" data-withdraw="${a.id}">${t('Withdraw')}</button>` : ''}`]; })), 'b-about')}
      ${block(t('Updates on WhatsApp'), c.consent.wa != null ? 'On since ' + T.fmt(c.consent.wa) : 'Off: messages come by email', `<div class="b-cuts b-cuts-row"><button class="filter-chip${c.consent.wa != null ? ' active' : ''}" type="button" data-wa="${c.id}">${c.consent.wa != null ? 'On' : 'Off'}</button></div>`)}</div>`;
  };
})();

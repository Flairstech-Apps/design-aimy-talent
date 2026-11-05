# AiMY Talent — the recruiter build

AiMY Talent is FlairsTech's recruiting product. This repo is its design prototype: one HTML shell and one vanilla-JS file, with a seeded corpus and no backend.

It is built on **AiMY Sales** (decided 26 Oct 2026). It uses the same shell, components and design system, and the same nine-section layout as Sales's `bdr.js`, with a different process on top. The reasoning, and the full map of what comes from Sales, is in the audit

```bash
python devserver.py 8131      # then open http://localhost:8131/
node assets/audit.js          # before every commit; read the whole output
```

Don't serve it with `python -m http.server`. The cache stamp `?v=` lives inside `index.html`, and `devserver.py` exists to send `no-store` on HTML. Bump the stamp on `talent.js` or `talent.css` whenever either changes.

## What the recruiter sees

The recruiter's desk opens as **Omar Saeed**. The other three desks are described under "The rest of the requirements".

- **Today** (`/`) is the briefing (5 Nov):
  - The day, one fact a line: results waiting on your call, today's interviews, what clients owe, missed calls and callbacks.
  - Four Start tiles. **Decide the oldest one** and **Send profiles** open a run (`?on=decide`, `?on=decide&q=send`): one candidate card at a time with its own buttons, "1 of 4", the next names under it, Skip for now, and an end that sends you back to Today. **Call the next one** starts the call run; **Find people** opens the chat.
  - **What AiMY noticed**: only what the briefing doesn't already say (first contact, screening, careers page, reports, what AiMY did), each opening in the chat.
  - **Not told yet**, the one block with a deadline: the HR template shown once, a Send on each row, and Send the answer to all.
- **Requisitions** (`?on=reqs`) shows your requisitions as cards. Cuts: Open, At risk, Waiting on the client, Waiting on you, On hold, Closed. There's a find box that also matches candidate names.
- **One requisition** (`?req=r2`) is Sales's campaign record turned into a requisition:
  - The record head, with the need, hiring manager, stages, success profile and notes.
  - A lead reading.
  - The funnel, with the biggest drop marked.
  - The candidates on it, cut by stage. Each card has its next move and its exit, each with Undo.

- **Conversations** (`?on=calls`, Calls until 5 Nov) is every way the recruiter and a candidate talk, with three tabs:
  - **To reach:** callbacks someone asked for come first, then phone screens that are due, then people who applied and haven't been called. "Call them in order" calls down the list, with "Log it and call the next one" or "Log it and stop" after each call.
  - **Inbox:** missed calls (with any message they left) and WhatsApp replies, newest first. A missed call clears when you call them back; a WhatsApp reply clears when you answer it or press Needs no reply.
  - **History:** every call and message on every channel, grouped by day: calls in AiMY, Teams calls, calls logged from elsewhere, and WhatsApp both ways.
  - **A WhatsApp thread** (`?on=calls&th=`) runs through AiMY Connect, only for people who opted in. Within 24 hours of their last message a reply is free text; after that only one of the HR Manager's approved templates can be sent. Each send has Undo and lands on their history.
  - **Log a call from elsewhere** (`?on=calls&lg=`, also on the candidate page) records a call on the recruiter's mobile, a WhatsApp call or Teams outside AiMY: who, the channel, when, what happened and a note. A recording is optional and needs a tick that they agreed to it; AiMY transcribes it, picks the outcome it heard and keeps notice and salary. The log has the same effects and Undo as a call in AiMY.
  - **Teams calls** from the call panel say that Teams tells them it is recording; when the call ends the recording and transcript come back and AiMY reads them, so History shows "Teams sent the recording back".
- **One candidate** (`?cand=k20`) is Sales's contact record turned into a candidate:
  - Who they are and their phone number.
  - What they said on calls (notice period and salary).
  - Their evidence against the success profile.
  - A Call button, plus their next move and exit.
  - Every call with them.

The rail shows what's waiting on you, plus three doors: the next interview, your calls (to call, missed, callbacks due), and your days to send profiles against the team's. The bell lists missed calls, results that are in, and answers that are owed. The composer finds: Enter takes you to the requisitions matching what you typed.

## Calls, from Sales

Recruiters make and take calls all day, so Sales's whole call model comes across. Telephony is fixture, as in Sales: a transcript grows a line at a time from the candidate's own `fate`.

- **The dialer** in the top bar has a From line picker (two Cairo lines). As you type a number it tells you whose it is; a number that belongs to a candidate puts the call on their record.
- **The call panel** sits beside the page, not in a modal, and has four states:
  - **Ready:** what to get on this call (notice, salary, and the must-haves the CV is silent on), plus the last call.
  - **Connecting.**
  - **Live:** a timer, record, mute, hold, hang up, and minimise.
  - **Logging.**
- **Recording needs consent.** Record asks whether the candidate has been told. Nothing is transcribed until you say they have.
- **Logging is a sentence, not a form.** There are eight outcomes on one row, keys 1 to 8, with AiMY's reading of the call already selected. A note underneath is read as you type and overrides the transcript. One line says what Log will do.
  - "Passed the screen" moves someone at or before the phone screen to the HR interview, and saves their notice and salary.
  - The exits are Not a fit, Not interested, and Do not call. Wrong number marks the number as not working.
  - Every log can be undone from its toast.
- **Incoming calls** use Sales's ring widget, with the synthesised ringtone. You answer or decline. After 30 seconds unanswered, the call is logged as missed on the candidate's record. A stranger's name is read off the call, and one press adds them as a candidate on the requisition their words point at.
- **Prototype panel:** "A candidate calls in", two kinds of stranger calling in, and a sound on/off switch.

In Sales, the log is read back in the AiMY canvas. Talent keeps it in the call panel, which stays beside the page while you move around; the canvas holds the bar's questions.

## The rest of the requirements (built 26 Oct)

Everything in the New Operations list and the Product Overview now has a surface. Each one follows the Sales rules: one press with Undo, prose behind Edit, no modals or pickers as the only way.

- **Five desks, switched by `?as=`** from the name in the top bar, one for each of Sales's desks:
  - `omar` (recruiter, the default).
  - `rania` (hiring manager). Sees candidates from the technical interview on, approves offers, owes debriefs, and gets clients' requests as drafts.
  - `hesham` (BU Director, Sales's stakeholder). Reads every requisition and changes none. Answers budget and headcount on an offer, requests hires for the unit (they go to Rania as a draft), and hears why clients pass.
  - `dina` (HR Manager). Sees every requisition, the ones at risk with a Reassign menu (AiMY's pick is the lightest load), stage templates, interview templates and the reports.
  - `jana` (client, Northwind only). Sees her own requisitions, decides on profiles sent (Meet them or Pass), gives interview feedback, and asks for a hire in the AiMY bar. No salary, no internal notes.
- **Requisitions are created and edited** through the interface (New requisition, Clone it, Edit) or through AiMY ("open a requisition for 2 Senior Accountants at Northwind"). A new one is a draft until Open; Write it with AiMY drafts the description and success profile, and says so when nothing like the role was filled before. Published puts it on the careers page with a link to copy for LinkedIn. Hold, Filled and the two cancels are one press each.
- **Stage templates** are per account and edited on the HR desk (`?on=templates`); a requisition takes its account's stages when it opens.
- **Candidates are added from a CV** (`?on=add&req=r1`). AiMY reads it in four shown steps, asks only for what is missing (a phone number, usually), checks the pool for the same person, and creates the profile. A candidate can also be added to another requisition from their page, and their details edited behind Edit.
- **Finding candidates** (`?on=find`) takes a brief or a requisition and searches the talent pool, the web, Apollo and SignalHire. Each result carries its must-haves met, as counts, with Why behind it. People found outside wait for a recruiter to approve first contact.
- **Assessments** (`?on=asmts`, `?asmt=a1`) are questionnaires or live with the AiMY agent, with a pass mark, a link to share, AI scoring, per-question results, and the insight when one question fails most people ("74% got Q5 wrong") with Reword it with AiMY or Drop it. The candidate takes it at `?take=`. A live assessment is a conversation: AiMY asks one question at a time, asks once for more when an open answer is too thin to score, and the recruiter's result says which questions it followed up on.
- **Interviews** carry the template's agenda plus what the CV is silent on. The interviewer gets a link (`?debrief=`) to rate each must-have and say proceed or not; other interviewers' feedback stays hidden until theirs is in. A recording can be uploaded, transcribed and read against the success profile. The candidate page shows each must-have as CV says, then Interview found, with the deepest interview first.
- **Offers** are prepared from the card, approved in parallel by the hiring manager and the BU director (`?approve=&by=hm|bu`), sent by a person, and answered. Accepted opens onboarding with its checklist and day-30 and day-90 check-ins.
- **History** on every candidate: calls, moves, interviews, tests, offers and notes. A typed note that reads as a pass or a no gets the matching move offered beside it.
- **The careers page** (`?apply=r1`) is an anonymous AiMY chat: drop a CV, fill in only what it lacks, consent, send. The candidate's own profile (`?me=`) opens with a one-time code, shows where each application stands, and lets them update details or withdraw.
- **Reports** (`?on=reports`) for the recruiter, the hiring manager and HR, plus an account page (`?acc=`).
- **The AiMY bar** answers in the card above it first, and every question and answer is also kept in **the AiMY canvas** (Sales's overlay): press the answer or the mark on the bar to open it. The canvas has each desk's conversations in a column (New conversation, delete with Undo), openers when a thread is empty, a "Based on" line naming what it reads, and a shimmering "Reading the requisitions" while it answers. The bar answers what is waiting, which requisitions are at risk, where people drop (or at a named stage), how long it takes to send the first profile, and finds people and requisitions by name.

Motion uses transitions.dev pieces on the shell's own timing: the error shake on a wrong field, shimmer on the step AiMY is on, the accordion on interview details, the success check when an outside page is done, and a short reveal for results. All stop under reduced motion.

## Closing the loop (the UI/UX plan, built 26 Oct)

The market research found that single steps of hiring are solved and the loop is not. These parts make the prototype's loop learn and keep it lawful. Each is one press with Undo, and AiMY suggests while a person decides.

- **Client decline reasons (P1).** Pass, and the recruiter's Client declined, open six reasons in place: spoken language, experience, salary, notice period, skills gap, or other with one line. The toast says what the reason feeds ("4th decline at Northwind this month for spoken language"). The sendout is a record: sent, opened (set when the client opens the profile), decided, each dated. Reasons are counted on the requisition, the account and the reports.
- **Learning proposals (P5).** When one reason dominates a client's declines (five in 90 days, one reason behind three and a third of them), AiMY proposes a rule for that client only. A question most people miss becomes a proposal to reword or drop it. The HR Manager approves; a question keeps its earlier wordings as versions.
- **Honest reports (P2, P6).** The reports lead with where people are lost, upstream, and the days to send, compare profiles per client interview with the 3 to 5 agency norm on whichever side it falls, say the benchmark is weak, and carry one action ("No profile after 10 days" is a new requisition cut). By recruiter is an alphabetical table of counts.
- **Safe sourcing (P4).** Find searches the talent pool first and the public web second, in one list; each web result names its page, Apollo only adds a work email, and SignalHire is shown parked (D10). The CV being silent on a must-have reads Not known, with Ask them.
- **Consent (P9).** The candidate page lists CV, WhatsApp and recording consent with dates. Assessment invites, offer questions and onboarding documents go on WhatsApp only with the opt-in, which the candidate can switch on their own profile.
- **Nobody waits without hearing back (M4).** Exits are owed an answer within five days: Today's Not told yet shows the HR template filled in, and one press (or one batch) sends it. The candidate's own profile says when they will hear, and never breaks the news first.
- **Select many, act once (M7)** on Find results, sourced prospects and declines.
- **Wave 3, gated by data.** Each assessment question shows whether people who got it right met the client more often, once 20 have been sent (P3). Day-30 and day-90 check-ins are records, and outcome proposals wait for 20 day-90 check-ins (P7). The HR Manager sets what AiMY may do on three rungs, and only a person moves it up (m4).
- **Smaller ones.** Today names the records each block reads (M8). The hiring manager's asks are grouped by account, oldest first, and include answers clients owe (M11). Clients see billed hires beside acceptance and day-90 retention (M10). The BU Director's page asks about budget and headcount only (M3). Calls carry a Design target label (P8). The careers page and own profile switch to Arabic, right to left (M9; the Arabic needs a native read). The debrief quotes the recording marked Check it, and names the agenda topic it never reached.

Every part is documented, with a screenshot, in the local knowledge vault: `knowledge-vault/50 Design system/Component library.md`.

## Closer to Sales (27 Oct)

These four parts close the gaps between this prototype and AiMY Sales. They were found by comparing it with `talent-sales/` (Sales's UX, followed exactly) and `talent-v2/` (a research-first sandbox). `talent-sales/compare.html` maps Sales onto Talent process by process.

- **Candidates** (`?on=cands`) is Sales's Contacts queue. It holds everyone on your open requisitions, 15 at a time, with "1–15 of 37" underneath. The cuts are Waiting on you, First contact, With the client and Waiting on others, and they add up to All. Not told yet sits apart.
- **Finding through the chat** (Sales B8). Find people on Today, or "find …" in the bar, opens the canvas. AiMY asks whether to search the pool, the web or both, reads the success profile back, and brings back a shortlist marked **Not saved yet**, with a Keep tick on each card. From there you can add the kept people to a requisition, save the list (saved lists appear under Find candidates) or discard it. If you leave without saving, a gate at the top of the page offers Save, Discard or Stay, and the browser's Back is caught too. The Find tab's form is still there.
- **The bell brings work back.** When a decision is taken on another desk, it lands in the bell of the desk it is for, and Undo takes the news back with it. That covers a client's pass or meet, an interviewer's debrief, an offer approved or sent back, a requisition reassigned, and a hiring request.
- **The BU Director's desk** (`?as=hesham`). See the desk list above.

## Rules carried over from Sales

- **The stage is stored.** `cand.stage` moves only through `move` (one press, with Undo). It never moves backwards except by Undo. An exit is not a stage.
- **The order comes from the requisition's template**, not one global list. `TEMPLATE.client` ends in profile sent, then client interview. `TEMPLATE.internal` (FlairsTech's own roles) has a managerial interview instead.
- **The store holds the delta, not the corpus.** The corpus is regenerated from one seed on every load, dated relative to today. Only your changes are saved, under `aimy-talent:db:v1`. Reset is in the prototype panel.
- **One definition per figure.** Everything is derived in section 5 of `talent.js`. "Open" on the chips, the rail and the switcher all read `isOpen`.
- **Evidence is said as counts:** "3 of 4 must-haves met". There is no match percentage. This is the audit's recommendation, and the manager's answer is still pending.

## The corpus

It is shaped like the real Recruitment dashboard (Power BI, Aug–Sep 2026), with invented people and accounts:
- 6 recruiters and 39 requisitions.
- One account (Northwind Software) holding more than half.
- About 82% replacements.
- Support, accounting and operations roles.
- Stage pass rates of about 71% (phone to HR), 54% (HR to technical), 79% (technical to profile sent), 30% (profile sent to client interview) and 88% (client interview to offer).

Omar's own ten requisitions are scripted, so Today always has its cases: one at risk, one with profiles waiting on the client, two with results in, one just opened, one on hold, and a closed tail.

## Files

- `index.html` is the Sales shell with the canvas overlay and drop layer taken out; the dialer, call panel, peek card and desk menu are in.
- `assets/talent.js` is the whole product.
- `assets/talent.css` is an appendix holding only what `sales.css` and `bdr.css` don't already say: the two-verb work row, the funnel, call logging, the transitions.dev motion, and the parts of the record, intake, finder, assessment and outside pages.
- `assets/sales.css`, `assets/bdr.css`, `assets/aimy-ds.css`, `assets/aimy-ds.js`, `assets/aimy-responsive.css` and `assets/aimy-viewport.js` are copied from Sales and never edited here.
- `assets/audit.js` is Sales's audit, retargeted to `talent.js` and `talent.css`. Sales's call-fixture and sales-target checks are dropped.

## Voice, voicemail and video (from Sales)

- **Voice** is Sales's `voice.js` and `voice.css`, unedited. It mounts on both bars: attach a file, dictate into the field, or start a spoken conversation that asks through the canvas and reads the answer back. It uses the browser's own speech recognition and voice, and says so in words where they are missing. The canvas sets `.is-generating` on its bar while AiMY reads, which is how voice knows the answer is in.
- **Voicemail**: a missed call can carry the message the caller left. It plays back from the call log, the Missed tab and the candidate's record as Sales's strip, and the browser reads the words aloud unless sound is off in the prototype panel.
- **Video calls**: before a call starts, Phone or Video on Teams is one press in the call panel. On video the brief opens with five tips for how you come across, the live call has a camera button, and the log marks the call as on Teams.
- **Dictation in the live assessment**: Say it fills the answer from the microphone, in German for the German check.

## Not built yet

- Real integrations: LinkedIn, Apollo, SignalHire, Teams, recordings, WhatsApp and Freshdesk are fixtures, as telephony is in Sales.
- A Cloudflare Worker for `aimy-talent` (`wrangler.jsonc` is ready; nothing is deployed).

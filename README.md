# AiMY Talent — the recruiter build

AiMY Talent is FlairsTech's recruiting product. This repo is its design prototype: one HTML shell and one vanilla-JS file, with a seeded corpus and no backend.

It is built on **AiMY Sales** (decided 26 Oct 2026). It uses the same shell, components and design system, and the same nine-section layout as Sales's `bdr.js`, with a different process on top. The reasoning, and the full map of what comes from Sales, is in the audit: https://claude.ai/artifact/PGmYnMYfeXPs2fUG7rYZe7 ("Building on AiMY Sales").

```bash
python devserver.py 8131      # then open http://localhost:8131/
node assets/audit.js          # before every commit; read the whole output
```

Don't serve it with `python -m http.server`. The cache stamp `?v=` lives inside `index.html`, and `devserver.py` exists to send `no-store` on HTML. Bump the stamp on `talent.js` or `talent.css` whenever either changes.

## What the recruiter sees

The recruiter's desk opens as **Omar Saeed**. The other three desks are described under "The rest of the requirements".

- **Today** (`/`) is the briefing, with:
  - The day in three sentences: decisions waiting on you and today's interviews, the requisition likely to miss its date, and what clients owe.
  - Four Start tiles.
  - The decisions waiting on you, each one press with Undo.
  - Today's interviews.
  - Candidates waiting on others past the usual time, with a Nudge on each.
  - The requisitions likely to miss their date, each with its reason.
- **Requisitions** (`?on=reqs`) shows your requisitions as cards. Cuts: Open, At risk, Waiting on the client, Waiting on you, On hold, Closed. There's a find box that also matches candidate names.
- **One requisition** (`?req=r2`) is Sales's campaign record turned into a requisition:
  - The record head, with the need, hiring manager, stages, success profile and notes.
  - A lead reading.
  - The funnel, with the biggest drop marked.
  - The candidates on it, cut by stage. Each card has its next move and its exit, each with Undo.

- **Calls** (`?on=calls`) has three tabs:
  - **To call:** callbacks someone asked for come first, then phone screens that are due, then people who applied and haven't been called. "Call them in order" calls down the list, with "Log it and call the next one" or "Log it and stop" after each call.
  - **Missed:** people who called and got nobody. A missed call clears when you call them back, or when they call again and get you.
  - **Today:** every call, grouped by day.
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

- **Four desks, switched by `?as=`** from the name in the top bar:
  - `omar` (recruiter, the default).
  - `rania` (hiring manager). Sees candidates from the technical interview on, approves offers, owes debriefs, and gets clients' requests as drafts.
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

## Live

https://aimy-talent.nour-ali.workers.dev, the Cloudflare Worker `aimy-talent` (first deployed 26 Oct 2026). It is deployed by hand from this folder:

```bash
npx wrangler@4 deploy
```

`.assetsignore` keeps the git history, local settings and dev files off the site (Sales's list). After a deploy, check that the live `?v=` stamps match `index.html`. Unlike Sales, pushing does not deploy: no Git integration is set up for this Worker.

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

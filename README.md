# AiMY Talent — the recruiter build

AiMY Talent is FlairsTech's recruiting product. This repo is its design prototype: one HTML shell and one vanilla-JS file, with a seeded corpus and no backend.

It is built on **AiMY Sales** (decided 26 Oct 2026). It uses the same shell, components and design system, and the same nine-section layout as Sales's `bdr.js`, with a different process on top. The reasoning, and the full map of what comes from Sales, is in the audit: https://claude.ai/artifact/PGmYnMYfeXPs2fUG7rYZe7 ("Building on AiMY Sales").

```bash
python devserver.py 8131      # then open http://localhost:8131/
node assets/audit.js          # before every commit; read the whole output
```

Don't serve it with `python -m http.server`. The cache stamp `?v=` lives inside `index.html`, and `devserver.py` exists to send `no-store` on HTML. Bump the stamp on `talent.js` or `talent.css` whenever either changes.

## What the recruiter sees

The recruiter's desk opens as **Omar Saeed**. It is the only desk so far.

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

In Sales, the log is read back in the AiMY canvas. Talent has no canvas yet, so it's read back in the call panel.

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

- `index.html` is the Sales shell with the dialer, call panel, drop layer, peek, canvas overlay and desk menu taken out. Comments mark each gap.
- `assets/talent.js` is the whole product.
- `assets/talent.css` is an appendix holding only what `sales.css` and `bdr.css` don't already say: the two-verb work row and the funnel.
- `assets/sales.css`, `assets/bdr.css`, `assets/aimy-ds.css`, `assets/aimy-ds.js`, `assets/aimy-responsive.css` and `assets/aimy-viewport.js` are copied from Sales and never edited here.
- `assets/audit.js` is Sales's audit, retargeted to `talent.js` and `talent.css`. Sales's call-fixture and sales-target checks are dropped.

## Not ported yet

These come with the surface that needs them:
- The AiMY canvas, the answer card and voice.
- Sourcing in chat.
- CV intake.
- Voicemail playback and video calls.
- The account page.
- The hiring manager, HR Manager and client desks.
- The bell's follow-up lines.

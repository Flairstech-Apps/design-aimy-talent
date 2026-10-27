# AiMY Talent v2 prototype

A fresh build of the hiring loop that learns, from the market research ("Closing the loop"), the UI/UX plan of 26 Oct 2026 and the knowledge vault. It shares no code with the prototype at the repo root. It reuses only the AiMY mark, the brand colours and Poppins.

```bash
node talent-v2/serve.mjs 5175
```

Then open http://localhost:5175. Switch desks from the profile pill. Outside links are in the sidebar. Every write lands with Undo, and the data is kept in the browser's storage. To go back to the seed, choose **Reset demo data** in the desk menu.

## What it covers

| Plan item | Where |
|---|---|
| P1 reason on every client Pass, the sendout as a record | Client desk (Jana), candidate page, requisition "Why … passed" |
| P2 honest insight with one action | Reports |
| P3 question tied to client outcomes, behind a sample gate | Assessment page |
| P4 safe sourcing: pool first, web second, sources named, Apollo for email only, SignalHire and LinkedIn parked | Find people |
| P5 question changes as learning proposals with versions | Assessment page → HR desk, Learning |
| P6 recruiter counts, alphabetical, no league table | Reports (HR desk), HR team load |
| P7 no outcome proposals before 20 day-90 check-ins | HR desk, Learning |
| P8 Calls labelled Design target | Candidate page |
| P9 WhatsApp only with an opt-in; consent with dates | Candidate page, invites, careers page, own profile |
| M3 two approvers, two questions | Approval links (`#/approve/o1/hm`, `#/approve/o1/bu`) |
| M4 everyone hears within 5 days; HR template; batch send | Today: Not told yet; candidate's own profile |
| M7 select many, act once | Find, first contact, Not told yet |
| M8 each block names the records it reads | Every desk |
| M9 Arabic, right to left | Careers page, own profile |
| M10 billed hires beside acceptance and retention | Client: Your hiring with us |
| M11 hiring manager's asks by account, oldest first | Hiring manager desk |
| m4 autonomy ladder, only a person moves an action up | HR desk: What AiMY may do |
| Debrief: AI quotes "Check it", verdict starts empty, gap warning, others hidden until you submit | `#/debrief/i1` |
| Verified skills: CV says vs Interview found | Candidate page |
| Logging is a sentence; AiMY reads it back | Candidate history, AiMY bar |

The Arabic needs a native read. People and companies are invented; the Aug–Sep report figures are the stakeholder's dashboard.

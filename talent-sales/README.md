# AiMY Talent, built on AiMY Sales

The Talent hiring loop with Sales's exact UX. The page shell and stylesheets (`aimy-ds.css`, `sales.css`, `bdr.css`, `aimy-responsive.css`, `aimy-viewport.js`, `aimy-ds.js`) were copied unedited from the live Sales prototype (aimy-sales.nour-ali.workers.dev, 27 Oct 2026). Three new scripts paint Talent into Sales's markup:

| File | What it holds |
|---|---|
| `assets/talent-data.js` | Vocabulary and seed data, shared with `talent-v2/`, with Sales's five desks |
| `assets/talent.js` | Helpers, the store, derivations, the URL |
| `assets/talent-pages.js` | Every page in Sales's markup: Today, title tabs, cards, records, reports, outside links |
| `assets/talent-app.js` | The frame (rail, bell, answer card, canvas, call panel, toast), the router, every action |

`compare.html` lines Sales up against Talent, process by process.

```bash
node talent-sales/serve.mjs 5177
```

Open http://localhost:5177. To switch desks, use the profile pill or `?as=omar|rania|hesham|jana|dina`. The sliders button in the bottom right opens the outside links (careers page, own profile, debrief, approvals), the comparison, and **Reset to seed**.

| Sales desk | Talent desk |
|---|---|
| Caller (Engy) | Recruiter (Omar Saeed) |
| Sales manager (Lina) | Hiring manager (Rania Samir) |
| Stakeholder (Sherif) | BU Director (Hesham Nabil) |
| Client (Marit) | Client (Jana Weber, Northwind) |
| CEO (Rami) | HR Manager (Dina Ragab) |

Calls are simulated. Telephony for Talent is on hold with AiMY Phone, so the call panel is labelled a design target. The Arabic still needs a native speaker to read it. The people and companies are invented.

# D5: what to settle with Habeba before AIMY-2901 goes further

## What D5 is

D5 is an open decision in the Talent research: **should Talent show individual recruiters ranked against each other?**

The research listed three options:

| Option | What it means in Talent |
|---|---|
| Rank recruiters | League tables: who converts most, who is fastest, sorted best to worst |
| Team-level only | Talent shows the team's pipeline; no per-person comparisons |
| Per-person views live in AiMY QA | Talent shows the team; coaching one person at a time happens in AiMY QA, as Sales does it |

The plan recommends **team views in Talent, and individual coaching in AiMY QA**. The manager has not confirmed it yet, so it is still open.

## Why AIMY-2901 runs into it

AIMY-2901 asks for a per-recruiter view for the HR Manager: each recruiter's candidates by stage, their last activity, and a flag on "recruiters with no recent activity". That is per-person visibility, and a view like that slides into a scoreboard easily (sort by most stuck, a red flag on a person's name).

## The evidence to bring

- **A field experiment found that ranking people cut productivity by 14%** (research note R6, "Insights and closing the loop"). Ranking turns colleagues into competitors and rewards gaming the numbers.
- **Sales already decided this.** In AiMY Sales, per-person coaching lives in AiMY QA, not in the work tool.
- **HR already sees per-recruiter counts** in today's Power BI dashboard, so taking them away entirely isn't realistic either. The question is how they are shown, not whether.

## What I built, as a middle ground (`?as=dina&on=team`)

It does what the ticket asks, with five rules that keep it from becoming a ranking:

1. **Alphabetical, never sorted by a number.** There is no "worst first".
2. **It counts work, not people.** Positions, people at each stage, and people held past N business days. There are no conversion rates, speed or time-to-hire per recruiter.
3. **The flags sit on stages, not on people.** "2 held at Profile sent" points at stuck candidates, which can be unblocked.
4. **"No recent activity" is framed as a check-in.** AiMY's line says to ask how they are before reassigning, because leave and a heavy load look the same in this data.
5. **The thresholds are in plain sight.** The HR Manager sets them in the sentence at the top (5 business days for a stage, 3 for "quiet").

The existing **By recruiter** table in Reports stays as before: alphabetical counts, no bars, "not a ranking until D5". It now links to this page.

## Questions to ask Habeba

1. **What decision does the HR Manager make with this view?** Rebalancing load and unblocking stuck candidates fits Talent. Judging performance belongs in AiMY QA. The answer settles most of D5.
2. **Should per-recruiter rates be added** (conversion %, days to send a profile per person)? I left them out on purpose: that's the line between a workload view and a league table.
3. **Will recruiters know this view exists, and can they see their own card?** Being open about it lowers the "being watched" effect.
4. **Is "last moved something" a fair signal?** It can't tell leave from overload. Is there an HR or leave calendar we could read, so a recruiter on leave isn't flagged?
5. **Are the thresholds right?** Client stages usually take longer than internal ones. Should "held" be measured against each stage's usual time instead of one number?
6. **Who makes the final call on D5, and by when?** It has been "pending the manager" since the research.

## If the answer is…

| Decision | What changes in the build |
|---|---|
| **Team-level only** | The per-recruiter cards go; the team section and stage strip stay; By recruiter in Reports is removed |
| **Middle ground (as built)** | Nothing; mark D5 decided and remove the "pending" note from Reports |
| **Rank** | Sort and rates per recruiter get added. I'd advise against it; the 14% finding should be on record if this is chosen |
| **Coaching in AiMY QA** | Keep this view for workload; add a "Coach in AiMY QA" link per recruiter |

## Other things to settle with Habeba at the same time

- **AIMY-2926:** the ticket says the Recruiters View is the *primary landing page*. I built it as its own page next to Today and left Today as the landing page. Should it replace Today?
- **AIMY-2866:** the ticket lists 8 fixed stages. The prototype uses each account's own stage template (Northwind has Assessment and Client technical; internal roles have Managerial). Is one fixed list wanted, or per-account templates?
- **AIMY-2942:** the session is in English (B2). Should it also run in German for the German roles, and is the 4-part script content (passage, call, sentence) the right test?
- **AIMY-2900:** the ticket's red tier includes things like "English proficiency not validated". The prototype treats *not known* as unknown, not as a gap, and flags only what an interview contradicted or what's short of the years asked. Is that distinction OK?

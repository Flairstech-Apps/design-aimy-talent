#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   THE AUDIT — one script, run before every commit.

       node assets/audit.js

   The V3 build carried three of these totalling 100KB. This one is small on
   purpose: it checks the handful of things that break SILENTLY in a product
   with no build step, no types and no tests, and nothing else.

   What breaks silently here:

   1  A control that is drawn and not wired. It looks like a button, it is a
      button, and pressing it does nothing at all.
   2  A handler with nothing drawing it. Dead code that reads as a feature.
   3  A class used and never defined. The element renders unstyled, which on a
      dark ground often means invisible rather than ugly.
   4  A rule defined and never used. Ten percent of the V3 stylesheet was this.
   5  An unbalanced brace. Every rule after it silently stops applying, and the
      V3 build's CSS audit could not see it — the blind spot is why it is here.
   6  A banned pattern: a native select, an inline handler, `transition: all`.
   7  Mixed line endings in one file, which is what a careless sed leaves.

   Exit code is 1 on any failure, so this can gate a commit.
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* Comments are not markup. The shell keeps `data-page` and `data-gopage` in a
   comment as the record of a trap that was removed, and a scan of raw text
   reads those as controls nothing handles. */
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
const JS = strip(read('assets/talent.js'));
const CSS = read('assets/talent.css');
const BDR = read('assets/bdr.css');
const HTML = strip(read('index.html'));
const DS = read('assets/aimy-ds.css');
const SALES = read('assets/sales.css');

const fails = [];
const notes = [];
const fail = (check, msg) => fails.push(check + ': ' + msg);

/* Attributes that are markers rather than verbs — read by something other
   than the click router, or by the browser itself. Each one needs a reason. */
const MARKERS = {
  'theme': 'the html element attribute the design system themes on',
  'submit-on-enter': 'read by a keydown listener, not by a click',
  'i': 'the row index a windowed list writes for its own bookkeeping',
  'fig': 'the key a figure is known by between two paints, so the one that changed can tick',
  'for': 'the person a decision on a card is about; the verb beside it is data-decide',
  'picksearch': 'the chooser\u2019s filter box, read by an input listener rather than a click',
  'one': 'the chooser holds one answer, not several; read when an option is pressed',
  'verb': 'what the chooser\u2019s confirm says before a count is added to it',
  'work-state': 'the canonical value the design system reads off a work-state chip',
  'tocamp': 'the second half of data-addlist, read off the same element by its handler',
  'fillat': 'where the hole is in the sentence data-fill hands over, read off the same element by its handler',
  'card': 'which person a queue card is about, read by the keyboard cursor, not by a click',
  'auto': 'the derived list name, compared against by the name field so it knows when you disagreed',
  'ntf-id': 'the task id AiMY QA\'s panel writes on each row for its own bookkeeping',
  'state': 'the pipeline row mark remembers which glyph it holds, so a frame that changes nothing redraws nothing',
  'done': 'the pipeline footer remembers whether it has flipped to its finished verbs',
  'chat-rename-in': 'which conversation the rename box is renaming, read by the keydown and focusout listeners that commit it',
  'find': 'the find box, read by an input listener rather than a click',
  'load': 'whether the surface is still standing behind its skeleton, read by bdr.css rather than by a click; arrive() writes it and the next prePaint takes it off',
  'acc-open': 'whether an accordion is open, read by talent.css; data-acc-toggle flips it',
  'text': 'the shimmer copies its own words from here in CSS (content: attr(data-text))',
  'ed': 'which field of the edit buffer a box writes, read by the input listener',
  'in': 'which field of the CV intake a box writes, read by the input listener',
  'drn': 'which must-have a debrief note is about, read by the input listener',
  'find-q': 'the finder’s brief, read by the input listener',
  'aed': 'the assessment title box, read by the input listener',
  'qed': 'which question a box rewrites, read by the input listener',
  'qopt': 'which option of which question a box rewrites, read by the input listener',
  'qpts': 'the points an open answer should cover, read by the input listener',
  'anstext': 'an open answer on the test, read by the input listener',
  'tpled': 'which agenda item a box rewrites, read by the input listener',
  'apply-in': 'which field of the careers-page form a box writes, read by the input listener',
  'me-in': 'which detail a profile box holds; Save reads the boxes by id',
  'cv-file': 'the CV file box, read by the change listener',
  'apply-file': 'the careers-page CV box, read by the change listener',
  'el-file': 'the recording box on a call made elsewhere, read by the change listener',
  'dr-text': 'the message draft in the chat, read by the input listener',
  'crit-ed': 'which criterion a Find box rewrites, read by the input listener',
  'find-reqq': 'the requisition picker’s search box on Find, read by the input listener',
  'menu-q': 'the search box inside a picker menu, read by the input and keydown listeners',
  due: 'the held WhatsApp reply’s countdown (text and bar), updated each second by waTick',
};

/* ── 1 & 2. CONTROLS AND HANDLERS, BOTH DIRECTIONS ───────────────────────── */
const handlers = new Set();
let m;
const HANDLER_RE = /(?:closest|at)\('\[data-([a-z0-9-]+)\]'\)/g;
while ((m = HANDLER_RE.exec(JS))) handlers.add(m[1]);

const drawn = new Set();
const DRAWN_RE = /\bdata-([a-z0-9-]+)\s*(?==|["'\s>])/g;
[HTML, JS].forEach((src) => {
  let x;
  const re = new RegExp(DRAWN_RE.source, 'g');
  while ((x = re.exec(src))) drawn.add(x[1]);
});

drawn.forEach((v) => {
  if (handlers.has(v) || MARKERS[v]) return;
  fail('1 drawn-not-wired', 'data-' + v + ' is rendered and nothing handles it');
});
handlers.forEach((v) => {
  if (drawn.has(v)) return;
  fail('2 wired-not-drawn', 'the router handles data-' + v + ' and nothing renders it');
});

/* ── 3. EVERY CLASS USED IS A CLASS DEFINED ──────────────────────────────── */
const defined = new Set();
const SEL_RE = /\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g;
[CSS, BDR, DS, SALES].forEach((src) => {
  /* Selectors only: strip declaration blocks first, or `.5s` and decimal
     values in `transform: scale(.98)` register as class names.

     ══ AND COMMENTS FIRST OF ALL ════════════════════════════════════════
     Check 4 has stripped them since it was written, for exactly this reason,
     and this one never did. A stylesheet that explains itself by NAMING the
     rules it no longer has — "`.b-qcard-why` stood here" — was handing this
     scan a definition for a class the file does not define, so a rule
     deleted out from under four live call sites passed green. The prose is
     not the stylesheet. */
  const selectors = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{[^{}]*\}/g, '{}');
  let x;
  const re = new RegExp(SEL_RE.source, 'g');
  while ((x = re.exec(selectors))) defined.add(x[1]);
});

const used = new Map();
let skipped = 0;
const CLASS_RE = /class="([^"]*)"/g;
[['index.html', HTML], ['assets/talent.js', JS]].forEach((pair) => {
  let x;
  const re = new RegExp(CLASS_RE.source, 'g');
  while ((x = re.exec(pair[1]))) {
    /* A class list built by concatenation — `class="' + cls + '"` — is not a
       list of class names, and splitting it on whitespace yields fragments of
       the expression. `cls`, `k` and `0` were all reported as undefined
       classes on the first run of this check. The whole attribute is skipped
       and counted, so the report says how much it could not see rather than
       inventing findings out of the parts it misread. */
    if (/['"`+]|\$\{/.test(x[1])) { skipped++; continue; }
    x[1].split(/\s+/).forEach((c) => {
      if (!c || /[^A-Za-z0-9_-]/.test(c)) return;
      if (!used.has(c)) used.set(c, pair[0]);
    });
  }
});
used.forEach((where, c) => {
  if (defined.has(c)) return;
  fail('3 class-undefined', '.' + c + ' is used in ' + where + ' and defined nowhere');
});

/* ── 4. EVERY RULE THIS BUILD DEFINES IS A RULE IT USES ──────────────────── */
/* EVERY rule in bdr.css, not just the `b-` prefixed ones. The first cut only
   looked at `.b-*`, so six `.rail-nav*` rules — named to sit with the shell's
   own `.rail-*` family — were defined, never checked, and would have gone on
   being unused without a word. This file is small and entirely this build's:
   if a rule is in it and nothing renders it, that is a finding whatever it is
   called. The library overrides pass because the shell renders them. */
const mineDefined = new Set();
{
  /* Comments out FIRST. This file explains itself by naming the rules it is
     not duplicating — `.s-queue`, `.s-camp-row` — and a scan that reads prose
     as selectors reports those as unused rules that were never rules. */
  const selectors = CSS.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{[^{}]*\}/g, '{}');
  let x;
  const re = /\.([A-Za-z][A-Za-z0-9_-]*)/g;
  while ((x = re.exec(selectors))) mineDefined.add(x[1]);
}
mineDefined.forEach((c) => {
  if (HTML.indexOf(c) >= 0 || JS.indexOf(c) >= 0) return;
  fail('4 rule-unused', '.' + c + ' is defined in talent.css and rendered nowhere');
});

/* ── 5. BRACES BALANCE ───────────────────────────────────────────────────
   A stray closing brace ends the stylesheet's outermost block early, and
   every rule after it is silently discarded. The V3 build's CSS audit never
   checked this and reported green through exactly that. Counted outside
   strings and comments, and reported with the line the imbalance reaches.

   A stray close marker does the same damage by another route, and this file
   was blind to it in the same way. Splicing a paragraph into a block that
   already carried its close leaves the new prose OUTSIDE the comment, as CSS
   nobody wrote, and the rule under it never parses. Worse here than
   anywhere: checks 3 and 4 strip comments before they scan, so a broken
   comment quietly changes what they are looking at and they go green on it.
   That is not hypothetical — this check exists because it happened, to a
   sentence that was itself about comments closing early.

   Walked rather than counted. A comment naming the open marker is common in
   a file that explains its own rules, and counting would call that an
   imbalance; the walk sees it for what it is, because CSS comments do not
   nest. Two failures, and they are different: a close with nothing open has
   put prose into the sheet, and an open with no close has eaten the rest of
   the file.

   What this cannot see: an open marker halfway down that the NEXT comment's
   close swallows. Structurally that is one long comment and it is exactly
   what a long comment looks like, so nothing here can tell them apart. Its
   fingerprint is check 4's count of rules this build defines, which drops by
   however many the comment ate. Watch that number after a CSS edit; it moves
   for a reason or it does not move. */
{
  let i = 0, line = 1, openAt = -1, strayAt = 0;
  while (i < CSS.length) {
    const two = CSS[i] + CSS[i + 1];
    if (CSS[i] === '\n') line++;
    if (openAt < 0) {
      if (two === '/*') { openAt = line; i += 2; continue; }
      if (two === '*/' && !strayAt) strayAt = line;
    } else if (two === '*/') { openAt = -1; i += 2; continue; }
    i++;
  }
  if (strayAt) {
    fail('5 comments', 'talent.css closes a comment that was never opened, at line ' +
      strayAt + ' — everything between it and the block above is CSS nobody wrote');
  }
  if (openAt >= 0) {
    fail('5 comments', 'talent.css opens a comment at line ' + openAt +
      ' and never closes it — every rule after it is gone');
  }
}
{
  const stripped = CSS.replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '));
  let depth = 0, line = 1, worstLine = 0;
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch === '\n') line++;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth < 0 && !worstLine) worstLine = line; }
  }
  if (depth !== 0) {
    fail('5 braces', 'talent.css is ' + Math.abs(depth) + ' brace(s) ' +
      (depth > 0 ? 'short of closing' : 'over-closed, first at line ' + worstLine));
  }
}

/* ── 6. BANNED PATTERNS ──────────────────────────────────────────────────
   Each one is a rule from the design system with a reason attached, and each
   is invisible in review once it is one line among a thousand. */
const BANNED = [
  [/<select\b/i, 'a native <select> — the design system has one select control and this is not it'],
  [/\son[a-z]+\s*=\s*["']/i, 'an inline event handler attribute — blocked under a strict CSP, and unfindable'],
  [/transition:\s*all\b/i, 'transition: all — it animates properties nobody chose, including layout ones'],
  [/\bdraggable\s*=/i, 'drag and drop — not an interaction this product offers'],
];
[['index.html', HTML], ['assets/talent.js', JS], ['assets/talent.css', CSS]].forEach((pair) => {
  BANNED.forEach((b) => {
    if (b[0].test(pair[1])) fail('6 banned', pair[0] + ' contains ' + b[1]);
  });
});

/* ── 7. LINE ENDINGS ARE UNIFORM PER FILE ────────────────────────────────
   Not a style question. This repo checks out CRLF, and a tool that rewrites
   part of a file with LF leaves a mix that git normalises away on commit — so
   the diff is clean and the file on disk is not. Uniform either way passes;
   mixed does not. */
['index.html', 'assets/talent.js', 'assets/talent.css', 'assets/audit.js'].forEach((p) => {
  const s = read(p);
  const crlf = (s.match(/\r\n/g) || []).length;
  const lf = (s.match(/\n/g) || []).length - crlf;
  if (crlf && lf) fail('7 line-endings', p + ' mixes ' + crlf + ' CRLF and ' + lf + ' LF endings');
});

/* ── Report ──────────────────────────────────────────────────────────────── */
notes.push('handlers ' + handlers.size + ' · controls ' + drawn.size +
  ' · classes used ' + used.size + ' · rules this build defines ' + mineDefined.size);

if (fails.length) {
  console.error('AUDIT FAILED — ' + fails.length + '\n');
  fails.forEach((f) => console.error('  ' + f));
  console.error('\n' + notes.join('\n'));
  process.exit(1);
}
console.log('audit green — ' + notes.join(' · '));

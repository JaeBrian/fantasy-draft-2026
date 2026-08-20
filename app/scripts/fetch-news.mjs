/* Run from app/:  node scripts/fetch-news.mjs
 *
 * Sleeper carries a per-player news feed at
 *   https://api.sleeper.com/players/nfl/{player_id}/news?limit=N
 * — undocumented, no key, RotoWire and RotoBaller wire copy. We were not using it.
 *
 * Why it matters more than it looks: Sleeper's SEASON projections are frozen. Pulling them
 * on Aug 17 and again on Aug 19 moved exactly zero players by even 0.25 pts/wk. ADP drifts a
 * little, injury flags flip occasionally, but the projection — the number the whole advisor
 * is built on — does not respond to anything that happens in August. So between now and the
 * draft, the wire is the ONLY input that actually changes. Reading it is not a nicety.
 *
 * The one that prompted this: on Aug 10 Chargers OC Mike McDaniel said he would use a
 * "hot hand" approach at running back. Omarion Hampton's ADP (12.5) never moved. A projection
 * that assumes a workhorse and a coach who has said out loud that he will not use one are
 * two different bets, and only one of them was on the board.
 *
 * BUT: the feed's two outlets are not the same thing, and most of it is not worth reading.
 * RotoBaller is AI-assisted analysis and it shows — one Hampton item opens "Los ngeles
 * Chargers", and the same outlet called him "the clear lead back" on Aug 5 and "workload
 * uncertainty" on Aug 15. RotoWire briefs are mostly aggregation: they exist to relay what a
 * named beat reporter said. That is the distinction worth keeping.
 *
 *   RotoWire, Aug 10:   McDaniel "will likely use a hot hand approach", per Kris Rhim of ESPN
 *   RotoBaller, Aug 15: "Hampton's Redraft Value in Question"  <- someone's take, no source
 *
 * The first is a pointer to an ESPN beat reporter. The second is content. So we keep an item
 * only when it carries a PRIMARY ATTRIBUTION — a named reporter and outlet, or a direct quote
 * from someone in the building — and drop the rest. We are using this feed as an index of
 * other people's reporting, not as an opinion source.
 *
 * Then classify, conservatively. These are keyword rules over wire copy, not comprehension —
 * they raise a FLAG a human reads, never an input that silently moves a projection. Every tag
 * ships with the sentence that triggered it and the attribution, so the call can be checked. */
import { writeFileSync, readFileSync } from "node:fs";

const app = new URL("../", import.meta.url).pathname;
const dataTs = readFileSync(app + "src/data.ts", "utf8");
const board = new Set([...dataTs.matchAll(/^\["((?:[^"\\]|\\.)*)",/gm)].map((m) => m[1]));

const players = await (await fetch("https://api.sleeper.app/v1/players/nfl")).json();
const idOf = {};
for (const [pid, p] of Object.entries(players)) {
  const n = p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
  if (board.has(n) && !idOf[n]) idOf[n] = pid;
}
console.log(`board names: ${board.size}, matched to Sleeper ids: ${Object.keys(idOf).length}`);

/* ---- classification -------------------------------------------------------------------
 * Ordered by how much it should change your draft. The first pattern that hits wins, so
 * "out for the season" beats "expected to split carries" when a story says both. */
const RULES = [
  ["out",       /\b(torn (acl|achilles)|out for the season|season-ending|placed on (injured reserve|ir)\b|will miss the (season|year))/i],
  ["miss",      /\b(expected to miss|out (at least|approximately|roughly)? ?\d+ ?(week|month)|sidelined (for|approximately|about)|multi-week)/i],
  ["committee", /\b(hot hand|committee|timeshare|time-share|split (the )?(carries|touches|work|reps|backfield)|share (the )?(carries|touches|workload|backfield)|rotation at|by committee|1a\/1b|1a and 1b)/i],
  ["workload",  /\b(workload (uncertainty|in question|concerns?)|snap (share|count) (concerns?|questions?)|role (in question|uncertain)|touches? (in question|uncertain))/i],
  ["demoted",   /\b(demoted|lost the (starting|lead) (job|role)|dropped to (second|backup|the second)|behind .{0,24} on the depth chart|second-team)/i],
  ["promoted",  /\b(named the (starter|lead|primary)|won the (starting|lead) (job|role)|first-team reps|will start|takes over as)/i],
  ["hurt",      /\b(injur|sprain|strain|fracture|surgery|limited in practice|did not practice|dnp\b|carted off|left (practice|the game))/i],
  ["holdout",   /\b(hold(-| )?out|hold(-| )?in|contract dispute|has not reported|trade request)/i],
  ["suspended", /\b(suspend|suspension|banned for)/i],
  ["back",      /\b(returned to practice|activated|cleared to (play|practice)|full participant|removed from the injury report)/i],
  ["hype",      /\b(breakout|standout|turning heads|impressed|best (shape|camp)|praised|stood out|dominant|tone(-| )setting)/i],
];
/* Two guards, both learned the hard way. The first pass tagged J.K. Dobbins, Sam LaPorta and
 * RJ Harvey as out for the season — five of ten "out" tags were wrong. A false season-ending
 * flag during a live draft is worse than no flag, so the rules need to answer two questions
 * the keywords alone cannot:
 *
 *   1. IS IT NOW?  "suffering a season-ending foot injury" is about LAST year in a bio
 *      paragraph. Wire copy recaps constantly.
 *   2. IS IT HIM?  Purdy's item was tagged because it mentions Ricky Pearsall being out.
 *      Harvey's was tagged for Dobbins' injury. Items name other players all the time. */
const HISTORICAL =
  /\b(last (season|year)|in 202[45]|202[45] (season|campaign)|his rookie (season|year)|previous season|a year ago|back in|in \d+ (career )?games|career (high|total|average)|has averaged)\b/i;

/* The worst failure mode is not a missing flag, it is an INVERTED one. "Not expected to miss
 * much, if any, practice time" is good news, and the first pass filed it under `miss`.
 * "Not expected to face additional suspension" became `suspended`. If the words just before
 * the trigger negate it, the flag means the opposite of what it says — drop it. */
const NEGATED = /\b(not|isn't|is not|won't|will not|no longer|never|avoided|avoid|unlikely to|doesn't|does not|denied|dispelled|shot down|downplayed)\b[^.]{0,40}$/i;

const tagOf = (text, subject, others) => {
  const surname = subject.split(/\s+/).pop().replace(/[^\w']/g, "");
  for (const [tag, re] of RULES) {
    const m = re.exec(text);
    if (!m) continue;
    /* the sentence that fired — that is the unit we judge, not the whole item */
    const i = m.index;
    const s = Math.max(0, text.lastIndexOf(".", i) + 1);
    let e = text.indexOf(".", i + m[0].length);
    if (e < 0) e = text.length;
    const sent = text.slice(s, e + 1).replace(/\s+/g, " ").trim();

    /* guard 1 — a recap of a past season is not news */
    if (HISTORICAL.test(sent)) continue;

    /* guard 1b — negation flips the meaning; better no flag than a backwards one */
    if (NEGATED.test(text.slice(s, i))) continue;

    /* guard 1c — an injury being RECOVERED FROM is not an injury being suffered. Two of these
     * shipped before the guard covered both severities:
     *   Charbonnet, "in a close race to return for Week 1 as he recovers from a torn ACL"
     *     -> filed as out for the season
     *   Makai Lemon, "after being sidelined for more than two weeks ... will get his first
     *     taste of NFL competition" -> filed as about to miss three weeks, on a story about
     *     him coming BACK
     * The tell is always the same: a duration in the past tense next to a return.
     *
     * Keep the pattern SPECIFIC. An earlier draft included a bare "after being", which reads
     * the recovery in "after being sidelined ... will get his first taste" but also reads it
     * in "sidelined for at least a month AFTER BEING DIAGNOSED with a sprained MCL" — and
     * quietly downgraded Alvin Kamara's month on the shelf to a camp knock. A diagnosis is not
     * a comeback. The Lemon story is still caught, by "first taste" and "practicing". */
    if ((tag === "out" || tag === "miss") &&
        /\b(return(s|ing|ed)?|recover(s|ing|y|ed)?|cleared|rehab|comeback|(way |is |be )?back (by|for|from)|expected back|continues to|offseason surgery|physically unable|first taste|practicing|limited participant|full participant|activated)\b/i.test(sent)) continue;

    /* guard 1d — a ROLE claim has to be reported, not speculated. Jordan Mason was tagged as
     * being in a committee by a sentence reading "37 RB in RotoBaller's rankings, but ... the
     * potential to outperform that rating IF HE CAN CLAIM a larger portion of the timeshare".
     * That is a ranking blurb wondering aloud, not a coach describing a plan, and it reached
     * the board because a name elsewhere in the item cleared the attribution gate.
     *
     * Availability tags are left alone: "expected to miss" is exactly how a real report of an
     * absence is worded, and stripping conditionals there would throw away the good ones. */
    if (["committee", "workload", "demoted", "promoted"].includes(tag)) {
      if (/\b(if he|if they|could|potential to|projected|may |might |should he|assuming|hopes to|looking to|in line to compete|ranking|rankings|draft(ing)? (him|target)|fantasy managers)\b/i.test(sent)) continue;
      /* and the aggregator quoting its own product is not reporting */
      if (/\b(rotoballer|rotowire)\b/i.test(sent)) continue;
    }

    /* guard 2 — whose injury is it? Presence is not enough: "Harvey took on a bigger role
       after Dobbins' season-ending foot injury" names Harvey. Go by PROXIMITY — whichever
       player is named nearest the trigger owns it. */
    const hit = i - s;                                   // trigger position within the sentence
    const near = (re) => {
      let best = Infinity, mm;
      const g = new RegExp(re, "gi");
      while ((mm = g.exec(sent))) best = Math.min(best, Math.abs(mm.index - hit));
      return best;
    };
    const mine = Math.min(near(`\\b${surname}\\b`), near(`\\bhe\\b|\\bhis\\b|\\bhim\\b`) + 12);
    let theirs = Infinity;
    /* only test the capitalised tokens actually present — not all ~1,100 names */
    for (const m2 of sent.matchAll(/\b[A-Z][\w'-]{3,}\b/g)) {
      const tok = m2[0];
      if (tok === surname || !others.has(tok)) continue;
      theirs = Math.min(theirs, Math.abs(m2.index - hit));
    }
    if (theirs < mine) continue;                         // the sentence is about someone else
    if (mine === Infinity) continue;                     // nobody identifiable — do not guess
    return [tag, sent];
  }
  return [null, null];
};

/* ---- attribution ----------------------------------------------------------------------
 * Keep an item only if it points at a primary source. Two ways that happens:
 *   1. a named reporter and outlet   "Kris Rhim of ESPN.com reports" / "ESPN's Kris Rhim"
 *   2. a direct quote from someone in the building, in quotation marks with a said-verb
 * Everything else is somebody's ranking, and we already have our own. */
const OUTLET =
  "ESPN|NFL\\.com|NFL Network|The Athletic|Yahoo|CBS Sports|Pro Football Talk|ProFootballTalk|" +
  "PFT|Sports Illustrated|SI\\.com|The Times|Post|Tribune|Chronicle|Herald|Globe|News|Gazette|" +
  "Star|Journal|Inquirer|Dispatch|Beat|Athletic|Associated Press|AP|Reuters|Bleacher Report|" +
  "The Score|theScore|USA Today|Fox Sports|NBC Sports|Sportsnet|MMQB|SB Nation|Bolt|" +
  "[A-Z][A-Za-z]*\\.com|[A-Z][A-Za-z]* Radio|KPRC|WFAN|WEEI|670|97\\.1";
const ATTRIB = [
  /* "Kris Rhim of ESPN.com reports"  /  "per Kris Rhim of ESPN" */
  new RegExp(`\\b([A-Z][\\w'.-]+(?: [A-Z][\\w'.-]+){1,2}) of (?:the )?(${OUTLET})`),
  /* "ESPN's Kris Rhim" */
  new RegExp(`\\b((?:the )?(?:${OUTLET}))'s ([A-Z][\\w'.-]+(?: [A-Z][\\w'.-]+){1,2})`),
  /* "according to Alex Insdorf" / "per Adam Schefter" */
  /\b(?:according to|per)\s+([A-Z][\w'.-]+(?: [A-Z][\w'.-]+){1,2})\b/,
  /* named insiders stand on their own */
  /\b(Adam Schefter|Ian Rapoport|Tom Pelissero|Mike Garafolo|Jeremy Fowler|Dianna Russini|Albert Breer|Jordan Schultz)\b/,
];

/* Who these people actually work for. The generic "<Name> of <Outlet>" rule reads whichever
 * outlet sits next to the name, and wire copy loves "Ian Rapoport of ESPN and NFL Network",
 * which produced "Ian Rapoport, ESPN" — a real journalist filed under the wrong employer.
 * Since we print the attribution as provenance, get it right. */
const INSIDER_OUTLET = {
  "Adam Schefter": "ESPN",
  "Ian Rapoport": "NFL Network",
  "Tom Pelissero": "NFL Network",
  "Mike Garafolo": "NFL Network",
  "Jeremy Fowler": "ESPN",
  "Dianna Russini": "The Athletic",
  "Albert Breer": "Sports Illustrated",
  "Jordan Schultz": "Fox Sports",
};
/* a real quote: quotation marks near a said-verb from a person, not a paraphrase */
const QUOTED = /"[^"]{25,}"[^.]{0,80}\b(said|told|says|explained|added|noted)\b|\b(said|told)\b[^.]{0,60}"[^"]{25,}"/i;

/* words that look like a name to a regex but are a job title or a sentence start */
const NOTNAME = /^(Head|Coach|The|His|New|NFL|Insider|Sources?|Reports?|General|Assistant|Offensive|Defensive|Senior|According)\b/;
const clean = (s) => {
  let t = (s || "").trim();
  /* a sentence boundary inside the capture means the regex ran past the name — cut there.
     "James Boyd. According" and "Henderson. Chad Graff" both came out of this. */
  const dot = t.search(/\.\s+[A-Z]/);
  if (dot > 0) t = t.slice(0, dot);
  return t
    .replace(/[.,;:]+$/, "")
    .split(/\s+/).slice(0, 3).join(" ")
    .replace(/\b(Head|Coach|The|There)$/, "")
    .replace(/[.,;:]+$/, "")
    .trim();
};

const attribOf = (text) => {
  for (const re of ATTRIB) {
    const m = re.exec(text);
    if (!m) continue;
    /* rule 2 puts the outlet first; normalise to "Name, Outlet" either way */
    let a = clean(m[1]), b = clean(m[2]);
    if (NOTNAME.test(a) && !b) continue;              // "NFL Insider Adam" — not a name
    if (a && NOTNAME.test(a) && b) a = "";
    if (!b) return NOTNAME.test(a) ? null : (INSIDER_OUTLET[a] ? `${a}, ${INSIDER_OUTLET[a]}` : a);
    if (!a) return b;
    const [name, outlet] = /^[A-Z][\w'.-]+ [A-Z]/.test(a) ? [a, b] : [b, a];
    /* a known insider's employer is a fact, not something to read off the sentence */
    return `${name}, ${INSIDER_OUTLET[name] ?? outlet}`;
  }
  return QUOTED.test(text) ? "direct quote" : null;
};

const LIMIT = 6;
const DAYS = 60;
const cutoff = Date.parse("2026-08-19T00:00:00Z") - DAYS * 864e5;

const entries = Object.entries(idOf);
/* Surnames the wire might mention — used to decide WHOSE injury a sentence describes.
 * Not just the board: the player who steals a headline is often the one just off it. */
const OTHERS = new Set();
for (const p of Object.values(players)) {
  if (!["QB", "RB", "WR", "TE"].includes(p.position) || !p.team || !p.active) continue;
  const sn = (p.last_name || "").replace(/[^\w'-]/g, "");
  if (sn.length >= 4) OTHERS.add(sn);
}
for (const n of board) {
  const sn = n.split(/\s+/).pop().replace(/[^\w'-]/g, "");
  if (sn.length >= 4) OTHERS.add(sn);
}
console.log(`cross-reference surnames: ${OTHERS.size}`);
const out = {};
let done = 0, withNews = 0, errs = 0, seen = 0, dropped = 0;

/* polite: six at a time, a beat between waves */
const CONC = 6;
for (let i = 0; i < entries.length; i += CONC) {
  await Promise.all(entries.slice(i, i + CONC).map(async ([name, pid]) => {
    try {
      const r = await fetch(`https://api.sleeper.com/players/nfl/${pid}/news?limit=${LIMIT}`,
        { signal: AbortSignal.timeout(15000) });
      if (!r.ok) return;
      const items = await r.json();
      if (!Array.isArray(items) || !items.length) return;
      const keep = [];
      for (const it of items) {
        const m = it.metadata || {};
        const ts = Number(it.published || it.created || 0);
        if (!ts || ts < cutoff) continue;
        const title = (m.title || "").replace(/\s+/g, " ").trim();
        const desc = (m.description || "").replace(/\s+/g, " ").trim();
        const text = `${title}. ${desc}`;

        /* the gate: no primary source, no entry. Most of what the feed carries is somebody's
           ranking or take, and we are not short of those. */
        const who = attribOf(text);
        seen++;
        if (!who) { dropped++; continue; }

        const [tag, quote] = tagOf(text, name, OTHERS);
        keep.push({
          t: Math.round(ts / 1000),
          s: it.source || "",
          h: title.slice(0, 130),
          /* the trigger sentence if a rule fired, else the opening of the item */
          d: (quote || desc).slice(0, 260),
          a: who.slice(0, 60),
          ...(tag ? { g: tag } : {}),
        });
      }
      if (keep.length) {
        keep.sort((a, b) => b.t - a.t);
        out[name] = keep.slice(0, 3);
        withNews++;
      }
    } catch { errs++; }
    finally { if (++done % 40 === 0) console.log(`  ${done}/${entries.length}`); }
  }));
  await new Promise((r) => setTimeout(r, 120));
}

const TAGS = {};
for (const arr of Object.values(out)) for (const n of arr) if (n.g) TAGS[n.g] = (TAGS[n.g] || 0) + 1;

const ts = `/* GENERATED by scripts/fetch-news.mjs — do not edit by hand.
 * Sleeper's per-player news feed, last ${DAYS} days, three most recent items per player,
 * pulled ${new Date().toISOString().slice(0, 10)}.
 *
 * FILTERED to items that trace back to a primary source: a named reporter and outlet, or a
 * direct quote from someone in the building. The feed's own analysis is discarded — it is
 * AI-assisted and unreliable (one item shipped reading "Los ngeles Chargers", and the same
 * outlet called a back "the clear lead back" and "workload uncertainty" ten days apart). We
 * use this feed as an INDEX OF OTHER PEOPLE'S REPORTING, not as an opinion source.
 *
 *   a = who reported it   g = keyword tag   d = the sentence that triggered the tag
 *
 * A tag is a flag for a human to read. It never silently moves a projection. */
export type NewsItem = { t: number; s: string; h: string; d: string; a: string; g?: string };
export const NEWS: Record<string, NewsItem[]> = ${JSON.stringify(out)};
`;
writeFileSync(app + "src/news.ts", ts);
console.log(`\nwrote src/news.ts — ${withNews} players with sourced news, ${errs} errors, ${(ts.length / 1024).toFixed(0)} KB`);
console.log(`attribution gate: kept ${seen - dropped}/${seen} items, dropped ${dropped} unsourced (${(100 * dropped / Math.max(1, seen)).toFixed(0)}%)`);
console.log("tags:", Object.entries(TAGS).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join("  "));

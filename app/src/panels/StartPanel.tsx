import { Card, Eyebrow, Intro, KV, Noob, Call } from "../components/ui";

const RULES: [string, string][] = [
  ["Two RBs by end of round 3.", "The market agrees this year: ~7 of the first 12 picks are RBs, and the position falls off a cliff by round 4. Half-PPR makes RBs even more valuable."],
  ["Hammer WR in rounds 4–7.", "That's the \"RB dead zone\" — RBs there are committee traps. The WR value (DeVonta Smith, Egbuka, McConkey, DJ Moore) lives exactly there."],
  ["One quarterback plan: Allen early or wait.", "Josh Allen is worth round 3 if he slides. Otherwise wait — Lamar in round 5 is a value, and Kyler Murray / Bo Nix / Purdy in rounds 9–11 get you 90% of a stud for a fraction of the cost."],
  ["Tight end: pay for the top two or be patient.", "Bowers/McBride in round 2 is defensible. Otherwise Loveland or Tyler Warren in rounds 4–6 — or punt fully to Isaiah Likely / Kittle late. Never draft the middle TE tier at cost (Fannin, Andrews, Kelce are all overpriced)."],
  ["Respect the landmines.", "Puka's pending suspension ruling, Jacobs' open felony case, Achane's injury profile, CMC's age-30 workload. Every one is fine at a discount — none at full price. See the Do Not Draft tab."],
  ["Break ties with the playoff schedule.", "You win money in Weeks 15–17. Vegas says Cowboys, Bills, Bengals players spike then; Eagles, 49ers, Seahawks players sag. Tiebreaker, not a reason to reach."],
  ["K and DST with your last two picks. Always.", "The gap between the 3rd and 12th best kicker last year was 43 points all season. Spend those rounds on upside instead."],
];

const VALUES: [string, string][] = [
  ["Justin Jefferson", "Top-7 targets, league-worst TD luck, real QB now. Priced 11th; top-5 profile."],
  ["Kenneth Walker III", "Super Bowl MVP, paid bellcow money by KC — market still asleep."],
  ["A.J. Brown", "Traded to the #2 scoring offense (Patriots, Drake Maye)."],
  ["DJ Moore", "Vegas's #2 offense, priced like a WR27."],
  ["Tyler Warren", "Vegas set his catch line at 74.5 — huge for a TE going round 6."],
  ["Kyler Murray", "Named Vikings starter Aug 11; still priced QB18. The late-QB steal."],
  ["Jordan Mason", "Quietly winning Minnesota's RB job; costs a 7th–8th."],
  ["Stefon Diggs", "Signed with Washington Aug 5; ADP hasn't caught up."],
];

const MORNING_OF: [string, string][] = [
  ["Puka Nacua", "NFL suspension ruling pending (could be 0–several games)."],
  ["Jeremiyah Love", "High-ankle sprain Aug 16 — Week 1 in doubt."],
  ["Josh Jacobs", "Felony case open; NFL reviewing. Suspension could land mid-season."],
  ["Christian McCaffrey", "Camp \"tightness\" — same word that preceded his lost 2024."],
  ["Malik Nabers", "Knee rehab trending up; confirm he's practicing fully."],
  ["George Kittle", "Aggressive Achilles timeline for Week 1."],
  ["MIN / ARI / CLE / MIA QBs", "Murray reportedly named MIN starter; the other three are open battles."],
];

const GLOSSARY_A: [string, string][] = [
  ["Bellcow / workhorse", "A running back who gets almost all of his team's carries AND catches. The most valuable thing in fantasy — there are only ~10 of them."],
  ["Committee / timeshare", "The opposite: 2–3 RBs splitting the work. Splits kill fantasy value — you never know who gets the good week."],
  ["Target", "A pass thrown a player's way, catch or not. Targets measure how much an offense feeds someone — the best predictor of future catches."],
  ["Target share (\"28% share\")", "The percent of his team's passes thrown at him. 20% is good, 25% is elite, 30%+ is historic. \"44% of Seattle's passing yards\" = nearly half their air offense went through one man."],
  ["Expected TDs (\"3 TDs on 6.6 expected\")", "A model counts a player's scoring chances (like catches near the goal line) and says how many TDs an average player scores on those chances. Scoring way UNDER it = he was unlucky, bet on more next year. Way OVER = lucky, bet on fewer."],
  ["TD regression / bounce-back", "The follow-through on that math: \"regression\" = his touchdowns should drop; \"bounce-back\" = they should recover."],
  ["ADP", "Average Draft Position — the pick where the crowd usually takes a player. It's the \"market price.\""],
  ["Reach / value", "Drafting someone well before his ADP = a reach. Getting him after = a value."],
  ["Snake draft", "The order reverses every round (1→12, then 12→1) so the person picking last gets two picks back-to-back \"at the turn.\""],
  ["Half-PPR", "Point Per Reception, halved: every catch = 0.5 points, plus the normal yardage/TD points. Full-PPR = 1 point per catch; standard = 0."],
  ["Flex", "A lineup spot that accepts an RB, WR, or TE — your best leftover starter."],
  ["Tier / tier cliff", "A group of players of similar value; the \"cliff\" is the drop to the next group. Draft the last man in a tier, not the first man of the next one."],
  ["RB dead zone", "Rounds ~4–7 this year, where every RB left is a committee guy or injury risk. Buying RBs there is how drafts are lost."],
];

const GLOSSARY_B: [string, string][] = [
  ["Handcuff", "The direct backup to a star RB. If the star gets hurt, the handcuff inherits the whole job — insurance for one roster spot."],
  ["Sleeper / breakout / bust", "Sleeper = cheap player who could massively outperform. Breakout = young player about to jump a level. Bust = expensive player about to disappoint."],
  ["Floor / ceiling", "Floor = his realistic bad outcome; ceiling = his realistic great one. \"High floor\" = safe. \"High ceiling\" = can win you the league. Boom-bust = huge weeks AND dud weeks."],
  ["Red zone / goal line", "Inside the opponent's 20-yard line / 5-yard line. Whoever gets the ball there scores the TDs — it's where fantasy points concentrate."],
  ["Game script", "How a game's score shapes play-calling: teams ahead run (good for RBs), teams behind throw (good for WRs). Vegas lines predict it."],
  ["Implied team total", "How many points Vegas expects a team to score in a game (or per game). More team points = more TDs to go around for your players."],
  ["Stack", "Drafting a QB plus his own receiver — when they connect for a TD, you get paid twice."],
  ["Streaming", "Not committing to one K/DST/QB — instead grabbing whoever has the best matchup each week off waivers."],
  ["Waiver wire", "The pool of undrafted players you can add during the season. Where leagues are won in September."],
  ["Bye week", "Each NFL team's one off-week. Your player scores zero that week — don't draft five starters with the same bye."],
  ["Snap / opportunity share", "Percent of the team's plays a player is on the field for, and the percent of the backfield's carries+targets he gets. Usage = opportunity = points."],
  ["PPG", "Fantasy points per game — the fairest way to compare players who missed time."],
  ["IR slot", "A bonus bench spot only for players officially out injured — lets you stash a hurt player (like Jordyn Tyson) without burning a real bench spot."],
  ["Alpha / WR1", "\"Alpha\" = the clear No. 1 receiver on his own team. \"Fantasy WR1\" = a top-12 receiver in fantasy scoring. A team alpha isn't always a fantasy WR1."],
];

export function StartPanel({ noob }: { noob: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <Intro eyebrow="The one-minute version" title="It's a running back year. Leave the first three rounds with two of them.">
        This guide merges twelve research streams — current expert rankings (ESPN, FantasyPros, CBS, PFF, NBC), live ADP
        from 4for4's Underdog tool (713 players, pulled today), Vegas win totals &amp; player props, TD-regression models,
        injury models, beat-writer camp reports, and BDGE's Aug 11 tier video — into one board tuned for a 12-team
        half-PPR league.
      </Intro>

      <Noob show={noob} title="New to fantasy? Read this first.">
        <ul className="mt-1.5 mb-0.5 list-disc space-y-1 pl-5">
          <li><b>The draft:</b> 12 people take turns picking real NFL players. The order snakes — if you pick 3rd in round 1, you pick 10th in round 2. Each player can only be on one team.</li>
          <li><b>Scoring:</b> your players earn points for real-life yards and touchdowns. "Half-PPR" means each catch is worth an extra half point — so runners who also catch passes are gold.</li>
          <li><b>Positions:</b> QB throws, RB runs, WR catches, TE is a big catcher, K kicks, DST is a whole defense. <b>Your league starts:</b> 1 QB, 2 RB, 2 WR, 1 TE, 2 flex (RB/WR/TE), 1 K, 1 DST — plus 6 bench spots and 1 IR slot. That means SEVEN of your nine skill starters are RB/WR/TE.</li>
          <li><b>ADP</b> = Average Draft Position — where the crowd usually picks a player. Taking a player well <i>before</i> his ADP is a "reach"; getting him after is a "value."</li>
          <li><b>Tiers:</b> players grouped by similar value. The trick: when a tier is almost empty, grab the last guy in it — don't start the next tier early.</li>
          <li><b>Confused by a term anywhere in this guide?</b> There's a full plain-English glossary at the bottom of this page.</li>
        </ul>
      </Noob>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <Eyebrow>Seven rules for this draft</Eyebrow>
          <ol className="m-0 list-none p-0">
            {RULES.map(([head, body], i) => (
              <li key={i} className="grid grid-cols-[36px_1fr] gap-x-3 border-b border-line-soft py-3 last:border-0">
                <span className="display row-span-2 flex h-8 w-8 items-center justify-center rounded border border-line bg-raised text-[1.05rem] font-semibold text-clock">
                  {i + 1}
                </span>
                <b className="col-start-2 text-ink">{head}</b>
                <span className="col-start-2 text-[0.92rem] text-ink-2">{body}</span>
              </li>
            ))}
          </ol>
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <Eyebrow>Best values on the board right now</Eyebrow>
            <KV rows={VALUES} />
          </Card>
          <Card>
            <Eyebrow>Check these the morning of your draft</Eyebrow>
            <KV rows={MORNING_OF} />
            <div className="mt-3.5 rounded bg-risky/10 px-3.5 py-2.5 text-[0.88rem] font-semibold text-risky">
              Everything here is as of Aug 17, 2026. Injury news moves fast in late August — re-verify the names above
              before you're on the clock.
            </div>
          </Card>
        </div>
      </div>

      <div className="card border-l-[3px] border-l-clock p-4.5">
        <b>How to actually use this at the table:</b> keep the <b>Big Board</b> tab open and cross names off as they're
        drafted. When you're on the clock, take the highest-ranked player left — unless a rule on the{" "}
        <b>Draft Plan</b> tab tells you otherwise (roster needs, tier cliffs, landmines). The chips tell you the story at
        a glance: <Call v="buy" /> take him a bit early, <Call v="solid" /> take at price, <Call v="risk" /> only at a
        discount, <Call v="avoid" /> let someone else deal with it.
      </div>

      <Card>
        <Eyebrow>Glossary — every term in this guide, in plain English</Eyebrow>
        <div className="grid grid-cols-1 gap-x-7 gap-y-2 lg:grid-cols-2">
          <KV rows={GLOSSARY_A} />
          <KV rows={GLOSSARY_B} />
        </div>
      </Card>
    </div>
  );
}

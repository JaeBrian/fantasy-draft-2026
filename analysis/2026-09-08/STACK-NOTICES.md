# Passing stacks and shared-team notices

QB/WR and QB/TE pairings receive a green Passing stack notice. A passing touchdown between the players scores for both when both are started. Other same-team pairings retain the amber roster-overlap notice. Mixed rosters show the relevant players separately: Higgins can form a passing stack with Burrow while also sharing an offense with an owned Chase Brown.

Research checked September 8, 2026: Tyler Huntington's September 3 [RotoWire analysis](https://www.rotowire.com/football/article/does-stacking-work-in-fantasy-football-what-four-years-of-data-say-about-drafting-correlated-players-2026-131409) examines 2022–25 weekly results in full-PPR redraft. It reports positive QB/receiver correlation, with more shared high and low weeks rather than additional expected season points. Our league uses half-PPR; this supports distinguishing the UI messages, not importing its numerical estimates into our model.

The existing early-roster stack tiebreaker remains 3%. No projection, ADP, covariance, ranking or simulation policy changes are included in this PR. The notice encourages considering the combination when draft value fits, and conditions its scoring benefit on starting both players.

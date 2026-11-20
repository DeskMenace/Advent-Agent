# What a season costs

**You decide the cost.** Your agent uses the model set in its own settings, and the model decides most of the cost: a larger or newer model can cost several times more for the same gift. The calendar never changes your agent's model. In setup and in Settings you choose a gift size (Light, Standard, Generous) and a spend limit: **No limit** (the default, for people who trust their agent) or an amount in dollars per gift.

**The numbers below are a snapshot, for information only.** They were measured between 8 and 10 November 2026, on Claude Code with Claude Sonnet 5.5 and Claude Opus 5.5, at the prices of those days. Models and prices change, and we do not re-measure. On 20 November 2026, Claude Code's default model on our machine had become a larger one, and the same work cost several times more.

Your agent uses its normal plan or billing; the calendar sends nothing anywhere else. Setup offers **Light, Standard** and **Generous**, which tell the agent to aim for gifts of tier S, M or L (December 1 and 24 get a bigger one, tier XL). The tiers are advisory (the agent is told, not stopped), except that Claude Code can enforce a dollar cap.

We measured real builds with the lab (`advent-agent lab`), on Claude Code with the default model, one gift at a time through the full workflow (brief, build, test, seal):

| Tier the agent used | Gifts measured | Typical cost per gift | Range |
|---|---|---|---|
| S (light) | 3 | about $0.55 | $0.44 – $0.95 |
| M (standard) | 8 | about $0.80 | $0.27 – $2.21 |
| L (generous) | 1 | $3.92 (one sample) | n/a |
| XL (December 24) | 1 | $1.20 (one sample) | n/a |

- **Per season, roughly:** about **$14** on Light, **$20** on Standard (22 daily gifts, Day 1 and December 24 at XL), plus about $0.13 for each list check (three in a season). Generous is not measured well enough to give a number; expect more, in the tens of dollars.
- **Tokens:** the same builds used a median of about 0.6 million tokens each on Claude Code and about 1.75 million on Codex. These counts include the agent re-reading its own context on every turn (mostly cheap cached reads), so they are far above the advisory 30k / 100k / 300k. Dollars are the better yardstick on API billing; on a subscription, expect each gift to use a noticeable slice of your usage limit, and a bigger slice on Generous.
- **How measured:** the usage and cost Claude Code reported for each run (Codex reports tokens only), in 19 real builds. Small samples; your agent, model and the ideas it picks change the numbers a lot. A smaller budget or model makes smaller gifts. You can change the budget in Settings at any time.

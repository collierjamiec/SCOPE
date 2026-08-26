# SCOPE AI intelligence and SE Ranking setup

This guide explains what SCOPE can observe itself, what requires an outside provider, how to configure useful prompts, and how to interpret competitor hypotheses without overstating certainty.

## The two evidence layers

SCOPE keeps two different questions separate:

1. **Is the content answer-ready?** A crawl can inspect the page's accessibility, structure, evidence, entities, intent coverage, freshness, and visual context. This is SCOPE AIO Answer Readiness.
2. **Did an AI system actually mention or cite it?** This requires dated observations from a monitoring provider, referral data, or another external source. SCOPE can import provider CSV files or optionally connect to SE Ranking's AI Results Tracker.

A high readiness score is not proof of an AI mention. A provider mention is not proof that a page is well written. The dashboard presents both without combining them into one misleading number.

## Native crawl signals

The crawl reports the following advanced signals on each eligible page:

- question-shaped headings followed by concise, extractable answers;
- explicit definitions and comparison structures;
- attributed and unattributed quotations;
- numerical claims, apparent original data, and vague claims that need specificity;
- recognizable primary-source links and citation markup;
- time-sensitive facts that may need dates or review;
- data-rich images with or without nearby explanatory context;
- entity names declared in structured data and possible sitewide naming variations;
- `Claim`, `Dataset`, and `citation` markup opportunities where visible content supports them;
- human-readability safeguards so answer optimization does not produce robotic copy.

These are structural observations. SCOPE cannot prove that a statistic is truly original merely because the page calls it “our research,” and it cannot verify hidden model-ranking factors.

## Connect SE Ranking

Open **AIO/AEO/GEO → Connect / sync SE Ranking API**.

1. Obtain an API key from the SE Ranking account that owns or can access the intended project.
2. Paste it into SCOPE and choose **Save locally & connect**.
3. Select the project whose AI Results Tracker configuration matches the site or brand being studied.
4. Confirm the target domain/brand, market context, start date, and end date.
5. Optionally retrieve answer, source, and mentioned-brand evidence for up to 100 prompts. A lower number is a good first sync.
6. Choose **Sync selected period**.

SCOPE reads the project's configured engines and prompts, their dated rankings/observations, and—when selected—answer text, sources, and brands. Full provider answer text may be available for a shorter retention period than aggregate visibility, so sync important evidence while it is available.

The API key is stored only on the installed device in `.scope/seranking.json` unless an administrator chooses another application-data path. It is owner-readable only, Git-ignored, replaceable, and removable. The secret is never stored in audit history or a report.

SCOPE does not silently call SE Ranking's credit-metered Data API. Competitive SEO imports remain available by CSV for Positions Detailed, Positions History, Competitors Overall, and Share of Voice reports.

## Configure the provider project first

Before syncing, review the project inside SE Ranking:

- **Brand:** use the exact organization or product being measured.
- **Aliases:** include real spelling, abbreviation, spacing, and legacy-name variants. Do not mix unrelated products into one brand.
- **Competitors:** add direct substitutes separately from publishers, directories, marketplaces, social networks, and reference sites.
- **Engines:** select the systems that matter to the audience. Use equivalent prompt sets when making engine-to-engine comparisons.
- **Market:** set the intended country, language, and region. A national English prompt set is not comparable to a local Spanish prompt set.
- **Schedule:** use a stable cadence. Record configuration changes because they can cause an apparent trend that is actually a measurement change.

## Design a useful prompt portfolio

Prompts should represent real decisions and questions. Do not create a hundred slight variations of the brand name.

| Prompt family | Business question | Example pattern |
| --- | --- | --- |
| Category discovery | Does the brand enter an unbranded consideration set? | What are the best `[category]` options for `[audience]`? |
| Problem / solution | Is the brand associated with the problem it solves? | How should I solve `[specific problem]`? |
| Comparison | How are alternatives positioned? | `[Option A]` vs `[Option B]` for `[use case]` |
| Trust / proof | Which claims and sources shape recommendations? | Is `[brand/category]` reliable for `[need]`? |
| Objection | What prevents a user from choosing? | What are the limitations or risks of `[solution]`? |
| Local / situational | Does visibility change with context? | Best `[service]` for `[location or situation]` |
| Decision stage | Does the brand appear in recommendations? | Which `[category]` should I choose if `[constraints]`? |
| Brand accuracy | Is the generated description correct? | What is `[brand]`, who is it for, and what does it do? |

A balanced set includes branded and non-branded prompts, informational and commercial intent, early and late funnel questions, major audiences, and important objections. Keep a stable core for trends. Label experimental prompts separately rather than silently replacing the baseline set.

## Competitor appearances and “likely why”

When answer evidence is available, SCOPE matches observed brands against the source domain's configured competitor list. Each prompt can show:

- whether the source brand was observed;
- which configured competitors were observed and in what order;
- whether a citation/source was observed;
- the provider and engine;
- the observation date;
- a rule-based hypothesis explaining the gap and what to verify next.

Typical hypotheses include:

- **Entity-association gap:** the competitor is associated with the problem/category while the source brand is absent.
- **Evidence/authority gap:** the answer or cited sources favor the competitor's proof, source coverage, or third-party validation.
- **Direct-answer/format gap:** the competing material appears to answer the prompt more directly or in a more extractable format.
- **Topical-depth gap:** the competitor covers definitions, alternatives, limitations, evidence, and follow-up needs more completely.
- **Freshness gap:** time-sensitive claims appear more current or clearly dated.
- **Competitive preference gap:** both brands appear, but the competitor is placed earlier.

These are investigative starting points. The model's internal cause is not visible.

## Hypothesis confidence

The confidence percentage refers to the strength of the diagnostic hypothesis—not the probability that a hidden ranking factor is causal.

- **0–39, low:** primarily a provider appearance or ordering observation; answer/source evidence or a comparable crawl is missing.
- **40–69, moderate:** answer text, source evidence, brand presence, or ordering supports the pattern, but important verification is still missing.
- **70–100, high:** multiple independent observed signals agree, such as both-brand ordering plus source evidence and relevant crawl differences.

SCOPE must lower confidence when the prompt set, engine, market, provider method, or date period is not comparable. An apparently precise score must never conceal missing evidence.

## Content planning from prompt evidence

Do not automatically create one page per prompt. First group prompts by task and intent. Then decide whether the best response is:

- improve an existing page's concise answer and supporting evidence;
- add a definition, comparison, limitation, alternative, or decision criterion;
- add first-party research, a clearly attributed expert contribution, or a primary source;
- improve a data visual's caption and surrounding explanation;
- correct inconsistent entity or brand information;
- build a new page only when the task is materially distinct;
- leave the content unchanged when the recommendation would make it less useful to people.

## Schema guardrails

- `Claim` is a Schema.org type; it is appropriate only for a clearly stated claim supported by visible content.
- `Dataset` can describe a genuine dataset and its distribution, methodology, dates, and license where applicable.
- `citation` is a property on CreativeWork—not a schema type.
- Review or AggregateRating markup must reflect legitimate, visible review evidence and applicable platform/search policies.
- Valid markup does not guarantee a rich result, a ranking improvement, or an AI citation.

## Comparing periods

Compare only series with the same provider, project, prompt set, engines, market, and metric definition. Annotate changes. Provider algorithms and model behavior can change, so describe movement as “increased within SE Ranking's observation set,” not “all AI visibility increased.”


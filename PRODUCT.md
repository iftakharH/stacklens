# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, both confirmed in the shipped README and landing copy:

- **Recruiters and hiring managers** screening a candidate fast. Their scene: a shortlist open in one window, a candidate's GitHub profile in another, minutes to decide whether a profile is worth a conversation. They need a defensible read they can repeat and compare across candidates.
- **Developers reading their own profile.** Their scene: curiosity or self-audit, usually late, usually alone. They want a mirror that does not flatter them.

Both audiences see the same numbers. That symmetry is deliberate.

## Product Purpose

StackLens turns a public GitHub profile into a one-page developer report: language mix weighted by repository size, activity, stack diversity, project quality, an overall 0–10 score, a hireability band, repository highlights, and rule-based insights.

It exists because a GitHub profile is legible to the person who wrote it and opaque to everyone else. Success means a recruiter can form a judgement in under a minute and still trust it after clicking through to the profile, and a developer recognises themselves in the result.

## Positioning

The mechanism a neighboring product could not truthfully copy: **every number is computed deterministically from public repositories and is shown identically to the person being read.** No AI, no LLM, no generated prose that varies between runs. Same profile, same result, every time.

That is both the product's honesty claim and its characteristic objection to AI-summary tools: the reading is an instrument, not an opinion.

## Operating Context

- Analysis needs no account. There is no signup wall in front of the core task.
- Input is a GitHub username or a profile URL, pasted. Both forms accepted.
- Optional accounts add three things only: saved candidates with notes, report history, and public share links with expiry, revocation, and view counts.
- Reports are read on desktop and on phones, in dark and light environments, and are frequently shared as a link to a third party who has never seen the product.
- Self-hostable, runs on free tiers. No billing, teams, ATS integration, or bulk import by design.

## Capabilities and Constraints

Confirmed in the shipped code and README:

- Scores 0–10 for activity, stack diversity, and project quality, combined into an overall score and a hireability band (Beginner, Developing, Junior Ready, Strong Junior, Hireable).
- Language mix coloured with GitHub Linguist colours.
- Top 5 repositories by stars, with language, stars, and last update.
- Deterministic, rule-based insights and a short summary.
- GitHub OAuth or email magic link; reports persisted only for signed-in users. Anonymous analysis is never stored.
- Dark and light themes, responsive layout, visible keyboard focus.
- Rate limits: 10/min anonymous, 100/min authenticated.
- React 19 + TypeScript + Vite + Tailwind CSS 3.4 SPA; Express 5 serverless API; PostgreSQL without an ORM.

Factual copy that existing end-to-end tests depend on: the headline "Read the work, not the resume.", the "Smart Summary" section name, the section headings "Stack Analysis", "Repository Highlights", "Developer Insights", the label "GitHub profile URL or username", the button "Analyze profile", and hireability band strings.

## Brand Commitments

- Name: **StackLens**. Tagline in use: "See the developer behind the repositories."
- Headline in use: "Read the work, not the resume."
- Voice: plain, declarative, measurable. Short sentences. No hype, no exclamation marks, no gamification, no "AI-powered" claims — the product explicitly involves no AI.
- A stated commitment to symmetric reading: the same numbers are shown to the person being read. Any design that flatters the reader, or hides the reading from the subject, contradicts the brand.
- Not affiliated with GitHub.

## Evidence on Hand

- A real specimen on the landing page, read from `github.com/torvalds`: 12 repositories, 262,280 stars, 323,661 followers, language mix C 97.5% / C++ 2.3% / OpenSCAD 0.2%. These are analyzer output, not mock-ups, and must stay labelled as such.
- Golden test fixtures for the `octocat` profile (Ruby 97.9%, overall 5.5, "Junior Ready").
- **Absent and must not be fabricated:** testimonials, customer logos, user counts, press coverage, benchmark comparisons against other tools, pricing, and any claim about hiring outcomes.

## Product Principles

1. **Measure, do not opine.** Every claim on screen traces to a computed number. Design cannot add persuasive pressure the data does not support.
2. **The reading is the product.** The identification of the developer is the frame; the scores, spectrum, and insights are the content. Never invert that hierarchy.
3. **Legible in one pass.** A recruiter's first pass should land the overall read without scrolling through instrumentation first.
4. **Repeatable and comparable.** Two profiles read side by side should be comparable at a glance, which means shared scales, shared bands, shared colour semantics.
5. **The subject can see it too.** Nothing on screen would embarrass the developer being read. Design for both parties in the room.

## Accessibility & Inclusion

Playwright axe checks run against the landing page and the analyzer result. Keyboard focus must stay visible, colour must never be the only carrier of meaning (language colours always ship with a text label and percentage), and motion must respect `prefers-reduced-motion`.

## Labeled Inferences

Written by a delegated build rather than a live interview. The following are inferred from the README, the shipped code, the existing copy, and the brief "make the website pages really futuristic and attractive for a developer GitHub-profile-checking site". They are open to correction:

- Audience priority is recruiter-first, developer-mirror second (README order).
- "Futuristic" is a visual-direction brief, not a product-roadmap brief: no new features are implied.
- The deterministic/no-AI positioning is treated as a brand commitment rather than an incidental technical note.

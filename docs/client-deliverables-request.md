# What we need from the client before AskHub can go public

Status: open. Last updated 2026-07-30.

This is the launch critical path. The site itself is being built now and will be
ready before this list is closed — so every day these items are outstanding is a
day of delay that no amount of engineering speed recovers.

Nothing here is a nice-to-have. Each item either blocks a public page from
rendering honestly, or blocks the site from being pointed at real users at all.

Send everything to `aihubfordevelopment@undp.org`.

---

## 1. The resource dataset — blocks launch

**Why it blocks:** the site is currently populated with placeholder content
transcribed from the prototype. If it went public as-is, real innovators would
submit applications to opportunities that do not exist. That is the single
worst failure available to this product, so the gate stays closed until the
real dataset replaces it.

**What we need,** per resource:

| Field | Notes |
| --- | --- |
| Resource name | |
| Partner or organisation | Must match a partner name exactly — see §2 |
| Type | e.g. Credits, Programme, Course, Network |
| Primary need | One of: compute, training, funding, accelerator, partners |
| Secondary need | Optional |
| Sub-category | e.g. "Cloud credits", "HPC allocation", "Curriculum" |
| Description | One or two paragraphs, as it should appear publicly |
| Application link | Must be `https`. **We will not publish a link we cannot confirm resolves.** |
| Deadline | A date, or "rolling" if there is none |
| Eligible countries | Or "all" / "all Africa" / "the 18 partner countries" |
| Eligible sectors | From: Energy, Agriculture, Health, Water, Education & Training, Infrastructure. Or "all". |
| Eligible stages | From: New to AI, Getting started, Building, Scaling. Or "all". |
| Exclusive to the AI Hub? | Exclusive / early access / neither |

**A spreadsheet is fine** — one row per resource, one column per field above. We
do not need it in any particular system.

**On unconfirmed links:** any resource whose application URL we cannot verify
will be loaded but held unpublished rather than published broken. Please flag
anything you are unsure about rather than omitting it; held is recoverable,
missing is not.

---

## 2. Provider logos and website URLs

**Why it matters:** the content rule for this programme is that **each logo
links to that provider's own official site**, and the database enforces this
structurally: a logo cannot be stored without a URL to link it to. Nothing on
the public site renders provider logos today, so this does not block launch;
it is what would let a provider row carry a logo and a link when a surface
for them exists. (AskHub lists providers -- organisations whose opportunities
appear in the directory -- and has no official partners; an earlier draft of
this section spoke of a "partner band", which no longer exists.)

**What we need,** per provider:

- Exact provider name, spelled as it should appear publicly
- Official website URL (`https`)
- Logo file

**Logo format:** **PNG or JPG.** Please do not send SVG — the upload path
rejects it deliberately, because an SVG is an executable document and this is a
public UN surface. A transparent-background PNG at roughly 400px wide is ideal.

**One name to confirm:** the prototype lists a single provider as
"Cyber 4.0 and Cisco". If those are two organisations, we need them as two
entries with a logo and URL each, since each logo has to link to its own site.

---

## 3. The fifteen headline figures, each with a source — blocks the About page

**Why it blocks:** this is a leadership reporting surface for a UN programme. A
plausible-looking number that nobody can trace is worse than no number, because
it can be repeated upward as fact. The database will not accept a figure at all
unless it arrives with three things: the value, where it came from, and who
vouches for it.

**Important: the site renders whatever subset you have confirmed.** You do not
need all fifteen at once. Send two and two appear; send nine and nine appear.
Nothing is invented to fill the gaps, and the section is simply absent while
there are none. So please send them as they are confirmed rather than waiting
to complete the set.

**For each figure we need four things:**

1. The number, formatted as it should display (e.g. `7,000+`, `1.5M`, `18`)
2. Its label (e.g. "startups engaged", "partner countries")
3. **Source** — the dataset or report it comes from, and the date you received
   or published it. "AI Hub programme dataset, received 2026-08-04" is what we
   need. "Internal estimate" is not usable.
4. **Who is attesting** — the named person confirming the figure is correct.
   Not a team, not a system account. A person.

**The fifteen figures currently shown in the prototype, all unverified:**

Headline stats — `7,000+` startups engaged; `130` innovators directly
supported; `18` partner countries; `150+` extended network of private sector
enterprises; `15,000+` extended network reach; `1,000+` innovators engaged;
`1.5M` advocacy reach; `387` startup applications (co-design phase); `500`
innovators worked with since the Rome launch.

Compute snapshot — `1,500,000` CINECA GPU hours committed (of which `990,000`
allocated); `27` startups onboarded to HPC; `54` innovators with active compute
access; `$2M` Microsoft Azure deployed; `$1M` AWS committed; `$3.3M+` total
compute value.

**Please treat these as questions, not as figures to confirm.** Several appear
to overlap or to count the same population differently, and at least one pair
looks inconsistent. If a number is wrong, or is no longer current, or was only
ever an estimate, say so and we will drop it. A shorter list of figures that
survive scrutiny is worth more than a longer list that does not.

**What we are NOT asking you for:** total reach, visitor counts, growth, page
views, click-throughs or session numbers. Those are Google Analytics' to
report, not yours to supply, and the system deliberately has nowhere to store
them. The count of live resources is likewise computed directly and needs no
attestation.

---

## 4. Privacy notice and terms of use — blocks launch

**Why it blocks:** the site collects email addresses for alerts, and takes
submissions and contact messages. It cannot go public without a privacy notice.

Both pages exist and render today with a factual holding sentence saying the
notice is being finalised. That is honest and shippable for internal review; it
is not shippable to the public.

**What we need:** legal-reviewed copy for both. Plain text or a document is
fine. The database is hosted in the EU, which is worth telling whoever reviews
this.

---

## 5. Google Analytics identifiers — blocks reporting, not launch

**Why it matters:** the reach and engagement reporting reads from GA4. Without
these the reporting screens show an explicit "not connected" state rather than
a number.

**What we need:** the GA4 Measurement ID (`G-XXXXXXXXXX`) and the GA4 Property
ID.

This one can arrive after launch without breaking anything — but every day it
is missing is a day of traffic that is never attributed, and that cannot be
backfilled.

---

## 6. One decision we need from you — blocks nothing yet, gets more expensive

The partnership tracker records each partnership at one of four stages:
**prospecting → in discussion → active → delivered.**

Those labels came from the prototype. If your team uses different language for
these stages, tell us now: changing them is trivial today and progressively
less so once real partnership records exist against them.

---

## The domain

We also need to know the subdomain the site should live on, so DNS can be
prepared in advance. The site is currently deployed behind access protection
and marked as not-to-be-indexed by search engines; both come off together at
launch, and neither is a code change.

---

## Summary — what blocks what

| Item | Blocks |
| --- | --- |
| Resource dataset | **Launch.** Placeholder opportunities cannot be shown to real innovators. |
| Privacy and terms copy | **Launch.** The site collects email addresses. |
| Partner logos + URLs | The partner band. Site works without them; partners show as names. |
| The fifteen figures + sources | The figures section. **Partial is fine** — send them as they are confirmed. |
| GA4 identifiers | Reporting only. Ungathered traffic cannot be recovered later. |
| Partnership stage labels | Nothing yet. Cheaper to change now than later. |
| Subdomain | DNS lead time. |

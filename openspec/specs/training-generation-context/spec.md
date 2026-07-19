# Training Generation Context

## Purpose

The backend assembles a deterministic, owner-bound context before any training content may be requested from a provider. This contract does not call a provider, generate sessions, or persist generated content.

## Owner-bound source

- The entry point requires a verified `UserContext`.
- Owner identity is derived only from `UserContext`; request bodies, DTOs, and providers cannot supply or override it.
- One owner-scoped transaction and one combined repository query read the current draft approach and onboarding snapshot.
- A missing or foreign draft, missing onboarding snapshot, corrupt or incomplete onboarding, unavailable storage, or a selected approach that is no longer eligible fails before provider-safe DTO creation.
- Persisted eligibility output is never trusted. The backend parses and normalizes onboarding and recalculates approach eligibility using the athlete-local assessment date.

## MVP calendar policy

- The MVP timezone is the fixed IANA timezone `Europe/Madrid`.
- The current instant is supplied by an injected aware clock and converted to `Europe/Madrid`; server-local time and fixed UTC offsets are forbidden.
- Generation starts on the strictly next Monday. If the athlete-local date is Monday, generation starts seven days later.
- If the goal date is before that Monday, no generation window exists and assembly fails closed.
- The full horizon week count is the inclusive ceiling from generation start through the goal date.
- A final partial week is included and its end is truncated exactly at the goal date.
- UTC-midnight and daylight-saving transitions affect only conversion to the athlete-local date; calendar dates remain deterministic after conversion.

## Complete-before-slice policy

The backend calculates the complete goal horizon before selecting the initial provider block:

1. weekly distance projection from the four-week distance divided by four;
2. goal demand;
3. readiness calendar and capacity;
4. weekly availability;
5. longest-outing session trajectory.

Only after all complete-horizon policies have run may the backend slice the first `min(4, horizon_weeks)` weeks. This preserves later taper and recovery effects in the initial constraints. The weekly zero baseline uses the existing 9.00 km bootstrap. Independently, a zero longest-outing baseline uses the existing 3.00 km and 30-minute bootstrap; these policies must not be conflated.

## Safety policy

The backend derives `load_increase_blocked_for_horizon` only from existing backend-owned safety restriction codes that explicitly prohibit load increase, currently `no_load_increase` and `no_weekly_load_increase`. When true, the restriction applies to every week in the complete initial one-to-four-week block. Providers cannot choose, remove, or reinterpret it.

## Provider privacy boundary

The provider-safe DTO is strict, immutable, deterministic, and minimal. Decimal distances are serialized as base-10 strings without float conversion. It contains only:

- the backend-authorized approach;
- concrete generation and goal dates;
- minimal goal demand and readiness outcomes;
- backend-owned safety restrictions;
- weekly availability;
- one to four dated weekly distance, phase, readiness-role, and longest-outing constraints.

The DTO recursively excludes owner, user, and plan identifiers; email, claims, and tokens; database rows and timestamps; the raw onboarding snapshot; pain free text; persistence metadata; and fields unnecessary for generation. Internal context may retain immutable complete-horizon policy results, but those results cross the provider boundary only through the explicit DTO fields above.

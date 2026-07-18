# Onboarding Approach Choice Specification

## Purpose

Define the post-completion seventh onboarding screen where a runner explicitly selects an eligible training approach without recommendation bias.

## Requirements

### Requirement: Post-completion lifecycle

Step 7 MUST be a web-only post-completion state and MUST NOT extend `StepId` or the onboarding snapshot. After step 6 successfully persists `state=completed`, the web MUST request eligibility with the exact UTC calendar date. A returning runner whose persisted onboarding is completed MUST request fresh eligibility again.

Eligibility loading and failure MUST be visible. Failure MUST offer an in-place retry without losing completed onboarding.

### Requirement: Complete unbiased choice set

The screen MUST always render Camino Kaio (`kaio_path`), Modo Z (`mode_z`), and Kaioken (`kaioken`) in low-to-high order. It MUST NOT display a Recommended badge, preselect, auto-select, or visually privilege `recommended_approach`.

Available options MUST form one accessible named radio group. The runner MUST explicitly select one available option. Unavailable options MUST remain visible and disabled, with a separate accessible disclosure control. Its contextual panel MUST preview at most three localized `blocking_reason_code` values in API order, allow revealing and collapsing all remaining reasons, and close without clearing an existing selection. Selecting an available option MUST show a confirmation summary and close blocked detail. Applicable top-level safety restrictions MUST remain visible without adding eligibility rules in the web.

### Requirement: Draft save states and navigation

The generation action MUST remain disabled until an available choice is explicit. While saving, it MUST prevent duplicate submission and communicate pending state. A recoverable failure MUST preserve the selection and provide an actionable in-place retry. On success, the web MUST navigate to `/plan/generating?plan_id=<encoded-id>`.

### Requirement: Static follow-up destination

The private `/plan/generating` route MUST exist and communicate that the approach was saved and personalized generation is a next step. It MUST NOT animate, fake progress, call AI, create sessions, or claim generation is currently running.

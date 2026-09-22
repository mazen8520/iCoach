# iCoach Compact Mobile Refinement Plan

## Scope
Apply only the four requested refinements while preserving the existing iCoach colors, structure, spacing on desktop, rounded controls, content, and functionality.

## Changes
- Reduce the existing type scale slightly and consistently, preserving each font family, weight, casing, and hierarchy. Keep compact labels and mobile text readable.
- Repair phone and tablet behavior across every coach and client page: remove viewport overflow, prevent clipped or overlapping content, keep long sections scrollable, preserve visible touch targets, and make horizontal selectors intentional and touch-friendly.
- Make the existing mobile bottom navigation fully usable, including access to every current destination through the existing “More” control without changing the navigation structure.
- Replace only the landing background photo with a generated image of a male athlete matching the current dark, high-contrast composition and treatment.
- Extend the existing motion system with subtle page entry, menu/panel, control press, tab, and interactive transitions. Respect reduced-motion preferences.

## Validation
- Check all coach, client, and landing routes at common phone, tablet, and desktop widths.
- Verify no unintended horizontal page scrolling, clipped controls, overlapping text, blocked taps, or inaccessible navigation.
- Exercise representative interactions: notifications, mobile navigation, More menu, tabs, task completion, forms, calendar, messaging, and workout controls.
- Confirm the landing page retains its current composition and uses only the new male-athlete image.

## Technical details
- Keep all work in presentation and local interaction code; no backend, data, route, or content changes.
- Use the existing CSS tokens, React components, and animation conventions.
- Preserve current desktop measurements except for the requested slight typography reduction and shared interaction feedback.

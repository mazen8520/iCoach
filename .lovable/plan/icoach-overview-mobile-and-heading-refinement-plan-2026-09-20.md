# iCoach Overview Mobile and Heading Refinement Plan

## Scope
Apply only the requested responsive repairs to the coach Overview page and reduce oversized headings across the application. Preserve desktop layouts, colors, components, content, imagery, navigation, motion, and functionality.

## Changes
- Audit the coach Overview at several common phone widths and correct its existing responsive rules so the page header, live activity panel, progress ring, metrics, attention queue, meetings, and performance chart stack cleanly without overlap, clipping, or horizontal page scrolling.
- Keep touch controls fully reachable and maintain comfortable vertical spacing while retaining the current mobile structure and visual identity.
- Reduce heading-style typography across coach, client, modal, card, section, and landing contexts while leaving body copy, controls, navigation, and important numeric values readable and unchanged.
- Scope all Overview-specific layout adjustments to phone breakpoints so desktop presentation remains unchanged.

## Validation
- Test `/coach/dashboard` at multiple common phone widths, including narrow screens, for overflow, overlap, clipping, chart sizing, touch access, and full-page scrolling.
- Check representative coach, client, modal, and landing views to confirm the new heading scale is balanced and body text is unaffected.
- Recheck the Overview at desktop width to confirm its layout remains unchanged.

## Technical details
- Use the existing responsive CSS, semantic tokens, components, and chart implementation.
- Make no data, route, image, animation, navigation, feature, or functionality changes.

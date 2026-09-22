# Changelog

## Unreleased

- Added shared Current View PDF Visual Polish for Exact View and Clean Report: scrollbar/resize-grip hiding, safe rendered-scroll expansion, and configurable viewport whitespace trimming (all enabled by default).
- Unsafe virtualized or interactive scrollers keep their source geometry; visual polish never fetches additional records or changes two-stage export delivery.
- Improved Exact View Current View geometry: source desktop-width preservation, meaningful content bounds, selective viewport/scroll/flex normalization, screen-style fidelity, and privacy-safe structural diagnostics.
- Auto capture waits briefly for fonts, images, and layout/content stability after the configured Auto Export Delay; generic nested-report regression tests cover values, clipping, blank gaps, and fixed-height safety.
- Added optional two-stage Current View PDF delivery: a unique ExportKey is sent to generation and, after the Mendix action's execution lifecycle completes, to a separate Open Generated File Action.
- PDF generation and Mendix Download File remain in separate requests; the built-in export button can stay visible during Auto Export On Load.
- Added **Auto Export On Load** (off by default) and **Auto Export Delay (ms)** (500 by default, validated 0–10000) for dedicated Current View preview pages.
- **Show Export Button** remains on by default; it can be turned off without disabling automatic capture.
- Automatic export uses the existing PDF/Word Current View pipeline once per widget mount after a browser paint and the configured delay.
- Configured Mendix Current View actions no longer produce a second standalone `.html` download. The manual HTML fallback remains when no PDF action is configured.

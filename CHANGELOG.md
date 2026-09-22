# Changelog

## Unreleased

- Added optional two-stage Current View PDF delivery: a unique ExportKey is sent to generation and, after the Mendix action's execution lifecycle completes, to a separate Open Generated File Action.
- PDF generation and Mendix Download File remain in separate requests; the built-in export button can stay visible during Auto Export On Load.
- Added **Auto Export On Load** (off by default) and **Auto Export Delay (ms)** (500 by default, validated 0–10000) for dedicated Current View preview pages.
- **Show Export Button** remains on by default; it can be turned off without disabling automatic capture.
- Automatic export uses the existing PDF/Word Current View pipeline once per widget mount after a browser paint and the configured delay.
- Configured Mendix Current View actions no longer produce a second standalone `.html` download. The manual HTML fallback remains when no PDF action is configured.

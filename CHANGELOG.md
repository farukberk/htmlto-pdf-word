# Changelog

## Unreleased

- Added **Auto Export On Load** (off by default) and **Auto Export Delay (ms)** (500 by default, validated 0–10000) for dedicated Current View preview pages.
- **Show Export Button** remains on by default; it can be turned off without disabling automatic capture.
- Automatic export uses the existing PDF/Word Current View pipeline once per widget mount after a browser paint and the configured delay.
- Configured Mendix Current View actions no longer produce a second standalone `.html` download. The manual HTML fallback remains when no PDF action is configured.

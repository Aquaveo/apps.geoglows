Run the cross-browser screenshot matrix test using Playwright via Docker.

Tests Chrome, Safari (WebKit), and Firefox across phone (390x844), tablet (768x1024), and desktop (1440x900) viewports.

## What to do

1. If the user passes `live` as an argument, test against production (`https://apps.geoglows.org/`). Otherwise test against the local build.

2. For local builds, run `npm run build` first, then `npm run screenshots`. For live, run `npm run screenshots:live`.

3. After the script completes, read and display key screenshots from `/tmp/pw-screenshots/` so the user can visually verify. Show at least:
   - One phone screenshot (safari-phone-landing.png)
   - One tablet screenshot (safari-tablet-landing.png)  
   - One desktop screenshot (chrome-desktop-landing.png)

4. Report the pass/fail matrix from the script output.

5. If any device fails, investigate the screenshots at `/tmp/pw-screenshots/<device>-error.png` and diagnose the issue.

## Arguments

- No args: build locally and test the dist output
- `live`: test the production deployment at apps.geoglows.org
- `$ARGUMENTS`: passed through as context

# AeroSensei Playwright Presentation Demo

This folder contains a headed Playwright walkthrough for the presentation steps in `requirement.md`.

## Run

Install Node.js first if `npm` is not recognized. On Windows, the easiest options are:

```powershell
winget install OpenJS.NodeJS.LTS
```

Or download the LTS installer from https://nodejs.org, then close and reopen PowerShell.

Check that it is available:

```powershell
node -v
npm -v
```

Start the app stack first, then run:

```powershell
cd playwright
npm install
npx playwright install chromium
npm run demo
```

Optional overrides:

```powershell
$env:BASE_URL="http://localhost:3000"
$env:DEMO_USERNAME="government@example.com"
$env:DEMO_PASSWORD="password123"
$env:STEP_PAUSE_MS="1800"
npm run demo
```

For the deployed EC2 demo URL, set `BASE_URL` before running:

```powershell
$env:BASE_URL="https://ec2-3-107-194-55.ap-southeast-2.compute.amazonaws.com"
npm run demo
```

The Playwright config sets `ignoreHTTPSErrors: true` because that EC2 HTTPS certificate is not trusted by Chrome during automation.

The script runs with a visible browser, adds on-screen presentation labels, scrolls slowly through long result pages, and writes screenshots/downloaded report artifacts under `playwright/artifacts`.

const { test, expect } = require("@playwright/test");
const path = require("path");

const USERNAME = process.env.DEMO_USERNAME || "government@example.com";
const PASSWORD = process.env.DEMO_PASSWORD || "password123";
const REPORT_QUERY =
  process.env.REPORT_QUERY || "Generate air quality report for VinUniversity for 3/7/2026";
const STEP_PAUSE_MS = Number(process.env.STEP_PAUSE_MS || 1400);

test("AeroSensei presentation walkthrough", async ({ page }, testInfo) => {
  test.setTimeout(240_000);

  await mockMapSearch(page);

  await test.step("Live Quality Map: analyze NamSach and show AI forecast", async () => {
    await page.goto("/");
    await presentStep(page, "Live Quality Map", "Open the public air quality map from the landing page.");
    await navigateByLink(page, /Live Quality Map/i, "/public-map", /\/public-map/);
    await page.waitForLoadState("networkidle").catch(() => {});
    await presentStep(
      page,
      "Map Guidance",
      "The bottom-left advisory card shows what action the user should take next.",
      { corner: "bottom-right", holdMs: 2000 }
    );
    await capture(page, testInfo, "01-live-map-open");

    await presentStep(
      page,
      "Select NamSach",
      "Search and select NamSach so the region result is visible while the advisory remains clear.",
      { corner: "bottom-right" }
    );
    await page.getByPlaceholder(/Search district or address/i).fill("NamSach");
    await page.getByRole("button", { name: /Locate/i }).click();
    await expect(page.getByText(/Nam Sach District/i)).toBeVisible({ timeout: 15_000 });
    await presentStep(
      page,
      "Click NamSach",
      "Click the located map area so the bottom-left advisory shows concrete suggested actions.",
      { corner: "bottom-right", holdMs: 2000 }
    );
    await clickLocatedPlaceAndWaitForAdvisory(page);
    await pause(2000);
    await capture(page, testInfo, "02-namsach-selected");

    await presentStep(page, "Analyze Region", "Open the region details and historical PM charts.", { corner: "bottom-right" });
    await page.getByRole("button", { name: /Analyze Region/i }).click();
    await waitForAny(page, [
      page.getByText(/PM2\.5 Concentration/i),
      page.getByText(/No historical data available/i),
      page.getByRole("button", { name: /Generate AI Forecast/i })
    ]);
    await capture(page, testInfo, "03-region-analysis");

    await presentStep(page, "Generate AI Forecast", "Run the AI forecast and show the forecast result on the charts.", { corner: "bottom-right" });
    const forecastButton = page.getByRole("button", { name: /Generate AI Forecast|Forecast Active/i });
    if (await forecastButton.isEnabled()) {
      await forecastButton.click();
      await waitForAny(page, [
        page.getByText(/Forecast Active/i),
        page.getByText(/AI Core failed/i),
        page.getByText(/No historical data available/i)
      ]);
    } else {
      await presentStep(
        page,
        "Forecast Unavailable",
        "This region has no recent historical data, so the disabled forecast button is the visible result.",
        { corner: "bottom-right" }
      );
    }
    await pause(2500);
    await capture(page, testInfo, "04-ai-forecast-result");

    await presentStep(page, "Return Home", "Close the modal and return to the main page.");
    await page.getByRole("button", { name: /Close details/i }).click();
    await navigateByLink(page, /AeroSense/i, "/", /\/$/);
  });

  await test.step("All Notification: login, breach all sensors, scroll alerts", async () => {
    await presentStep(page, "Launch Dashboard", "Sign in as a government user.");
    await navigateByLink(page, /Launch Dashboard/i, "/login", /\/login|\/dashboard/);
    await loginIfNeeded(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await waitForDashboardSensorData(page);
    await showVietnamThenZoomToHanoi(page);
    await capture(page, testInfo, "05-dashboard");
    await presentStep(page, "Dashboard Overview", "Hanoi sensor clusters are now in focus for the regulator dashboard.", { holdMs: 5000 });

    await presentStep(page, "Alerts", "Open Alerts from the sidebar.");
    await navigateByLink(page, /^Alerts$/i, "/dashboard/alerts", /\/dashboard\/alerts/);

    await presentStep(page, "Force Breached Sensors", "Switch every demo sensor to BREACHED and wait for results.");
    await page.getByRole("button", { name: /All sensors.*BREACHED/i }).click();
    await waitForAny(page, [
      page.getByText(/All sensors now emitting BREACHED/i),
      page.getByText(/Company Site Alerts/i),
      page.getByText(/Could not reach the AI agent/i)
    ]);
    await page.waitForLoadState("networkidle").catch(() => {});
    await capture(page, testInfo, "06-alerts-breached");

    await presentStep(page, "All Notifications", "Scroll slowly through company, government, and city-wide alerts.");
    await slowScroll(page, 5);
    await capture(page, testInfo, "07-alerts-scrolled");
  });

  await test.step("Fine: evaluate daily breaches and show issued fines", async () => {
    await presentStep(page, "Fines", "Open the enforcement and fines page.");
    await navigateByLink(page, /^Fines$/i, "/dashboard/fines", /\/dashboard\/fines/);

    await presentStep(page, "Evaluate Today", "Run the demo evaluation to record breach alerts and auto-issue fines.");
    await page.getByRole("button", { name: /Evaluate today/i }).click();
    await waitForAny(page, [
      page.getByText(/Evaluation complete/i),
      page.getByText(/Failed to run the evaluation/i),
      page.getByText(/Breach Alerts/i)
    ]);
    await capture(page, testInfo, "08-breach-alerts");

    await presentStep(page, "Issued Fines", "Switch to the fines tab and show the issued penalties.");
    await page.getByRole("button", { name: /Issued Fines/i }).click();
    await waitForAny(page, [
      page.getByText(/No fines issued yet/i),
      page.getByText(/Amount/i),
      page.getByText(/Loading fines/i)
    ]);
    await pause(1500);
    await capture(page, testInfo, "09-issued-fines");
  });

  await test.step("Report Generation: ask AI assistant and open/download the report", async () => {
    await presentStep(page, "AI Assistant", "Open the AI assistant workspace.");
    await navigateByLink(page, /AI Assistant/i, "/dashboard/aiassistant", /\/dashboard\/aiassistant/);

    await presentStep(page, "Generate Report", `Ask: "${REPORT_QUERY}"`);
    await page.getByPlaceholder(/Ask AeroSense Intelligence/i).fill(REPORT_QUERY);
    await page.getByRole("button", { name: /Send message to AI assistant|Send/i }).click();
    await expect(
      page.locator("main p.whitespace-pre-wrap").filter({ hasText: REPORT_QUERY }).first()
    ).toBeVisible({ timeout: 10_000 });
    await waitForAssistantAnswer(page);
    await capture(page, testInfo, "10-ai-report-answer");

    await presentStep(page, "Open Report", "Open the generated report link or save the download, then return to the website.");
    await openFirstReportLink(page, testInfo);
    await capture(page, testInfo, "11-back-to-website");
  });
});

async function loginIfNeeded(page) {
  if (page.url().includes("/login")) {
    await page.getByPlaceholder(/Enter your email address/i).fill(USERNAME);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: /Sign In|Verifying Credentials/i }).click();
  }

  await page.waitForURL(/\/dashboard/, { timeout: 30_000 }).catch(async () => {
    if (page.url().includes("/login")) {
      throw new Error("Login did not reach /dashboard. Check backend auth and demo credentials.");
    }
  });
}

async function mockMapSearch(page) {
  await page.route(/nominatim\.openstreetmap\.org\/search/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          lat: "20.9991",
          lon: "106.3342",
          display_name: "Nam Sach District, Hai Duong, Vietnam"
        }
      ])
    });
  });
}

async function clickLocatedPlaceAndWaitForAdvisory(page) {
  const map = page.locator(".leaflet-container");
  await expect(map).toBeVisible({ timeout: 15_000 });

  const box = await map.boundingBox();
  if (!box) throw new Error("Could not find the visible map area to click.");

  const offsets = [
    [0, 0],
    [90, 0],
    [-90, 0],
    [0, 90],
    [0, -90],
    [140, 70],
    [-140, 70],
    [140, -70],
    [-140, -70]
  ];

  for (const [dx, dy] of offsets) {
    await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
    const advisoryVisible = await page
      .getByText(/Mask Advisory/i)
      .waitFor({ state: "visible", timeout: 1200 })
      .then(() => true)
      .catch(() => false);

    if (advisoryVisible) {
      await expect(page.getByText(/Activity Guidance/i)).toBeVisible({ timeout: 5_000 });
      return;
    }
  }

  await clickVisibleDistrictForAdvisory(page);
  await expect(page.getByText(/Mask Advisory/i)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/Activity Guidance/i)).toBeVisible({ timeout: 5_000 });
}

async function clickVisibleDistrictForAdvisory(page) {
  const clicked = await page.evaluate(() => {
    const paths = Array.from(document.querySelectorAll(".leaflet-interactive"));
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const candidates = paths
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        const dx = rect.left + rect.width / 2 - centerX;
        const dy = rect.top + rect.height / 2 - centerY;
        return { el, rect, visible, distance: Math.hypot(dx, dy) };
      })
      .filter((item) => item.visible)
      .sort((a, b) => a.distance - b.distance);

    const target = candidates[0];
    if (!target) return false;

    const clientX = target.rect.left + target.rect.width / 2;
    const clientY = target.rect.top + target.rect.height / 2;
    target.el.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX,
        clientY
      })
    );
    return true;
  });

  if (!clicked) {
    const map = page.locator(".leaflet-container");
    const box = await map.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2 + 80, box.y + box.height / 2);
    }
  }
}

async function presentStep(page, title, detail, options = {}) {
  await page.evaluate(
    ({ title, detail, options }) => {
      const old = document.querySelector("[data-pw-demo-step]");
      if (old) old.remove();

      const corner = options.corner || "bottom-left";
      const position = {
        "bottom-left": ["left: 24px", "bottom: 24px"],
        "bottom-right": ["right: 24px", "bottom: 24px"],
        "top-right": ["right: 24px", "top: 24px"],
        "top-left": ["left: 24px", "top: 24px"]
      }[corner] || ["left: 24px", "bottom: 24px"];

      const box = document.createElement("div");
      box.dataset.pwDemoStep = "true";
      box.style.cssText = [
        "position: fixed",
        position[0],
        position[1],
        "z-index: 999999",
        "max-width: 560px",
        "padding: 18px 20px",
        "border-radius: 18px",
        "background: rgba(0, 90, 140, 0.94)",
        "color: white",
        "font-family: Inter, Arial, sans-serif",
        "box-shadow: 0 20px 60px rgba(0,0,0,.28)",
        "border: 1px solid rgba(255,255,255,.35)",
        "backdrop-filter: blur(18px)"
      ].join(";");

      const eyebrow = document.createElement("div");
      eyebrow.textContent = "Presentation Step";
      eyebrow.style.cssText = "font-size: 12px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; opacity: .78;";

      const heading = document.createElement("div");
      heading.textContent = title;
      heading.style.cssText = "font-size: 24px; font-weight: 900; margin-top: 4px;";

      const body = document.createElement("div");
      body.textContent = detail;
      body.style.cssText = "font-size: 14px; line-height: 1.45; margin-top: 6px; opacity: .92;";

      box.append(eyebrow, heading, body);
      document.body.appendChild(box);
    },
    { title, detail, options }
  );
  await pause(options.holdMs ?? STEP_PAUSE_MS);
}

async function navigateByLink(page, name, path, expectedUrl) {
  const link = page.getByRole("link", { name }).first();
  await expect(link).toBeVisible({ timeout: 15_000 });

  await Promise.all([
    page.waitForURL(expectedUrl, { timeout: 12_000 }).catch(() => null),
    link.click()
  ]);

  if (!expectedUrl.test(page.url())) {
    await page.goto(path);
    await expect(page).toHaveURL(expectedUrl);
  }
}

async function waitForDashboardSensorData(page) {
  await expect(page.getByText(/Live Geospatial Matrix/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".leaflet-container").first()).toBeVisible({ timeout: 30_000 });
  await page
    .getByText(/INITIALIZING MAP RADAR/i)
    .waitFor({ state: "hidden", timeout: 30_000 })
    .catch(() => {});
  await waitForAny(page, [
    page.locator(".leaflet-container").first(),
    page.locator(".leaflet-tile-loaded").first(),
    page.locator(".custom-leaflet-icon").first(),
    page.locator("canvas").first(),
    page.getByText(/Critical|Node|Sensor|PM2\.5|PM10/i).first()
  ]).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await pause(7000);
}

async function showVietnamThenZoomToHanoi(page) {
  const map = page.locator(".leaflet-container").first();
  await expect(map).toBeVisible({ timeout: 20_000 });
  const box = await map.boundingBox();
  if (!box) return;

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const hanoiX = box.x + box.width * 0.49;
  const hanoiY = box.y + box.height * 0.38;

  await page.mouse.move(centerX, centerY);
  for (let i = 0; i < 2; i += 1) {
    await page.mouse.wheel(0, 600);
    await pause(300);
  }
  await presentStep(
    page,
    "Vietnam Overview",
    "Whole-country monitoring context before focusing into Hanoi.",
    { corner: "bottom-right", holdMs: 2200 }
  );

  await presentStep(
    page,
    "Zoom To Hanoi",
    "Zoom precisely into Hanoi, where the live sensor clusters are concentrated.",
    { corner: "bottom-right", holdMs: 700 }
  );
  const hanoiCluster = await getLargestClusterCenter(page);
  const targetX = hanoiCluster?.x ?? hanoiX;
  const targetY = hanoiCluster?.y ?? hanoiY;
  await page.mouse.move(targetX, targetY);
  for (let i = 0; i < 3; i += 1) {
    await page.mouse.wheel(0, -280);
    await pause(320);
  }
  await pause(3500);
}

async function getLargestClusterCenter(page) {
  return page.evaluate(() => {
    const markers = Array.from(document.querySelectorAll(".custom-leaflet-icon"));
    const clusters = markers
      .map((el) => {
        const text = (el.textContent || "").trim();
        const count = Number.parseInt(text, 10);
        const rect = el.getBoundingClientRect();
        return {
          count: Number.isFinite(count) ? count : 0,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          visible: rect.width > 0 && rect.height > 0
        };
      })
      .filter((item) => item.visible)
      .sort((a, b) => b.count - a.count);

    return clusters[0] || null;
  });
}

async function waitForAny(page, locators) {
  await Promise.any(locators.map((locator) => locator.waitFor({ state: "visible", timeout: 25_000 })));
}

async function waitForAssistantAnswer(page) {
  await page
    .getByPlaceholder(/AeroSense Core is analyzing telemetry/i)
    .waitFor({ state: "visible", timeout: 8_000 })
    .catch(() => {});
  await page
    .getByPlaceholder(/Ask AeroSense Intelligence/i)
    .waitFor({ state: "visible", timeout: 90_000 })
    .catch(() => {});
  await waitForAny(page, [
    page.locator("a[href]").filter({ hasText: /download|report|pdf|docx|open/i }).first(),
    page.getByText(/Sorry, I could not reach the AI agent/i)
  ]);
  await pause(1500);
}

async function openFirstReportLink(page, testInfo) {
  const reportLink = page
    .locator("a[href]")
    .filter({ hasText: /download|report|pdf|docx|open/i })
    .first();

  if (!(await reportLink.count())) {
    await presentStep(page, "No Report Link Found", "The assistant response is visible, but no report link was rendered.");
    await pause(2500);
    return;
  }

  const downloadPromise = page.waitForEvent("download", { timeout: 10_000 }).catch(() => null);
  const popupPromise = page.waitForEvent("popup", { timeout: 10_000 }).catch(() => null);
  await reportLink.click();

  const download = await downloadPromise;
  const popup = await popupPromise;

  if (download) {
    const suggested = download.suggestedFilename() || "aerosensei-report";
    const savePath = path.join(testInfo.outputDir, suggested);
    await download.saveAs(savePath);
    await presentStep(page, "Report Downloaded", `Saved report artifact: ${suggested}`);
    await pause(2500);
    return;
  }

  if (popup) {
    await popup.waitForLoadState("domcontentloaded").catch(() => {});
    await presentStep(popup, "Generated Report", "The generated report opened in a new tab.");
    await capture(popup, testInfo, "report-tab");
    await pause(3500);
    await popup.close();
    await page.bringToFront();
    return;
  }

  await presentStep(page, "Report Link Clicked", "The report link was clicked. Returning focus to the website.");
  await pause(2500);
}

async function slowScroll(page, passes) {
  for (let i = 0; i < passes; i += 1) {
    await page.mouse.wheel(0, 520);
    await pause(900);
  }
}

async function capture(page, testInfo, name) {
  await page.screenshot({ path: path.join(testInfo.outputDir, `${name}.png`), fullPage: false });
  await pause(700);
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

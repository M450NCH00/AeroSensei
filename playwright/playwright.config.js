const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  timeout: 180_000,
  fullyParallel: false,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "https://ec2-3-107-194-55.ap-southeast-2.compute.amazonaws.com",
    browserName: "chromium",
    headless: false,
    ignoreHTTPSErrors: true,
    viewport: null,
    launchOptions: {
      args: ["--start-maximized"]
    },
    acceptDownloads: true,
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium"
    }
  ],
  outputDir: "artifacts"
});

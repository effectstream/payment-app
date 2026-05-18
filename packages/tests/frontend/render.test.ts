import { assert, findChrome } from "../helpers.ts";
import { chromium } from "playwright-core";

const FRONTEND_PORT = 10599;

export async function frontendRenderTest() {
  const executablePath = process.env.CHROME_PATH || findChrome();
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();

  const jsErrors: string[] = [];
  page.on("pageerror", (err) => jsErrors.push(err.message));

  await page.goto(`http://localhost:${FRONTEND_PORT}/`, {
    waitUntil: "load",
    timeout: 15_000,
  });
  await page.waitForSelector(".container", { timeout: 10_000 });

  await assert("Frontend React app mounts (.container selector)", async () => {
    return (await page.$(".container")) !== null;
  });

  await assert("Frontend renders 18 item cards", async () => {
    const cards = await page.$$(".card");
    return cards.length === 18;
  });

  await assert("Frontend has no fatal JS errors", async () => jsErrors.length === 0);

  await browser.close();
}

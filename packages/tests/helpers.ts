const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

let passCount = 0;
let failCount = 0;

export async function assert(name: string, check: () => Promise<boolean>): Promise<void> {
  process.stdout.write(`  [TEST] ${name}...`);
  try {
    if (await check()) {
      console.log(" PASS");
      passCount++;
    } else {
      console.log(" FAIL");
      failCount++;
      throw new Error(`Assertion failed: ${name}`);
    }
  } catch (e) {
    console.log(" FAIL");
    failCount++;
    throw e;
  }
}

export async function assertSQL<T>(
  name: string,
  db: any,
  query: string,
  waitUntil: (res: { rows: T[] }) => boolean,
  check: (res: { rows: T[] }) => boolean,
  timeoutMs = 60_000,
): Promise<void> {
  process.stdout.write(`  [TEST] ${name}...`);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let res: { rows: T[] };
    try {
      res = await db.query(query);
    } catch (err: any) {
      // The user migration runs when the engine processes block 1, which
      // can happen after the test starts. Wait for the table to exist.
      if (err?.code === "42P01") {
        await delay(500);
        continue;
      }
      throw err;
    }
    if (waitUntil(res)) {
      if (check(res)) {
        console.log(" PASS");
        passCount++;
        return;
      }
      console.log(" FAIL");
      failCount++;
      throw new Error(`Check failed: ${name}`);
    }
    await delay(200);
  }
  console.log(" TIMEOUT");
  failCount++;
  throw new Error(`Timed out waiting: ${name}`);
}

export function printSummary() {
  console.log(`\nResults: ${passCount} passed, ${failCount} failed`);
}

export function anyError() {
  return failCount > 0 || passCount + failCount === 0;
}

export function findChrome(): string {
  const candidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
        ];
  for (const c of candidates) {
    try {
      const stat = (require("node:fs") as typeof import("node:fs")).statSync(c);
      if (stat.isFile()) return c;
    } catch {}
  }
  throw new Error(
    "Chrome/Chromium not found. Set CHROME_PATH env var to override.",
  );
}

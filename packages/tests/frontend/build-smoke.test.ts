import { assert } from "../helpers.ts";
import path from "node:path";

export async function frontendBuildTest() {
  await assert("Frontend vite build exits successfully", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "--filter", "@payment-app/frontend", "build"],
      {
        cwd: path.resolve(import.meta.dirname!, "../../.."),
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    return (await proc.exited) === 0;
  });
}

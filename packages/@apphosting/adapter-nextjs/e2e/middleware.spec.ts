import * as assert from "assert";
import { posix } from "path";
import fsExtra from "fs-extra";

export const host = process.env.HOST;
if (!host) {
  throw new Error("HOST environment variable expected");
}

let adapterVersion: string;
before(() => {
  const packageJson = fsExtra.readJSONSync("package.json");
  adapterVersion = packageJson.version;
  if (!adapterVersion) throw new Error("couldn't parse package.json version");
});

describe("middleware", () => {
  it("should have x-fah-adapter header and x-fah-middleware header on all routes", async () => {
    const routes = [
      "/",
      "/ssg",
      "/ssr",
      "/ssr/streaming",
      "/isr/time",
      "/isr/demand",
      "/nonexistent-route",
    ];

    for (const route of routes) {
      const response = await fetch(posix.join(host, route));
      assert.equal(
        response.headers.get("x-fah-adapter"),
        `nextjs-${adapterVersion}`,
        `Route ${route} missing x-fah-adapter header`,
      );
      assert.equal(
        response.headers.get("x-fah-middleware"),
        "true",
        `Route ${route} missing x-fah-middleware header`,
      );
    }
  });
});

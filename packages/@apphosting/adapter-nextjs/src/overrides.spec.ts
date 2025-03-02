import assert from "assert";
import fs from "fs";
import path from "path";
import os from "os";
import { RoutesManifest, MiddlewareManifest } from "./interfaces.js";
const importOverrides = import("@apphosting/adapter-nextjs/dist/overrides.js");

describe("app hosting overrides", () => {
  describe("addCustomHeaders", () => {
    let tmpDir: string;
    let routesManifestPath: string;
    let middlewareManifestPath: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-manifests-"));
      routesManifestPath = path.join(tmpDir, ".next", "routes-manifest.json");
      middlewareManifestPath = path.join(tmpDir, ".next", "server", "middleware-manifest.json");

      fs.mkdirSync(path.dirname(routesManifestPath), { recursive: true });
      fs.mkdirSync(path.dirname(middlewareManifestPath), { recursive: true });
    });

    it("should add default fah headers to routes manifest", async () => {
      const { addAppHostingOverrides } = await importOverrides;
      const initialManifest: RoutesManifest = {
        version: 3,
        basePath: "",
        pages404: true,
        staticRoutes: [],
        dynamicRoutes: [],
        dataRoutes: [],
        headers: [
          {
            source: "/existing",
            headers: [{ key: "X-Custom", value: "test" }],
            regex: "^/existing$",
          },
        ],
        rewrites: [],
        redirects: [],
      };

      fs.writeFileSync(routesManifestPath, JSON.stringify(initialManifest));
      fs.writeFileSync(
        middlewareManifestPath,
        JSON.stringify({ version: 1, sortedMiddleware: [], middleware: {}, functions: {} }),
      );

      await addAppHostingOverrides(tmpDir, ".next", {
        adapterPackageName: "@apphosting/adapter-nextjs",
        adapterVersion: "1.0.0",
      });

      const updatedManifest = JSON.parse(
        fs.readFileSync(routesManifestPath, "utf-8"),
      ) as RoutesManifest;

      const expectedHeaders = [
        {
          source: "/existing",
          headers: [{ key: "X-Custom", value: "test" }],
          regex: "^/existing$",
        },
        {
          source: "/:path*",
          regex: "^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))?(?:/)?$",
          headers: [
            {
              key: "x-fah-adapter",
              value: "nextjs-1.0.0",
            },
          ],
        },
      ];

      assert.deepStrictEqual(updatedManifest.headers, expectedHeaders);
    });

    it("should add middleware header when middleware exists", async () => {
      const { addAppHostingOverrides } = await importOverrides;
      const initialManifest: RoutesManifest = {
        version: 3,
        basePath: "",
        pages404: true,
        staticRoutes: [],
        dynamicRoutes: [],
        dataRoutes: [],
        headers: [],
        rewrites: [],
        redirects: [],
      };

      const middlewareManifest: MiddlewareManifest = {
        version: 3,
        sortedMiddleware: ["/"],
        middleware: {
          "/": {
            files: ["middleware.ts"],
            name: "middleware",
            page: "/",
            matchers: [
              {
                regexp: "^/.*$",
                originalSource: "/:path*",
              },
            ],
          },
        },
        functions: {},
      };

      fs.writeFileSync(routesManifestPath, JSON.stringify(initialManifest));
      fs.writeFileSync(middlewareManifestPath, JSON.stringify(middlewareManifest));

      await addAppHostingOverrides(tmpDir, ".next", {
        adapterPackageName: "@apphosting/adapter-nextjs",
        adapterVersion: "1.0.0",
      });

      const updatedManifest = JSON.parse(
        fs.readFileSync(routesManifestPath, "utf-8"),
      ) as RoutesManifest;

      assert.strictEqual(updatedManifest.headers.length, 1);

      const expectedHeaders = [
        {
          source: "/:path*",
          regex: "^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))?(?:/)?$",
          headers: [
            {
              key: "x-fah-adapter",
              value: "nextjs-1.0.0",
            },
            { key: "x-fah-middleware", value: "true" },
          ],
        },
      ];

      assert.deepStrictEqual(updatedManifest.headers, expectedHeaders);
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe("addImageOptimizationRewrites", () => {
    const expectedRewrites = [
      {
        source: "/_next/image",
        has: [
          {
            type: "query",
            key: "url",
            value: "http://(?<host>.+)/(?<path>.+)",
          },
        ],
        destination: "http://:host/:path",
        basePath: false,
        regex: "^/_next/image(?:/)?$",
      },
      {
        source: "/_next/image",
        has: [
          {
            type: "query",
            key: "url",
            value: "https://(?<host>.+)/(?<path>.+)",
          },
        ],
        destination: "https://:host/:path",
        basePath: false,
        regex: "^/_next/image(?:/)?$",
      },
    ];

    it("should add image optimization rewrites to empty rewrites array", async () => {
      const { addImageOptimizationRewrites } = await importOverrides;

      const routeManifest: RoutesManifest = {
        version: 1,
        pages404: false,
        basePath: "",
        redirects: [],
        headers: [],
        dynamicRoutes: [],
        staticRoutes: [],
        dataRoutes: [],
        rewrites: [],
      };

      const result = await addImageOptimizationRewrites(routeManifest);

      assert.deepEqual(result.rewrites, [...expectedRewrites]);
    });

    it("should add image optimization rewrites to empty rewrites.beforeFiles array", async () => {
      const { addImageOptimizationRewrites } = await importOverrides;

      const routeManifest: RoutesManifest = {
        version: 1,
        pages404: false,
        basePath: "",
        redirects: [],
        headers: [],
        dynamicRoutes: [],
        staticRoutes: [],
        dataRoutes: [],
        rewrites: {
          beforeFiles: [],
          afterFiles: [],
          fallback: [],
        },
      };

      const result = await addImageOptimizationRewrites(routeManifest);

      assert.deepEqual(result.rewrites, {
        ...routeManifest.rewrites,
        beforeFiles: [...expectedRewrites],
      });
    });

    it("should not add image optimization rewrites if a rewrite already exists with same source", async () => {
      const { addImageOptimizationRewrites } = await importOverrides;

      const routeManifest: RoutesManifest = {
        version: 1,
        pages404: false,
        basePath: "",
        redirects: [],
        headers: [],
        dynamicRoutes: [],
        staticRoutes: [],
        dataRoutes: [],
        rewrites: [
          {
            source: "/_next/image",
            destination: "/custom-image-handler",
            regex: "^/_next/image(?:/)?$",
          },
        ],
      };

      const result = await addImageOptimizationRewrites(routeManifest);
      assert.deepEqual(result, routeManifest);
    });

    it("should not add image optimization rewrites if rewrite already exists with same source in beforeFiles", async () => {
      const { addImageOptimizationRewrites } = await importOverrides;

      const routeManifest: RoutesManifest = {
        version: 1,
        pages404: false,
        basePath: "",
        redirects: [],
        headers: [],
        dynamicRoutes: [],
        staticRoutes: [],
        dataRoutes: [],
        rewrites: {
          beforeFiles: [
            {
              source: "/_next/image",
              destination: "/custom-image-handler",
              regex: "^/_next/image(?:/)?$",
            },
          ],
          afterFiles: [],
          fallback: [],
        },
      };

      const result = await addImageOptimizationRewrites(routeManifest);
      assert.deepEqual(result, routeManifest);
    });

    it("should handle null rewrites by creating the structure", async () => {
      const { addImageOptimizationRewrites } = await importOverrides;

      const routeManifest: RoutesManifest = {
        version: 1,
        pages404: false,
        basePath: "",
        redirects: [],
        headers: [],
        dynamicRoutes: [],
        staticRoutes: [],
        dataRoutes: [],
      } as any;

      const result = await addImageOptimizationRewrites(routeManifest);

      assert.deepEqual(result.rewrites, {
        beforeFiles: [...expectedRewrites],
        afterFiles: [],
        fallback: [],
      });
    });
  });
});

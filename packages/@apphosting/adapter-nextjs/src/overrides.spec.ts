import assert from "assert";
import fs from "fs";
import path from "path";
import os from "os";
import { RoutesManifest, MiddlewareManifest } from "./interfaces.js";
const importOverrides = import("@apphosting/adapter-nextjs/dist/overrides.js");

describe("route overrides", () => {
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
    const { addRouteOverrides } = await importOverrides;
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

    await addRouteOverrides(tmpDir, ".next", {
      adapterPackageName: "@apphosting/adapter-nextjs",
      adapterVersion: "1.0.0",
    });

    const updatedManifest = JSON.parse(
      fs.readFileSync(routesManifestPath, "utf-8"),
    ) as RoutesManifest;

    const expectedManifest: RoutesManifest = {
      version: 3,
      basePath: "",
      pages404: true,
      staticRoutes: [],
      dynamicRoutes: [],
      dataRoutes: [],
      redirects: [],
      rewrites: [],
      headers: [
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
      ],
    };

    assert.deepStrictEqual(updatedManifest, expectedManifest);
  });

  it("should add middleware header when middleware exists", async () => {
    const { addRouteOverrides } = await importOverrides;
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

    await addRouteOverrides(tmpDir, ".next", {
      adapterPackageName: "@apphosting/adapter-nextjs",
      adapterVersion: "1.0.0",
    });

    const updatedManifest = JSON.parse(
      fs.readFileSync(routesManifestPath, "utf-8"),
    ) as RoutesManifest;

    assert.strictEqual(updatedManifest.headers.length, 1);

    const expectedManifest: RoutesManifest = {
      version: 3,
      basePath: "",
      pages404: true,
      staticRoutes: [],
      dynamicRoutes: [],
      dataRoutes: [],
      rewrites: [],
      redirects: [],
      headers: [
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
      ],
    };

    assert.deepStrictEqual(updatedManifest, expectedManifest);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("next config overrides", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-overrides"));
  });

  it("should set images.unoptimized to true - js normal config", async () => {
    const { overrideNextConfig } = await importOverrides;
    const originalConfig = `
    // @ts-check
 
    /** @type {import('next').NextConfig} */
    const nextConfig = {
      /* config options here */
    }
    
    module.exports = nextConfig
    `;

    fs.writeFileSync(path.join(tmpDir, "next.config.js"), originalConfig);
    await overrideNextConfig(tmpDir, "next.config.js");

    const updatedConfig = fs.readFileSync(path.join(tmpDir, "next.config.js"), "utf-8");

    assert.equal(
      normalizeWhitespace(updatedConfig),
      normalizeWhitespace(`
      const originalConfig = require('./next.config.original.js');
      
      // This file was automatically generated by Firebase App Hosting adapter
      const config = typeof originalConfig === 'function' 
        ? (...args) => {
            const resolvedConfig = originalConfig(...args);
              return {
                ...resolvedConfig,
                images: {
                  ...(resolvedConfig.images || {}),
                  unoptimized: true,
                },
              };
        }
        : {
            ...originalConfig,
            images: {
              ...(originalConfig.images || {}),
              unoptimized: true,
            },
          };

      module.exports = config;
      `),
    );
  });

  it("should set images.unoptimized to true - ECMAScript Modules", async () => {
    const { overrideNextConfig } = await importOverrides;
    const originalConfig = `
    // @ts-check
    
    /**
     * @type {import('next').NextConfig}
     */
    const nextConfig = {
      /* config options here */
    }
    
    export default nextConfig
    `;

    fs.writeFileSync(path.join(tmpDir, "next.config.mjs"), originalConfig);
    await overrideNextConfig(tmpDir, "next.config.mjs");

    const updatedConfig = fs.readFileSync(path.join(tmpDir, "next.config.mjs"), "utf-8");
    assert.equal(
      normalizeWhitespace(updatedConfig),
      normalizeWhitespace(`
      import originalConfig from './next.config.original.mjs';

      // This file was automatically generated by Firebase App Hosting adapter
      const config = typeof originalConfig === 'function' 
        ? (...args) => {
            const resolvedConfig = originalConfig(...args);
            return {
              ...resolvedConfig,
              images: {
                ...(resolvedConfig.images || {}),
                unoptimized: true,
              },
            };
        }
        : {
            ...originalConfig,
            images: {
              ...(originalConfig.images || {}),
              unoptimized: true,
            },
          };
      
      export default config;
      `),
    );
  });

  it("should set images.unoptimized to true - ECMAScript Function", async () => {
    const { overrideNextConfig } = await importOverrides;
    const originalConfig = `
    // @ts-check
    
    export default (phase, { defaultConfig }) => {
      /**
       * @type {import('next').NextConfig}
       */
      const nextConfig = {
        /* config options here */
      }
      return nextConfig
    }
    `;

    fs.writeFileSync(path.join(tmpDir, "next.config.mjs"), originalConfig);
    await overrideNextConfig(tmpDir, "next.config.mjs");

    const updatedConfig = fs.readFileSync(path.join(tmpDir, "next.config.mjs"), "utf-8");
    assert.equal(
      normalizeWhitespace(updatedConfig),
      normalizeWhitespace(`
      import originalConfig from './next.config.original.mjs';

      // This file was automatically generated by Firebase App Hosting adapter
      const config = typeof originalConfig === 'function' 
        ? (...args) => {
            const resolvedConfig = originalConfig(...args);
            return {
              ...resolvedConfig,
              images: {
                ...(resolvedConfig.images || {}),
                unoptimized: true,
              },
            };
          }
        : {
            ...originalConfig,
            images: {
              ...(originalConfig.images || {}),
              unoptimized: true,
            },
          };
      
      export default config;
      `),
    );
  });

  it("should set images.unoptimized to true - TypeScript", async () => {
    const { overrideNextConfig } = await importOverrides;
    const originalConfig = `
    import type { NextConfig } from 'next'
    
    const nextConfig: NextConfig = {
      /* config options here */
    }
    
    export default nextConfig
    `;

    fs.writeFileSync(path.join(tmpDir, "next.config.ts"), originalConfig);
    await overrideNextConfig(tmpDir, "next.config.ts");

    const updatedConfig = fs.readFileSync(path.join(tmpDir, "next.config.ts"), "utf-8");
    assert.equal(
      normalizeWhitespace(updatedConfig),
      normalizeWhitespace(`
      import originalConfig from './next.config.original';
      
      // This file was automatically generated by Firebase App Hosting adapter
      const config = typeof originalConfig === 'function' 
        ? (...args) => {
            const resolvedConfig = originalConfig(...args);
            return {
              ...resolvedConfig,
              images: {
                ...(resolvedConfig.images || {}),
                unoptimized: true,
              },
            };
          }
        : {
            ...originalConfig,
            images: {
              ...(originalConfig.images || {}),
              unoptimized: true,
            },
          };
      
      module.exports = config;
      `),
    );
  });
});

// Normalize whitespace for comparison
function normalizeWhitespace(str: string) {
  return str.replace(/\s+/g, " ").trim();
}

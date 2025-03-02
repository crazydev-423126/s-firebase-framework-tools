import {
  AdapterMetadata,
  MiddlewareManifest,
  RoutesManifest,
  RoutesManifestRewrite,
} from "./interfaces.js";
import { loadRouteManifest, writeRouteManifest, loadMiddlewareManifest } from "./utils.js";

/**
 * Modifies the app's route manifest (routes-manifest.json) to add Firebase App Hosting
 * specific overrides (i.e headers).
 *
 * This function adds the following headers to all routes:
 * - x-fah-adapter: The Firebase App Hosting adapter version used to build the app.
 * - x-fah-middleware: When middleware is enabled.
 *
 * @param appPath The path to the app directory.
 * @param distDir The path to the dist directory.
 * @param adapterMetadata The adapter metadata.
 */
export async function addAppHostingOverrides(
  appPath: string,
  distDir: string,
  adapterMetadata: AdapterMetadata,
) {
  const middlewareManifest = loadMiddlewareManifest(appPath, distDir);
  let routeManifest = loadRouteManifest(appPath, distDir);

  routeManifest = await addCustomHeaders(routeManifest, adapterMetadata, middlewareManifest);
  routeManifest = await addImageOptimizationRewrites(routeManifest);
  await writeRouteManifest(appPath, distDir, routeManifest);
}

async function addCustomHeaders(
  routeManifest: RoutesManifest,
  adapterMetadata: AdapterMetadata,
  middlewareManifest: MiddlewareManifest,
): Promise<RoutesManifest> {
  routeManifest.headers.push({
    source: "/:path*",
    headers: [
      {
        key: "x-fah-adapter",
        value: `nextjs-${adapterMetadata.adapterVersion}`,
      },
      ...(middlewareExists(middlewareManifest)
        ? [
            {
              key: "x-fah-middleware",
              value: "true",
            },
          ]
        : []),
    ],
    /* 
      NextJs converts the source string to a regex using path-to-regexp (https://github.com/pillarjs/path-to-regexp) at 
      build time: https://github.com/vercel/next.js/blob/canary/packages/next/src/build/index.ts#L1273.
      This regex is then used to match the route against the request path.

      This regex was generated by building a sample NextJs app with the source string `/:path*` and then inspecting the
      routes-manifest.json file.
    */
    regex: "^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))?(?:/)?$",
  });

  return routeManifest;
}

async function addImageOptimizationRewrites(
  routeManifest: RoutesManifest,
): Promise<RoutesManifest> {
  const IMAGE_OPTIMIZATION_REWRITES: RoutesManifestRewrite[] = [
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

  if (!routeManifest.rewrites) {
    routeManifest.rewrites = {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    };
  }

  // Avoid image optimization rewrite if there are already rewrite rules for /_next/image
  if (Array.isArray(routeManifest.rewrites)) {
    if (routeManifest.rewrites.some((r) => r.source.startsWith("/_next/image"))) {
      console.log("Rewrite already exists for /_next/image");
      return routeManifest;
    }
  } else {
    if (routeManifest.rewrites.beforeFiles?.some((r) => r.source.startsWith("/_next/image"))) {
      console.log("Rewrite already exists for /_next/image");
      return routeManifest;
    }
  }

  // Add the image optimization rewrites
  if (Array.isArray(routeManifest.rewrites)) {
    routeManifest.rewrites.push(...IMAGE_OPTIMIZATION_REWRITES);
  } else {
    // Maintain the structure with beforeFiles, afterFiles, and fallback
    if (!routeManifest.rewrites.beforeFiles) {
      routeManifest.rewrites.beforeFiles = [];
    }

    routeManifest.rewrites.beforeFiles.push(...IMAGE_OPTIMIZATION_REWRITES);
  }

  return routeManifest;
}

function middlewareExists(middlewareManifest: MiddlewareManifest) {
  return Object.keys(middlewareManifest.middleware).length > 0;
}

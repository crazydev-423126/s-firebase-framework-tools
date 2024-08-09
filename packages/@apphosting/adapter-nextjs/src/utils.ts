import fsExtra from "fs-extra";
import { createRequire } from "node:module";
import { join, relative, normalize } from "path";
import { fileURLToPath } from "url";
import { stringify as yamlStringify } from "yaml";

import { PHASE_PRODUCTION_BUILD } from "./constants.js";
import { OutputBundleOptions } from "./interfaces.js";
import { NextConfigComplete } from "next/dist/server/config-shared.js";
import { OutputBundle } from "@apphosting/common/dist/index.js";

// fs-extra is CJS, readJson can't be imported using shorthand
export const { move, exists, writeFile, readJson, readdir, mkdir } = fsExtra;

// Loads the user's next.config.js file.
export async function loadConfig(root: string, projectRoot: string): Promise<NextConfigComplete> {
  // createRequire() gives us access to Node's CommonJS implementation of require.resolve()
  // (https://nodejs.org/api/module.html#modulecreaterequirefilename).
  // We use the require.resolve() resolution algorithm to get the path to the next config module,
  // which may reside in the node_modules folder at a higher level in the directory structure
  // (e.g. for monorepo projects).
  // Note that ESM has an equivalent (https://nodejs.org/api/esm.html#importmetaresolvespecifier),
  // but the feature is still experimental.
  const require = createRequire(import.meta.url);
  const configPath = require.resolve("next/dist/server/config.js", { paths: [projectRoot] });
  // dynamically load NextJS so this can be used in an NPX context
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { default: nextServerConfig }: { default: typeof import("next/dist/server/config.js") } =
    await import(configPath);

  const loadConfig = nextServerConfig.default;
  return await loadConfig(PHASE_PRODUCTION_BUILD, root);
}

export const isMain = (meta: ImportMeta): boolean => {
  if (!meta) return false;
  if (!process.argv[1]) return false;
  return process.argv[1] === fileURLToPath(meta.url);
};

/**
 * Provides the paths in the output bundle for the built artifacts.
 * @param rootDir The root directory of the uploaded source code.
 * @param appDir The path to the application source code, relative to the root.
 * @return The output bundle paths.
 */
export function populateOutputBundleOptions(
  rootDir: string,
  appDir: string,
  nextBuildDirectory: string,
): OutputBundleOptions {
  const outputBundleDir = join(rootDir, ".apphosting");
  const standaloneDirectory = join(nextBuildDirectory, "standalone");
  // In monorepo setups, the standalone directory structure will mirror the structure of the monorepo.
  // We find the relative path from the root to the app directory to correctly locate server.js.
  const standaloneAppPath = join(
    standaloneDirectory,
    process.env.MONOREPO_COMMAND ? relative(rootDir, appDir) : "",
  );
  return {
    bundleYamlPath: join(outputBundleDir, "bundle.yaml"),
    outputDirectoryBasePath: outputBundleDir,
    outputDirectoryAppPath: standaloneAppPath,
    serverFilePath: join(standaloneAppPath, "server.js"),
    outputPublicDirectoryPath: join(standaloneAppPath, "public"),
    outputStaticDirectoryPath: join(standaloneAppPath, ".next", "static"),
  };
}

/**
 * Moves static assets into the standlone directory and generates the bundle.yaml
 * @param rootDir The root directory of the uploaded source code.
 * @param outputBundleOptions The target location of built artifacts in the output bundle.
 * @param nextBuildDirectory The location of the .next directory.
 */
export async function generateBuildOutput(
  rootDir: string,
  appDir: string,
  opts: OutputBundleOptions,
  nextBuildDirectory: string,
): Promise<void> {
  const staticDirectory = join(nextBuildDirectory, "static");
  const publicDirectory = join(appDir, "public");
  await Promise.all([
    move(staticDirectory, opts.outputStaticDirectoryPath, { overwrite: true }),
    movePublicDirectory(publicDirectory, opts.outputPublicDirectoryPath),
    generateBundleYaml(opts, rootDir),
  ]);
  return;
}

// Move all files and directories to apphosting output directory.
// Files are skipped if there is already a file with the same name in the output directory
async function moveResources(appDir: string, outputBundleAppDir: string): Promise<void> {
  const appDirExists = await exists(appDir);
  if (!appDirExists) return;
  const pathsToMove = await readdir(appDir);
  for (const path of pathsToMove) {
    const isOutputBundleDir = join(appDir, path) === outputBundleAppDir;
    const existsInOutputBundle = await exists(join(outputBundleAppDir, path));
    if (!isOutputBundleDir && !existsInOutputBundle) {
      await move(join(appDir, path), join(outputBundleAppDir, path));
    }
  }
  return;
}
// move public directory to apphosting output public directory
async function movePublicDirectory(
  publicDirectory: string,
  appHostingPublicDirectory: string,
): Promise<void> {
  const publicDirectoryExists = await exists(publicDirectory);
  if (!publicDirectoryExists) return;
  await move(publicDirectory, appHostingPublicDirectory, { overwrite: true });
  return;
}

// generate bundle.yaml
async function generateBundleYaml(opts: OutputBundleOptions, cwd: string): Promise<void> {
  await mkdir(opts.outputDirectoryBasePath);
  const outputBundle: OutputBundle = {
    version: "v1alpha",
    serverConfig: {
      runCommand: ["node", normalize(relative(cwd, opts.serverFilePath))],
    },
    metadata: {
      adapterNpmPackageName: "@apphosting/adapter-nextjs",
      framework: "nextjs",
    },
  };
  await writeFile(
    opts.bundleYamlPath,
    yamlStringify({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      outputBundle,
    }),
  );
  return;
}

// Validate output directory includes all necessary parts
export async function validateOutputDirectory(
  outputBundleOptions: OutputBundleOptions,
  nextBuildDirectory: string,
): Promise<void> {
  const standaloneDirectory = join(nextBuildDirectory, "standalone");
  if (
    !(await fsExtra.exists(nextBuildDirectory)) ||
    !(await fsExtra.exists(standaloneDirectory)) ||
    !(await fsExtra.exists(outputBundleOptions.bundleYamlPath))
  ) {
    throw new Error("Output directory is not of expected structure");
  }
}

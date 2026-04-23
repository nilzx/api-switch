"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "dist");

async function build() {
  await fs.rm(distRoot, { recursive: true, force: true });
  await copySourceTree();
  await copyBinTree();
}

async function copySourceTree() {
  const sourceRoot = path.join(projectRoot, "src");
  await copyDirectory(sourceRoot, distRoot);
}

async function copyBinTree() {
  const sourceRoot = path.join(projectRoot, "bin");
  const targetRoot = path.join(distRoot, "bin");
  await fs.mkdir(targetRoot, { recursive: true });
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const sourcePath = path.join(sourceRoot, entry.name);
    const targetPath = path.join(targetRoot, entry.name);
    const source = await fs.readFile(sourcePath, "utf8");
    const built = source.replace("../src/index.js", "../index.js");

    await fs.writeFile(targetPath, built, "utf8");
    await fs.chmod(targetPath, 0o755);
  }
}

async function copyDirectory(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    await fs.copyFile(sourcePath, targetPath);
  }
}

build().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

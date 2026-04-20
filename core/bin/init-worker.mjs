#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const packageRootDirectory = path.resolve(path.dirname(currentFilePath), '..');
const workerSourcePath = path.join(
  packageRootDirectory,
  'dist',
  'shared',
  'shared-worker.js'
);

function printHelp() {
  console.log(`
mrgt-sse CLI

Usage:
  mrgt-sse init-worker [outputPath]

Examples:
  mrgt-sse init-worker
  mrgt-sse init-worker public/sse/shared-worker.js
`.trim());
}

function ensureParentDirectory(filePath) {
  const directoryPath = path.dirname(filePath);
  fs.mkdirSync(directoryPath, { recursive: true });
}

function copyWorkerFile(outputPath) {
  if (!fs.existsSync(workerSourcePath)) {
    console.error(
      '[mrgt-sse] Worker source not found. Build output is missing at:',
      workerSourcePath
    );
    process.exit(1);
  }

  const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
  ensureParentDirectory(absoluteOutputPath);
  fs.copyFileSync(workerSourcePath, absoluteOutputPath);

  console.log('[mrgt-sse] Shared worker copied to:', absoluteOutputPath);
  console.log(
    '[mrgt-sse] Set workerPath to:',
    `/${path.relative(path.resolve(process.cwd(), 'public'), absoluteOutputPath).replace(/\\/g, '/')}`
  );
}

function run() {
  const [, , command, outputPathArgument] = process.argv;

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command !== 'init-worker') {
    console.error(`[mrgt-sse] Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  const outputPath = outputPathArgument ?? 'public/shared-worker.js';
  copyWorkerFile(outputPath);
}

run();

#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

import { createProject, detectPackageManager, installArgs } from '../src/index.js';
import { getMessages } from '../src/messages.js';

const messages = getMessages();
const args = process.argv.slice(2);
const yes = args.includes('--yes') || args.includes('-y') || !process.stdin.isTTY;
const noInstall = args.includes('--no-install');
const target = args.find((arg) => !arg.startsWith('-')) ?? '.';

const rl = yes ? null : createInterface({ input: process.stdin, output: process.stdout });

async function confirm(message) {
  if (!rl) return true;
  const answer = (await rl.question(`${message} (Y/n) `)).trim().toLowerCase();
  return answer === '' || answer === 'y' || answer === 'yes' || answer === '是';
}

console.log(`\n@guoyunhe/create - ${messages.intro}\n`);

const projectPath = resolve(process.cwd(), target);
const options = {
  projectPath,
  packageManager: detectPackageManager(),
  editorconfig: await confirm(messages.enableEditorConfig),
  oxfmt: await confirm(messages.enableOxfmt),
  oxlint: await confirm(messages.enableOxlint),
  vscode: await confirm(messages.enableVscode),
  huskyLintStaged: await confirm(messages.enableHuskyLintStaged),
};

const { written, deps } = await createProject(options);
if (options.huskyLintStaged) {
  await chmod(join(projectPath, '.husky', 'pre-commit'), 0o755);
}
for (const file of written) console.log(`  ${messages.created}: ${file}`);

if (deps.length > 0 && !noInstall && (await confirm(messages.installDependencies))) {
  console.log(`\n${messages.installing}`);
  const result = spawnSync(options.packageManager, installArgs(options.packageManager, deps), {
    cwd: projectPath,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) console.error(messages.installFailed);
}

rl?.close();
console.log(`\n${messages.done}`);

#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { createProject, detectPackageManager, installArgs } from './index.ts';
import { getMessages } from './messages.ts';

const messages = getMessages();
const program = new Command();
program
  .name('@guoyunhe/create')
  .description(messages.intro)
  .argument('[project-directory]', messages.projectPath, '.')
  .option('-y, --yes', messages.acceptAllDefaults)
  .option('--no-install', messages.skipDependencyInstall)
  .parse(process.argv);

const { yes: acceptAllDefaults, install } = program.opts<{
  yes?: boolean;
  install?: boolean;
}>();
const yes = acceptAllDefaults || !process.stdin.isTTY;
const noInstall = install === false;
const target = program.args[0] ?? '.';

async function confirm(message: string): Promise<boolean> {
  if (yes) return true;
  const answer = await p.confirm({ message, initialValue: true });
  if (p.isCancel(answer)) {
    p.cancel(messages.cancelled);
    process.exit(0);
  }
  return answer;
}

p.intro(`@guoyunhe/create - ${messages.intro}`);

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
for (const file of written) p.log.success(`${messages.created}: ${file}`);

if (deps.length > 0 && !noInstall && (await confirm(messages.installDependencies))) {
  p.log.info(messages.installing);
  const result = spawnSync(options.packageManager, installArgs(options.packageManager, deps), {
    cwd: projectPath,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) console.error(messages.installFailed);
}

p.outro(messages.done);

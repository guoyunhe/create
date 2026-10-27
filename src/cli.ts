#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { chmod } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import * as p from '@clack/prompts';
import { Command } from 'commander';

import { createProject, detectPackageManager, installArgs, type OxlintConfig } from './index.ts';
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

async function confirm(message: string, initialValue = true): Promise<boolean> {
  if (yes) return true;
  const answer = await p.confirm({ message, initialValue });
  if (p.isCancel(answer)) {
    p.cancel(messages.cancelled);
    process.exit(0);
  }
  return answer;
}

async function selectOxlintConfigs(): Promise<OxlintConfig[]> {
  const answer = await p.multiselect({
    message: messages.selectOxlintConfigs,
    options: [
      { value: 'react', label: messages.oxlintReactConfig },
      { value: 'jsx-a11y', label: messages.oxlintJsxA11yConfig },
    ],
    required: false,
  });
  if (p.isCancel(answer)) {
    p.cancel(messages.cancelled);
    process.exit(0);
  }
  return answer;
}

p.intro(`@guoyunhe/create - ${messages.intro}`);

const oxlintConfigs: OxlintConfig[] = yes ? ['react', 'jsx-a11y'] : await selectOxlintConfigs();
const stylelint = yes ? true : await confirm(messages.enableStylelint, false);
const projectPath = path.resolve(process.cwd(), target);
const options = {
  projectPath,
  packageManager: detectPackageManager(),
  editorconfig: true,
  oxfmt: true,
  oxlint: true,
  oxlintConfigs,
  stylelint,
  vscode: true,
  huskyLintStaged: true,
};

const { written, deps } = await createProject(options);
await chmod(path.join(projectPath, '.husky', 'pre-commit'), 0o755);
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

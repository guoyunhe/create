import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createProject, detectPackageManager } from './index.ts';
import { getMessages, zh, en } from './messages.ts';

test('creates all configuration files', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'create-'));
  const { deps } = await createProject({ projectPath: dir });
  const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.prepare, 'husky');
  assert.ok(pkg['lint-staged']);
  assert.ok(deps.includes('@guoyunhe/oxfmt-config'));
  assert.ok(deps.includes('oxlint'));
  assert.ok(deps.includes('oxlint-config-recommended'));
  assert.match(await readFile(path.join(dir, '.husky/pre-commit'), 'utf8'), /lint-staged/);
  await readFile(path.join(dir, '.editorconfig'));
  await readFile(path.join(dir, 'oxfmt.config.ts'));
  const oxlintConfig = await readFile(path.join(dir, 'oxlint.config.ts'), 'utf8');
  assert.match(oxlintConfig, /oxlint-config-recommended\/react/);
  assert.match(oxlintConfig, /oxlint-config-recommended\/jsx-a11y/);
  await readFile(path.join(dir, '.vscode/settings.json'));
});

test('detects package manager and locale', () => {
  assert.equal(detectPackageManager({ npm_config_user_agent: 'pnpm/9 npm/?' }), 'pnpm');
  assert.equal(detectPackageManager({}), 'npm');
  assert.equal(getMessages({ LANG: 'zh_CN.UTF-8' }), zh);
  assert.equal(getMessages({ LANG: 'en_US.UTF-8' }), en);
});

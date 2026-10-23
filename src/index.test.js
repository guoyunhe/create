import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { createProject, detectPackageManager } from './index.js';
import { getMessages, zh, en } from './messages.js';

test('creates all configuration files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'create-'));
  const { deps } = await createProject({ projectPath: dir });
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8'));
  assert.equal(pkg.scripts.prepare, 'husky');
  assert.ok(pkg['lint-staged']);
  assert.ok(deps.includes('@guoyunhe/oxfmt-config'));
  assert.match(await readFile(join(dir, '.husky/pre-commit'), 'utf-8'), /lint-staged/);
  await readFile(join(dir, '.editorconfig'));
  await readFile(join(dir, 'oxfmt.config.ts'));
  await readFile(join(dir, '.vscode/settings.json'));
});

test('detects package manager and locale', () => {
  assert.equal(detectPackageManager({ npm_config_user_agent: 'pnpm/9 npm/?' }), 'pnpm');
  assert.equal(detectPackageManager({}), 'npm');
  assert.equal(getMessages({ LANG: 'zh_CN.UTF-8' }), zh);
  assert.equal(getMessages({ LANG: 'en_US.UTF-8' }), en);
});

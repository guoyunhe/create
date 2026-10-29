import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, mock, test } from 'node:test';

import { satisfies } from 'semver';

import { createProject, detectPackageManager } from './index.ts';
import { getMessages, zh, en } from './messages.ts';

beforeEach(() => {
  mock.method(globalThis, 'fetch', async (input: Parameters<typeof globalThis.fetch>[0]) => {
    const url = input instanceof globalThis.Request ? input.url : String(input);
    if (url === 'https://registry.npmjs.org/pnpm/latest') {
      return globalThis.Response.json({ version: '12.14.0' });
    }
    if (
      url ===
      'https://raw.githubusercontent.com/guoyunhe/editorconfig/refs/heads/main/node/.editorconfig'
    ) {
      return new globalThis.Response('root = true\n');
    }
    if (url === 'https://endoflife.date/api/v1/products/nodejs') {
      return globalThis.Response.json({
        result: {
          releases: [
            {
              name: '22',
              releaseDate: '2024-04-24',
              isEol: false,
              latest: { name: '22.17.1' },
            },
            {
              name: '24',
              releaseDate: '2025-05-06',
              isEol: false,
              latest: { name: '24.5.0' },
            },
            {
              name: '25',
              releaseDate: '2025-10-15',
              isEol: true,
              latest: { name: '25.0.0' },
            },
            {
              name: '26',
              releaseDate: '2026-04-01',
              isEol: false,
              latest: { name: '26.0.0' },
            },
            {
              name: '27',
              releaseDate: '2099-01-01',
              isEol: false,
              latest: { name: '27.0.0' },
            },
          ],
        },
      });
    }
    throw new Error(`Unexpected API request: ${url}`);
  });
});

afterEach(() => mock.restoreAll());

test('creates all configuration files', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'create-'));
  const { created, updated, deps } = await createProject({ projectPath: dir });
  assert.ok(created.includes('package.json'));
  assert.deepEqual(updated, []);
  const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.prepare, 'husky');
  assert.deepEqual(pkg.author, {
    name: 'Guo Yunhe',
    email: 'i@guoyunhe.me',
    url: 'https://guoyunhe.me/',
  });
  assert.equal(pkg.funding, 'https://ko-fi.com/guoyunhe');
  assert.deepEqual(pkg.devEngines.packageManager, {
    name: 'pnpm',
    version: '>=12.14.0',
    onFail: 'error',
  });
  assert.equal(pkg.engines.node, '^22.0.0 || ^24.0.0 || ^26.0.0 || >=27.0.0');
  assert.equal(satisfies('25.0.0', pkg.engines.node), false);
  assert.equal(satisfies('26.0.0', pkg.engines.node), true);
  assert.equal(satisfies('30.0.0', pkg.engines.node), true);
  assert.equal(pkg.packageManager, undefined);
  assert.ok(pkg['lint-staged']);
  assert.ok(!deps.includes('stylelint'));
  assert.ok(!deps.includes('stylelint-config-standard'));
  assert.deepEqual(pkg['lint-staged']['*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,vue}'], [
    'oxfmt --write',
    'oxlint --fix',
  ]);
  assert.equal(pkg['lint-staged']['*.css'], 'oxfmt --write');
  assert.equal(
    pkg['lint-staged']['*.{json,jsonc,scss,less,htm,html,md,mdx,yaml,yml}'],
    'oxfmt --write',
  );
  assert.ok(deps.includes('@guoyunhe/oxfmt-config'));
  assert.ok(!deps.includes('@guoyunhe/editorconfig'));
  assert.ok(deps.includes('oxlint'));
  assert.ok(deps.includes('oxlint-config-recommended'));
  assert.match(await readFile(path.join(dir, '.husky/pre-commit'), 'utf8'), /lint-staged/);
  assert.equal(await readFile(path.join(dir, '.editorconfig'), 'utf8'), 'root = true\n');
  await readFile(path.join(dir, 'oxfmt.config.ts'));
  const oxlintConfig = await readFile(path.join(dir, 'oxlint.config.ts'), 'utf8');
  assert.match(oxlintConfig, /oxlint-config-recommended\/react/);
  assert.match(oxlintConfig, /oxlint-config-recommended\/jsx-a11y/);
  assert.match(oxlintConfig, /oxlint-config-recommended\/unicorn/);
  const settings = JSON.parse(await readFile(path.join(dir, '.vscode/settings.json'), 'utf8'));
  assert.equal(settings['oxc.enable'], true);
  assert.equal(settings['editor.codeActionsOnSave']['source.fixAll.oxc'], 'always');
});

test('removes existing Prettier and ESLint configuration while preserving unrelated settings', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'create-'));
  await mkdir(path.join(dir, '.vscode'));
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      prettier: { singleQuote: true },
      eslintConfig: { extends: ['eslint:recommended'] },
      eslintIgnore: ['dist'],
      packageManager: 'pnpm@9.0.0',
      devEngines: { runtime: { name: 'node' } },
      engines: { npm: '>=8' },
      scripts: {
        format: 'prettier --write .',
        lint: 'eslint .',
        'eslint:fix': 'eslint --fix .',
        test: 'vitest',
      },
      dependencies: { prettier: '^3.0.0', eslint: '^9.0.0', react: '^19.0.0' },
      devDependencies: {
        '@eslint/js': '^9.0.0',
        '@typescript-eslint/parser': '^8.0.0',
      },
      'lint-staged': { '*.ts': ['prettier --write', 'eslint --fix', 'tsc --noEmit'] },
    }),
  );
  await writeFile(
    path.join(dir, '.vscode/settings.json'),
    JSON.stringify({
      'prettier.singleQuote': true,
      'eslint.enable': true,
      'editor.defaultFormatter': 'dbaeumer.vscode-eslint',
      'editor.tabSize': 2,
      'editor.codeActionsOnSave': {
        'source.fixAll.eslint': true,
        'source.organizeImports': 'explicit',
      },
      '[typescript]': {
        'editor.defaultFormatter': 'dbaeumer.vscode-eslint',
        'editor.tabSize': 4,
        'prettier.singleQuote': true,
        'editor.codeActionsOnSave': {
          'source.fixAll.eslint': true,
          'source.organizeImports': 'explicit',
        },
      },
      '[javascript]': {
        'editor.defaultFormatter': 'dbaeumer.vscode-eslint',
      },
    }),
  );
  await writeFile(
    path.join(dir, '.vscode/extensions.json'),
    JSON.stringify({
      recommendations: ['esbenp.prettier-vscode', 'dbaeumer.vscode-eslint', 'other.extension'],
      unwantedRecommendations: ['dbaeumer.vscode-eslint', 'another.extension'],
    }),
  );
  await writeFile(path.join(dir, '.prettierrc.json'), '{}');
  await writeFile(path.join(dir, '.prettierignore'), 'dist\n');
  await writeFile(path.join(dir, 'prettier.config.cjs'), 'module.exports = {};');
  await writeFile(path.join(dir, '.eslintrc.json'), '{}');
  await writeFile(path.join(dir, '.eslintignore'), 'dist\n');
  await writeFile(path.join(dir, 'eslint.config.js'), 'export default [];');

  const { created, removed, updated } = await createProject({ projectPath: dir });
  assert.ok(created.includes('.editorconfig'));
  assert.ok(updated.includes('package.json'));
  assert.ok(updated.includes('.vscode/settings.json'));
  assert.ok(updated.includes('.vscode/extensions.json'));
  const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.prettier, undefined);
  assert.equal(pkg.eslintConfig, undefined);
  assert.equal(pkg.eslintIgnore, undefined);
  assert.equal(pkg.scripts.format, 'oxfmt --write .');
  assert.equal(pkg.scripts.lint, 'oxlint');
  assert.equal(pkg.scripts['eslint:fix'], undefined);
  assert.equal(pkg.scripts.test, 'vitest');
  assert.equal(pkg.dependencies.prettier, undefined);
  assert.equal(pkg.dependencies.eslint, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.equal(pkg.dependencies.react, '^19.0.0');
  assert.equal(pkg.packageManager, undefined);
  assert.deepEqual(pkg.devEngines, {
    runtime: { name: 'node' },
    packageManager: { name: 'pnpm', version: '>=12.14.0', onFail: 'error' },
  });
  assert.deepEqual(pkg.engines, {
    npm: '>=8',
    node: '^22.0.0 || ^24.0.0 || ^26.0.0 || >=27.0.0',
  });
  assert.deepEqual(pkg['lint-staged']['*.ts'], ['tsc --noEmit']);

  const settings = JSON.parse(await readFile(path.join(dir, '.vscode/settings.json'), 'utf8'));
  assert.equal(settings['prettier.singleQuote'], undefined);
  assert.equal(settings['eslint.enable'], undefined);
  assert.equal(settings['editor.defaultFormatter'], 'oxc.oxc-vscode');
  assert.equal(settings['editor.tabSize'], 2);
  assert.deepEqual(settings['editor.codeActionsOnSave'], {
    'source.organizeImports': 'explicit',
    'source.fixAll.oxc': 'always',
  });
  assert.deepEqual(settings['[typescript]'], {
    'editor.tabSize': 4,
    'editor.codeActionsOnSave': { 'source.organizeImports': 'explicit' },
  });
  assert.equal(settings['[javascript]'], undefined);

  const extensions = JSON.parse(await readFile(path.join(dir, '.vscode/extensions.json'), 'utf8'));
  assert.ok(!extensions.recommendations.includes('esbenp.prettier-vscode'));
  assert.ok(!extensions.recommendations.includes('dbaeumer.vscode-eslint'));
  assert.ok(extensions.recommendations.includes('other.extension'));
  assert.deepEqual(extensions.unwantedRecommendations, ['another.extension']);

  assert.deepEqual(
    new Set(removed),
    new Set([
      '.prettierignore',
      '.prettierrc.json',
      'prettier.config.cjs',
      '.eslintrc.json',
      '.eslintignore',
      'eslint.config.js',
    ]),
  );
  for (const file of removed) {
    await assert.rejects(readFile(path.join(dir, file)), { code: 'ENOENT' });
  }
});

test('creates Stylelint configuration when enabled', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'create-'));
  const { deps } = await createProject({
    projectPath: dir,
    stylelint: true,
  });
  const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  assert.ok(deps.includes('stylelint'));
  assert.ok(deps.includes('stylelint-config-standard'));
  assert.equal(pkg.scripts.lint, 'oxlint && stylelint "**/*.css"');
  assert.deepEqual(pkg['lint-staged']['*.css'], ['oxfmt --write', 'stylelint --fix']);
  assert.match(
    await readFile(path.join(dir, 'stylelint.config.ts'), 'utf8'),
    /stylelint-config-standard/,
  );
  const extensions = JSON.parse(await readFile(path.join(dir, '.vscode/extensions.json'), 'utf8'));
  assert.ok(extensions.recommendations.includes('stylelint.vscode-stylelint'));
  const settings = JSON.parse(await readFile(path.join(dir, '.vscode/settings.json'), 'utf8'));
  assert.equal(settings['editor.codeActionsOnSave']['source.fixAll.oxc'], 'always');
  assert.equal(settings['editor.codeActionsOnSave']['source.fixAll.stylelint'], 'explicit');
});

test('includes only selected optional oxlint presets', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'create-'));
  await createProject({
    projectPath: dir,
    editorconfig: false,
    oxfmt: false,
    vscode: false,
    huskyLintStaged: false,
    oxlintConfigs: ['react'],
  });
  const oxlintConfig = await readFile(path.join(dir, 'oxlint.config.ts'), 'utf8');
  assert.match(oxlintConfig, /oxlint-config-recommended\/react/);
  assert.doesNotMatch(oxlintConfig, /jsx-a11y/);
  assert.match(oxlintConfig, /oxlint-config-recommended\/unicorn/);
});

test('detects package manager and locale', () => {
  assert.equal(detectPackageManager({ npm_config_user_agent: 'pnpm/9 npm/?' }), 'pnpm');
  assert.equal(detectPackageManager({}), 'npm');
  assert.equal(getMessages({ LANG: 'zh_CN.UTF-8' }), zh);
  assert.equal(getMessages({ LANG: 'en_US.UTF-8' }), en);
});

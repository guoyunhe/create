import { access, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import module from 'node:module';
import path from 'node:path';
import process from 'node:process';

import { parse as parseSemver } from 'semver';

export const EDITORCONFIG = await readFile(
  module.createRequire(import.meta.url).resolve('@guoyunhe/editorconfig/node/.editorconfig'),
  'utf8',
);

export const OXFMT_CONFIG = `import { defineConfig } from 'oxfmt';
import preset from '@guoyunhe/oxfmt-config';

export default defineConfig({
  ...preset,
});
`;

export type OxlintConfig = 'react' | 'jsx-a11y';

const OXLINT_CONFIG_IMPORTS: Record<OxlintConfig, string> = {
  react: "import recommendedReact from 'oxlint-config-recommended/react';",
  'jsx-a11y': "import recommendedJsxA11y from 'oxlint-config-recommended/jsx-a11y';",
};

const OXLINT_CONFIG_PRESETS: Record<OxlintConfig, string> = {
  react: 'recommendedReact',
  'jsx-a11y': 'recommendedJsxA11y',
};

export function createOxlintConfig(configs: readonly OxlintConfig[]) {
  const optionalImports = configs.map((config) => OXLINT_CONFIG_IMPORTS[config]).join('\n');
  const extendsValue = [
    'recommended',
    'recommendedUnicorn',
    ...configs.map((config) => OXLINT_CONFIG_PRESETS[config]),
  ].join(', ');

  return `import { defineConfig } from 'oxlint';
import recommended from 'oxlint-config-recommended';
import recommendedUnicorn from 'oxlint-config-recommended/unicorn';
${optionalImports}${optionalImports ? '\n' : ''}
export default defineConfig({
  extends: [${extendsValue}],
});
`;
}

export const LINT_STAGED_KEY =
  '*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,vue,json,jsonc,css,scss,less,htm,html,md,mdx,yaml,yml}';
const OXLINT_LINT_STAGED_KEY = '*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,vue}';
const STYLELINT_LINT_STAGED_KEY = '*.css';
const FORMAT_ONLY_LINT_STAGED_KEY = '*.{json,jsonc,scss,less,htm,html,md,mdx,yaml,yml}';

const EXEC = {
  npm: 'npx',
  pnpm: 'pnpm exec',
  yarn: 'yarn',
  bun: 'bunx',
};

const PNPM_LATEST_API = 'https://registry.npmjs.org/pnpm/latest';
const NODE_RELEASES_API = 'https://endoflife.date/api/v1/products/nodejs';

export type PackageManager = keyof typeof EXEC;

export function detectPackageManager(env: NodeJS.ProcessEnv = process.env): PackageManager {
  const name = (env.npm_config_user_agent || '').split('/')[0] as PackageManager;
  return name in EXEC ? name : 'npm';
}

export function installArgs(pm: PackageManager, deps: string[]) {
  return pm === 'npm' ? ['install', '-D', ...deps] : ['add', '-D', ...deps];
}

type JsonRecord = Record<string, unknown>;

interface PackageJson extends JsonRecord {
  name?: string;
  version?: string;
  private?: boolean;
  author?: string | { name: string; email: string; url: string };
  funding?: string;
  devEngines?: JsonRecord & { packageManager?: JsonRecord };
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
  'lint-staged'?: Record<string, string | string[]>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface VscodeSettings extends JsonRecord {
  'editor.formatOnSave'?: boolean;
  'editor.defaultFormatter'?: string;
  'editor.codeActionsOnSave'?: JsonRecord;
  'editor.rulers'?: number[];
  'oxc.enable'?: boolean;
}

interface VscodeExtensions extends JsonRecord {
  recommendations?: string[];
  unwantedRecommendations?: string[];
}

function asRecord(value: unknown, description: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Expected ${description} to be an object`);
  }
  return value as JsonRecord;
}

function parseVersion(value: unknown, description: string) {
  const version = typeof value === 'string' ? parseSemver(value) : undefined;
  if (
    !version ||
    version.raw !== version.version ||
    version.prerelease.length > 0 ||
    version.build.length > 0
  ) {
    throw new TypeError(`Expected ${description} to be a stable semantic version`);
  }
  return version;
}

function isDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await globalThis.fetch(url, {
    signal: globalThis.AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<unknown>;
}

async function getRuntimeRequirements() {
  const [pnpmResponse, nodeResponse] = await Promise.all([
    fetchJson(PNPM_LATEST_API),
    fetchJson(NODE_RELEASES_API),
  ]);
  const pnpmVersion = parseVersion(
    asRecord(pnpmResponse, 'pnpm API response').version,
    'pnpm version',
  ).version;
  const nodeProduct = asRecord(
    asRecord(nodeResponse, 'Node.js API response').result,
    'Node.js product data',
  );
  const nodeReleases = nodeProduct.releases;
  if (!Array.isArray(nodeReleases)) {
    throw new TypeError('Expected Node.js product data to contain a releases array');
  }

  const today = new Date().toISOString().slice(0, 10);
  const supportedReleases = nodeReleases
    .map((item, index) => {
      const release = asRecord(item, `Node.js release ${index}`);
      const cycle = release.name;
      const latest = parseVersion(
        asRecord(release.latest, `Node.js release ${index} latest version`).name,
        `Node.js release ${index} version`,
      );
      const cycleNumber = typeof cycle === 'string' ? Number(cycle) : Number.NaN;
      const releaseDate = release.releaseDate;
      const isEol = release.isEol;
      if (
        typeof cycle !== 'string' ||
        !/^\d+$/.test(cycle) ||
        !Number.isSafeInteger(cycleNumber) ||
        latest.major !== cycleNumber ||
        !isDate(releaseDate) ||
        typeof isEol !== 'boolean'
      ) {
        throw new TypeError(`Invalid Node.js release data at index ${index}`);
      }

      return {
        cycle: cycleNumber,
        latest: latest.version,
        releaseDate,
        isEol,
      };
    })
    .filter(({ releaseDate, isEol }) => releaseDate <= today && !isEol)
    // filter() creates a local array, so sorting it cannot mutate the API response.
    // oxlint-disable-next-line unicorn/no-array-sort
    .sort((a, b) => b.cycle - a.cycle);

  if (supportedReleases.length === 0) {
    throw new Error('Node.js API returned no supported, non-EOL releases');
  }

  return {
    pnpmVersion,
    nodeVersionRange: supportedReleases.map(({ latest }) => `^${latest}`).join(' || '),
  };
}

async function readJson<T extends JsonRecord>(filePath: string, fallback: T): Promise<T> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    if (!(parsed instanceof Object) || Array.isArray(parsed)) {
      throw new TypeError(`Expected a JSON object in ${filePath}`);
    }
    return parsed as T;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return fallback;
    throw error;
  }
}

const writeJson = (filePath: string, data: JsonRecord) =>
  writeFile(filePath, `${JSON.stringify(data, undefined, 2)}\n`, 'utf8');

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function removeLegacyLintConfig(projectPath: string, packageJson: PackageJson) {
  const removed: string[] = [];
  const updated: string[] = [];
  delete packageJson.prettier;
  delete packageJson.eslintConfig;
  delete packageJson.eslintIgnore;

  for (const field of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ] as const) {
    const dependencies = packageJson[field];
    if (!dependencies) continue;
    for (const name of Object.keys(dependencies)) {
      if (/(^|[-/])prettier($|[-/])/i.test(name) || /eslint/i.test(name)) {
        delete dependencies[name];
      }
    }
    if (Object.keys(dependencies).length === 0) delete packageJson[field];
  }

  if (packageJson.scripts) {
    for (const [name, command] of Object.entries(packageJson.scripts)) {
      if (/prettier|eslint/i.test(name) || /\b(?:prettier|eslint)\b/i.test(command)) {
        delete packageJson.scripts[name];
      }
    }
  }

  const lintStaged = packageJson['lint-staged'];
  if (lintStaged) {
    for (const [pattern, commands] of Object.entries(lintStaged)) {
      let remaining: string[];
      if (Array.isArray(commands)) {
        remaining = commands.filter((command) => !/\b(?:prettier|eslint)\b/i.test(command));
      } else {
        remaining = /\b(?:prettier|eslint)\b/i.test(commands) ? [] : [commands];
      }
      if (remaining.length === 0) {
        delete lintStaged[pattern];
      } else {
        lintStaged[pattern] = Array.isArray(commands) ? remaining : remaining[0];
      }
    }
    if (Object.keys(lintStaged).length === 0) delete packageJson['lint-staged'];
  }

  for (const file of await readdir(projectPath, { withFileTypes: true })) {
    if (
      file.isFile() &&
      (/^\.prettier/i.test(file.name) ||
        /^prettier\.config\./i.test(file.name) ||
        /^\.eslintrc(?:\.|$)/i.test(file.name) ||
        /^\.eslintignore$/i.test(file.name) ||
        /^eslint\.config(?:\.|$)/i.test(file.name))
    ) {
      await unlink(path.join(projectPath, file.name));
      removed.push(file.name);
    }
  }

  const vscodePath = path.join(projectPath, '.vscode');
  let vscodeFiles: string[] = [];
  try {
    vscodeFiles = await readdir(vscodePath);
  } catch (error: unknown) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  if (vscodeFiles.includes('settings.json')) {
    const settingsPath = path.join(vscodePath, 'settings.json');
    const settings = await readJson<VscodeSettings>(settingsPath, {});
    let settingsChanged = false;
    for (const key of Object.keys(settings)) {
      if (/^(?:prettier|eslint)(?:\.|$)/i.test(key)) {
        delete settings[key];
        settingsChanged = true;
      }
      if (key === 'editor.codeActionsOnSave' || /^(?:\[[^\]]+\])+$/.test(key)) {
        const value = settings[key];
        if (!(value instanceof Object) || Array.isArray(value)) continue;

        const nestedSettings = value as JsonRecord;
        const codeActions =
          key === 'editor.codeActionsOnSave'
            ? nestedSettings
            : nestedSettings['editor.codeActionsOnSave'];
        if (codeActions instanceof Object && !Array.isArray(codeActions)) {
          for (const action of Object.keys(codeActions)) {
            if (/^source\.fixAll\.eslint$/i.test(action)) {
              delete (codeActions as JsonRecord)[action];
              settingsChanged = true;
            }
          }
          if (Object.keys(codeActions).length === 0) {
            if (key === 'editor.codeActionsOnSave') {
              delete settings[key];
            } else {
              delete nestedSettings['editor.codeActionsOnSave'];
            }
            settingsChanged = true;
          }
        }

        if (!/^(?:\[[^\]]+\])+$/.test(key)) continue;
        for (const languageSetting of Object.keys(nestedSettings)) {
          if (
            /^(?:prettier|eslint)(?:\.|$)/i.test(languageSetting) ||
            (languageSetting === 'editor.defaultFormatter' &&
              /(?:prettier|dbaeumer\.vscode-eslint)/i.test(
                String(nestedSettings[languageSetting] || ''),
              ))
          ) {
            delete nestedSettings[languageSetting];
            settingsChanged = true;
          }
        }
        if (Object.keys(nestedSettings).length === 0) {
          delete settings[key];
          settingsChanged = true;
        }
      }
    }
    if (
      /(?:prettier|dbaeumer\.vscode-eslint)/i.test(
        String(settings['editor.defaultFormatter'] || ''),
      )
    ) {
      delete settings['editor.defaultFormatter'];
      settingsChanged = true;
    }
    if (settingsChanged) {
      await writeJson(settingsPath, settings);
      updated.push('.vscode/settings.json');
    }
  }

  if (vscodeFiles.includes('extensions.json')) {
    const extensionsPath = path.join(vscodePath, 'extensions.json');
    const extensions = await readJson<VscodeExtensions>(extensionsPath, {});
    let extensionsChanged = false;
    for (const field of ['recommendations', 'unwantedRecommendations'] as const) {
      if (!extensions[field]) continue;
      const filtered = extensions[field].filter((extension) => !/prettier|eslint/i.test(extension));
      if (filtered.length !== extensions[field].length) {
        extensions[field] = filtered;
        extensionsChanged = true;
      }
    }
    if (extensionsChanged) {
      await writeJson(extensionsPath, extensions);
      updated.push('.vscode/extensions.json');
    }
  }

  return { removed, updated };
}

/**
 * Write configuration files into the project. Returns created/updated/removed files and dev
 * dependencies that should be installed.
 */
export interface CreateProjectOptions {
  projectPath: string;
  editorconfig?: boolean;
  oxfmt?: boolean;
  oxlint?: boolean;
  oxlintConfigs?: OxlintConfig[];
  stylelint?: boolean;
  vscode?: boolean;
  huskyLintStaged?: boolean;
  packageManager?: PackageManager;
}

export async function createProject({
  projectPath,
  editorconfig = true,
  oxfmt = true,
  oxlint = true,
  oxlintConfigs = ['react', 'jsx-a11y'],
  stylelint = false,
  vscode = true,
  huskyLintStaged = true,
  packageManager = 'npm',
}: CreateProjectOptions) {
  const { pnpmVersion, nodeVersionRange } = await getRuntimeRequirements();
  await mkdir(projectPath, { recursive: true });
  const created: string[] = [];
  const updated: string[] = [];
  const deps: string[] = [];
  const packageJsonPath = path.join(projectPath, 'package.json');
  const packageJson = await readJson<PackageJson>(packageJsonPath, {
    name: path.basename(projectPath) || undefined,
    version: '0.0.0',
    private: true,
  });
  const { removed, updated: cleaned } = await removeLegacyLintConfig(projectPath, packageJson);
  for (const file of cleaned) {
    if (!updated.includes(file)) updated.push(file);
  }
  packageJson.author = {
    name: 'Guo Yunhe',
    email: 'i@guoyunhe.me',
    url: 'https://guoyunhe.me/',
  };
  packageJson.funding = 'https://ko-fi.com/guoyunhe';
  delete packageJson.packageManager;
  packageJson.devEngines ||= {};
  packageJson.devEngines.packageManager = {
    name: 'pnpm',
    version: `>=${pnpmVersion}`,
    onFail: 'error',
  };
  packageJson.engines ||= {};
  packageJson.engines.node = nodeVersionRange;
  packageJson.scripts ||= {};

  const write = async (file: string, content: string) => {
    const filePath = path.join(projectPath, file);
    const existed = await fileExists(filePath);
    await mkdir(path.join(filePath, '..'), { recursive: true });
    await writeFile(filePath, content, 'utf8');
    const files = existed ? updated : created;
    if (!files.includes(file)) files.push(file);
  };

  if (editorconfig) {
    deps.push('@guoyunhe/editorconfig');
    await write('.editorconfig', EDITORCONFIG);
  }

  if (oxfmt) {
    deps.push('oxfmt', '@guoyunhe/oxfmt-config');
    packageJson.scripts.format = 'oxfmt --write .';
    packageJson.scripts['format:check'] = 'oxfmt --check .';
    await write('oxfmt.config.ts', OXFMT_CONFIG);
  }

  if (oxlint) {
    deps.push('oxlint', 'oxlint-config-recommended');
    packageJson.scripts.lint = 'oxlint';
    await write('oxlint.config.ts', createOxlintConfig(oxlintConfigs));
  }

  if (stylelint) {
    deps.push('stylelint', 'stylelint-config-standard');
    packageJson.scripts.lint = oxlint ? 'oxlint && stylelint "**/*.css"' : 'stylelint "**/*.css"';
    await write(
      'stylelint.config.ts',
      `import type { Config } from 'stylelint';

export default {
  extends: ['stylelint-config-standard'],
} satisfies Config;
`,
    );
  }

  if (vscode) {
    const settingsPath = path.join(projectPath, '.vscode', 'settings.json');
    const settings = await readJson<VscodeSettings>(settingsPath, {});
    if (oxfmt) {
      settings['editor.formatOnSave'] = true;
      settings['editor.defaultFormatter'] = 'oxc.oxc-vscode';
      settings['editor.rulers'] = [100];
    }
    if (oxlint) {
      settings['oxc.enable'] = true;
    }
    if (oxlint || stylelint) {
      const codeActionsOnSave =
        settings['editor.codeActionsOnSave'] === undefined
          ? {}
          : asRecord(settings['editor.codeActionsOnSave'], 'editor.codeActionsOnSave');
      if (oxlint) codeActionsOnSave['source.fixAll.oxc'] = 'always';
      if (stylelint) codeActionsOnSave['source.fixAll.stylelint'] = 'explicit';
      settings['editor.codeActionsOnSave'] = codeActionsOnSave;
    }
    await mkdir(path.join(projectPath, '.vscode'), { recursive: true });
    await write('.vscode/settings.json', `${JSON.stringify(settings, undefined, 2)}\n`);

    const extPath = path.join(projectPath, '.vscode', 'extensions.json');
    const ext = await readJson<VscodeExtensions>(extPath, {});
    const recommendations = new Set([...(ext.recommendations || []), 'editorconfig.editorconfig']);
    if (oxfmt || oxlint) recommendations.add('oxc.oxc-vscode');
    if (stylelint) recommendations.add('stylelint.vscode-stylelint');
    ext.recommendations = [...recommendations];
    await write('.vscode/extensions.json', `${JSON.stringify(ext, undefined, 2)}\n`);
  }

  if (huskyLintStaged) {
    deps.push('husky', 'lint-staged');
    packageJson.scripts.prepare = 'husky';
    const lintStaged =
      oxfmt || oxlint || stylelint ? (packageJson['lint-staged'] ||= {}) : undefined;
    const codeCommands = [];
    if (oxfmt) codeCommands.push('oxfmt --write');
    if (oxlint) codeCommands.push('oxlint --fix');
    if (codeCommands.length > 0 && lintStaged) {
      lintStaged[OXLINT_LINT_STAGED_KEY] = codeCommands.length > 1 ? codeCommands : codeCommands[0];
    }

    const cssCommands = [];
    if (oxfmt) cssCommands.push('oxfmt --write');
    if (stylelint) cssCommands.push('stylelint --fix');
    if (cssCommands.length > 0 && lintStaged) {
      lintStaged[STYLELINT_LINT_STAGED_KEY] = cssCommands.length > 1 ? cssCommands : cssCommands[0];
    }

    if (oxfmt && lintStaged) {
      lintStaged[FORMAT_ONLY_LINT_STAGED_KEY] = 'oxfmt --write';
    }
    await write('.husky/pre-commit', `${EXEC[packageManager] || 'npx'} lint-staged\n`);
  }

  await write('package.json', `${JSON.stringify(packageJson, undefined, 2)}\n`);

  return {
    created,
    updated,
    removed,
    deps,
  };
}

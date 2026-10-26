import { mkdir, readFile, writeFile } from 'node:fs/promises';
import module from 'node:module';
import path from 'node:path';
import process from 'node:process';

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
    ...configs.map((config) => OXLINT_CONFIG_PRESETS[config]),
  ].join(', ');

  return `import { defineConfig } from 'oxlint';
import recommended from 'oxlint-config-recommended';
${optionalImports}${optionalImports ? '\n' : ''}
export default defineConfig({
  extends: [${extendsValue}],
});
`;
}

export const LINT_STAGED_KEY =
  '*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,vue,json,jsonc,css,scss,less,htm,html,md,mdx,yaml,yml}';

const EXEC = {
  npm: 'npx',
  pnpm: 'pnpm exec',
  yarn: 'yarn',
  bun: 'bunx',
};

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
  scripts?: Record<string, string>;
  'lint-staged'?: Record<string, string | string[]>;
}

interface VscodeSettings extends JsonRecord {
  'editor.formatOnSave'?: boolean;
  'editor.defaultFormatter'?: string;
  'editor.rulers'?: number[];
  'oxc.enable'?: boolean;
}

interface VscodeExtensions extends JsonRecord {
  recommendations?: string[];
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

/**
 * Write configuration files into the project. Returns the list of dev dependencies that should be
 * installed.
 */
export interface CreateProjectOptions {
  projectPath: string;
  editorconfig?: boolean;
  oxfmt?: boolean;
  oxlint?: boolean;
  oxlintConfigs?: OxlintConfig[];
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
  vscode = true,
  huskyLintStaged = true,
  packageManager = 'npm',
}: CreateProjectOptions) {
  await mkdir(projectPath, { recursive: true });
  const written: string[] = [];
  const deps: string[] = [];
  const packageJsonPath = path.join(projectPath, 'package.json');
  const packageJson = await readJson<PackageJson>(packageJsonPath, {
    name: path.basename(projectPath) || undefined,
    version: '0.0.0',
    private: true,
  });
  packageJson.scripts ||= {};

  const write = async (file: string, content: string) => {
    const filePath = path.join(projectPath, file);
    await mkdir(path.join(filePath, '..'), { recursive: true });
    await writeFile(filePath, content, 'utf8');
    written.push(file);
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
    await mkdir(path.join(projectPath, '.vscode'), { recursive: true });
    await writeJson(settingsPath, settings);
    written.push('.vscode/settings.json');

    const extPath = path.join(projectPath, '.vscode', 'extensions.json');
    const ext = await readJson<VscodeExtensions>(extPath, {});
    const recommendations = new Set([...(ext.recommendations || []), 'editorconfig.editorconfig']);
    if (oxfmt || oxlint) recommendations.add('oxc.oxc-vscode');
    ext.recommendations = [...recommendations];
    await writeJson(extPath, ext);
    written.push('.vscode/extensions.json');
  }

  if (huskyLintStaged) {
    deps.push('husky', 'lint-staged');
    packageJson.scripts.prepare = 'husky';
    const commands = [];
    if (oxfmt) commands.push('oxfmt --write');
    if (oxlint) commands.push('oxlint --fix');
    if (commands.length > 0) {
      packageJson['lint-staged'] ||= {};
      packageJson['lint-staged'][LINT_STAGED_KEY] = commands.length > 1 ? commands : commands[0];
    }
    await write('.husky/pre-commit', `${EXEC[packageManager] || 'npx'} lint-staged\n`);
  }

  await writeJson(packageJsonPath, packageJson);
  written.push('package.json');

  return { written, deps };
}

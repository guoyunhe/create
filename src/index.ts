import { access, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
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
const OXLINT_LINT_STAGED_KEY = '*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,vue}';
const STYLELINT_LINT_STAGED_KEY = '*.css';
const FORMAT_ONLY_LINT_STAGED_KEY = '*.{json,jsonc,scss,less,htm,html,md,mdx,yaml,yml}';

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
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
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

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function removePrettierConfig(projectPath: string, packageJson: PackageJson) {
  const removed: string[] = [];
  const updated: string[] = [];
  delete packageJson.prettier;

  for (const field of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ] as const) {
    const dependencies = packageJson[field];
    if (!dependencies) continue;
    for (const name of Object.keys(dependencies)) {
      if (/(^|[-/])prettier($|[-/])/i.test(name)) delete dependencies[name];
    }
    if (Object.keys(dependencies).length === 0) delete packageJson[field];
  }

  if (packageJson.scripts) {
    for (const [name, command] of Object.entries(packageJson.scripts)) {
      if (/prettier/i.test(name) || /\bprettier\b/i.test(command)) delete packageJson.scripts[name];
    }
  }

  const lintStaged = packageJson['lint-staged'];
  if (lintStaged) {
    for (const [pattern, commands] of Object.entries(lintStaged)) {
      let remaining: string[];
      if (Array.isArray(commands)) {
        remaining = commands.filter((command) => !/\bprettier\b/i.test(command));
      } else {
        remaining = /\bprettier\b/i.test(commands) ? [] : [commands];
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
      (/^\.prettier/i.test(file.name) || /^prettier\.config\./i.test(file.name))
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
      if (/^prettier(?:\.|$)/i.test(key)) {
        delete settings[key];
        settingsChanged = true;
      }
      if (!/^(?:\[[^\]]+\])+$/.test(key)) continue;

      const value = settings[key];
      if (!(value instanceof Object) || Array.isArray(value)) continue;

      const languageSettings = value as JsonRecord;
      for (const languageSetting of Object.keys(languageSettings)) {
        if (
          /^prettier(?:\.|$)/i.test(languageSetting) ||
          (languageSetting === 'editor.defaultFormatter' &&
            /prettier/i.test(String(languageSettings[languageSetting] || '')))
        ) {
          delete languageSettings[languageSetting];
          settingsChanged = true;
        }
      }
      if (Object.keys(languageSettings).length === 0) {
        delete settings[key];
        settingsChanged = true;
      }
    }
    if (/prettier/i.test(String(settings['editor.defaultFormatter'] || ''))) {
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
    if (extensions.recommendations) {
      const recommendations = extensions.recommendations.filter(
        (extension) => !/prettier/i.test(extension),
      );
      if (recommendations.length !== extensions.recommendations.length) {
        extensions.recommendations = recommendations;
        await writeJson(extensionsPath, extensions);
        updated.push('.vscode/extensions.json');
      }
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
  const { removed, updated: cleaned } = await removePrettierConfig(projectPath, packageJson);
  for (const file of cleaned) {
    if (!updated.includes(file)) updated.push(file);
  }
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

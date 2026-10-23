import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const EDITORCONFIG = `# https://editorconfig.org
# Based on @guoyunhe/editorconfig

root = true

[*]
charset = utf-8
end_of_line = lf
indent_size = 2
indent_style = space
insert_final_newline = true
max_line_length = 100
trim_trailing_whitespace = true

[{package-lock.json,yarn.lock,pnpm-lock.yaml}]
insert_final_newline = ignore

[*.md]
max_line_length = off
trim_trailing_whitespace = false
`;

export const OXFMT_CONFIG = `import { defineConfig } from 'oxfmt';
import preset from '@guoyunhe/oxfmt-config';

export default defineConfig({
  ...preset,
});
`;

// TODO: use @guoyunhe/oxlint-config once it is published
export const OXLINT_CONFIG = `import { defineConfig } from 'oxlint';
// import preset from '@guoyunhe/oxlint-config';

export default defineConfig({
  // ...preset,
});
`;

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

async function readJson(path: string, fallback: any): Promise<any> {
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch (err: any) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

const writeJson = (path: string, data: unknown) => writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');

/**
 * Write configuration files into the project. Returns the list of dev
 * dependencies that should be installed.
 */
export interface CreateProjectOptions {
  projectPath: string;
  editorconfig?: boolean;
  oxfmt?: boolean;
  oxlint?: boolean;
  vscode?: boolean;
  huskyLintStaged?: boolean;
  packageManager?: PackageManager;
}

export async function createProject({
  projectPath,
  editorconfig = true,
  oxfmt = true,
  oxlint = true,
  vscode = true,
  huskyLintStaged = true,
  packageManager = 'npm',
}: CreateProjectOptions) {
  await mkdir(projectPath, { recursive: true });
  const written: string[] = [];
  const deps: string[] = [];
  const packageJsonPath = join(projectPath, 'package.json');
  const packageJson = await readJson(packageJsonPath, {
    name: projectPath.split(/[\\/]/).filter(Boolean).pop(),
    version: '0.0.0',
    private: true,
  });
  packageJson.scripts ||= {};

  const write = async (file: string, content: string) => {
    const path = join(projectPath, file);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, content, 'utf-8');
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
    deps.push('oxlint');
    packageJson.scripts.lint = 'oxlint';
    await write('oxlint.config.ts', OXLINT_CONFIG);
  }

  if (vscode) {
    const path = join(projectPath, '.vscode', 'settings.json');
    const settings = await readJson(path, {});
    if (oxfmt) {
      settings['editor.formatOnSave'] = true;
      settings['editor.defaultFormatter'] = 'oxc.oxc-vscode';
      settings['editor.rulers'] = [100];
    }
    if (oxlint) {
      settings['oxc.enable'] = true;
    }
    await mkdir(join(projectPath, '.vscode'), { recursive: true });
    await writeJson(path, settings);
    written.push('.vscode/settings.json');

    const extPath = join(projectPath, '.vscode', 'extensions.json');
    const ext = await readJson(extPath, {});
    const recommendations = new Set(ext.recommendations || []);
    recommendations.add('editorconfig.editorconfig');
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
    if (commands.length) {
      packageJson['lint-staged'] ||= {};
      packageJson['lint-staged'][LINT_STAGED_KEY] = commands.length === 1 ? commands[0] : commands;
    }
    await write('.husky/pre-commit', `${EXEC[packageManager] || 'npx'} lint-staged\n`);
  }

  await writeJson(packageJsonPath, packageJson);
  written.push('package.json');

  return { written, deps };
}

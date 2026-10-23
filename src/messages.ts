export interface Messages {
  intro: string;
  projectPath: string;
  enableEditorConfig: string;
  enableOxfmt: string;
  enableOxlint: string;
  enableVscode: string;
  enableHuskyLintStaged: string;
  installDependencies: string;
  installing: string;
  installFailed: string;
  created: string;
  updated: string;
  done: string;
}

export const en: Messages = {
  intro: 'Initialize project with common dev tools',
  projectPath: 'Project directory',
  enableEditorConfig: 'Set up EditorConfig (@guoyunhe/editorconfig)?',
  enableOxfmt: 'Set up oxfmt (@guoyunhe/oxfmt-config)?',
  enableOxlint: 'Set up oxlint (@guoyunhe/oxlint-config)?',
  enableVscode: 'Set up VS Code settings?',
  enableHuskyLintStaged: 'Set up husky and lint-staged?',
  installDependencies: 'Install dependencies now?',
  installing: 'Installing dependencies...',
  installFailed: 'Failed to install dependencies. Please install them manually.',
  created: 'Created',
  updated: 'Updated',
  done: 'Done! Happy coding.',
};

export const zh: Messages = {
  intro: '使用常用开发工具配置初始化项目',
  projectPath: '项目目录',
  enableEditorConfig: '配置 EditorConfig (@guoyunhe/editorconfig)？',
  enableOxfmt: '配置 oxfmt (@guoyunhe/oxfmt-config)？',
  enableOxlint: '配置 oxlint (@guoyunhe/oxlint-config)？',
  enableVscode: '配置 VS Code 设置？',
  enableHuskyLintStaged: '配置 husky 和 lint-staged？',
  installDependencies: '现在安装依赖？',
  installing: '正在安装依赖……',
  installFailed: '依赖安装失败，请手动安装。',
  created: '已创建',
  updated: '已更新',
  done: '完成！祝编码愉快。',
};

export function getMessages(env: NodeJS.ProcessEnv = process.env): Messages {
  const lang = env.LC_ALL || env.LC_MESSAGES || env.LANGUAGE || env.LANG || '';
  return lang.toLowerCase().startsWith('zh') ? zh : en;
}

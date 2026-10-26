import process from 'node:process';

export interface Messages {
  intro: string;
  projectPath: string;
  acceptAllDefaults: string;
  skipDependencyInstall: string;
  selectOxlintConfigs: string;
  oxlintReactConfig: string;
  oxlintJsxA11yConfig: string;
  installDependencies: string;
  installing: string;
  installFailed: string;
  cancelled: string;
  created: string;
  updated: string;
  done: string;
}

export const en: Messages = {
  intro: 'Initialize project with common dev tools',
  projectPath: 'Project directory',
  acceptAllDefaults: 'Use all optional configs and install dependencies without prompting',
  skipDependencyInstall: 'Skip installing dependencies',
  selectOxlintConfigs: 'Select optional oxlint-config-recommended presets',
  oxlintReactConfig: 'React recommended rules',
  oxlintJsxA11yConfig: 'jsx-a11y accessibility rules',
  installDependencies: 'Install dependencies now?',
  installing: 'Installing dependencies...',
  installFailed: 'Failed to install dependencies. Please install them manually.',
  cancelled: 'Operation cancelled.',
  created: 'Created',
  updated: 'Updated',
  done: 'Done! Happy coding.',
};

export const zh: Messages = {
  intro: '使用常用开发工具配置初始化项目',
  projectPath: '项目目录',
  acceptAllDefaults: '启用全部可选规则并直接安装依赖',
  skipDependencyInstall: '跳过安装依赖',
  selectOxlintConfigs: '选择 oxlint-config-recommended 可选规则集',
  oxlintReactConfig: 'React 推荐规则',
  oxlintJsxA11yConfig: 'jsx-a11y 可访问性规则',
  installDependencies: '现在安装依赖？',
  installing: '正在安装依赖……',
  installFailed: '依赖安装失败，请手动安装。',
  cancelled: '操作已取消。',
  created: '已创建',
  updated: '已更新',
  done: '完成！祝编码愉快。',
};

export function getMessages(env: NodeJS.ProcessEnv = process.env): Messages {
  const lang = env.LC_ALL || env.LC_MESSAGES || env.LANGUAGE || env.LANG || '';
  return lang.toLowerCase().startsWith('zh') ? zh : en;
}

# create

Initialize Node.js projects with Guo Yunhe's configuration

## Usage

```sh
npm init @guoyunhe
# or in a specific directory
npm init @guoyunhe my-project
```

EditorConfig, VS Code, lint-staged, oxfmt, and oxlint are initialized automatically.
Existing Prettier and ESLint dependencies, scripts, configuration files, VS Code
settings/recommendations, and lint-staged commands are removed during setup.
VS Code is configured to apply Oxlint fixes on save, and Stylelint fixes when Stylelint is enabled.
When prompted, select optional React and jsx-a11y oxlint rules and whether to enable Stylelint for
CSS. `--yes` selects all optional configs and installs dependencies without prompting;
`--no-install` skips dependency installation.

Sets up EditorConfig (`@guoyunhe/editorconfig`), oxfmt (`@guoyunhe/oxfmt-config`), oxlint
(`oxlint-config-recommended`, including its React and jsx-a11y configs), optionally Stylelint
(`stylelint-config-standard` for CSS), VS Code settings, and husky + lint-staged.

Messages are shown in Chinese when `LANG` starts with `zh`, otherwise English.

---

## 使用

```sh
npm init @guoyunhe
```

使用常用开发工具配置初始化项目：EditorConfig、oxfmt、oxlint（`oxlint-config-recommended`，包含 React 和 jsx-a11y 配置）、VS Code、husky 与 lint-staged。
初始化时会清理 `package.json` 中的 Prettier/ESLint 依赖、脚本和配置、VS Code 设置/扩展推荐、lint-staged 命令及项目根目录配置文件，并改用 Oxlint。
VS Code 会在保存时自动应用 Oxlint 修复；启用 Stylelint 后也会应用其修复。
Stylelint（CSS 的 `stylelint-config-standard`）可选择启用。
可在交互界面多选 React 和 jsx-a11y 规则，并选择是否启用 Stylelint；`--yes` 会启用所有可选规则并直接安装依赖，`--no-install` 跳过依赖安装。

# create

Initialize Node.js projects with Guo Yunhe's configuration

## Usage

```sh
npm init @guoyunhe
# or in a specific directory
npm init @guoyunhe my-project
```

EditorConfig, VS Code, lint-staged, oxfmt, and oxlint are initialized automatically.
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
Stylelint（CSS 的 `stylelint-config-standard`）可选择启用。
可在交互界面多选 React 和 jsx-a11y 规则，并选择是否启用 Stylelint；`--yes` 会启用所有可选规则并直接安装依赖，`--no-install` 跳过依赖安装。

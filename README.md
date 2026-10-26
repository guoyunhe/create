# create

Initialize Node.js projects with Guo Yunhe's configuration

## Usage

```sh
npm init @guoyunhe
# or in a specific directory
npm init @guoyunhe my-project
```

EditorConfig, VS Code, lint-staged, oxfmt, and oxlint are initialized automatically.
Options: `--yes` (install dependencies without prompting), `--no-install` (skip installing dependencies).

Sets up EditorConfig (`@guoyunhe/editorconfig`), oxfmt (`@guoyunhe/oxfmt-config`), oxlint
(`oxlint-config-recommended`, including its React and jsx-a11y configs), VS Code settings, and husky + lint-staged.

Messages are shown in Chinese when `LANG` starts with `zh`, otherwise English.

---

## 使用

```sh
npm init @guoyunhe
```

使用常用开发工具配置初始化项目：EditorConfig、oxfmt、oxlint（`oxlint-config-recommended`，包含 React 和 jsx-a11y 配置）、VS Code、husky 与 lint-staged。
EditorConfig、VS Code、lint-staged、oxfmt 和 oxlint 会自动初始化，无需逐项确认。

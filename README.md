# create
Initialize Node.js projects with Guo Yunhe's configuration

## Usage

```sh
npm init @guoyunhe
# or in a specific directory
npm init @guoyunhe my-project
```

Options: `--yes` (accept all defaults), `--no-install` (skip installing dependencies).

Sets up EditorConfig (`@guoyunhe/editorconfig`), oxfmt (`@guoyunhe/oxfmt-config`), oxlint
(`@guoyunhe/oxlint-config`, placeholder until published), VS Code settings, and husky + lint-staged.

Messages are shown in Chinese when `LANG` starts with `zh`, otherwise English.

---

## 使用

```sh
npm init @guoyunhe
```

使用常用开发工具配置初始化项目：EditorConfig、oxfmt、oxlint（`@guoyunhe/oxlint-config` 尚未发布，目前为占位）、VS Code、husky 与 lint-staged。

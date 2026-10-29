# Changelog

All notable changes to this project will be documented in this file.

## [0.3.3] - 2026-10-29

### Added

- Always include the `oxlint-config-recommended/unicorn` preset; keep it out of the optional preset selection.

### Changed

- Download the EditorConfig file directly from GitHub instead of installing `@guoyunhe/editorconfig`.

## [0.3.2] - 2026-10-28

### Added

- Configure VS Code to apply Oxlint fixes on save and Stylelint fixes when enabled.

### Changed

- Remove existing ESLint dependencies, scripts, configuration, VS Code settings/recommendations, and lint-staged commands in favor of Oxlint.

## [0.3.1] - 2026-10-28

### Fixed

- Run pnpm self-update from the CLI before dependency installation, rather than as an install lifecycle script.
- Avoid failing pnpm dependency installation on unapproved dependency builds.

## [0.3.0] - 2026-10-28

### Added

- Add author and funding metadata to generated `package.json` files.
- Generate pnpm and Node.js engine requirements from current release data.
- Update pnpm in the CLI before installing dependencies.
- Skip unapproved dependency builds in CLI pnpm installs without failing installation.

### Changed

- Validate release versions with `semver`.

## [0.2.0] - 2026-10-28

### Added

- Add optional Stylelint configuration for CSS.
- Remove existing Prettier configuration from `package.json`, VS Code settings and recommendations, and root config files.
- Report generated files separately as created or updated.

## [0.1.0] - 2026-10-26

### Added

- Use `oxlint-config-recommended` with its React and jsx-a11y configurations in generated projects.
- Use `@clack/prompts` for the CLI interface and Commander for argument parsing and help output.
- Add a `pnpm dev` script to run the CLI locally with tsx.
- Initialize EditorConfig, VS Code, lint-staged, oxfmt, and oxlint without individual prompts.
- Ask which optional React and jsx-a11y Oxlint presets to include.
- Read the generated `.editorconfig` from `@guoyunhe/editorconfig`.

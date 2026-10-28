# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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

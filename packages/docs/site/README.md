# ARDOR UI Documentation

This directory contains the VitePress documentation site for ARDOR UI.

## Development

Start the development server:

```bash
bun run docs:dev
# or from project root
make docs-dev
```

Visit http://localhost:5173

## Build

Build the production site:

```bash
bun run docs:build
# or from project root
make docs
```

The built site will be in `.vitepress/dist/`

## Preview

Preview the built site:

```bash
bun run docs:preview
```

## Structure

```
site/
├── .vitepress/
│   ├── config.ts          # VitePress configuration
│   └── theme/             # Custom theme (extends default)
├── guide/                 # Getting started guides
├── components/            # Component documentation
├── examples/              # Usage examples
└── public/                # Static assets
```

## Deployment

The documentation is automatically deployed to GitHub Pages via the `.github/workflows/deploy-docs.yml` workflow when changes are pushed to the `main` branch.

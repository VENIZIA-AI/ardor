# Contributing to ARDOR

Thank you for your interest in contributing to ARDOR! This guide will help you get started.

The numbered project rules (write boundaries, process, build, code style) live in
[`.agents/rules.md`](.agents/rules.md); the framework conventions are in the
[best practices](https://ardor.venizia.ai/best-practices/) of the docs site.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Git Branching Strategy](#git-branching-strategy)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Submitting Pull Requests](#submitting-pull-requests)
- [Getting Help](#getting-help)

---

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to providing a welcoming and inclusive environment for everyone.

---

## Getting Started

### Prerequisites

| Tool    | Version  | Installation                                |
| ------- | -------- | ------------------------------------------- |
| **Bun** | >= 1.4.3 | `curl -fsSL https://bun.sh/install \| bash` |
| **Git** | Latest   | [git-scm.com](https://git-scm.com/)         |

### Setup

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/ardor.git
cd ardor

# 3. Install dependencies
bun install

# 4. Add upstream remote
git remote add upstream https://github.com/VENIZIA-AI/ardor.git
```

### Join the Development Team (Optional)

If you'd like to contribute directly to this repository without forking, you can request to join the development team. This gives you push access to create branches directly in the main repository.

**To request access:**

1. Open an issue with the title: `Request to join development team`
2. Briefly describe your interest and how you'd like to contribute

Once approved, you can clone the repo directly and push branches without maintaining a fork.

---

## Git Branching Strategy

```
main (production)
  ↑
  │ merge only from develop
  │
develop (staging)
  ↑
  │ PRs target here
  │
feature/*, fix/*, docs/*, chore/*, test/* (your work)
```

**Important:**

- ✅ Create PRs to `develop` branch
- ❌ Do NOT create PRs to `main` branch
- `main` only accepts merges from `develop`
- Releases are tagged in git (e.g., `v1.0.0`)

---

## Development Workflow

### Step 0: Open an Issue

Every change starts from an issue in [VENIZIA-AI/ardor](https://github.com/VENIZIA-AI/ardor/issues).
Its number goes into every commit and into the pull request.

### Step 1: Create Branch

```bash
# Sync with upstream
git fetch upstream
git checkout develop
git merge upstream/develop

# Create feature branch
git checkout -b feature/your-feature-name
```

**Branch naming:**

| Type    | Format                | Example                   |
| ------- | --------------------- | ------------------------- |
| Feature | `feature/description` | `feature/add-redis-cache` |
| Bug fix | `fix/description`     | `fix/auth-token-expiry`   |
| Docs    | `docs/description`    | `docs/update-quickstart`  |
| Chore   | `chore/description`   | `chore/upgrade-deps`      |
| Tests   | `test/description`    | `test/rejection-helpers`  |

### Step 2: Make Changes

**Checklist:**

- ✅ Follow the code rules: the VULCAN base V-C rules and ARDOR's C-03, C-05 and C-18 in [`.agents/rules.md`](.agents/rules.md)
- ✅ Follow the [best practices](https://ardor.venizia.ai/best-practices/)
- ✅ Add tests for new features/fixes
- ✅ Update the docs in `docs/wiki/content` if needed

### Step 3: Commit

One line, `[#N] type(scope): subject`, where `#N` is the issue and the type is a
[Conventional Commits](https://www.conventionalcommits.org/) type:

```bash
git commit -m "[#42] feat(admin): pass per-request headers through meta"
git commit -m "[#43] fix(kernel): send PATCH in upper case"
git commit -m "[#44] docs: update the quickstart"
git commit -m "[#45] chore: upgrade the IGNIS chain"
```

**Commit types:**

| Type        | Description                |
| ----------- | -------------------------- |
| `feat:`     | New feature                |
| `fix:`      | Bug fix                    |
| `docs:`     | Documentation only         |
| `chore:`    | Maintenance (deps, config) |
| `refactor:` | Code restructuring         |
| `test:`     | Adding tests               |

### Step 4: Validate

```bash
# Lint fixes and format
make lint-fix

# Build packages
make build
```

---

## Coding Standards

### TypeScript Guidelines

- Use **strict TypeScript** - avoid `any` types
- Prefer **interfaces** over type aliases for object shapes
- Use **explicit return types** for public functions
- Follow consistent naming conventions

### Code Style

We use oxlint, ESLint (naming only) and oxfmt, all configured from `@venizia/dev-configs`:

```bash
# Check code style: packages, wiki and scripts/
make lint-all

# Auto-fix issues
make lint-fix

# The examples carry their own scripts
bun scripts/examples.ts check
```

For the detailed standards, see the VULCAN base V-C rules (`node_modules/@venizia/vulcan/base/rules.md`) and ARDOR's C rules in [`.agents/rules.md`](.agents/rules.md).

---

## Submitting Pull Requests

### Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub targeting the `develop` branch.

### PR Guidelines

| Item                 | Description                                               |
| -------------------- | --------------------------------------------------------- |
| **Title**            | The commit line: `[#42] feat(admin): pass per-request headers` |
| **Description**      | Explain what and why (not just how)                       |
| **Link issues**      | The body says `Closes #42`                                |
| **Screenshots**      | Include for UI changes                                    |
| **Breaking changes** | Clearly mark and explain                                  |

### PR Checklist

- [ ] All tests pass
- [ ] Code is linted and formatted
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow conventions
- [ ] Branch is up-to-date with `develop`

### Review Process

1. Maintainer reviews your PR (usually within 2-3 days)
2. Feedback or change requests may be provided
3. Address feedback and push updates
4. Once approved, maintainer merges to `develop`

---

## Getting Help

- **Documentation**: [https://ardor.venizia.ai](https://ardor.venizia.ai)
- **Issues**: Search [existing issues](https://github.com/VENIZIA-AI/ardor/issues) before creating new ones
- **Questions**: Use GitHub Discussions or Issues

---

Thank you for contributing to ARDOR!

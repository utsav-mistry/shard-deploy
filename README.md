# shard-deploy

> **Production-grade deployment CLI for Node.js apps — backend-first, frontend-aware.**

[![npm version](https://img.shields.io/npm/v/shard-deploy?color=7C3AED&style=flat-square)](https://www.npmjs.com/package/shard-deploy)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16-green?style=flat-square)](https://nodejs.org)

---

## The Problem

Containerizing a Node.js app shouldn't take half a day.  
Most developers waste hours figuring out the right Dockerfile flags, docker-compose syntax, nginx proxying, and hardcoded API URLs in their React frontends.

**shard-deploy** automates all of that — with clean output, context-aware messages, and zero silent changes.

---

## Features

- **Auto-detects** Node version, port, and entry point from `package.json`
- **Generates** a production-optimised `Dockerfile`, `docker-compose.yml`, and optional `nginx.conf`
- **AST-powered scanner** finds hardcoded `localhost` URLs in frontend code (axios & fetch)
- **Interactive fixer** replaces hardcoded URLs with `process.env.REACT_APP_API_URL` (with diff preview)
- **Backup files** created before any modification
- **Context-aware output** — every message tells you *what* happened and *where*
- **Clearly labeled experimental features** — no surprises

---

## Quick Start

```bash
# One-liner: no install needed
npx shard-deploy init
npx shard-deploy deploy

# Or install globally
npm install -g shard-deploy
shard-deploy init
shard-deploy deploy
```

---

## Commands

### `shard-deploy init`

Analyze your Node.js project and generate deployment files.

```bash
shard-deploy init                  # Auto-detect everything
shard-deploy init --port 8080      # Override port
shard-deploy init --nginx          # Add nginx reverse proxy config
shard-deploy init --nginx --force  # Overwrite existing files
```

**Generates:**
| File | Description |
|---|---|
| `Dockerfile` | Multi-stage build, alpine base, production deps only |
| `docker-compose.yml` | With health checks and env_file support |
| `nginx.conf` | Reverse proxy with security headers *(only with `--nginx`)* |
| `.dockerignore` | Sensible defaults |

---

### `shard-deploy deploy`

Build the Docker image and start containers.

```bash
shard-deploy deploy            # Build + start (foreground)
shard-deploy deploy -d         # Run in background (detached)
shard-deploy deploy --no-cache # Force full rebuild
shard-deploy deploy --rebuild  # Tear down first, then rebuild
```

**Prerequisites:** Docker installed + `shard-deploy init` already run.

---

### `shard-deploy scan`

Scan frontend source files for hardcoded `localhost` API URLs (read-only, no changes made).

```bash
shard-deploy scan
shard-deploy scan --dir ./src
```

**Detects:**
```js
axios.get("http://localhost:5000/api/users")   // ← flagged
fetch("http://localhost:3000/auth/login")       // ← flagged
axios({ url: "http://localhost:4000/data" })    // ← flagged
```

**Skips (with explanation):**
- Template literals — may already use env variables
- Dynamic variable identifiers
- Multi-line call expressions — cannot safely patch

---

### `shard-deploy fix-frontend` ⚠️ EXPERIMENTAL

> **Experimental.** Review all changes carefully before committing.

Scan + show diffs + interactively apply fixes.

```bash
shard-deploy fix-frontend             # Interactive mode
shard-deploy fix-frontend --yes       # Apply all fixes silently
shard-deploy fix-frontend --dir ./src
```

**Example diff output:**

```diff
  File: src/api/user.js

  11   const API = process.env.REACT_APP_API_URL
  12 - axios.get("http://localhost:5000/api/users")
  12 + axios.get(process.env.REACT_APP_API_URL + "/api/users")
  13   .then(res => res.data)
```

**Interactive prompts:**

```
? Apply fix to src/api/user.js:12?
  ❯ Yes — apply this fix
    Skip — leave unchanged
    Apply all remaining fixes
```

A `.bak` backup is saved automatically for every modified file.

---

## Help System

Every command has detailed help:

```bash
shard-deploy --help
shard-deploy init --help
shard-deploy deploy --help
shard-deploy scan --help
shard-deploy fix-frontend --help
```

---

## CLI Output Style

All output uses consistent symbols:

| Symbol | Meaning |
|--------|---------|
| `✔` | Success |
| `⚠` | Warning |
| `✖` | Error |
| `ℹ` | Info |

Example session:

```
  ✔ Node.js 20.11.0 detected
  ✔ package.json read — project: my-api
  ✔ Dockerfile created at ./Dockerfile
  ✔ docker-compose.yml created at ./docker-compose.yml
  ✔ .dockerignore created at ./.dockerignore

  ──────────────────────────────────────────────────────────
  ✔ Deployment files ready!

  ℹ Next steps:
     shard-deploy deploy          — build & start containers
     docker compose up --build    — manual alternative
```

---

## File Structure

```
shard-deploy/
├── bin/
│   └── shard-deploy.js       # CLI entry point
├── commands/
│   ├── init.js               # init command
│   ├── deploy.js             # deploy command
│   ├── scan.js               # scan command
│   └── fix-frontend.js       # fix-frontend command (experimental)
├── core/
│   └── (reserved for future pipeline modules)
├── scanner/
│   ├── index.js              # AST scanner (Babel)
│   └── fixer.js              # Diff renderer + in-place fixer
├── templates/
│   └── index.js              # Dockerfile, docker-compose, nginx templates
├── utils/
│   ├── logger.js             # Consistent output with symbols
│   ├── shell.js              # execSafe, spawnLive, requireDocker
│   └── detect.js            # Port, entry, script detection
└── package.json
```

---

## [!] Experimental Features

The `fix-frontend` command modifies source files. It is clearly labeled as experimental in the CLI output and will always:

1. Show a prominent warning banner before doing anything
2. Display a diff of every change before applying it
3. Ask for confirmation (unless `--yes` is passed)
4. Create a `.bak` backup before modifying any file

**Never use `--yes` in CI without reviewing the scan output first.**

---

## Contributing

Contributions are welcome!

1. Fork the repo
2. Create your branch: `git checkout -b feat/my-feature`
3. Commit: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feat/my-feature`
5. Open a Pull Request

Please open an issue before submitting large changes.

---

## Support This Project

If shard-deploy saved you time, consider giving it a ⭐:

⭐ [Star on GitHub](https://github.com/utsav-mistry/shard-deploy) — it really helps!


---

## Author

**Utsav Mistry** — [@utsav-mistry](https://github.com/utsav-mistry)

---

## License

MIT © 2026 Utsav Mistry — see [LICENSE](LICENSE)

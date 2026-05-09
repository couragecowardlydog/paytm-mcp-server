# Contributing to Paytm Money MCP Server

Thank you for your interest in contributing! This guide covers the process for submitting changes to this project.

## Development Setup

1. **Fork and clone** the repository:

   ```bash
   git clone https://github.com/<your-username>/paytm-mcp-server.git
   cd paytm-mcp-server
   ```

2. **Configure environment variables**:

   ```bash
   cp .env.example .env
   # Fill in your Paytm Money API credentials
   ```

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Start the dev server**:

   ```bash
   npm run dev
   ```

   This runs the MCP server via `tsx` with live reload.

## Running Tests

```bash
npm test            # single run (vitest)
npm run test:watch  # watch mode
```

Ensure all tests pass before submitting a pull request.

## Submitting Changes

1. **Create a branch** from `main` using the naming convention:

   | Type | Branch Name |
   |------|-------------|
   | Feature | `feat/short-description` |
   | Bug fix | `fix/short-description` |
   | Documentation | `docs/short-description` |

2. **Write commits** using [Conventional Commits](https://www.conventionalcommits.org/):

   ```
   feat: add GTT order placement tool
   fix: handle 429 rate-limit retry correctly
   docs: update setup instructions
   ```

3. **Open a pull request** against `main` with:
   - A clear title following the conventional commit format.
   - A description of **what** changed and **why**.
   - Reference any related issues (e.g., `Closes #42`).

4. **Address review feedback** — maintainers may request changes before merging.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold a respectful and inclusive environment for everyone.

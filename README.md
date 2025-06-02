# Diff Digest

A web app that turns GitHub pull request diffs into live, dual-tone release notes using LLMs. Built with Next.js, TypeScript, Tailwind CSS, and OpenAI API.

---

## Features

- Fetches merged pull request diffs from any public GitHub repository
- Streams AI-generated release notes for each PR:
  - **Developer notes:** Technical, concise, and focused on the what/why
  - **Marketing notes:** User-centric, benefit-driven, and simple
- Live UI updates as notes are streamed
- Handles loading, errors, and pagination gracefully
- Fully typed and tested with Jest and React Testing Library

---

## Quick Start

```bash
npm install                # or pnpm / yarn
npm run dev                # open http://localhost:3000
```

---

## Usage

1. Enter a GitHub repo in the format `owner/repo` (e.g., `openai/openai-node`).
2. Click **Load Diffs** to fetch merged PRs.
3. Click **Generate Notes** on any PR to stream developer and marketing release notes.
4. Use **Load More** to paginate through additional PRs.

---

## Running Tests

```bash
npm test
```

---

## Environment Variables

Create a `.env.local` file in the root directory:

```
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your_preferred_owner
GITHUB_REPO=your_preferred_repo
OPENAI_API_KEY=your_openai_api_key
```

- `GITHUB_TOKEN` (optional): Increases GitHub API rate limits.
- `GITHUB_OWNER`/`GITHUB_REPO` (optional): Set default repo.
- `OPENAI_API_KEY`: Your OpenAI API key for generating release notes.

**Free OpenAI key for this assignment:**
- Get it at https://api.a0.dev/test-key
- Supported models: `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-4o-mini`, `o1-mini`, `o3-mini`, `o4-mini`

---

## Tech Stack

- Next.js 15 (Edge runtime)
- TypeScript
- Tailwind CSS
- OpenAI SDK
- @octokit/rest
- Jest & React Testing Library

---

## License

MIT

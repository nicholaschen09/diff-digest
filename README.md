# a0.dev – Take-Home Interview: Diff Digest

**Challenge:** Build a web experience that turns Git diffs into live, dual-tone release notes.  
**Time-box:** 24 hours from when you received the email

---

## 1 · Background

a0.dev ships AI-generated React Native apps at lightning speed.  
We lean on LLMs, streaming APIs, and polished UIs.  
This exercise lets you show how you design prompts, pipeline data, and craft front-end experiences.

---

## 2 · Current State

- **API Endpoint:** `GET /api/sample-diffs`

  - Fetches merged pull request diffs directly from a specified GitHub repository.
  - Uses the GitHub API via `@octokit/rest`.
  - Supports pagination and repository selection via query parameters.
  - **Defaults:** `owner=openai`, `repo=openai-node`, `per_page=10`
  - **Query Parameters:**
    - `owner` (string, optional): GitHub repository owner.
    - `repo` (string, optional): GitHub repository name.
    - `page` (number, optional): Page number for pagination (default: 1).
    - `per_page` (number, optional): Number of items per page (default: 10).
  - **Response Format (Success):**
    ```json
    {
      "diffs": [
        {
          "id": "<pr_number>",
          "description": "<pr_title>",
          "diff": "<diff_content>",
          "url": "<pr_html_url>"
        },
        // ... more diffs
      ],
      "nextPage": <number | null>,
      "currentPage": <number>,
      "perPage": <number>
    }
    ```
  - **Response Format (Error):**
    ```json
    {
      "error": "<error_message>",
      "details": "<optional_details>"
    }
    ```

- **Frontend:**

  - A basic Next.js page (`src/app/page.tsx`) is set up to fetch and display the list of merged pull requests from the API.
  - Uses Client Components and `useState` for managing state.
  - Includes basic loading, error handling, and pagination ("Load More" button).

- **Starter repo:** Next 15 Edge runtime, TypeScript, OpenAI SDK, ESLint, Tailwind CSS, `@octokit/rest`.

---

## 3 · Your task

1.  **(Partially Done)** **Fetch merged PR diffs** from `/api/sample-diffs` (the frontend currently fetches and lists PRs, but doesn't use the diff content yet).
2.  **Send the relevant PR's** to an LLM and stream back _developer_ and _marketing_ release-note sentences.

    - **Developer notes:** Should be concise, technical, and focus on the _what_ and _why_ of the change (e.g., "Refactored `useFetchDiffs` hook to use `useSWR` for improved caching and reduced re-renders.").
    - **Marketing notes:** Should be user-centric, highlight the _benefit_ of the change, and use simpler language (e.g., "Loading pull requests is now faster and smoother thanks to improved data fetching!").

3.  **Render a UI** that updates live as chunks arrive, showing the generated release notes for the selected PR(s).
4.  **Handle edge cases** (loading, network failure, malformed JSON, API errors) gracefully.

You are free to decide:

- How and which PR(s) to generate notes for.
- How to display the streaming results.
- SSE vs. WebSocket for streaming.
- Any additional component library or CSS approach.

High agency and thoughtful trade-offs are what we're looking for. Specifically, we're interested in seeing:

- **Prompt Engineering:** How effectively you instruct the LLM to generate the desired dual-tone notes from the provided diff context.
- **Streaming Handling:** Your approach to managing and displaying the streaming data smoothly in the UI.
- **LLM Robustness:** How you handle potential LLM quirks like hallucinations, inconsistencies, or refusals.
- **API Integration:** Clean and efficient integration with both the diffs API and the LLM API.
- **Code Quality & Structure:** Well-organized, readable, and maintainable code.
- **UI/UX:** A clear and intuitive user interface for selecting PRs and viewing the generated notes.

---

## 4 · Stretch – optional bonus

- Implement **tool-calling** to enrich the stream (e.g., summarize related issues, identify key contributors).
- Implement **state persistence/synchronization** so that refreshing the page doesn't lose generated notes or interrupt the stream's progress.

## 5 · Quick start

```bash
npm install                # or pnpm / yarn
npm run dev                # open http://localhost:3000
```

---

## 6 · Environment Variables (Optional)

- `GITHUB_TOKEN`: A GitHub personal access token can be provided to increase API rate limits when fetching diffs.
- `GITHUB_OWNER`: Override the default repository owner (`openai`).
- `GITHUB_REPO`: Override the default repository name (`openai-node`).
- `OPENAI_API_KEY`: Your OpenAI API key for generating release notes.

Create a `.env.local` file in the root directory:

```
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your_preferred_owner
GITHUB_REPO=your_preferred_repo
OPENAI_API_KEY=your_openai_api_key
```

**Alternatively, you can use the provided free API key for this take-home assignment:**

```
You can find the OpenAI key @ https://api.a0.dev/test-key
```

**Available Models for the free key:** `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-4o-mini`, `o1-mini`, `o3-mini`, and `o4-mini`.

You can still use your own OpenAI API key if you prefer.

---

## 7 · Submission

- Upload the completed project to github and submit the Github Repo URL and live deployment URL to careers@a0.dev.
- Submit by the 24-hour mark; avoid force-push after deadline.

---

## 8 · Ground rules

- Any AI tools & libraries allowed—cite non-trivial code.
- Keep secrets out of git (use `.env.local` for tokens).

**Have fun!**  
We can't wait to see how you prompt, stream, and ship 🚀

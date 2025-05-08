import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});

// Default repository settings
const DEFAULT_OWNER = process.env.GITHUB_OWNER || 'openai';
const DEFAULT_REPO = process.env.GITHUB_REPO || 'openai-node';

export const runtime = 'edge';

// Function to extract GitHub issue references from PR description
function extractIssueReferences(description: string | undefined): string[] {
    if (!description) return [];

    // Match patterns like #123, fixes #123, closes #123, etc.
    const issueRegex = /#(\d+)/g;
    const matches = description.match(issueRegex);

    if (!matches) return [];

    return matches.map(match => match.replace('#', ''));
}

// Function to extract PR number from URL or ID
const extractPRNumber = (idOrUrl: string): number | null => {
    // If it's already just a number
    if (/^\d+$/.test(idOrUrl)) {
        return parseInt(idOrUrl);
    }

    // Check if it's a URL and extract PR number
    const urlMatch = idOrUrl.match(/\/pull\/(\d+)/);
    if (urlMatch && urlMatch[1]) {
        return parseInt(urlMatch[1]);
    }

    return null;
};

// Function to get real contributors from GitHub API
async function getContributorsFromGitHub(prNumber: number) {
    try {
        // Dynamically import octokit to avoid CommonJS/ESM issues
        const { Octokit } = await import('@octokit/rest');

        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN || '',
        });

        // Get PR information including author
        const { data: pr } = await octokit.pulls.get({
            owner: DEFAULT_OWNER,
            repo: DEFAULT_REPO,
            pull_number: prNumber,
        });

        // Get all PR commits
        const { data: commits } = await octokit.pulls.listCommits({
            owner: DEFAULT_OWNER,
            repo: DEFAULT_REPO,
            pull_number: prNumber,
            per_page: 100,
        });

        // Extract unique contributors from commits
        const contributors = new Map();

        // Add PR author
        if (pr.user) {
            contributors.set(pr.user.login, {
                login: pr.user.login,
                name: pr.user.name || pr.user.login,
                role: 'Author',
                avatar_url: pr.user.avatar_url,
            });
        }

        // Add committers
        for (const commit of commits) {
            if (commit.author) {
                const login = commit.author.login;
                if (!contributors.has(login)) {
                    contributors.set(login, {
                        login: login,
                        name: commit.commit.author?.name || login,
                        role: 'Committer',
                        avatar_url: commit.author.avatar_url,
                    });
                }
            }
        }

        return Array.from(contributors.values());
    } catch (error) {
        console.error('Error fetching contributors from GitHub:', error);
        return [];
    }
}

export async function POST(req: NextRequest) {
    try {
        const { diff, description, id, url } = await req.json();

        if (!diff) {
            return NextResponse.json(
                { error: 'No diff content provided' },
                { status: 400 }
            );
        }

        let diffContent = diff;

        // Limit diff size if needed to avoid token limits
        if (diffContent.length > 50000) {
            diffContent = diffContent.substring(0, 50000) + '... [truncated]';
        }

        // Extract related issues from description for context
        const relatedIssues = extractIssueReferences(description);
        const issuesContext = relatedIssues.length > 0
            ? `Related issues: ${relatedIssues.map(issue => `#${issue}`).join(', ')}`
            : 'No related issues found in PR description.';

        // Get GitHub contributors
        let contributorsContext = 'No specific contributors detected.';
        const prNumber = extractPRNumber(id) || extractPRNumber(url || '');

        if (prNumber) {
            const contributors = await getContributorsFromGitHub(prNumber);
            if (contributors.length > 0) {
                const contributorInfo = contributors.map(c =>
                    `${c.name} (@${c.login}) - ${c.role}`
                ).join(', ');
                contributorsContext = `Contributors: ${contributorInfo}`;
            }
        }

        // Create a streaming response with a timeout
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 30000); // 30-second timeout

        try {
            const stream = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a dual-tone release note generator with ability to analyze diffs. For the given Git diff, generate TWO types of notes:
                1. DEVELOPER NOTE: Technical, concise, focused on what was changed and why. Include technical details relevant to developers.
                2. MARKETING NOTE: User-centric, highlights benefits, uses simpler language to explain the impact.
                
                Format your response as follows:
                DEVELOPER: [your developer note here]
                MARKETING: [your marketing note here]
                
                Additionally, you should provide:
                CONTRIBUTORS: [list specific contributor names/usernames who worked on this PR; identify their roles if possible]
                CHANGES: [detailed analysis of the scope and type of changes - feature, bugfix, refactor, etc.]
                
                Important guidelines:
                - Make each note a single sentence, less than 150 characters if possible
                - Be specific about what changed based on the diff content
                - Don't hallucinate features not evident in the diff
                - For contributors, be specific with names - don't make up contributors if none are evident
                - If you cannot determine what changed, say so honestly
                - Do not include markdown formatting`
                    },
                    {
                        role: 'user',
                        content: `Generate release notes for this PR #${id}: "${description}"\n\nContext: ${issuesContext}\n\nContributors Context: ${contributorsContext}\n\nDiff:\n${diffContent}`
                    }
                ],
                stream: true,
                max_tokens: 1000, // Limit response size
            }, {
                signal: abortController.signal
            });

            // Create a readable stream for the client
            const readableStream = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of stream) {
                            const content = chunk.choices[0]?.delta?.content || '';
                            if (content) {
                                // Send the content as it arrives
                                controller.enqueue(new TextEncoder().encode(content));
                            }
                        }
                        controller.close();
                    } catch (err: unknown) {
                        if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
                            controller.enqueue(new TextEncoder().encode(
                                "\n\nDEVELOPER: Request timed out. Please try again later.\n" +
                                "MARKETING: Request timed out. Please try again later.\n" +
                                "CONTRIBUTORS: Unknown due to timeout.\n" +
                                "CHANGES: Unknown due to timeout."
                            ));
                        } else {
                            controller.enqueue(new TextEncoder().encode(
                                "\n\nDEVELOPER: Error generating notes. Please try again.\n" +
                                "MARKETING: Error generating notes. Please try again.\n" +
                                "CONTRIBUTORS: Unknown due to error.\n" +
                                "CHANGES: Unknown due to error."
                            ));
                        }
                        controller.close();
                    }
                },
            });

            // Return the stream as SSE
            return new Response(readableStream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (error) {
        console.error('Error with OpenAI API:', error);
        return NextResponse.json(
            {
                error: 'Failed to generate release notes',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 
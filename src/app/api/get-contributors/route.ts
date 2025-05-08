import { NextRequest, NextResponse } from 'next/server';

// Default repository settings
const DEFAULT_OWNER = process.env.GITHUB_OWNER || 'openai';
const DEFAULT_REPO = process.env.GITHUB_REPO || 'openai-node';

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

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const prId = url.searchParams.get('pr');

    if (!prId) {
        return NextResponse.json(
            { error: 'Missing PR ID or URL' },
            { status: 400 }
        );
    }

    try {
        const prNumber = extractPRNumber(prId);

        if (!prNumber) {
            return NextResponse.json(
                { error: 'Invalid PR ID format' },
                { status: 400 }
            );
        }

        const contributors = await getContributorsFromGitHub(prNumber);

        return NextResponse.json({
            success: true,
            contributors
        });
    } catch (error) {
        console.error('Error fetching contributors:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch contributors',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

// Default repository settings
const DEFAULT_OWNER = process.env.GITHUB_OWNER || 'openai';
const DEFAULT_REPO = process.env.GITHUB_REPO || 'openai-node';

// Initialize Octokit with proper error handling
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
    log: {
        debug: () => { },
        info: () => { },
        warn: console.warn,
        error: console.error
    }
});

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

async function getContributorsFromGitHub(prNumber: string, owner: string, repo: string) {
    try {
        // First get the PR details to get the author
        const prResponse = await octokit.pulls.get({
            owner,
            repo,
            pull_number: parseInt(prNumber, 10)
        });

        const author = prResponse.data.user;
        const contributors: Array<{
            login: string;
            name: string;
            role: string;
            avatar_url: string;
        }> = [];

        // Add the PR author
        if (author) {
            contributors.push({
                login: author.login,
                name: author.name || author.login,
                role: 'Author',
                avatar_url: author.avatar_url
            });
        }

        // Get PR reviews to find reviewers
        const reviewsResponse = await octokit.pulls.listReviews({
            owner,
            repo,
            pull_number: parseInt(prNumber, 10)
        });

        // Add unique reviewers
        const reviewers = new Set();
        reviewsResponse.data.forEach(review => {
            if (review.user && !reviewers.has(review.user.login)) {
                reviewers.add(review.user.login);
                contributors.push({
                    login: review.user.login,
                    name: review.user.name || review.user.login,
                    role: 'Reviewer',
                    avatar_url: review.user.avatar_url
                });
            }
        });

        // Get PR commits to find committers
        const commitsResponse = await octokit.pulls.listCommits({
            owner,
            repo,
            pull_number: parseInt(prNumber, 10)
        });

        // Add unique committers
        const committers = new Set();
        commitsResponse.data.forEach(commit => {
            if (commit.author && !committers.has(commit.author.login)) {
                committers.add(commit.author.login);
                contributors.push({
                    login: commit.author.login,
                    name: commit.author.name || commit.author.login,
                    role: 'Committer',
                    avatar_url: commit.author.avatar_url
                });
            }
        });

        return contributors;
    } catch (error: any) {
        console.error('Error fetching contributors:', error);
        throw error;
    }
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const prId = url.searchParams.get('pr');
    const owner = url.searchParams.get('owner');
    const repo = url.searchParams.get('repo');

    if (!prId || !owner || !repo) {
        return NextResponse.json({
            success: false,
            error: 'Missing required parameters: pr, owner, or repo',
            contributors: []
        }, { status: 400 });
    }

    try {
        const contributors = await getContributorsFromGitHub(prId, owner, repo);
        return NextResponse.json({
            success: true,
            contributors
        });
    } catch (error: any) {
        console.error('Error in get-contributors endpoint:', error);

        // Handle specific GitHub API errors
        if (error.status === 403) {
            return NextResponse.json({
                success: false,
                error: 'GitHub API rate limit exceeded. Please try again later or use a GitHub token.',
                contributors: []
            }, { status: 403 });
        }

        if (error.status === 401) {
            return NextResponse.json({
                success: false,
                error: 'GitHub API authentication failed. Please check your GitHub token.',
                contributors: []
            }, { status: 401 });
        }

        if (error.status === 404) {
            return NextResponse.json({
                success: false,
                error: `Repository or PR not found: ${owner}/${repo}#${prId}`,
                contributors: []
            }, { status: 404 });
        }

        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch contributors',
            contributors: []
        }, { status: error.status || 500 });
    }
} 
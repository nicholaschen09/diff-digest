import { NextResponse } from 'next/server';

// Initialize Octokit with proper error handling
let octokit: any;

async function initializeOctokit() {
    const { Octokit } = await import('@octokit/rest');
    octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
        request: {
            timeout: 10000
        }
    });
}

// Default repository details (can be overridden by environment variables)
const DEFAULT_OWNER = 'openai';
const DEFAULT_REPO = 'openai-node';
const DEFAULT_PER_PAGE = 10;

export async function GET(request: Request) {
    // Initialize Octokit if not already initialized
    if (!octokit) {
        await initializeOctokit();
    }

    // Verify GitHub authentication first
    try {
        const { data: user } = await octokit.rest.users.getAuthenticated();
        console.log('Successfully authenticated as:', user.login);
    } catch (error: any) {
        console.error('GitHub authentication failed:', error.message);
        if (error.status === 403) {
            return NextResponse.json({
                error: 'GitHub API rate limit exceeded. Please try again later or use a different GitHub token.',
                details: error.message,
                diffs: [],
                nextPage: null,
                currentPage: 1,
                perPage: DEFAULT_PER_PAGE
            }, { status: 403 });
        }
        return NextResponse.json({
            error: 'GitHub authentication failed. Please check your token.',
            details: error.message,
            diffs: [],
            nextPage: null,
            currentPage: 1,
            perPage: DEFAULT_PER_PAGE
        }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const pageQuery = searchParams.get('page');
    const perPageQuery = searchParams.get('per_page');
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    // Validate required parameters
    if (!owner || !repo) {
        return NextResponse.json({
            error: 'Both owner and repo parameters are required',
            diffs: [],
            nextPage: null,
            currentPage: 1,
            perPage: DEFAULT_PER_PAGE
        }, { status: 400 });
    }

    // Parse and validate page parameter
    const page = pageQuery ? parseInt(pageQuery, 10) : 1;
    if (isNaN(page) || page <= 0) {
        return NextResponse.json({
            error: 'Invalid page parameter. Must be a positive number.',
            diffs: [],
            nextPage: null,
            currentPage: page,
            perPage: DEFAULT_PER_PAGE
        }, { status: 400 });
    }

    // Parse and validate per_page parameter
    const perPage = perPageQuery ? parseInt(perPageQuery, 10) : DEFAULT_PER_PAGE;
    if (isNaN(perPage) || perPage <= 0 || perPage > 100) {
        return NextResponse.json({
            error: 'Invalid per_page parameter. Must be a positive number between 1 and 100.',
            diffs: [],
            nextPage: null,
            currentPage: page,
            perPage: DEFAULT_PER_PAGE
        }, { status: 400 });
    }

    try {
        // First verify the repository exists
        try {
            await octokit.repos.get({
                owner,
                repo
            });
        } catch (repoError: any) {
            if (repoError.status === 404) {
                return NextResponse.json({
                    error: `Repository not found: ${owner}/${repo}`,
                    diffs: [],
                    nextPage: null,
                    currentPage: page,
                    perPage: perPage
                }, { status: 404 });
            }
            throw repoError;
        }

        // Fetch closed pull requests (includes merged)
        const { data: closedPrs, headers } = await octokit.pulls.list({
            owner,
            repo,
            state: 'closed',
            per_page: perPage,
            page,
            sort: 'updated',
            direction: 'desc',
        });

        // Filter for merged PRs
        const mergedPrs = closedPrs.filter((pr: { merged_at: string | null }) => pr.merged_at);

        // Fetch diffs for each merged PR in parallel
        const diffsPromises = mergedPrs.map(async (pr: { number: number; title: string; html_url: string }) => {
            try {
                const diffResponse = await octokit.pulls.get({
                    owner,
                    repo,
                    pull_number: pr.number,
                    mediaType: {
                        format: 'diff',
                    },
                });

                const diffText = diffResponse.data as unknown as string;

                return {
                    id: pr.number.toString(),
                    description: pr.title,
                    diff: diffText,
                    url: pr.html_url,
                };
            } catch (diffError) {
                console.error(`Failed to fetch diff for PR #${pr.number}:`, diffError);
                return null;
            }
        });

        const diffResults = (await Promise.all(diffsPromises)).filter(d => d !== null);

        // Basic pagination info based on Link header
        const linkHeader = headers.link;
        let nextPage: number | null = null;
        if (linkHeader) {
            const links = linkHeader.split(',').map((a: string) => a.split(';'));
            const nextLink = links.find((link: string[]) => link[1].includes('rel="next"'));
            if (nextLink) {
                const url = new URL(nextLink[0].trim().slice(1, -1));
                nextPage = parseInt(url.searchParams.get('page') || '0', 10);
            }
        }

        return NextResponse.json({
            diffs: diffResults,
            nextPage: nextPage,
            currentPage: page,
            perPage: perPage
        });
    } catch (error: any) {
        console.error('Error fetching data from GitHub:', error);

        // Handle specific GitHub API errors
        if (error.status === 403) {
            return NextResponse.json({
                error: 'GitHub API rate limit exceeded. Please try again later or use a GitHub token.',
                diffs: [],
                nextPage: null,
                currentPage: page,
                perPage: perPage
            }, { status: 403 });
        }

        if (error.status === 401) {
            return NextResponse.json({
                error: 'GitHub API authentication failed. Please check your GitHub token.',
                diffs: [],
                nextPage: null,
                currentPage: page,
                perPage: perPage
            }, { status: 401 });
        }

        return NextResponse.json({
            error: error.message || 'Failed to fetch data from GitHub',
            diffs: [],
            nextPage: null,
            currentPage: page,
            perPage: perPage
        }, { status: error.status || 500 });
    }
}

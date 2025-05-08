import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

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

// Default repository details (can be overridden by environment variables)
const DEFAULT_OWNER = 'openai';
const DEFAULT_REPO = 'openai-node';

export async function GET(request: Request) {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const pageQuery = searchParams.get('page');
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    // Validate required parameters
    if (!owner || !repo) {
        return NextResponse.json({
            error: 'Both owner and repo parameters are required',
            diffs: [],
            nextPage: null,
            currentPage: 1,
            perPage: 100
        }, { status: 400 });
    }

    const page = pageQuery ? parseInt(pageQuery, 10) : 1;

    if (isNaN(page) || page <= 0) {
        return NextResponse.json({
            error: 'Invalid page parameter',
            diffs: [],
            nextPage: null,
            currentPage: page,
            perPage: 100
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
                    perPage: 100
                }, { status: 404 });
            }
            throw repoError;
        }

        // Fetch closed pull requests (includes merged)
        const { data: closedPrs, headers } = await octokit.pulls.list({
            owner,
            repo,
            state: 'closed',
            per_page: 100,
            page,
            sort: 'updated',
            direction: 'desc',
        });

        // Filter for merged PRs
        const mergedPrs = closedPrs.filter(pr => pr.merged_at);

        // Fetch diffs for each merged PR in parallel
        const diffsPromises = mergedPrs.map(async (pr) => {
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
            const links = linkHeader.split(',').map(a => a.split(';'));
            const nextLink = links.find(link => link[1].includes('rel="next"'));
            if (nextLink) {
                const url = new URL(nextLink[0].trim().slice(1, -1));
                nextPage = parseInt(url.searchParams.get('page') || '0', 10);
            }
        }

        return NextResponse.json({
            diffs: diffResults,
            nextPage: nextPage,
            currentPage: page,
            perPage: 100
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
                perPage: 100
            }, { status: 403 });
        }

        if (error.status === 401) {
            return NextResponse.json({
                error: 'GitHub API authentication failed. Please check your GitHub token.',
                diffs: [],
                nextPage: null,
                currentPage: page,
                perPage: 100
            }, { status: 401 });
        }

        return NextResponse.json({
            error: error.message || 'Failed to fetch data from GitHub',
            diffs: [],
            nextPage: null,
            currentPage: page,
            perPage: 100
        }, { status: error.status || 500 });
    }
}

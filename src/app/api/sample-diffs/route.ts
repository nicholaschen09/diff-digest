import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

// Initialize Octokit. Use GITHUB_TOKEN environment variable for authentication if available.
// Unauthenticated requests are subject to stricter rate limits.
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

// Default repository details (can be overridden by environment variables)
const DEFAULT_OWNER = 'openai';
const DEFAULT_REPO = 'openai-node';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const owner = process.env.GITHUB_OWNER || searchParams.get('owner') || DEFAULT_OWNER;
    const repo = process.env.GITHUB_REPO || searchParams.get('repo') || DEFAULT_REPO;
    const perPageQuery = searchParams.get('per_page');
    const pageQuery = searchParams.get('page');

    const per_page = perPageQuery ? parseInt(perPageQuery, 10) : 10;
    const page = pageQuery ? parseInt(pageQuery, 10) : 1;

    if (isNaN(per_page) || per_page <= 0) {
        return NextResponse.json({ error: 'Invalid per_page parameter' }, { status: 400 });
    }
    if (isNaN(page) || page <= 0) {
        return NextResponse.json({ error: 'Invalid page parameter' }, { status: 400 });
    }

    try {
        // Fetch closed pull requests (includes merged)
        const { data: closedPrs, headers } = await octokit.pulls.list({
            owner,
            repo,
            state: 'closed',
            per_page,
            page,
            sort: 'updated', // Get most recently updated ones first
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
                        format: 'diff', // Request the diff format
                    },
                });

                // The diff content is directly in the data for this media type
                const diffText = diffResponse.data as unknown as string; // Octokit types might be slightly off for mediaType requests

                return {
                    id: pr.number.toString(), // Use PR number as ID
                    description: pr.title,
                    diff: diffText,
                    url: pr.html_url, // Add the PR URL for context
                };
            } catch (diffError) {
                let message = 'Unknown error fetching diff';
                if (diffError instanceof Error) {
                    message = diffError.message;
                }
                console.error(`Failed to fetch diff for PR #${pr.number}:`, message);
                // Return null or a specific error object if a single diff fails
                return null;
            }
        });

        const diffResults = (await Promise.all(diffsPromises)).filter(d => d !== null); // Filter out any nulls from failed diff fetches

        // Basic pagination info based on Link header (if available)
        const linkHeader = headers.link;
        let nextPage: number | null = null;
        if (linkHeader) {
            const links = linkHeader.split(',').map(a => a.split(';'));
            const nextLink = links.find(link => link[1].includes('rel="next"'));
            if (nextLink) {
                const url = new URL(nextLink[0].trim().slice(1, -1)); // Extract URL from <...>
                nextPage = parseInt(url.searchParams.get('page') || '0', 10);
            }
        }


        return NextResponse.json({
            diffs: diffResults,
            nextPage: nextPage,
            currentPage: page,
            perPage: per_page
        });

    } catch (error) {
        let errorMessage = 'Unknown error fetching pull requests';
        let errorStatus = 500;
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        if (typeof error === 'object' && error !== null && 'status' in error) {
            errorStatus = (error.status as number); // Keep 'any' for status as it comes from Octokit error
        }

        console.error('GitHub API Error:', errorMessage);
        // Distinguish rate limit errors if possible
        if (errorStatus === 403 && errorMessage.includes('rate limit exceeded')) {
            return NextResponse.json({ error: 'GitHub API rate limit exceeded. Please try again later or provide a GITHUB_TOKEN environment variable.' }, { status: 429 });
        }
        if (errorStatus === 404) {
            return NextResponse.json({ error: `Repository not found: ${owner}/${repo}` }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to fetch pull requests from GitHub.', details: errorMessage }, { status: errorStatus });
    }
}

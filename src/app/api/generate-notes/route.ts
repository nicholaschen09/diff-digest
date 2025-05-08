import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});

export const runtime = 'edge';

// Function to extract GitHub issue references from PR description
const extractIssueReferences = (description: string) => {
    // Match patterns like #123, fixes #123, closes #123, etc.
    const issueRegex = /#(\d+)/g;
    const matches = description.match(issueRegex);

    if (!matches) return [];

    // Extract just the numbers and remove duplicates
    return [...new Set(matches.map(match => match.replace('#', '')))];
};

export async function POST(req: NextRequest) {
    // Get the diff data from the request
    let { diff, description, id } = await req.json();

    if (!diff) {
        return NextResponse.json(
            { error: 'Missing diff content' },
            { status: 400 }
        );
    }

    try {
        // Limit diff size if needed to avoid token limits
        if (diff.length > 50000) {
            diff = diff.substring(0, 50000) + '... [truncated]';
        }

        // Extract related issues from description for context
        const relatedIssues = extractIssueReferences(description);
        const issuesContext = relatedIssues.length > 0
            ? `Related issues: ${relatedIssues.map(issue => `#${issue}`).join(', ')}`
            : 'No related issues found in PR description.';

        // Create a streaming response
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
            CONTRIBUTORS: [list of potential contributors based on the diff]
            CHANGES: [analysis of the scope and type of changes - feature, bugfix, refactor, etc.]
            
            Important guidelines:
            - Make each note a single sentence, less than 150 characters if possible
            - Be specific about what changed based on the diff content
            - Don't hallucinate features not evident in the diff
            - If you cannot determine what changed, say so honestly
            - Do not include markdown formatting`
                },
                {
                    role: 'user',
                    content: `Generate release notes for this PR #${id}: "${description}"\n\nContext: ${issuesContext}\n\nDiff:\n${diff}`
                }
            ],
            stream: true,
        });

        // Create a readable stream for the client
        const readableStream = new ReadableStream({
            async start(controller) {
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) {
                        // Send the content as it arrives
                        controller.enqueue(new TextEncoder().encode(content));
                    }
                }
                controller.close();
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
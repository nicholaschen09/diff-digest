import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const { query, owner, repo, diffs } = await req.json();

    // Compose a prompt with context if needed
    const userPrompt = [
        `Repository: ${owner}/${repo}`,
        diffs && Array.isArray(diffs) && diffs.length > 0 ? `Diffs: ${JSON.stringify(diffs).slice(0, 4000)}` : '',
        `User Query: ${query}`
    ].filter(Boolean).join('\n\n');

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'You are an AI assistant for PRs and diffs. Answer user questions about pull requests, diffs, and repositories.' },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 1024,
        }),
    });

    if (!groqRes.ok) {
        return NextResponse.json({ error: 'Groq API failed' }, { status: 500 });
    }

    const data = await groqRes.json();
    return NextResponse.json({ answer: data.choices?.[0]?.message?.content || '' });
} 
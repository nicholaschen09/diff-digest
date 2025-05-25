export function parseNotes(text: string) {
    // Initialize with empty values
    let devNote = '';
    let marketingNote = '';
    let feedback = '';
    let security = '';
    let readability = '';
    let tests = '';
    let contributors = '';
    let changes = '';

    try {
        // Use regex without 's' flag by replacing newlines with a placeholder
        const processedText = text.replace(/\n/g, ' __NEWLINE__ ');

        // Check for developer notes section
        const devMatch = processedText.match(/DEVELOPER:\s*(.*?)(?=MARKETING:|$)/);
        if (devMatch && devMatch[1]) {
            devNote = devMatch[1].replace(/__NEWLINE__/g, '\n').trim();
        }

        // Check for marketing notes section
        const marketingMatch = processedText.match(/MARKETING:\s*(.*?)(?=FEEDBACK:|$)/);
        if (marketingMatch && marketingMatch[1]) {
            marketingNote = marketingMatch[1].replace(/__NEWLINE__/g, '\n').trim();
        }

        // Check for feedback section
        const feedbackMatch = processedText.match(/FEEDBACK:\s*(.*?)(?=SECURITY:|$)/);
        if (feedbackMatch && feedbackMatch[1]) {
            feedback = feedbackMatch[1].replace(/__NEWLINE__/g, '\n').trim();
        }

        // Check for security section
        const securityMatch = processedText.match(/SECURITY:\s*(.*?)(?=READABILITY:|$)/);
        if (securityMatch && securityMatch[1]) {
            security = securityMatch[1].replace(/__NEWLINE__/g, '\n').trim();
        }

        // Check for readability section
        const readabilityMatch = processedText.match(/READABILITY:\s*(.*?)(?=TESTS:|$)/);
        if (readabilityMatch && readabilityMatch[1]) {
            readability = readabilityMatch[1].replace(/__NEWLINE__/g, '\n').trim();
        }

        // Check for tests section
        const testsMatch = processedText.match(/TESTS:\s*(.*?)(?=CONTRIBUTORS:|$)/);
        if (testsMatch && testsMatch[1]) {
            tests = testsMatch[1].replace(/__NEWLINE__/g, '\n').trim();
        }

        // Check for contributors section
        const contributorsMatch = processedText.match(/CONTRIBUTORS:\s*(.*?)(?=CHANGES:|$)/);
        if (contributorsMatch && contributorsMatch[1]) {
            contributors = contributorsMatch[1].replace(/__NEWLINE__/g, '\n').trim();
        }

        // Check for changes section
        const changesMatch = processedText.match(/CHANGES:\s*(.*?)$/);
        if (changesMatch && changesMatch[1]) {
            changes = changesMatch[1].replace(/__NEWLINE__/g, '\n').trim();
        }

        return { devNote, marketingNote, feedback, security, readability, tests, contributors, changes };
    } catch (parseError) {
        console.error('Error parsing notes:', parseError);
        // If there's a parse error but we have developer notes, return raw text
        if (text.includes('DEVELOPER:')) {
            return { devNote: text, marketingNote: '', feedback: '', security: '', readability: '', tests: '', contributors: '', changes: '' };
        }
        throw parseError;
    }
} 
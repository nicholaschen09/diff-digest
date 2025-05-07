import { useState, useImperativeHandle, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { usePersistedState } from '@/lib/usePersistedState';

interface DiffCardProps {
    id: string;
    description: string;
    diff: string;
    url: string;
}

interface NoteState {
    devNote: string;
    marketingNote: string;
}

const DiffCard = forwardRef<{ generateNotes: () => Promise<void> }, DiffCardProps>(
    ({ id, description, diff, url }, ref) => {
        const [isExpanded, setIsExpanded] = useState(false);
        const [isGenerating, setIsGenerating] = useState(false);
        const [error, setError] = useState<string | null>(null);

        // Use persisted state for notes to maintain across page refreshes
        const [notes, setNotes] = usePersistedState<NoteState>(`diff-notes-${id}`, {
            devNote: '',
            marketingNote: ''
        });

        const { devNote, marketingNote } = notes;

        // Handle streaming from the API
        const handleGenerateNotes = async () => {
            // Skip if already generating
            if (isGenerating) return;

            setNotes({ devNote: '', marketingNote: '' });
            setError(null);
            setIsGenerating(true);

            try {
                const response = await fetch('/api/generate-notes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        id,
                        description,
                        diff,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // Process the streaming response
                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error('ReadableStream not supported');
                }

                let receivedText = '';
                let receivingDev = true; // Start with developer note

                // Read the stream
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    // Decode and append the chunk
                    const chunk = new TextDecoder().decode(value);
                    receivedText += chunk;

                    // Parse text for developer and marketing notes
                    if (receivedText.includes('DEVELOPER:')) {
                        const devStart = receivedText.indexOf('DEVELOPER:') + 'DEVELOPER:'.length;
                        let devEnd = receivedText.indexOf('MARKETING:');

                        if (devEnd === -1) {
                            // Still receiving the developer note
                            setNotes(prev => ({ ...prev, devNote: receivedText.substring(devStart).trim() }));
                        } else {
                            // Found both tags, can separate the notes
                            receivingDev = false;
                            const updatedDevNote = receivedText.substring(devStart, devEnd).trim();

                            const marketingStart = devEnd + 'MARKETING:'.length;
                            const updatedMarketingNote = receivedText.substring(marketingStart).trim();

                            setNotes({
                                devNote: updatedDevNote,
                                marketingNote: updatedMarketingNote
                            });
                        }
                    } else if (receivingDev) {
                        setNotes(prev => ({ ...prev, devNote: receivedText.trim() }));
                    } else {
                        setNotes(prev => ({ ...prev, marketingNote: receivedText.trim() }));
                    }
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
            } finally {
                setIsGenerating(false);
            }
        };

        // Expose methods to parent component
        useImperativeHandle(ref, () => ({
            generateNotes: handleGenerateNotes
        }));

        return (
            <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 mb-4 bg-white dark:bg-gray-900 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-lg font-semibold">
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                PR #{id}
                            </a>
                        </h3>
                        <p className="text-gray-700 dark:text-gray-300">{description}</p>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
                        >
                            {isExpanded ? 'Hide Details' : 'Show Details'}
                        </button>
                        <button
                            onClick={handleGenerateNotes}
                            disabled={isGenerating}
                            className={cn(
                                "px-3 py-1 text-xs text-white rounded transition-colors",
                                isGenerating
                                    ? "bg-gray-500"
                                    : "bg-blue-600 hover:bg-blue-700"
                            )}
                        >
                            {isGenerating ? 'Generating...' : 'Generate Notes'}
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded overflow-auto max-h-64 text-xs font-mono">
                        <pre className="whitespace-pre-wrap break-words">{diff}</pre>
                    </div>
                )}

                {(devNote || marketingNote || error) && (
                    <div className="mt-4 space-y-3">
                        {error && (
                            <div className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded">
                                Error: {error}
                            </div>
                        )}

                        {devNote && (
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded">
                                <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">DEVELOPER NOTE</h4>
                                <p className="text-gray-800 dark:text-gray-200">{devNote}</p>
                            </div>
                        )}

                        {marketingNote && (
                            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded">
                                <h4 className="text-sm font-bold text-green-800 dark:text-green-300 mb-1">MARKETING NOTE</h4>
                                <p className="text-gray-800 dark:text-gray-200">{marketingNote}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }
);

DiffCard.displayName = 'DiffCard';

export default DiffCard;
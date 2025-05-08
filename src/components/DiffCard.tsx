import { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
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
    isVisible: boolean;
    contributors: string;
    changes: string;
    contributorData?: Array<{
        login: string;
        name: string;
        role: string;
        avatar_url: string;
    }>;
}

const buttonBaseStyle = "px-3 py-2 text-xs rounded-md transition-all flex items-center w-[140px] justify-center shadow-sm";

const DiffCard = forwardRef<{ generateNotes: () => Promise<void>; closeNotes: () => void }, DiffCardProps>(
    ({ id, description, diff, url }, ref) => {
        const [isExpanded, setIsExpanded] = useState(false);
        const [isGenerating, setIsGenerating] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const [isLoadingContributors, setIsLoadingContributors] = useState(false);

        // Use persisted state for notes to maintain across page refreshes
        const [notes, setNotes] = usePersistedState<NoteState>(`diff-notes-${id}`, {
            devNote: '',
            marketingNote: '',
            isVisible: true,
            contributors: '',
            changes: '',
            contributorData: []
        });

        const { devNote, marketingNote, isVisible, contributors, changes, contributorData } = notes;

        // Fetch contributor data when the PR ID is available
        useEffect(() => {
            const fetchContributorData = async () => {
                // Add a check for empty arrays to prevent refetching
                if (!id || (contributorData && contributorData.length > 0)) return;

                try {
                    setIsLoadingContributors(true);
                    const response = await fetch(`/api/get-contributors?pr=${id}`);

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();

                    if (data.success && data.contributors.length > 0) {
                        setNotes(prev => ({
                            ...prev,
                            contributorData: data.contributors
                        }));
                    }
                } catch (err) {
                    console.error("Error fetching contributors:", err);
                } finally {
                    setIsLoadingContributors(false);
                }
            };

            fetchContributorData();
        }, [id]);

        // Handle streaming from the API
        const handleGenerateNotes = async () => {
            // Skip if already generating
            if (isGenerating) return;

            setNotes(prev => ({
                ...prev,
                devNote: '',
                marketingNote: '',
                isVisible: true,
                contributors: '',
                changes: ''
            }));
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
                let abortController = new AbortController();

                // Set a timeout to prevent infinite streaming
                const timeoutId = setTimeout(() => {
                    abortController.abort();
                    setError('Request timed out after 30 seconds. Please try again.');
                    setIsGenerating(false);
                }, 30000);

                try {
                    // Read the stream
                    while (true) {
                        if (abortController.signal.aborted) {
                            break;
                        }

                        const { done, value } = await reader.read();
                        if (done) break;

                        // Decode and append the chunk
                        const chunk = new TextDecoder().decode(value);
                        receivedText += chunk;

                        // Parse the received text in a more robust way
                        parseAndUpdateNotes(receivedText);
                    }
                } catch (streamError) {
                    console.error('Error reading stream:', streamError);
                    setError('Error reading response stream. Please try again.');
                } finally {
                    clearTimeout(timeoutId);
                    reader.releaseLock();
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
            } finally {
                setIsGenerating(false);
            }
        };

        // Helper function to parse and update notes state
        const parseAndUpdateNotes = (text: string) => {
            try {
                // Initialize with empty values
                let devNote = '';
                let marketingNote = '';
                let contributors = '';
                let changes = '';

                // Use regex without 's' flag by replacing newlines with a placeholder
                const processedText = text.replace(/\n/g, ' __NEWLINE__ ');

                // Check for developer notes section
                const devMatch = processedText.match(/DEVELOPER:\s*(.*?)(?=MARKETING:|$)/);
                if (devMatch && devMatch[1]) {
                    devNote = devMatch[1].replace(/__NEWLINE__/g, '\n').trim();
                }

                // Check for marketing notes section
                const marketingMatch = processedText.match(/MARKETING:\s*(.*?)(?=CONTRIBUTORS:|$)/);
                if (marketingMatch && marketingMatch[1]) {
                    marketingNote = marketingMatch[1].replace(/__NEWLINE__/g, '\n').trim();
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

                // Update state with parsed values
                setNotes(prev => ({
                    ...prev,
                    devNote,
                    marketingNote,
                    contributors,
                    changes,
                    isVisible: true
                }));
            } catch (parseError) {
                console.error('Error parsing notes:', parseError);
                // Even on parse error, display the raw text to avoid losing content
                if (text.includes('DEVELOPER:')) {
                    setNotes(prev => ({
                        ...prev,
                        devNote: text,
                        isVisible: true
                    }));
                }
            }
        };

        // Close notes function - only hide notes, don't clear content
        const handleCloseNotes = () => {
            setNotes(prev => ({ ...prev, isVisible: false }));
            setError(null);
        };

        // Expose methods to parent component
        useImperativeHandle(ref, () => ({
            generateNotes: handleGenerateNotes,
            closeNotes: handleCloseNotes
        }));

        return (
            <div className="border border-zinc-700/50 rounded-lg overflow-hidden bg-zinc-800/70 shadow-lg transition-all hover:shadow-xl">
                <div className="flex justify-between items-start p-4 bg-zinc-800 border-b border-zinc-700/50">
                    <div>
                        <h3 className="text-lg font-semibold flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-200 hover:text-white hover:underline"
                            >
                                PR #{id}
                            </a>
                        </h3>
                        <p className="text-gray-400 mt-1 text-sm">{description}</p>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className={cn(
                                buttonBaseStyle,
                                "bg-zinc-700 text-gray-300 hover:bg-zinc-600 hover:text-white"
                            )}
                        >
                            {isExpanded ? (
                                <span className="flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Hide Details
                                </span>
                            ) : (
                                <span className="flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                    Show Details
                                </span>
                            )}
                        </button>
                        <button
                            onClick={handleGenerateNotes}
                            disabled={isGenerating}
                            className={cn(
                                buttonBaseStyle,
                                isGenerating
                                    ? "bg-blue-700/70 text-white cursor-wait"
                                    : "bg-blue-600 text-white hover:bg-blue-500"
                            )}
                        >
                            {isGenerating ? (
                                <>
                                    <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                    </svg>
                                    Generate Notes
                                </>
                            )}
                        </button>
                        {(devNote || marketingNote) && isVisible && (
                            <button
                                onClick={handleCloseNotes}
                                className={cn(
                                    buttonBaseStyle,
                                    "bg-red-600 text-white hover:bg-red-500"
                                )}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                Close Notes
                            </button>
                        )}
                    </div>
                </div>

                {isExpanded && (
                    <div className="p-3 bg-zinc-900/70 border-b border-zinc-700/50 overflow-auto max-h-64 text-xs font-mono">
                        <pre className="whitespace-pre-wrap break-words text-gray-300">{diff}</pre>
                    </div>
                )}

                {(devNote || marketingNote || error) && isVisible && (
                    <div className="p-4">
                        {error && (
                            <div className="text-red-400 bg-red-900/20 p-3 rounded-md mb-4 border border-red-800/30 text-sm">
                                <div className="flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <span>Error: {error}</span>
                                </div>
                            </div>
                        )}

                        {(devNote || marketingNote) && (
                            <div className="bg-zinc-700/50 rounded-lg overflow-hidden shadow-inner">
                                <div className="bg-zinc-600 px-4 py-2 flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <h3 className="text-sm font-bold text-white">RELEASE NOTES</h3>
                                    {isGenerating && (
                                        <span className="ml-2 flex items-center text-xs text-gray-300">
                                            <span className="relative flex h-2 w-2 mr-1.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                            </span>
                                            Generating...
                                        </span>
                                    )}
                                </div>
                                <div className="p-4 space-y-4">
                                    {devNote && (
                                        <div className="bg-blue-900/10 border border-blue-700/20 rounded-md p-3">
                                            <h4 className="text-sm font-bold text-blue-300 mb-2 flex items-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                                </svg>
                                                DEVELOPER NOTE
                                                {isGenerating && <span className="ml-2 animate-pulse">•</span>}
                                            </h4>
                                            <p className="text-gray-300 text-sm">{devNote}</p>
                                        </div>
                                    )}

                                    {marketingNote && (
                                        <div className="bg-green-900/10 border border-green-700/20 rounded-md p-3">
                                            <h4 className="text-sm font-bold text-green-300 mb-2 flex items-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                                                </svg>
                                                MARKETING NOTE
                                                {isGenerating && <span className="ml-2 animate-pulse">•</span>}
                                            </h4>
                                            <p className="text-gray-300 text-sm">{marketingNote}</p>
                                        </div>
                                    )}

                                    {/* Contributors section */}
                                    {(contributors || (contributorData && contributorData.length > 0)) && (
                                        <div className="bg-purple-900/10 border border-purple-700/20 rounded-md p-3">
                                            <h4 className="text-sm font-bold text-purple-300 mb-2 flex items-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                </svg>
                                                CONTRIBUTORS
                                                {isGenerating && <span className="ml-2 animate-pulse">•</span>}
                                                {isLoadingContributors && <span className="ml-2 animate-pulse">Loading...</span>}
                                            </h4>

                                            {/* Show contributor badges with avatars if available */}
                                            {contributorData && contributorData.length > 0 ? (
                                                <div className="text-gray-300 text-sm">
                                                    {contributorData.map((contributor, index) => (
                                                        <span
                                                            key={index}
                                                            className="inline-flex items-center bg-purple-900/30 rounded-full px-2.5 py-0.5 text-xs font-medium text-purple-100 mr-2 mb-2"
                                                        >
                                                            <img
                                                                src={contributor.avatar_url}
                                                                alt={contributor.name}
                                                                className="h-4 w-4 rounded-full mr-1"
                                                            />
                                                            {contributor.name} ({contributor.role})
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-gray-300 text-sm">{contributors}</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Changes section */}
                                    {changes && (
                                        <div className="bg-yellow-900/10 border border-yellow-700/20 rounded-md p-3">
                                            <h4 className="text-sm font-bold text-yellow-300 mb-2 flex items-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                CHANGES
                                                {isGenerating && <span className="ml-2 animate-pulse">•</span>}
                                            </h4>
                                            <p className="text-gray-300 text-sm">{changes}</p>
                                        </div>
                                    )}

                                    {/* PR URL Link - Inside the same container as release notes with enhanced styling */}
                                    <div className="pt-3 border-t border-zinc-600/50">
                                        <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-sm text-blue-400 hover:text-blue-300 hover:underline group transition-all"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            View Pull Request on GitHub
                                        </a>
                                    </div>
                                </div>
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
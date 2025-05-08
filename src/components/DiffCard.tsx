import { useState, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { usePersistedState } from '@/lib/usePersistedState';
import { buttonBaseStyle } from '@/lib/styles';
import { parseNotes } from '@/lib/noteParser';
import type { DiffCardProps, NoteState } from '@/types/diff';

const DiffCard = forwardRef<{ generateNotes: () => Promise<void>; closeNotes: () => void }, DiffCardProps>(
    ({ id, description, diff, url, owner, repo }, ref) => {
        const [isExpanded, setIsExpanded] = usePersistedState<boolean>(`diff-expanded-${id}`, false);
        const [isGenerating, setIsGenerating] = usePersistedState<boolean>(`diff-generating-${id}`, false);
        const [error, setError] = usePersistedState<string | null>(`diff-error-${id}`, null);
        const [isLoadingContributors, setIsLoadingContributors] = usePersistedState<boolean>(`diff-loading-contributors-${id}`, false);

        // Use persisted state for notes to maintain across page refreshes
        const [notes, setNotes] = usePersistedState<NoteState>(`diff-notes-${id}`, {
            devNote: '',
            marketingNote: '',
            isVisible: false,
            contributors: '',
            changes: '',
            streamProgress: {
                isGenerating: false,
                receivedText: '',
                error: null
            },
            contributorData: []
        });

        // Memoize fetchContributorData to prevent unnecessary re-renders
        const fetchContributorData = useCallback(async () => {
            // Add checks to prevent unnecessary fetches
            if (!id ||
                !owner ||
                !repo ||
                (notes.contributorData && notes.contributorData.length > 0) ||
                isLoadingContributors) {
                return;
            }

            try {
                setIsLoadingContributors(true);
                const response = await fetch(`/api/get-contributors?pr=${id}&owner=${owner}&repo=${repo}`);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
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
        }, [id, owner, repo, notes.contributorData, isLoadingContributors, setNotes]);

        // Update the useEffect to use the memoized function
        useEffect(() => {
            if (id && owner && repo && !isLoadingContributors) {
                fetchContributorData();
            }
        }, [id, owner, repo, isLoadingContributors, fetchContributorData]);

        // Handle streaming from the API
        const handleGenerateNotes = async () => {
            // Skip if already generating
            if (notes.streamProgress.isGenerating) return;

            // Don't clear existing notes, just update them as they come in
            setNotes(prev => ({
                ...prev,
                streamProgress: {
                    ...prev.streamProgress,
                    error: null,
                    isGenerating: true
                }
            }));

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

                let receivedText = notes.streamProgress.receivedText || '';
                const abortController = new AbortController();

                // Set a timeout to prevent infinite streaming
                const timeoutId = setTimeout(() => {
                    abortController.abort();
                    setNotes(prev => ({
                        ...prev,
                        streamProgress: {
                            ...prev.streamProgress,
                            error: 'Request timed out after 30 seconds. Please try again.',
                            isGenerating: false
                        }
                    }));
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

                        // Update stream progress
                        setNotes(prev => ({
                            ...prev,
                            streamProgress: {
                                ...prev.streamProgress,
                                receivedText
                            }
                        }));

                        // Parse the received text in a more robust way
                        parseAndUpdateNotes(receivedText);
                    }
                } catch (streamError) {
                    console.error('Error reading stream:', streamError);
                    setNotes(prev => ({
                        ...prev,
                        streamProgress: {
                            ...prev.streamProgress,
                            error: streamError instanceof Error ? streamError.message : 'An unknown error occurred',
                            isGenerating: false
                        }
                    }));
                } finally {
                    clearTimeout(timeoutId);
                    reader.releaseLock();
                    setNotes(prev => ({
                        ...prev,
                        streamProgress: {
                            ...prev.streamProgress,
                            isGenerating: false
                        }
                    }));
                }
            } catch (err) {
                setNotes(prev => ({
                    ...prev,
                    streamProgress: {
                        ...prev.streamProgress,
                        error: err instanceof Error ? err.message : 'An unknown error occurred',
                        isGenerating: false
                    }
                }));
            }
        };

        // Helper function to parse and update notes state
        const parseAndUpdateNotes = (text: string) => {
            try {
                const { devNote, marketingNote, contributors, changes } = parseNotes(text);

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
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className={cn(
                                buttonBaseStyle,
                                "bg-zinc-700 text-white hover:bg-zinc-600 w-[125px]"
                            )}
                        >
                            {isExpanded ? (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                    </svg>
                                    Hide Details
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    Show Details
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleGenerateNotes}
                            disabled={notes.streamProgress.isGenerating}
                            className={cn(
                                buttonBaseStyle,
                                notes.streamProgress.isGenerating
                                    ? "bg-blue-700/70 text-white cursor-wait"
                                    : "bg-blue-600 text-white hover:bg-blue-500",
                                "w-[140px]"
                            )}
                        >
                            {notes.streamProgress.isGenerating ? (
                                <>
                                    <svg className="animate-spin h-3.5 w-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                        {(notes.devNote || notes.marketingNote) && notes.isVisible && (
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

                {notes.isVisible && (
                    <div className="p-4">
                        {notes.streamProgress.error && (
                            <div className="mb-4 p-3 bg-red-900/20 border border-red-800/30 rounded-md">
                                <p className="text-red-400 text-sm">{notes.streamProgress.error}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            {notes.devNote && (
                                <div className="bg-blue-900/10 border border-blue-700/20 rounded-md p-3">
                                    <h4 className="text-sm font-bold text-blue-300 mb-2 flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                        </svg>
                                        DEVELOPER NOTE
                                        {notes.streamProgress.isGenerating && <span className="ml-2 animate-pulse">•</span>}
                                    </h4>
                                    <p className="text-gray-300 text-sm">{notes.devNote}</p>
                                </div>
                            )}

                            {notes.marketingNote && (
                                <div className="bg-green-900/10 border border-green-700/20 rounded-md p-3">
                                    <h4 className="text-sm font-bold text-green-300 mb-2 flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                                        </svg>
                                        MARKETING NOTE
                                        {notes.streamProgress.isGenerating && <span className="ml-2 animate-pulse">•</span>}
                                    </h4>
                                    <p className="text-gray-300 text-sm">{notes.marketingNote}</p>
                                </div>
                            )}

                            {/* Contributors section */}
                            {(notes.contributors || (notes.contributorData && notes.contributorData.length > 0)) && (
                                <div className="bg-purple-900/10 border border-purple-700/20 rounded-md p-3">
                                    <h4 className="text-sm font-bold text-purple-300 mb-2 flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                        CONTRIBUTORS
                                        {notes.streamProgress.isGenerating && <span className="ml-2 animate-pulse">•</span>}
                                        {isLoadingContributors && <span className="ml-2 animate-pulse">Loading...</span>}
                                    </h4>

                                    {/* Show contributor badges with avatars if available */}
                                    {notes.contributorData && notes.contributorData.length > 0 ? (
                                        <div className="text-gray-300 text-sm">
                                            {notes.contributorData.map((contributor, index) => (
                                                <span
                                                    key={index}
                                                    className="inline-flex items-center bg-purple-900/30 rounded-full px-2.5 py-0.5 text-xs font-medium text-purple-100 mr-2 mb-2"
                                                >
                                                    <img
                                                        src={contributor.avatar_url}
                                                        alt={contributor.login}
                                                        className="w-4 h-4 rounded-full mr-1.5"
                                                    />
                                                    {contributor.name} (@{contributor.login})
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-300 text-sm">{notes.contributors}</p>
                                    )}
                                </div>
                            )}

                            {notes.changes && (
                                <div className="bg-yellow-900/10 border border-yellow-700/20 rounded-md p-3">
                                    <h4 className="text-sm font-bold text-yellow-300 mb-2 flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        CHANGES
                                        {notes.streamProgress.isGenerating && <span className="ml-2 animate-pulse">•</span>}
                                    </h4>
                                    <p className="text-gray-300 text-sm">{notes.changes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* Add PR URL at the bottom */}
                <div className="p-4 border-t border-zinc-700/50">
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm flex items-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Pull Request on GitHub
                    </a>
                </div>
            </div>
        );
    }
);

DiffCard.displayName = 'DiffCard';

export default DiffCard;
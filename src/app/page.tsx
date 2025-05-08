"use client"; // Mark as a Client Component

import { useRef, useEffect } from "react";
import DiffCard from "@/components/DiffCard";
import { usePersistedState } from "@/lib/usePersistedState";

// Define the expected structure of a diff object
interface DiffItem {
  id: string;
  description: string;
  diff: string;
  url: string; // Added URL field
}

// Define the expected structure of the API response
interface ApiResponse {
  diffs: DiffItem[];
  nextPage: number | null;
  currentPage: number;
  perPage: number;
}

// Type for the DiffCard ref methods
interface DiffCardRefMethods {
  generateNotes: () => Promise<void>;
  closeNotes: () => void;
}

export default function Home() {
  // Replace useState with usePersistedState for state that should persist across refreshes
  const [diffs, setDiffs] = usePersistedState<DiffItem[]>("persisted-diffs", []);
  const [isLoading, setIsLoading] = usePersistedState<boolean>("persisted-isLoading", false);
  const [error, setError] = usePersistedState<string | null>("persisted-error", null);
  const [currentPage, setCurrentPage] = usePersistedState<number>("persisted-currentPage", 1);
  const [nextPage, setNextPage] = usePersistedState<number | null>("persisted-nextPage", null);
  const [initialFetchDone, setInitialFetchDone] = usePersistedState<boolean>("persisted-initialFetchDone", false);
  const [isBatchGenerating, setIsBatchGenerating] = usePersistedState<boolean>("persisted-isBatchGenerating", false);
  const [isRefreshing, setIsRefreshing] = usePersistedState<boolean>("persisted-isRefreshing", false);

  const diffCardRefs = useRef<Record<string, DiffCardRefMethods>>({});

  const fetchDiffs = async (page: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/sample-diffs?page=${page}&per_page=10`);
      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.details || errorMsg;
        } catch {
          // Ignore if response body is not JSON
          console.warn("Failed to parse error response as JSON");
        }
        throw new Error(errorMsg);
      }
      const data: ApiResponse = await response.json();

      setDiffs((prevDiffs) =>
        page === 1 ? data.diffs : [...prevDiffs, ...data.diffs]
      );
      setCurrentPage(data.currentPage);
      setNextPage(data.nextPage);
      if (!initialFetchDone) setInitialFetchDone(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Use useEffect for auto-fetching to avoid hydration errors
  useEffect(() => {
    // Auto-fetch PRs on first load if we have a page number but no diffs
    // This helps restore state after refresh
    if (initialFetchDone && diffs.length === 0 && !isLoading && currentPage > 0) {
      fetchDiffs(currentPage);
    }
  }, [initialFetchDone, diffs.length, isLoading, currentPage]);

  const handleFetchClick = () => {
    setDiffs([]); // Clear existing diffs when fetching the first page again
    fetchDiffs(1);
  };

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    // Reload the current page data
    fetchDiffs(currentPage)
      .finally(() => {
        setIsRefreshing(false);
      });
  };

  const handleLoadMoreClick = () => {
    if (nextPage) {
      fetchDiffs(nextPage);
    }
  };

  const handleBatchGenerateClick = async () => {
    setIsBatchGenerating(true);
    try {
      // Process PRs one at a time to avoid overloading the API
      for (const id of Object.keys(diffCardRefs.current)) {
        const refMethods = diffCardRefs.current[id];
        if (refMethods) {
          await refMethods.generateNotes();
        }
      }
    } catch (error) {
      console.error("Error batch generating notes:", error);
    } finally {
      setIsBatchGenerating(false);
    }
  };

  // Register a ref for a DiffCard component
  const registerDiffCard = (id: string, methods: DiffCardRefMethods | null) => {
    if (methods) {
      diffCardRefs.current[id] = methods;
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-12 bg-zinc-900">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-3 text-white">
            Diff Digest
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Transform Git diffs into dual-tone release notes with AI assistance
          </p>
        </div>

        {/* Controls Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0 justify-center">
            <button
              className="px-5 py-3 bg-zinc-700 text-white rounded-md hover:bg-zinc-600 transition-all shadow-md disabled:opacity-50 font-medium"
              onClick={handleFetchClick}
              disabled={isLoading}
            >
              {isLoading && currentPage === 1 ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Fetching...
                </span>
              ) : (
                "Fetch Merged Pull Requests"
              )}
            </button>

            {diffs.length > 0 && (
              <button
                className="px-5 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-all shadow-md disabled:opacity-50 font-medium"
                onClick={handleBatchGenerateClick}
                disabled={isBatchGenerating || isLoading}
              >
                {isBatchGenerating ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating for all...
                  </span>
                ) : (
                  "Generate Notes for All"
                )}
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        <div className="border border-zinc-700/50 rounded-xl p-6 min-h-[300px] bg-zinc-800/50 backdrop-blur-sm shadow-xl">
          <h2 className="text-2xl font-semibold mb-6 text-white border-b border-zinc-700/50 pb-3">
            Merged Pull Requests
          </h2>

          {error && (
            <div className="text-red-400 bg-red-900/30 p-4 rounded-lg mb-4 border border-red-800/50">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>Error: {error}</span>
              </div>
            </div>
          )}

          {!initialFetchDone && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-400 max-w-md">
                Click the button above to fetch the latest merged pull requests
                from the repository.
              </p>
            </div>
          )}

          {initialFetchDone && diffs.length === 0 && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400">
                No merged pull requests found or fetched.
              </p>
            </div>
          )}

          {diffs.length > 0 && (
            <div className="space-y-6">
              {diffs.map((item) => (
                <DiffCard
                  key={item.id}
                  id={item.id}
                  description={item.description}
                  diff={item.diff}
                  url={item.url}
                  ref={(methods) => registerDiffCard(item.id, methods)}
                />
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center items-center my-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}

          {nextPage && !isLoading && (
            <div className="mt-8 flex justify-center">
              <button
                className="px-4 py-2 bg-zinc-700 text-white rounded-md hover:bg-zinc-600 transition-colors disabled:opacity-50 flex items-center"
                onClick={handleLoadMoreClick}
                disabled={isLoading}
              >
                Load More
                <span className="ml-1 bg-zinc-600 rounded-full px-2 py-1 text-xs">
                  Page {nextPage}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

"use client"; // Mark as a Client Component

import { useState, useRef } from "react";
import DiffCard from "@/components/DiffCard";

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
}

export default function Home() {
  const [diffs, setDiffs] = useState<DiffItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [initialFetchDone, setInitialFetchDone] = useState<boolean>(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
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

  const handleFetchClick = () => {
    setDiffs([]); // Clear existing diffs when fetching the first page again
    fetchDiffs(1);
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
      <h1 className="text-4xl font-bold mb-2 text-white">Diff Digest</h1>
      <p className="text-gray-300 mb-8 text-center">Website that turns git diffs into live, dual-tone release notes</p>

      <div className="w-full max-w-4xl">
        {/* Controls Section */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
            <button
              className="px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors disabled:opacity-50"
              onClick={handleFetchClick}
              disabled={isLoading}
            >
              {isLoading && currentPage === 1
                ? "Fetching..."
                : "Fetch Merged Pull Requests"}
            </button>

            {diffs.length > 0 && (
              <button
                className="px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors disabled:opacity-50"
                onClick={handleBatchGenerateClick}
                disabled={isBatchGenerating || isLoading}
              >
                {isBatchGenerating ? "Generating for all..." : "Generate Notes for All"}
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        <div className="border border-zinc-700 rounded-lg p-6 min-h-[300px] bg-zinc-800">
          <h2 className="text-2xl font-semibold mb-4 text-white">Merged Pull Requests</h2>

          {error && (
            <div className="text-red-400 bg-red-900/30 p-3 rounded mb-4">
              Error: {error}
            </div>
          )}

          {!initialFetchDone && !isLoading && (
            <p className="text-gray-400">
              Click the button above to fetch the latest merged pull requests
              from the repository.
            </p>
          )}

          {initialFetchDone && diffs.length === 0 && !isLoading && !error && (
            <p className="text-gray-400">
              No merged pull requests found or fetched.
            </p>
          )}

          {diffs.length > 0 && (
            <div className="space-y-4">
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
            <div className="flex justify-center items-center my-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-300"></div>
            </div>
          )}

          {nextPage && !isLoading && (
            <div className="mt-6 flex justify-center">
              <button
                className="px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors disabled:opacity-50"
                onClick={handleLoadMoreClick}
                disabled={isLoading}
              >
                Load More (Page {nextPage})
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

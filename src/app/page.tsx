"use client"; // Mark as a Client Component

import { useRef, useEffect, useCallback, useState, Fragment } from "react";
import DiffCard from "@/components/DiffCard";
import { usePersistedState } from "@/lib/usePersistedState";
import { cn } from "@/lib/utils";
import type { DiffItem, ApiResponse } from '@/types/api';
import type { DiffCardRefMethods } from '@/types/diff';
import { Listbox } from '@headlessui/react';

export default function Home() {
  // Replace useState with usePersistedState for state that should persist across refreshes
  const [diffs, setDiffs] = usePersistedState<DiffItem[]>("persisted-diffs", []);
  const [isLoading, setIsLoading] = usePersistedState<boolean>("persisted-isLoading", false);
  const [error, setError] = usePersistedState<string | null>("persisted-error", null);
  const [currentPage, setCurrentPage] = usePersistedState<number>("persisted-currentPage", 1);
  const [nextPage, setNextPage] = usePersistedState<number | null>("persisted-nextPage", null);
  const [initialFetchDone, setInitialFetchDone] = usePersistedState<boolean>("persisted-initialFetchDone", false);
  const [isBatchGenerating, setIsBatchGenerating] = usePersistedState<boolean>("persisted-isBatchGenerating", false);
  const [owner, setOwner] = usePersistedState<string>("persisted-owner", "");
  const [repo, setRepo] = usePersistedState<string>("persisted-repo", "");
  const [perPage, setPerPage] = usePersistedState<number | undefined>("persisted-perPage", undefined);
  const [page, setPage] = usePersistedState<number | undefined>("persisted-page", undefined);
  const [repoUrl, setRepoUrl] = usePersistedState<string>("persisted-repoUrl", "");
  const [reverseOrder, setReverseOrder] = usePersistedState<boolean>("persisted-reverseOrder", false);
  const [searchQuery, setSearchQuery] = useState("");

  const diffCardRefs = useRef<Record<string, DiffCardRefMethods>>({});

  const clearAllState = () => {
    setDiffs([]);
    setIsLoading(false);
    setError(null);
    setCurrentPage(1);
    setNextPage(null);
    setInitialFetchDone(false);
    setIsBatchGenerating(false);
    setOwner("");
    setRepo("");
    setPerPage(undefined);
    setPage(undefined);
    setRepoUrl("");
    // Clear all localStorage items that start with "persisted-"
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("persisted-")) {
        localStorage.removeItem(key);
      }
    });
    // Clear all localStorage items that start with "diff-"
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("diff-")) {
        localStorage.removeItem(key);
      }
    });
  };

  const fetchWithTimeout = (url: string, options: RequestInit, timeout = 10000) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), timeout)
      )
    ]);
  };

  const fetchDiffs = useCallback(async (pageNum: number, direction?: 'asc' | 'desc') => {
    if (!owner || !repo) {
      setError('Please provide both owner and repo');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const dir = direction || (reverseOrder ? 'asc' : 'desc');
      const response = (await fetchWithTimeout(`/api/sample-diffs?owner=${owner}&repo=${repo}&page=${pageNum}&per_page=${perPage}${dir ? `&direction=${dir}` : ''}`, {}, 10000)) as Response;
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      setDiffs((prevDiffs) => {
        if (pageNum === 1) return data.diffs;
        // Append or prepend based on direction
        return dir === 'asc' ? [...prevDiffs, ...data.diffs] : [...data.diffs, ...prevDiffs];
      });
      setCurrentPage(data.currentPage);
      setNextPage(data.nextPage);
      if (!initialFetchDone) setInitialFetchDone(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      // Clear diffs on error to prevent showing stale data
      if (pageNum === 1) {
        setDiffs([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [owner, repo, perPage, setDiffs, setCurrentPage, setNextPage, setError, setIsLoading, initialFetchDone, setInitialFetchDone, reverseOrder]);

  // Refetch PRs when reverseOrder changes
  useEffect(() => {
    if (initialFetchDone) {
      handleFetchClick();
    }
  }, [reverseOrder]);

  const handleFetchClick = () => {
    setDiffs([]); // Clear existing diffs when fetching the first page again
    fetchDiffs(page === undefined ? 1 : page, reverseOrder ? 'asc' : 'desc');
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

  // Filter diffs based on search query
  const filteredDiffs = searchQuery.trim() === ""
    ? diffs
    : diffs.filter(item =>
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.diff && item.diff.toLowerCase().includes(searchQuery.toLowerCase()))
    );

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

          {/* GitHub Repo URL Input Section */}
          <div className="flex flex-col items-center mt-6 mb-2">
            <label htmlFor="repoUrl" className="text-sm text-gray-400 mb-1">Paste GitHub Repository URL</label>
            <input
              id="repoUrl"
              type="text"
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                // Try to parse the URL and set owner/repo if valid
                const match = e.target.value.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?/);
                if (match) {
                  setOwner(match[1]);
                  setRepo(match[2].replace('.git', ''));
                }
              }}
              placeholder="e.g., https://github.com/openai/openai-node"
              className="px-4 py-2 border border-zinc-700 rounded-md bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-md"
            />
          </div>
        </div>

        {/* Controls Section */}
        <div className="mb-8">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0 justify-center">
              <div className="flex flex-col">
                <label htmlFor="owner" className="text-sm text-gray-400 mb-1">Repository Owner</label>
                <input
                  id="owner"
                  type="text"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="e.g., openai"
                  className="px-4 py-2 border border-zinc-700 rounded-md bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="repo" className="text-sm text-gray-400 mb-1">Repository Name</label>
                <input
                  id="repo"
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="e.g., openai-node"
                  className="px-4 py-2 border border-zinc-700 rounded-md bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="page" className="text-sm text-gray-400 mb-1">Page Number</label>
                <input
                  id="page"
                  type="number"
                  min="1"
                  value={page === undefined ? '' : page}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setPage(isNaN(val) ? undefined : Math.max(1, val));
                  }}
                  placeholder="1"
                  className="px-4 py-2 border border-zinc-700 rounded-md bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="perPage" className="text-sm text-gray-400 mb-1">Items Per Page</label>
                <input
                  id="perPage"
                  type="number"
                  min="1"
                  max="100"
                  value={perPage === undefined ? '' : perPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setPerPage(isNaN(val) ? undefined : Math.min(100, Math.max(1, val)));
                  }}
                  placeholder="10"
                  className="px-4 py-2 border border-zinc-700 rounded-md bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <div className="flex justify-center space-x-4 mt-4">
              <button
                onClick={handleFetchClick}
                disabled={isLoading}
                className={cn(
                  "px-4 py-2 text-sm rounded-md transition-all flex items-center justify-center shadow-sm",
                  isLoading
                    ? "bg-blue-700/70 text-white cursor-wait"
                    : "bg-blue-600 text-white hover:bg-blue-500"
                )}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                    Fetch PRs
                  </span>
                )}
              </button>
              <button
                onClick={clearAllState}
                className="px-4 py-2 text-sm rounded-md transition-all flex items-center justify-center shadow-sm bg-red-600 text-white hover:bg-red-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="border border-zinc-700/50 rounded-xl p-6 min-h-[300px] bg-zinc-800/50 backdrop-blur-sm shadow-xl">
          <h2 className="text-2xl font-semibold mb-2 text-white border-b border-zinc-700/50 pb-3 flex items-center justify-between">
            <span>Merged Pull Requests</span>
            <div className="group relative flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 hover:text-white cursor-help transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="absolute top-1/2 right-full transform -translate-y-1/2 mr-2 w-80 p-4 bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-50">
                <h3 className="font-semibold text-white mb-2">About Diff Digest</h3>
                <p className="text-sm text-gray-300 mb-2">
                  Diff Digest helps you generate dual-tone release notes from any GitHub repository's pull requests. Here's how it works:
                </p>
                <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                  <li>Enter any GitHub repository owner (e.g., "openai") and name (e.g., "openai-node")</li>
                  <li>Use the controls above to:
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>• Set page number and items per page</li>
                      <li>• Fetch PRs and clear all data</li>
                    </ul>
                  </li>
                  <li>For each PR, you can:
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>• View the PR description and changes</li>
                      <li>• Generate AI-powered release notes</li>
                      <li>• See contributor information</li>
                      <li>• Track changes and documentation</li>
                    </ul>
                  </li>
                </ul>
                <p className="text-sm text-gray-300 mt-2">
                  The AI will analyze each PR and generate both technical and marketing-friendly notes automatically!
                </p>
              </div>
            </div>
          </h2>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-2 w-full">
            {/* Search bar with icon */}
            <div className="relative mr-0 sm:mr-2 w-full sm:w-auto">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search PRs or diffs..."
                className="w-full h-[36px] pl-10 pr-3 py-1 text-base rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative sm:mr-2 self-center w-full sm:w-auto">
              <Listbox value={reverseOrder ? "oldest" : "newest"} onChange={val => setReverseOrder(val === "oldest")}>
                {({ open }) => (
                  <Fragment>
                    <Listbox.Button className="w-full h-[36px] px-3 py-1 text-base font-medium rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8 flex items-center whitespace-nowrap relative">
                      <span
                        className="whitespace-nowrap text-left overflow-hidden text-ellipsis"
                        style={{ width: 110, display: 'inline-block' }}
                      >
                        {reverseOrder ? "Oldest First" : "Newest First"}
                      </span>
                      <span className="pointer-events-none flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2" style={{ width: 22 }}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </Listbox.Button>
                    <Listbox.Options className="absolute left-0 mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl z-50 focus:outline-none" style={{ width: 150 }}>
                      <Listbox.Option
                        value="newest"
                        className={({ active, selected }) =>
                          `cursor-pointer select-none px-4 py-2 text-base ${active ? 'bg-zinc-700 text-white' : 'text-gray-200'} ${selected ? 'font-bold' : ''}`
                        }
                      >
                        Newest First
                      </Listbox.Option>
                      <Listbox.Option
                        value="oldest"
                        className={({ active, selected }) =>
                          `cursor-pointer select-none px-4 py-2 text-base ${active ? 'bg-zinc-700 text-white' : 'text-gray-200'} ${selected ? 'font-bold' : ''}`
                        }
                      >
                        Oldest First
                      </Listbox.Option>
                    </Listbox.Options>
                  </Fragment>
                )}
              </Listbox>
            </div>
          </div>

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
                Enter a repository owner and name above to fetch the latest merged pull requests.
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

          {filteredDiffs.length > 0 && (
            <div className="space-y-6">
              {filteredDiffs.map((item) => (
                <DiffCard
                  key={item.id}
                  id={item.id}
                  description={item.description}
                  diff={item.diff}
                  url={item.url}
                  owner={owner}
                  repo={repo}
                  ref={(methods) => registerDiffCard(item.id, methods)}
                />
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center items-center my-12">
              <div className="flex items-center gap-2 text-blue-500">
                <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="animate-pulse text-lg font-medium">Loading pull requests...</span>
              </div>
            </div>
          )}

          {nextPage && !isLoading && (
            <div className="mt-8 flex justify-center">
              <button
                className="px-4 py-2 bg-zinc-700 text-white rounded-md hover:bg-zinc-600 transition-colors disabled:opacity-50 flex items-center"
                onClick={() => fetchDiffs(nextPage, reverseOrder ? 'asc' : 'desc')}
                disabled={isLoading}
              >
                Load More
                <span className="ml-4 bg-zinc-600 rounded-full px-2 py-1 text-xs">
                  Page {nextPage}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </main >
  );
}

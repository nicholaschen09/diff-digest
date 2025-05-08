import { useState, useEffect } from 'react';

// A hook to persist state in localStorage with error handling and quota management
export function usePersistedState<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    // Create state based on initial value, but don't try to read from localStorage during SSR
    const [state, setState] = useState<T>(initialValue);

    // Only try to read from localStorage after the component has mounted
    useEffect(() => {
        try {
            // Get from local storage by key
            const item = window.localStorage.getItem(key);
            // Parse stored json or keep initialValue if none
            if (item) {
                try {
                    const parsed = JSON.parse(item);
                    setState(parsed);
                } catch (parseError) {
                    console.error('Error parsing stored state:', parseError);
                    // If parsing fails, remove the corrupted data
                    window.localStorage.removeItem(key);
                }
            }
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            // If reading fails (e.g., due to quota exceeded), try to clear some space
            try {
                // Remove oldest items if we're running out of space
                const keys = Object.keys(window.localStorage);
                if (keys.length > 100) { // Arbitrary threshold
                    // Remove oldest 20% of items
                    const itemsToRemove = Math.ceil(keys.length * 0.2);
                    keys.slice(0, itemsToRemove).forEach(k => window.localStorage.removeItem(k));
                }
            } catch (cleanupError) {
                console.error('Error cleaning up localStorage:', cleanupError);
            }
        }
    }, [key]); // Only run once per key when component mounts

    // Update local storage when the state changes
    useEffect(() => {
        try {
            // Save state to localStorage
            const serialized = JSON.stringify(state);
            // Check if the serialized state is too large
            if (serialized.length > 5 * 1024 * 1024) { // 5MB limit
                console.warn('State is too large to persist:', key);
                return;
            }
            window.localStorage.setItem(key, serialized);
        } catch (error) {
            console.error('Error writing to localStorage:', error);
            // If writing fails, try to clear some space and retry once
            try {
                const keys = Object.keys(window.localStorage);
                if (keys.length > 100) {
                    const itemsToRemove = Math.ceil(keys.length * 0.2);
                    keys.slice(0, itemsToRemove).forEach(k => window.localStorage.removeItem(k));
                    // Retry saving
                    window.localStorage.setItem(key, JSON.stringify(state));
                }
            } catch (retryError) {
                console.error('Error retrying localStorage write:', retryError);
            }
        }
    }, [key, state]);

    return [state, setState];
} 
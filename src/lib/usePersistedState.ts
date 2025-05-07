import { useState, useEffect } from 'react';

// A hook to persist state in localStorage
export function usePersistedState<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    // Create state based on initial value
    const [state, setState] = useState<T>(() => {
        // Check if running in a browser environment
        if (typeof window === 'undefined') {
            return initialValue;
        }

        try {
            // Get from local storage by key
            const item = window.localStorage.getItem(key);
            // Parse stored json or return initialValue if none
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return initialValue;
        }
    });

    // Update local storage when the state changes
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            // Save state to localStorage
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error('Error writing to localStorage:', error);
        }
    }, [key, state]);

    return [state, setState];
} 
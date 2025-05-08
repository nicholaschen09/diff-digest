import { useState, useEffect } from 'react';

// A hook to persist state in localStorage
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
                setState(JSON.parse(item));
            }
        } catch (error) {
            console.error('Error reading from localStorage:', error);
        }
    }, [key]); // Only run once per key when component mounts

    // Update local storage when the state changes
    useEffect(() => {
        try {
            // Save state to localStorage
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error('Error writing to localStorage:', error);
        }
    }, [key, state]);

    return [state, setState];
} 
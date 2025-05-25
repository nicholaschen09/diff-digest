import { useState, useEffect } from 'react';

// A hook to persist state in localStorage with error handling and quota management
export function usePersistedState<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    // Always initialize with initialValue to avoid hydration mismatch
    const [state, setState] = useState<T>(initialValue);

    // After mount, update state from localStorage if available
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const item = window.localStorage.getItem(key);
            if (item && item !== "undefined") {
                setState(JSON.parse(item));
            }
        } catch (error) {
            console.error('Error reading from localStorage:', error);
        }
    }, [key]);

    // Update localStorage when state changes
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error('Error writing to localStorage:', error);
        }
    }, [key, state]);

    return [state, setState];
} 
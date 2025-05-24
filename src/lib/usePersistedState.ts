import { useState, useEffect } from 'react';

// A hook to persist state in localStorage with error handling and quota management
export function usePersistedState<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    // Initialize state from localStorage if available, otherwise use initialValue
    const [state, setState] = useState<T>(() => {
        if (typeof window === 'undefined') return initialValue;
        try {
            const item = window.localStorage.getItem(key);
            return item && item !== "undefined" ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return initialValue;
        }
    });

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
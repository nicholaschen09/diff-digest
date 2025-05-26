import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Page from './page';
import { expect } from '@jest/globals';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import '@testing-library/jest-dom/extend-expect';
import { describe, it, beforeEach } from '@jest/globals';

// Mock the fetch function
global.fetch = jest.fn();

describe('Page Component', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
    });

    it('renders the page correctly', () => {
        render(<Page />);
        expect(screen.getByText('Diff Digest')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter GitHub repo URL')).toBeInTheDocument();
    });

    it('handles API response and updates UI', async () => {
        const mockResponse = {
            diffs: [{ id: '1', description: 'PR 1', diff: '--- a/file.js\n+++ b/file.js', url: 'http://example.com/1' }],
            currentPage: 1,
            nextPage: 2,
            totalMergedCount: 10
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockResponse)
        });

        render(<Page />);
        fireEvent.change(screen.getByPlaceholderText('Enter GitHub repo URL'), { target: { value: 'owner/repo' } });
        fireEvent.click(screen.getByText('Load Diffs'));

        await waitFor(() => {
            expect(screen.getByText('PR 1')).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument();
        });
    });

    it('handles API error and displays error message', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

        render(<Page />);
        fireEvent.change(screen.getByPlaceholderText('Enter GitHub repo URL'), { target: { value: 'owner/repo' } });
        fireEvent.click(screen.getByText('Load Diffs'));

        await waitFor(() => {
            expect(screen.getByText('API Error')).toBeInTheDocument();
        });
    });
}); 
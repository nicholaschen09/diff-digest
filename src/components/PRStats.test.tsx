import React from 'react';
import { render, screen } from '@testing-library/react';
import PRStats from './PRStats';

describe('PRStats', () => {
    const mockDiffs = [
        { id: '1', description: 'PR 1', diff: '--- a/file1.js\n+++ b/file1.js', url: 'http://example.com/1' },
        { id: '2', description: 'PR 2', diff: '--- a/file2.py\n+++ b/file2.py', url: 'http://example.com/2' }
    ];

    it('renders with diffs and totalMergedCount', () => {
        render(<PRStats diffs={mockDiffs} totalMergedCount={10} />);
        expect(screen.getByText('PRs merged:')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('Languages:')).toBeInTheDocument();
        expect(screen.getByText('JavaScript (1), Python (1)')).toBeInTheDocument();
    });

    it('falls back to diffs.length if totalMergedCount is not provided', () => {
        render(<PRStats diffs={mockDiffs} />);
        expect(screen.getByText('PRs merged:')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
    });
}); 
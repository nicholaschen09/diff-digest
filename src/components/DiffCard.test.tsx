import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DiffCard from './DiffCard';

describe('DiffCard', () => {
    const mockProps = {
        id: '1',
        description: 'Test PR',
        diff: '--- a/file.js\n+++ b/file.js',
        url: 'http://example.com/1',
        owner: 'testOwner',
        repo: 'testRepo'
    };

    it('renders with provided props', () => {
        render(<DiffCard {...mockProps} />);
        expect(screen.getByText('Test PR')).toBeInTheDocument();
        expect(screen.getByText('http://example.com/1')).toBeInTheDocument();
    });

    it('calls generateNotes when the generate button is clicked', async () => {
        const mockGenerateNotes = jest.fn();
        render(<DiffCard {...mockProps} ref={{ current: { generateNotes: mockGenerateNotes } }} />);
        fireEvent.click(screen.getByText('Generate Notes'));
        expect(mockGenerateNotes).toHaveBeenCalled();
    });

    it('calls closeNotes when the close button is clicked', () => {
        const mockCloseNotes = jest.fn();
        render(<DiffCard {...mockProps} ref={{ current: { closeNotes: mockCloseNotes } }} />);
        fireEvent.click(screen.getByText('Close'));
        expect(mockCloseNotes).toHaveBeenCalled();
    });
}); 
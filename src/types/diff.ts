export interface DiffCardProps {
    id: string;
    description: string;
    diff: string;
    url: string;
    owner: string;
    repo: string;
}

export interface NoteState {
    devNote: string;
    marketingNote: string;
    isVisible: boolean;
    contributors: string;
    changes: string;
    streamProgress: {
        isGenerating: boolean;
        receivedText: string;
        error: string | null;
    };
    contributorData?: Array<{
        login: string;
        name: string;
        role: string;
        avatar_url: string;
    }>;
}

export interface DiffCardRefMethods {
    generateNotes: () => Promise<void>;
    closeNotes: () => void;
} 
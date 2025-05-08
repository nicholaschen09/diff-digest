export interface DiffItem {
    id: string;
    description: string;
    diff: string;
    url: string;
}

export interface ApiResponse {
    diffs: DiffItem[];
    nextPage: number | null;
    currentPage: number;
    perPage: number;
} 
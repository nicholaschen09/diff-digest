import React from "react";

interface Contributor {
    login: string;
    name: string;
    role: string;
    avatar_url: string;
}

interface DiffItem {
    id: string;
    description: string;
    diff: string;
    url: string;
    // Optionally, you may have notes or contributorData attached by DiffCard
    notes?: {
        contributorData?: Contributor[];
    };
    // Optionally, you may have merged_at if you extend the backend
    merged_at?: string;
}

interface PRStatsProps {
    diffs: DiffItem[];
}

function getTopContributors(diffs: DiffItem[]) {
    const contributorCount: Record<string, { contributor: Contributor; count: number }> = {};
    for (const diff of diffs) {
        const contributors = diff.notes?.contributorData;
        if (contributors && contributors.length > 0) {
            for (const c of contributors) {
                if (!contributorCount[c.login]) {
                    contributorCount[c.login] = { contributor: c, count: 0 };
                }
                contributorCount[c.login].count++;
            }
        }
    }
    const sorted = Object.values(contributorCount).sort((a, b) => b.count - a.count);
    return sorted.slice(0, 5); // Top 5
}

function getMostActiveWeek(diffs: DiffItem[]) {
    // If merged_at is available, group by week
    const weekCount: Record<string, number> = {};
    for (const diff of diffs) {
        if (diff.merged_at) {
            const date = new Date(diff.merged_at);
            // Get year-week string
            const week = `${date.getFullYear()}-W${Math.ceil((date.getDate() + 1 - date.getDay()) / 7)}`;
            weekCount[week] = (weekCount[week] || 0) + 1;
        }
    }
    const mostActive = Object.entries(weekCount).sort((a, b) => b[1] - a[1])[0];
    return mostActive ? `${mostActive[0]} (${mostActive[1]} PRs)` : "N/A";
}

const PRStats: React.FC<PRStatsProps> = ({ diffs }) => {
    const numPRs = diffs.length;
    const topContributors = getTopContributors(diffs);
    const mostActiveWeek = getMostActiveWeek(diffs);

    return (
        <div className="max-w-2xl mx-auto mb-6 mt-2 bg-zinc-800 border border-blue-700/30 rounded-lg p-4 text-blue-100 text-base">
            <h3 className="text-lg font-bold mb-2 text-blue-200">PR Stats</h3>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-8 gap-2">
                <div>
                    <span className="font-semibold">PRs merged:</span> {numPRs}
                </div>
                <div>
                    <span className="font-semibold">Top contributors:</span>{" "}
                    {topContributors.length > 0 ? (
                        topContributors.map(({ contributor, count }, i) => (
                            <span key={contributor.login} className="inline-flex items-center bg-blue-900/30 rounded-full px-2.5 py-0.5 text-xs font-medium text-blue-100 mr-2 mb-1">
                                <img src={contributor.avatar_url} alt={contributor.login} className="w-4 h-4 rounded-full mr-1.5" />
                                {contributor.name} (@{contributor.login}) x{count}
                            </span>
                        ))
                    ) : (
                        <span className="text-gray-400 ml-1">No contributor data</span>
                    )}
                </div>
                <div>
                    <span className="font-semibold">Most active week:</span> {mostActiveWeek}
                </div>
            </div>
        </div>
    );
};

export default PRStats; 
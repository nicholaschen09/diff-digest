import React from "react";

interface DiffItem {
    id: string;
    description: string;
    diff: string;
    url: string;
}

interface PRStatsProps {
    diffs: DiffItem[];
}

function getLanguages(diffs: DiffItem[]) {
    const langCount: Record<string, number> = {};
    const extToLang: Record<string, string> = {
        js: 'JavaScript', ts: 'TypeScript', py: 'Python', java: 'Java', rb: 'Ruby', go: 'Go', rs: 'Rust', cpp: 'C++', c: 'C', cs: 'C#', php: 'PHP', swift: 'Swift', kt: 'Kotlin', m: 'Objective-C', scala: 'Scala', sh: 'Shell', md: 'Markdown', json: 'JSON', yml: 'YAML', yaml: 'YAML', html: 'HTML', css: 'CSS', scss: 'SCSS', less: 'LESS', vue: 'Vue', svelte: 'Svelte', dart: 'Dart', xml: 'XML', txt: 'Text', lock: 'Lockfile', toml: 'TOML', ini: 'INI', dockerfile: 'Dockerfile', makefile: 'Makefile', bat: 'Batch', ps1: 'PowerShell', sql: 'SQL', pl: 'Perl', r: 'R', jl: 'Julia', lua: 'Lua', groovy: 'Groovy', gradle: 'Gradle', coffee: 'CoffeeScript', elm: 'Elm', ex: 'Elixir', exs: 'Elixir', erl: 'Erlang', hs: 'Haskell', ml: 'OCaml', clj: 'Clojure', cljs: 'ClojureScript', fs: 'F#', fsx: 'F#', vb: 'VB.NET', vbs: 'VBScript', pas: 'Pascal', asm: 'Assembly', sol: 'Solidity', zig: 'Zig', nim: 'Nim', proto: 'Protobuf', avro: 'Avro', thrift: 'Thrift', csv: 'CSV', tsv: 'TSV', conf: 'Config', cfg: 'Config', env: 'Env', sample: 'Sample', example: 'Example', test: 'Test', spec: 'Spec', snap: 'Snapshot', story: 'Story', storybook: 'Storybook', feature: 'Feature'
    };
    for (const diff of diffs) {
        // Find all file paths in the diff header lines (--- a/file.ext, +++ b/file.ext)
        const fileRegex = /[ab]\/(.+?)\.(\w+)/g;
        let match;
        while ((match = fileRegex.exec(diff.diff)) !== null) {
            const ext = match[2].toLowerCase();
            const lang = extToLang[ext] || ext.toUpperCase();
            langCount[lang] = (langCount[lang] || 0) + 1;
        }
    }
    const sorted = Object.entries(langCount).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 3); // Top 3 languages
}

const PRStats: React.FC<PRStatsProps> = ({ diffs }) => {
    const numPRs = diffs.length;
    const topLanguages = getLanguages(diffs);

    return (
        <div className="max-w-4xl mx-auto mb-6 mt-2 bg-zinc-800 border border-blue-700/30 rounded-lg p-4 text-blue-100 text-base">
            <h3 className="text-lg font-bold mb-2 text-blue-200">PR Stats</h3>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-8 gap-2 w-full">
                <div className="flex flex-row items-center justify-between w-full">
                    <div className="flex items-center">
                        <span className="font-semibold">PRs merged:</span>
                        <span className="ml-2">{numPRs}</span>
                    </div>
                    <div className="flex items-center flex-wrap gap-2">
                        <span className="font-semibold mr-2">Languages:</span>
                        {topLanguages.length > 0 ? (
                            <span>
                                {topLanguages.map(([lang, count], idx) => (
                                    <span key={lang}>
                                        {lang} ({count}){idx < topLanguages.length - 1 ? ', ' : ''}
                                    </span>
                                ))}
                            </span>
                        ) : (
                            <span className="text-gray-400 ml-1">No language data</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PRStats; 
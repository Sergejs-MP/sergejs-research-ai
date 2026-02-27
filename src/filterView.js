import { ItemView } from "obsidian";
export const VIEW_TYPE_FILTER = "sergejs-filter-view";
export class FilterView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.selectedFilters = {
            models: new Set(),
            endpoints: new Set(),
            techniques: new Set(),
            studyTypes: new Set()
        };
        this.plugin = plugin;
    }
    getViewType() {
        return VIEW_TYPE_FILTER;
    }
    getDisplayText() {
        return "Research Filters";
    }
    async onOpen() {
        this.containerEl.style.overflowY = "auto";
        this.containerEl.style.padding = "10px";
        this.render();
    }
    render() {
        const container = this.containerEl;
        container.empty();
        container.style.overflowY = "auto";
        container.style.padding = "10px";
        container.createEl("h3", { text: "Concept Filters" });
        const index = this.plugin.vectorIndex;
        if (!index || Object.keys(index).length === 0) {
            container.createEl("p", { text: "Index empty." });
            return;
        }
        this.renderSelected(container);
        const modelCounts = {};
        const endpointCounts = {};
        const techniqueCounts = {};
        const studyTypeCounts = {};
        const normalize = (v) => {
            if (typeof v !== "string")
                return null;
            const cleaned = v.trim().toLowerCase();
            return cleaned || null;
        };
        Object.values(index).forEach(note => {
            if (!note.concepts)
                return;
            note.concepts.models?.forEach(m => {
                const key = normalize(m);
                if (!key)
                    return;
                modelCounts[key] = (modelCounts[key] || 0) + 1;
            });
            note.concepts.endpoints?.forEach(e => {
                const key = normalize(e);
                if (!key)
                    return;
                endpointCounts[key] = (endpointCounts[key] || 0) + 1;
            });
            note.concepts.techniques?.forEach(t => {
                const key = normalize(t);
                if (!key)
                    return;
                techniqueCounts[key] = (techniqueCounts[key] || 0) + 1;
            });
            if (note.concepts.studyType) {
                const key = normalize(note.concepts.studyType);
                if (key)
                    studyTypeCounts[key] = (studyTypeCounts[key] || 0) + 1;
            }
        });
        this.renderInsightButton(container);
        this.renderSection(container, "models", modelCounts);
        this.renderSection(container, "endpoints", endpointCounts);
        this.renderSection(container, "techniques", techniqueCounts);
        this.renderSection(container, "studyTypes", studyTypeCounts);
        this.renderMatchingNotes(container);
    }
    renderSection(container, category, counts) {
        const entries = Object.entries(counts)
            .filter(([_, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1]);
        if (entries.length === 0)
            return;
        container.createEl("h4", { text: category });
        entries.forEach(([value, count]) => {
            const row = container.createEl("div");
            const selected = this.selectedFilters[category].has(value);
            const link = row.createEl("a", {
                text: `${selected ? "✓ " : ""}${value} (${count})`,
                href: "#"
            });
            link.onclick = () => {
                if (selected) {
                    this.selectedFilters[category].delete(value);
                }
                else {
                    this.selectedFilters[category].add(value);
                }
                this.render();
            };
        });
    }
    renderSelected(container) {
        const selected = Object.entries(this.selectedFilters)
            .flatMap(([category, values]) => [...values].map(v => `${category}:${v}`));
        if (selected.length === 0)
            return;
        container.createEl("h4", { text: "Selected Filters" });
        const row = container.createEl("div");
        selected.forEach(tag => {
            row.createEl("span", {
                text: `[${tag}] `,
                attr: { style: "margin-right:6px;" }
            });
        });
    }
    renderMatchingNotes(container) {
        const activeFilters = this.selectedFilters;
        const normalize = (v) => {
            if (typeof v !== "string")
                return null;
            return v.trim().toLowerCase();
        };
        const matches = Object.entries(this.plugin.vectorIndex)
            .filter(([_, data]) => {
            if (!data.concepts)
                return false;
            const c = data.concepts;
            const normalizeArray = (arr) => (arr || [])
                .map(normalize)
                .filter((v) => !!v);
            const normalize = (v) => {
                if (typeof v !== "string")
                    return null;
                return v.trim().toLowerCase();
            };
            const models = normalizeArray(c.models);
            const endpoints = normalizeArray(c.endpoints);
            const techniques = normalizeArray(c.techniques);
            const studyType = normalize(c.studyType);
            const matchCategory = (set, values) => {
                if (set.size === 0)
                    return true;
                const normalizedValues = normalizeArray(values);
                return [...set].every(v => normalizedValues.includes(v));
            };
            const matchStudyType = (set, value) => {
                if (set.size === 0)
                    return true;
                const normalized = normalize(value);
                if (!normalized)
                    return false;
                return set.has(normalized);
            };
            return (matchCategory(activeFilters.models, models) &&
                matchCategory(activeFilters.endpoints, endpoints) &&
                matchCategory(activeFilters.techniques, techniques) &&
                matchStudyType(activeFilters.studyTypes, studyType));
        });
        if (Object.values(activeFilters).every(set => set.size === 0))
            return;
        container.createEl("h4", { text: `Matching Notes (${matches.length})` });
        if (matches.length === 0) {
            container.createEl("p", { text: "No notes match current filters." });
            return;
        }
        matches.forEach(([path]) => {
            const el = container.createEl("div");
            el.createEl("a", {
                text: this.plugin.pathToWikiLink(path),
                href: "#"
            }).onclick = () => {
                this.app.workspace.openLinkText(path, "", false);
            };
        });
    }
    renderInsightButton(container) {
        const hasSelection = Object.values(this.selectedFilters)
            .some(set => set.size > 0);
        if (!hasSelection)
            return;
        const btn = container.createEl("button", {
            text: "Generate Research Insights"
        });
        btn.onclick = async () => {
            await this.generateInsights(container);
        };
    }
    async generateInsights(container) {
        const normalize = (v) => {
            if (typeof v !== "string")
                return null;
            const cleaned = v.trim().toLowerCase();
            return cleaned.length > 0 ? cleaned : null;
        };
        const normalizeArray = (arr) => (arr || [])
            .map(normalize)
            .filter((v) => !!v);
        const matches = Object.entries(this.plugin.vectorIndex)
            .filter(([_, data]) => {
            if (!data.concepts)
                return false;
            const c = data.concepts;
            const models = normalizeArray(c.models);
            const endpoints = normalizeArray(c.endpoints);
            const techniques = normalizeArray(c.techniques);
            const studyType = normalize(c.studyType);
            const matchCategory = (set, values) => {
                if (set.size === 0)
                    return true;
                return [...set].every(v => values.includes(v));
            };
            const matchStudyType = (set, value) => {
                if (set.size === 0)
                    return true;
                if (!value)
                    return false;
                return set.has(value);
            };
            return (matchCategory(this.selectedFilters.models, models) &&
                matchCategory(this.selectedFilters.endpoints, endpoints) &&
                matchCategory(this.selectedFilters.techniques, techniques) &&
                matchStudyType(this.selectedFilters.studyTypes, studyType));
        });
        if (matches.length === 0)
            return;
        const summary = matches.map(([path, data]) => ({
            note: this.plugin.pathToWikiLink(path),
            models: data.concepts?.models,
            endpoints: data.concepts?.endpoints,
            techniques: data.concepts?.techniques,
            doses: data.parsedDoses?.map((d) => `${d.totalGy} Gy / ${d.fractions} Fx`)
        }));
        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama3",
                stream: false,
                prompt: `
You are an expert radiation oncology research strategist.

Given this structured research cluster:

${JSON.stringify(summary, null, 2)}

Provide:

1. Key modelling weaknesses
2. Missing biological mechanisms
3. Potential alternative models
4. High-impact research hypotheses
5. Experimental validation suggestions

Respond clearly and structured.
`
            })
        });
        const data = await response.json();
        container.createEl("h4", { text: "Research Insights" });
        container.createEl("pre", { text: data.response });
    }
    showMatchingNotes(category, value) {
        const matches = Object.entries(this.plugin.vectorIndex)
            .filter(([_, data]) => {
            if (!data.concepts)
                return false;
            if (category === "Models")
                return data.concepts.models?.includes(value);
            if (category === "Endpoints")
                return data.concepts.endpoints?.includes(value);
            if (category === "Techniques")
                return data.concepts.techniques?.includes(value);
            if (category === "Study Types")
                return data.concepts.studyType === value;
            return false;
        });
        const container = this.containerEl;
        container.empty();
        container.createEl("h3", { text: `Notes with ${value}` });
        matches.forEach(([path]) => {
            const el = container.createEl("div");
            el.createEl("a", {
                text: this.plugin.pathToWikiLink(path),
                href: "#"
            }).onclick = () => {
                this.app.workspace.openLinkText(path, "", false);
            };
        });
    }
}

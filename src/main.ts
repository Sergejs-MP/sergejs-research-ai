import { Plugin, Editor, Notice } from "obsidian";
import { buildIndex, IndexedNote } from "./indexer";
import { cosineSimilarity } from "./similarity";
import { generateEmbedding } from "./embedding";
import { RelatedView, VIEW_TYPE_RELATED } from "./relatedView";
import { MarkdownView } from "obsidian";
import { FilterView, VIEW_TYPE_FILTER } from "./filterView";
import { ChatView, VIEW_TYPE_CHAT } from "./chatView";
import { SergejsSettingTab } from "./settingsTab";
import { generateTextWithOllama } from "./ollama";

interface SergejsAISettings {
    chatModel: string;
    insightModel: string;
}

const DEFAULT_SETTINGS: SergejsAISettings = {
    chatModel: "llama3",
    insightModel: "llama3"
};

export default class SergejsResearchAI extends Plugin {
    public vectorIndex: Record<string, IndexedNote> = {};
    private indexFilePath = ".obsidian/plugins/sergejs-research-ai/vector-index.json";

    settings!: SergejsAISettings;

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    public pathToWikiLink(path: string): string {
        const base = path.split("/").pop() ?? path;
        return base.endsWith(".md") ? base.slice(0, -3) : base;
    }
    public async findRelated(text: string, path?: string, topK = 5) {
        let currentEmbedding: number[] | undefined;

        // If note already indexed, reuse embedding
        if (path && this.vectorIndex[path]) {
            currentEmbedding = this.vectorIndex[path].embedding;
        } else {
            try {
                currentEmbedding = await generateEmbedding(text);
            } catch (err) {
                console.error("Embedding failed for current note:", err);
                return [];
            }
        }

        if (!currentEmbedding) return [];

        const sims = Object.entries(this.vectorIndex)
            .filter(([p]) => p !== path)
            .map(([p, data]) => ({
                path: p,
                score: cosineSimilarity(currentEmbedding!, data.embedding)
            }));

        return sims.sort((a, b) => b.score - a.score).slice(0, topK);
    }
    private async saveIndex() {
        await this.app.vault.adapter.write(
            this.indexFilePath,
            JSON.stringify(this.vectorIndex)
        );
    }

    private async loadIndex() {
        try {
            const exists = await this.app.vault.adapter.exists(this.indexFilePath);

            if (!exists) {
                this.vectorIndex = {};
                return;
            }

            const data = await this.app.vault.adapter.read(this.indexFilePath);
            this.vectorIndex = JSON.parse(data);

            new Notice(`Loaded semantic index (${Object.keys(this.vectorIndex).length} notes).`);

        } catch (err) {
            console.error("Index load error:", err);
            this.vectorIndex = {};
        }
    }

    async activateRelatedView() {
        const { workspace } = this.app;

        let leaf = workspace.getLeavesOfType(VIEW_TYPE_RELATED)[0];

        if (!leaf) {
            const newLeaf = workspace.getRightLeaf(false);
            if (!newLeaf) return;
            await newLeaf.setViewState({
                type: VIEW_TYPE_RELATED,
                active: true,
            });
            leaf = newLeaf;
        }

        workspace.revealLeaf(leaf);
    }

    async onload() {
        this.addSettingTab(new SergejsSettingTab(this.app, this));
        await this.loadSettings();
        await this.loadIndex();
        this.registerView(
            VIEW_TYPE_RELATED,
            (leaf) => new RelatedView(leaf, this)
        );

        this.registerView(
            VIEW_TYPE_CHAT,
            (leaf) => new ChatView(leaf, this)
        );

        this.addCommand({
            id: "open-chat-sidebar",
            name: "Open AI Research Assistant",
            callback: async () => {
                const leaf = this.app.workspace.getRightLeaf(false);
                if (!leaf) return;

                await leaf.setViewState({
                    type: VIEW_TYPE_CHAT,
                    active: true
                });
            }
        });

        this.registerView(
            VIEW_TYPE_FILTER,
            (leaf) => new FilterView(leaf, this)
        );

        this.addCommand({
            id: "open-filter-sidebar",
            name: "Open Research Filter Sidebar",
            callback: async () => {
                const leaf = this.app.workspace.getRightLeaf(false);
                if (!leaf) return;

                await leaf.setViewState({
                    type: VIEW_TYPE_FILTER,
                    active: true
                });
            }
        });


        console.log("Sergejs Research AI loaded.");
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", async () => {
                const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (!markdownView || !markdownView.file) return;

                const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_RELATED);
                if (!leaves.length) return;

                const relatedLeaf = leaves[0];
                const view: any = relatedLeaf.view;

                // 🔐 SAFEST CHECK: method existence
                if (!view || typeof view.updateView !== "function") return;

                await view.updateView(markdownView.editor.getValue());
            })
        );

        this.addCommand({
            id: "build-semantic-index",
            name: "Build Semantic Vault Index",
            callback: async () => {
                try {
                    new Notice("Building semantic index...");
                    this.vectorIndex = await buildIndex(this.app, this.vectorIndex);
                    await this.saveIndex();
                    new Notice(`Semantic index complete: ${Object.keys(this.vectorIndex).length} notes.`);
                } catch (err: any) {
                    console.error(err);
                    new Notice("Index build error: " + (err?.message ?? String(err)));
                }
            }
        });

        this.addCommand({
            id: "open-related-sidebar",
            name: "Open Related Notes Sidebar",
            callback: async () => {
                this.activateRelatedView();
            }
        });



        this.addCommand({
            id: "rebuild-full-index",
            name: "Rebuild Full Index (Force Re-Extract Concepts)",
            callback: async () => {
                new Notice("Full rebuild starting...");
                this.vectorIndex = {};
                this.vectorIndex = await buildIndex(this.app, {});
                await this.saveIndex();
                new Notice("Full rebuild complete.");
            }
        });

        this.addCommand({
            id: "suggest-tags",
            name: "Suggest Tags (AI)",
            editorCallback: async (editor) => {
                const content = editor.getValue();

                new Notice("Generating tag suggestions...");

                let generatedTags = "";
                try {
                    generatedTags = await generateTextWithOllama(
                        this.settings.chatModel,
                        `
You are a research assistant in radiation oncology.

Extract 5–8 concise lowercase tags for the following note.
Tags should be short, technical, no spaces, hyphen separated.

Return ONLY comma-separated tags.

Note:
${content}
`
                    );
                } catch (error) {
                    console.error("Tag generation failed:", error);
                    new Notice("Tag generation failed. Make sure Ollama is running.");
                    return;
                }

                const rawTags = generatedTags
                    .split(",")
                    .map((t: string) => t.trim().toLowerCase())
                    .filter((t: string) => t.length > 2);

                const uniqueTags = [...new Set(rawTags)];

                const tagBlock =
                    "\n\n## 🏷 Suggested Tags\n" +
                    uniqueTags.map(t => `- #${t}`).join("\n");

                editor.setValue(content + tagBlock);

                new Notice("Tag suggestions inserted.");
            }
        });

        this.addCommand({
            id: "show-related-notes",
            name: "Show Related Notes",
            editorCallback: async (editor: Editor) => {

                if (!this.vectorIndex || Object.keys(this.vectorIndex).length === 0) {
                    new Notice("Build index first.");
                    return;
                }

                const text = editor.getValue();
                const related = await this.findRelated(text);

                const result = related
                    .map(r => `- ${r.path} (score: ${r.score.toFixed(3)})`)
                    .join("\n");

                editor.replaceSelection("\n\n## 🔗 Related Notes\n" + result);
            }
        });

        this.addCommand({
            id: "research-analyze",
            name: "Research Assistant: Analyze Current Note",
            editorCallback: async (editor: Editor) => {

                const text = editor.getValue();
                new Notice("Analyzing with local AI...");

                try {
                    const analysis = await generateTextWithOllama(
                        this.settings.insightModel,
                        `
You are a research assistant in radiation oncology.

Analyze the following note:

${text}

Return structured output:

1. Key concepts
2. Missing conceptual links
3. Suggested tags (short)
4. Possible research extensions
`
                    );

                    editor.replaceSelection(
                        "\n\n## 🧠 AI Research Analysis\n\n" + analysis
                    );
                } catch (error) {
                    console.error("Research analysis failed:", error);
                    new Notice("Analysis failed. Make sure Ollama is running.");
                }
            }
        });

    }

    onunload() {
        console.log("Sergejs Research AI unloaded.");
    }
}

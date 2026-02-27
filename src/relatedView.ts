import { ItemView, WorkspaceLeaf } from "obsidian";
import SergejsResearchAI from "./main";

export const VIEW_TYPE_RELATED = "sergejs-related-view";

export class RelatedView extends ItemView {
    plugin: SergejsResearchAI;

    constructor(leaf: WorkspaceLeaf, plugin: SergejsResearchAI) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_RELATED;
    }

    getDisplayText() {
        return "Related Notes";
    }

    async onOpen() {
        this.containerEl.empty();
        this.containerEl.createEl("h3", { text: "Semantic Related Notes" });
    }

    async updateView(content: string) {
        const container = this.containerEl;
        container.empty();
        container.createEl("h3", { text: "Semantic Related Notes" });

        if (!this.plugin.vectorIndex || Object.keys(this.plugin.vectorIndex).length === 0) {
            container.createEl("p", { text: "Build semantic index first." });
            return;
        }

        const file = this.app.workspace.getActiveFile();
        if (!file) return;

        const related = await this.plugin.findRelated(content, file.path, 7);

        for (const item of related) {
            const link = container.createEl("div");
            link.createEl("a", {
                text: `${this.plugin.pathToWikiLink(item.path)} (${item.score.toFixed(3)})`,
                href: "#"
            }).onclick = () => {
                this.app.workspace.openLinkText(item.path, "", false);
            };
        }
    }
}
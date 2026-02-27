import { ItemView } from "obsidian";
export const VIEW_TYPE_CHAT = "sergejs-chat-view";
export class ChatView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.useSelection = true;
        this.lastSelection = "";
        this.plugin = plugin;
    }
    getViewType() {
        return VIEW_TYPE_CHAT;
    }
    getDisplayText() {
        return "AI Research Assistant";
    }
    async onOpen() {
        const container = this.containerEl;
        container.empty();
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.height = "100%";
        // 🔹 Top Input Section
        const topSection = container.createEl("div");
        topSection.style.padding = "8px";
        topSection.style.borderBottom = "1px solid var(--background-modifier-border)";
        // Toggle
        const toggleWrapper = topSection.createEl("div");
        toggleWrapper.style.marginBottom = "6px";
        const toggleLabel = toggleWrapper.createEl("label");
        const checkbox = toggleLabel.createEl("input", { type: "checkbox" });
        checkbox.checked = true;
        toggleLabel.appendText(" Use selected text");
        checkbox.onchange = () => {
            this.useSelection = checkbox.checked;
        };
        // Textarea
        this.inputEl = topSection.createEl("textarea");
        this.inputEl.placeholder = "Ask about this note...";
        this.inputEl.style.width = "100%";
        this.inputEl.style.height = "60px";
        this.inputEl.style.marginTop = "6px";
        this.inputEl.style.resize = "vertical";
        // Ask Button
        const btn = topSection.createEl("button", { text: "Ask AI" });
        btn.style.marginTop = "6px";
        btn.style.width = "100%";
        btn.style.cursor = "pointer";
        btn.onmousedown = (e) => {
            const markdownLeaf = this.app.workspace.getLeavesOfType("markdown")[0];
            if (!markdownLeaf)
                return;
            const view = markdownLeaf.view;
            const selection = view.editor.getSelection();
            if (selection && selection.length > 0) {
                this.lastSelection = selection;
            }
        };
        btn.onclick = async () => {
            await this.askAI();
        };
        // 🔹 Output Section (Below)
        this.outputEl = container.createEl("div");
        this.outputEl.style.flex = "1 1 auto";
        this.outputEl.style.overflowY = "auto";
        this.outputEl.style.overflowX = "hidden";
        this.outputEl.style.padding = "10px";
        this.outputEl.style.whiteSpace = "pre-wrap";
        this.outputEl.style.wordBreak = "break-word";
    }
    async askAI() {
        console.log("askAI triggered");
        const markdownLeaf = this.app.workspace.getLeavesOfType("markdown")[0];
        if (!markdownLeaf)
            return;
        const view = markdownLeaf.view;
        // 🔹 Capture selection immediately
        const liveSelection = view.editor.getSelection();
        if (liveSelection && liveSelection.length > 0) {
            this.lastSelection = liveSelection;
        }
        const context = this.useSelection && this.lastSelection
            ? this.lastSelection
            : view.editor.getValue();
        const question = this.inputEl.value.trim();
        if (!question)
            return;
        // Disable input during processing
        this.inputEl.disabled = true;
        // Create loading indicator
        const loadingEl = this.outputEl.createEl("div", {
            text: "🧠 Thinking..."
        });
        loadingEl.style.opacity = "0.7";
        try {
            const response = await fetch("http://localhost:11434/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: this.plugin.settings.chatModel,
                    stream: false,
                    prompt: `
You are a radiation oncology research assistant.

Context:
${context}

Question:
${question}

Provide a structured, technical answer.
`
                })
            });
            const data = await response.json();
            loadingEl.remove();
            const answerBlock = this.outputEl.createEl("div");
            answerBlock.style.marginBottom = "12px";
            answerBlock.createEl("div", {
                text: `Q: ${question}`,
                attr: { style: "font-weight: bold; margin-bottom: 4px;" }
            });
            const pre = answerBlock.createEl("pre", {
                text: data.response || "No response."
            });
            pre.style.whiteSpace = "pre-wrap";
            pre.style.wordBreak = "break-word";
            pre.style.overflowX = "hidden";
            // Scroll to bottom
            this.outputEl.scrollTop = this.outputEl.scrollHeight;
        }
        catch (err) {
            loadingEl.remove();
            this.outputEl.createEl("div", {
                text: "⚠ Error communicating with AI.",
                attr: { style: "color: var(--text-error);" }
            });
            console.error(err);
        }
        finally {
            this.inputEl.disabled = false;
        }
    }
}

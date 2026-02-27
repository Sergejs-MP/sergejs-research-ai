import { PluginSettingTab, App, Setting } from "obsidian";
import SergejsResearchAI from "./main";

export class SergejsSettingTab extends PluginSettingTab {
    plugin: SergejsResearchAI;

    constructor(app: App, plugin: SergejsResearchAI) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h3", { text: "Model Settings" });

        new Setting(containerEl)
            .setName("Chat Model")
            .setDesc("Model used for chat panel")
            .addDropdown(drop =>
                drop
                    .addOption("llama3", "llama3")
                    .addOption("gpt-oss", "gpt-oss")
                    .setValue(this.plugin.settings.chatModel)
                    .onChange(async (value) => {
                        this.plugin.settings.chatModel = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Insight Model")
            .setDesc("Model used for research insights")
            .addDropdown(drop =>
                drop
                    .addOption("llama3", "llama3")
                    .addOption("gpt-oss", "gpt-oss")
                    .setValue(this.plugin.settings.insightModel)
                    .onChange(async (value) => {
                        this.plugin.settings.insightModel = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}
import { App } from "obsidian";
import { generateEmbedding } from "./embedding";
import { extractConcepts, ExtractedConcepts } from "./concepts";
import { ParsedDose } from "./concepts";
import { parseDoseStrings } from "./concepts";


export type IndexedNote = {
    embedding: number[];
    mtime: number;
    concepts?: ExtractedConcepts;
    parsedDoses?: ParsedDose[];
};

export async function buildIndex(
    app: App,
    existingIndex: Record<string, IndexedNote>
): Promise<Record<string, IndexedNote>> {

    const files = app.vault.getMarkdownFiles();
    const newIndex: Record<string, IndexedNote> = { ...existingIndex };

    for (const file of files) {
        try {
            const stat = file.stat.mtime;

            if (
                existingIndex[file.path] &&
                existingIndex[file.path].mtime === stat
            ) {
                continue; // unchanged
            }

            const content = await app.vault.read(file);

            if (!content || content.trim().length < 20) {
                continue;
            }

            const embedding = await generateEmbedding(content);

            if (!embedding) continue;

            const concepts = await extractConcepts(content);

            const parsedDoses = concepts?.doses
                ? parseDoseStrings(concepts.doses)
                : [];

            newIndex[file.path] = {
                embedding,
                mtime: stat,
                concepts: concepts ?? undefined,
                parsedDoses
            };
        } catch (err) {
            console.error("Index error:", file.path, err);
            continue;
        }
    }

    return newIndex;
}
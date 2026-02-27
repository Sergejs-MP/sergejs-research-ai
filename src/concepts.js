import { ONTOLOGY } from "./ontology";
export function parseDoseStrings(doses) {
    const results = [];
    doses.forEach(d => {
        const match = d.match(/([\d.]+)\s*gy.*?(\d+)\s*fx/i);
        if (!match)
            return;
        const total = parseFloat(match[1]);
        const fx = parseInt(match[2]);
        if (!isNaN(total) && !isNaN(fx) && fx > 0) {
            results.push({
                totalGy: total,
                fractions: fx,
                dosePerFraction: total / fx
            });
        }
    });
    return results;
}
export async function extractConcepts(text) {
    const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "llama3",
            stream: false,
            prompt: `
You are an expert radiation oncology research assistant.

Extract structured research concepts from the following note.

Respond ONLY with valid JSON.
Do NOT add explanations.
Do NOT use markdown.
Do NOT wrap in backticks.

Required format:

{
  "doses": [],
  "models": [],
  "endpoints": [],
  "techniques": [],
  "studyType": ""
}

Note:
${text}
`
        })
    });
    function normalizeArray(arr) {
        if (!arr)
            return [];
        return [...new Set(arr
                .filter(v => typeof v === "string")
                .map(v => v.trim().toLowerCase())
                .filter(v => v.length > 0))];
    }
    function filterToOntology(values, allowed) {
        return values.filter(v => allowed.includes(v));
    }
    const data = await response.json();
    if (!data.response)
        return null;
    // Try to extract JSON block safely
    const jsonMatch = data.response.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        return null;
    try {
        const parsed = JSON.parse(jsonMatch[0]);
        // 1️⃣ Normalize first
        parsed.models = normalizeArray(parsed.models);
        parsed.endpoints = normalizeArray(parsed.endpoints);
        parsed.techniques = normalizeArray(parsed.techniques);
        parsed.doses = normalizeArray(parsed.doses);
        // 2️⃣ THEN apply ontology
        parsed.models = filterToOntology(parsed.models, ONTOLOGY.models);
        parsed.endpoints = filterToOntology(parsed.endpoints, ONTOLOGY.endpoints);
        parsed.techniques = filterToOntology(parsed.techniques, ONTOLOGY.techniques);
        if (parsed.studyType) {
            const st = parsed.studyType.trim().toLowerCase();
            parsed.studyType = ONTOLOGY.studyTypes.includes(st) ? st : undefined;
        }
        return parsed;
    }
    catch (err) {
        console.error("Concept JSON parse failed:", err);
        return null;
    }
}

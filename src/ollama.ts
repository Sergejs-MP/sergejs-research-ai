const OLLAMA_GENERATE_URL = "http://localhost:11434/api/generate";

type OllamaGenerateResponse = {
    response?: string;
    error?: string;
};

export async function generateTextWithOllama(model: string, prompt: string): Promise<string> {
    const response = await fetch(OLLAMA_GENERATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            stream: false,
            prompt
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama request failed (${response.status})`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;

    if (typeof data.response !== "string" || !data.response.trim()) {
        throw new Error(data.error ?? "No response returned from Ollama");
    }

    return data.response.trim();
}

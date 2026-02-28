require('dotenv').config();
const { A2AClient } = require('a2a');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const readline = require('readline');
const colors = require('colors');

// Configuration
const REGISTRY_URL = process.env.A2A_REGISTRY_URL || 'https://www.a2a-registry.org/.well-known/agent-card.json';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const REGISTRY_API_TOKEN = process.env.A2A_REGISTRY_API_TOKEN;

// Initialize SDKs
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Console Interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const log = {
    system: (msg) => console.log(`[SYSTEM] ${msg}`.cyan),
    agent: (msg) => console.log(`[AGENT] ${msg}`.green),
    network: (msg) => console.log(`[NETWORK] ${msg}`.yellow),
    error: (msg) => console.log(`[ERROR] ${msg}`.red)
};

/**
 * Unified completion helper that supports both OpenAI and Gemini
 */
async function getCompletion(systemPrompt, messages) {
    if (openai) {
        log.system("Using OpenAI (GPT-4)...");
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            response_format: { type: "json_object" }
        });
        return JSON.parse(completion.choices[0].message.content);
    } else if (genAI) {
        log.system("Using Google Gemini...");
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-pro",
            generationConfig: { responseMimeType: "application/json" }
        });
        const prompt = `${systemPrompt}\n\nHistory:\n${JSON.stringify(messages)}\n\nRespond in JSON:`;
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    } else {
        throw new Error("No LLM API Key provided (OPENAI_API_KEY or GEMINI_API_KEY)");
    }
}

async function main() {
    if (!REGISTRY_API_TOKEN) {
        log.error("Missing REGISTRY_API_TOKEN in .env");
        process.exit(1);
    }
    if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
        log.error("Missing LLM API Key. Please provide OPENAI_API_KEY or GEMINI_API_KEY in .env");
        process.exit(1);
    }

    const client = new A2AClient({
        registryUrl: REGISTRY_URL,
        authToken: REGISTRY_API_TOKEN
    });

    try {
        log.system("Connecting to A2A Registry...");
        await client.connect();
        log.system(`Connected to Registry: ${client.registryAgent.display_name}`);
    } catch (e) {
        log.error(`Failed to connect: ${e.message}`);
        return;
    }

    let inventory = [client.registryAgent];

    rl.question('Enter your intent (e.g. "Check price of Bitcoin"): ', async (userIntent) => {
        log.agent(`Received intent: "${userIntent}"`);
        await runAgentLoop(userIntent, inventory);
        rl.close();
    });

    async function runAgentLoop(userIntent, inventory) {
        let history = [];
        let maxSteps = 5;

        for (let i = 0; i < maxSteps; i++) {
            log.system(`Step ${i + 1}: Thinking...`);

            const inventoryText = inventory.map(a =>
                `- ${a.display_name} (${a.package_name}): ${a.description}\n  Capabilities: ${JSON.stringify(Object.keys(a.capabilities || {}))}`
            ).join('\n');

            const systemPrompt = `
You are an Autonomous Client Agent.
User Intent: "${userIntent}"

Inventory:
${inventoryText}

Your goal is to fulfilling the user intent using available tools.
If you need a tool you don't have, use the A2A Registry to 'search_agents'.

Response Format (JSON only):
{
    "thought": "Reasoning...",
    "action": "call" | "finish",
    "target_agent": "package_name",
    "capability": "capability_name",
    "payload": { ...params... },
    "final_response": "Answer to user"
}
`;

            try {
                const decision = await getCompletion(systemPrompt, history);
                log.agent(`Thought: ${decision.thought}`);

                if (decision.action === 'finish') {
                    log.agent(`FINAL ANSWER: ${decision.final_response}`);
                    break;
                }

                if (decision.action === 'call') {
                    const targetPkg = decision.target_agent;
                    const agentObj = inventory.find(a => a.package_name === targetPkg);

                    if (!agentObj) {
                        log.error(`Agent ${targetPkg} not found in inventory.`);
                        // Report failure back to LLM history
                        history.push({ role: "assistant", content: JSON.stringify(decision) });
                        history.push({ role: "system", content: `Error: Agent ${targetPkg} not found` });
                        continue;
                    }

                    log.network(`Calling ${targetPkg}.${decision.capability}...`);
                    const result = await client.call(agentObj, decision.capability, decision.payload);
                    log.system(`Result: ${JSON.stringify(result).substring(0, 100)}...`);

                    if (targetPkg === 'registry') {
                        const newAgents = Array.isArray(result) ? result : (result.agents || []);
                        if (newAgents.length > 0) {
                            log.system(`Discovered ${newAgents.length} agents.`);
                            inventory = [...inventory, ...newAgents];
                        }
                    }

                    history.push({ role: "assistant", content: JSON.stringify(decision) });
                    history.push({ role: "tool", content: JSON.stringify(result) });
                }
            } catch (e) {
                log.error(`Error: ${e.message}`);
                break;
            }
        }
    }
}

main().catch(console.error);

# A2A Registry Client Agent (JavaScript Example)

This example demonstrates how to build an **Autonomous Client Agent** using Node.js and the [A2A Protocol](https://www.a2a-registry.org/docs/a2a).

## Prerequisites
- Node.js v18+
- OpenAI API Key
- A2A Registry API Token (Get one at [A2A Registry Console](https://www.a2a-registry.org/console))

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` file from example:
   ```bash
   cp .env.example .env
   # Edit .env with your keys
   ```

## Usage
Run the agent:
```bash
node index.js
```

Enter a prompt like **"Check the price of Bitcoin"**.

## How it Works
1. **Handshake**: Connects to A2A Registry.
2. **Analysis**: Uses OpenAI to plan the task.
3. **Discovery**: Searches Registry if tools are missing.
4. **Execution**: Calls discovered agents (e.g. Finance Agent) directly via A2A protocol.

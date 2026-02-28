import os
import json
from dotenv import load_dotenv
from openai import OpenAI
import google.generativeai as genai
from colorama import init, Fore, Style
from a2a import Client

# Initialize Colorama
init()
load_dotenv()

# Configuration
REGISTRY_URL = os.getenv("A2A_REGISTRY_URL", "https://www.a2a-registry.org/.well-known/agent-card.json")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
REGISTRY_API_TOKEN = os.getenv("A2A_REGISTRY_API_TOKEN")

# Initialize SDKs
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def log_system(msg): print(f"{Fore.CYAN}[SYSTEM] {msg}{Style.RESET_ALL}")
def log_agent(msg): print(f"{Fore.GREEN}[AGENT] {msg}{Style.RESET_ALL}")
def log_network(msg): print(f"{Fore.YELLOW}[NETWORK] {msg}{Style.RESET_ALL}")
def log_error(msg): print(f"{Fore.RED}[ERROR] {msg}{Style.RESET_ALL}")

def get_completion(system_prompt, history):
    """Unified completion helper supporting OpenAI and Gemini"""
    if openai_client:
        log_system("Using OpenAI (GPT-4)...")
        completion = openai_client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[{"role": "system", "content": system_prompt}, *history],
            response_format={"type": "json_object"}
        )
        return json.loads(completion.choices[0].message.content)
    elif GEMINI_API_KEY:
        log_system("Using Google Gemini...")
        model = genai.GenerativeModel("gemini-2.5-pro")
        prompt = f"{system_prompt}\n\nHistory:\n{json.dumps(history)}\n\nRespond in JSON:"
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(response_mime_type="application/json")
        )
        return json.loads(response.text)
    else:
        raise Exception("No LLM API Key provided (OPENAI_API_KEY or GEMINI_API_KEY)")

def run_agent_loop(user_intent, inventory, client):
    history = []
    max_steps = 5

    for i in range(max_steps):
        log_system(f"Step {i + 1}: Thinking...")

        inventory_text = ""
        for a in inventory:
            pkg_name = getattr(a, 'package_name', a.get('package_name'))
            disp_name = getattr(a, 'display_name', a.get('display_name'))
            desc = getattr(a, 'description', a.get('description'))
            caps = getattr(a, 'capabilities', a.get('capabilities', {}))
            inventory_text += f"- {disp_name} ({pkg_name}): {desc}\n  Capabilities: {json.dumps(list(caps.keys()))}\n"

        system_prompt = f"""
You are an Autonomous Client Agent.
User Intent: \"{user_intent}\"

Inventory:
{inventory_text}

Your goal is to fulfilling the user intent using available tools.
If you need a tool you don't have, use the A2A Registry to 'search_agents'.

Response Format (JSON only):
{{
    \"thought\": \"Reasoning...\",
    \"action\": \"call\" | \"finish\",
    \"target_agent\": \"package_name\",
    \"capability\": \"capability_name\",
    \"payload\": {{ ...params... }},
    \"final_response\": \"Answer to user\"
}}
"""
        try:
            decision = get_completion(system_prompt, history)
            log_agent(f"Thought: {decision.get('thought')}")

            if decision.get('action') == 'finish':
                log_agent(f"FINAL ANSWER: {decision.get('final_response')}")
                break

            if decision.get('action') == 'call':
                target_pkg = decision.get('target_agent')
                target_agent = next((a for a in inventory if (getattr(a, 'package_name', None) or a.get('package_name')) == target_pkg), None)

                if not target_agent:
                    log_error(f"Agent {target_pkg} not found.")
                    history.append({"role": "assistant", "content": json.dumps(decision)})
                    history.append({"role": "system", "content": f"Error: Agent {target_pkg} not found"})
                    continue

                log_network(f"Calling {target_pkg} capability '{decision.get('capability')}'...")
                result = client.call(target_agent, decision.get('capability'), decision.get('payload'))
                log_system(f"Result: {str(result)[:100]}...")

                if target_pkg == 'registry':
                    new_agents = result if isinstance(result, list) else result.get('agents', [])
                    if new_agents:
                        log_system(f"Discovered {len(new_agents)} agents.")
                        inventory.extend(new_agents)

                history.append({"role": "assistant", "content": json.dumps(decision)})
                history.append({"role": "tool", "content": json.dumps(result)})

        except Exception as e:
            log_error(f"Error: {e}")
            break

def main():
    if not REGISTRY_API_TOKEN:
        log_error("Missing REGISTRY_API_TOKEN in .env")
        return
    if not OPENAI_API_KEY and not GEMINI_API_KEY:
        log_error("Missing LLM API Key (OPENAI_API_KEY or GEMINI_API_KEY)")
        return

    try:
        # Client initialization
        log_system("Connecting to A2A Registry...")
        client = Client(registry_url=REGISTRY_URL, auth_token=REGISTRY_API_TOKEN)
        client.connect()
        log_system("Connected to Registry.")
    except Exception as e:
        log_error(f"Connection failed: {e}")
        return

    inventory = [client.registry_agent]
    user_intent = input('Enter your intent: ')
    log_agent(f"Received: {user_intent}")

    run_agent_loop(user_intent, inventory, client)

if __name__ == "__main__":
    main()

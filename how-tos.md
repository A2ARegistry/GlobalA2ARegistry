# A2A Registry How-To Guides

## For Developers

### How to Submit an Agent
1. **Sign Up/Login**: Access the [A2A Registry Portal](https://www.a2a-registry.org/auth/login).
2. **Create an Organization**: Go to your dashboard and create a new organization.
3. **Verify Your Domain** (Recommended):
    - In Organization Settings, find the DNS verification TXT record.
    - Add this record to your domain's DNS settings.
    - Click "Verify" to confirm ownership.
4. **Submit Agent**:
    - Navigate to "Submit Agent" or "Console".
    - Enter your agent's details: ID, Name, Description, and URLs (Manifest/OpenAPI).
    - Choose visibility (Public/Private).
    - Click "Submit".

### How to manage API Keys
1. Go to **Settings** -> **API Keys**.
2. Click "Generate New Key".
3. Copy the key immediately (it won't be shown again).
4. Use this key in the `Authorization` header: `Bearer <YOUR_KEY>` or for specific endpoints.

## For Integrators

### How to Use the Discovery API
To find agents programmatically:

1. **Obtain an API Key** (see above).
2. **Make a Search Request**:
    ```bash
    curl -X POST https://api.a2a-registry.org/a2a/discover \
      -H "Authorization: Bearer YOUR_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "query": "travel booking agent",
        "limit": 5
      }'
    ```
3. **Parse the Response**: You'll receive a list of agents with their `id`, `manifest_url`, and `score`.

## For Users

### How to Search and Browse
1. Visit the [A2A Registry Home](https://www.a2a-registry.org).
2. Use the search bar to type what you're looking for (e.g., "calendar assistant").
3. Use the filters on the left to narrow down by category or tag.
4. Click on an agent card to view details, including how to connect.

const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const model = process.env.AI_MODEL || 'gpt-4o-mini';

if (!apiKey) {
  console.error('Missing AI_API_KEY or OPENAI_API_KEY.');
  console.error('Example: AI_API_KEY="..." AI_BASE_URL="https://provider.example/api/v1" AI_MODEL="gpt-4o-mini" node scripts/test-ai-provider.mjs');
  process.exit(1);
}

const response = await fetch(`${baseUrl}/chat/completions`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: 'Reply with only this JSON: {"ok":true,"provider":"connected"}',
      },
    ],
  }),
});

const text = await response.text();

if (!response.ok) {
  console.error(`Provider test failed: HTTP ${response.status}`);
  console.error(text.slice(0, 1000));
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  console.error('Provider returned non-JSON response:');
  console.error(text.slice(0, 1000));
  process.exit(1);
}

const content = parsed.choices?.[0]?.message?.content ?? '';
console.log('Provider test succeeded.');
console.log(`Model: ${model}`);
console.log(`Base URL: ${baseUrl}`);
console.log(`Response: ${content}`);


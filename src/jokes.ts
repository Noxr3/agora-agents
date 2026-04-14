import OpenAI from "openai";

const FALLBACK_JOKES = [
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "Why did the scarecrow win an award? He was outstanding in his field.",
  "I told my wife she was drawing her eyebrows too high. She looked surprised.",
  "What do you call a fake noodle? An impasta.",
  "Why don't scientists trust atoms? Because they make up everything.",
  "I'm reading a book about anti-gravity. It's impossible to put down.",
  "What did the ocean say to the beach? Nothing, it just waved.",
  "Why did the bicycle fall over? Because it was two-tired.",
  "I used to hate facial hair, but then it grew on me.",
  "What do you call a bear with no teeth? A gummy bear.",
];

let openai: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENROUTER_API_KEY) return null;
  if (!openai) {
    openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return openai;
}

export async function getJoke(topic?: string): Promise<string> {
  const client = getClient();

  if (client && topic) {
    try {
      const response = await client.chat.completions.create({
        model: "anthropic/claude-sonnet-4",
        messages: [
          {
            role: "system",
            content:
              "You are a comedian. Tell exactly one short, funny joke. No preamble, just the joke. Keep it clean and under 280 characters.",
          },
          {
            role: "user",
            content: `Tell me a joke about: ${topic}`,
          },
        ],
        max_tokens: 200,
      });
      const joke = response.choices[0]?.message?.content?.trim();
      if (joke) return joke;
    } catch {
      // fall through to random joke
    }
  }

  return FALLBACK_JOKES[Math.floor(Math.random() * FALLBACK_JOKES.length)];
}

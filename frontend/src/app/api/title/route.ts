import OpenAI from "openai";
import { NextRequest } from "next/server";

const BASE_URL = "https://space.ai-builders.com/backend/v1";

function getApiKey(): string | undefined {
  return process.env.AI_BUILDER_TOKEN ?? process.env.SUPER_MIND_API_KEY;
}

export async function POST(request: NextRequest) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return Response.json(
      { error: "AI_BUILDER_TOKEN is not configured on the server." },
      { status: 500 },
    );
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return Response.json({ error: "message is required." }, { status: 400 });
  }

  const client = new OpenAI({
    apiKey,
    baseURL: BASE_URL,
  });

  try {
    const completion = await client.chat.completions.create({
      model: "grok-4-fast",
      messages: [
        {
          role: "system",
          content:
            "Generate a short conversation title (3-6 words, no quotes) based on the user's first message. Return only the title.",
        },
        { role: "user", content: message },
      ],
      max_tokens: 24,
    });

    const title = completion.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, "");
    if (!title) {
      return Response.json({ error: "Failed to generate title." }, { status: 502 });
    }

    return Response.json({ title: title.slice(0, 60) });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Title generation failed.";
    return Response.json({ error: detail }, { status: 502 });
  }
}

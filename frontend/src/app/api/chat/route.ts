import OpenAI from "openai";
import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/system-prompt";

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

  let body: { messages?: OpenAI.Chat.ChatCompletionMessageParam[]; model?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { messages, model = "grok-4-fast" } = body;
  if (!messages?.length) {
    return Response.json({ error: "messages is required." }, { status: 400 });
  }

  const client = new OpenAI({
    apiKey,
    baseURL: BASE_URL,
  });

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: "system", content: buildSystemPrompt() }, ...messages],
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`),
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Stream failed.";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chat completion failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}

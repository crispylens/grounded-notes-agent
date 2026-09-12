import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8000


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=== START SERVER PROCESS ===", flush=True)
    print(f"[Server] FastAPI app ready on http://{SERVER_HOST}:{SERVER_PORT}", flush=True)
    print(f"[Server] Hello endpoint: http://{SERVER_HOST}:{SERVER_PORT}/hello/{{name}}", flush=True)
    print(f"[Server] API docs: http://{SERVER_HOST}:{SERVER_PORT}/docs", flush=True)
    yield
    print("[Server] STOPPED server process", flush=True)


app = FastAPI(lifespan=lifespan)
STATIC_DIR = Path(__file__).parent / "static"


@app.get("/hello/{name}")
def hello(name: str) -> dict[str, str]:
    return {"message": f"Hello, {name}"}

BASE_URL = "https://space.ai-builders.com/backend/v1"
SEARCH_URL = f"{BASE_URL}/search/"
DEFAULT_MODEL = "gpt-5"
TOOL_CALL_TEST_MODEL = "gpt-5"
MAX_TURNS = 3
MAX_PAGE_TEXT_CHARS = 15000
FETCH_TIMEOUT_SECONDS = 30
USER_AGENT = "Mozilla/5.0 (compatible; AIBuilderAgent/1.0)"

WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": (
            "Search the web for current information. Use this when the user asks "
            "about recent events, facts, or anything that may require up-to-date data."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query string.",
                }
            },
            "required": ["query"],
        },
    },
}

READ_PAGE_TOOL = {
    "type": "function",
    "function": {
        "name": "read_page",
        "description": (
            "Fetch a web page by URL and return its main text content. Use this after "
            "searching to read official documentation, changelogs, or article pages."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The HTTP or HTTPS URL to fetch and read.",
                }
            },
            "required": ["url"],
        },
    },
}

AGENT_TOOLS = [WEB_SEARCH_TOOL, READ_PAGE_TOOL]

def _get_api_key() -> str:
    api_key = os.getenv("SUPER_MIND_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="SUPER_MIND_API_KEY not configured")
    return api_key


def get_client() -> OpenAI:
    return OpenAI(api_key=_get_api_key(), base_url=BASE_URL)


def web_search(query: str) -> dict:
    payload = json.dumps({"keywords": [query], "max_results": 3}).encode("utf-8")
    request = urllib.request.Request(
        SEARCH_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {_get_api_key()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=exc.code, detail=body) from exc


class _TextExtractor(HTMLParser):
    _SKIP_TAGS = frozenset({"script", "style", "noscript", "head", "svg", "template"})

    def __init__(self) -> None:
        super().__init__()
        self._skip_depth = 0
        self._chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() in self._SKIP_TAGS:
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in self._SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            text = data.strip()
            if text:
                self._chunks.append(text)

    def get_text(self) -> str:
        return re.sub(r"\n{3,}", "\n\n", "\n".join(self._chunks))


def _extract_text_from_html(html: str) -> str:
    parser = _TextExtractor()
    parser.feed(html)
    parser.close()
    return parser.get_text()


def read_page(url: str) -> dict:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("URL must use http or https")

    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=exc.code, detail=body) from exc

    html = raw.decode("utf-8", errors="replace")
    text = _extract_text_from_html(html).strip()
    truncated = len(text) > MAX_PAGE_TEXT_CHARS
    if truncated:
        text = text[:MAX_PAGE_TEXT_CHARS]

    return {
        "url": url,
        "text": text,
        "truncated": truncated,
        "char_count": len(text),
    }


class ChatRequest(BaseModel):
    user_message: str
    model: str = DEFAULT_MODEL


class ChatResponse(BaseModel):
    content: str


class ToolCallVerificationResponse(BaseModel):
    valid: bool
    tool_calls: list[dict]
    finish_reason: str


def _agent_log(message: str) -> None:
    """Print agent steps to the uvicorn server console (stdout)."""
    print(message, flush=True)


def _tool_display_name(tool_name: str) -> str:
    if tool_name == "web_search":
        return "search"
    if tool_name == "read_page":
        return "read_page"
    return tool_name


def _execute_tool_call(tool_call) -> str:
    try:
        arguments = json.loads(tool_call.function.arguments)
    except (json.JSONDecodeError, TypeError) as exc:
        return json.dumps({"error": f"Invalid tool arguments: {exc}"})

    try:
        if tool_call.function.name == "web_search":
            return json.dumps(web_search(arguments["query"]))
        if tool_call.function.name == "read_page":
            return json.dumps(read_page(arguments["url"]))
        return json.dumps({"error": f"Unknown tool: {tool_call.function.name}"})
    except (KeyError, TypeError) as exc:
        return json.dumps({"error": f"Invalid tool arguments: {exc}"})
    except HTTPException as exc:
        return json.dumps({"error": exc.detail})
    except ValueError as exc:
        return json.dumps({"error": str(exc)})
    except urllib.error.URLError as exc:
        return json.dumps({"error": f"Failed to fetch URL: {exc.reason}"})

def _truncate_for_log(text: str, limit: int = 500) -> str:
    if len(text) <= limit:
        return text
    return f"{text[:limit]}..."


def run_agent_chat(client: OpenAI, model: str, user_message: str) -> str:
    messages: list[dict] = [{"role": "user", "content": user_message}]

    for turn in range(1, MAX_TURNS + 1):
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=AGENT_TOOLS,
            tool_choice="auto",
        )
        choice = response.choices[0]
        message = choice.message

        if choice.finish_reason != "tool_calls" or not message.tool_calls:
            content = message.content or ""
            _agent_log(f"[Agent] Final Answer: '{content}'")
            return content

        messages.append(
            {
                "role": "assistant",
                "content": message.content,
                "tool_calls": [
                    {
                        "id": call.id,
                        "type": call.type,
                        "function": {
                            "name": call.function.name,
                            "arguments": call.function.arguments,
                        },
                    }
                    for call in message.tool_calls
                ],
            }
        )

        for tool_call in message.tool_calls:
            display_name = _tool_display_name(tool_call.function.name)
            _agent_log(f"[Agent] Decided to call tool: '{display_name}'")
            tool_output = _execute_tool_call(tool_call)
            _agent_log(f"[System] Tool Output: '{_truncate_for_log(tool_output)}'")
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_output,
                }
            )

        _agent_log(f"[Agent] Completed turn {turn}/{MAX_TURNS}")

    final_response = client.chat.completions.create(
        model=model,
        messages=messages,
        tools=AGENT_TOOLS,
        tool_choice="none",
    )
    content = final_response.choices[0].message.content or ""
    _agent_log(f"[Agent] Final Answer: '{content}'")
    return content


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    client = get_client()
    content = run_agent_chat(client, request.model, request.user_message)
    return ChatResponse(content=content)

def _is_valid_web_search_tool_call(tool_call: dict) -> bool:
    if tool_call.get("function", {}).get("name") != "web_search":
        return False
    try:
        arguments = json.loads(tool_call["function"]["arguments"])
    except (KeyError, json.JSONDecodeError, TypeError):
        return False
    query = arguments.get("query")
    return isinstance(query, str) and bool(query.strip())


@app.post("/verify-tool-call", response_model=ToolCallVerificationResponse)
def verify_tool_call() -> ToolCallVerificationResponse:
    client = get_client()
    response = client.chat.completions.create(
        model=TOOL_CALL_TEST_MODEL,
        messages=[{"role": "user", "content": "Who won the Super Bowl?"}],
        tools=[WEB_SEARCH_TOOL],
        tool_choice="auto",
    )
    choice = response.choices[0]
    message = choice.message
    tool_calls = []
    if message.tool_calls:
        for call in message.tool_calls:
            tool_calls.append(
                {
                    "id": call.id,
                    "type": call.type,
                    "function": {
                        "name": call.function.name,
                        "arguments": call.function.arguments,
                    },
                }
            )

    valid = (
        choice.finish_reason == "tool_calls"
        and len(tool_calls) > 0
        and all(_is_valid_web_search_tool_call(call) for call in tool_calls)
    )
    return ToolCallVerificationResponse(
        valid=valid,
        tool_calls=tool_calls,
        finish_reason=choice.finish_reason,
    )


@app.get("/")
def serve_frontend() -> FileResponse:
    """Serve the chat web application."""
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


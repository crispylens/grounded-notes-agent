export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export const DEFAULT_MODEL = "grok-4-fast";

export const MODELS: ModelOption[] = [
  {
    id: "grok-4-fast",
    label: "Grok 4 Fast",
    description: "Fast responses via xAI Grok",
  },
  {
    id: "grok-4.5",
    label: "Grok 4.5",
    description: "Higher quality Grok with reasoning",
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    description: "OpenAI-compatible flagship model",
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    description: "Fast and cost-effective",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    description: "Fast Gemini reasoning",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Google Gemini Pro",
  },
  {
    id: "supermind-agent-v1",
    label: "Supermind Agent",
    description: "Agent with web search tools",
  },
];

export function getModelLabel(modelId: string): string {
  return MODELS.find((model) => model.id === modelId)?.label ?? modelId;
}

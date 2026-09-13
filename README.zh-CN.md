# ai-architecture

面向个人笔记的 **本地优先 RAG + Agent**：在磁盘上索引 Markdown 与纯文本，用 FAISS 做向量检索，通过 FastAPI 网页/API 对话，Agent 可自主调用 `query_my_notes` 查你的知识库。

## 功能概览

- **索引器**（`know_your_data/build_index.py`）：递归扫描、分块、调用 [AI Builders Space](https://space.ai-builders.com/) 的 OpenAI 兼容 `/embeddings`，生成 FAISS 索引（`my_notes.index` 与元数据 JSON）。
- **检索模块**（`rag/`）：余弦相似度检索；支持按文件夹前缀过滤；针对「公司升职」类问题可合并态度相关片段以便核对前提。
- **Agent**（`main.py`）：`/chat` 提供 `query_my_notes`、`web_search`、`read_page`；系统提示强调基于笔记作答、同题前提核对、笔记未覆盖时如实说明。

## 环境要求

- Python 3.11+
- AI Builders Space 的 API Key（`AI_BUILDER_TOKEN` 或 `SUPER_MIND_API_KEY`）

## 安装

```bash
cd ai-architecture
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env   # 编辑 .env 填入 token
```

`.env` 建议配置：

- `AI_BUILDER_TOKEN=your_token_here`
- 可选：`NOTES_ROOT=你的笔记根目录`（也可用 `build_index.py --root` 指定）

## 构建索引

```bash
python know_your_data/build_index.py --root /path/to/your/notes
```

产物位于项目根目录（已在 `.gitignore` 中忽略）：`my_notes.index`、`my_notes_meta.json`、`index_manifest.json`。

检索冒烟：

```bash
python know_your_data/smoke_rag.py
```

## 启动服务

```bash
uvicorn main:app --reload
```

浏览器访问 http://127.0.0.1:8000（静态聊天页）或 http://127.0.0.1:8000/docs（API 文档）。

## 目录说明

| 路径 | 说明 |
|------|------|
| `main.py` | FastAPI 与 Agent 主循环 |
| `rag/` | 分块、配置、FAISS 检索 |
| `know_your_data/` | 索引与冒烟脚本（私人评测用 md 不会进 git） |
| `static/` | 简易 Web 聊天 |
| `frontend/` | Next.js 前端（可选） |

## 安全提示

- 勿提交 `.env`、索引文件或 API Key。
- 索引时会按文本块调用 embedding API，请勿索引不愿出网的敏感内容。

## 许可

个人项目；可按需自行调整。

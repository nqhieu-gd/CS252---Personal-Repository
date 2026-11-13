## Module 1: Create Agent
- **1.1 Foundational Models:**
  - `init_chat_model()` provides a unified interface to initialize LLMs across providers (OpenAI, Google Gemini, Anthropic) while passing parameters like `temperature`.
  - `.invoke()` sends a prompt or list of messages and returns an `AIMessage` response containing `.content` and usage metadata.
- **1.2 Tools:**
  - Any Python function with type hints and a docstring can be converted into an agent tool using the `@tool` decorator.
  - Passing `tools=[...]` into `create_agent()` binds the tool schemas so the model can decide when to emit `tool_calls` and use the returned `ToolMessage` to answer the user.
- **1.3 Short-Term Memory:**
  - Agents are stateless by default across separate `.invoke()` calls.
  - Passing `checkpointer=InMemorySaver()` (from `langgraph.checkpoint.memory`) to `create_agent()` persists conversation state across turns when invoked with a `configurable={"thread_id": "..."}` config.
- **1.4 Multimodal Messages:**
  - `HumanMessage` supports multimodal content blocks (text, image URLs, base64-encoded images, audio) passed as a list of dictionaries (`type: "text"`, `type: "image"`).
- **Project — Personal Chef:** Combines web search tools (Tavily), system prompts, and short-term memory (`InMemorySaver`) to suggest recipes based on leftover ingredients.

## Module 2: Advanced Agent Patterns & MCP
- **2.1 Model Context Protocol (MCP):**
  - MCP standardizes how AI applications connect to external data sources and tools.
  - Using ` langchain-mcp-adapters` (`MultiServerMCPClient`), LangChain agents can dynamically load tools and resources exposed by external MCP servers over `stdio` or `streamable_http`.
- **2.2 Context & State Management:**
  - Custom state schemas (`AgentState`) and runtime context allow tools and prompts to read/write structured data (like user IDs or session preferences) using `ToolRuntime` and `Command` updates without cluttering the LLM prompt.
- **2.3 Multi-Agent Systems:**
  - Complex workflows can be split across specialized sub-agents orchestrated by a central Supervisor agent (calling sub-agents as tools or routing via handoffs).
- **Project — Wedding Planner:** A multi-agent system coordinating specialized travel, venue, and DJ sub-agents to plan an event within budget.

## Module 3: Middleware, Guardrails & Human-in-the-Loop
- **3.1 Middleware:**
  - LangChain agent middleware intercepts execution before/after model calls (`@before_model`, `@after_model`, `@wrap_model_call`) to manage message history (summarization/trimming) and guardrails.
- **3.2 Dynamic Prompts & Models:**
  - `@dynamic_prompt` and middleware allow modifying the system prompt, active tools, or even switching between lightweight and reasoning models dynamically based on conversation state or token length.
- **3.3 Human-in-the-Loop (HITL):**
  - Sensitive tool calls (like sending emails or executing transactions) can be paused using `HumanInTheLoopMiddleware` / `interrupt`, allowing a human to approve, edit arguments, or reject the action before resuming with `Command(resume=...)`.
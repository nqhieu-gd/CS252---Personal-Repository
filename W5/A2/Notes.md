## Module 1: Introduction to LangGraph
- **Simple Graph & State:** LangGraph models agent workflows as cyclic state machines using `StateGraph`, nodes (Python functions), and edges (`START`, `END`, and conditional edges).
- **Chain, Router & Agent:**
  - **Chains** sequence deterministic LLM and tool steps.
  - **Routers** use `tools_condition` to branch between calling a tool or ending the turn.
  - **ReAct Agents** loop between an LLM node and a `ToolNode` until no further tool calls are requested.
- **Memory & LangGraph Studio:** Adding a checkpointer (`MemorySaver`) persists graph state across turns by `thread_id`, while `langgraph dev` launches LangGraph Studio for visual graph inspection.

## Module 2: State and Memory
- **State Schemas & Reducers:** State can be defined via `TypedDict`, dataclasses, or Pydantic models. Reducer functions (such as `add_messages`) define how node updates merge into existing state keys rather than overwriting them.
- **Multiple Schemas & Filtering:** Private internal schemas can pass intermediate data between nodes without exposing it in the graph's public input/output schema.
- **Message Management & External Memory:** Long conversations are managed by trimming (`trim_messages`), filtering (`RemoveMessage`), or summarizing older turns into a state summary backed by persistent storage like `SqliteSaver`.

## Module 3: UX and Human-in-the-Loop (HITL)
- **Streaming:** `.stream()` and `.astream_events()` expose real-time state updates (`stream_mode="values"` / `"updates"`) and token-by-token LLM output.
- **Breakpoints & Editing State:** `interrupt_before` / `interrupt_after` (and dynamic `NodeInterrupt` breakpoints) pause graph execution so a human can inspect or modify state via `.update_state()` before resuming.
- **Time Travel:** Checkpointer history (`.get_state_history()`) allows replaying or forking execution from any prior checkpoint `checkpoint_id`.

## Module 4: Building Your Assistant (Multi-Agent Patterns)
- **Parallelization & Map-Reduce:** Multiple branches can execute concurrently in a single super-step, and the `Send` API dynamically spawns parallel worker nodes over variable-length lists before reducing results.
- **Sub-Graphs:** Complex agents can encapsulate isolated state inside modular sub-graphs composed into a parent graph.
- **Research Assistant:** Combines human-in-the-loop analyst generation, parallel web/Wikipedia interview sub-graphs, and map-reduce report synthesis.

## Module 5: Long-Term Memory
- **Short-Term vs. Long-Term Memory:** Thread-scoped checkpointers handle short-term conversation history, whereas `BaseStore` (`InMemoryStore`) shares cross-thread memories organized by `(user_id, namespace)` tuples.
- **Memory Schemas:** Structured user profiles (single updated JSON object) and collections (appendable list of facts) can be extracted and updated automatically using `Trustcall`.

## Module 6: Deployment
- **LangGraph Server & SDK:** Graphs configured in `langgraph.json` can be deployed as scalable APIs supporting background runs, double-texting strategies (`reject`, `interrupt`, `rollback`, `enqueue`), and configurable Assistants.
import os
from dotenv import load_dotenv
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

load_dotenv()

# 1. Explicit Planning State (Todo List) & Virtual Filesystem (Context Offloading)
todo_list: list[dict] = []
virtual_fs: dict[str, str] = {}

@tool
def write_todos(tasks: list[str]) -> str:
    """Create or overwrite the explicit step-by-step plan for the current objective."""
    global todo_list
    todo_list = [{"task": t, "status": "pending"} for t in tasks]
    return f"Plan recorded with {len(todo_list)} tasks: {todo_list}"

@tool
def complete_todo(task_index: int) -> str:
    """Mark a task in the todo list as completed by its 0-based index."""
    if 0 <= task_index < len(todo_list):
        todo_list[task_index]["status"] = "completed"
        return f"Updated plan: {todo_list}"
    return "Invalid task index."

@tool
def write_file(filename: str, content: str) -> str:
    """Offload large notes or intermediate findings to a virtual file to keep context clean."""
    virtual_fs[filename] = content
    return f"Saved {len(content)} characters to '{filename}'."

@tool
def read_file(filename: str) -> str:
    """Retrieve offloaded notes from the virtual filesystem."""
    return virtual_fs.get(filename, f"File '{filename}' not found.")

# 2. Initialize Gemini Flash & Build the Engineered Agent Loop
model = ChatGoogleGenerativeAI(model="gemini-3.8-flash", temperature=0)
tools = [write_todos, complete_todo, write_file, read_file]

system_prompt = (
    "You are a Deep Agent engineered for long-horizon tasks. "
    "Always start by calling `write_todos` to plan your steps, offload findings "
    "with `write_file` instead of repeating raw notes, and mark steps complete with `complete_todo`."
)

agent = create_react_agent(model, tools=tools, prompt=system_prompt)

if __name__ == "__main__":
    result = agent.invoke({
        "messages": [("user", "Plan a 2-step study outline for LangGraph and save it to 'outline.md'.")]
    })
    print("Final Response:\n", result["messages"][-1].content)
    print("\nVirtual Filesystem:", virtual_fs)
    print("Final Todo State:", todo_list)
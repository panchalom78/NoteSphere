# NoteSphere MCP Server (Python)

A Model Context Protocol (MCP) server built with **FastMCP** and **SQLite** to manage personal tasks and notes. 

This server exposes tools, resources, and templates that permit an LLM client (such as Claude Desktop or custom agents) to seamlessly inspect and modify a local SQLite-backed notes/tasks database.

## Architecture

- **Engine:** Python 3.14+
- **Framework:** `FastMCP` (from the official `mcp` SDK)
- **Database:** SQLite (`notes.db` automatically initialized inside the server directory)
- **Transport:** Standard Input/Output (`stdio`) JSON-RPC

---

## Exposed Features

### 🛠 Tools
The server exposes the following executable actions:

1. **Notes Management**
   - `create_note(title, content, tags)` - Adds a new note with optional tags.
   - `get_note(note_id)` - Retrieves details of a note by ID.
   - `list_notes()` - Retrieves all saved notes along with metadata.
   - `update_note(note_id, title, content, tags)` - Modifies fields or tags on an existing note.
   - `delete_note(note_id)` - Removes a note from the ledger.
   - `search_notes(query)` - Finds notes matching a keyword in title, text, or tags.

2. **Tasks Management**
   - `create_task(text, due)` - Adds a new task with custom description and due date.
   - `list_tasks()` - Returns all active/completed tasks.
   - `update_task(task_id, text, due, completed)` - Modifies task properties, marking it pending/completed.
   - `delete_task(task_id)` - Removes a task by ID.

### 📄 Resources
Provides direct context paths where the AI can locate lists:
- `notes://list` - Plain text index of all notes.
- `notes://{note_id}` - Contents of notes by specific identifier.
- `tasks://list` - Plain text table of tasks.

### 💬 Prompts
Pre-defined prompt templates to fast-track LLM alignment:
- `summarize_notes(query)` - Tells the model to search and compile a summary of matching or all notes.
- `organize_tasks()` - Directs the model to categorize tasks by due dates and schedule execution order.

---

## Setup & Execution

### 1. Requirements

Ensure Python 3.9+ (Python 3.14 recommended) is installed.

### 2. Install Dependencies

You can configure a virtual environment and install the required `mcp` library:

```bash
# Navigate to the server folder
cd server

# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install mcp package
pip install -r requirements.txt
```

### 3. Run the Server

Start the server using `stdio` transport:

```bash
python server.py
```

### 4. Running/Testing with MCP Inspector

To test the server locally with a graphical interface:

```bash
npx @modelcontextprotocol/inspector uv run server.py
# Or if using standard python in active virtual environment
npx @modelcontextprotocol/inspector python server.py
```
This utility opens a local testing client at `http://localhost:5173` where you can inspect schema shapes, invoke tools directly, and view resources.

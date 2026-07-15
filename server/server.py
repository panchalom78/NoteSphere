import os
import sqlite3
import json
import logging
from datetime import date
from typing import List, Optional
from mcp.server.fastmcp import FastMCP

# Setup logging to sys.stderr so stdio transport is not corrupted
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mcp_server")

# Define base directory and DB path
DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "notes.db")

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Create notes table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create tags table for association
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    )
    """)
    
    # Create tasks table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        due TEXT,
        completed INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Add initial sample notes and tasks if the database is brand new
    cursor.execute("SELECT COUNT(*) FROM notes")
    if cursor.fetchone()[0] == 0:
        logger.info("Initializing database with sample content...")
        
        # Sample notes
        cursor.execute(
            "INSERT INTO notes (title, content) VALUES (?, ?)", 
            ("Gemini Integration Pointers", "Utilize the newer google-genai Python SDK. Map MCP schema types dynamically down into standard Gemini tool declarations.")
        )
        note_id1 = cursor.lastrowid
        for tag in ["mcp", "api", "gemini"]:
            cursor.execute("INSERT INTO tags (note_id, name) VALUES (?, ?)", (note_id1, tag))
            
        cursor.execute(
            "INSERT INTO notes (title, content) VALUES (?, ?)", 
            ("Idea: Local First Workspaces", "Storing database state locally in SQLite avoids security overrides. Connect notes directly into your local CLI shell.")
        )
        note_id2 = cursor.lastrowid
        for tag in ["productivity", "local-first"]:
            cursor.execute("INSERT INTO tags (note_id, name) VALUES (?, ?)", (note_id2, tag))
            
        # Sample tasks
        cursor.execute(
            "INSERT INTO tasks (text, due, completed, status) VALUES (?, ?, ?, ?)",
            ("Buy groceries tomorrow", "Tomorrow", 0, "pending")
        )
        cursor.execute(
            "INSERT INTO tasks (text, due, completed, status) VALUES (?, ?, ?, ?)",
            ("Complete Next.js landing page UI", "Today", 1, "completed")
        )
        cursor.execute(
            "INSERT INTO tasks (text, due, completed, status) VALUES (?, ?, ?, ?)",
            ("Draft MCP server documentation", "July 12, 2026", 0, "pending")
        )
        
    conn.commit()
    conn.close()

# Ensure database is initialized
init_db()

# Create FastMCP server instance
mcp = FastMCP("NotesManager")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

# ----------------- NOTE TOOLS -----------------

@mcp.tool()
def create_note(title: str, content: str, tags: Optional[List[str]] = None) -> str:
    """Create a new note with a title, content, and optional tags list.
    
    Args:
        title: The title of the note.
        content: The text content of the note.
        tags: Optional list of tag strings. E.g. ["mcp", "ideas"].
    """
    logger.info(f"Creating note: {title}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO notes (title, content) VALUES (?, ?)", (title, content))
        note_id = cursor.lastrowid
        
        # Insert tags if provided
        if tags:
            for tag in tags:
                tag_cleaned = tag.strip().lower().replace("#", "")
                if tag_cleaned:
                    cursor.execute("INSERT INTO tags (note_id, name) VALUES (?, ?)", (note_id, tag_cleaned))
        
        conn.commit()
        return f"Successfully created note '{title}' with ID {note_id}."
    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating note: {e}")
        return f"Error: Could not create note due to database error: {e}"
    finally:
        conn.close()

@mcp.tool()
def list_notes(as_json: bool = False) -> str:
    """List all notes with their IDs, titles, previews, and associated tags.
    
    Args:
        as_json: If True, returns notes as a JSON-serialized list of dictionaries.
    """
    logger.info("Listing all notes")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Fetch all notes
        cursor.execute("SELECT id, title, content, created_at, updated_at FROM notes ORDER BY id DESC")
        notes = cursor.fetchall()
        
        if as_json:
            import json
            notes_list = []
            for note in notes:
                cursor.execute("SELECT name FROM tags WHERE note_id = ?", (note["id"],))
                tags = [row["name"] for row in cursor.fetchall()]
                notes_list.append({
                    "id": note["id"],
                    "title": note["title"],
                    "preview": note["content"],
                    "tags": tags,
                    "created_at": note["created_at"],
                    "updated_at": note["updated_at"]
                })
            return json.dumps(notes_list)
            
        if not notes:
            return "No notes found in the database. Use 'create_note' to add one."
            
        result = []
        for note in notes:
            # Fetch tags for each note
            cursor.execute("SELECT name FROM tags WHERE note_id = ?", (note["id"],))
            tags = [row["name"] for row in cursor.fetchall()]
            
            note_str = (
                f"ID: {note['id']}\n"
                f"Title: {note['title']}\n"
                f"Content: {note['content']}\n"
                f"Tags: {', '.join(tags) if tags else 'none'}\n"
                f"Created: {note['created_at']}\n"
                f"----------------------------------------"
            )
            result.append(note_str)
            
        return "\n".join(result)
    except Exception as e:
        logger.error(f"Error listing notes: {e}")
        return f"Error: Could not retrieve notes: {e}"
    finally:
        conn.close()

@mcp.tool()
def get_note(note_id: int) -> str:
    """Retrieve detailed content of a single note by its ID.
    
    Args:
        note_id: The ID of the note to retrieve.
    """
    logger.info(f"Retrieving note with ID: {note_id}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?", (note_id,))
        note = cursor.fetchone()
        
        if not note:
            return f"Note with ID {note_id} not found."
            
        cursor.execute("SELECT name FROM tags WHERE note_id = ?", (note_id,))
        tags = [row["name"] for row in cursor.fetchall()]
        
        return (
            f"ID: {note['id']}\n"
            f"Title: {note['title']}\n"
            f"Content: {note['content']}\n"
            f"Tags: {', '.join(tags) if tags else 'none'}\n"
            f"Created: {note['created_at']}\n"
            f"Updated: {note['updated_at']}"
        )
    except Exception as e:
        logger.error(f"Error retrieving note: {e}")
        return f"Error: Could not retrieve note: {e}"
    finally:
        conn.close()

@mcp.tool()
def update_note(note_id: int, title: Optional[str] = None, content: Optional[str] = None, tags: Optional[List[str]] = None) -> str:
    """Update an existing note's title, content, or tags.
    
    Args:
        note_id: The ID of the note to update.
        title: Optional new title.
        content: Optional new content.
        tags: Optional new list of tags. (Replaces current tags).
    """
    logger.info(f"Updating note with ID: {note_id}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if note exists
        cursor.execute("SELECT id FROM notes WHERE id = ?", (note_id,))
        if not cursor.fetchone():
            return f"Error: Note with ID {note_id} does not exist."
            
        # Update note properties
        updates = []
        params = []
        if title is not None:
            updates.append("title = ?")
            params.append(title)
        if content is not None:
            updates.append("content = ?")
            params.append(content)
            
        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(note_id)
            query = f"UPDATE notes SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(query, params)
            
        # Update tags if specified
        if tags is not None:
            # Delete old tags
            cursor.execute("DELETE FROM tags WHERE note_id = ?", (note_id,))
            # Insert new tags
            for tag in tags:
                tag_cleaned = tag.strip().lower().replace("#", "")
                if tag_cleaned:
                    cursor.execute("INSERT INTO tags (note_id, name) VALUES (?, ?)", (note_id, tag_cleaned))
                    
        conn.commit()
        return f"Successfully updated note with ID {note_id}."
    except Exception as e:
        conn.rollback()
        logger.error(f"Error updating note: {e}")
        return f"Error: Could not update note: {e}"
    finally:
        conn.close()

@mcp.tool()
def delete_note(note_id: int) -> str:
    """Delete a note and its tags from the database by ID.
    
    Args:
        note_id: The ID of the note to delete.
    """
    logger.info(f"Deleting note with ID: {note_id}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT title FROM notes WHERE id = ?", (note_id,))
        note = cursor.fetchone()
        if not note:
            return f"Error: Note with ID {note_id} not found."
            
        title = note["title"]
        # Delete tags (handled by cascade, but good to be explicit or rely on dynamic cascade)
        cursor.execute("DELETE FROM notes WHERE id = ?", (note_id,))
        conn.commit()
        return f"Successfully deleted note '{title}' (ID {note_id})."
    except Exception as e:
        conn.rollback()
        logger.error(f"Error deleting note: {e}")
        return f"Error: Could not delete note: {e}"
    finally:
        conn.close()

@mcp.tool()
def search_notes(query: str) -> str:
    """Search for notes containing a search query string in their titles, contents, or tags.
    
    Args:
        query: Search term to locate.
    """
    logger.info(f"Searching notes for: {query}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        sql = """
        SELECT DISTINCT n.id, n.title, n.content, n.created_at
        FROM notes n
        LEFT JOIN tags t ON n.id = t.note_id
        WHERE n.title LIKE ? OR n.content LIKE ? OR t.name LIKE ?
        ORDER BY n.id DESC
        """
        search_term = f"%{query}%"
        cursor.execute(sql, (search_term, search_term, search_term))
        notes = cursor.fetchall()
        
        if not notes:
            return f"No notes found matching the query: '{query}'"
            
        result = []
        for note in notes:
            cursor.execute("SELECT name FROM tags WHERE note_id = ?", (note["id"],))
            tags = [row["name"] for row in cursor.fetchall()]
            
            note_str = (
                f"ID: {note['id']}\n"
                f"Title: {note['title']}\n"
                f"Content: {note['content']}\n"
                f"Tags: {', '.join(tags) if tags else 'none'}\n"
                f"Created: {note['created_at']}\n"
                f"----------------------------------------"
            )
            result.append(note_str)
            
        return f"Found {len(notes)} matches for '{query}':\n\n" + "\n".join(result)
    except Exception as e:
        logger.error(f"Error searching notes: {e}")
        return f"Error: Could not execute search: {e}"
    finally:
        conn.close()


# ----------------- TASK TOOLS -----------------

@mcp.tool()
def create_task(text: str, due: Optional[str] = "Today") -> str:
    """Create a new task with description and due date.
    
    Args:
        text: Task description/title (e.g. "Draft agenda").
        due: Date or descriptive timeframe when it's due (e.g. "Friday" or "2026-07-12").
    """
    logger.info(f"Creating task: {text}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO tasks (text, due, completed, status) VALUES (?, ?, 0, 'pending')",
            (text, due)
        )
        task_id = cursor.lastrowid
        conn.commit()
        return f"Successfully created task '{text}' (Due: {due}) with ID {task_id}."
    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating task: {e}")
        return f"Error: Could not create task: {e}"
    finally:
        conn.close()

@mcp.tool()
def list_tasks(as_json: bool = False) -> str:
    """List all current tasks with status, due date, and IDs.
    
    Args:
        as_json: If True, returns tasks as a JSON-serialized list of dictionaries.
    """
    logger.info("Listing all tasks")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, text, due, completed, status, created_at FROM tasks ORDER BY completed ASC, id DESC")
        tasks = cursor.fetchall()
        
        if as_json:
            import json
            tasks_list = []
            for task in tasks:
                tasks_list.append({
                    "id": task["id"],
                    "text": task["text"],
                    "due": task["due"],
                    "completed": bool(task["completed"]),
                    "status": task["status"],
                    "created_at": task["created_at"]
                })
            return json.dumps(tasks_list)
            
        if not tasks:
            return "No tasks found. Use 'create_task' to add a new task."
            
        result = []
        for task in tasks:
            status_box = "[x]" if task["completed"] else "[ ]"
            task_str = (
                f"{status_box} ID: {task['id']} | {task['text']}\n"
                f"    Due: {task['due']} | Status: {task['status']}"
            )
            result.append(task_str)
            
        return "\n".join(result)
    except Exception as e:
        logger.error(f"Error listing tasks: {e}")
        return f"Error: Could not retrieve tasks: {e}"
    finally:
        conn.close()

@mcp.tool()
def update_task(task_id: int, text: Optional[str] = None, due: Optional[str] = None, completed: Optional[bool] = None) -> str:
    """Update a task's text description, due date, or completion status.
    
    Args:
        task_id: The ID of the task to update.
        text: Optional new task text.
        due: Optional new due date/text.
        completed: Optional boolean indicating completion status.
    """
    logger.info(f"Updating task: {task_id}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if task exists
        cursor.execute("SELECT id, completed FROM tasks WHERE id = ?", (task_id,))
        task = cursor.fetchone()
        if not task:
            return f"Error: Task with ID {task_id} does not exist."
            
        updates = []
        params = []
        if text is not None:
            updates.append("text = ?")
            params.append(text)
        if due is not None:
            updates.append("due = ?")
            params.append(due)
        if completed is not None:
            updates.append("completed = ?")
            params.append(1 if completed else 0)
            updates.append("status = ?")
            params.append("completed" if completed else "pending")
            
        if not updates:
            return "No updates specified."
            
        params.append(task_id)
        query = f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()
        return f"Successfully updated task with ID {task_id}."
    except Exception as e:
        conn.rollback()
        logger.error(f"Error updating task: {e}")
        return f"Error: Could not update task: {e}"
    finally:
        conn.close()

@mcp.tool()
def delete_task(task_id: int) -> str:
    """Delete a task from the database by ID.
    
    Args:
        task_id: The ID of the task to delete.
    """
    logger.info(f"Deleting task with ID: {task_id}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT text FROM tasks WHERE id = ?", (task_id,))
        task = cursor.fetchone()
        if not task:
            return f"Error: Task with ID {task_id} not found."
            
        text = task["text"]
        cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
        return f"Successfully deleted task '{text}' (ID {task_id})."
    except Exception as e:
        conn.rollback()
        logger.error(f"Error deleting task: {e}")
        return f"Error: Could not delete task: {e}"
    finally:
        conn.close()


# ----------------- DIGEST TOOLS -----------------

@mcp.tool()
def get_daily_digest(as_json: bool = True) -> str:
    """Get a structured digest of what's relevant today: pending tasks (flagging
    which are due today), and notes created or updated today. Intended to be fed
    into an LLM to produce a natural-language "today's summary".

    Args:
        as_json: If True, returns the digest as a JSON-serialized dictionary.
    """
    logger.info("Building daily digest")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        today = date.today()
        today_iso = today.isoformat()
        today_label = f"{today.strftime('%A, %B')} {today.day}"

        cursor.execute(
            "SELECT id, text, due, status FROM tasks WHERE completed = 0 ORDER BY id DESC"
        )
        pending_tasks = [
            {"id": row["id"], "text": row["text"], "due": row["due"], "status": row["status"]}
            for row in cursor.fetchall()
        ]
        tasks_due_today = [t for t in pending_tasks if t["due"] and "today" in t["due"].lower()]

        cursor.execute("SELECT COUNT(*) AS c FROM tasks")
        total_tasks = cursor.fetchone()["c"]

        cursor.execute(
            "SELECT id, title, content, created_at, updated_at FROM notes "
            "WHERE date(created_at) = ? OR date(updated_at) = ? ORDER BY id DESC",
            (today_iso, today_iso),
        )
        notes_today = [
            {
                "id": row["id"],
                "title": row["title"],
                "preview": row["content"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
            for row in cursor.fetchall()
        ]

        cursor.execute("SELECT COUNT(*) AS c FROM notes")
        total_notes = cursor.fetchone()["c"]

        digest = {
            "date": today_iso,
            "date_label": today_label,
            "tasks_due_today": tasks_due_today,
            "tasks_pending": pending_tasks,
            "total_tasks": total_tasks,
            "notes_today": notes_today,
            "total_notes": total_notes,
        }

        if as_json:
            return json.dumps(digest)

        lines = [f"Daily digest for {today_label}:"]
        lines.append(
            f"- {len(tasks_due_today)} task(s) due today, {len(pending_tasks)} pending overall."
        )
        lines.append(f"- {len(notes_today)} note(s) created or updated today, {total_notes} total.")
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Error building daily digest: {e}")
        return f"Error: Could not build daily digest: {e}"
    finally:
        conn.close()


# ----------------- RESOURCES -----------------

@mcp.resource("notes://list")
def get_notes_resource() -> str:
    """Exposes all current notes as a plain text catalog listing."""
    logger.info("Serving notes://list resource")
    return list_notes()

@mcp.resource("notes://{note_id}")
def get_single_note_resource(note_id: int) -> str:
    """Exposes details of a single note dynamically by ID."""
    logger.info(f"Serving notes://{note_id} resource")
    return get_note(note_id)

@mcp.resource("tasks://list")
def get_tasks_resource() -> str:
    """Exposes the active task catalog listing."""
    logger.info("Serving tasks://list resource")
    return list_tasks()


# ----------------- PROMPTS -----------------

@mcp.prompt()
def summarize_notes(query: Optional[str] = None) -> str:
    """Provides a prompt template to summarize relevant notes.
    
    Args:
        query: Optional search query to filter notes before summarizing.
    """
    if query:
        return f"Please search the notes for '{query}' using the available tools, review the matching items, and provide a clear, organized executive summary highlghting key takeaways."
    else:
        return "Please fetch the list of all notes, read their contents, and provide a comprehensive summary of all active projects, pointers, and ideas discussed in them."

@mcp.prompt()
def organize_tasks() -> str:
    """Provides a prompt template to help organize pending tasks."""
    return "Please fetch the list of all tasks. Identify which tasks are pending, categorize them by their due date (e.g. Today, Tomorrow, Future), and propose an optimal sequence of execution to maximize productivity."


# Main entry point
if __name__ == "__main__":
    logger.info("Starting Notes Management MCP Server...")
    mcp.run(transport="stdio")

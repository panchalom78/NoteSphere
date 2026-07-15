import { NextResponse } from "next/server";
import { runMcpTool } from "../mcp-client";

export async function GET() {
    try {
        const response = await runMcpTool("list_notes", { as_json: true });
        // FastMCP tool content structure is like { content: [ { type: 'text', text: '...' } ] }
        const jsonString = response.content?.[0]?.text || "[]";
        let notes = [];
        try {
            notes = JSON.parse(jsonString);
        } catch {
            notes = [];
        }
        return NextResponse.json(notes);
    } catch (error: any) {
        console.error("Error in GET /api/notes:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch notes" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { title, content, tags } = await request.json();
        if (!title || !content) {
            return NextResponse.json({ error: "Missing required fields: title, content" }, { status: 400 });
        }
        const response = await runMcpTool("create_note", { title, content, tags });
        const message = response.content?.[0]?.text || "Note created successfully";
        return NextResponse.json({ message });
    } catch (error: any) {
        console.error("Error in POST /api/notes:", error);
        return NextResponse.json({ error: error.message || "Failed to create note" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { id, title, content, tags } = await request.json();
        if (!id) {
            return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
        }
        const response = await runMcpTool("update_note", {
            note_id: Number(id),
            title: title ?? undefined,
            content: content ?? undefined,
            tags: tags ?? undefined
        });
        const message = response.content?.[0]?.text || "Note updated successfully";
        return NextResponse.json({ message });
    } catch (error: any) {
        console.error("Error in PUT /api/notes:", error);
        return NextResponse.json({ error: error.message || "Failed to update note" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
        }
        const response = await runMcpTool("delete_note", { note_id: Number(id) });
        const message = response.content?.[0]?.text || "Note deleted successfully";
        return NextResponse.json({ message });
    } catch (error: any) {
        console.error("Error in DELETE /api/notes:", error);
        return NextResponse.json({ error: error.message || "Failed to delete note" }, { status: 500 });
    }
}

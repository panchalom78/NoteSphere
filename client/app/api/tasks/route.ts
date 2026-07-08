import { NextResponse } from "next/server";
import { runMcpTool } from "../mcp-client";

export async function GET() {
    try {
        const response = await runMcpTool("list_tasks", { as_json: true });
        const jsonString = response.content?.[0]?.text || "[]";
        let tasks = [];
        try {
            tasks = JSON.parse(jsonString);
        } catch {
            tasks = [];
        }
        return NextResponse.json(tasks);
    } catch (error: any) {
        console.error("Error in GET /api/tasks:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch tasks" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { text, due } = await request.json();
        if (!text) {
            return NextResponse.json({ error: "Missing required field: text" }, { status: 400 });
        }
        const response = await runMcpTool("create_task", { text, due });
        const message = response.content?.[0]?.text || "Task created successfully";
        return NextResponse.json({ message });
    } catch (error: any) {
        console.error("Error in POST /api/tasks:", error);
        return NextResponse.json({ error: error.message || "Failed to create task" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { id, text, due, completed } = await request.json();
        if (!id) {
            return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
        }
        const response = await runMcpTool("update_task", {
            task_id: Number(id),
            text: text ?? undefined,
            due: due ?? undefined,
            completed: completed ?? undefined
        });
        const message = response.content?.[0]?.text || "Task updated successfully";
        return NextResponse.json({ message });
    } catch (error: any) {
        console.error("Error in PUT /api/tasks:", error);
        return NextResponse.json({ error: error.message || "Failed to update task" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
        }
        const response = await runMcpTool("delete_task", { task_id: Number(id) });
        const message = response.content?.[0]?.text || "Task deleted successfully";
        return NextResponse.json({ message });
    } catch (error: any) {
        console.error("Error in DELETE /api/tasks:", error);
        return NextResponse.json({ error: error.message || "Failed to delete task" }, { status: 500 });
    }
}

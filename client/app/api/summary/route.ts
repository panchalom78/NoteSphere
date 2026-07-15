import { NextResponse } from "next/server";
import { runMcpTool } from "../mcp-client";
import { GoogleGenAI } from "@google/genai";

interface DigestTask {
    id: number;
    text: string;
    due: string;
    status: string;
}

interface DigestNote {
    id: number;
    title: string;
    preview: string;
    created_at: string;
    updated_at: string;
}

interface Digest {
    date: string;
    date_label: string;
    tasks_due_today: DigestTask[];
    tasks_pending: DigestTask[];
    total_tasks: number;
    notes_today: DigestNote[];
    total_notes: number;
}

export async function GET() {
    try {
        const digestResponse = await runMcpTool("get_daily_digest", { as_json: true });

        let digest: Digest;
        try {
            digest = JSON.parse(digestResponse.content?.[0]?.text || "{}");
        } catch {
            throw new Error("Malformed digest returned from MCP server");
        }

        const {
            date_label: dateLabel,
            tasks_due_today: tasksDueToday = [],
            tasks_pending: tasksPending = [],
            notes_today: notesToday = [],
            total_notes: totalNotes = 0,
        } = digest;

        const stats = {
            tasksDueToday: tasksDueToday.length,
            tasksPending: tasksPending.length,
            notesToday: notesToday.length,
            totalNotes,
        };

        const apiKey = process.env.GEMINI_API_KEY;

        if (apiKey && (tasksPending.length > 0 || totalNotes > 0)) {
            const ai = new GoogleGenAI({ apiKey });

            const prompt = `Today is ${dateLabel}.

Tasks due today (JSON): ${JSON.stringify(tasksDueToday)}

All pending tasks (JSON): ${JSON.stringify(tasksPending)}

Notes created or updated today (JSON): ${JSON.stringify(notesToday)}

Write a short, friendly 2-4 sentence summary of what's relevant for today: call out tasks due today or still pending, and any notes created or updated today. If nothing is due today, say so briefly. Plain conversational text only, no markdown or bullet points.`;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    systemInstruction:
                        "You are NoteSphere's assistant, generating a concise daily summary of the user's tasks and notes.",
                },
            });

            return NextResponse.json({
                summary: response.text || "No summary available.",
                stats,
                source: "gemini",
                date: dateLabel,
            });
        }

        const parts: string[] = [];
        if (tasksPending.length === 0 && totalNotes === 0) {
            parts.push("Your workspace is empty. Add a task or note to get started.");
        } else {
            parts.push(
                stats.tasksDueToday > 0
                    ? `You have ${stats.tasksDueToday} task${stats.tasksDueToday === 1 ? "" : "s"} due today.`
                    : "Nothing is due today."
            );
            if (stats.tasksPending > 0) {
                parts.push(`${stats.tasksPending} task${stats.tasksPending === 1 ? "" : "s"} still pending overall.`);
            }
            if (stats.notesToday > 0) {
                parts.push(`${stats.notesToday} note${stats.notesToday === 1 ? "" : "s"} touched today.`);
            }
            parts.push(`${stats.totalNotes} note${stats.totalNotes === 1 ? "" : "s"} total in your workspace.`);
        }

        return NextResponse.json({
            summary: parts.join(" "),
            stats,
            source: "fallback",
            date: dateLabel,
        });
    } catch (error: any) {
        console.error("Error in GET /api/summary:", error);
        return NextResponse.json({ error: error.message || "Failed to generate summary" }, { status: 500 });
    }
}

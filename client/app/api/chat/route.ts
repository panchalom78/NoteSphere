import { NextResponse } from "next/server";
import { runMcpTool, listMcpTools } from "../mcp-client";
import { GoogleGenAI } from "@google/genai";

// Endpoint that processes user queries using either Gemini + MCP tools OR a fallback rule-based router
export async function POST(request: Request) {
    try {
        const { query, history } = await request.json();

        if (!query) {
            return NextResponse.json({ error: "Missing query" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        const trace: string[] = ["Request received"];

        if (apiKey) {
            trace.push("Gemini API key detected. Starting LLM Agent session...");

            const ai = new GoogleGenAI({ apiKey });

            // 1. Fetch available tools from MCP server
            trace.push("Connecting to MCP server to fetch capabilities...");
            const mcpTools = await listMcpTools();
            trace.push(`Loaded ${mcpTools.length} tools from MCP server`);

            // 2. Map MCP tools to Gemini function declarations
            const functionDeclarations = mcpTools.map((tool: any) => ({
                name: tool.name,
                description: tool.description || `Execute ${tool.name} command`,
                parameters: {
                    type: "object",
                    properties: tool.inputSchema?.properties || {},
                    required: tool.inputSchema?.required || [],
                },
            }));

            const config: any = {
                tools: [{ functionDeclarations }],
                systemInstruction: "You are NoteSphere, a helpful local productivity assistant. Your task is to help the user manage notes and tasks using the provided tools. Be concise and conversational."
            };

            // Construct history for Gemini. We map typical client chat history to Gemini message structure
            const contents: any[] = [];
            if (history && Array.isArray(history)) {
                for (const msg of history) {
                    contents.push({
                        role: msg.sender === "user" ? "user" : "model",
                        parts: [{ text: msg.text }]
                    });
                }
            }

            // Append current user message
            contents.push({
                role: "user",
                parts: [{ text: query }]
            });

            // 3. Run Agent loop
            let stepCount = 0;
            const maxSteps = 5;
            let finalResponse = "";

            while (stepCount < maxSteps) {
                stepCount++;
                trace.push(`Agent loop step ${stepCount}: Querying Gemini...`);

                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: contents,
                    config: config
                });

                // Add the assistant's message call to history
                const modelParts: any[] = [];
                if (response.text) {
                    modelParts.push({ text: response.text });
                    finalResponse = response.text;
                }

                const functionCalls = response.functionCalls || [];

                if (functionCalls.length > 0) {
                    trace.push(`Gemini requested tool call: ${functionCalls[0].name}`);

                    // Save tool call in response history
                    contents.push({
                        role: "model",
                        parts: [...modelParts, ...functionCalls.map(call => ({
                            functionCall: {
                                name: call.name,
                                args: call.args
                            }
                        }))]
                    });

                    // Execute tool on MCP Server
                    const toolCall = functionCalls[0];
                    if (!toolCall.name) {
                        trace.push("Gemini request tool call contains undefined name. Skipping.");
                        continue;
                    }
                    trace.push(`Executing MCP tool: ${toolCall.name}() with arguments: ${JSON.stringify(toolCall.args)}`);

                    let toolResultText = "";
                    try {
                        const toolResponse = await runMcpTool(toolCall.name, toolCall.args);
                        toolResultText = toolResponse.content?.[0]?.text || "Success";
                        trace.push(`MCP tool output: ${toolResultText.substring(0, 100)}${toolResultText.length > 100 ? '...' : ''}`);
                    } catch (err: any) {
                        toolResultText = `Error: ${err.message || "Failed execution"}`;
                        trace.push(`MCP tool failed: ${toolResultText}`);
                    }

                    // Append tool response back to Gemini
                    contents.push({
                        role: "tool",
                        parts: [{
                            functionResponse: {
                                name: toolCall.name,
                                response: { result: toolResultText }
                            }
                        }]
                    });

                    // Continue loop to let Gemini inspect the output
                } else {
                    // No more tool calls, final text response generated
                    trace.push("Gemini finished reasoning. No more tools needed.");
                    break;
                }
            }

            if (stepCount >= maxSteps) {
                trace.push("Warning: Max agent steps exceeded.");
            }

            return NextResponse.json({
                text: finalResponse || "I’ve completed the request.",
                trace
            });

        } else {
            // 4. Fallback Rule-Based Router (No Gemini API key)
            const lower = query.toLowerCase();
            let responseText = "";

            if (lower.startsWith("add task")) {
                // Extract task description and due date
                // e.g. "add task Buy milk due tomorrow"
                const withoutPrefix = query.substring(8).trim();
                const dueIndex = withoutPrefix.toLowerCase().indexOf("due");
                let taskText = withoutPrefix;
                let dueText = "Today";

                if (dueIndex !== -1) {
                    taskText = withoutPrefix.substring(0, dueIndex).trim();
                    dueText = withoutPrefix.substring(dueIndex + 3).trim();
                }

                trace.push("No LLM key; running fallback task parser");
                trace.push("Calling MCP tool: create_task()");
                const resp = await runMcpTool("create_task", { text: taskText || "Unnamed Task", due: dueText });
                responseText = resp.content?.[0]?.text || `Added task: "${taskText}" due ${dueText}.`;
                trace.push("Task written to SQLite database via MCP.");

            } else if (lower.startsWith("create a note") || lower.startsWith("create note")) {
                // Format: create note Title: Content
                const prefixLength = lower.startsWith("create a note") ? 13 : 11;
                const noteSpec = query.substring(prefixLength).trim();
                const colonIndex = noteSpec.indexOf(":");
                let title = "New Note";
                let content = noteSpec;

                if (colonIndex !== -1) {
                    title = noteSpec.substring(0, colonIndex).trim();
                    content = noteSpec.substring(colonIndex + 1).trim();
                }

                trace.push("No LLM key; running fallback note parser");
                trace.push("Calling MCP tool: create_note()");
                const resp = await runMcpTool("create_note", { title, content, tags: ["created-by-ai"] });
                responseText = resp.content?.[0]?.text || `Created new note: "${title}".`;
                trace.push("Note written to SQLite database via MCP.");

            } else if (lower.includes("search") && (lower.includes("note") || lower.includes("find"))) {
                // e.g. "search notes for gemini" -> extract search term
                const queryWords = query.split(/\s+/);
                const searchIndex = queryWords.findIndex((w: string) => w.toLowerCase() === "search");
                let searchTerm = queryWords[queryWords.length - 1]; // default to last word

                if (searchIndex !== -1 && queryWords[searchIndex + 1]) {
                    const indexNotes = queryWords.findIndex((w: string) => w.toLowerCase() === "notes");
                    const indexFor = queryWords.findIndex((w: string) => w.toLowerCase() === "for");
                    const startExtract = Math.max(searchIndex, indexNotes, indexFor) + 1;
                    if (startExtract < queryWords.length) {
                        searchTerm = queryWords.slice(startExtract).join(" ");
                    }
                }

                trace.push("No LLM key; running fallback note search parser");
                trace.push("Calling MCP tool: search_notes()");
                const resp = await runMcpTool("search_notes", { query: searchTerm });
                responseText = resp.content?.[0]?.text || `Fetched notes matches for "${searchTerm}".`;

            } else if (lower.includes("list notes") || lower.includes("show notes")) {
                trace.push("No LLM key; running fallback list notes parser");
                trace.push("Calling MCP tool: list_notes()");
                const resp = await runMcpTool("list_notes", { as_json: false });
                responseText = resp.content?.[0]?.text || "No notes found.";

            } else if (lower.includes("list tasks") || lower.includes("show tasks") || lower.includes("agenda")) {
                trace.push("No LLM key; running fallback list tasks parser");
                trace.push("Calling MCP tool: list_tasks()");
                const resp = await runMcpTool("list_tasks", { as_json: false });
                responseText = resp.content?.[0]?.text || "No tasks found.";

            } else {
                trace.push("No LLM key; unhandled request trigger");
                trace.push("Scanning tables for targets via MCP list_notes & list_tasks...");
                const notesResp = await runMcpTool("list_notes", { as_json: true });
                const tasksResp = await runMcpTool("list_tasks", { as_json: true });

                const noteCount = JSON.parse(notesResp.content?.[0]?.text || "[]").length;
                const taskCount = JSON.parse(tasksResp.content?.[0]?.text || "[]").length;

                responseText = `I analyzed your query: "${query}". I see you currently have ${noteCount} notes and ${taskCount} tasks in your SQLite workspace database. Ask me to 'add task [Text] due [Date]' or 'create note [Title]: [Content]' to change database items!`;
            }

            return NextResponse.json({
                text: responseText,
                trace
            });
        }

    } catch (error: any) {
        console.error("Error in POST /api/chat:", error);
        return NextResponse.json({ error: error.message || "Failed to process message" }, { status: 500 });
    }
}

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

// Helper to start the stdio server and execute a single tool call
export async function runMcpTool(toolName: string, args: any): Promise<any> {
    const pythonPath = path.resolve(process.cwd(), "../server/.venv/bin/python");
    const serverPath = path.resolve(process.cwd(), "../server/server.py");

    const transport = new StdioClientTransport({
        command: pythonPath,
        args: [serverPath],
    });

    const client = new Client(
        {
            name: "notes-nextjs-client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );

    try {
        await client.connect(transport);
        const response = await client.callTool({
            name: toolName,
            arguments: args,
        });
        return response;
    } catch (error) {
        console.error(`Failed to call MCP tool ${toolName}:`, error);
        throw error;
    } finally {
        try {
            await transport.close();
        } catch (e) {
            // ignore
        }
    }
}

// Helper to read a specific resource from the MCP server
export async function readMcpResource(uri: string) {
    const pythonPath = path.resolve(process.cwd(), "../server/.venv/bin/python");
    const serverPath = path.resolve(process.cwd(), "../server/server.py");

    const transport = new StdioClientTransport({
        command: pythonPath,
        args: [serverPath],
    });

    const client = new Client(
        {
            name: "notes-nextjs-client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );

    try {
        await client.connect(transport);
        const response = await client.readResource({
            uri: uri,
        });
        return response;
    } catch (error) {
        console.error(`Failed to read MCP resource ${uri}:`, error);
        throw error;
    } finally {
        try {
            await transport.close();
        } catch (e) {
            // ignore
        }
    }
}

// Helper to list all tools from the MCP server
export async function listMcpTools() {
    const pythonPath = path.resolve(process.cwd(), "../server/.venv/bin/python");
    const serverPath = path.resolve(process.cwd(), "../server/server.py");

    const transport = new StdioClientTransport({
        command: pythonPath,
        args: [serverPath],
    });

    const client = new Client(
        {
            name: "notes-nextjs-client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );

    try {
        await client.connect(transport);
        const { tools } = await client.listTools();
        return tools;
    } catch (error) {
        console.error("Failed to list MCP tools:", error);
        throw error;
    } finally {
        try {
            await transport.close();
        } catch (e) {
            // ignore
        }
    }
}

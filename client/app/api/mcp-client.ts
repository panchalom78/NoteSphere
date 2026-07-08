import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

// Keep a single persistent connection in memory across backend requests
let globalClient: Client | null = null;
let globalTransport: StdioClientTransport | null = null;
let connectionPromise: Promise<Client> | null = null;

async function getMcpClient(): Promise<Client> {
    // If the client is already connected, return it immediately
    if (globalClient) {
        return globalClient;
    }

    // If a connection is currently being established, wait for it
    if (connectionPromise) {
        return connectionPromise;
    }

    connectionPromise = (async () => {
        console.log("Starting background persistent connection to Python MCP server...");
        const pythonPath = path.resolve(process.cwd(), "../server/.venv/bin/python");
        const serverPath = path.resolve(process.cwd(), "../server/server.py");

        globalTransport = new StdioClientTransport({
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

        await client.connect(globalTransport);
        console.log("Connected to persistent MCP server successfully.");
        globalClient = client;
        return client;
    })();

    try {
        return await connectionPromise;
    } catch (error) {
        // Reset connection state on fail so next request can retry
        connectionPromise = null;
        globalTransport = null;
        globalClient = null;
        throw error;
    }
}

// Clean up child process when Node process exits
if (typeof process !== "undefined") {
    process.on("exit", () => {
        if (globalTransport) {
            try {
                globalTransport.close();
            } catch (e) {
                // ignore cleanup errors
            }
        }
    });
}

// Helper to run a tool, utilizing the persistent child process
export async function runMcpTool(toolName: string, args: any): Promise<any> {
    try {
        const client = await getMcpClient();
        const response = await client.callTool({
            name: toolName,
            arguments: args,
        });
        return response;
    } catch (error) {
        console.error(`Failed calling MCP tool ${toolName}:`, error);
        // Reset connection state on connection failures
        connectionPromise = null;
        globalClient = null;
        globalTransport = null;
        throw error;
    }
}

// Helper to read a resource, utilizing the persistent child process
export async function readMcpResource(uri: string): Promise<any> {
    try {
        const client = await getMcpClient();
        const response = await client.readResource({
            uri: uri,
        });
        return response;
    } catch (error) {
        console.error(`Failed reading MCP resource ${uri}:`, error);
        connectionPromise = null;
        globalClient = null;
        globalTransport = null;
        throw error;
    }
}

// Helper to list all tools from the persistent client
export async function listMcpTools(): Promise<any> {
    try {
        const client = await getMcpClient();
        const { tools } = await client.listTools();
        return tools;
    } catch (error) {
        console.error("Failed listing MCP tools:", error);
        connectionPromise = null;
        globalClient = null;
        globalTransport = null;
        throw error;
    }
}

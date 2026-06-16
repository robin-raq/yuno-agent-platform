import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { AgentsRepo } from '../db/agents';
import type { RunsRepo } from '../db/runs';
import type { ToolContext, ToolDef, ToolRegistry } from '../tools';
import { isActionBlocked } from '../tools/guardrails';

interface McpDeps {
  agents: AgentsRepo;
  registry: ToolRegistry;
  runs: RunsRepo;
}

/** Invoked after every tool call so the route can record it in the run trail. */
type ToolCallSink = (toolName: string, resultText: string, isError: boolean) => void;

/** Build a fresh MCP server exposing only the given tools (per-request, stateless). */
function buildMcpServer(tools: ToolDef[], ctx: ToolContext, onToolCall: ToolCallSink): McpServer {
  const server = new McpServer({ name: 'yuno-tools', version: '1.0.0' });
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (args: Record<string, unknown>) => {
        // Guardrail denylist — enforced before the handler runs, so a blocked action never executes.
        if (isActionBlocked(tool.name, ctx.guardrails)) {
          const text = JSON.stringify({ status: 'blocked', reason: `${tool.name} is blocked by this agent's guardrails` });
          onToolCall(tool.name, text, true);
          return { content: [{ type: 'text' as const, text }], isError: true };
        }
        try {
          const result = await tool.handler(args, ctx);
          const text = JSON.stringify(result);
          onToolCall(tool.name, text, false);
          return { content: [{ type: 'text' as const, text }] };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          const text = JSON.stringify({ error: message });
          onToolCall(tool.name, text, true);
          return { content: [{ type: 'text' as const, text }], isError: true };
        }
      },
    );
  }
  return server;
}

/**
 * Register the per-agent MCP tool endpoint. Goose connects here via
 * `--with-streamable-http-extension http://127.0.0.1:<port>/mcp/<agentId>`.
 * The endpoint exposes ONLY the tools that agent is permitted to call — least privilege
 * enforced by construction. Stateless: a fresh server + transport per request.
 */
export function registerMcpRoutes(app: FastifyInstance, deps: McpDeps): void {
  const handler = async (
    request: FastifyRequest<{ Params: { agentId: string }; Querystring: { runId?: string } }>,
    reply: FastifyReply,
  ) => {
    const agent = deps.agents.get(request.params.agentId);
    if (!agent) {
      reply.code(404).send({ error: 'unknown agent' });
      return;
    }

    const tools = deps.registry.forAgent(agent.tools);
    const ctx: ToolContext = {
      agentId: agent.id,
      runId: request.query.runId,
      guardrails: agent.guardrails,
    };
    // Record each tool call against the run so Run View shows real tool usage.
    // Observability must never break a tool call, so persistence failures are swallowed.
    const onToolCall: ToolCallSink = (toolName, resultText, isError) => {
      if (!ctx.runId) return;
      try {
        deps.runs.addEvent({
          runId: ctx.runId,
          level: isError ? 'warn' : 'info',
          type: 'tool_call',
          message: `${toolName} → ${resultText.slice(0, 200)}`,
        });
      } catch {
        /* event logging is best-effort; never fail the tool call on a persistence error */
      }
    };
    const server = buildMcpServer(tools, ctx, onToolCall);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    reply.raw.on('close', () => void transport.close());

    await server.connect(transport);
    reply.hijack(); // hand the raw socket to the MCP transport; Fastify won't send its own reply
    await transport.handleRequest(request.raw, reply.raw, request.body);
  };

  app.post('/mcp/:agentId', handler);
  app.get('/mcp/:agentId', handler);
  app.delete('/mcp/:agentId', handler);
}

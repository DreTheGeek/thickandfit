// Internal MCP server (JSON-RPC 2.0 over HTTP). Build Profile D: for Stephanie's own automation.
// Every tools/call requires a valid SHA-256 API key; all reads are scoped to that key's company,
// so a key can never cross-tenant read (RLS enforced at the calling-key scope).
import { validateApiKey, bearerFrom } from '@/lib/api/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const SERVER_INFO = { name: 'thickandfit-mcp', version: '1.0.0' };
const PROTOCOL_VERSION = '2025-06-18';

const TOOLS = [
  {
    name: 'get_company',
    description: 'Get the company for the authenticated API key.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_recent_api_usage',
    description: 'List recent API usage for the company (most recent first).',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'max rows (default 20, cap 100)' } },
    },
  },
];

type RpcId = string | number | null;
function rpcResult(id: RpcId, result: unknown): Response {
  return Response.json({ jsonrpc: '2.0', id, result });
}
function rpcError(id: RpcId, code: number, message: string): Response {
  return Response.json({ jsonrpc: '2.0', id, error: { code, message } });
}

export async function POST(req: Request): Promise<Response> {
  // Throttle by IP before any auth/DB work. Both the unauthenticated surface (initialize/tools/list)
  // and the tools/call key check perform DB work, so without a limiter a caller could brute-force API
  // keys or DoS the endpoint a request at a time. 60/min/IP is ample for legitimate automation.
  if (!(await checkRateLimit(`mcp:${await clientIp()}`, 'mcp', 60, 60))) {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32029, message: 'Rate limited' } },
      { status: 429 },
    );
  }

  let body: { id?: RpcId; method?: string; params?: Record<string, unknown> } | null = null;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, 'Parse error');
  }
  const id = body?.id ?? null;
  const method = body?.method;
  const params = body?.params ?? {};

  if (method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  }
  if (method === 'notifications/initialized') {
    return new Response(null, { status: 204 });
  }
  if (method === 'tools/list') {
    return rpcResult(id, { tools: TOOLS });
  }
  if (method === 'tools/call') {
    const ctx = await validateApiKey(bearerFrom(req));
    if (!ctx) return rpcError(id, -32001, 'Unauthorized');

    const supabase = createServiceClient();
    const name = params.name as string | undefined;
    const args = (params.arguments as Record<string, unknown>) ?? {};

    if (name === 'get_company') {
      const { data } = await supabase
        .from('companies')
        .select('id, name, slug')
        .eq('id', ctx.companyId)
        .maybeSingle();
      return rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(data) }] });
    }
    if (name === 'list_recent_api_usage') {
      // Guard against a non-numeric limit ("abc" -> NaN -> .limit(NaN)); clamp to [1, 100].
      const raw = Number(args.limit ?? 20);
      const limit = Number.isFinite(raw) ? Math.min(Math.max(1, Math.trunc(raw)), 100) : 20;
      const { data } = await supabase
        .from('api_usage_log')
        .select('route, method, status_code, latency_ms, created_at')
        .eq('company_id', ctx.companyId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(data ?? []) }] });
    }
    return rpcError(id, -32601, `Unknown tool: ${name}`);
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
}

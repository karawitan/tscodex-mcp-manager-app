/**
 * API Routes - Setup all HTTP endpoints
 */

import { Router, Request, Response } from '../../http/router';
import { ProcessManager } from '../../managers/ProcessManager';
import { PortManager } from '../../managers/PortManager';
import { EventBus } from '../../managers/EventBus';
import { ServerStore } from '../../stores/ServerStore';
import { WorkspaceStore } from '../../stores/WorkspaceStore';
import { SessionStore } from '../../stores/SessionStore';
import { SecretStore } from '../../stores/SecretStore';
import { McpToolsStore } from '../../stores/McpToolsStore';

import { createAuthRoutes } from './auth';
import { createServerRoutes } from './servers';
import { createWorkspaceRoutes } from './workspaces';
import { createSessionRoutes } from './sessions';
import { createInstanceRoutes } from './instances';
import { createSecretRoutes } from './secrets';
import { createMcpToolsRoutes } from './mcp-tools';
import { createAIRoutes } from './ai';
import { createProxyRoutes } from './proxy';
import type { AIAgent } from '../../ai/AIAgent';

export interface RouteContext {
  serverStore: ServerStore;
  workspaceStore: WorkspaceStore;
  sessionStore: SessionStore;
  secretStore: SecretStore;
  mcpToolsStore: McpToolsStore;
  processManager: ProcessManager;
  portManager: PortManager;
  eventBus: EventBus;
  aiAgent: AIAgent;
}

export function setupRoutes(router: Router, ctx: RouteContext): void {
  // Health check
  router.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      sessions: ctx.sessionStore.getCount(),
      servers: ctx.serverStore.getAll().length,
      mcpTools: ctx.mcpToolsStore.getStatus(),
    });
  });

  // Mount API routes
  createAuthRoutes(router, ctx);
  createServerRoutes(router, ctx);
  createWorkspaceRoutes(router, ctx);
  createSessionRoutes(router, ctx);
  createInstanceRoutes(router, ctx);
  createSecretRoutes(router, ctx);
  createMcpToolsRoutes(router, { mcpToolsStore: ctx.mcpToolsStore, eventBus: ctx.eventBus });
  createAIRoutes(router, { aiAgent: ctx.aiAgent, secretStore: ctx.secretStore });
  createProxyRoutes(router);
}

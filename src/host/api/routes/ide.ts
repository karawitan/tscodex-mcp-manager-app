/**
 * IDE Integration Routes - MCP Config Management for Windsurf/VSCode
 */

import { Router, Request, Response } from '../../http/router';
import type { RouteContext } from './index';
import { IDEConfigManager } from '../../../shared/IDEConfigManager';

interface AddServerRequest {
  projectRoot: string;
  serverId: string;
  instancePort?: number;
}

interface RemoveServerRequest {
  projectRoot: string;
  serverName: string;
}

interface SyncRequest {
  projectRoot: string;
}

export function createIDERoutes(router: Router, ctx: RouteContext): void {
  // Detect IDEs in a project
  router.get('/api/ide/detect', async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      const projectRoot = req.query.projectRoot as string;
      
      let resolvedProjectRoot = projectRoot;
      
      // If workspaceId is provided, resolve it to projectRoot
      if (workspaceId && !projectRoot) {
        const workspace = ctx.workspaceStore.get(workspaceId);
        if (workspace) {
          resolvedProjectRoot = workspace.projectRoot;
        } else {
          res.status(404).json({
            success: false,
            error: `Workspace with ID '${workspaceId}' not found`,
          });
          return;
        }
      }
      
      if (!resolvedProjectRoot) {
        res.status(400).json({
          success: false,
          error: 'Either workspaceId or projectRoot must be provided',
        });
        return;
      }

      console.log(`[IDE] Detecting IDEs in: ${resolvedProjectRoot}`);
      const detection = await IDEConfigManager.detectIDE(resolvedProjectRoot);
      
      console.log(`[IDE] Detected IDEs:`, Object.keys(detection));
      res.json({
        success: true,
        detection
      });
    } catch (error) {
      console.error('[IDE] Detection failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Read IDE configs
  router.get('/api/ide/config/:ide', async (req: Request, res: Response) => {
    try {
      const { ide } = req.params;
      const workspaceId = req.query.workspaceId as string;
      const projectRoot = req.query.projectRoot as string;
      
      let resolvedProjectRoot = projectRoot;
      
      // If workspaceId is provided, resolve it to projectRoot
      if (workspaceId && !projectRoot) {
        const workspace = ctx.workspaceStore.get(workspaceId);
        if (workspace) {
          resolvedProjectRoot = workspace.projectRoot;
        } else {
          res.status(404).json({
            success: false,
            error: `Workspace with ID '${workspaceId}' not found`,
          });
          return;
        }
      }
      
      if (!resolvedProjectRoot) {
        res.status(400).json({
          success: false,
          error: 'Either workspaceId or projectRoot must be provided',
        });
        return;
      }

      if (ide !== 'windsurf' && ide !== 'vscode') {
        res.status(400).json({
          success: false,
          error: 'IDE must be "windsurf" or "vscode"',
        });
        return;
      }

      const configPath = ide === 'windsurf' 
        ? `${resolvedProjectRoot}/.windsurf/mcp.config`
        : `${resolvedProjectRoot}/.vscode/mcp.json`;

      const result = ide === 'windsurf'
        ? await IDEConfigManager.readWindsurfConfig(configPath)
        : await IDEConfigManager.readVSCodeConfig(configPath);

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Add server to IDE config
  router.post('/api/ide/config/:ide/add', async (req: Request, res: Response) => {
    try {
      const { ide } = req.params;
      const { projectRoot, serverId, instancePort } = req.body as AddServerRequest;
      
      if (!projectRoot || !serverId) {
        res.status(400).json({
          success: false,
          error: 'projectRoot and serverId are required',
        });
        return;
      }

      if (ide !== 'windsurf' && ide !== 'vscode') {
        res.status(400).json({
          success: false,
          error: 'IDE must be "windsurf" or "vscode"',
        });
        return;
      }

      // Get server from store
      const server = await ctx.serverStore.get(serverId);
      if (!server) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
        });
        return;
      }

      const result = ide === 'windsurf'
        ? await IDEConfigManager.addToWindsurfConfig(projectRoot, server, instancePort)
        : await IDEConfigManager.addToVSCodeConfig(projectRoot, server, instancePort);

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Remove server from IDE config
  router.post('/api/ide/config/:ide/remove', async (req: Request, res: Response) => {
    try {
      const { ide } = req.params;
      const { projectRoot, serverName } = req.body as RemoveServerRequest;
      
      if (!projectRoot || !serverName) {
        res.status(400).json({
          success: false,
          error: 'projectRoot and serverName are required',
        });
        return;
      }

      if (ide !== 'windsurf' && ide !== 'vscode') {
        res.status(400).json({
          success: false,
          error: 'IDE must be "windsurf" or "vscode"',
        });
        return;
      }

      const result = ide === 'windsurf'
        ? await IDEConfigManager.removeFromWindsurfConfig(projectRoot, serverName)
        : await IDEConfigManager.removeFromVSCodeConfig(projectRoot, serverName);

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Sync all servers to IDE configs
  router.post('/api/ide/sync', async (req: Request, res: Response) => {
    try {
      const { projectRoot } = req.body as SyncRequest;
      
      if (!projectRoot) {
        res.status(400).json({
          success: false,
          error: 'projectRoot is required',
        });
        return;
      }

      // Get all servers 
      const servers = ctx.serverStore.getAll();
      // Note: We'll need to add InstanceStore to RouteContext for full functionality
      // For now, sync without running instances
      const instances: Array<{serverId: string; port: number}> = [];

      const results = await IDEConfigManager.syncToIDE(projectRoot, servers, instances);

      res.json({
        success: true,
        results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Import servers from IDE configs
  router.get('/api/ide/import', async (req: Request, res: Response) => {
    try {
      const projectRoot = req.query.projectRoot as string;
      
      if (!projectRoot) {
        res.status(400).json({
          success: false,
          error: 'projectRoot query parameter is required',
        });
        return;
      }

      const results = await IDEConfigManager.importFromIDE(projectRoot);

      res.json({
        success: true,
        results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

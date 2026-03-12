/**
 * MCP Configuration File Parser/Writer for IDEs
 * Supports Windsurf, VSCode, and other IDEs MCP configuration formats
 */

import fs from 'fs/promises';
import path from 'path';
import type { ServerTemplate } from './types';

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface WindsurfMCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

export interface VSCodeMCPConfig {
  servers: Record<string, MCPServerConfig>;
}

export interface ClaudeMCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

export interface IDEConfigResult {
  success: boolean;
  configPath: string;
  config?: WindsurfMCPConfig | VSCodeMCPConfig | ClaudeMCPConfig;
  error?: string;
}

export interface IDEInfo {
  name: string;
  configPath: string;
  version?: string;
  configType: 'mcp' | 'claude' | 'custom';
  icon?: string;
  description?: string;
  installed?: boolean;
}

export class IDEConfigManager {
  /**
   * Detect IDEs in the current project
   */
  async detectIDEs(projectRoot: string): Promise<Record<string, IDEInfo>> {
    const ides: Record<string, IDEInfo> = {};

    // Detect Windsurf
    const windsurfConfig = path.join(projectRoot, '.windsurf', 'mcp.json');
    if (await this.fileExists(windsurfConfig)) {
      ides.windsurf = {
        name: 'Windsurf',
        configPath: windsurfConfig,
        configType: 'mcp',
        installed: true,
      };
    } else {
      ides.windsurf = {
        name: 'Windsurf',
        configPath: windsurfConfig,
        configType: 'mcp',
        installed: false,
      };
    }

    // Detect VS Code
    const vscodeConfig = path.join(projectRoot, '.vscode', 'mcp.json');
    if (await this.fileExists(vscodeConfig)) {
      ides.vscode = {
        name: 'VS Code',
        configPath: vscodeConfig,
        configType: 'mcp',
        installed: true,
      };
    } else {
      ides.vscode = {
        name: 'VS Code',
        configPath: vscodeConfig,
        configType: 'mcp',
        installed: false,
      };
    }

    // Detect Claude Desktop
    const claudeConfig = path.join(process.env.HOME || '', 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    if (await this.fileExists(claudeConfig)) {
      ides.claude = {
        name: 'Claude Desktop',
        configPath: claudeConfig,
        configType: 'claude',
        installed: true,
      };
    }

    return ides;
  }

  /**
   * Read IDE configuration
   */
  async readIDEConfig(ide: string, projectRoot: string): Promise<IDEConfigResult> {
    const ides = await this.detectIDEs(projectRoot);
    const ideInfo = ides[ide];
    
    if (!ideInfo) {
      return {
        success: false,
        configPath: '',
        error: `IDE ${ide} not detected`,
      };
    }

    if (!ideInfo.installed) {
      return {
        success: false,
        configPath: ideInfo.configPath,
        error: `IDE ${ide} configuration not found`,
      };
    }

    try {
      const content = await fs.readFile(ideInfo.configPath, 'utf-8');
      const config = JSON.parse(content);

      return {
        success: true,
        configPath: ideInfo.configPath,
        config,
      };
    } catch (error) {
      return {
        success: false,
        configPath: ideInfo.configPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add server to IDE configuration
   */
  async addServerToIDE(
    ide: string,
    projectRoot: string,
    serverName: string,
    serverConfig: MCPServerConfig
  ): Promise<IDEConfigResult> {
    const ides = await this.detectIDEs(projectRoot);
    const ideInfo = ides[ide];
    
    if (!ideInfo) {
      return {
        success: false,
        configPath: '',
        error: `IDE ${ide} not detected`,
      };
    }

    try {
      // Ensure config directory exists
      await fs.mkdir(path.dirname(ideInfo.configPath), { recursive: true });

      // Read existing config or create new
      let config: WindsurfMCPConfig | VSCodeMCPConfig | ClaudeMCPConfig;
      
      if (await this.fileExists(ideInfo.configPath)) {
        const content = await fs.readFile(ideInfo.configPath, 'utf-8');
        config = JSON.parse(content);
      } else {
        // Create empty config based on IDE type
        if (ide === 'windsurf' || ide === 'claude') {
          config = { mcpServers: {} };
        } else {
          config = { servers: {} };
        }
      }

      // Add server to config
      if (ide === 'windsurf' || ide === 'claude') {
        (config as any).mcpServers[serverName] = serverConfig;
      } else {
        (config as any).servers[serverName] = serverConfig;
      }

      // Write config
      await fs.writeFile(ideInfo.configPath, JSON.stringify(config, null, 2));

      return {
        success: true,
        configPath: ideInfo.configPath,
        config,
      };
    } catch (error) {
      return {
        success: false,
        configPath: ideInfo.configPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove server from IDE configuration
   */
  async removeServerFromIDE(
    ide: string,
    projectRoot: string,
    serverName: string
  ): Promise<IDEConfigResult> {
    const result = await this.readIDEConfig(ide, projectRoot);
    
    if (!result.success || !result.config) {
      return result;
    }

    try {
      const config = result.config;

      // Remove server from config
      if (ide === 'windsurf' || ide === 'claude') {
        delete (config as any).mcpServers[serverName];
      } else {
        delete (config as any).servers[serverName];
      }

      // Write config
      await fs.writeFile(result.configPath, JSON.stringify(config, null, 2));

      return {
        success: true,
        configPath: result.configPath,
        config,
      };
    } catch (error) {
      return {
        success: false,
        configPath: result.configPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * IDE Integration Panel - Detect IDEs and manage MCP config files
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Code,
  FolderOpen,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
  Monitor,
  Cpu,
  Zap,
  Star,
  Globe,
  X,
} from 'lucide-react';
import { getApiBase } from '../../lib/api';

interface IDEInfo {
  name: string;
  configPath: string;
  version?: string;
  configType: 'mcp' | 'claude' | 'custom';
  icon?: string;
  description?: string;
}

interface IDEResult {
  [ideName: string]: IDEInfo;
}

interface IDEConfig {
  servers: Array<{
    name: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
}

interface IDEIntegrationPanelProps {
  workspaceId: string;
}

export function IDEIntegrationPanel({ workspaceId }: IDEIntegrationPanelProps) {
  const [projectRoot, setProjectRoot] = useState('');
  const [detection, setDetection] = useState<IDEResult | null>(null);
  const [configs, setConfigs] = useState<Record<string, IDEConfig>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIDE, setExpandedIDE] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);

  // Escape key handler to cancel operations and prevent stuck UI
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      console.log('[IDE Integration] Escape key pressed, cancelling operations');
      setIsLoading(false);
      setIsCancelled(true);
      setError('Operation cancelled by user');
      
      // Reset cancelled state after a short delay
      setTimeout(() => {
        setIsCancelled(false);
      }, 1000);
    }
  }, []);

  // Add escape key listener
  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [handleEscapeKey]);

  // Fetch workspace information and set project root
  useEffect(() => {
    if (workspaceId) {
      fetchWorkspaceInfo();
    }
  }, [workspaceId]);

  const fetchWorkspaceInfo = async () => {
    try {
      console.log('[IDE Integration] Fetching workspace info for:', workspaceId);
      
      // Handle global workspace - it doesn't have a project root
      if (workspaceId === 'global') {
        console.log('[IDE Integration] Global workspace detected, clearing project root');
        setProjectRoot('');
        setError(null);
        return;
      }
      
      const response = await fetch(`${getApiBase()}/workspaces/${workspaceId}`);
      if (response.ok) {
        const workspace = await response.json();
        console.log('[IDE Integration] Workspace response:', workspace);
        if (workspace.success && workspace.workspace) {
          const root = workspace.workspace.projectRoot;
          console.log('[IDE Integration] Setting project root:', root);
          setProjectRoot(root);
          setError(null);
        } else {
          console.error('[IDE Integration] Invalid workspace response:', workspace);
          setError('Invalid workspace data');
          setProjectRoot('');
        }
      } else {
        console.error('[IDE Integration] Workspace fetch failed:', response.status);
        setError(`Failed to fetch workspace: ${response.status}`);
        setProjectRoot('');
      }
    } catch (error) {
      console.error('[IDE Integration] Failed to fetch workspace info:', error);
      setError('Failed to fetch workspace information');
      // Fallback to empty string if workspace fetch fails
      setProjectRoot('');
    }
  };

  // Detect IDEs when project root changes
  useEffect(() => {
    if (projectRoot.trim()) {
      handleDetectIDEs();
    }
  }, [projectRoot]);

  // Add timeout to prevent infinite loading
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.log('[IDE Integration] Loading timeout, stopping...');
        setIsLoading(false);
        setError('Loading timeout - please try again');
      }, 10000); // 10 second timeout
      
      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  const handleDetectIDEs = async () => {
    if (!projectRoot.trim()) {
      console.log('[IDE Integration] No project root, skipping detection');
      return;
    }

    // Reset cancelled state
    setIsCancelled(false);
    console.log('[IDE Integration] Starting IDE detection for:', projectRoot);
    setIsLoading(true);
    setError(null);
    
    try {
      // Use workspaceId to let backend resolve projectRoot automatically
      const url = `${getApiBase()}/api/ide/detect?workspaceId=${encodeURIComponent(workspaceId)}`;
      console.log('[IDE Integration] Fetching IDEs from:', url);
      
      const response = await fetch(url);
      
      // Check if operation was cancelled
      if (isCancelled) {
        console.log('[IDE Integration] Operation cancelled, stopping');
        return;
      }
      
      const data = await response.json();
      
      // Check if operation was cancelled after response
      if (isCancelled) {
        console.log('[IDE Integration] Operation cancelled after response, stopping');
        return;
      }
      
      console.log('[IDE Integration] IDE detection response:', data);

      if (data.success) {
        console.log('[IDE Integration] IDE detection successful:', Object.keys(data.detection || {}));
        setDetection(data.detection);
        
        // Load configs for detected IDEs (with cancellation check)
        for (const [ideName, ideInfo] of Object.entries(data.detection)) {
          if (isCancelled) {
            console.log('[IDE Integration] Config loading cancelled, stopping');
            break;
          }
          await loadConfig(ideName, ideInfo as IDEInfo);
        }
      } else {
        console.error('[IDE Integration] IDE detection failed:', data.error);
        setError(data.error || 'IDE detection failed');
      }
    } catch (err) {
      if (!isCancelled) {
        console.error('[IDE Integration] IDE detection error:', err);
        setError(err instanceof Error ? err.message : 'Failed to detect IDEs');
      }
    } finally {
      if (!isCancelled) {
        console.log('[IDE Integration] IDE detection completed');
        setIsLoading(false);
      }
    }
  };

  const handleCancel = () => {
    console.log('[IDE Integration] Manual cancel triggered');
    setIsLoading(false);
    setIsCancelled(true);
    setError('Operation cancelled by user');
    
    // Reset cancelled state after a short delay
    setTimeout(() => {
      setIsCancelled(false);
    }, 1000);
  };

  const loadConfig = async (ide: string, ideInfo: IDEInfo) => {
    try {
      console.log(`[IDE Integration] Loading config for ${ide}`);
      // Use workspaceId to let backend resolve projectRoot automatically
      const response = await fetch(`${getApiBase()}/api/ide/config/${ide}?workspaceId=${encodeURIComponent(workspaceId)}`);
      const data = await response.json();

      console.log(`[IDE Integration] Config response for ${ide}:`, data);

      if (data.success) {
        setConfigs(prev => ({ ...prev, [ide]: data.config }));
        console.log(`[IDE Integration] Config loaded for ${ide}`);
      } else {
        console.warn(`[IDE Integration] Failed to load config for ${ide}:`, data.error);
      }
    } catch (err) {
      console.error(`[IDE Integration] Failed to load ${ide} config:`, err);
    }
  };

  const handleSyncServers = async () => {
    if (!projectRoot.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/ide/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectRoot: projectRoot.trim() }),
      });
      const data = await response.json();

      if (data.success) {
        // Reload configs after sync
        if (detection) {
          for (const [ideName, ideInfo] of Object.entries(detection)) {
            await loadConfig(ideName, ideInfo);
          }
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync servers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportServers = async () => {
    if (!projectRoot.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/ide/import?projectRoot=${encodeURIComponent(projectRoot.trim())}`);
      const data = await response.json();

      if (data.success) {
        // Show success message
        console.log('Imported servers:', data.results);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import servers');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleIDEExpanded = (ide: string) => {
    setExpandedIDE(expandedIDE === ide ? null : ide);
  };

  const getIDEIcon = (ide: string) => {
    const iconMap: Record<string, any> = {
      'windsurf': Code,
      'vscode': Monitor,
      'cursor': Cpu,
      'claude': Star,
      'claude-desktop': Star,
      'antigravity': Zap,
      'zedy': Globe,
      'tabnine': Settings,
      'continue': Settings,
      'codeium': Settings,
      'sourcegraph-cody': Settings,
      'copilot': Settings,
    };
    return iconMap[ide] || Settings;
  };

  const getIDEStatus = (ide: string) => {
    if (!detection?.[ide]) return 'not-detected';
    if (configs[ide]) return 'configured';
    return 'detected';
  };

  const getIDEStatusColor = (status: string) => {
    switch (status) {
      case 'configured': return 'text-emerald-400';
      case 'detected': return 'text-yellow-400';
      case 'not-detected': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  const getIDEStatusIcon = (status: string) => {
    switch (status) {
      case 'configured': return CheckCircle;
      case 'detected': return AlertCircle;
      case 'not-detected': return XCircle;
      default: return XCircle;
    }
  };

  return (
    <div className="space-y-6">
      {/* Project Root Input */}
      <div className="card p-4">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          IDE Integration
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Project Root Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={projectRoot}
                onChange={(e) => setProjectRoot(e.target.value)}
                placeholder="/path/to/your/project"
                className="input flex-1 font-mono text-sm"
              />
              <button
                onClick={handleDetectIDEs}
                disabled={!projectRoot.trim() || isLoading}
                className="btn btn-primary"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>
              {isLoading && (
                <button
                  onClick={handleCancel}
                  className="btn btn-secondary"
                  title="Cancel operation (Escape key)"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Enter the path to your project directory to detect IDEs and MCP configurations
            </p>
          </div>

          {/* Action Buttons */}
          {detection && (
            <div className="flex gap-2">
              <button
                onClick={handleSyncServers}
                disabled={isLoading}
                className="btn btn-secondary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Sync Servers to IDE
              </button>
              <button
                onClick={handleImportServers}
                disabled={isLoading}
                className="btn btn-secondary flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import from IDE
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className={`card p-4 border-l-4 ${isCancelled ? 'border-l-yellow-500' : 'border-l-red-500'}`}>
          <div className={`flex items-center gap-2 ${isCancelled ? 'text-yellow-400' : 'text-red-400'}`}>
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
            {isCancelled && (
              <span className="text-xs text-yellow-300 ml-2">
                (Press Escape to cancel anytime)
              </span>
            )}
          </div>
        </div>
      )}

      {/* IDE Detection Results */}
      {detection && (
        <div className="space-y-4">
          {Object.keys(detection).map((ide) => {
            const status = getIDEStatus(ide);
            const Icon = getIDEIcon(ide);
            const StatusIcon = getIDEStatusIcon(status);
            const isExpanded = expandedIDE === ide;
            const config = configs[ide];
            const ideInfo = detection[ide];

            return (
              <div key={ide} className="card p-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleIDEExpanded(ide)}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-gray-400" />
                    <div>
                      <h4 className="font-medium">{ideInfo.description || ide}</h4>
                      <div className="flex items-center gap-2 text-sm">
                        <StatusIcon className={`w-3.5 h-3.5 ${getIDEStatusColor(status)}`} />
                        <span className={`capitalize ${getIDEStatusColor(status)}`}>
                          {status.replace('-', ' ')}
                        </span>
                        {ideInfo.version && (
                          <span className="text-gray-500">
                            v{ideInfo.version}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {status !== 'not-detected' && (
                    <div className="flex items-center gap-2">
                      {config && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Open config file
                          }}
                          className="btn-icon text-gray-400 hover:text-white"
                          title="Open config file"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                      <ChevronRight
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* Config Details */}
                {isExpanded && config && (
                  <div className="mt-4 space-y-3">
                    <div className="text-sm text-gray-400">
                      <span className="font-medium">Config Path:</span>{' '}
                      <code className="text-xs bg-gray-800 px-2 py-1 rounded">
                        {ideInfo.configPath}
                      </code>
                    </div>

                    {config.servers.length > 0 ? (
                      <div>
                        <h5 className="text-sm font-medium text-gray-300 mb-2">
                          MCP Servers ({config.servers.length})
                        </h5>
                        <div className="space-y-2">
                          {config.servers.map((server, index) => (
                            <div
                              key={index}
                              className="bg-gray-800/50 p-3 rounded text-sm"
                            >
                              <div className="font-medium text-gray-300">
                                {server.name}
                              </div>
                              {server.command && (
                                <div className="text-gray-500 font-mono text-xs mt-1">
                                  {server.command}
                                  {server.args?.length && (
                                    <span> {server.args.join(' ')}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        No MCP servers configured
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Instructions */}
      {!detection && (
        <div className="card p-4 border-l-4 border-l-blue-500">
          <h4 className="font-medium text-blue-400 mb-2">How to use IDE Integration</h4>
          <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
            <li>Enter the path to your project directory</li>
            <li>Click "Detect" to find IDEs and MCP configurations</li>
            <li>Sync MCP Manager servers to your IDE config files</li>
            <li>Import existing IDE configurations into MCP Manager</li>
          </ol>
        </div>
      )}
    </div>
  );
}

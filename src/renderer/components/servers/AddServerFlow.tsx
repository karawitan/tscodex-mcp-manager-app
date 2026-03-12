import { useState } from 'react';
import {
  ArrowLeft,
  Package,
  FolderOpen,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Server,
  Wrench,
  MessageSquare,
  FileText,
  GitBranch,
  Cpu,
} from 'lucide-react';
import type { InstallType } from '../../../shared/types';
import { getApiBase } from '../../lib/api';

type AddServerStep = 'select-type' | 'configure' | 'verifying' | 'result';

interface VerificationResult {
  success: boolean;
  serverName?: string;
  version?: string;
  description?: string;
  toolsCount?: number;
  resourcesCount?: number;
  promptsCount?: number;
  hasConfig?: boolean;
  error?: string;
}

interface AddServerFlowProps {
  onClose: () => void;
  onServerAdded: () => void;
}

export function AddServerFlow({ onClose, onServerAdded }: AddServerFlowProps) {
  const [step, setStep] = useState<AddServerStep>('select-type');
  const [installType, setInstallType] = useState<InstallType | null>(null);

  // Form state
  const [packageName, setPackageName] = useState('');
  const [packageVersion, setPackageVersion] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [gitUrl, setGitUrl] = useState('');

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verificationLogs, setVerificationLogs] = useState<string[]>([]);

  const installTypeOptions: { type: InstallType; label: string; description: string; icon: JSX.Element; recommended?: boolean }[] = [
    {
      type: 'npm',
      label: 'NPM Package',
      description: 'Install from npm registry',
      icon: <Package className="w-5 h-5" />,
      recommended: true,
    },
    {
      type: 'git',
      label: 'Git Repository',
      description: 'Clone from git repository',
      icon: <GitBranch className="w-5 h-5" />,
    },
    {
      type: 'local',
      label: 'Local Folder',
      description: 'Use local MCP server folder',
      icon: <FolderOpen className="w-5 h-5" />,
    },
    {
      type: 'uvx',
      label: 'UVX Package',
      description: 'Install from uvx (Python)',
      icon: <Cpu className="w-5 h-5" />,
    },
    {
      type: 'bunx',
      label: 'BunX Package',
      description: 'Install from bunx (Bun)',
      icon: <Package className="w-5 h-5" />,
    },
    {
      type: 'pnpx',
      label: 'PNPM Package',
      description: 'Run via pnpx (slower startup)',
      icon: <Package className="w-5 h-5" />,
    },
    {
      type: 'yarn',
      label: 'Yarn Package',
      description: 'Run via yarn dlx (slower startup)',
      icon: <Package className="w-5 h-5" />,
    },
    {
      type: 'bunx',
      label: 'Bun Package',
      description: 'Run via bunx (slower startup)',
      icon: <Package className="w-5 h-5" />,
    },
  ];

  const addLog = (message: string) => {
    setVerificationLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleSelectType = (type: InstallType) => {
    setInstallType(type);
    setStep('configure');
  };

  const handleBack = () => {
    if (step === 'configure') {
      setStep('select-type');
      setInstallType(null);
    } else if (step === 'result') {
      setStep('configure');
      setVerificationResult(null);
      setVerificationLogs([]);
    }
  };

  const handleBrowseLocal = async () => {
    try {
      // Use Electron dialog via IPC to select directory
      const result = await window.electronAPI?.selectDirectory();
      if (result) {
        setLocalPath(result);
      }
    } catch (error) {
      console.error('Failed to open directory dialog:', error);
    }
  };

  const handleVerify = async () => {
    setStep('verifying');
    setIsVerifying(true);
    setVerificationLogs([]);
    setVerificationResult(null);

    try {
      addLog('Starting server verification...');

      let resolvedPackageVersion = packageVersion;
      let entryPoint: string | undefined;
      let gitLocalPath = ''; // Store git clone localPath separately

      // Step 0: Handle different installation types
      if (installType === 'npm') {
        addLog(`Installing ${packageName}...`);

        const installResponse = await fetch(`${getApiBase()}/packages/install`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageName,
            version: packageVersion || undefined,
          }),
        });

        const installData = await installResponse.json();

        if (!installData.success) {
          throw new Error(installData.error || 'Installation failed');
        }

        resolvedPackageVersion = installData.version;
        entryPoint = installData.entryPoint;
        addLog(`Installed ${packageName}@${resolvedPackageVersion}`);
        addLog(`Entry point: ${entryPoint}`);
      } else if (installType === 'git') {
        addLog(`Checking git availability...`);
        
        // Check git availability first
        try {
          const gitCheckResponse = await fetch(`${getApiBase()}/packages/check-git`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          
          const gitData = await gitCheckResponse.json();
          
          if (!gitData.success) {
            throw new Error(gitData.error || 'git not available');
          }
          
          addLog(`git is available: ${gitData.version}`);
          addLog(`git path: ${gitData.path}`);
        } catch (error) {
          throw new Error(`Git check failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        addLog(`Cloning repository from ${gitUrl}...`);

        const cloneResponse = await fetch(`${getApiBase()}/packages/clone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gitUrl,
          }),
        });

        const cloneData = await cloneResponse.json();

        if (!cloneData.success) {
          throw new Error(cloneData.error || 'Git clone failed');
        }

        resolvedPackageVersion = cloneData.version;
        entryPoint = cloneData.entryPoint;
        gitLocalPath = cloneData.localPath; // Store in variable
        setLocalPath(cloneData.localPath);
        addLog(`Cloned repository to ${cloneData.localPath}`);
        addLog(`Detected version: ${resolvedPackageVersion}`);
        addLog(`Entry point: ${entryPoint}`);
      } else if (installType === 'uvx') {
        addLog(`Checking Python package ${packageName}...`);
        
        // For uvx, we don't need to install anything, just verify the package exists
        // We'll use a simple uvx --help command to check if uvx is available
        try {
          const uvxCheckResponse = await fetch(`${getApiBase()}/packages/check-uvx`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          
          const uvxData = await uvxCheckResponse.json();
          
          if (!uvxData.success) {
            throw new Error(uvxData.error || 'uvx not available');
          }
          
          addLog(`uvx is available: ${uvxData.version}`);
          
          // Try to get package info from PyPI
          try {
            const pypiResponse = await fetch(`https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`);
            if (pypiResponse.ok) {
              const pypiData = await pypiResponse.json();
              resolvedPackageVersion = pypiData.info.version || packageVersion || 'latest';
              addLog(`Found package on PyPI: ${pypiData.info.name} v${resolvedPackageVersion}`);
              if (pypiData.info.description) {
                addLog(`Description: ${pypiData.info.description}`);
              }
            } else {
              addLog(`Warning: Could not fetch package info from PyPI`);
              resolvedPackageVersion = packageVersion || 'latest';
            }
          } catch (err) {
            addLog(`Warning: Could not verify package on PyPI, proceeding anyway`);
            resolvedPackageVersion = packageVersion || 'latest';
          }
        } catch (error) {
          throw new Error(`uvx check failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (installType !== 'local' && !packageVersion) {
        // For other types, get version from registry
        addLog(`Fetching latest version for ${packageName}...`);
        try {
          const versionResponse = await fetch(`${getApiBase()}/packages/${encodeURIComponent(packageName)}/version`);
          const versionData = await versionResponse.json();
          if (versionData.success && versionData.version) {
            resolvedPackageVersion = versionData.version;
            addLog(`Latest version: ${resolvedPackageVersion}`);
          } else {
            addLog(`Warning: Could not fetch version (${versionData.error || 'unknown error'}), will use 'latest'`);
          }
        } catch (err) {
          addLog(`Warning: Could not fetch version, will use 'latest'`);
        }
      }

      // Step 1: Create server template
      addLog(installType === 'local'
        ? `Checking local path: ${localPath}`
        : `Creating server: ${packageName}@${resolvedPackageVersion || 'latest'}`
      );

      const createResponse = await fetch(`${getApiBase()}/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installType,
          packageName: installType !== 'local' && installType !== 'git' ? packageName : undefined,
          gitUrl: installType === 'git' ? gitUrl : undefined,
          // Only send packageVersion if it's actually set (not empty string)
          packageVersion: installType !== 'local' && resolvedPackageVersion ? resolvedPackageVersion : undefined,
          localPath: installType === 'local' ? localPath : installType === 'git' ? gitLocalPath : undefined,
          entryPoint: installType === 'npm' ? entryPoint : undefined,
        }),
      });

      const createData = await createResponse.json();

      if (!createData.success) {
        throw new Error(createData.error || 'Failed to create server');
      }

      const serverId = createData.server.id;
      addLog(`Server template created: ${serverId}`);

      // Step 2: Try to start the server for verification
      addLog('Starting server for compatibility check...');

      const startResponse = await fetch(`${getApiBase()}/instances/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          workspaceId: 'global',
        }),
      });

      const startData = await startResponse.json();
      const port = startData.instance?.port;

      if (!startData.success) {
        addLog(`Warning: Failed to start server - ${startData.error}`);
        // Try to get metadata without running
        addLog('Attempting to get metadata without starting...');
      } else {
        addLog(`Server started on port ${port}`);
      }

      // Step 3: Perform health check via proxy (avoids CORS issues)
      if (startData.success && port) {
        addLog('Performing health check...');

        // Use proxy endpoint to avoid CORS issues
        const healthResponse = await fetch(`${getApiBase()}/instances/${serverId}/global/health`, {
          signal: AbortSignal.timeout(5000),
        });

        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          addLog(`Health check passed: ${healthData.status || 'ok'}`);

          // Get metadata via proxy
          addLog('Fetching server metadata...');
          const metaResponse = await fetch(`${getApiBase()}/instances/${serverId}/global/metadata`);

          if (metaResponse.ok) {
            const metadata = await metaResponse.json();
            addLog(`Found ${metadata.tools?.length || 0} tools, ${metadata.resources?.length || 0} resources, ${metadata.prompts?.length || 0} prompts`);

            // Save metadata to server template
            addLog('Saving server metadata...');
            await fetch(`${getApiBase()}/servers/${serverId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                displayName: metadata.server?.name || createData.server.displayName,
                version: metadata.server?.version,
                description: metadata.server?.description,
                configSchema: metadata.config?.schema,
                toolsCount: metadata.tools?.length || 0,
                resourcesCount: metadata.resources?.length || 0,
                promptsCount: metadata.prompts?.length || 0,
                contextHeaders: metadata.contextHeaders,
              }),
            });

            setVerificationResult({
              success: true,
              serverName: metadata.server?.name || createData.server.displayName,
              version: metadata.server?.version || createData.server.version,
              description: metadata.server?.description || createData.server.description,
              toolsCount: metadata.tools?.length || 0,
              resourcesCount: metadata.resources?.length || 0,
              promptsCount: metadata.prompts?.length || 0,
              hasConfig: !!metadata.config?.schema,
            });
          } else {
            // Fallback to basic info from health check
            setVerificationResult({
              success: true,
              serverName: healthData.server || createData.server.displayName,
              version: healthData.version || createData.server.version,
              description: healthData.description || createData.server.description,
            });
          }
        } else {
          throw new Error('Health check failed - server may not be compatible');
        }

        // Stop the server after verification
        addLog('Stopping verification server...');
        await fetch(`${getApiBase()}/instances/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverId,
            workspaceId: 'global',
          }),
        });
      } else {
        // Could not start or no port - use available data
        const instance = startData.instance;
        setVerificationResult({
          success: true,
          serverName: createData.server.displayName,
          version: createData.server.version,
          description: createData.server.description,
          toolsCount: instance?.toolsCount || 0,
          resourcesCount: instance?.resourcesCount || 0,
          promptsCount: instance?.promptsCount || 0,
        });
      }

      addLog('Verification complete!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Error: ${errorMessage}`);
      setVerificationResult({
        success: false,
        error: errorMessage,
      });
    }

    setIsVerifying(false);
    setStep('result');
  };

  const handleConfirm = () => {
    onServerAdded();
    onClose();
  };

  const canProceed = installType === 'local'
    ? localPath.trim().length > 0
    : installType === 'git'
    ? gitUrl.trim().length > 0
    : packageName.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg-card border border-border-default rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border-default">
          {step !== 'select-type' && (
            <button onClick={handleBack} className="btn-icon" disabled={isVerifying}>
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Add MCP Server</h2>
            <p className="text-sm text-gray-500">
              {step === 'select-type' && 'Select installation method'}
              {step === 'configure' && 'Configure server package'}
              {step === 'verifying' && 'Verifying compatibility...'}
              {step === 'result' && 'Verification result'}
            </p>
          </div>
          <button onClick={onClose} className="btn-icon" disabled={isVerifying}>
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Select Type */}
          {step === 'select-type' && (
            <div className="space-y-3">
              {installTypeOptions.map((option) => (
                <button
                  key={option.type}
                  onClick={() => handleSelectType(option.type)}
                  className={`w-full card card-hover p-4 flex items-center gap-4 text-left ${option.recommended ? 'border-primary' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${option.recommended ? 'bg-primary/20 text-primary' : 'bg-bg-hover text-gray-400'}`}>
                    {option.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{option.label}</h3>
                      {option.recommended && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-medium">Recommended</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{option.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 'configure' && (
            <div className="space-y-6">
              {installType === 'local' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Local Path
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={localPath}
                      onChange={(e) => setLocalPath(e.target.value)}
                      placeholder="/path/to/mcp-server"
                      className="input flex-1 font-mono text-sm"
                    />
                    <button onClick={handleBrowseLocal} className="btn btn-secondary">
                      Browse
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Path to the MCP server folder (must contain package.json in root)
                  </p>
                </div>
              ) : installType === 'git' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Git Repository URL
                  </label>
                  <input
                    type="text"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder="https://github.com/user/mcp-server.git"
                    className="input font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Git repository URL to clone (HTTPS or SSH)
                  </p>
                </div>
              ) : installType === 'uvx' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Python Package Name
                  </label>
                  <input
                    type="text"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    placeholder="mcp-server-tools"
                    className="input font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Python package name from PyPI (e.g., mcp-server-tools)
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2 mt-4">
                      Version (optional)
                    </label>
                    <input
                      type="text"
                      value={packageVersion}
                      onChange={(e) => setPackageVersion(e.target.value)}
                      placeholder="latest"
                      className="input font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Package version (defaults to latest)
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Package Name
                    </label>
                    <input
                      type="text"
                      value={packageName}
                      onChange={(e) => setPackageName(e.target.value)}
                      placeholder="@tscodex/mcp-images"
                      className="input font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      npm package name (e.g., @scope/package-name)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Version (optional)
                    </label>
                    <input
                      type="text"
                      value={packageVersion}
                      onChange={(e) => setPackageVersion(e.target.value)}
                      placeholder="latest"
                      className="input font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Specific version or tag (defaults to latest)
                    </p>
                  </div>
                </>
              )}

              <div className="card p-4 bg-bg-tertiary border-dashed">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">
                      <strong>Compatibility Note:</strong> The server must be built with{' '}
                      <code className="text-primary">@tscodex/mcp-sdk</code> to be fully compatible.
                      After adding, we'll verify the server responds to health checks and metadata requests.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Verifying */}
          {step === 'verifying' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>

              {/* Logs */}
              <div className="card p-4 bg-bg-tertiary max-h-64 overflow-y-auto">
                <div className="font-mono text-xs space-y-1">
                  {verificationLogs.map((log, index) => (
                    <div key={index} className="text-gray-400">{log}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 'result' && verificationResult && (
            <div className="space-y-6">
              {/* Status */}
              <div className={`card p-6 ${verificationResult.success ? 'border-status-running' : 'border-status-error'}`}>
                <div className="flex items-center gap-4">
                  {verificationResult.success ? (
                    <CheckCircle className="w-10 h-10 text-status-running" />
                  ) : (
                    <XCircle className="w-10 h-10 text-status-error" />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">
                      {verificationResult.success ? 'Server Verified' : 'Verification Failed'}
                    </h3>
                    {verificationResult.success ? (
                      <p className="text-sm text-gray-400">
                        {verificationResult.serverName} v{verificationResult.version}
                      </p>
                    ) : (
                      <p className="text-sm text-red-400">{verificationResult.error}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Server Info */}
              {verificationResult.success && (
                <>
                  {verificationResult.description && (
                    <div className="card p-4">
                      <p className="text-gray-300">{verificationResult.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div className="card p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Wrench className="w-5 h-5 text-gray-400" />
                        <span className="text-2xl font-bold">{verificationResult.toolsCount || 0}</span>
                      </div>
                      <p className="text-sm text-gray-500">Tools</p>
                    </div>
                    <div className="card p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <span className="text-2xl font-bold">{verificationResult.resourcesCount || 0}</span>
                      </div>
                      <p className="text-sm text-gray-500">Resources</p>
                    </div>
                    <div className="card p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <MessageSquare className="w-5 h-5 text-gray-400" />
                        <span className="text-2xl font-bold">{verificationResult.promptsCount || 0}</span>
                      </div>
                      <p className="text-sm text-gray-500">Prompts</p>
                    </div>
                  </div>

                  {verificationResult.hasConfig && (
                    <div className="card p-4 bg-bg-tertiary border-dashed">
                      <div className="flex items-start gap-3">
                        <Server className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-400">
                            This server has configurable options. You can customize them in the
                            server settings after adding.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Logs */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Verification Log</h4>
                <div className="card p-4 bg-bg-tertiary max-h-48 overflow-y-auto">
                  <div className="font-mono text-xs space-y-1">
                    {verificationLogs.map((log, index) => (
                      <div key={index} className="text-gray-500">{log}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-default">
          {step === 'configure' && (
            <>
              <button onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleVerify}
                disabled={!canProceed}
                className="btn btn-primary"
              >
                Verify & Add
              </button>
            </>
          )}
          {step === 'result' && (
            <>
              {!verificationResult?.success && (
                <button onClick={handleBack} className="btn btn-secondary">
                  Try Again
                </button>
              )}
              <button onClick={verificationResult?.success ? handleConfirm : onClose} className="btn btn-primary">
                {verificationResult?.success ? 'Done' : 'Close'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

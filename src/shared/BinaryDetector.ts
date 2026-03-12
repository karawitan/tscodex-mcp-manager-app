/**
 * Binary detection utility for cross-platform binary path resolution
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export interface BinaryPaths {
  node: string;
  npm: string;
  npx: string;
  pnpm: string;
  pnpx: string;
  yarn: string;
  bunx: string;
  uvx: string;
  uv: string;
  python: string;
  python3: string;
  pip: string;
  pip3: string;
  git: string;
  curl: string;
  wget: string;
  which: string;
  where: string;
}

const COMMON_BINARY_PATHS = {
  Darwin: [
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/local/sbin',
    '/usr/bin',
    '/usr/sbin',
    '/bin',
    '/sbin',
    '/usr/local/git/bin',
    '/opt/local/bin',
    '/opt/local/sbin',
  ],
  Linux: [
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/local/sbin',
    '/usr/sbin',
    '/sbin',
    '/snap/bin',
    '/usr/local/git/bin',
    '/opt/git/bin',
  ],
  Windows: [
    'C:\\Program Files\\nodejs',
    'C:\\Program Files (x86)\\nodejs',
    'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\nodejs',
    'C:\\Python\\Python39',
    'C:\\Python\\Python310',
    'C:\\Python\\Python311',
    'C:\\Python\\Python312',
    'C:\\Program Files\\Git\\bin',
    'C:\\Program Files (x86)\\Git\\bin',
    'C:\\Program Files\\Git\\cmd',
    'C:\\Program Files (x86)\\Git\\cmd',
  ],
};

/**
 * Get platform-specific common paths
 */
function getCommonPaths(): string[] {
  const platform = process.platform;
  if (platform === 'darwin') return COMMON_BINARY_PATHS.Darwin;
  if (platform === 'linux') return COMMON_BINARY_PATHS.Linux;
  if (platform === 'win32') return COMMON_BINARY_PATHS.Windows;
  return [];
}

/**
 * Check if a binary exists at the given path and resolve symlinks
 */
async function checkBinaryPath(binaryPath: string): Promise<boolean> {
  try {
    // First check if the path exists
    await fs.access(binaryPath);
    
    // Then resolve any symlinks to get the real path
    const realPath = await fs.realpath(binaryPath);
    
    // Check if the real path is executable
    await fs.access(realPath, fs.constants.F_OK);
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate git installation by checking version
 */
async function validateGit(gitPath: string): Promise<boolean> {
  try {
    console.log(`[BinaryDetector] Validating git at: ${gitPath}`);
    const { stdout } = await execAsync(`"${gitPath}" --version`, {
      timeout: 5000,
    });
    const version = stdout.trim();
    console.log(`[BinaryDetector] Git version: ${version}`);
    return version.startsWith('git version');
  } catch (error) {
    console.log(`[BinaryDetector] Git validation failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Enhanced git detection for macOS with multiple fallback methods
 */
async function findGitBinary(): Promise<string | null> {
  console.log('[BinaryDetector] Starting enhanced git detection...');
  
  // Method 1: Try which/which first
  const whichPath = await findBinaryWithWhich('git');
  if (whichPath && await validateGit(whichPath)) {
    console.log(`[BinaryDetector] Found valid git via which: ${whichPath}`);
    return whichPath;
  }
  
  // Method 2: Check common macOS git locations
  const macosGitPaths = [
    '/usr/bin/git',
    '/usr/local/bin/git',
    '/opt/homebrew/bin/git',
    '/opt/local/bin/git',
    '/usr/local/git/bin/git',
    '/Applications/Xcode.app/Contents/Developer/usr/bin/git',
    '/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/git',
  ];
  
  for (const gitPath of macosGitPaths) {
    if (await checkBinaryPath(gitPath) && await validateGit(gitPath)) {
      console.log(`[BinaryDetector] Found valid git at: ${gitPath}`);
      try {
        const realPath = await fs.realpath(gitPath);
        console.log(`[BinaryDetector] Resolved git to: ${realPath}`);
        return realPath;
      } catch {
        return gitPath;
      }
    }
  }
  
  // Method 3: Try xcode-select to find developer tools
  try {
    const { stdout: xcodePath } = await execAsync('xcode-select -p');
    const xcodeGit = `${xcodePath.trim()}/usr/bin/git`;
    if (await checkBinaryPath(xcodeGit) && await validateGit(xcodeGit)) {
      console.log(`[BinaryDetector] Found valid git via xcode-select: ${xcodeGit}`);
      return xcodeGit;
    }
  } catch (error) {
    console.log(`[BinaryDetector] xcode-select failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  console.log('[BinaryDetector] Git not found in any location');
  return null;
}

/**
 * Find binary using 'which' (Unix) or 'where' (Windows) with symlink resolution
 */
async function findBinaryWithWhich(binary: string): Promise<string | null> {
  const whichCommand = process.platform === 'win32' ? 'where' : 'which';
  
  try {
    console.log(`[BinaryDetector] Running: ${whichCommand} ${binary}`);
    const { stdout } = await execAsync(`${whichCommand} ${binary}`);
    const paths = stdout.trim().split('\n');
    const firstPath = paths[0];
    
    console.log(`[BinaryDetector] ${whichCommand} output: ${firstPath}`);
    
    if (!firstPath) return null;
    
    // Resolve symlinks to get the real path
    try {
      const realPath = await fs.realpath(firstPath);
      console.log(`[BinaryDetector] Resolved ${binary} from ${firstPath} to ${realPath}`);
      return realPath;
    } catch (error) {
      console.log(`[BinaryDetector] Failed to resolve ${firstPath}: ${error instanceof Error ? error.message : String(error)}`);
      // If realpath fails, return the original path
      return firstPath;
    }
  } catch (error) {
    console.log(`[BinaryDetector] ${whichCommand} ${binary} failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Find binary by checking common paths with symlink resolution
 */
async function findBinaryInCommonPaths(binary: string): Promise<string | null> {
  const commonBinPaths = getCommonPaths();
  
  for (const basePath of commonBinPaths) {
    // Expand Windows environment variables
    const expandedPath = process.platform === 'win32' 
      ? basePath.replace('%USERNAME%', process.env.USERNAME || 'User')
      : basePath;
    
    const binaryPath = process.platform === 'win32'
      ? `${expandedPath}\\${binary}.exe`
      : `${expandedPath}/${binary}`;
    
    if (await checkBinaryPath(binaryPath)) {
      try {
        // Resolve symlinks to get the real path
        const realPath = await fs.realpath(binaryPath);
        return realPath;
      } catch {
        // If realpath fails, return the original path
        return binaryPath;
      }
    }
  }
  
  return null;
}

/**
 * Get full path to a binary with symlink resolution
 */
async function getBinaryPath(binary: string): Promise<string> {
  // Special handling for git with enhanced detection
  if (binary === 'git') {
    const gitPath = await findGitBinary();
    if (gitPath) {
      return gitPath;
    }
  }
  
  // Try which/where first
  const whichPath = await findBinaryWithWhich(binary);
  if (whichPath) {
    try {
      // Resolve any symlinks to get the real path
      const realPath = await fs.realpath(whichPath);
      return realPath;
    } catch {
      // If realpath fails, return the original path
      return whichPath;
    }
  }
  
  // Try common paths
  const commonPath = await findBinaryInCommonPaths(binary);
  if (commonPath) {
    try {
      // Resolve any symlinks to get the real path
      const realPath = await fs.realpath(commonPath);
      return realPath;
    } catch {
      // If realpath fails, return the original path
      return commonPath;
    }
  }
  
  // Enhanced auto-search: try additional common locations
  console.log(`[BinaryDetector] Starting auto-search for ${binary}`);
  const additionalPaths = [
    `/opt/homebrew/bin/${binary}`,
    `/opt/homebrew/sbin/${binary}`,
    `/usr/local/bin/${binary}`,
    `/usr/bin/${binary}`,
    `/bin/${binary}`,
    `/snap/bin/${binary}`,
  ];
  
  for (const path of additionalPaths) {
    console.log(`[BinaryDetector] Checking path: ${path}`);
    if (await checkBinaryPath(path)) {
      try {
        const realPath = await fs.realpath(path);
        console.log(`[BinaryDetector] Found ${binary} via auto-search: ${realPath}`);
        return realPath;
      } catch {
        console.log(`[BinaryDetector] Found ${binary} via auto-search: ${path}`);
        return path;
      }
    }
  }
  
  // Fallback to binary name (might work if PATH is set correctly)
  console.warn(`[BinaryDetector] Could not find full path for ${binary}, using fallback`);
  return binary;
}

/**
 * Get all binary paths
 */
export async function getAllBinaryPaths(): Promise<BinaryPaths> {
  const binaries = [
    'node', 'npm', 'npx', 'pnpm', 'pnpx', 'yarn', 'bunx', 'uvx', 'uv',
    'python', 'python3', 'pip', 'pip3',
    'git', 'curl', 'wget', 'which', 'where'
  ];
  
  const paths = await Promise.all(binaries.map(getBinaryPath));
  
  const result: BinaryPaths = {
    node: paths[0],
    npm: paths[1],
    npx: paths[2],
    pnpm: paths[3],
    pnpx: paths[4],
    yarn: paths[5],
    bunx: paths[6],
    uvx: paths[7],
    uv: paths[8],
    python: paths[9],
    python3: paths[10],
    pip: paths[11],
    pip3: paths[12],
    git: paths[13],
    curl: paths[14],
    wget: paths[15],
    which: paths[16],
    where: paths[17],
  };
  
  // Special handling for pnpx (usually same as pnpm)
  if (!result.pnpx || result.pnpx === 'pnpx') {
    result.pnpx = result.pnpm || 'pnpm';
  }
  
  return result;
}

/**
 * Get enhanced PATH environment variable
 */
export function getEnhancedPath(): string {
  const commonBinPaths = getCommonPaths();
  const currentPath = process.env.PATH || '';
  
  // Add common paths to PATH if not already present
  const additionalPaths = commonBinPaths.filter(path => !currentPath.includes(path));
  
  return [...additionalPaths, currentPath].join(process.platform === 'win32' ? ';' : ':');
}

/**
 * Get enhanced environment with proper PATH and binary-specific paths
 */
export function getEnhancedEnv(binaryPaths: Partial<BinaryPaths> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  
  // Copy existing environment variables, filtering out undefined values
  Object.entries(process.env).forEach(([key, value]) => {
    if (value !== undefined) {
      env[key] = value;
    }
  });
  
  // Set enhanced PATH
  env.PATH = getEnhancedPath();
  
  // On macOS/Linux, ensure npm can find node by adding node's directory to PATH
  if (binaryPaths.node && process.platform !== 'win32') {
    const nodeDir = binaryPaths.node.substring(0, binaryPaths.node.lastIndexOf('/'));
    if (!env.PATH.includes(nodeDir)) {
      env.PATH = `${nodeDir}:${env.PATH}`;
    }
  }
  
  return env;
}

/**
 * Cache for binary paths
 */
let binaryPathsCache: BinaryPaths | null = null;

/**
 * Get cached binary paths or fetch them if not cached
 */
export async function getCachedBinaryPaths(): Promise<BinaryPaths> {
  if (!binaryPathsCache) {
    binaryPathsCache = await getAllBinaryPaths();
  }
  return binaryPathsCache;
}

/**
 * Refresh binary paths cache
 */
export async function refreshBinaryPaths(): Promise<BinaryPaths> {
  console.log('[BinaryDetector] Refreshing binary paths cache...');
  binaryPathsCache = await getAllBinaryPaths();
  return binaryPathsCache;
}

/**
 * Clear binary paths cache
 */
export function clearBinaryPathsCache(): void {
  binaryPathsCache = null;
}

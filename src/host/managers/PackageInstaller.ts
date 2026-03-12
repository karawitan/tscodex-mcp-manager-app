/**
 * PackageInstaller - Installs npm packages to local app directory
 * Similar to how Cursor, Claude Desktop install MCP servers
 */

import { app } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { getCachedBinaryPaths, getEnhancedEnv } from '../../shared/BinaryDetector';

const execAsync = promisify(exec);

export interface InstallResult {
  success: boolean;
  packagePath: string;
  entryPoint: string;
  version: string;
  error?: string;
}

export class PackageInstaller {
  private packagesDir: string;

  constructor() {
    const userDataPath = app?.getPath?.('userData') || process.cwd();
    this.packagesDir = path.join(userDataPath, 'packages');
  }

  /**
   * Get the packages directory path
   */
  getPackagesDir(): string {
    return this.packagesDir;
  }

  /**
   * Get the installation path for a package
   */
  getPackagePath(packageName: string): string {
    // Handle scoped packages: @scope/name -> @scope/name
    return path.join(this.packagesDir, packageName);
  }

  /**
   * Check if a package is already installed
   */
  async isInstalled(packageName: string): Promise<boolean> {
    const pkgPath = this.getPackagePath(packageName);
    const nodeModulesPath = path.join(pkgPath, 'node_modules', packageName);

    try {
      await fs.access(path.join(nodeModulesPath, 'package.json'));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get installed version of a package
   */
  async getInstalledVersion(packageName: string): Promise<string | null> {
    const pkgPath = this.getPackagePath(packageName);
    const packageJsonPath = path.join(pkgPath, 'node_modules', packageName, 'package.json');

    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      return pkg.version || null;
    } catch {
      return null;
    }
  }

  /**
   * Install a package using npm
   */
  async install(packageName: string, version?: string): Promise<InstallResult> {
    const pkgPath = this.getPackagePath(packageName);
    const pkgSpec = version ? `${packageName}@${version}` : packageName;

    console.log(`[PackageInstaller] Installing ${pkgSpec} to ${pkgPath}`);

    try {
      // Create package directory
      await fs.mkdir(pkgPath, { recursive: true });

      // Create minimal package.json if not exists
      const packageJsonPath = path.join(pkgPath, 'package.json');
      try {
        await fs.access(packageJsonPath);
      } catch {
        await fs.writeFile(packageJsonPath, JSON.stringify({
          name: `mcp-server-${packageName.replace(/[@/]/g, '-')}`,
          version: '1.0.0',
          private: true,
        }, null, 2));
      }

      // Run npm install with full path and enhanced environment
      const binaryPaths = await getCachedBinaryPaths();
      const { stdout, stderr } = await execAsync(`${binaryPaths.npm} install ${pkgSpec} --save`, {
        cwd: pkgPath,
        timeout: 120000, // 2 minutes timeout
        env: getEnhancedEnv(binaryPaths)
      });

      console.log(`[PackageInstaller] npm install stdout:`, stdout);
      if (stderr) {
        console.log(`[PackageInstaller] npm install stderr:`, stderr);
      }

      // Find the entry point
      const entryPoint = await this.findEntryPoint(packageName, pkgPath);

      // Get installed version
      const installedVersion = await this.getInstalledVersion(packageName);

      console.log(`[PackageInstaller] Installed ${packageName}@${installedVersion} at ${entryPoint}`);

      return {
        success: true,
        packagePath: pkgPath,
        entryPoint,
        version: installedVersion || version || 'unknown',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[PackageInstaller] Failed to install ${pkgSpec}:`, errorMessage);

      return {
        success: false,
        packagePath: pkgPath,
        entryPoint: '',
        version: '',
        error: errorMessage,
      };
    }
  }

  /**
   * Update a package to a specific version
   */
  async update(packageName: string, version: string): Promise<InstallResult> {
    return this.install(packageName, version);
  }

  /**
   * Uninstall a package
   */
  async uninstall(packageName: string): Promise<boolean> {
    const pkgPath = this.getPackagePath(packageName);

    try {
      await fs.rm(pkgPath, { recursive: true, force: true });
      console.log(`[PackageInstaller] Uninstalled ${packageName}`);
      return true;
    } catch (error) {
      console.error(`[PackageInstaller] Failed to uninstall ${packageName}:`, error);
      return false;
    }
  }

  /**
   * Find the entry point for a package
   */
  private async findEntryPoint(packageName: string, installPath: string): Promise<string> {
    const nodeModulesPath = path.join(installPath, 'node_modules', packageName);
    const packageJsonPath = path.join(nodeModulesPath, 'package.json');

    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      // Check for bin entry first (CLI tools)
      if (pkg.bin) {
        const binPath = typeof pkg.bin === 'string'
          ? pkg.bin
          : Object.values(pkg.bin)[0] as string;
        if (binPath) {
          return path.join(nodeModulesPath, binPath);
        }
      }

      // Then check main entry
      if (pkg.main) {
        return path.join(nodeModulesPath, pkg.main);
      }

      // Default to index.js
      return path.join(nodeModulesPath, 'index.js');
    } catch (error) {
      console.error(`[PackageInstaller] Error finding entry point for ${packageName}:`, error);
      // Fallback
      return path.join(nodeModulesPath, 'dist', 'index.js');
    }
  }

  /**
   * Get entry point for already installed package
   */
  async getEntryPoint(packageName: string): Promise<string | null> {
    const pkgPath = this.getPackagePath(packageName);

    if (!await this.isInstalled(packageName)) {
      return null;
    }

    return this.findEntryPoint(packageName, pkgPath);
  }
}

// Singleton instance
let installerInstance: PackageInstaller | null = null;

export function getPackageInstaller(): PackageInstaller {
  if (!installerInstance) {
    installerInstance = new PackageInstaller();
  }
  return installerInstance;
}

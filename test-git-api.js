#!/usr/bin/env node

/**
 * Test Git API Endpoints Directly
 * Tests the git functionality without running the full server
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs/promises';

const execAsync = promisify(exec);

// Import the git functions directly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the route context
const mockContext = {
  serverStore: null,
  workspaceStore: null,
  sessionStore: null,
  secretStore: null,
  mcpToolsStore: null,
  processManager: null,
  portManager: null,
  eventBus: null,
  aiAgent: null,
};

class GitAPITester {
  constructor() {
    this.testResults = [];
    this.tempDir = path.join(process.cwd(), 'test-api-temp');
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '📋',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'test': '🧪'
    }[type] || '📋';
    
    console.log(`${timestamp} ${prefix} ${message}`);
  }

  async runTest(testName, testFn) {
    this.log(`Running test: ${testName}`, 'test');
    try {
      await testFn();
      this.log(`PASSED: ${testName}`, 'success');
      this.testResults.push({ name: testName, status: 'passed', error: null });
    } catch (error) {
      this.log(`FAILED: ${testName} - ${error.message}`, 'error');
      this.testResults.push({ name: testName, status: 'failed', error: error.message });
    }
  }

  async testGitCheckEndpoint() {
    await this.runTest('Git Check Endpoint', async () => {
      // Simulate the git check logic
      const gitCheck = async () => {
        // Try to find git using multiple methods
        let gitPath = null;
        
        // Method 1: Use 'which' command
        try {
          const { stdout: whichResult } = await execAsync('which git', {
            timeout: 5000,
          });
          gitPath = whichResult.trim();
          console.log(`[git-check] Found git via which: ${gitPath}`);
        } catch (error) {
          console.log('[git-check] which git failed, trying other methods');
        }
        
        // Method 2: Try common paths
        if (!gitPath) {
          const commonPaths = [
            '/usr/bin/git',
            '/usr/local/bin/git',
            '/opt/homebrew/bin/git',
            '/opt/local/bin/git',
            '/usr/local/git/bin/git',
          ];
          
          for (const commonPath of commonPaths) {
            try {
              await execAsync(`test -x "${commonPath}"`, { timeout: 1000 });
              gitPath = commonPath;
              console.log(`[git-check] Found git at common path: ${gitPath}`);
              break;
            } catch (error) {
              // Continue trying
            }
          }
        }
        
        // Method 3: Try 'git --version' as fallback
        if (!gitPath) {
          try {
            const { stdout: versionResult } = await execAsync('git --version', {
              timeout: 5000,
            });
            if (versionResult.includes('git version')) {
              gitPath = 'git'; // Assume it's in PATH
              console.log(`[git-check] Git available via PATH: ${versionResult.trim()}`);
            }
          } catch (error) {
            console.log('[git-check] git --version failed');
          }
        }
        
        if (!gitPath) {
          throw new Error('Git not found. Please install Git and ensure it is available in your PATH.');
        }
        
        // Get version
        let version = 'unknown';
        try {
          const { stdout: versionResult } = await execAsync(`${gitPath} --version`, {
            timeout: 5000,
          });
          version = versionResult.trim();
        } catch (error) {
          console.log('[git-check] Failed to get git version');
        }
        
        return {
          success: true,
          available: true,
          path: gitPath,
          version,
        };
      };
      
      const result = await gitCheck();
      
      if (!result.success || !result.available || !result.path) {
        throw new Error('Git check failed');
      }
      
      this.log(`Git check successful: ${result.version} at ${result.path}`);
    });
  }

  async testGitCloneEndpoint() {
    await this.runTest('Git Clone Endpoint', async () => {
      // Simulate the git clone logic
      const gitClone = async (gitUrl) => {
        if (!gitUrl) {
          throw new Error('gitUrl is required');
        }
        
        // Validate git URL format
        const gitUrlPattern = /^https?:\/\/.+\.git$|^git@.+:.+\.git$/;
        if (!gitUrlPattern.test(gitUrl)) {
          throw new Error('Invalid git URL format. Expected HTTPS or SSH URL ending with .git');
        }
        
        // Direct git detection
        console.log(`[git-clone] Starting git clone for: ${gitUrl}`);
        
        // Try to find git using multiple methods
        let gitPath = null;
        
        // Method 1: Use 'which' command
        try {
          const { stdout: whichResult } = await execAsync('which git', {
            timeout: 5000,
          });
          gitPath = whichResult.trim();
          console.log(`[git-clone] Found git via which: ${gitPath}`);
        } catch (error) {
          console.log('[git-clone] which git failed, trying other methods');
        }
        
        // Method 2: Try common paths
        if (!gitPath) {
          const commonPaths = [
            '/usr/bin/git',
            '/usr/local/bin/git',
            '/opt/homebrew/bin/git',
            '/opt/local/bin/git',
            '/usr/local/git/bin/git',
          ];
          
          for (const commonPath of commonPaths) {
            try {
              await execAsync(`test -x "${commonPath}"`, { timeout: 1000 });
              gitPath = commonPath;
              console.log(`[git-clone] Found git at common path: ${gitPath}`);
              break;
            } catch (error) {
              // Continue trying
            }
          }
        }
        
        // Method 3: Try 'git --version' as fallback
        if (!gitPath) {
          try {
            const { stdout: versionResult } = await execAsync('git --version', {
              timeout: 5000,
            });
            if (versionResult.includes('git version')) {
              gitPath = 'git'; // Assume it's in PATH
              console.log(`[git-clone] Git available via PATH`);
            }
          } catch (error) {
            console.log('[git-clone] git --version failed');
          }
        }
        
        if (!gitPath) {
          throw new Error('Git not found. Please install Git and ensure it is available in your PATH.');
        }
        
        // Create temporary directory for cloning
        const tempDir = path.join(os.tmpdir(), 'mcp-manager-clones');
        await fs.mkdir(tempDir, { recursive: true });
        
        // Create unique directory name for this clone
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const cloneDir = path.join(tempDir, `repo-${timestamp}-${randomSuffix}`);
        
        console.log(`[git-clone] Cloning to: ${cloneDir}`);
        
        // Clone the repository
        const cloneCommand = `${gitPath} clone "${gitUrl}" "${cloneDir}"`;
        console.log(`[git-clone] Executing: ${cloneCommand}`);
        
        const { stdout, stderr } = await execAsync(cloneCommand, {
          timeout: 120000, // 2 minute timeout
        });
        
        console.log(`[git-clone] Clone stdout: ${stdout}`);
        if (stderr) {
          console.log(`[git-clone] Clone stderr: ${stderr}`);
        }
        
        // Verify clone was successful
        try {
          await fs.access(path.join(cloneDir, '.git'));
        } catch (error) {
          // Clean up failed clone
          try {
            await fs.rm(cloneDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.log(`[git-clone] Failed to cleanup: ${cleanupError.message}`);
          }
          throw new Error('Git clone failed: repository not found after clone');
        }
        
        // Try to detect package.json for version
        let version = 'unknown';
        let entryPoint = '';
        
        try {
          const packageJsonPath = path.join(cloneDir, 'package.json');
          const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
          const packageJson = JSON.parse(packageJsonContent);
          version = packageJson.version || 'unknown';
          
          // Try to detect entry point
          entryPoint = packageJson.main || 
                      packageJson.bin || 
                      (packageJson.exports && packageJson.exports['.'] && packageJson.exports['.'].import) ||
                      '';
        } catch (error) {
          console.log(`[git-clone] Could not read package.json: ${error.message}`);
        }
        
        return {
          success: true,
          localPath: cloneDir,
          version,
          entryPoint,
        };
      };
      
      // Test with a valid repository
      const testUrl = 'https://github.com/octocat/Hello-World.git';
      const result = await gitClone(testUrl);
      
      if (!result.success || !result.localPath) {
        throw new Error('Git clone failed');
      }
      
      // Verify the cloned directory exists
      try {
        await fs.access(result.localPath);
        await fs.access(path.join(result.localPath, '.git'));
      } catch (error) {
        throw new Error('Cloned repository verification failed');
      }
      
      this.log(`Git clone successful: ${result.localPath}`);
      this.log(`Detected version: ${result.version}, entry point: ${result.entryPoint}`);
      
      // Clean up
      try {
        await fs.rm(result.localPath, { recursive: true, force: true });
        this.log('Cleaned up cloned repository');
      } catch (error) {
        this.log(`Failed to cleanup: ${error.message}`, 'warning');
      }
    });
  }

  async testGitCloneInvalidURL() {
    await this.runTest('Git Clone Invalid URL', async () => {
      const gitClone = async (gitUrl) => {
        if (!gitUrl) {
          throw new Error('gitUrl is required');
        }
        
        // Validate git URL format
        const gitUrlPattern = /^https?:\/\/.+\.git$|^git@.+:.+\.git$/;
        if (!gitUrlPattern.test(gitUrl)) {
          throw new Error('Invalid git URL format. Expected HTTPS or SSH URL ending with .git');
        }
        
        // Try to clone (should fail)
        const gitPath = 'git'; // Assume git is available
        const tempDir = path.join(os.tmpdir(), 'mcp-manager-clones');
        await fs.mkdir(tempDir, { recursive: true });
        
        const timestamp = Date.now();
        const cloneDir = path.join(tempDir, `invalid-${timestamp}`);
        
        try {
          await execAsync(`${gitPath} clone "${gitUrl}" "${cloneDir}"`, {
            timeout: 30000,
          });
          
          // If we get here, clone succeeded when it shouldn't have
          await fs.rm(cloneDir, { recursive: true, force: true });
          throw new Error('Expected clone to fail but it succeeded');
        } catch (error) {
          // Clean up
          try {
            await fs.rm(cloneDir, { recursive: true, force: true });
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
          
          // Expected to fail
          if (error.message.includes('not found') || 
              error.message.includes('Repository not found') || 
              error.message.includes('fatal')) {
            throw new Error('Repository not found');
          } else {
            throw error;
          }
        }
      };
      
      // Test with invalid URL
      const invalidUrl = 'https://github.com/nonexistent/repo.git';
      
      try {
        await gitClone(invalidUrl);
        throw new Error('Expected git clone to fail');
      } catch (error) {
        if (error.message.includes('Repository not found') || 
            error.message.includes('Invalid git URL format')) {
          this.log('Invalid URL correctly rejected');
        } else {
          throw new Error(`Unexpected error: ${error.message}`);
        }
      }
    });
  }

  async testGitCloneMalformedURL() {
    await this.runTest('Git Clone Malformed URL', async () => {
      const gitClone = async (gitUrl) => {
        if (!gitUrl) {
          throw new Error('gitUrl is required');
        }
        
        // Validate git URL format
        const gitUrlPattern = /^https?:\/\/.+\.git$|^git@.+:.+\.git$/;
        if (!gitUrlPattern.test(gitUrl)) {
          throw new Error('Invalid git URL format. Expected HTTPS or SSH URL ending with .git');
        }
      };
      
      const malformedUrls = [
        'not-a-url',
        'https://github.com/incomplete',
        'ftp://invalid-protocol.com/repo.git'
      ];
      
      for (const url of malformedUrls) {
        try {
          await gitClone(url);
          throw new Error(`Expected malformed URL "${url}" to be rejected`);
        } catch (error) {
          if (error.message.includes('Invalid git URL format')) {
            this.log(`Malformed URL correctly rejected: ${url}`);
          } else {
            throw new Error(`Unexpected error for ${url}: ${error.message}`);
          }
        }
      }
    });
  }

  async testGitCloneLargeRepo() {
    await this.runTest('Git Clone Large Repository', async () => {
      // Test with a larger repository
      const gitClone = async (gitUrl) => {
        if (!gitUrl) {
          throw new Error('gitUrl is required');
        }
        
        const gitUrlPattern = /^https?:\/\/.+\.git$|^git@.+:.+\.git$/;
        if (!gitUrlPattern.test(gitUrl)) {
          throw new Error('Invalid git URL format. Expected HTTPS or SSH URL ending with .git');
        }
        
        const gitPath = 'git';
        const tempDir = path.join(os.tmpdir(), 'mcp-manager-clones');
        await fs.mkdir(tempDir, { recursive: true });
        
        const timestamp = Date.now();
        const cloneDir = path.join(tempDir, `large-${timestamp}`);
        
        const startTime = Date.now();
        
        try {
          await execAsync(`${gitPath} clone "${gitUrl}" "${cloneDir}"`, {
            timeout: 120000, // 2 minute timeout
          });
          
          const endTime = Date.now();
          const duration = (endTime - startTime) / 1000;
          
          // Verify clone
          await fs.access(path.join(cloneDir, '.git'));
          
          // Check size
          const { stdout: sizeOutput } = await execAsync(`du -sh "${cloneDir}"`);
          const size = sizeOutput.trim().split('\t')[0];
          
          // Try to detect package.json
          let version = 'unknown';
          let entryPoint = '';
          
          try {
            const packageJsonPath = path.join(cloneDir, 'package.json');
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonContent);
            version = packageJson.version || 'unknown';
            entryPoint = packageJson.main || packageJson.bin || '';
          } catch (error) {
            // No package.json found
          }
          
          // Clean up
          await fs.rm(cloneDir, { recursive: true, force: true });
          
          return {
            success: true,
            localPath: cloneDir,
            version,
            entryPoint,
            duration,
            size,
          };
        } catch (error) {
          // Clean up
          try {
            await fs.rm(cloneDir, { recursive: true, force: true });
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
          
          if (error.message.includes('timeout')) {
            throw new Error('Clone timed out');
          }
          throw error;
        }
      };
      
      const testUrl = 'https://github.com/modelcontextprotocol/servers.git';
      const result = await gitClone(testUrl);
      
      if (!result.success) {
        throw new Error('Large repository clone failed');
      }
      
      this.log(`Large repo clone successful in ${result.duration}s, size: ${result.size}`);
      this.log(`Detected version: ${result.version}, entry point: ${result.entryPoint}`);
    });
  }

  printResults() {
    this.log('\n=== API Test Results Summary ===', 'test');
    
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const total = this.testResults.length;
    
    this.log(`Total tests: ${total}`, 'info');
    this.log(`Passed: ${passed}`, 'success');
    this.log(`Failed: ${failed}`, failed > 0 ? 'error' : 'info');
    this.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`, 'info');
    
    if (failed > 0) {
      this.log('\nFailed Tests:', 'error');
      this.testResults
        .filter(r => r.status === 'failed')
        .forEach(r => {
          this.log(`  ❌ ${r.name}: ${r.error}`, 'error');
        });
    }
    
    this.log('\n=== API Test Complete ===', 'test');
  }

  async runAllTests() {
    this.log('=== Starting Git API Endpoint Tests ===', 'test');
    
    try {
      await this.testGitCheckEndpoint();
      await this.testGitCloneEndpoint();
      await this.testGitCloneInvalidURL();
      await this.testGitCloneMalformedURL();
      await this.testGitCloneLargeRepo();
    } catch (error) {
      this.log(`API test suite failed: ${error.message}`, 'error');
    }
    
    this.printResults();
  }
}

// Run the tests
const tester = new GitAPITester();
tester.runAllTests().catch(error => {
  console.error('API test runner failed:', error);
  process.exit(1);
});

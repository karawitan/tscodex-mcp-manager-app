#!/usr/bin/env node

/**
 * Complete Git Feature Integration Test
 * Tests the entire git workflow from UI to backend
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

class GitIntegrationTester {
  constructor() {
    this.testResults = [];
    this.serverProcess = null;
    this.apiBase = 'http://localhost:4040';
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '📋',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'test': '🧪',
      'server': '🖥️',
      'api': '🌐'
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

  async startMCPManager() {
    await this.runTest('Start MCP Manager Server', async () => {
      this.log('Starting MCP Manager server...', 'server');
      
      // Start the server in background
      const { spawn } = await import('child_process');
      
      this.serverProcess = spawn('npm', ['run', 'dev'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
      });
      
      // Wait for server to be ready
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds
      
      while (attempts < maxAttempts) {
        try {
          const response = await fetch(`${this.apiBase}/api/health`, {
            signal: AbortSignal.timeout(2000)
          });
          
          if (response.ok) {
            const health = await response.json();
            this.log(`Server is healthy: ${health.status}`, 'success');
            return;
          }
        } catch (error) {
          // Server not ready yet
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        if (attempts % 5 === 0) {
          this.log(`Waiting for server... (${attempts}/${maxAttempts})`, 'info');
        }
      }
      
      throw new Error('Server failed to start within 30 seconds');
    });
  }

  async testGitCheckAPI() {
    await this.runTest('Git Check API Endpoint', async () => {
      this.log('Testing git check API...', 'api');
      
      const response = await fetch(`${this.apiBase}/api/packages/check-git`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Git check failed');
      }
      
      if (!data.available) {
        throw new Error('Git not available');
      }
      
      if (!data.path) {
        throw new Error('Git path not returned');
      }
      
      if (!data.version) {
        throw new Error('Git version not returned');
      }
      
      this.log(`Git check successful: ${data.version} at ${data.path}`);
    });
  }

  async testGitCloneAPI() {
    await this.runTest('Git Clone API Endpoint', async () => {
      this.log('Testing git clone API...', 'api');
      
      const testUrl = 'https://github.com/octocat/Hello-World.git';
      
      const response = await fetch(`${this.apiBase}/api/packages/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gitUrl: testUrl }),
        signal: AbortSignal.timeout(60000) // 1 minute timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Git clone failed');
      }
      
      if (!data.localPath) {
        throw new Error('Local path not returned');
      }
      
      // Verify the cloned directory exists
      try {
        await fs.access(data.localPath);
        await fs.access(path.join(data.localPath, '.git'));
      } catch (error) {
        throw new Error('Cloned repository verification failed');
      }
      
      this.log(`Git clone successful: ${data.localPath}`);
      this.log(`Detected version: ${data.version || 'unknown'}, entry point: ${data.entryPoint || 'none'}`);
      
      // Store for cleanup
      this.clonedPath = data.localPath;
    });
  }

  async testGitCloneInvalidURL() {
    await this.runTest('Git Clone Invalid URL API', async () => {
      this.log('Testing git clone with invalid URL...', 'api');
      
      const invalidUrl = 'https://github.com/nonexistent/repo.git';
      
      const response = await fetch(`${this.apiBase}/api/packages/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gitUrl: invalidUrl }),
        signal: AbortSignal.timeout(30000)
      });
      
      const data = await response.json();
      
      if (data.success) {
        throw new Error('Expected clone to fail but it succeeded');
      }
      
      if (!data.error) {
        throw new Error('Error message not provided');
      }
      
      this.log(`Invalid URL correctly rejected: ${data.error}`);
    });
  }

  async testGitCloneMalformedURL() {
    await this.runTest('Git Clone Malformed URL API', async () => {
      this.log('Testing git clone with malformed URLs...', 'api');
      
      const malformedUrls = [
        'not-a-url',
        'https://github.com/incomplete',
        'ftp://invalid-protocol.com/repo.git'
      ];
      
      for (const url of malformedUrls) {
        const response = await fetch(`${this.apiBase}/api/packages/clone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gitUrl: url }),
          signal: AbortSignal.timeout(10000)
        });
        
        const data = await response.json();
        
        if (data.success) {
          throw new Error(`Expected malformed URL "${url}" to be rejected`);
        }
        
        if (!data.error.includes('Invalid git URL format')) {
          throw new Error(`Expected format error for "${url}" but got: ${data.error}`);
        }
        
        this.log(`Malformed URL correctly rejected: ${url}`);
      }
    });
  }

  async testServerCreationWithGit() {
    await this.runTest('Server Creation with Git Clone', async () => {
      this.log('Testing server creation with git clone...', 'api');
      
      // First clone a repository
      const testUrl = 'https://github.com/modelcontextprotocol/servers.git';
      
      const cloneResponse = await fetch(`${this.apiBase}/api/packages/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gitUrl: testUrl }),
        signal: AbortSignal.timeout(120000) // 2 minute timeout
      });
      
      const cloneData = await cloneResponse.json();
      
      if (!cloneData.success) {
        throw new Error(`Clone failed: ${cloneData.error}`);
      }
      
      this.log(`Cloned MCP servers repository: ${cloneData.localPath}`);
      
      // Now create a server with the cloned repository
      const serverResponse = await fetch(`${this.apiBase}/api/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installType: 'git',
          gitUrl: testUrl,
          localPath: cloneData.localPath,
          packageVersion: cloneData.version,
          entryPoint: cloneData.entryPoint
        }),
        signal: AbortSignal.timeout(10000)
      });
      
      const serverData = await serverResponse.json();
      
      if (!serverData.success) {
        throw new Error(`Server creation failed: ${serverData.error}`);
      }
      
      if (!serverData.server) {
        throw new Error('Server data not returned');
      }
      
      if (!serverData.server.id) {
        throw new Error('Server ID not returned');
      }
      
      this.log(`Server created successfully: ${serverData.server.id}`);
      this.log(`Server name: ${serverData.server.name || 'unnamed'}`);
      
      // Store for cleanup
      this.createdServerId = serverData.server.id;
      this.gitServerPath = cloneData.localPath;
    });
  }

  async testServerStartWithGit() {
    await this.runTest('Server Start with Git Clone', async () => {
      if (!this.createdServerId) {
        throw new Error('No server available for testing');
      }
      
      this.log('Testing server start with git clone...', 'api');
      
      const startResponse = await fetch(`${this.apiBase}/api/instances/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: this.createdServerId,
          workspaceId: 'global'
        }),
        signal: AbortSignal.timeout(30000)
      });
      
      const startData = await startResponse.json();
      
      if (!startData.success) {
        throw new Error(`Server start failed: ${startData.error}`);
      }
      
      if (!startData.instance) {
        throw new Error('Instance data not returned');
      }
      
      this.log(`Server started successfully: ${startData.instance.id}`);
      this.log(`Server port: ${startData.instance.port}`);
      this.log(`Server PID: ${startData.instance.pid}`);
      
      // Store for cleanup
      this.startedInstanceId = startData.instance.id;
      
      // Wait a moment for the server to fully start
      await new Promise(resolve => setTimeout(resolve, 2000));
    });
  }

  async cleanup() {
    await this.runTest('Cleanup Test Environment', async () => {
      this.log('Cleaning up test environment...', 'info');
      
      // Stop server if it was started
      if (this.startedInstanceId && this.createdServerId) {
        try {
          const stopResponse = await fetch(`${this.apiBase}/api/instances/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serverId: this.createdServerId,
              workspaceId: 'global'
            }),
            signal: AbortSignal.timeout(10000)
          });
          
          if (stopResponse.ok) {
            this.log('Server stopped successfully');
          }
        } catch (error) {
          this.log(`Failed to stop server: ${error.message}`, 'warning');
        }
      }
      
      // Delete created server
      if (this.createdServerId) {
        try {
          const deleteResponse = await fetch(`${this.apiBase}/api/servers/${this.createdServerId}`, {
            method: 'DELETE',
            signal: AbortSignal.timeout(10000)
          });
          
          if (deleteResponse.ok) {
            this.log('Server deleted successfully');
          }
        } catch (error) {
          this.log(`Failed to delete server: ${error.message}`, 'warning');
        }
      }
      
      // Clean up cloned repositories
      const pathsToClean = [this.clonedPath, this.gitServerPath].filter(Boolean);
      
      for (const cleanPath of pathsToClean) {
        try {
          await fs.rm(cleanPath, { recursive: true, force: true });
          this.log(`Cleaned up cloned repository: ${cleanPath}`);
        } catch (error) {
          this.log(`Failed to cleanup ${cleanPath}: ${error.message}`, 'warning');
        }
      }
    });
  }

  async stopMCPManager() {
    await this.runTest('Stop MCP Manager Server', async () => {
      if (this.serverProcess) {
        this.log('Stopping MCP Manager server...', 'server');
        
        // Try graceful shutdown first
        this.serverProcess.kill('SIGTERM');
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Force kill if still running
        try {
          this.serverProcess.kill('SIGKILL');
        } catch (error) {
          // Process already dead
        }
        
        this.log('Server stopped');
      }
    });
  }

  printResults() {
    this.log('\n=== Integration Test Results Summary ===', 'test');
    
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
    
    this.log('\n=== Integration Test Complete ===', 'test');
  }

  async runAllTests() {
    this.log('=== Starting Complete Git Feature Integration Tests ===', 'test');
    
    try {
      // Start the server
      await this.startMCPManager();
      
      // Test git functionality
      await this.testGitCheckAPI();
      await this.testGitCloneAPI();
      await this.testGitCloneInvalidURL();
      await this.testGitCloneMalformedURL();
      
      // Test integration with server creation
      await this.testServerCreationWithGit();
      await this.testServerStartWithGit();
      
    } catch (error) {
      this.log(`Integration test suite failed: ${error.message}`, 'error');
    } finally {
      // Always cleanup
      await this.cleanup();
      await this.stopMCPManager();
    }
    
    this.printResults();
  }
}

// Run the tests
const tester = new GitIntegrationTester();
tester.runAllTests().catch(error => {
  console.error('Integration test runner failed:', error);
  process.exit(1);
});

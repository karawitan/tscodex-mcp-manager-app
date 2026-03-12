#!/usr/bin/env node

/**
 * Rigorous Git Feature Test
 * Tests git functionality without requiring running server
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

class GitFeatureTester {
  constructor() {
    this.testResults = [];
    this.tempDir = path.join(process.cwd(), 'test-git-temp');
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

  async testGitAvailability() {
    await this.runTest('Git Availability Check', async () => {
      const { stdout } = await execAsync('which git', { timeout: 5000 });
      if (!stdout.trim()) {
        throw new Error('Git not found in PATH');
      }
      this.log(`Git found at: ${stdout.trim()}`);
    });
  }

  async testGitVersion() {
    await this.runTest('Git Version Check', async () => {
      const { stdout } = await execAsync('git --version', { timeout: 5000 });
      if (!stdout.includes('git version')) {
        throw new Error('Git version command failed');
      }
      this.log(`Git version: ${stdout.trim()}`);
    });
  }

  async testGitConfig() {
    await this.runTest('Git Configuration Check', async () => {
      try {
        const { stdout: user } = await execAsync('git config user.name', { timeout: 5000 });
        const { stdout: email } = await execAsync('git config user.email', { timeout: 5000 });
        this.log(`Git user: ${user.trim()}, email: ${email.trim()}`);
      } catch (error) {
        this.log('Git user config not set, but proceeding with tests', 'warning');
      }
    });
  }

  async setupTempDirectory() {
    await this.runTest('Temporary Directory Setup', async () => {
      // Clean up any existing temp directory
      if (existsSync(this.tempDir)) {
        rmSync(this.tempDir, { recursive: true, force: true });
      }
      
      // Create new temp directory
      mkdirSync(this.tempDir, { recursive: true });
      this.log(`Created temp directory: ${this.tempDir}`);
    });
  }

  async testGitClone() {
    await this.runTest('Git Clone Test', async () => {
      const testUrl = 'https://github.com/octocat/Hello-World.git';
      const cloneDir = path.join(this.tempDir, 'hello-world');
      
      this.log(`Cloning ${testUrl} to ${cloneDir}`);
      
      const { stdout, stderr } = await execAsync(`git clone "${testUrl}" "${cloneDir}"`, {
        timeout: 30000,
        cwd: this.tempDir
      });
      
      if (!existsSync(path.join(cloneDir, '.git'))) {
        throw new Error('Clone failed - .git directory not found');
      }
      
      this.log(`Clone successful. Output: ${stdout.trim()}`);
      if (stderr.trim()) {
        this.log(`Clone warnings: ${stderr.trim()}`, 'warning');
      }
    });
  }

  async testGitCloneInvalidUrl() {
    await this.runTest('Git Clone Invalid URL Test', async () => {
      const invalidUrl = 'https://github.com/nonexistent/repo.git';
      const cloneDir = path.join(this.tempDir, 'invalid-test');
      
      try {
        await execAsync(`git clone "${invalidUrl}" "${cloneDir}"`, {
          timeout: 10000,
          cwd: this.tempDir
        });
        throw new Error('Expected clone to fail but it succeeded');
      } catch (error) {
        if (error.message.includes('not found') || error.message.includes('Repository not found') || error.message.includes('fatal')) {
          this.log('Invalid URL correctly rejected', 'success');
        } else {
          throw new Error(`Unexpected error: ${error.message}`);
        }
      }
    });
  }

  async testGitCloneMalformedUrl() {
    await this.runTest('Git Clone Malformed URL Test', async () => {
      const malformedUrls = [
        'not-a-url',
        'https://github.com/incomplete',
        'ftp://invalid-protocol.com/repo.git'
      ];
      
      for (const url of malformedUrls) {
        try {
          const cloneDir = path.join(this.tempDir, `malformed-${Date.now()}`);
          await execAsync(`git clone "${url}" "${cloneDir}"`, {
            timeout: 5000,
            cwd: this.tempDir
          });
          throw new Error(`Expected malformed URL "${url}" to fail but it succeeded`);
        } catch (error) {
          if (error.message.includes('fatal') || error.message.includes('invalid') || error.message.includes('protocol')) {
            this.log(`Malformed URL correctly rejected: ${url}`, 'success');
          } else {
            throw new Error(`Unexpected error for ${url}: ${error.message}`);
          }
        }
      }
    });
  }

  async testGitCloneLargeRepo() {
    await this.runTest('Git Clone Large Repository Test', async () => {
      const largeRepoUrl = 'https://github.com/modelcontextprotocol/servers.git';
      const cloneDir = path.join(this.tempDir, 'mcp-servers');
      
      this.log(`Testing clone of larger repository: ${largeRepoUrl}`);
      
      const startTime = Date.now();
      
      try {
        const { stdout, stderr } = await execAsync(`git clone "${largeRepoUrl}" "${cloneDir}"`, {
          timeout: 60000, // 1 minute timeout
          cwd: this.tempDir
        });
        
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        if (!existsSync(path.join(cloneDir, '.git'))) {
          throw new Error('Clone failed - .git directory not found');
        }
        
        this.log(`Large repo clone successful in ${duration}s`);
        
        // Check if it's a reasonable size
        const { stdout: sizeOutput } = await execAsync(`du -sh "${cloneDir}"`, {
          cwd: this.tempDir
        });
        this.log(`Repository size: ${sizeOutput.trim().split('\t')[0]}`);
        
      } catch (error) {
        if (error.message.includes('timeout')) {
          throw new Error('Clone timed out - repository too large or network slow');
        }
        throw error;
      }
    });
  }

  async testGitCloneDepth() {
    await this.runTest('Git Clone Shallow Clone Test', async () => {
      const testUrl = 'https://github.com/octocat/Hello-World.git';
      const cloneDir = path.join(this.tempDir, 'hello-world-shallow');
      
      this.log(`Testing shallow clone (depth=1) of ${testUrl}`);
      
      const { stdout } = await execAsync(`git clone --depth 1 "${testUrl}" "${cloneDir}"`, {
        timeout: 30000,
        cwd: this.tempDir
      });
      
      if (!existsSync(path.join(cloneDir, '.git'))) {
        throw new Error('Shallow clone failed - .git directory not found');
      }
      
      // Verify it's actually shallow
      const { stdout: logOutput } = await execAsync('git log --oneline', {
        cwd: cloneDir
      });
      
      const commitCount = logOutput.trim().split('\n').length;
      if (commitCount > 5) { // Allow some flexibility
        throw new Error(`Expected shallow clone but got ${commitCount} commits`);
      }
      
      this.log(`Shallow clone successful with ${commitCount} commits`);
    });
  }

  async testGitPermissions() {
    await this.runTest('Git Repository Permissions Test', async () => {
      const cloneDir = path.join(this.tempDir, 'hello-world');
      
      if (!existsSync(cloneDir)) {
        throw new Error('Test repository not found - run clone test first');
      }
      
      // Test if we can read the repository
      const { stdout } = await execAsync('ls -la', {
        cwd: cloneDir
      });
      
      if (!stdout.includes('.git')) {
        throw new Error('Cannot read .git directory - permissions issue');
      }
      
      // Test if we can write to the repository
      const testFile = path.join(cloneDir, 'test-permissions.txt');
      await execAsync(`touch "${testFile}"`, {
        cwd: cloneDir
      });
      
      // Clean up test file
      await execAsync(`rm "${testFile}"`, {
        cwd: cloneDir
      });
      
      this.log('Repository permissions are correct');
    });
  }

  async cleanup() {
    await this.runTest('Cleanup Test Environment', async () => {
      if (existsSync(this.tempDir)) {
        rmSync(this.tempDir, { recursive: true, force: true });
        this.log('Cleaned up temporary directory');
      }
    });
  }

  async runAllTests() {
    this.log('=== Starting Rigorous Git Feature Tests ===', 'test');
    
    try {
      // Basic git functionality
      await this.testGitAvailability();
      await this.testGitVersion();
      await this.testGitConfig();
      
      // Setup
      await this.setupTempDirectory();
      
      // Clone functionality tests
      await this.testGitClone();
      await this.testGitCloneInvalidUrl();
      await this.testGitCloneMalformedUrl();
      await this.testGitCloneDepth();
      
      // Performance and size tests
      await this.testGitCloneLargeRepo();
      
      // Permissions test
      await this.testGitPermissions();
      
    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
    } finally {
      // Always cleanup
      await this.cleanup();
    }
    
    // Print results
    this.printResults();
  }

  printResults() {
    this.log('\n=== Test Results Summary ===', 'test');
    
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
    
    this.log('\n=== Test Complete ===', 'test');
  }
}

// Run the tests
const tester = new GitFeatureTester();
tester.runAllTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});

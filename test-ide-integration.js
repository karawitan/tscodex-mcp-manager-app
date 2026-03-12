#!/usr/bin/env node

/**
 * IDE Integration Panel Test Script
 * Tests IDE detection, configuration management, and synchronization
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class IDEIntegrationTester {
  constructor() {
    this.testResults = [];
    this.baseURL = 'http://localhost:4040';
    this.testProjectRoot = process.cwd(); // Use current directory as test project
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '📋',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'test': '🧪',
      'ide': '💻'
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

  async testIDEDetection() {
    await this.runTest('IDE Detection API', async () => {
      const response = await fetch(`${this.baseURL}/api/ide/detect?workspaceId=test&projectRoot=${encodeURIComponent(this.testProjectRoot)}`);
      
      if (!response.ok) {
        throw new Error(`IDE detection API failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(`IDE detection failed: ${data.error}`);
      }
      
      this.log('✅ IDE detection successful');
      this.log(`✅ Found ${Object.keys(data.ides || {}).length} IDEs`);
      
      // Verify structure
      for (const [ideName, ideInfo] of Object.entries(data.ides || {})) {
        if (!ideInfo.name || !ideInfo.configPath) {
          throw new Error(`Invalid IDE info for ${ideName}`);
        }
        this.log(`✅ ${ideName}: ${ideInfo.name} at ${ideInfo.configPath}`);
        
        // Test specific IDEs
        if (ideName === 'windsurf') {
          this.log('✅ Windsurf IDE detected');
        } else if (ideName === 'vscode') {
          this.log('✅ VS Code IDE detected');
        } else if (ideName === 'opencode') {
          this.log('✅ OpenCode IDE detected');
        } else if (ideName === 'claude') {
          this.log('✅ Claude Desktop IDE detected');
        }
      }
    });
  }

  async testIDEConfigReading() {
    await this.runTest('IDE Configuration Reading', async () => {
      // First get available IDEs
      const detectResponse = await fetch(`${this.baseURL}/api/ide/detect?workspaceId=test&projectRoot=${encodeURIComponent(this.testProjectRoot)}`);
      const detectData = await detectResponse.json();
      
      if (!detectData.success || !detectData.ides) {
        throw new Error('No IDEs detected for config testing');
      }
      
      // Test reading config for each IDE
      for (const ideName of Object.keys(detectData.ides)) {
        const configResponse = await fetch(`${this.baseURL}/api/ide/config/${ideName}?workspaceId=test&projectRoot=${encodeURIComponent(this.testProjectRoot)}`);
        
        if (!configResponse.ok) {
          this.log(`⚠️ Config reading failed for ${ideName}: ${configResponse.status}`);
          continue;
        }
        
        const configData = await configResponse.json();
        
        if (configData.success) {
          this.log(`✅ Config read successfully for ${ideName}`);
          this.log(`✅ Config path: ${configData.configPath}`);
        } else {
          this.log(`⚠️ Config not found for ${ideName}: ${configData.error}`);
        }
      }
    });
  }

  async testServerAddition() {
    await this.runTest('Server Addition to IDE', async () => {
      const testServer = {
        name: 'test-server-' + Date.now(),
        command: 'node',
        args: ['--test'],
        env: { TEST: 'true' }
      };
      
      // Try to add to windsurf (most common)
      const response = await fetch(`${this.baseURL}/api/ide/config/windsurf/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectRoot: this.testProjectRoot,
          serverId: 'test-server',
          instancePort: 4040,
          ...testServer
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server addition failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(`Server addition failed: ${data.error}`);
      }
      
      this.log('✅ Server added to IDE successfully');
      this.log(`✅ Server name: ${testServer.name}`);
      
      // Clean up - remove the test server
      await this.cleanupTestServer(testServer.name);
    });
  }

  async testSyncOperation() {
    await this.runTest('IDE Sync Operation', async () => {
      const response = await fetch(`${this.baseURL}/api/ide/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectRoot: this.testProjectRoot
        })
      });
      
      if (!response.ok) {
        throw new Error(`Sync operation failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(`Sync operation failed: ${data.error}`);
      }
      
      this.log('✅ Sync operation completed successfully');
      
      if (data.results) {
        for (const [ide, result] of Object.entries(data.results)) {
          this.log(`✅ ${ide}: ${result.success ? 'Synced' : 'Failed'}`);
        }
      }
    });
  }

  async testImportOperation() {
    await this.runTest('IDE Import Operation', async () => {
      const response = await fetch(`${this.baseURL}/api/ide/import?projectRoot=${encodeURIComponent(this.testProjectRoot)}`);
      
      if (!response.ok) {
        throw new Error(`Import operation failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(`Import operation failed: ${data.error}`);
      }
      
      this.log('✅ Import operation completed successfully');
      
      if (data.imported) {
        this.log(`✅ Imported ${data.imported.length} servers`);
        data.imported.forEach(server => {
          this.log(`✅ Imported: ${server.name}`);
        });
      }
    });
  }

  async cleanupTestServer(serverName) {
    try {
      const response = await fetch(`${this.baseURL}/api/ide/config/windsurf/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectRoot: this.testProjectRoot,
          serverName: serverName
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.log(`✅ Cleaned up test server: ${serverName}`);
        }
      }
    } catch (error) {
      this.log(`⚠️ Failed to cleanup test server: ${error.message}`);
    }
  }

  async testUIIntegration() {
    await this.runTest('UI Integration Points', async () => {
      // Test that the MCP Manager is running and accessible
      const response = await fetch(`${this.baseURL}/api/health`);
      
      if (!response.ok) {
        throw new Error('MCP Manager not accessible');
      }
      
      this.log('✅ MCP Manager is running and accessible');
      this.log('✅ IDE Integration Panel should be available in MCP Tools section');
      this.log('✅ Navigate to: MCP Tools → IDE Integration');
    });
  }

  async testConfigurationValidation() {
    await this.runTest('Configuration Validation', async () => {
      // Test invalid IDE name
      const response = await fetch(`${this.baseURL}/api/ide/config/invalid-ide?workspaceId=test&projectRoot=${encodeURIComponent(this.testProjectRoot)}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          throw new Error('Invalid IDE should not be successful');
        }
        this.log('✅ Invalid IDE correctly rejected');
      }
      
      // Test invalid project root
      const response2 = await fetch(`${this.baseURL}/api/ide/config/windsurf?workspaceId=test&projectRoot=/invalid/path`);
      
      if (response2.ok) {
        const data2 = await response2.json();
        if (data2.success) {
          throw new Error('Invalid project root should not be successful');
        }
        this.log('✅ Invalid project root correctly rejected');
      }
    });
  }

  printResults() {
    this.log('\n=== IDE Integration Test Results Summary ===', 'test');
    
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
    
    this.log('\n=== IDE Integration Test Complete ===', 'test');
  }

  async runAllTests() {
    this.log('=== Starting IDE Integration Tests ===', 'test');
    this.log(`Test project root: ${this.testProjectRoot}`, 'info');
    
    try {
      await this.testUIIntegration();
      await this.testIDEDetection();
      await this.testIDEConfigReading();
      await this.testConfigurationValidation();
      await this.testServerAddition();
      await this.testSyncOperation();
      await this.testImportOperation();
    } catch (error) {
      this.log(`IDE Integration test suite failed: ${error.message}`, 'error');
    }
    
    this.printResults();
  }
}

// Run the tests
const tester = new IDEIntegrationTester();
tester.runAllTests().catch(error => {
  console.error('IDE Integration test runner failed:', error);
  process.exit(1);
});

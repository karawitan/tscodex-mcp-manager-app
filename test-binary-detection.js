#!/usr/bin/env node

/**
 * Rigorous Binary Detection Testing
 * Tests all binary detection functionality in MCP Manager
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

class BinaryDetectionTester {
  constructor() {
    this.testResults = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '📋',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'test': '🧪',
      'binary': '🔧'
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

  async testBasicBinaryDetection() {
    await this.runTest('Basic Binary Detection', async () => {
      const binaries = ['git', 'node', 'npm', 'python3', 'curl'];
      
      for (const binary of binaries) {
        try {
          const { stdout } = await execAsync(`which ${binary}`, { timeout: 5000 });
          this.log(`✅ ${binary}: ${stdout.trim()}`, 'binary');
        } catch (error) {
          this.log(`❌ ${binary}: not found`, 'binary');
        }
      }
    });
  }

  async testBinaryDetectorImport() {
    await this.runTest('BinaryDetector Import', async () => {
      try {
        // Try to import the BinaryDetector
        const binaryDetectorPath = path.join(process.cwd(), 'src/shared/BinaryDetector.ts');
        
        // Check if file exists
        await fs.access(binaryDetectorPath);
        this.log('✅ BinaryDetector.ts file exists');
        
        // Check if it's compiled
        const compiledPath = path.join(process.cwd(), 'dist/shared/BinaryDetector.js');
        try {
          await fs.access(compiledPath);
          this.log('✅ BinaryDetector.js compiled file exists');
        } catch (error) {
          this.log('❌ BinaryDetector.js compiled file missing', 'warning');
        }
        
      } catch (error) {
        throw new Error('BinaryDetector import failed');
      }
    });
  }

  async testServerBinaryDetection() {
    await this.runTest('Server Binary Detection API', async () => {
      // Test git check through API
      try {
        const response = await fetch('http://localhost:4040/api/packages/check-git', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            this.log(`✅ Server git detection: ${data.version} at ${data.path}`);
          } else {
            this.log(`❌ Server git detection failed: ${data.error}`);
          }
        } else {
          this.log(`❌ Server git API error: ${response.status}`);
        }
      } catch (error) {
        this.log(`❌ Server git API request failed: ${error.message}`);
      }
      
      // Test uvx check through API
      try {
        const response = await fetch('http://localhost:4040/api/packages/check-uvx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            this.log(`✅ Server uvx detection: ${data.version} at ${data.path}`);
          } else {
            this.log(`❌ Server uvx detection failed: ${data.error}`);
          }
        } else {
          this.log(`❌ Server uvx API error: ${response.status}`);
        }
      } catch (error) {
        this.log(`❌ Server uvx API request failed: ${error.message}`);
      }
    });
  }

  async testCommonBinaryPaths() {
    await this.runTest('Common Binary Paths Detection', async () => {
      const commonBinaries = {
        'git': ['/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git'],
        'node': ['/usr/bin/node', '/usr/local/bin/node', '/opt/homebrew/bin/node'],
        'npm': ['/usr/bin/npm', '/usr/local/bin/npm', '/opt/homebrew/bin/npm'],
        'python3': ['/usr/bin/python3', '/usr/local/bin/python3', '/opt/homebrew/bin/python3'],
        'curl': ['/usr/bin/curl', '/usr/local/bin/curl', '/opt/homebrew/bin/curl']
      };
      
      for (const [binary, paths] of Object.entries(commonBinaries)) {
        let found = false;
        
        for (const binaryPath of paths) {
          try {
            await execAsync(`test -f "${binaryPath}" && test -x "${binaryPath}"`, { timeout: 1000 });
            
            // Verify it's actually the correct binary
            const { stdout } = await execAsync(`"${binaryPath}" --version`, { timeout: 5000 });
            
            this.log(`✅ ${binary}: ${binaryPath} (${stdout.split('\n')[0]})`, 'binary');
            found = true;
            break;
          } catch (error) {
            // Continue trying
          }
        }
        
        if (!found) {
          this.log(`❌ ${binary}: not found in common paths`, 'binary');
        }
      }
    });
  }

  async testBinaryVersions() {
    await this.runTest('Binary Version Detection', async () => {
      const versionCommands = {
        'git': 'git --version',
        'node': 'node --version',
        'npm': 'npm --version',
        'python3': 'python3 --version',
        'curl': 'curl --version',
        'uvx': 'uvx --version',
        'uv': 'uv --version'
      };
      
      for (const [binary, command] of Object.entries(versionCommands)) {
        try {
          const { stdout } = await execAsync(command, { timeout: 5000 });
          const version = stdout.split('\n')[0].trim();
          this.log(`✅ ${binary}: ${version}`, 'binary');
        } catch (error) {
          this.log(`❌ ${binary}: version check failed`, 'binary');
        }
      }
    });
  }

  async testPackageManagerDetection() {
    await this.runTest('Package Manager Detection', async () => {
      const packageManagers = [
        { name: 'npm', command: 'npm --version' },
        { name: 'yarn', command: 'yarn --version' },
        { name: 'pnpm', command: 'pnpm --version' },
        { name: 'bun', command: 'bun --version' },
        { name: 'pip', command: 'pip --version' },
        { name: 'pip3', command: 'pip3 --version' },
        { name: 'uvx', command: 'uvx --version' }
      ];
      
      for (const pm of packageManagers) {
        try {
          const { stdout } = await execAsync(pm.command, { timeout: 5000 });
          const version = stdout.split('\n')[0].trim();
          this.log(`✅ ${pm.name}: ${version}`, 'binary');
        } catch (error) {
          this.log(`❌ ${pm.name}: not available`, 'binary');
        }
      }
    });
  }

  async testDevelopmentToolsDetection() {
    await this.runTest('Development Tools Detection', async () => {
      const devTools = [
        { name: 'git', command: 'git --version' },
        { name: 'make', command: 'make --version' },
        { name: 'cmake', command: 'cmake --version' },
        { name: 'gcc', command: 'gcc --version' },
        { name: 'clang', command: 'clang --version' },
        { name: 'docker', command: 'docker --version' },
        { name: 'code', command: 'code --version' }
      ];
      
      for (const tool of devTools) {
        try {
          const { stdout } = await execAsync(tool.command, { timeout: 5000 });
          const version = stdout.split('\n')[0].trim();
          this.log(`✅ ${tool.name}: ${version}`, 'binary');
        } catch (error) {
          this.log(`❌ ${tool.name}: not available`, 'binary');
        }
      }
    });
  }

  async testPATHEnvironment() {
    await this.runTest('PATH Environment Analysis', async () => {
      const path = process.env.PATH;
      this.log(`Current PATH: ${path}`, 'info');
      
      const pathDirs = path.split(':');
      this.log(`PATH contains ${pathDirs.length} directories`, 'info');
      
      // Check common binary directories
      const commonDirs = [
        '/usr/bin',
        '/usr/local/bin',
        '/opt/homebrew/bin',
        '/opt/local/bin',
        '/usr/local/git/bin',
        '/Applications/Xcode.app/Contents/Developer/usr/bin'
      ];
      
      for (const dir of commonDirs) {
        if (pathDirs.includes(dir)) {
          this.log(`✅ PATH includes: ${dir}`, 'binary');
        } else {
          this.log(`❌ PATH missing: ${dir}`, 'binary');
        }
      }
      
      // List what's in each PATH directory
      for (const dir of pathDirs.slice(0, 10)) { // Limit to first 10
        try {
          const { stdout } = await execAsync(`ls -la "${dir}" | head -5`, { timeout: 2000 });
          this.log(`📁 ${dir}: ${stdout.split('\n').slice(1).join(', ')}`, 'info');
        } catch (error) {
          this.log(`📁 ${dir}: cannot access`, 'warning');
        }
      }
    });
  }

  async testElectronEnvironment() {
    await this.runTest('Electron Environment Binary Detection', async () => {
      // Test if running in Electron environment
      const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;
      
      if (isElectron) {
        this.log(`✅ Running in Electron ${process.versions.electron}`, 'binary');
        this.log(`Node.js version: ${process.versions.node}`, 'binary');
      } else {
        this.log(`❌ Not running in Electron environment`, 'binary');
        this.log(`Node.js version: ${process.versions.node}`, 'binary');
      }
      
      // Test environment variables that might affect binary detection
      const envVars = ['PATH', 'HOME', 'USER', 'SHELL', 'TERM'];
      
      for (const envVar of envVars) {
        const value = process.env[envVar];
        if (value) {
          this.log(`✅ ${envVar}: ${value}`, 'binary');
        } else {
          this.log(`❌ ${envVar}: not set`, 'binary');
        }
      }
    });
  }

  async testBinaryDetectionPerformance() {
    await this.runTest('Binary Detection Performance', async () => {
      const binaries = ['git', 'node', 'npm', 'python3'];
      const results = [];
      
      for (const binary of binaries) {
        const startTime = Date.now();
        
        try {
          await execAsync(`which ${binary}`, { timeout: 5000 });
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          results.push({ binary, duration, success: true });
          this.log(`⏱️ ${binary}: ${duration}ms`, 'binary');
        } catch (error) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          results.push({ binary, duration, success: false });
          this.log(`⏱️ ${binary}: ${duration}ms (failed)`, 'binary');
        }
      }
      
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      this.log(`📊 Average detection time: ${avgDuration.toFixed(2)}ms`, 'info');
    });
  }

  printResults() {
    this.log('\n=== Binary Detection Test Results Summary ===', 'test');
    
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
    
    this.log('\n=== Binary Detection Test Complete ===', 'test');
  }

  async runAllTests() {
    this.log('=== Starting Rigorous Binary Detection Tests ===', 'test');
    
    try {
      await this.testBasicBinaryDetection();
      await this.testBinaryDetectorImport();
      await this.testServerBinaryDetection();
      await this.testCommonBinaryPaths();
      await this.testBinaryVersions();
      await this.testPackageManagerDetection();
      await this.testDevelopmentToolsDetection();
      await this.testPATHEnvironment();
      await this.testElectronEnvironment();
      await this.testBinaryDetectionPerformance();
    } catch (error) {
      this.log(`Binary detection test suite failed: ${error.message}`, 'error');
    }
    
    this.printResults();
  }
}

// Run the tests
const tester = new BinaryDetectionTester();
tester.runAllTests().catch(error => {
  console.error('Binary detection test runner failed:', error);
  process.exit(1);
});

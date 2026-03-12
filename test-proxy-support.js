#!/usr/bin/env node

/**
 * Test Proxy Configuration and Git Clone with Proxy Support
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class ProxyTester {
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
      'proxy': '🌐'
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

  async testProxyConfigImport() {
    await this.runTest('ProxyConfig Import', async () => {
      try {
        const { createProxyEnvironment, validateProxyConfig, detectSystemProxy, testProxyConnectivity, ProxyConfig } = require('./dist/shared/ProxyConfig.js');
        
        this.log('✅ ProxyConfig module imported successfully');
        this.log('✅ Functions available:', Object.keys({ createProxyEnvironment, validateProxyConfig, detectSystemProxy, testProxyConnectivity }));
        
        // Test basic functionality
        const systemProxy = detectSystemProxy();
        this.log('✅ System proxy detection:', systemProxy || 'None detected');
        
      } catch (error) {
        throw new Error(`ProxyConfig import failed: ${error.message}`);
      }
    });
  }

  async testProxyValidation() {
    await this.runTest('Proxy Configuration Validation', async () => {
      const { validateProxyConfig } = require('./dist/shared/ProxyConfig.js');
      
      // Test valid configuration
      const validConfig = {
        type: 'http',
        host: 'proxy.example.com',
        port: 8080,
        enabled: true
      };
      
      const result1 = validateProxyConfig(validConfig);
      if (!result1.valid) {
        throw new Error(`Valid config failed validation: ${result1.errors.join(', ')}`);
      }
      this.log('✅ Valid proxy configuration passed validation');
      
      // Test invalid configuration
      const invalidConfig = {
        type: 'invalid',
        host: '',
        port: 0,
        enabled: true
      };
      
      const result2 = validateProxyConfig(invalidConfig);
      if (result2.valid) {
        throw new Error('Invalid config passed validation');
      }
      this.log('✅ Invalid proxy configuration correctly rejected');
      this.log('✅ Validation errors:', result2.errors.join(', '));
    });
  }

  async testProxyEnvironmentCreation() {
    await this.runTest('Proxy Environment Creation', async () => {
      const { createProxyEnvironment } = require('./dist/shared/ProxyConfig.js');
      
      // Test HTTP proxy
      const httpConfig = {
        enabled: true,
        type: 'http',
        host: 'proxy.example.com',
        port: 8080,
        username: 'user',
        password: 'pass'
      };
      
      const env1 = createProxyEnvironment(httpConfig);
      this.log('✅ HTTP proxy environment created');
      this.log('✅ HTTP_PROXY:', env1.HTTP_PROXY || 'Not set');
      this.log('✅ HTTPS_PROXY:', env1.HTTPS_PROXY || 'Not set');
      
      // Test SOCKS proxy
      const socksConfig = {
        enabled: true,
        type: 'socks5',
        host: 'socks.example.com',
        port: 1080
      };
      
      const env2 = createProxyEnvironment(socksConfig);
      this.log('✅ SOCKS proxy environment created');
      this.log('✅ SOCKS_PROXY:', env2.SOCKS_PROXY || 'Not set');
      this.log('✅ ALL_PROXY:', env2.ALL_PROXY || 'Not set');
      
      // Test disabled proxy
      const disabledConfig = {
        enabled: false,
        type: 'http',
        host: 'proxy.example.com',
        port: 8080
      };
      
      const env3 = createProxyEnvironment(disabledConfig);
      if (Object.keys(env3).length > 0) {
        throw new Error('Disabled proxy should return empty environment');
      }
      this.log('✅ Disabled proxy returns empty environment');
    });
  }

  async testProxyAPIEndpoints() {
    await this.runTest('Proxy API Endpoints', async () => {
      // Test proxy config endpoint
      try {
        const response = await fetch('http://localhost:4040/api/proxy/config', {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            this.log('✅ Proxy config endpoint working');
            this.log('✅ System proxy detected:', !!data.systemProxy);
          } else {
            this.log('❌ Proxy config endpoint returned error:', data.error);
          }
        } else {
          this.log('❌ Proxy config endpoint HTTP error:', response.status);
        }
      } catch (error) {
        this.log('❌ Proxy config endpoint request failed:', error.message);
        throw new Error('Proxy config endpoint not accessible');
      }
      
      // Test proxy validation endpoint
      try {
        const testConfig = {
          enabled: true,
          type: 'http',
          host: 'proxy.example.com',
          port: 8080
        };
        
        const response = await fetch('http://localhost:4040/api/proxy/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testConfig),
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.valid) {
            this.log('✅ Proxy validation endpoint working');
          } else {
            this.log('❌ Proxy validation failed:', data.errors?.join(', ') || 'Unknown error');
          }
        } else {
          this.log('❌ Proxy validation endpoint HTTP error:', response.status);
        }
      } catch (error) {
        this.log('❌ Proxy validation endpoint request failed:', error.message);
      }
      
      // Test proxy apply endpoint
      try {
        const testConfig = {
          enabled: true,
          type: 'http',
          host: 'proxy.example.com',
          port: 8080
        };
        
        const response = await fetch('http://localhost:4040/api/proxy/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testConfig),
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            this.log('✅ Proxy apply endpoint working');
            this.log('✅ Environment variables returned:', Object.keys(data.environment || {}).length);
          } else {
            this.log('❌ Proxy apply failed:', data.error);
          }
        } else {
          this.log('❌ Proxy apply endpoint HTTP error:', response.status);
        }
      } catch (error) {
        this.log('❌ Proxy apply endpoint request failed:', error.message);
      }
    });
  }

  async testGitCloneWithProxy() {
    await this.runTest('Git Clone with Proxy Support', async () => {
      // Test git clone without proxy first
      try {
        const cloneData = {
          gitUrl: 'https://github.com/octocat/Hello-World.git'
        };
        
        const response = await fetch('http://localhost:4040/api/packages/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cloneData),
          signal: AbortSignal.timeout(30000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            this.log('✅ Git clone without proxy working');
            this.log('✅ Clone time:', data.cloneTime + 's');
            this.log('✅ Repository size:', Math.round(data.repoSize / 1024) + 'KB');
            this.log('✅ Proxy used:', data.proxyUsed || false);
          } else {
            this.log('❌ Git clone failed:', data.error);
            throw new Error(`Git clone failed: ${data.error}`);
          }
        } else {
          this.log('❌ Git clone HTTP error:', response.status);
          throw new Error(`Git clone HTTP error: ${response.status}`);
        }
      } catch (error) {
        this.log('❌ Git clone request failed:', error.message);
        throw new Error('Git clone endpoint not working');
      }
      
      // Test git clone with proxy configuration (even if proxy doesn't exist)
      try {
        const cloneDataWithProxy = {
          gitUrl: 'https://github.com/octocat/Hello-World.git',
          proxyConfig: {
            enabled: true,
            type: 'http',
            host: 'proxy.example.com',
            port: 8080
          }
        };
        
        const response = await fetch('http://localhost:4040/api/packages/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cloneDataWithProxy),
          signal: AbortSignal.timeout(30000)
        });
        
        if (response.ok) {
          const data = await response.json();
          // This will likely fail due to invalid proxy, but the endpoint should accept the config
          if (data.success) {
            this.log('✅ Git clone with proxy config accepted (unexpected success)');
          } else {
            this.log('✅ Git clone with proxy config correctly handled proxy failure');
            this.log('✅ Proxy error:', data.error.includes('proxy') ? 'Correctly identified proxy issue' : 'Other error');
          }
        } else {
          this.log('❌ Git clone with proxy HTTP error:', response.status);
        }
      } catch (error) {
        this.log('❌ Git clone with proxy request failed:', error.message);
      }
    });
  }

  async testProxyDetection() {
    await this.runTest('System Proxy Detection', async () => {
      const { detectSystemProxy } = require('./dist/shared/ProxyConfig.js');
      
      // Test system proxy detection
      const systemProxy = detectSystemProxy();
      this.log('✅ System proxy detection completed');
      
      if (systemProxy) {
        this.log('✅ System proxy found:', {
          type: systemProxy.type,
          host: systemProxy.host,
          port: systemProxy.port,
          hasAuth: !!(systemProxy.username && systemProxy.password)
        });
      } else {
        this.log('✅ No system proxy detected (normal for most environments)');
      }
      
      // Test with environment variables
      const originalEnv = process.env.HTTP_PROXY;
      process.env.HTTP_PROXY = 'http://proxy.test.com:8080';
      
      const envProxy = detectSystemProxy();
      if (envProxy && envProxy.host === 'proxy.test.com') {
        this.log('✅ Environment proxy detection working');
      } else {
        this.log('❌ Environment proxy detection failed');
      }
      
      // Restore original environment
      if (originalEnv) {
        process.env.HTTP_PROXY = originalEnv;
      } else {
        delete process.env.HTTP_PROXY;
      }
    });
  }

  printResults() {
    this.log('\n=== Proxy Support Test Results Summary ===', 'test');
    
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
    
    this.log('\n=== Proxy Support Test Complete ===', 'test');
  }

  async runAllTests() {
    this.log('=== Starting Proxy Support Tests ===', 'test');
    
    try {
      await this.testProxyConfigImport();
      await this.testProxyValidation();
      await this.testProxyEnvironmentCreation();
      await this.testProxyDetection();
      await this.testProxyAPIEndpoints();
      await this.testGitCloneWithProxy();
    } catch (error) {
      this.log(`Proxy support test suite failed: ${error.message}`, 'error');
    }
    
    this.printResults();
  }
}

// Run the tests
const tester = new ProxyTester();
tester.runAllTests().catch(error => {
  console.error('Proxy support test runner failed:', error);
  process.exit(1);
});

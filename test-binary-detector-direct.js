#!/usr/bin/env node

/**
 * Test BinaryDetector Directly
 * Test the BinaryDetector module functionality
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testBinaryDetectorDirectly() {
  console.log('=== Testing BinaryDetector Directly ===');
  
  // Test 1: Check if BinaryDetector can be required/imported
  console.log('\n1. Testing BinaryDetector import...');
  
  try {
    // Try to import the TypeScript file directly (might fail)
    console.log('Attempting to import BinaryDetector...');
    
    // Since we can't import TypeScript directly in Node.js, let's test the compiled version
    const { spawn } = await import('child_process');
    
    // Test with a simple Node script that tries to import BinaryDetector
    const testScript = `
      try {
        const { refreshBinaryPaths } = require('./dist/shared/BinaryDetector.js');
        console.log('SUCCESS: BinaryDetector imported');
        
        refreshBinaryPaths().then(result => {
          console.log('SUCCESS: BinaryDetector executed');
          console.log('Git path:', result.git);
          console.log('Node path:', result.node);
          console.log('NPM path:', result.npm);
        }).catch(error => {
          console.log('ERROR: BinaryDetector execution failed:', error.message);
        });
      } catch (error) {
        console.log('ERROR: Cannot import BinaryDetector:', error.message);
      }
    `;
    
    const { stdout, stderr } = await execAsync(`node -e "${testScript}"`, {
      cwd: process.cwd(),
      timeout: 10000
    });
    
    console.log('Output:', stdout);
    if (stderr) {
      console.log('Errors:', stderr);
    }
    
  } catch (error) {
    console.log('Failed to test BinaryDetector:', error.message);
  }
  
  // Test 2: Check if the compiled BinaryDetector exists
  console.log('\n2. Checking compiled BinaryDetector...');
  const fs = await import('fs/promises');
  
  try {
    await fs.access('./dist/shared/BinaryDetector.js');
    console.log('✅ Compiled BinaryDetector.js exists');
  } catch (error) {
    console.log('❌ Compiled BinaryDetector.js missing');
  }
  
  try {
    await fs.access('./src/shared/BinaryDetector.ts');
    console.log('✅ Source BinaryDetector.ts exists');
  } catch (error) {
    console.log('❌ Source BinaryDetector.ts missing');
  }
  
  // Test 3: Check what's in the dist/shared directory
  console.log('\n3. Checking dist/shared directory...');
  try {
    const { stdout } = await execAsync('ls -la ./dist/shared/ 2>/dev/null || echo "Directory does not exist"', {
      cwd: process.cwd()
    });
    console.log('dist/shared contents:', stdout);
  } catch (error) {
    console.log('Could not check dist/shared directory');
  }
  
  // Test 4: Manual binary detection test
  console.log('\n4. Manual binary detection test...');
  
  const binaries = ['git', 'node', 'npm', 'python3', 'uvx'];
  const results = {};
  
  for (const binary of binaries) {
    try {
      // Method 1: which
      const { stdout: whichResult } = await execAsync(`which ${binary}`, { timeout: 5000 });
      const whichPath = whichResult.trim();
      
      // Method 2: verify it works
      const { stdout: versionResult } = await execAsync(`"${whichPath}" --version`, { timeout: 5000 });
      const version = versionResult.split('\n')[0];
      
      results[binary] = {
        found: true,
        path: whichPath,
        version: version
      };
      
      console.log(`✅ ${binary}: ${whichPath} (${version})`);
    } catch (error) {
      results[binary] = {
        found: false,
        path: null,
        version: null,
        error: error.message
      };
      
      console.log(`❌ ${binary}: not found`);
    }
  }
  
  console.log('\n=== Manual Binary Detection Results ===');
  console.log(JSON.stringify(results, null, 2));
  
  console.log('\n=== Test Complete ===');
}

testBinaryDetectorDirectly().catch(error => {
  console.error('BinaryDetector test failed:', error);
  process.exit(1);
});

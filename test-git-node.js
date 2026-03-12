#!/usr/bin/env node

/**
 * Test Git Detection in Node.js Process
 * Debug why git isn't found in the server environment
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testGitInNode() {
  console.log('=== Testing Git Detection in Node.js ===');
  
  // Test 1: Check PATH
  console.log('\n1. Current PATH:');
  console.log(process.env.PATH);
  
  // Test 2: Try which git
  console.log('\n2. Testing which git...');
  try {
    const { stdout } = await execAsync('which git', { 
      timeout: 5000,
      env: { ...process.env }
    });
    console.log(`✅ which git: ${stdout.trim()}`);
  } catch (error) {
    console.log(`❌ which git failed: ${error.message}`);
  }
  
  // Test 3: Try git --version directly
  console.log('\n3. Testing git --version...');
  try {
    const { stdout } = await execAsync('git --version', { 
      timeout: 5000,
      env: { ...process.env }
    });
    console.log(`✅ git --version: ${stdout.trim()}`);
  } catch (error) {
    console.log(`❌ git --version failed: ${error.message}`);
  }
  
  // Test 4: Try with full path
  console.log('\n4. Testing with full path...');
  try {
    const { stdout } = await execAsync('/usr/bin/git --version', { 
      timeout: 5000,
      env: { ...process.env }
    });
    console.log(`✅ /usr/bin/git --version: ${stdout.trim()}`);
  } catch (error) {
    console.log(`❌ /usr/bin/git --version failed: ${error.message}`);
  }
  
  // Test 5: Check common paths
  console.log('\n5. Testing common git paths...');
  const commonPaths = [
    '/usr/bin/git',
    '/usr/local/bin/git',
    '/opt/homebrew/bin/git',
    '/opt/local/bin/git',
    '/usr/local/git/bin/git',
  ];
  
  for (const gitPath of commonPaths) {
    try {
      await execAsync(`test -x "${gitPath}"`, { 
        timeout: 1000,
        env: { ...process.env }
      });
      console.log(`✅ Found executable at: ${gitPath}`);
      
      try {
        const { stdout } = await execAsync(`"${gitPath}" --version`, { 
          timeout: 5000,
          env: { ...process.env }
        });
        console.log(`   Version: ${stdout.trim()}`);
      } catch (error) {
        console.log(`   Version check failed: ${error.message}`);
      }
    } catch (error) {
      // Not executable or doesn't exist
    }
  }
  
  // Test 6: Simulate the exact git detection logic from the server
  console.log('\n6. Simulating server git detection...');
  let gitPath = null;
  
  // Method 1: Use 'which' command
  try {
    const { stdout: whichResult } = await execAsync('which git', {
      timeout: 5000,
      env: { ...process.env }
    });
    gitPath = whichResult.trim();
    console.log(`Found git via which: ${gitPath}`);
  } catch (error) {
    console.log('which git failed, trying other methods');
  }
  
  // Method 2: Try common paths
  if (!gitPath) {
    for (const commonPath of commonPaths) {
      try {
        await execAsync(`test -x "${commonPath}"`, { 
          timeout: 1000,
          env: { ...process.env }
        });
        gitPath = commonPath;
        console.log(`Found git at common path: ${gitPath}`);
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
        env: { ...process.env }
      });
      if (versionResult.includes('git version')) {
        gitPath = 'git';
        console.log('Git available via PATH');
      }
    } catch (error) {
      console.log('git --version failed');
    }
  }
  
  console.log(`\nFinal result: gitPath = ${gitPath}`);
  
  if (!gitPath) {
    console.log('\n❌ Git detection failed - this explains the server error!');
  } else {
    console.log('\n✅ Git detection succeeded - server should work');
  }
  
  console.log('\n=== Test Complete ===');
}

testGitInNode().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});

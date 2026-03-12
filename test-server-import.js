#!/usr/bin/env node

/**
 * Test BinaryDetector Import in Server Context
 * Test if the BinaryDetector can be imported in the same way as the server
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testServerImport() {
  console.log('=== Testing BinaryDetector Import in Server Context ===');
  
  // Test the exact same import pattern as the server
  try {
    const testScript = `
      try {
        console.log('Testing require pattern...');
        const { refreshBinaryPaths } = require('./dist/shared/BinaryDetector.js');
        console.log('SUCCESS: require() worked');
        
        console.log('Testing function execution...');
        refreshBinaryPaths().then(result => {
          console.log('SUCCESS: Function executed');
          console.log('Git path:', result.git);
          console.log('Node path:', result.node);
          console.log('NPM path:', result.npm);
          process.exit(0);
        }).catch(error => {
          console.log('ERROR: Function execution failed:', error.message);
          console.log('Stack:', error.stack);
          process.exit(1);
        });
      } catch (error) {
        console.log('ERROR: require() failed:', error.message);
        console.log('Stack:', error.stack);
        process.exit(1);
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
    console.log('Failed to test server import:', error.message);
  }
  
  // Test with the same environment as the server
  console.log('\n=== Testing with Server Environment ===');
  
  try {
    const serverTestScript = `
      // Simulate server environment
      process.env.NODE_ENV = 'development';
      
      try {
        console.log('Testing server-style import...');
        const { refreshBinaryPaths } = require('./dist/shared/BinaryDetector.js');
        
        console.log('Testing git detection...');
        refreshBinaryPaths().then(result => {
          if (result.git) {
            console.log('SUCCESS: Git detected at', result.git);
          } else {
            console.log('ERROR: Git not detected');
          }
          process.exit(0);
        }).catch(error => {
          console.log('ERROR:', error.message);
          process.exit(1);
        });
      } catch (error) {
        console.log('IMPORT ERROR:', error.message);
        process.exit(1);
      }
    `;
    
    const { stdout, stderr } = await execAsync(`node -e "${serverTestScript}"`, {
      cwd: process.cwd(),
      timeout: 10000
    });
    
    console.log('Server test output:', stdout);
    if (stderr) {
      console.log('Server test errors:', stderr);
    }
    
  } catch (error) {
    console.log('Failed server environment test:', error.message);
  }
}

testServerImport().catch(error => {
  console.error('Server import test failed:', error);
  process.exit(1);
});

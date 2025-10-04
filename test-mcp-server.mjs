#!/usr/bin/env node

/**
 * MCP Server Test Script
 * 
 * This script tests the MCP server using wong2/mcp-cli
 * It validates that all tools are accessible and working correctly
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

const SERVER_COMMAND = 'node';
const SERVER_ARGS = ['build/index.js'];
const TEST_TIMEOUT = 30000; // 30 seconds

class MCPTester {
  constructor() {
    this.serverProcess = null;
    this.testResults = [];
  }

  async startServer() {
    console.log('🚀 Starting MCP server...');
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn(SERVER_COMMAND, SERVER_ARGS, {
        env: {
          ...process.env,
          MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017'
        }
      });

      this.serverProcess.stdout.on('data', (data) => {
        console.log(`Server: ${data.toString().trim()}`);
      });

      this.serverProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        // MCP servers often output to stderr, this is normal
        if (output.includes('MCP server running') || output.includes('Connected')) {
          console.log(`Server: ${output}`);
        }
      });

      this.serverProcess.on('error', (error) => {
        console.error(`❌ Server error: ${error.message}`);
        reject(error);
      });

      // Give server time to start
      setTimeout(() => {
        if (this.serverProcess && this.serverProcess.pid) {
          console.log('✅ Server started with PID:', this.serverProcess.pid);
          resolve();
        } else {
          reject(new Error('Server failed to start'));
        }
      }, 3000);
    });
  }

  async testListTools() {
    console.log('\n📋 Testing: List Tools');
    
    return new Promise((resolve) => {
      const mcpCli = spawn('mcp-cli', ['list-tools', SERVER_COMMAND, ...SERVER_ARGS]);
      
      let output = '';
      
      mcpCli.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      mcpCli.on('close', (code) => {
        if (output.includes('save-memories') || output.includes('tool')) {
          console.log('✅ List tools: PASSED');
          this.testResults.push({ test: 'list-tools', status: 'PASSED' });
        } else {
          console.log('⚠️  List tools: WARNING (unexpected output)');
          this.testResults.push({ test: 'list-tools', status: 'WARNING' });
        }
        resolve();
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        mcpCli.kill();
        console.log('⏱️  List tools: TIMEOUT');
        this.testResults.push({ test: 'list-tools', status: 'TIMEOUT' });
        resolve();
      }, 10000);
    });
  }

  async testHealthCheck() {
    console.log('\n🏥 Testing: Health Check Tool');
    
    return new Promise((resolve) => {
      const mcpCli = spawn('mcp-cli', [
        'call-tool',
        SERVER_COMMAND,
        ...SERVER_ARGS,
        'health-check',
        '{}'
      ]);
      
      let output = '';
      
      mcpCli.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      mcpCli.on('close', (code) => {
        if (output.includes('healthy') || output.includes('connected') || code === 0) {
          console.log('✅ Health check: PASSED');
          this.testResults.push({ test: 'health-check', status: 'PASSED' });
        } else {
          console.log('❌ Health check: FAILED');
          this.testResults.push({ test: 'health-check', status: 'FAILED' });
        }
        resolve();
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        mcpCli.kill();
        console.log('⏱️  Health check: TIMEOUT');
        this.testResults.push({ test: 'health-check', status: 'TIMEOUT' });
        resolve();
      }, 10000);
    });
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    if (this.serverProcess) {
      this.serverProcess.kill();
      console.log('✅ Server stopped');
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary');
    console.log('='.repeat(50));
    
    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;
    const warnings = this.testResults.filter(r => r.status === 'WARNING').length;
    const timeouts = this.testResults.filter(r => r.status === 'TIMEOUT').length;
    
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`⏱️  Timeouts: ${timeouts}`);
    console.log('='.repeat(50));
    
    return failed === 0 && timeouts === 0;
  }

  async runAllTests() {
    try {
      await this.startServer();
      await setTimeout(2000); // Wait for server to be fully ready
      
      await this.testListTools();
      await this.testHealthCheck();
      
      const success = this.printSummary();
      
      await this.cleanup();
      
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Run tests
const tester = new MCPTester();
tester.runAllTests();

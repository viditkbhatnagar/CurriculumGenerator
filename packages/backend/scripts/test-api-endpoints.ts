#!/usr/bin/env ts-node

/**
 * API Endpoints Test Script
 * 
 * Tests all major API endpoints to verify the MongoDB migration is working correctly.
 * This script should be run with the backend server running.
 */

import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import path from 'path';

interface TestResult {
  endpoint: string;
  method: string;
  passed: boolean;
  message: string;
  responseTime?: number;
  statusCode?: number;
  error?: string;
}

class APIEndpointTester {
  private baseURL: string;
  private client: AxiosInstance;
  private results: TestResult[] = [];
  private testProgramId: string | null = null;
  private testModuleId: string | null = null;
  private testJobId: string | null = null;

  constructor(baseURL: string = 'http://localhost:4000') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      validateStatus: () => true, // Don't throw on any status
    });
  }

  private addResult(
    endpoint: string,
    method: string,
    passed: boolean,
    message: string,
    responseTime?: number,
    statusCode?: number,
    error?: string
  ) {
    this.results.push({
      endpoint,
      method,
      passed,
      message,
      responseTime,
      statusCode,
      error,
    });
  }

  private printResult(result: TestResult) {
    const icon = result.passed ? '✓' : '✗';
    const color = result.passed ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    console.log(
      `${color}${icon}${reset} ${result.method} ${result.endpoint} - ${result.message}` +
      (result.responseTime ? ` (${result.responseTime}ms)` : '')
    );
    
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }

  async runTests(): Promise<boolean> {
    console.log('\n🧪 Testing API Endpoints...\n');
    console.log(`Base URL: ${this.baseURL}\n`);

    try {
      // Test 1: Health Check
      await this.testHealthCheck();

      // Test 2: Program Creation
      await this.testProgramCreation();

      // Test 3: Get Programs
      await this.testGetPrograms();

      // Test 4: Get Single Program
      if (this.testProgramId) {
        await this.testGetProgram();
      }

      // Test 5: Update Program
      if (this.testProgramId) {
        await this.testUpdateProgram();
      }

      // Test 6: Create Module
      if (this.testProgramId) {
        await this.testCreateModule();
      }

      // Test 7: Get Modules
      if (this.testProgramId) {
        await this.testGetModules();
      }

      // Test 8: Knowledge Base Search
      await this.testKnowledgeBaseSearch();

      // Test 9: File Upload (if test file exists)
      await this.testFileUpload();

      // Test 10: Curriculum Generation Job
      if (this.testProgramId) {
        await this.testCurriculumGeneration();
      }

      // Test 11: Job Status
      if (this.testJobId) {
        await this.testJobStatus();
      }

      // Cleanup
      await this.cleanup();

      // Print summary
      this.printSummary();

      return this.results.every(r => r.passed);

    } catch (error: any) {
      console.error('\n❌ Fatal error during testing:', error.message);
      return false;
    }
  }

  private async testHealthCheck(): Promise<void> {
    console.log('Test 1: Health Check');
    console.log('-'.repeat(60));

    const startTime = Date.now();
    
    try {
      const response = await this.client.get('/health');
      const responseTime = Date.now() - startTime;

      if (response.status === 200 && response.data.status === 'healthy') {
        this.addResult(
          '/health',
          'GET',
          true,
          'Health check passed',
          responseTime,
          response.status
        );
      } else {
        this.addResult(
          '/health',
          'GET',
          false
import { TestExecutor, BaseAdapter, APIAdapter } from 'craft-a-tester';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Adapter for using Ollama models locally
 */
class OllamaAdapter extends BaseAdapter {
  private baseUrl: string;
  private model: string;
  private contextSize: number;

  constructor(config: { 
    baseUrl: string; 
    model: string;
    contextSize?: number;
  }) {
    super(config);
    this.baseUrl = config.baseUrl;
    this.model = config.model;
    this.contextSize = config.contextSize || 8192;
  }

  async initialize(): Promise<void> {
    try {
      console.log(`\n----- INITIALIZING OLLAMA ADAPTER -----`);
      console.log(`Attempting to connect to Ollama at ${this.baseUrl}...`);
      
      // Check if Ollama server is available with a timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout
      
      try {
        // First check if the server is responding at all
        console.log(`Checking Ollama server status...`);
        const pingResponse = await fetch(`${this.baseUrl}/api/version`, {
          signal: controller.signal
        });
        
        if (!pingResponse.ok) {
          throw new Error(`Failed to connect to Ollama: ${pingResponse.statusText}`);
        }
        
        const versionData = await pingResponse.json();
        console.log(`Connected to Ollama version: ${versionData.version || 'unknown'}`);
        
        // Then list available models
        console.log(`Listing available models...`);
        const modelsResponse = await fetch(`${this.baseUrl}/api/tags`, {
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!modelsResponse.ok) {
          throw new Error(`Failed to list Ollama models: ${modelsResponse.statusText}`);
        }
        
        const modelsData = await modelsResponse.json();
        
        // Get the list of models
        const models = modelsData.models || [];
        const modelNames = models.map((m: any) => m.name);
        
        console.log(`Available models (${models.length}): ${modelNames.join(', ')}`);
        
        // Check if the specified model is available
        const modelExists = models.some((m: any) => m.name === this.model);
        if (!modelExists) {
          console.warn(`\n⚠️ WARNING: Model "${this.model}" not found in Ollama's available models!`);
          console.warn(`Please make sure it's properly installed by running: ollama pull ${this.model}`);
        } else {
          // If model exists, try to get model info
          try {
            console.log(`Getting info for model: ${this.model}...`);
            const modelInfoResponse = await fetch(`${this.baseUrl}/api/show`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ name: this.model }),
              signal: controller.signal
            });
            
            if (modelInfoResponse.ok) {
              const modelInfo = await modelInfoResponse.json();
              console.log(`Model details:`);
              console.log(` - Size: ${modelInfo.size ? (modelInfo.size / 1024 / 1024 / 1024).toFixed(2) + ' GB' : 'unknown'}`);
              console.log(` - Modified: ${modelInfo.modified || 'unknown'}`);
              console.log(` - Format: ${modelInfo.format || 'unknown'}`);
              console.log(` - Parameters: ${modelInfo.parameters || 'unknown'}`);
            } else {
              console.warn(`Could not retrieve detailed info for model ${this.model}`);
            }
          } catch (infoError) {
            console.warn(`Error getting model info: ${infoError instanceof Error ? infoError.message : 'unknown error'}`);
          }
        }
        
        // Validate the context size
        if (this.contextSize < 2048) {
          console.warn(`\n⚠️ WARNING: Context size (${this.contextSize}) is quite small. Consider using at least 8192.`);
        }
        
        // Test if the model actually works by sending a small prompt with streaming
        try {
          console.log(`\nTesting model with a simple prompt (streaming)...`);
          const testStartTime = Date.now();
          
          // Set up a controller with timeouts for the test
          const testController = new AbortController();
          const testTimeout = setTimeout(() => testController.abort(), 30000); // 30 second timeout for test
          
          try {
            const testResponse = await fetch(`${this.baseUrl}/api/chat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: this.model,
                messages: [
                  { role: "system", content: "You are a helpful AI assistant." },
                  { role: "user", content: "What's the main difference between TypeScript interfaces and types? Answer in one sentence." }
                ],
                options: {
                  num_ctx: this.contextSize,
                  temperature: 0.7
                },
                stream: true // Use streaming for test too
              }),
              signal: testController.signal
            });
            
            if (!testResponse.ok) {
              throw new Error(`Test response error: ${testResponse.status} ${testResponse.statusText}`);
            }
            
            if (!testResponse.body) {
              throw new Error('Test response body is null');
            }
            
            // Process the streaming test response
            const testReader = testResponse.body.getReader();
            let testResult = '';
            let testChunks = '';
            let testTokens = 0;
            let firstTokenTime = 0;
            let receivedFirstToken = false;
            
            console.log('  Receiving test response:');
            process.stdout.write('  ');
            
            while (true) {
              const { done, value } = await testReader.read();
              
              if (done) {
                process.stdout.write('\n');
                break;
              }
              
              // Record when we receive the first meaningful token
              if (!receivedFirstToken) {
                firstTokenTime = Date.now();
              }
              
              // Convert the chunk to text
              const chunk = new TextDecoder().decode(value);
              testChunks += chunk;
              
              // Parse the chunks as they arrive
              const lines = testChunks.split('\n');
              testChunks = lines.pop() || '';
              
              for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                  // Parse the Ollama JSON response (no data: prefix)
                  const data = JSON.parse(line);
                  
                  if (data.message?.content) {
                    if (!receivedFirstToken) {
                      receivedFirstToken = true;
                      process.stdout.write('Got first token! ');
                    }
                    
                    testResult += data.message.content;
                    testTokens++;
                    process.stdout.write('.');
                  }
                  
                  // Check if this is the final message
                  if (data.done === true) {
                    process.stdout.write(' [done] ');
                  }
                } catch (e) {
                  // Log parse errors in test for debugging
                  console.log(`\n  Parse error on: ${line.substring(0, 40)}...`);
                }
              }
            }
            
            const testEndTime = Date.now();
            const totalTestTime = (testEndTime - testStartTime) / 1000;
            const timeToFirstToken = receivedFirstToken 
              ? (firstTokenTime - testStartTime) / 1000 
              : 0;
            
            console.log(`\n  Test complete - "${testResult.substring(0, 100)}${testResult.length > 100 ? '...' : ''}"`);
            console.log(`  Total time: ${totalTestTime.toFixed(2)}s, Time to first token: ${timeToFirstToken.toFixed(2)}s`);
            console.log(`  Received ${testTokens} streaming updates`);
            
            if (receivedFirstToken) {
              console.log(`  ✅ Model is working properly with streaming!`);
            } else {
              console.warn(`  ⚠️ WARNING: Did not receive any tokens from the model!`);
            }
          } finally {
            clearTimeout(testTimeout);
          }
        } catch (testError) {
          console.warn(`Error during model test: ${testError instanceof Error ? testError.message : 'unknown error'}`);
        }
        
        console.log(`\nInitialized Ollama adapter with model: ${this.model}, context size: ${this.contextSize}`);
      } catch (error: unknown) {
        // Clean up any timeouts from the test
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Connection to Ollama at ${this.baseUrl} timed out`);
        }
        throw error;
      }
    } catch (error: unknown) {
      console.error('\n❌ Failed to initialize Ollama adapter:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to connect to Ollama server at ${this.baseUrl}: ${errorMessage}\n` +
                      `Please ensure Ollama is running at ${this.baseUrl} with the ${this.model} model installed.`);
    }
  }

  async complete(prompt: string): Promise<string> {
    try {
      console.log(`\n----- SENDING PROMPT TO OLLAMA -----`);
      console.log(`Model: ${this.model}`);
      console.log(`Prompt length: ${prompt.length} chars`);
      console.log(`Context size: ${this.contextSize}`);
      console.log(`First 100 chars: ${prompt.substring(0, 100)}...`);
      console.log(`Using Ollama API at: ${this.baseUrl}`);
      
      // For debugging only - count scenario instances in the prompt
      const scenarioCount = (prompt.match(/## Scenario:/g) || []).length;
      const stepCount = (prompt.match(/### Steps/g) || []).length;
      console.log(`Detected approximately ${scenarioCount} scenarios and ${stepCount} step sections`);
      
      // Create an AbortController for the fetch operation
      const controller = new AbortController();
      
      // Instead of a single timeout, we'll implement adaptive timeouts
      // Initial timeout - 30 seconds to establish connection and get first token
      const initialTimeoutDuration = 30000; 
      let initialTimeout = setTimeout(() => {
        console.log('Initial connection timeout reached (30s) - aborting request');
        controller.abort();
      }, initialTimeoutDuration);
      
      // We'll reset this timeout whenever we receive data
      let inactivityTimeout: NodeJS.Timeout | null = null;
      
      // Function to reset the inactivity timeout
      const resetInactivityTimeout = () => {
        // Clear any existing timeout
        if (inactivityTimeout) {
          clearTimeout(inactivityTimeout);
        }
        
        // Set a new 60-second inactivity timeout
        inactivityTimeout = setTimeout(() => {
          console.log('No activity for 60 seconds - aborting request');
          controller.abort();
        }, 60000);
      };
      
      try {
        // Using the OpenAI compatible completion endpoint with streaming for better timeout management
        console.log(`Using Ollama streaming endpoint at ${this.baseUrl}/api/chat...`);
        const startTime = Date.now();
        let lastProgressTime = startTime;
        
        // Prepare system message based on test content
        let systemMessage = "You are a helpful AI assistant and testing expert. ";
        
        // Add specific instructions based on detected content
        if (prompt.includes("TypeScript") || prompt.includes("Zod")) {
          systemMessage += "You are an expert in TypeScript, type systems, and schema validation libraries like Zod. ";
        }
        
        if (prompt.includes("API") || prompt.includes("REST")) {
          systemMessage += "You are experienced with RESTful APIs, OpenAPI specifications, and API design. ";
        }
        
        systemMessage += "Help analyze and execute software tests based on the provided contexts and instructions. Be thorough and follow the test steps precisely.";
        
        // Set up the streaming request
        const requestBody = {
          model: this.model,
          messages: [
            { 
              role: "system", 
              content: systemMessage
            },
            { 
              role: "user", 
              content: prompt 
            }
          ],
          options: {
            num_ctx: this.contextSize,
            temperature: 0.2, // Lower temperature for more consistent, deterministic responses
          },
          stream: true // Enable streaming
        };
        
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        if (!response.ok) {
          // Clear both timeouts
          clearTimeout(initialTimeout);
          if (inactivityTimeout) clearTimeout(inactivityTimeout);
          
          throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }
        
        if (!response.body) {
          // Clear both timeouts
          clearTimeout(initialTimeout);
          if (inactivityTimeout) clearTimeout(inactivityTimeout);
          
          throw new Error('Response body is null or undefined');
        }
        
        // Process the streaming response
        const reader = response.body.getReader();
        let fullResult = '';
        let accumulatedChunks = '';
        let firstChunkReceived = false;
        let tokens = 0;
        let progressDots = 0;
        let activelyGenerating = false;
        
        try {
          console.log(`\nReceiving streaming response from Ollama:`);
          process.stdout.write('  ');
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              process.stdout.write('\n');
              break;
            }
            
            // We received data, clear the initial timeout and reset the inactivity timeout
            if (!firstChunkReceived) {
              // First chunk received, clear the initial timeout
              clearTimeout(initialTimeout);
              console.log('  Connection established, initial timeout cleared.');
            }
            
            // Reset the inactivity timeout since we received data
            resetInactivityTimeout();
            
            // Convert the chunk to text
            const chunk = new TextDecoder().decode(value);
            accumulatedChunks += chunk;
            
            // Parse the chunks as they arrive
            let lines = accumulatedChunks.split('\n');
            accumulatedChunks = lines.pop() || ''; // Keep the last incomplete line for the next iteration
            
            for (const line of lines) {
              if (!line.trim()) continue;
              
              try {
                // Ollama doesn't use the data: prefix in its streaming output
                const data = JSON.parse(line);
                
                if (!firstChunkReceived && data.message?.content) {
                  firstChunkReceived = true;
                  console.log('  First token received! Model is generating content...');
                  activelyGenerating = true;
                }
                
                if (data.message?.content) {
                  fullResult += data.message.content;
                  tokens++;
                  
                  // Show progress without overwhelming the console
                  if (tokens % 5 === 0) {
                    process.stdout.write('.');
                    progressDots++;
                    if (progressDots % 50 === 0) {
                      process.stdout.write(`\n  `);
                    }
                  }
                }
                
                // Check if this is the final message
                if (data.done === true) {
                  console.log('  Done signal received from Ollama.');
                }
              } catch (e) {
                console.warn(`Warning: Could not parse streaming response chunk: ${line}\nError: ${e}`);
              }
            }
          }
        } finally {
          reader.releaseLock();
          
          // Clean up any remaining timeouts
          clearTimeout(initialTimeout);
          if (inactivityTimeout) clearTimeout(inactivityTimeout);
        }
        
        const endTime = Date.now();
        const processingTime = (endTime - startTime) / 1000;
        
        console.log(`\n----- RECEIVED COMPLETE RESPONSE FROM OLLAMA -----`);
        console.log(`Processing time: ${processingTime.toFixed(2)} seconds`);
        console.log(`Response length: ${fullResult.length} chars`);
        console.log(`Tokens received during streaming: ~${tokens}`);
        console.log(`First 100 chars: ${fullResult.substring(0, 100)}...`);
        
        // Calculate generation speed
        const tokensPerSecond = tokens / processingTime;
        console.log(`Generation speed: ${tokensPerSecond.toFixed(2)} tokens/second`);
        
        // We no longer need to warn about fast responses since we can SEE the model generating
        console.log(`\n✅ Model is confirmed working - observed ${tokens} streaming updates over ${processingTime.toFixed(2)} seconds`);
        
        // Return the complete response
        return fullResult;
      } catch (error: unknown) {
        // Clean up any remaining timeouts
        clearTimeout(initialTimeout);
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
        
        // Handle AbortError (timeout)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Connection to Ollama timed out. The server might be down, busy, or the generation stalled.`);
        }
        throw error;
      }
    } catch (error: unknown) {
      console.error('Error calling Ollama API:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get completion from Ollama: ${errorMessage}`);
    }
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for Ollama
  }
}

async function runTests() {
  // Initialize the TestExecutor
  const testExecutor = new TestExecutor({
    logging: {
      level: 'info',
      screenshots: false
    }
  });
  
  // Get configuration from environment variables or use defaults
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3';
  const contextSize = parseInt(process.env.CONTEXT_SIZE || '16384');
  
  console.log(`Using Ollama configuration:
  - URL: ${ollamaUrl}
  - Model: ${ollamaModel}
  - Context Size: ${contextSize}`);
  
  // Create the Ollama adapter
  const ollamaAdapter = new OllamaAdapter({
    baseUrl: ollamaUrl,
    model: ollamaModel,
    contextSize: contextSize
  });
  
  try {
    // Try to initialize to check if Ollama is available
    console.log('Initializing Ollama adapter...');
    await ollamaAdapter.initialize();
    
    // Register the Ollama adapter as the LLM adapter
    testExecutor.registerAdapter('llm', ollamaAdapter);
    console.log('Ollama adapter registered successfully.');
    
    // Also register an API adapter for API tests
    const apiAdapter = new APIAdapter({
      baseUrl: 'http://localhost:3000'
    });
    
    // Register API adapter
    testExecutor.registerAdapter('api', apiAdapter);
    console.log('API adapter registered successfully.');
  } catch (error: unknown) {
    console.error('Failed to initialize Ollama adapter. Using fallback configuration.');
    
    // Implementation detail: This is commented out - you would need to add a fallback adapter
    // or handle this case more gracefully in a production environment.
    // If Ollama is not available, we can't run the tests as they require LLM capabilities.
    throw error;
  }

  // Find all test scenario files in the tests directory recursively
  const testFiles = await findTestFiles(path.resolve(__dirname));
  console.log(`Found ${testFiles.length} test files`);

  // Run all tests and collect results
  let passedTests = 0;
  let failedTests = 0;

  for (const testFile of testFiles) {
    console.log(`Running test: ${path.relative(__dirname, testFile)}`);
    try {
      const result = await testExecutor.runScenario(testFile);
      
      if (result.success) {
        console.log(`✅ Test passed: ${path.basename(testFile)}`);
        passedTests++;
      } else {
        console.log(`❌ Test failed: ${path.basename(testFile)}`);
        
        // Show failing steps
        result.stepResults
          .filter(step => !step.success)
          .forEach(step => {
            console.log(`  - Failed at step: ${step.step}`);
            console.log(`    Error: ${step.error}`);
          });
          
        failedTests++;
      }
    } catch (error) {
      console.error(`Error running test ${testFile}:`, error);
      failedTests++;
    }
  }

  // Print summary
  console.log('\nTest Summary:');
  console.log(`Total: ${testFiles.length}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);

  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

/**
 * Find all .md files recursively in a directory
 */
async function findTestFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  const files: string[] = [];
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      // Recursively search subdirectories
      const subFiles = await findTestFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Add markdown files
      files.push(fullPath);
    }
  }
  
  return files;
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
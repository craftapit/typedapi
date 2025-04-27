/**
 * This is an example of integrating TypedAPI with OllamaAdapter.
 * It demonstrates how to use the LLM-powered testing capabilities for TypedAPI contracts.
 */
import * as path from 'path';
import { OllamaAdapter } from '@craftapit/tester';
import { TypedAPIAdapter, TypedAPIAddon } from '@craftapit/typedapi-tester-addon';
import { TestExecutor, CapabilityRegistry } from '@craftapit/tester';

/**
 * Main function to run TypedAPI tests with Ollama
 */
async function runTypedAPITestWithOllama() {
  console.log('Starting TypedAPI tests with Ollama...');
  
  // Determine base directory for contracts
  const contractsDir = path.join(__dirname, '../example/contracts');
  
  // Initialize the capability registry with vector caching
  const registry = new CapabilityRegistry({
    cachingEnabled: true,
    cacheFilePath: path.join(__dirname, '.cache', 'typedapi-tests-cache.json')
  });
  
  // Create and configure the Ollama adapter
  const ollamaAdapter = new OllamaAdapter({
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3',
    contextSize: parseInt(process.env.CONTEXT_SIZE || '16384', 10),
    dynamicContextSizing: process.env.DYNAMIC_SIZING?.toLowerCase() !== 'false'
  });
  
  // Create and configure the TypedAPI adapter
  const typedApiAdapter = new TypedAPIAdapter({
    contractsBasePath: contractsDir,
    validation: {
      strictMode: true,
      validateTypes: true
    }
  });
  
  try {
    // Initialize the adapters
    console.log('Initializing adapters...');
    await ollamaAdapter.initialize();
    await typedApiAdapter.initialize();
    
    // Register adapters with the registry
    registry.registerAdapter('llm', ollamaAdapter);
    registry.registerAdapter('typedapi', typedApiAdapter);
    registry.setLLMAdapter(ollamaAdapter);
    
    // Create and register the TypedAPI addon
    const addon = new TypedAPIAddon(registry);
    addon.registerCapabilities();
    
    // Create the test executor
    const executor = new TestExecutor(registry);
    
    // Define a simple test scenario in markdown format
    const testScenario = `
# TypedAPI Contract Validation Test

## Scenario: Validating a TypedAPI contract

In this scenario, we'll validate a TypedAPI contract for correctness.

### Steps

1. Load the TypedAPI contract from 'example-contract.ts'
2. Validate the contract structure
3. Check the request schema
4. Check the response schema
5. Generate a mock request based on the contract
6. Validate the mock request against the contract

### Expected Results

- The contract should be valid
- The request schema should match the contract
- The response schema should match the contract
- The mock request should be valid
`;

    // Execute the test scenario
    console.log('Executing TypedAPI test scenario...');
    const results = await executor.executeScenario(testScenario);
    
    // Log the results
    console.log('\nTest Results:');
    console.log(`- Total steps: ${results.steps.length}`);
    console.log(`- Passed steps: ${results.steps.filter(s => s.status === 'passed').length}`);
    console.log(`- Failed steps: ${results.steps.filter(s => s.status === 'failed').length}`);
    console.log(`- Skipped steps: ${results.steps.filter(s => s.status === 'skipped').length}`);
    
    // Show detailed results for each step
    console.log('\nDetailed Results:');
    results.steps.forEach((step, index) => {
      console.log(`Step ${index + 1}: ${step.description}`);
      console.log(`  Status: ${step.status}`);
      if (step.error) {
        console.log(`  Error: ${step.error}`);
      }
      if (step.output) {
        console.log(`  Output: ${JSON.stringify(step.output).substring(0, 100)}...`);
      }
      console.log('');
    });
  } catch (error) {
    console.error('Error running tests:', error);
  } finally {
    // Clean up
    await ollamaAdapter.cleanup();
    await typedApiAdapter.cleanup();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runTypedAPITestWithOllama()
    .then(() => console.log('Test completed'))
    .catch(err => console.error('Test failed:', err))
    .finally(() => process.exit());
}
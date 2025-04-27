import { TestExecutor, CapabilityRegistry, OllamaAdapter, LLMAdapter } from 'craft-a-tester';
import { TypedAPIAddon } from '../../craft-a-tester-typedapi/src';
import * as path from 'path';

/**
 * Run tests with Ollama integration, reusing the existing OllamaAdapter
 */
async function runWithOllama() {
  console.log("\n========== Running TypedAPI Tests with Ollama Integration ==========\n");

  // Get Ollama configuration from environment variables
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'phi4:14b-fp16';
  const contextSize = parseInt(process.env.CONTEXT_SIZE || '16384');
  
  console.log(`Ollama Configuration:`);
  console.log(`- URL: ${ollamaUrl}`);
  console.log(`- Model: ${ollamaModel}`);
  console.log(`- Context Size: ${contextSize}`);

  try {
    // Create capability registry
    const registry = new CapabilityRegistry();
    console.log("Created capability registry");

    // Initialize Ollama adapter from craft-a-tester
    const ollamaAdapter = new OllamaAdapter({
      baseUrl: ollamaUrl,
      model: ollamaModel,
      contextSize: contextSize,
      dynamicContextSizing: true
    });
    
    try {
      await ollamaAdapter.initialize();
      console.log("Initialized Ollama adapter successfully");
      
      // Register Ollama as LLM adapter
      registry.setLLMAdapter(ollamaAdapter);
      console.log("Registered Ollama as LLM adapter");
    } catch (error) {
      console.error("Failed to initialize Ollama adapter:", error);
      console.log("Continuing with limited functionality (no LLM capability resolution)");
    }

    // Create and register TypedAPI addon
    const typedAPIAddon = new TypedAPIAddon({
      contractsBasePath: path.resolve(__dirname, '../../shared/contracts'),
      validation: {
        strictMode: true,
        validateTypes: true,
        validatePaths: true
      }
    });
    
    typedAPIAddon.register(registry);
    console.log("Registered TypedAPI addon with registry");

    // Get the TypedAPI adapter for direct calls
    const typedAPIAdapter = typedAPIAddon.getTypedAPIAdapter();
    await typedAPIAdapter.initialize();
    console.log("TypedAPI adapter initialized");

    // Test capability resolution if Ollama is available
    console.log("\n----- Testing LLM Capability Resolution -----");
    
    const naturalLanguageQueries = [
      "Validate the admin API key contract structure",
      "Check if the request type in the admin.api-key.get.contracts.ts is valid",
      "Generate a mock response based on the admin API key contract schema"
    ];
    
    for (const query of naturalLanguageQueries) {
      console.log(`\nProcessing natural language query: "${query}"`);
      
      try {
        const resolution = await registry.findCapabilityForAction(query);
        
        if (resolution) {
          console.log(`✅ Resolved to capability: ${resolution.capability.name}`);
          console.log(`Parameters: ${JSON.stringify(resolution.parameters)}`);
          console.log(`Confidence: ${resolution.confidence.toFixed(2)}`);
          
          // Execute the resolved capability
          console.log(`\nExecuting resolved capability...`);
          const result = await registry.executeCapability(
            resolution.capability.name, 
            resolution.parameters
          );
          
          console.log(`Execution result success: ${result.success}`);
        } else {
          console.log(`❌ Failed to resolve capability from query`);
          
          // Fall back to direct API calls if resolution fails
          console.log(`Falling back to direct API calls...`);
          
          // Default to validating the admin API key contract
          const contractPath = 'admin.api-key.get.contracts.ts';
          
          if (query.includes('request type')) {
            const result = await typedAPIAdapter.validateRequestType(contractPath);
            console.log(`Direct validateRequestType result success: ${result.success}`);
          } else if (query.includes('response') || query.includes('mock')) {
            const result = await typedAPIAdapter.generateMockResponse(contractPath);
            console.log(`Direct generateMockResponse result success: ${result.success}`);
          } else {
            const result = await typedAPIAdapter.validateContract(contractPath);
            console.log(`Direct validateContract result success: ${result.success}`);
          }
        }
      } catch (error) {
        console.error(`Error processing query: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Test direct API calls
    console.log("\n----- Testing Direct API Calls -----");
    
    const contractPath = 'admin.api-key.get.contracts.ts';
    
    // Validate contract
    console.log("\nValidating contract directly...");
    const validationResult = await typedAPIAdapter.validateContract(contractPath);
    
    if (validationResult.success) {
      console.log("✅ Contract validation passed!");
      console.log("Details:", JSON.stringify(validationResult.details, null, 2));
    } else {
      console.log("❌ Contract validation failed!");
      console.log("Errors:", validationResult.errors);
    }
    
    // Generate mock response
    console.log("\nGenerating mock response...");
    const mockResponse = await typedAPIAdapter.generateMockResponse(contractPath);
    
    if (mockResponse.success) {
      console.log("✅ Mock response generated successfully!");
      console.log("Data sample:", JSON.stringify(mockResponse.data[0], null, 2));
    } else {
      console.log("❌ Failed to generate mock response!");
    }

    // Cleanup
    await ollamaAdapter.cleanup();
    await typedAPIAdapter.cleanup();
    console.log("\n========== TypedAPI + Ollama Tests Complete ==========\n");
  } catch (error) {
    console.error("Error running tests:", error);
  }
}

// Run if executed directly
if (require.main === module) {
  runWithOllama().catch(error => {
    console.error("Error running Ollama test:", error);
    process.exit(1);
  });
}

export default runWithOllama;
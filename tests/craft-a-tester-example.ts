import { TestExecutor, CapabilityRegistry } from 'craft-a-tester';
import { TypedAPIAddon } from '../../craft-a-tester-typedapi/src';
import * as path from 'path';

/**
 * Run TypedAPI tests using craft-a-tester and craft-a-tester-typedapi
 */
async function runTypedApiTests() {
  console.log("\n========== Running TypedAPI Tests with craft-a-tester-typedapi ==========\n");

  try {
    // Create capability registry
    const registry = new CapabilityRegistry();
    console.log("Created capability registry");

    // Create and register TypedAPI addon
    const typedAPIAddon = new TypedAPIAddon({
      contractsBasePath: path.resolve(__dirname, '../../shared/contracts'),
      validation: {
        strictMode: true,
        validateTypes: true,
        validatePaths: true
      }
    });
    console.log("Created TypedAPI addon");

    // Register with registry
    typedAPIAddon.register(registry);
    console.log("Registered TypedAPI addon with registry");

    // Get the TypedAPI adapter
    const typedAPIAdapter = typedAPIAddon.getTypedAPIAdapter();
    
    // Initialize the adapter
    await typedAPIAdapter.initialize();
    console.log("TypedAPI adapter initialized");

    // Log the registered capabilities
    const capabilities = registry.getAllCapabilities();
    console.log(`Registered ${capabilities.length} capabilities:`);
    capabilities.forEach(capability => {
      console.log(`- ${capability.name}: ${capability.descriptions[0]}`);
    });

    // Test specific contract file
    const contractPath = 'admin.api-key.get.contracts.ts';
    console.log(`\nTesting contract: ${contractPath}`);

    // Validate the contract
    console.log("\nValidating contract...");
    const validationResult = await typedAPIAdapter.validateContract(contractPath);
    
    if (validationResult.success) {
      console.log("✅ Contract validation passed!");
      console.log("Details:", JSON.stringify(validationResult.details, null, 2));
    } else {
      console.log("❌ Contract validation failed!");
      console.log("Errors:", validationResult.errors);
    }

    // Validate request type
    console.log("\nValidating request type...");
    const requestTypeResult = await typedAPIAdapter.validateRequestType(contractPath);
    
    if (requestTypeResult.success) {
      console.log("✅ Request type validation passed!");
      console.log("Details:", JSON.stringify(requestTypeResult.details, null, 2));
    } else {
      console.log("❌ Request type validation failed!");
      console.log("Errors:", requestTypeResult.errors);
    }

    // Validate response type
    console.log("\nValidating response type...");
    const responseTypeResult = await typedAPIAdapter.validateResponseType(contractPath);
    
    if (responseTypeResult.success) {
      console.log("✅ Response type validation passed!");
      console.log("Details:", JSON.stringify(responseTypeResult.details, null, 2));
    } else {
      console.log("❌ Response type validation failed!");
      console.log("Errors:", responseTypeResult.errors);
    }

    console.log("\n========== TypedAPI Tests Complete ==========\n");
  } catch (error) {
    console.error("Error running TypedAPI tests:", error);
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  runTypedApiTests().catch(error => {
    console.error("Error running TypedAPI tests:", error);
    process.exit(1);
  });
}

export default runTypedApiTests;
# TypedAPI Addon Configuration Tests

## Context
- Type: TypedAPI
- TestType: Configuration
- AddonName: craft-a-tester-typedapi

## Scenario: Configure Contract Base Path

### Steps
1. **Given** I have a TypedAPI addon configuration
   ```typescript
   const config = {
     contractsBasePath: './custom/contracts/path',
     validation: {
       strictMode: true
     }
   };
   ```
2. **When** I initialize the TypedAPI addon with this configuration
3. **And** I reference a contract by relative path "user/create.contract.ts"
4. **Then** the addon should look for the contract at "./custom/contracts/path/user/create.contract.ts"
5. **And** the validation should use strict mode

## Scenario: Configure Validation Options

### Steps
1. **Given** I have a TypedAPI addon with validation config
   ```typescript
   const config = {
     validation: {
       strictMode: false,
       allowExtraProperties: true,
       validateTypes: true,
       validatePaths: true
     }
   };
   ```
2. **When** I validate a contract with extra properties
   ```typescript
   // extra-props.contract.ts
   import { BaseContract } from '../base.contract';
   
   export interface RequestWithExtra {
     id: string;
     extraField: string; // Not in the URL path
   }
   
   export interface ResponseSimple {
     result: string;
   }
   
   export class ExtraPropsContract extends BaseContract<RequestWithExtra, ResponseSimple> {
     method = 'GET';
     path = '/api/resource/:id';
   }
   ```
3. **Then** the validation should succeed despite the extra field
4. **But** when strictMode is true, the same validation should fail

## Scenario: Configure Mock Data Generation

### Steps
1. **Given** I have a TypedAPI addon with mock config
   ```typescript
   const config = {
     mock: {
       generateRealisticData: true,
       locale: 'en-US',
       seed: 12345,
       customGenerators: {
         email: () => 'test@example.com'
       }
     }
   };
   ```
2. **When** I generate mock data for a user contract
   ```typescript
   // user-mock.contract.ts
   import { BaseContract } from '../base.contract';
   
   export interface UserMockRequest {
     id: string;
   }
   
   export interface UserMockResponse {
     id: string;
     name: string;
     email: string;
     age: number;
     address: {
       street: string;
       city: string;
       postalCode: string;
     }
   }
   
   export class UserMockContract extends BaseContract<UserMockRequest, UserMockResponse> {
     method = 'GET';
     path = '/api/users/:id';
   }
   ```
3. **Then** the mock data should contain realistic values for name and address
4. **And** the email should always be "test@example.com" due to the custom generator
5. **And** the same seed should produce the same mock data consistently

## Scenario: Test TypedAPI Addon Registration

### Steps
1. **Given** I have a Craft-a-Tester test executor
2. **When** I register the TypedAPI addon
   ```typescript
   import { TestExecutor } from 'craft-a-tester';
   import { TypedAPIAddon } from 'craft-a-tester-typedapi';
   
   const executor = new TestExecutor();
   const typedAPIAddon = new TypedAPIAddon();
   executor.registerAddon(typedAPIAddon);
   ```
3. **Then** the executor should have TypedAPI capabilities available
4. **And** I should be able to run TypedAPI test scenarios
5. **And** the LLM should be able to resolve TypedAPI-related steps
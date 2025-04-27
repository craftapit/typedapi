# TypedAPI Schema Type Validation Tests

## Context
- Type: Unit
- Target: TypedAPI Schema Generator
- Environment: Development

## Scenario: Enforce type checking in request schemas

### Steps
1. **Given** I have a contract definition with an untyped input:
   ```typescript
   import { z } from 'zod';
   import { Post } from '../src';
   
   // This represents an untyped schema
   const AnyBodySchema = z.record(z.any());
   
   const createUserRoute = Post('/users', {
     requestBody: AnyBodySchema, // Using a schema that allows any values
     response: {
       '201': z.object({ id: z.string() })
     }
   }, async (req, res) => {
     // Implementation
     return res.status(201).json({ id: 'new-id' });
   });
   ```
2. **When** I try to generate an OpenAPI schema from this contract
3. **Then** the schema validation should fail
4. **And** the error should contain a message about undefined or "any" types not being allowed

## Scenario: Accept properly typed Zod schemas

### Steps
1. **Given** I have a properly typed contract:
   ```typescript
   import { z } from 'zod';
   import { Post } from '../src';
   
   const createUserRoute = Post('/users', {
     requestBody: z.object({
       email: z.string().email(),
       password: z.string().min(8),
       name: z.string(),
       role: z.enum(['admin', 'user'])
     }),
     response: {
       '201': z.object({ id: z.string() })
     }
   }, async (req, res) => {
     // Implementation
     return res.status(201).json({ id: 'new-id' });
   });
   ```
2. **When** I generate an OpenAPI schema from this contract
3. **Then** the schema should be successfully created
4. **And** the schema should include the correct property types:
   - email: string with format email
   - password: string with minLength 8
   - name: string
   - role: enum with values ['admin', 'user']

## Scenario: Validate nested object types

### Steps
1. **Given** I have a contract with nested Zod objects:
   ```typescript
   import { z } from 'zod';
   import { Post } from '../src';
   
   const AddressSchema = z.object({
     street: z.string(),
     city: z.string(),
     zipCode: z.string()
   });
   
   const createUserRoute = Post('/users', {
     requestBody: z.object({
       name: z.string(),
       address: AddressSchema
     }),
     response: {
       '201': z.object({ id: z.string() })
     }
   }, async (req, res) => {
     // Implementation
     return res.status(201).json({ id: 'new-id' });
   });
   ```
2. **When** I generate an OpenAPI schema from this contract
3. **Then** the schema should properly represent the nested structure
4. **And** the address property should be an object with properties:
   - street: string
   - city: string
   - zipCode: string

## Scenario: Ensure array types are properly defined

### Steps
1. **Given** I have a contract with Zod array types:
   ```typescript
   import { z } from 'zod';
   import { Post } from '../src';
   
   const LocationSchema = z.object({
     city: z.string(),
     country: z.string()
   });
   
   const createCompanyRoute = Post('/companies', {
     requestBody: z.object({
       name: z.string(),
       employeeIds: z.array(z.string()),
       locations: z.array(LocationSchema)
     }),
     response: {
       '201': z.object({ id: z.string() })
     }
   }, async (req, res) => {
     // Implementation
     return res.status(201).json({ id: 'new-id' });
   });
   ```
2. **When** I generate an OpenAPI schema from this contract
3. **Then** the schema should represent the arrays correctly
4. **And** the employeeIds property should be an array of strings
5. **And** the locations property should be an array of objects with city and country properties
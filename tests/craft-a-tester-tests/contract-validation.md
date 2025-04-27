# TypedAPI Contract Validation Tests

## Context
- Type: TypedAPI
- TestType: UnitTest
- ContractsPath: ./shared/contracts

## Scenario: Validate Basic Contract Structure

### Steps
1. **Given** I have a TypedAPI contract file
   ```typescript
   // example.contract.ts
   import { BaseContract } from '../base.contract';
   
   export interface ExampleGetRequest {
     id: string;
   }
   
   export interface ExampleGetResponse {
     id: string;
     name: string;
     createdAt: string;
   }
   
   export class ExampleGetContract extends BaseContract<ExampleGetRequest, ExampleGetResponse> {
     method = 'GET';
     path = '/api/example/:id';
   }
   ```
2. **When** I validate the contract structure
3. **Then** the contract should have a valid method "GET"
4. **And** the contract should have a valid path "/api/example/:id"
5. **And** the request type should have required field "id"
6. **And** the response type should have required fields "id", "name", and "createdAt"

## Scenario: Detect Missing Required Path Parameters

### Steps
1. **Given** I have a TypedAPI contract with path parameters
   ```typescript
   // user.contract.ts
   import { BaseContract } from '../base.contract';
   
   export interface UserGetRequest {
     // Missing id parameter that is in the path
   }
   
   export interface UserGetResponse {
     id: string;
     username: string;
   }
   
   export class UserGetContract extends BaseContract<UserGetRequest, UserGetResponse> {
     method = 'GET';
     path = '/api/users/:id';
   }
   ```
2. **When** I validate the contract against path parameters
3. **Then** the validation should fail
4. **And** the error should indicate "Missing path parameter 'id' in request type"

## Scenario: Validate Contract with Query Parameters

### Steps
1. **Given** I have a TypedAPI contract with query parameters
   ```typescript
   // search.contract.ts
   import { BaseContract } from '../base.contract';
   
   export interface SearchRequest {
     query: string;
     page?: number;
     limit?: number;
   }
   
   export interface SearchResponse {
     results: {
       id: string;
       title: string;
     }[];
     total: number;
     page: number;
   }
   
   export class SearchContract extends BaseContract<SearchRequest, SearchResponse> {
     method = 'GET';
     path = '/api/search';
   }
   ```
2. **When** I validate the contract query parameters
3. **Then** the request type should have required field "query"
4. **And** the request type should have optional fields "page" and "limit"
5. **And** the response type should have required fields "results", "total", and "page"
6. **And** the "results" field should be an array

## Scenario: Test Contract Type Generation

### Steps
1. **Given** I have a TypedAPI contract for a CRUD service
   ```typescript
   // crud.contract.ts
   import { BaseContract } from '../base.contract';
   
   export interface CreateItemRequest {
     name: string;
     description: string;
   }
   
   export interface CreateItemResponse {
     id: string;
     name: string;
     description: string;
     createdAt: string;
   }
   
   export class CreateItemContract extends BaseContract<CreateItemRequest, CreateItemResponse> {
     method = 'POST';
     path = '/api/items';
   }
   ```
2. **When** I generate TypeScript types for this contract
3. **Then** the generated types should include "CreateItemRequest" and "CreateItemResponse"
4. **And** the "CreateItemRequest" type should have required properties "name" and "description"
5. **And** the "CreateItemResponse" type should extend "CreateItemRequest" with additional fields "id" and "createdAt"
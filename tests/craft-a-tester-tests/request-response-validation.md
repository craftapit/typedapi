# TypedAPI Request/Response Validation Tests

## Context
- Type: TypedAPI
- TestType: Integration
- ContractsPath: ./shared/contracts

## Scenario: Validate Request Against Contract

### Steps
1. **Given** I have a TypedAPI contract for a user creation endpoint
   ```typescript
   // user-create.contract.ts
   import { BaseContract } from '../base.contract';
   
   export interface UserCreateRequest {
     username: string;
     email: string;
     password: string;
     age: number;
   }
   
   export interface UserCreateResponse {
     id: string;
     username: string;
     email: string;
     createdAt: string;
   }
   
   export class UserCreateContract extends BaseContract<UserCreateRequest, UserCreateResponse> {
     method = 'POST';
     path = '/api/users';
   }
   ```
2. **When** I create a request object
   ```json
   {
     "username": "testuser",
     "email": "test@example.com",
     "password": "Password123",
     "age": 30
   }
   ```
3. **Then** the request should validate successfully against the contract
4. **And** no validation errors should be reported

## Scenario: Detect Invalid Request Type

### Steps
1. **Given** I have a TypedAPI contract for user registration
   ```typescript
   // user-register.contract.ts
   import { BaseContract } from '../base.contract';
   
   export interface UserRegisterRequest {
     username: string;
     email: string;
     password: string;
     confirmPassword: string;
   }
   
   export interface UserRegisterResponse {
     success: boolean;
     message: string;
     userId?: string;
   }
   
   export class UserRegisterContract extends BaseContract<UserRegisterRequest, UserRegisterResponse> {
     method = 'POST';
     path = '/api/register';
   }
   ```
2. **When** I create an invalid request object
   ```json
   {
     "username": "newuser",
     "email": "invalid-email",
     "password": "pass"
   }
   ```
3. **Then** the request should fail validation
4. **And** validation errors should include "Invalid email format" and "Missing confirmPassword field"
5. **And** validation errors should include "Password too short"

## Scenario: Validate Response Against Contract

### Steps
1. **Given** I have a TypedAPI contract for getting user profile
   ```typescript
   // user-profile.contract.ts
   import { BaseContract } from '../base.contract';
   
   export interface UserProfileRequest {
     userId: string;
   }
   
   export interface UserProfileResponse {
     userId: string;
     username: string;
     email: string;
     profile: {
       fullName: string;
       bio?: string;
       joinDate: string;
     }
   }
   
   export class UserProfileContract extends BaseContract<UserProfileRequest, UserProfileResponse> {
     method = 'GET';
     path = '/api/users/:userId/profile';
   }
   ```
2. **When** I receive a response object
   ```json
   {
     "userId": "123456",
     "username": "johndoe",
     "email": "john@example.com",
     "profile": {
       "fullName": "John Doe",
       "joinDate": "2023-01-15T00:00:00Z"
     }
   }
   ```
3. **Then** the response should validate successfully against the contract
4. **And** the optional field "bio" should be allowed to be missing

## Scenario: Mock Generation Based on Contract

### Steps
1. **Given** I have a TypedAPI contract for a product API
   ```typescript
   // product.contract.ts
   import { BaseContract } from '../base.contract';
   
   export interface ProductRequest {
     id: string;
   }
   
   export interface ProductResponse {
     id: string;
     name: string;
     price: number;
     description: string;
     category: string;
     inStock: boolean;
     tags: string[];
   }
   
   export class ProductContract extends BaseContract<ProductRequest, ProductResponse> {
     method = 'GET';
     path = '/api/products/:id';
   }
   ```
2. **When** I generate a mock response based on the contract
3. **Then** the mock response should have all required fields
4. **And** all field types should match their contract definitions
5. **And** the "tags" field should be an array of strings
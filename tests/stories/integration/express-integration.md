# TypedAPI Express Integration Test

This test verifies that TypedAPI integrates correctly with Express applications.

## Scenario: Creating Express route handlers from TypedAPI contracts

In this scenario, we'll test creating Express route handlers from TypedAPI contracts.

### Steps

1. Load the example contract from 'example-contract.ts'
2. Create an Express application
3. Register the contract as an Express route
4. Verify that the route is correctly registered with the correct HTTP method
5. Check that path parameters are properly mapped

### Expected Results

- The Express route should be registered successfully
- The route path should match the contract path
- The HTTP method should match the contract method
- Path parameters should be properly mapped to Express route parameters

## Scenario: Request handling and validation in Express

In this scenario, we'll test how TypedAPI validates and processes requests in an Express context.

### Steps

1. Create an Express app with a TypedAPI contract route
2. Send a valid request to the endpoint
3. Verify that path parameters are correctly extracted
4. Check that query parameters are parsed and transformed correctly
5. Send an invalid request and verify proper error response

### Expected Results

- Valid requests should be processed correctly
- Path parameters should be extracted with the correct types
- Query parameters should be parsed and transformed correctly
- Invalid requests should receive proper validation error responses
- Validation errors should be well-structured and informative
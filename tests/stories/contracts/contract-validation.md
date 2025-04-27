# TypedAPI Contract Validation Test

This test verifies that TypedAPI contracts are properly validated for structure and correctness.

## Scenario: Validating a basic API contract

In this scenario, we'll validate a basic API contract for proper structure and field validation.

### Steps

1. Load the example contract from 'example-contract.ts'
2. Validate the overall contract structure
3. Verify that the path and method are correctly defined
4. Check that the parameters schema is valid
5. Ensure the query parameter schema handles Express string-to-number conversion correctly
6. Validate the response schema for status codes

### Expected Results

- The contract should be valid overall
- Path should start with '/' and include a parameter
- Method should be one of GET, POST, PUT, DELETE
- Parameters should be properly defined and validated with Zod
- Query parameters should properly handle string-to-number conversion for Express
- Response schema should include appropriate status codes for the HTTP method

## Scenario: Validating request and response types

In this scenario, we'll verify that request and response types are correctly defined and match the contract schemas.

### Steps

1. Load the example contract from 'example-contract.ts'
2. Check that the request parameters match the path parameters
3. Ensure query parameters have proper type transformations
4. Validate that response types are defined for each status code
5. Verify that error responses have appropriate status codes

### Expected Results

- Request parameters should match the path parameters in the route
- Query parameters should include transform functions for string-to-number conversion
- Response types should be defined for all status codes in the contract
- Error status codes should have appropriate error response structures
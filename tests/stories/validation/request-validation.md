# TypedAPI Request Validation

This test verifies that TypedAPI properly validates requests against contract schemas.

## Scenario: Validating valid requests against contracts

In this scenario, we'll test that valid requests pass validation against their contract schemas.

### Steps

1. Load the example contract from 'example-contract.ts'
2. Create a valid request with proper path parameters
3. Add valid query parameters including pagination
4. Validate the request against the contract
5. Verify that validation passes without errors

### Expected Results

- The request validation should pass
- Path parameters should be correctly validated
- Query parameters should be correctly parsed and transformed
- No validation errors should be reported

## Scenario: Catching invalid requests

In this scenario, we'll test that invalid requests fail validation with helpful error messages.

### Steps

1. Load the example contract from 'example-contract.ts'
2. Create an invalid request with a non-UUID path parameter
3. Add invalid query parameters (negative page number)
4. Validate the request against the contract
5. Verify that validation fails with appropriate error messages

### Expected Results

- The request validation should fail
- Path parameter validation should catch the invalid UUID
- Query parameter validation should catch the negative page number
- Validation errors should be detailed and helpful
# TypedAPI Tests

This directory contains test scenarios for TypedAPI written in craft-a-tester's natural language format.

## Test Categories

- **schemas**: Tests related to schema generation and validation
- **security**: Tests for security features like conditional route exposure

## Running Tests

To run these tests:

```bash
# Run tests with default configuration (qwen2.5-coder model)
npm run test

# Run tests with phi4 model
OLLAMA_MODEL="phi4:14b-fp16" npm run test

# Run tests with custom Ollama server URL
OLLAMA_URL="http://your-ollama-server:11434" OLLAMA_MODEL="your-model" npm run test
```

## How the Test System Works

1. **Stream-Based Inference**: The test runner uses Ollama's streaming API to show live progress as the LLM generates responses
2. **Adaptive Timeouts**: 
   - Initial 30-second timeout to establish connection
   - 60-second inactivity timeout that resets whenever new tokens arrive
   - This ensures the system won't hang indefinitely when the model is busy

3. **Model Configuration**: 
   - Uses a 16K context window by default
   - Configure through environment variables (OLLAMA_MODEL, OLLAMA_URL)

## Writing New Tests

Tests are written in Markdown using the Given-When-Then format:

```markdown
# Test Title

## Context
- Type: [Unit|Integration|API|E2E]
- Environment: [Development|Test|Production]

## Scenario: [Description]

### Steps
1. **Given** [precondition]
2. **When** [action]
3. **Then** [expected result]
```

## Test-Driven Development

These tests can be used as part of a TDD workflow:

1. Write a failing test specifying the desired behavior
2. Run the test to confirm it fails
3. Implement the feature to make the test pass
4. Refactor while ensuring the tests still pass
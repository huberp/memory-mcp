# MCP Server Testing with mcp-cli

This repository uses [wong2/mcp-cli](https://github.com/wong2/mcp-cli) for automated testing of the MCP server in GitHub Actions.

## Overview

The testing setup validates that:
- The MCP server builds successfully
- MongoDB connection is established
- MCP tools are discoverable and callable
- Server responds to basic health checks

## Local Testing

### Prerequisites

1. **Node.js 18+** installed
2. **MongoDB** running locally or via Docker
3. **mcp-cli** installed globally

### Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Install mcp-cli globally
npm install -g @wong2/mcp-cli
```

### Run Tests

#### Quick Test - List Available Tools

```bash
mcp-cli list-tools node build/index.js
```

Expected output: List of all available MCP tools (save-memories, get-memories, etc.)

#### Test Specific Tool - Health Check

```bash
mcp-cli call-tool node build/index.js health-check '{}'
```

Expected output: Health status of the server and database connection

#### Comprehensive Test Suite

```bash
# Start MongoDB (if not running)
docker compose up -d mongodb

# Run the test script
node test-mcp-server.mjs
```

This runs a comprehensive test suite that:
1. Starts the MCP server
2. Tests tool discovery
3. Tests tool execution
4. Generates a summary report

## GitHub Actions Integration

The MCP server is automatically tested on every push and pull request via GitHub Actions.

### Workflow: `.github/workflows/mcp-test.yml`

The workflow:
1. Sets up Node.js 18
2. Starts MongoDB as a service
3. Installs dependencies and builds the project
4. Installs `wong2/mcp-cli`
5. Tests tool discovery with `mcp-cli list-tools`
6. Tests tool execution with `mcp-cli call-tool`
7. Runs existing Jest tests
8. Generates a test summary

### Viewing Test Results

1. Go to the **Actions** tab in GitHub
2. Select the workflow run
3. View the test summary and detailed logs

## Available MCP Tools

The following tools can be tested with mcp-cli:

### Memory Management
- `save-memories` - Save memories to database
- `get-memories` - Retrieve all memories
- `add-memories` - Append new memories
- `clear-memories` - Clear all memories

### Context Window Caching
- `archive-context` - Archive conversation context
- `retrieve-context` - Retrieve archived context
- `score-relevance` - Score context relevance
- `create-summary` - Create context summary
- `get-summaries` - Get conversation summaries
- `search-by-tags` - Search context by tags

### System
- `health-check` - Check server and database health

## Testing Examples

### Example 1: Test Memory Storage

```bash
# Save memories
mcp-cli call-tool node build/index.js save-memories '{
  "memories": ["Test memory 1", "Test memory 2"],
  "llm": "test-llm"
}'

# Retrieve memories
mcp-cli call-tool node build/index.js get-memories '{}'
```

### Example 2: Test Health Check

```bash
mcp-cli call-tool node build/index.js health-check '{}'
```

### Example 3: Test Context Archiving

```bash
mcp-cli call-tool node build/index.js archive-context '{
  "conversationId": "test-conv",
  "contextItems": ["Message 1", "Message 2"],
  "llm": "test-llm"
}'
```

## Troubleshooting

### mcp-cli not found

```bash
npm install -g @wong2/mcp-cli
```

### MongoDB connection error

```bash
# Ensure MongoDB is running
docker compose up -d mongodb

# Or start MongoDB locally
mongod

# Set MongoDB URI
export MONGODB_URI=mongodb://localhost:27017
```

### Server doesn't start

```bash
# Check build
npm run build

# Check MongoDB connection
mongosh --eval 'db.runCommand({ ping: 1 })'

# Check for errors
MONGODB_URI=mongodb://localhost:27017 node build/index.js
```

## CI/CD Best Practices

### Manual Workflow Trigger

You can manually trigger the test workflow:
1. Go to Actions → MCP Server Testing
2. Click "Run workflow"
3. Select branch and click "Run workflow"

### Adding New Tests

To add new MCP tool tests:

1. Add test case to `.github/workflows/mcp-test.yml`
2. Use the format:
   ```yaml
   - name: Test New Tool
     run: |
       mcp-cli call-tool node build/index.js tool-name '{"param": "value"}'
   ```

3. Update `test-mcp-server.mjs` with new test methods

## Resources

- **mcp-cli Repository**: https://github.com/wong2/mcp-cli
- **MCP Documentation**: https://modelcontextprotocol.io
- **Memory MCP Server**: This repository's main README.md

## License

Same as the main project (ISC)

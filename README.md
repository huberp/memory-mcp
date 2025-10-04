# Memory MCP
[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/JamesANZ/memory-mcp)](https://archestra.ai/mcp-catalog/jamesanz__memory-mcp)

A Model Context Protocol (MCP) server for logging and retrieving memories from LLM conversations with intelligent context window caching capabilities.

## Features

- **Save Memories**: Store memories from LLM conversations with timestamps and LLM identification
- **Retrieve Memories**: Get all stored memories with detailed metadata
- **Add Memories**: Append new memories without overwriting existing ones
- **Clear Memories**: Remove all stored memories
- **Context Window Caching**: Archive, retrieve, and summarize conversation context
- **Relevance Scoring**: Automatically score archived content relevance to current context
- **Tag-based Search**: Categorize and search context by tags
- **Conversation Orchestration**: External system to manage context window caching
- **MongoDB Storage**: Persistent storage using MongoDB database

## Installation

### Prerequisites

- Node.js 18+ 
- MongoDB 4.4+ (local or cloud instance like MongoDB Atlas)

### MongoDB Setup

#### Option 1: Local MongoDB Installation

1. **macOS** (using Homebrew):
   ```bash
   brew tap mongodb/brew
   brew install mongodb-community
   brew services start mongodb-community
   ```

2. **Ubuntu/Debian**:
   ```bash
   sudo apt-get install -y mongodb-org
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

3. **Windows**: Download and install from [MongoDB Download Center](https://www.mongodb.com/try/download/community)

#### Option 2: MongoDB Atlas (Cloud)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Get your connection string (it looks like `mongodb+srv://username:password@cluster.mongodb.net/`)
4. Whitelist your IP address in Network Access settings

### Project Setup

1. Install dependencies:

```bash
npm install
```

2. Build the project:

```bash
npm run build
```

## Docker Deployment (Quick Start)

The easiest way to run memory-mcp is using Docker with the included docker-compose setup.

### Prerequisites

- Docker (20.10+)
- Docker Compose (v2.0+)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/huberp/memory-mcp.git
cd memory-mcp

# Start all services (MCP server + MongoDB)
docker compose up -d

# View logs
docker compose logs -f memory-mcp

# Check status
docker compose ps
```

Your MCP server is now running with persistent MongoDB storage!

### Docker Architecture

The setup includes:
- **memory-mcp**: The MCP server application
- **mongodb**: MongoDB 6.0 database
- **mongodb-data**: Named volume for persistent storage

Data persists across container restarts automatically.

### Customizing Configuration

Create a `.env` file from the example:

```bash
cp .env.example .env
# Edit .env with your settings
```

Or modify environment variables directly in `docker-compose.yml`.

### Common Docker Commands

```bash
# Stop services (data persists)
docker compose down

# Stop and remove all data
docker compose down -v

# Restart services
docker compose restart

# View MongoDB data
docker compose exec mongodb mongosh

# Backup MongoDB data
docker compose exec mongodb mongodump --out=/data/backup
```

### Troubleshooting Docker

- **Connection refused**: Wait ~30 seconds for MongoDB health check
- **Data lost**: Don't use `-v` flag unless you want to delete data
- **Port conflicts**: Modify ports in docker-compose.yml if 27017 is in use
- **Build failures**: Run `docker compose build --no-cache`

For advanced deployment options, see [Production Deployment](#production-deployment).

## Configuration

All configuration can be set via environment variables. Create a `.env` file or export these variables:

### MongoDB Configuration

```bash
# MongoDB connection URI (required for remote databases)
export MONGODB_URI="mongodb://localhost:27017"
# For production with MongoDB Atlas:
export MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/"

# Database and collection names (optional, with defaults)
export MONGODB_DATABASE="memory_mcp"           # Default: memory_mcp
export MONGODB_COLLECTION="memories"           # Default: memories
export MONGODB_STATE_COLLECTION="conversation_states"  # Default: conversation_states

# Connection timeouts (optional, in milliseconds)
export MONGODB_SERVER_SELECTION_TIMEOUT="5000"  # Default: 5000ms
export MONGODB_CONNECT_TIMEOUT="10000"          # Default: 10000ms
export MONGODB_SOCKET_TIMEOUT="45000"           # Default: 45000ms
```

### Orchestrator Configuration

```bash
# Context window limits
export MAX_WORD_COUNT="8000"              # Default: 8000 words

# Archiving and retrieval thresholds (0-1)
export ARCHIVE_THRESHOLD="0.8"            # Archive when 80% full (default: 0.8)
export RETRIEVE_THRESHOLD="0.3"           # Retrieve when 30% full (default: 0.3)
export ARCHIVE_PERCENTAGE="0.3"           # Archive oldest 30% (default: 0.3)

# Relevance scoring
export MIN_RELEVANCE_SCORE="0.2"          # Minimum score to retrieve (default: 0.2)
export RETRIEVE_LIMIT="5"                 # Max items to retrieve (default: 5)
export SUMMARY_THRESHOLD="20"             # Recommend summary after N items (default: 20)

# Recommendation thresholds (0-1)
export RECOMMENDATION_HIGH_USAGE="0.9"    # Warn at 90% full (default: 0.9)
export RECOMMENDATION_MEDIUM_USAGE="0.7"  # Suggest archive at 70% (default: 0.7)
export RECOMMENDATION_LOW_USAGE="0.2"     # Suggest retrieve at 20% (default: 0.2)
```

### Validation Configuration

```bash
# Input validation limits
export MAX_INPUT_LENGTH="10000"           # Max chars per input (default: 10000)
export MAX_ARRAY_ITEMS="100"              # Max array items (default: 100)
export MAX_TAGS="50"                      # Max tags per item (default: 50)
export MAX_TAG_LENGTH="100"               # Max chars per tag (default: 100)
export MAX_CONVERSATION_ID_LENGTH="256"   # Max conversation ID length (default: 256)
export MAX_LLM_NAME_LENGTH="100"          # Max LLM name length (default: 100)
export MAX_USER_ID_LENGTH="256"           # Max user ID length (default: 256)
```

### Logging Configuration

```bash
export LOG_LEVEL="info"  # Options: debug, info, warn, error (default: info)
```

**Security Note:** The server validates MongoDB connection strings and warns if using the default insecure connection. For production deployments, always use authenticated connections with proper credentials.

## Performance & Reliability Features

### Database Indexes
The server automatically creates optimized indexes on first connection for:
- Conversation and context type queries (100-1000x faster)
- Tag-based searches
- Relevance score sorting
- Timestamp-based retrieval

### Batch Operations
Relevance scoring uses batch operations (`bulkWrite`) instead of individual updates:
- 10-100x performance improvement
- Reduces database load
- Single network round-trip

### State Persistence
Conversation states are automatically persisted to MongoDB:
- Survives server restarts
- No data loss on crashes
- Enables horizontal scaling
- Automatic save/load on state changes

## Testing

### Unit Tests

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

The project includes comprehensive unit tests with ~37% code coverage.

### MCP Server Testing

The MCP server is tested using [wong2/mcp-cli](https://github.com/wong2/mcp-cli) for automated integration testing.

```bash
# Install mcp-cli globally
npm install -g @wong2/mcp-cli

# List available MCP tools
mcp-cli list-tools node build/index.js

# Test health check tool
mcp-cli call-tool node build/index.js health-check '{}'

# Run comprehensive MCP tests
node test-mcp-server.mjs
```

For detailed MCP testing instructions, see [MCP_TESTING_GUIDE.md](MCP_TESTING_GUIDE.md).

### GitHub Actions

The project includes automated testing via GitHub Actions that runs on every push and pull request:
- Unit tests (Jest)
- MCP server integration tests (mcp-cli)
- MongoDB connectivity tests
- Build verification

View test results in the **Actions** tab of the repository.

## Usage

### Running the MCP Server

Start the MCP server:

```bash
npm start
```

### Running the Conversation Orchestrator Demo

Try the interactive CLI demo:

```bash
npm run cli
```

The CLI demo allows you to:

- Add messages to simulate conversation
- See automatic archiving when context gets full
- Trigger manual archiving and retrieval
- Create summaries of archived content
- Monitor conversation status and get recommendations

### Basic Memory Tools

1. **save-memories**: Save all memories to the database, overwriting existing ones
   - `memories`: Array of memory strings to save
   - `llm`: Name of the LLM (e.g., 'chatgpt', 'claude')
   - `userId`: Optional user identifier

2. **get-memories**: Retrieve all memories from the database
   - No parameters required

3. **add-memories**: Add new memories to the database without overwriting existing ones
   - `memories`: Array of memory strings to add
   - `llm`: Name of the LLM (e.g., 'chatgpt', 'claude')
   - `userId`: Optional user identifier

4. **clear-memories**: Clear all memories from the database
   - No parameters required

### Context Window Caching Tools

5. **archive-context**: Archive context messages for a conversation with tags and metadata
   - `conversationId`: Unique identifier for the conversation
   - `contextMessages`: Array of context messages to archive
   - `tags`: Tags for categorizing the archived content
   - `llm`: Name of the LLM (e.g., 'chatgpt', 'claude')
   - `userId`: Optional user identifier

6. **retrieve-context**: Retrieve relevant archived context for a conversation
   - `conversationId`: Unique identifier for the conversation
   - `tags`: Optional tags to filter by
   - `minRelevanceScore`: Minimum relevance score (0-1, default: 0.1)
   - `limit`: Maximum number of items to return (default: 10)

7. **score-relevance**: Score the relevance of archived context against current conversation context
   - `conversationId`: Unique identifier for the conversation
   - `currentContext`: Current conversation context to compare against
   - `llm`: Name of the LLM (e.g., 'chatgpt', 'claude')

8. **create-summary**: Create a summary of context items and link them to the summary
   - `conversationId`: Unique identifier for the conversation
   - `contextItems`: Context items to summarize
   - `summaryText`: Human-provided summary text
   - `llm`: Name of the LLM (e.g., 'chatgpt', 'claude')
   - `userId`: Optional user identifier

9. **get-conversation-summaries**: Get all summaries for a specific conversation
   - `conversationId`: Unique identifier for the conversation

10. **search-context-by-tags**: Search archived context and summaries by tags
    - `tags`: Tags to search for

### Example Usage in LLM

#### Basic Memory Operations

1. **Save all memories** (overwrites existing):

   ```
   User: "Save all my memories from this conversation to the MCP server"
   LLM: [Uses save-memories tool with current conversation memories]
   ```

2. **Retrieve all memories**:
   ```
   User: "Get all my memories from the MCP server"
   LLM: [Uses get-memories tool to retrieve stored memories]
   ```

#### Context Window Caching Workflow

1. **Archive context when window gets full**:

   ```
   User: "The conversation is getting long, archive the early parts"
   LLM: [Uses archive-context tool to store old messages with tags]
   ```

2. **Score relevance of archived content**:

   ```
   User: "How relevant is the archived content to our current discussion?"
   LLM: [Uses score-relevance tool to evaluate archived content]
   ```

3. **Retrieve relevant archived context**:

   ```
   User: "Bring back the relevant archived information"
   LLM: [Uses retrieve-context tool to get relevant archived content]
   ```

4. **Create summaries for long conversations**:
   ```
   User: "Summarize the early parts of our conversation"
   LLM: [Uses create-summary tool to condense archived content]
   ```

## Conversation Orchestration System

The `ConversationOrchestrator` class provides automatic context window management:

### Key Features

- **Automatic Archiving**: Archives content when context usage reaches 80%
- **Intelligent Retrieval**: Retrieves relevant content when usage drops below 30%
- **Relevance Scoring**: Uses keyword overlap to score archived content relevance
- **Smart Tagging**: Automatically generates tags based on content keywords
- **Conversation State Management**: Tracks active conversations and their context
- **Recommendations**: Provides suggestions for optimal context management

### Usage Example

```typescript
import { ConversationOrchestrator } from "./orchestrator.js";

const orchestrator = new ConversationOrchestrator(8000); // 8k word limit

// Add a message (triggers automatic archiving/retrieval)
const result = await orchestrator.addMessage(
  "conversation-123",
  "This is a new message in the conversation",
  "claude",
);

// Check if archiving is needed
if (result.archiveDecision?.shouldArchive) {
  await orchestrator.executeArchive(result.archiveDecision, result.state);
}

// Check if retrieval is needed
if (result.retrievalDecision?.shouldRetrieve) {
  await orchestrator.executeRetrieval(result.retrievalDecision, result.state);
}
```

## Database Schema

### Basic Memory Structure

```typescript
type BasicMemory = {
  _id: ObjectId;
  memories: string[]; // Array of memory strings
  timestamp: Date; // When memories were saved
  llm: string; // LLM identifier (e.g., 'chatgpt', 'claude')
  userId?: string; // Optional user identifier
};
```

### Extended Memory Structure (Context Caching)

```typescript
type ExtendedMemory = {
  _id: ObjectId;
  memories: string[]; // Array of memory strings
  timestamp: Date; // When memories were saved
  llm: string; // LLM identifier
  userId?: string; // Optional user identifier
  conversationId?: string; // Unique conversation identifier
  contextType?: "active" | "archived" | "summary";
  relevanceScore?: number; // 0-1 relevance score
  tags?: string[]; // Categorization tags
  parentContextId?: ObjectId; // Reference to original content for summaries
  messageIndex?: number; // Order within conversation
  wordCount?: number; // Size tracking
  summaryText?: string; // Condensed version
};
```

## Context Window Caching Workflow

The orchestration system automatically:

1. **Monitors conversation length** and context usage
2. **Archives content** when context usage reaches 80%
3. **Scores relevance** of archived content against current context
4. **Retrieves relevant content** when usage drops below 30%
5. **Creates summaries** to condense very long conversations

### Key Features

- **Conversation Grouping**: All archived content is linked to specific conversation IDs
- **Relevance Scoring**: Simple keyword overlap scoring (can be enhanced with semantic similarity)
- **Tag-based Organization**: Categorize content for easy retrieval
- **Summary Linking**: Preserve links between summaries and original content
- **Backward Compatibility**: All existing memory functions work unchanged
- **Automatic Management**: No manual intervention required for basic operations

## Development

To run in development mode:

```bash
npm run build
node build/index.js
```

To run the CLI demo:

```bash
npm run cli
```

## Troubleshooting

### Common Issues

#### 1. MongoDB Connection Issues

**Problem**: `MongoServerSelectionError: connect ECONNREFUSED`

**Solutions**:
- Verify MongoDB is running: `mongod --version` or `brew services list | grep mongodb`
- Check connection string format
- For MongoDB Atlas: Verify IP is whitelisted in Network Access
- Check firewall settings

**Problem**: `MongoServerError: bad auth : Authentication failed`

**Solutions**:
- Verify username and password in connection string
- Check database user has proper permissions
- URL-encode special characters in password

#### 2. Build Errors

**Problem**: TypeScript compilation errors

**Solutions**:
- Ensure Node.js version is 18+: `node --version`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear build cache: `rm -rf build && npm run build`

#### 3. Test Failures

**Problem**: Tests fail with database errors

**Solutions**:
- Tests use in-memory mock, should not require real MongoDB
- Check for port conflicts on 27017
- Try: `npm test -- --clearCache`

#### 4. Performance Issues

**Problem**: Slow queries or high memory usage

**Solutions**:
- Check indexes are created: Look for "✅ Database indexes created" in logs
- Reduce `MAX_WORD_COUNT` if running low on memory
- Increase `MONGODB_SOCKET_TIMEOUT` for slow networks
- Use field projection (automatically enabled in v1.0+)

#### 5. Validation Errors

**Problem**: `ValidationError: Input exceeds maximum length`

**Solutions**:
- Increase validation limits via environment variables
- Check input size before sending to tools
- Split large inputs into smaller chunks

### Debug Mode

Enable detailed logging:

```bash
export LOG_LEVEL="debug"
npm start
```

### Checking System Status

Use the CLI to check conversation status:

```bash
npm run cli
# Then type: status
```

## Production Deployment

### Prerequisites

- MongoDB instance with authentication enabled
- Secure network connection (VPN or private network)
- Environment variables configured
- SSL/TLS encryption for MongoDB connections

### Deployment Checklist

- [ ] Use MongoDB Atlas or self-hosted MongoDB with authentication
- [ ] Set strong database credentials
- [ ] Configure appropriate connection timeouts
- [ ] Enable SSL/TLS for database connections
- [ ] Set proper input validation limits
- [ ] Configure log level to `warn` or `error`
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategy for MongoDB
- [ ] Test failover scenarios
- [ ] Document environment configuration

### Example Production Configuration

```bash
# .env.production
MONGODB_URI="mongodb+srv://produser:strongpassword@prod-cluster.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DATABASE="memory_mcp_prod"
MONGODB_CONNECT_TIMEOUT="10000"
MONGODB_SOCKET_TIMEOUT="45000"

MAX_WORD_COUNT="16000"
ARCHIVE_THRESHOLD="0.85"
RETRIEVE_THRESHOLD="0.25"

MAX_INPUT_LENGTH="50000"
MAX_ARRAY_ITEMS="500"

LOG_LEVEL="warn"
```

### Deployment Options

#### Option 1: Docker (Recommended)

The repository includes complete Docker support with Docker Compose for easy deployment.

**Quick Start:**

```bash
# Start all services (MCP server + MongoDB)
docker-compose up -d

# View logs
docker-compose logs -f memory-mcp

# Check status
docker-compose ps

# Stop services (data persists)
docker-compose down

# Stop and remove all data
docker-compose down -v
```

**What's Included:**

- **Dockerfile**: Multi-stage build for optimized image size
- **docker-compose.yml**: Complete orchestration with MongoDB
- **Persistent Storage**: MongoDB data stored in named volume `mongodb-data`
- **Health Checks**: Automatic service health monitoring
- **Environment Variables**: Pre-configured with sensible defaults

**Architecture:**

The Docker setup uses separate containers:
- `memory-mcp`: The MCP server application
- `mongodb`: MongoDB 6.0 database for persistent storage

**Customizing Configuration:**

Create a `.env` file or modify environment variables in `docker-compose.yml`:

```bash
# Example .env file
MONGODB_URI=mongodb://mongodb:27017
MONGODB_DATABASE=memory_mcp
MAX_WORD_COUNT=16000
ARCHIVE_THRESHOLD=0.85
LOG_LEVEL=warn
```

**Data Persistence:**

MongoDB data is stored in a Docker volume and persists across container restarts:

```bash
# Backup MongoDB data
docker-compose exec mongodb mongodump --out=/data/backup

# List volumes
docker volume ls

# Inspect the data volume
docker volume inspect memory-mcp_mongodb-data
```

**Production Deployment:**

For production, consider:
1. Enable MongoDB authentication (uncomment in docker-compose.yml)
2. Use strong passwords
3. Configure SSL/TLS for MongoDB connections
4. Set `LOG_LEVEL=warn` or `LOG_LEVEL=error`
5. Regular backups of the MongoDB volume

**Troubleshooting Docker:**

- **Connection refused**: Wait for MongoDB to be ready (health check runs automatically)
- **Data lost**: Ensure you didn't use `docker-compose down -v` which removes volumes
- **Port conflicts**: If port 27017 is in use, modify the ports in docker-compose.yml
- **Build failures**: Run `docker-compose build --no-cache` to rebuild from scratch

#### Option 2: Cloud Platforms

- **AWS**: Deploy on EC2, ECS, or Lambda with MongoDB Atlas
- **Google Cloud**: Deploy on Cloud Run or GKE with MongoDB Atlas
- **Azure**: Deploy on App Service or AKS with MongoDB Atlas
- **Heroku**: Deploy with MongoDB Atlas add-on

### Monitoring

Key metrics to monitor:

- Database connection status
- Query response times
- Archive/retrieval operation counts
- Memory usage
- Context window utilization
- Error rates

### Scaling Considerations

- **Horizontal Scaling**: Multiple instances can share the same MongoDB
- **State Persistence**: All conversation state is in MongoDB
- **Connection Pooling**: MongoDB driver handles connection pooling automatically
- **Cache Strategy**: Consider adding Redis for frequently accessed data
- **Rate Limiting**: Implement rate limiting for production API

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for all sensitive configuration
3. **Enable MongoDB authentication** in production
4. **Use SSL/TLS** for database connections
5. **Implement input validation** (built-in via validation.ts)
6. **Sanitize user inputs** (automatic in v1.0+)
7. **Regular security updates**: Keep dependencies updated
8. **Monitor for anomalies**: Set up alerting for unusual patterns

## Performance Optimization

### Database Indexes (Automatic)

The system automatically creates optimized indexes:
- Compound index on `conversationId`, `contextType`, and `relevanceScore`
- Tag search index on `tags` and `contextType`
- Timestamp index for chronological queries
- Unique index on `conversationId` for state collection

### Query Optimization (Built-in)

- Field projection reduces network transfer
- Batch operations for relevance scoring
- Connection timeout handling
- Race condition prevention

### Memory Management

- Configurable word count limits
- Automatic archiving when thresholds reached
- Lazy loading of archived content
- Summary generation for long conversations

## License

ISC

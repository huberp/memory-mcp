# SBERT Embedding Microservice

A lightweight Flask service for generating Sentence-BERT embeddings.

## Features

- **Fast embeddings**: Uses the lightweight `all-MiniLM-L6-v2` model by default
- **Batch processing**: Supports batch embedding for multiple texts
- **Health checks**: Includes health check endpoint for monitoring
- **Configurable**: Model can be changed via environment variable

## Quick Start

### Using Docker

1. Build the Docker image:
```bash
docker build -t sbert-service ./sbert-service
```

2. Run the service:
```bash
docker run -p 5000:5000 sbert-service
```

### Using Docker Compose

Add this to your `docker-compose.yml`:

```yaml
sbert:
  build: ./sbert-service
  ports:
    - "5000:5000"
  environment:
    - SBERT_MODEL=all-MiniLM-L6-v2
```

Then run:
```bash
docker-compose up sbert
```

## API Endpoints

### Health Check

```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "status": "healthy",
  "model": "all-MiniLM-L6-v2",
  "embedding_dim": 384
}
```

### Single Embedding

```bash
curl -X POST http://localhost:5000/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a sample text to embed"}'
```

Response: Array of floats (embedding vector)

### Batch Embeddings

```bash
curl -X POST http://localhost:5000/batch-embed \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Text 1", "Text 2", "Text 3"]}'
```

Response: Array of embedding vectors

## Configuration

### Environment Variables

- `SBERT_MODEL`: The Sentence-BERT model to use (default: `all-MiniLM-L6-v2`)
- `PORT`: Port to run the service on (default: `5000`)

### Available Models

Some recommended models:

- `all-MiniLM-L6-v2`: Fast and lightweight (384 dimensions)
- `all-mpnet-base-v2`: Higher quality (768 dimensions, slower)
- `paraphrase-multilingual-MiniLM-L12-v2`: Multilingual support

See [Sentence-Transformers documentation](https://www.sbert.net/docs/pretrained_models.html) for more models.

## Memory Usage

- `all-MiniLM-L6-v2`: ~90 MB
- `all-mpnet-base-v2`: ~420 MB
- Model is loaded once at startup and kept in memory

## Performance

On a modern CPU:
- Single embedding: ~10-50ms
- Batch of 10: ~50-100ms

GPU acceleration is supported if PyTorch with CUDA is installed.

## Development

### Local Installation

```bash
cd sbert-service
pip install sentence-transformers flask
python app.py
```

### Testing

```bash
# Health check
curl http://localhost:5000/health

# Test embedding
curl -X POST http://localhost:5000/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world"}'
```

## Integration with memory-mcp

Configure memory-mcp to use this service:

```bash
# .env
RELEVANCE_SCORER_TYPE=sbert
SBERT_SERVICE_URL=http://localhost:5000/embed
SBERT_MODEL=all-MiniLM-L6-v2
```

The service will be automatically used for semantic relevance scoring.

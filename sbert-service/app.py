"""
SBERT Embedding Microservice
A lightweight Flask service for generating Sentence-BERT embeddings.
"""

from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Load the model (default to all-MiniLM-L6-v2, a lightweight and fast model)
MODEL_NAME = os.environ.get('SBERT_MODEL', 'all-MiniLM-L6-v2')
logger.info(f"Loading SBERT model: {MODEL_NAME}")
model = SentenceTransformer(MODEL_NAME)
logger.info("Model loaded successfully")


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model': MODEL_NAME,
        'embedding_dim': model.get_sentence_embedding_dimension()
    })


@app.route('/embed', methods=['POST'])
def embed():
    """
    Generate embeddings for input text
    
    Request body:
    {
        "text": "Text to embed",
        "model": "optional-model-name"  // Currently ignored, uses server model
    }
    
    Response:
    [0.123, 0.456, ...]  // Array of floats (embedding vector)
    """
    try:
        data = request.json
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing "text" field in request body'}), 400
        
        text = data['text']
        
        if not isinstance(text, str):
            return jsonify({'error': '"text" must be a string'}), 400
        
        if len(text.strip()) == 0:
            return jsonify({'error': '"text" cannot be empty'}), 400
        
        # Generate embedding
        embedding = model.encode(text, convert_to_tensor=False)
        
        # Convert to list for JSON serialization
        embedding_list = embedding.tolist()
        
        logger.info(f"Generated embedding of dimension {len(embedding_list)} for text of length {len(text)}")
        
        return jsonify(embedding_list)
    
    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        return jsonify({'error': f'Failed to generate embedding: {str(e)}'}), 500


@app.route('/batch-embed', methods=['POST'])
def batch_embed():
    """
    Generate embeddings for multiple texts
    
    Request body:
    {
        "texts": ["Text 1", "Text 2", ...],
        "model": "optional-model-name"  // Currently ignored
    }
    
    Response:
    [
        [0.123, 0.456, ...],
        [0.789, 0.012, ...],
        ...
    ]
    """
    try:
        data = request.json
        
        if not data or 'texts' not in data:
            return jsonify({'error': 'Missing "texts" field in request body'}), 400
        
        texts = data['texts']
        
        if not isinstance(texts, list):
            return jsonify({'error': '"texts" must be an array'}), 400
        
        if len(texts) == 0:
            return jsonify({'error': '"texts" cannot be empty'}), 400
        
        # Validate all items are strings
        for i, text in enumerate(texts):
            if not isinstance(text, str):
                return jsonify({'error': f'Item at index {i} is not a string'}), 400
        
        # Generate embeddings (batched for efficiency)
        embeddings = model.encode(texts, convert_to_tensor=False)
        
        # Convert to list for JSON serialization
        embeddings_list = embeddings.tolist()
        
        logger.info(f"Generated {len(embeddings_list)} embeddings")
        
        return jsonify(embeddings_list)
    
    except Exception as e:
        logger.error(f"Error generating batch embeddings: {str(e)}")
        return jsonify({'error': f'Failed to generate embeddings: {str(e)}'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting SBERT service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)

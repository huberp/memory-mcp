FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir sentence-transformers flask

# Copy application
COPY app.py /app/app.py

# Expose port
EXPOSE 5000

# Set environment variables
ENV SBERT_MODEL=all-MiniLM-L6-v2
ENV PORT=5000

# Run the application
CMD ["python", "app.py"]

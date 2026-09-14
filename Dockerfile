# Use official Python lightweight image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (required for PyMuPDF to work smoothly)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all python source files to the working directory
COPY *.py .

# Create cache and test_data directories if needed by the app
RUN mkdir -p cache test_data

# Expose the port FastAPI runs on
EXPOSE 8000

# Command to run the backend
CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000"]

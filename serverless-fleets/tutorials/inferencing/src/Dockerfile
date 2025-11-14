FROM pytorch/pytorch:2.9.0-cuda13.0-cudnn9-devel

# Install vLLM and dependencies
RUN pip install vllm accelerate
# Optional: install bitsandbytes if needed
RUN pip install bitsandbytes

# Set working directory
WORKDIR /app

# Copy your script and input file
COPY . /app

# Entrypoint
CMD ["python", "app.py"]

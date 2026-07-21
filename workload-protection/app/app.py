"""FastAPI application for Code Engine."""

import os
import time
import math
import random
import logging
import signal
import threading
import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Response, HTTPException
from fastapi.responses import PlainTextResponse
import httpx
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(name)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Configuration
HTTPBIN_BASE_URL = os.getenv("HTTPBIN_BASE_URL", "https://httpbin.org")
PORT = int(os.getenv("PORT", "8080"))

# Global server references for shutdown
app_server = None
shutdown_event = threading.Event()


def simulate_compute(duration_seconds: float, cpu_intensity: float) -> None:
    """
    Simulate CPU-intensive work for the specified duration.
    
    Args:
        duration_seconds: How long to run the computation
        cpu_intensity: CPU usage intensity (0-100)
    """
    start_time = time.time()
    end_time = start_time + duration_seconds
    
    while time.time() < end_time:
        # Perform CPU work
        work_iterations = int(cpu_intensity * 1000)
        for _ in range(work_iterations):
            _ = math.sqrt(random.random() * 1000000)
        
        # Small sleep to control CPU usage
        sleep_time = (100 - cpu_intensity) / 10000  # Convert to seconds
        time.sleep(sleep_time)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown."""
    logger.info(f"Application server is running at http://localhost:{PORT}")
    logger.info(f"Configured httpbin backend: {HTTPBIN_BASE_URL}")
    try:
        yield
    except asyncio.CancelledError:
        # Expected during shutdown, suppress the error
        logger.debug("Lifespan context cancelled during shutdown")

# Create FastAPI app
app = FastAPI(
    title="Example App",
    description="Code Engine custom example for Python",
    version="1.0.0",
    lifespan=lifespan
)

async def make_outbound_call(endpoint: str, method: str = "GET") -> Dict[str, Any]:
    """Make an outbound HTTP call."""
    url = f"{HTTPBIN_BASE_URL}{endpoint}"
    start_time = time.time()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if method == "GET":
                response = await client.get(url)
            elif method == "POST":
                response = await client.post(url)
            else:
                response = await client.request(method, url)
            
            duration = time.time() - start_time
            status_code = str(response.status_code)

            return {
                "success": True,
                "status": response.status_code,
                "duration": duration,
                "data": response.text
            }
            
    except Exception as e:
        duration = time.time() - start_time

        return {
            "success": False,
            "error": str(e),
            "duration": duration
        }


@app.get("/", response_class=PlainTextResponse)
async def health_check():
    """Health check endpoint."""
    app_name = os.getenv("CE_APP", "example-app")
    return f"app '{app_name}' is ready!"


@app.get("/outbound/delay")
async def outbound_delay():
    """Outbound call with random delay and error rate."""
    # Random delay between 0-2 seconds
    delay = random.random() * 2
    
    # 5% error rate
    should_error = random.random() < 0.05
    
    if should_error:
        result = await make_outbound_call("/status/500", "GET")
    else:
        result = await make_outbound_call(f"/delay/{delay:.1f}", "GET")
    
    # Simulate compute-intensive data handling
    compute_start = time.time()
    compute_duration = random.random() * 3  # 0-3 seconds
    cpu_intensity = 40 + random.random() * 40  # 40-80%
    simulate_compute(compute_duration, cpu_intensity)
    actual_compute_duration = time.time() - compute_start
    
    response = {
        "message": "Simulated error response" if should_error else "Outbound call completed",
        "delay": delay,
        "outboundCall": result,
        "computeTime": actual_compute_duration,
        "cpuIntensity": f"{cpu_intensity:.1f}%"
    }
    
    if should_error:
        return Response(
            content=str(response),
            status_code=500,
            media_type="application/json"
        )
    
    return response


@app.get("/outbound/get")
async def outbound_get():
    """Simple outbound GET request."""
    result = await make_outbound_call("/get", "GET")
    
    # Simulate compute-intensive data handling
    compute_start = time.time()
    compute_duration = random.random() * 3
    cpu_intensity = 40 + random.random() * 40
    simulate_compute(compute_duration, cpu_intensity)
    actual_compute_duration = time.time() - compute_start
    
    return {
        "message": "Outbound GET call completed",
        "outboundCall": result,
        "computeTime": actual_compute_duration,
        "cpuIntensity": f"{cpu_intensity:.1f}%"
    }


@app.post("/outbound/post")
async def outbound_post():
    """Outbound POST request."""
    result = await make_outbound_call("/post", "POST")
    
    # Simulate compute-intensive data handling
    compute_start = time.time()
    compute_duration = random.random() * 3
    cpu_intensity = 40 + random.random() * 40
    simulate_compute(compute_duration, cpu_intensity)
    actual_compute_duration = time.time() - compute_start
    
    return {
        "message": "Outbound POST call completed",
        "outboundCall": result,
        "computeTime": actual_compute_duration,
        "cpuIntensity": f"{cpu_intensity:.1f}%"
    }


@app.get("/outbound/status/{code}")
async def outbound_status(code: int):
    """Request specific HTTP status code."""
    result = await make_outbound_call(f"/status/{code}", "GET")
    
    # Simulate compute-intensive data handling
    compute_start = time.time()
    compute_duration = random.random() * 3
    cpu_intensity = 40 + random.random() * 40
    simulate_compute(compute_duration, cpu_intensity)
    actual_compute_duration = time.time() - compute_start
    
    return {
        "message": "Outbound call completed",
        "requestedStatus": code,
        "outboundCall": result,
        "computeTime": actual_compute_duration,
        "cpuIntensity": f"{cpu_intensity:.1f}%"
    }




# ======================================
# Server management functions
# ======================================
def run_app_server():
    """Run the main application server."""
    global app_server
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=PORT,
        log_level="info",
        log_config="log_conf.yaml"
    )
    app_server = uvicorn.Server(config)
    app_server.run()


def handle_shutdown(signum, frame):
    """Handle shutdown signals gracefully."""
    logger.info(f"Received signal {signum}. Shutting down...")
    shutdown_event.set()
    
    if app_server:
        app_server.should_exit = True


if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)
    
    # Run the main application server in the main thread
    try:
        run_app_server()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Application interrupted")
    finally:
        # Wait for graceful shutdown
        if shutdown_event.is_set():
            logger.info("Http server closed.")
        logger.info("Shutdown complete")
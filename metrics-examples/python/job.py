"""Code Engine Job with Prometheus metrics."""

import os
import time
import random
import logging
import signal
import threading
import asyncio
from typing import Dict, Any

import httpx
import uvicorn
from fastapi import FastAPI, Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Gauge

from utils.compute import simulate_compute
from utils import metrics

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(name)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Configuration
HTTPBIN_BASE_URL = os.getenv("HTTPBIN_BASE_URL", "https://httpbin.org")
ITERATIONS = int(os.getenv("JOB_ITERATIONS", "10"))
METRICS_PORT = 2112

# Job-specific metrics
METRICS_PREFIX = os.getenv("METRICS_NAME_PREFIX", "mymetrics_")

job_iterations_total = Gauge(
    f"{METRICS_PREFIX}job_iterations_total",
    "Total number of job iterations configured",
    registry=metrics.REGISTRY
)

job_iterations_completed = Gauge(
    f"{METRICS_PREFIX}job_iterations_completed",
    "Number of job iterations completed",
    registry=metrics.REGISTRY
)

job_status = Gauge(
    f"{METRICS_PREFIX}job_status",
    "Current job status (0=not started, 1=running, 2=completed, 3=failed)",
    registry=metrics.REGISTRY
)

# Global references
metrics_server = None
shutdown_event = threading.Event()
job_complete = threading.Event()


async def make_outbound_call(endpoint: str, method: str = "GET") -> Dict[str, Any]:
    """Make an outbound HTTP call and record metrics."""
    url = f"{HTTPBIN_BASE_URL}{endpoint}"
    start_time = time.time()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if method == "GET":
                response = await client.get(url)
            elif method == "POST":
                response = await client.post(url, json={"iteration": "data"})
            else:
                response = await client.request(method, url)
            
            duration = time.time() - start_time
            status_code = str(response.status_code)
            
            # Record metrics
            metrics.outbound_request_duration.labels(
                target=HTTPBIN_BASE_URL,
                method=method,
                status_code=status_code
            ).observe(duration)
            
            metrics.outbound_requests_total.labels(
                target=HTTPBIN_BASE_URL,
                method=method,
                status_code=status_code
            ).inc()
            
            return {
                "success": True,
                "status": response.status_code,
                "duration": duration,
                "data": response.text[:100]  # Truncate for logging
            }
            
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        metrics.outbound_request_duration.labels(
            target=HTTPBIN_BASE_URL,
            method=method,
            status_code="error"
        ).observe(duration)
        
        metrics.outbound_requests_total.labels(
            target=HTTPBIN_BASE_URL,
            method=method,
            status_code="error"
        ).inc()
        
        return {
            "success": False,
            "error": str(e),
            "duration": duration
        }


async def process_iteration(iteration: int) -> bool:
    """Process a single job iteration."""
    logger.info(f"Starting iteration {iteration + 1}/{ITERATIONS}")
    
    try:
        # Step 1: GET outbound call
        logger.info(f"Iteration {iteration + 1}: Making GET request")
        get_result = await make_outbound_call("/get", "GET")
        
        if not get_result["success"]:
            logger.warning(f"Iteration {iteration + 1}: GET request failed: {get_result.get('error')}")
        
        # Step 2: Calculate something (simulate compute-intensive work)
        logger.info(f"Iteration {iteration + 1}: Performing calculation")
        compute_start = time.time()
        compute_duration = 1 + random.random() * 2  # 1-3 seconds
        cpu_intensity = 50 + random.random() * 30  # 50-80%
        simulate_compute(compute_duration, cpu_intensity)
        actual_compute_duration = time.time() - compute_start
        
        metrics.compute_duration.labels(operation="job_calculation").observe(actual_compute_duration)
        logger.info(f"Iteration {iteration + 1}: Calculation completed in {actual_compute_duration:.2f}s")
        
        # Step 3: POST outbound call
        logger.info(f"Iteration {iteration + 1}: Making POST request")
        post_result = await make_outbound_call("/post", "POST")
        
        if not post_result["success"]:
            logger.warning(f"Iteration {iteration + 1}: POST request failed: {post_result.get('error')}")
        
        # Update iteration counter
        job_iterations_completed.set(iteration + 1)
        
        logger.info(f"Iteration {iteration + 1}/{ITERATIONS} completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"Iteration {iteration + 1} failed with error: {e}")
        return False


async def run_job():
    """Run the main job loop."""
    logger.info(f"Starting job with {ITERATIONS} iterations")
    logger.info(f"Configured httpbin backend: {HTTPBIN_BASE_URL}")
    
    # Set initial metrics
    job_iterations_total.set(ITERATIONS)
    job_iterations_completed.set(0)
    job_status.set(1)  # Running
    
    success_count = 0
    failure_count = 0
    
    try:
        for i in range(ITERATIONS):
            if shutdown_event.is_set():
                logger.info("Shutdown requested, stopping job")
                break
            
            success = await process_iteration(i)
            if success:
                success_count += 1
            else:
                failure_count += 1
            
            # Small delay between iterations
            if i < ITERATIONS - 1:  # Don't sleep after last iteration
                await asyncio.sleep(0.5)
        
        # Job completed
        logger.info(f"Job completed: {success_count} successful, {failure_count} failed iterations")
        job_status.set(2)  # Completed
        
    except Exception as e:
        logger.error(f"Job failed with error: {e}")
        job_status.set(3)  # Failed
        raise
    finally:
        job_complete.set()


# ======================================
# Metrics server
# ======================================
metrics_app = FastAPI(title="Job Metrics Server")


@metrics_app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )


def run_metrics_server():
    """Run the metrics server."""
    global metrics_server
    config = uvicorn.Config(
        metrics_app,
        host="0.0.0.0",
        port=METRICS_PORT,
        log_level="info",
        log_config="log_conf.yaml"
    )
    metrics_server = uvicorn.Server(config)
    logger.info(f"Metrics server is running at http://localhost:{METRICS_PORT}")
    metrics_server.run()


def handle_shutdown(signum, frame):
    """Handle shutdown signals gracefully."""
    logger.info(f"Received signal {signum}. Shutting down...")
    shutdown_event.set()
    
    # Gracefully shutdown metrics server
    if metrics_server:
        metrics_server.should_exit = True


async def main():
    """Main entry point."""
    # Register signal handlers
    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)
    
    # Start metrics server in a separate thread
    metrics_thread = threading.Thread(target=run_metrics_server, daemon=True)
    metrics_thread.start()
    
    # Give metrics server time to start
    await asyncio.sleep(1)
    
    # Run the job
    try:
        await run_job()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Job interrupted")
    except Exception as e:
        logger.error(f"Job failed: {e}")
        job_status.set(3)  # Failed
    finally:
        # Wait a bit for final metrics to be scraped
        logger.info("Job finished, keeping metrics server alive for 10 seconds...")
        await asyncio.sleep(10)
        
        # Shutdown metrics server
        if metrics_server:
            metrics_server.should_exit = True
        
        logger.info("Shutdown complete")


if __name__ == "__main__":
    # Set initial status
    job_status.set(0)  # Not started
    
    # Run the job
    asyncio.run(main())

# Made with Bob

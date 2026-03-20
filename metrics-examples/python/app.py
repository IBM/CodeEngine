"""FastAPI application with Prometheus metrics for Code Engine."""

import os
import time
import random
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Response, HTTPException
from fastapi.responses import PlainTextResponse
import httpx
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from utils.db import get_db_pool, close_db_pool
from utils.compute import simulate_compute
from utils import metrics

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Configuration
HTTPBIN_BASE_URL = os.getenv("HTTPBIN_BASE_URL", "https://httpbin.org")
PORT = int(os.getenv("PORT", "8080"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown."""
    logger.info(f"Application server starting on port {PORT}")
    logger.info(f"Configured httpbin backend: {HTTPBIN_BASE_URL}")
    logger.info("Metrics server running on port 2112")
    yield
    # Cleanup
    await close_db_pool()
    logger.info("Application shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Metrics Example App",
    description="Code Engine custom metrics example for Python",
    version="1.0.0",
    lifespan=lifespan
)


# Middleware to track requests
@app.middleware("http")
async def metrics_middleware(request, call_next):
    """Record request metrics."""
    metrics.requests_total.labels(
        method=request.method,
        path=request.url.path
    ).inc()
    response = await call_next(request)
    return response


async def make_outbound_call(endpoint: str, method: str = "GET") -> Dict[str, Any]:
    """Make an outbound HTTP call and record metrics."""
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
                "data": response.text
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


@app.get("/", response_class=PlainTextResponse)
async def health_check():
    """Health check endpoint."""
    app_name = os.getenv("CE_APP", "metrics-example-app")
    return f"app '{app_name}' is ready!"


@app.get("/test-db")
async def test_db():
    """Test database connectivity."""
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(
            status_code=500,
            detail="Could not connect to postgres instance: no postgres instance configured"
        )
    
    try:
        metrics.db_connections_active.inc()
        
        # Execute query with metrics
        start_time = time.time()
        status = "success"
        
        query = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'"
        
        try:
            async with pool.acquire() as conn:
                result = await conn.fetch(query)
            
            duration = time.time() - start_time
            
            metrics.db_query_duration.labels(
                operation="SELECT",
                table="INFORMATION_SCHEMA.TABLES",
                status=status
            ).observe(duration)
            
            metrics.db_queries_total.labels(
                operation="SELECT",
                table="INFORMATION_SCHEMA.TABLES",
                status=status
            ).inc()
            
            logger.info(f"Successfully queried database in {duration:.3f}s")
            return {"message": "Successfully connected to postgres instance"}
            
        except Exception as e:
            status = "error"
            duration = time.time() - start_time
            
            metrics.db_query_duration.labels(
                operation="SELECT",
                table="INFORMATION_SCHEMA.TABLES",
                status=status
            ).observe(duration)
            
            metrics.db_queries_total.labels(
                operation="SELECT",
                table="INFORMATION_SCHEMA.TABLES",
                status=status
            ).inc()
            
            raise HTTPException(
                status_code=500,
                detail=f"Could not connect to postgres instance: '{str(e)}'"
            )
    finally:
        metrics.db_connections_active.dec()


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
    
    metrics.compute_duration.labels(operation="data_processing").observe(actual_compute_duration)
    
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
    
    metrics.compute_duration.labels(operation="data_processing").observe(actual_compute_duration)
    
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
    
    metrics.compute_duration.labels(operation="data_processing").observe(actual_compute_duration)
    
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
    
    metrics.compute_duration.labels(operation="data_processing").observe(actual_compute_duration)
    
    return {
        "message": "Outbound call completed",
        "requestedStatus": code,
        "outboundCall": result,
        "computeTime": actual_compute_duration,
        "cpuIntensity": f"{cpu_intensity:.1f}%"
    }


@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )


if __name__ == "__main__":
    import uvicorn
    
    # Run both app server and metrics server
    # In production, use separate processes or the Dockerfile approach
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT,
        log_level="info"
    )

# Made with Bob

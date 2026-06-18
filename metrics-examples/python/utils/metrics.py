"""Prometheus metrics definitions for the application."""

import os
from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, REGISTRY

# Get metrics prefix from environment
METRICS_PREFIX = os.getenv("METRICS_NAME_PREFIX", "mymetrics_")

# Request metrics
requests_total = Counter(
    f"{METRICS_PREFIX}requests_total",
    "Total number of requests",
    ["method", "path"],
    registry=REGISTRY
)

# Outbound HTTP call metrics
outbound_request_duration = Histogram(
    f"{METRICS_PREFIX}outbound_request_duration_seconds",
    "Duration of outbound HTTP requests in seconds",
    ["target", "method", "status_code"],
    buckets=[0.1, 0.5, 1, 2, 5, 10],
    registry=REGISTRY
)

outbound_requests_total = Counter(
    f"{METRICS_PREFIX}outbound_requests_total",
    "Total number of outbound HTTP requests",
    ["target", "method", "status_code"],
    registry=REGISTRY
)

# Database operation metrics
db_query_duration = Histogram(
    f"{METRICS_PREFIX}db_query_duration_seconds",
    "Duration of database queries in seconds",
    ["operation", "table", "status"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registry=REGISTRY
)

db_queries_total = Counter(
    f"{METRICS_PREFIX}db_queries_total",
    "Total number of database queries",
    ["operation", "table", "status"],
    registry=REGISTRY
)

db_connections_active = Gauge(
    f"{METRICS_PREFIX}db_connections_active",
    "Number of active database connections",
    registry=REGISTRY
)

# Compute operation metrics
compute_duration = Histogram(
    f"{METRICS_PREFIX}compute_duration_seconds",
    "Duration of compute-intensive operations in seconds",
    ["operation"],
    buckets=[0.5, 1, 2, 3, 5],
    registry=REGISTRY
)

# Made with Bob

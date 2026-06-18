package com.ibm.codeengine.metrics.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Configuration for custom Prometheus metrics.
 */
@Configuration
public class MetricsConfig {

    @Value("${metrics.name.prefix:mymetrics_}")
    private String metricsPrefix;

    private final AtomicInteger activeDbConnections = new AtomicInteger(0);

    @Bean
    public String metricsPrefix() {
        return metricsPrefix;
    }

    @Bean
    public AtomicInteger activeDbConnections() {
        return activeDbConnections;
    }

    /**
     * Register custom metrics with the MeterRegistry.
     * Returns a simple marker object to satisfy Spring's @Bean requirement.
     */
    @Bean
    public String registerCustomMetrics(MeterRegistry registry) {
        // Register DB connections gauge
        Gauge.builder(metricsPrefix + "db_connections_active", activeDbConnections, AtomicInteger::get)
                .description("Number of active database connections")
                .register(registry);
        return "metricsRegistered";
    }

    /**
     * Create a counter for requests.
     */
    public Counter requestsCounter(MeterRegistry registry, String method, String path) {
        return Counter.builder(metricsPrefix + "requests_total")
                .description("Total number of requests")
                .tag("method", method)
                .tag("path", path)
                .register(registry);
    }

    /**
     * Create a timer for outbound requests.
     */
    public Timer outboundRequestTimer(MeterRegistry registry, String target, String method, String statusCode) {
        return Timer.builder(metricsPrefix + "outbound_request_duration_seconds")
                .description("Duration of outbound HTTP requests in seconds")
                .tag("target", target)
                .tag("method", method)
                .tag("status_code", statusCode)
                .register(registry);
    }

    /**
     * Create a counter for outbound requests.
     */
    public Counter outboundRequestsCounter(MeterRegistry registry, String target, String method, String statusCode) {
        return Counter.builder(metricsPrefix + "outbound_requests_total")
                .description("Total number of outbound HTTP requests")
                .tag("target", target)
                .tag("method", method)
                .tag("status_code", statusCode)
                .register(registry);
    }

    /**
     * Create a timer for database queries.
     */
    public Timer dbQueryTimer(MeterRegistry registry, String operation, String table, String status) {
        return Timer.builder(metricsPrefix + "db_query_duration_seconds")
                .description("Duration of database queries in seconds")
                .tag("operation", operation)
                .tag("table", table)
                .tag("status", status)
                .register(registry);
    }

    /**
     * Create a counter for database queries.
     */
    public Counter dbQueriesCounter(MeterRegistry registry, String operation, String table, String status) {
        return Counter.builder(metricsPrefix + "db_queries_total")
                .description("Total number of database queries")
                .tag("operation", operation)
                .tag("table", table)
                .tag("status", status)
                .register(registry);
    }

    /**
     * Create a timer for compute operations.
     */
    public Timer computeTimer(MeterRegistry registry, String operation) {
        return Timer.builder(metricsPrefix + "compute_duration_seconds")
                .description("Duration of compute-intensive operations in seconds")
                .tag("operation", operation)
                .register(registry);
    }
}

// Made with Bob

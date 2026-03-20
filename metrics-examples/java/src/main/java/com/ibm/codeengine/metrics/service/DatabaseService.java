package com.ibm.codeengine.metrics.service;

import com.ibm.codeengine.metrics.config.MetricsConfig;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Service for database operations with metrics.
 * Database support is optional - service works without a DataSource.
 */
@Service
public class DatabaseService {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseService.class);

    private final JdbcTemplate jdbcTemplate;
    private final MeterRegistry meterRegistry;
    private final MetricsConfig metricsConfig;
    private final AtomicInteger activeDbConnections;

    public DatabaseService(
            @Autowired(required = false) DataSource dataSource,
            MeterRegistry meterRegistry,
            MetricsConfig metricsConfig,
            AtomicInteger activeDbConnections) {
        this.jdbcTemplate = dataSource != null ? new JdbcTemplate(dataSource) : null;
        this.meterRegistry = meterRegistry;
        this.metricsConfig = metricsConfig;
        this.activeDbConnections = activeDbConnections;
        
        if (dataSource == null) {
            logger.info("DatabaseService initialized without DataSource - database features disabled");
        } else {
            logger.info("DatabaseService initialized with DataSource - database features enabled");
        }
    }

    /**
     * Test database connectivity by querying tables.
     */
    public List<Map<String, Object>> testConnection() {
        if (jdbcTemplate == null) {
            throw new IllegalStateException("Database not configured");
        }

        activeDbConnections.incrementAndGet();
        long startTime = System.currentTimeMillis();
        String status = "success";

        try {
            String query = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'";
            List<Map<String, Object>> result = jdbcTemplate.queryForList(query);

            long duration = System.currentTimeMillis() - startTime;

            // Record metrics
            metricsConfig.dbQueryTimer(meterRegistry, "SELECT", "INFORMATION_SCHEMA.TABLES", status)
                    .record(Duration.ofMillis(duration));
            metricsConfig.dbQueriesCounter(meterRegistry, "SELECT", "INFORMATION_SCHEMA.TABLES", status)
                    .increment();

            logger.info("Successfully queried database in {}ms", duration);
            return result;

        } catch (Exception e) {
            status = "error";
            long duration = System.currentTimeMillis() - startTime;

            // Record error metrics
            metricsConfig.dbQueryTimer(meterRegistry, "SELECT", "INFORMATION_SCHEMA.TABLES", status)
                    .record(Duration.ofMillis(duration));
            metricsConfig.dbQueriesCounter(meterRegistry, "SELECT", "INFORMATION_SCHEMA.TABLES", status)
                    .increment();

            logger.error("Database query failed: {}", e.getMessage());
            throw new RuntimeException("Database query failed: " + e.getMessage(), e);

        } finally {
            activeDbConnections.decrementAndGet();
        }
    }

    /**
     * Check if database is configured.
     */
    public boolean isConfigured() {
        return jdbcTemplate != null;
    }
}

// Made with Bob

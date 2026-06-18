package com.ibm.codeengine.metrics.controller;

import com.ibm.codeengine.metrics.config.MetricsConfig;
import com.ibm.codeengine.metrics.model.OutboundCallResult;
import com.ibm.codeengine.metrics.service.ComputeService;
import com.ibm.codeengine.metrics.service.DatabaseService;
import com.ibm.codeengine.metrics.service.OutboundService;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;

/**
 * REST controller for the metrics example application.
 */
@RestController
public class MetricsController {

    private static final Logger logger = LoggerFactory.getLogger(MetricsController.class);
    private static final Random random = new Random();

    private final OutboundService outboundService;
    private final DatabaseService databaseService;
    private final ComputeService computeService;
    private final MeterRegistry meterRegistry;
    private final MetricsConfig metricsConfig;
    private final String appName;

    public MetricsController(
            OutboundService outboundService,
            DatabaseService databaseService,
            ComputeService computeService,
            MeterRegistry meterRegistry,
            MetricsConfig metricsConfig,
            @Value("${CE_APP:metrics-example-app}") String appName) {
        this.outboundService = outboundService;
        this.databaseService = databaseService;
        this.computeService = computeService;
        this.meterRegistry = meterRegistry;
        this.metricsConfig = metricsConfig;
        this.appName = appName;
    }

    /**
     * Middleware to track requests - implemented via interceptor would be better
     */
    private void recordRequest(String method, String path) {
        metricsConfig.requestsCounter(meterRegistry, method, path).increment();
    }

    @GetMapping("/")
    public String healthCheck() {
        recordRequest("GET", "/");
        return String.format("app '%s' is ready!", appName);
    }

    @GetMapping("/test-db")
    public ResponseEntity<?> testDb() {
        recordRequest("GET", "/test-db");
        
        if (!databaseService.isConfigured()) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Could not connect to postgres instance: no postgres instance configured");
        }

        try {
            databaseService.testConnection();
            return ResponseEntity.ok("Successfully connected to postgres instance");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Could not connect to postgres instance: '" + e.getMessage() + "'");
        }
    }

    @GetMapping("/outbound/delay")
    public ResponseEntity<Map<String, Object>> outboundDelay() {
        recordRequest("GET", "/outbound/delay");
        
        // Random delay between 0-2 seconds
        double delay = random.nextDouble() * 2;
        
        // 5% error rate
        boolean shouldError = random.nextDouble() < 0.05;
        
        OutboundCallResult result;
        if (shouldError) {
            result = outboundService.makeOutboundCall("/status/500", "GET");
        } else {
            result = outboundService.makeOutboundCall(String.format("/delay/%.1f", delay), "GET");
        }
        
        // Simulate compute-intensive data handling
        long computeStart = System.currentTimeMillis();
        double computeDuration = random.nextDouble() * 3; // 0-3 seconds
        double cpuIntensity = 40 + random.nextDouble() * 40; // 40-80%
        computeService.simulateCompute(computeDuration, cpuIntensity);
        double actualComputeDuration = (System.currentTimeMillis() - computeStart) / 1000.0;
        
        metricsConfig.computeTimer(meterRegistry, "data_processing")
                .record(Duration.ofMillis((long)(actualComputeDuration * 1000)));
        
        Map<String, Object> response = new HashMap<>();
        response.put("message", shouldError ? "Simulated error response" : "Outbound call completed");
        response.put("delay", delay);
        response.put("outboundCall", result);
        response.put("computeTime", actualComputeDuration);
        response.put("cpuIntensity", String.format("%.1f%%", cpuIntensity));
        
        if (shouldError) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/outbound/get")
    public ResponseEntity<Map<String, Object>> outboundGet() {
        recordRequest("GET", "/outbound/get");
        
        OutboundCallResult result = outboundService.makeOutboundCall("/get", "GET");
        
        // Simulate compute-intensive data handling
        long computeStart = System.currentTimeMillis();
        double computeDuration = random.nextDouble() * 3;
        double cpuIntensity = 40 + random.nextDouble() * 40;
        computeService.simulateCompute(computeDuration, cpuIntensity);
        double actualComputeDuration = (System.currentTimeMillis() - computeStart) / 1000.0;
        
        metricsConfig.computeTimer(meterRegistry, "data_processing")
                .record(Duration.ofMillis((long)(actualComputeDuration * 1000)));
        
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Outbound GET call completed");
        response.put("outboundCall", result);
        response.put("computeTime", actualComputeDuration);
        response.put("cpuIntensity", String.format("%.1f%%", cpuIntensity));
        
        return ResponseEntity.ok(response);
    }

    @PostMapping("/outbound/post")
    public ResponseEntity<Map<String, Object>> outboundPost() {
        recordRequest("POST", "/outbound/post");
        
        OutboundCallResult result = outboundService.makeOutboundCall("/post", "POST");
        
        // Simulate compute-intensive data handling
        long computeStart = System.currentTimeMillis();
        double computeDuration = random.nextDouble() * 3;
        double cpuIntensity = 40 + random.nextDouble() * 40;
        computeService.simulateCompute(computeDuration, cpuIntensity);
        double actualComputeDuration = (System.currentTimeMillis() - computeStart) / 1000.0;
        
        metricsConfig.computeTimer(meterRegistry, "data_processing")
                .record(Duration.ofMillis((long)(actualComputeDuration * 1000)));
        
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Outbound POST call completed");
        response.put("outboundCall", result);
        response.put("computeTime", actualComputeDuration);
        response.put("cpuIntensity", String.format("%.1f%%", cpuIntensity));
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/outbound/status/{code}")
    public ResponseEntity<Map<String, Object>> outboundStatus(@PathVariable int code) {
        recordRequest("GET", "/outbound/status/" + code);
        
        OutboundCallResult result = outboundService.makeOutboundCall("/status/" + code, "GET");
        
        // Simulate compute-intensive data handling
        long computeStart = System.currentTimeMillis();
        double computeDuration = random.nextDouble() * 3;
        double cpuIntensity = 40 + random.nextDouble() * 40;
        computeService.simulateCompute(computeDuration, cpuIntensity);
        double actualComputeDuration = (System.currentTimeMillis() - computeStart) / 1000.0;
        
        metricsConfig.computeTimer(meterRegistry, "data_processing")
                .record(Duration.ofMillis((long)(actualComputeDuration * 1000)));
        
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Outbound call completed");
        response.put("requestedStatus", code);
        response.put("outboundCall", result);
        response.put("computeTime", actualComputeDuration);
        response.put("cpuIntensity", String.format("%.1f%%", cpuIntensity));
        
        return ResponseEntity.ok(response);
    }
}

// Made with Bob

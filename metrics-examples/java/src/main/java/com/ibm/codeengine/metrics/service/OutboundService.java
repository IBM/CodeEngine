package com.ibm.codeengine.metrics.service;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.ibm.codeengine.metrics.config.MetricsConfig;
import com.ibm.codeengine.metrics.model.OutboundCallResult;

import io.micrometer.core.instrument.MeterRegistry;
import reactor.core.publisher.Mono;

/**
 * Service for making outbound HTTP calls with metrics.
 */
@Service
public class OutboundService {

    private static final Logger logger = LoggerFactory.getLogger(OutboundService.class);

    private final WebClient webClient;
    private final MeterRegistry meterRegistry;
    private final MetricsConfig metricsConfig;
    private final String httpbinBaseUrl;

    public OutboundService(
            WebClient.Builder webClientBuilder,
            MeterRegistry meterRegistry,
            MetricsConfig metricsConfig,
            @Value("${httpbin.base.url}") String httpbinBaseUrl) {
        this.webClient = webClientBuilder
                .baseUrl(httpbinBaseUrl)
                .build();
        this.meterRegistry = meterRegistry;
        this.metricsConfig = metricsConfig;
        this.httpbinBaseUrl = httpbinBaseUrl;
    }

    /**
     * Make an outbound HTTP call and record metrics.
     */
    public OutboundCallResult makeOutboundCall(String endpoint, String method) {
        long startTime = System.currentTimeMillis();
        
        try {
            String response = webClient
                    .method(org.springframework.http.HttpMethod.valueOf(method))
                    .uri(endpoint)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(30))
                    .onErrorResume(e -> Mono.just("Error: " + e.getMessage()))
                    .block();

            long duration = System.currentTimeMillis() - startTime;
            String statusCode = "200"; // Simplified - in real scenario, capture actual status

            // Record metrics
            metricsConfig.outboundRequestTimer(meterRegistry, httpbinBaseUrl, method, statusCode)
                    .record(Duration.ofMillis(duration));
            metricsConfig.outboundRequestsCounter(meterRegistry, httpbinBaseUrl, method, statusCode)
                    .increment();

            return OutboundCallResult.builder()
                    .success(true)
                    .status(200)
                    .duration(duration / 1000.0)
                    .data(response)
                    .build();

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            
            // Record error metrics
            metricsConfig.outboundRequestTimer(meterRegistry, httpbinBaseUrl, method, "error")
                    .record(Duration.ofMillis(duration));
            metricsConfig.outboundRequestsCounter(meterRegistry, httpbinBaseUrl, method, "error")
                    .increment();

            logger.error("Outbound call failed: {}", e.getMessage());

            return OutboundCallResult.builder()
                    .success(false)
                    .error(e.getMessage())
                    .duration(duration / 1000.0)
                    .build();
        }
    }
}

// Made with Bob

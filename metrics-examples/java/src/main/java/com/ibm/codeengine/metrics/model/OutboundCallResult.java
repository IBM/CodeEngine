package com.ibm.codeengine.metrics.model;

import lombok.Builder;
import lombok.Data;

/**
 * Result of an outbound HTTP call.
 */
@Data
@Builder
public class OutboundCallResult {
    private boolean success;
    private Integer status;
    private double duration;
    private String data;
    private String error;
}

// Made with Bob

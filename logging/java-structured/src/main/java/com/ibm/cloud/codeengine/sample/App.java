package com.ibm.cloud.codeengine.sample;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class App {

    public static void main(String[] args) {

        Logger logger = LoggerFactory.getLogger("my_logger");
        // Expect to be rendered as INFO level log message
        logger.info("This is a structured log message");

        // Expect to be rendered as DEBUG level log message
        logger.debug("This is a structured log message");

        // Expect to be rendered as WARN level log message
        logger.warn("This is a structured log message");

        // Expect to be rendered as ERROR level log message
        logger.error("This is a structured log message");

        logger.atDebug().addKeyValue("extra_key", "extra_value")
                .log("A structured log entry that contains an extra key");

        // Expect to be rendered as INFO level log message. The additional JSON struct
        // is available as a searchable, filterable fields
        logger.atInfo()
                .addKeyValue("requestId", "some-request-id")
                .addKeyValue("userId", "user-123456")
                .addKeyValue("action", "test")
                .addKeyValue("metadata", Map.of("foo", "bar"))
                .log("A structured log entry that carries a ton of additional fields");

        // Multi-line example. Expect to be rendered in a single log message
        logger.atInfo().log("""
                Multi-line log sample:
                Line 1: initialization started
                Line 2: loading modules
                Line 3: modules loaded
                Line 4: entering main loop
                End of sample""");

        // Error logging. 
        // The error stack trace is rendered in a single log message (see field stack_trace)
        try {
            throw new RuntimeException("boom!");
        } catch (Exception e) {
            logger.atError()
                    .setCause(e) // also sets throwable on the event
                    .log("An error occurred");
        }
    }
}

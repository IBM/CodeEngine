package com.ibm.cloud.codeengine.sample;

import java.time.Instant;

// This simple Code Engine job demonstrates how to write unstructured log lines 
// using the built-in capabilities of Java

public class App {

    public static void main(String[] args) {

        // expect to be rendered as INFO level log message
        System.out.println("This is a unstructured log message without a severity identifier");

        // expect to be rendered as WARN level log message
        System.out.println("This is a unstructured log message with a severity identifier WARN");

        // expect to be rendered as ERROR level log message, without the keyword ERROR
        // being part of the message
        System.out.println("ERROR This is a unstructured log message prefixed with the level");

        // expect to be rendered as INFO level log message, without the timestamp being
        // part of the message
        System.out
                .println(Instant.now().toString() + " This is a unstructured log message prefixed with the timestamp");

        // expect to be rendered as DEBUG level log message, without the timestamp and
        // keyword DEBUG being part of the message
        System.out.println(Instant.now().toString()
                + " DEBUG This is a unstructured log message prefixed with the timestamp and level");

        // Multi-line example. Expect to be rendered in a single log message
        System.out.println("Multi-line log sample...\\nStep 1: Validating input...\\nStep 2: Processing payment...");

        // Error logging.
        // Expect that the stacktrace is rendered in multiple log statements
        // Note: Use structure logs to support multi-line error stack traces
        try {
            throw new RuntimeException("boom!");
        } catch (Exception e) {
            System.err.println("Stacktrace example " + e); // error message
            e.printStackTrace(); // full stack trace to stderr
        }

    }
}

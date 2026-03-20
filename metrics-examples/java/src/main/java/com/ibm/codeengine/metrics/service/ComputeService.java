package com.ibm.codeengine.metrics.service;

import org.springframework.stereotype.Service;

/**
 * Service for simulating compute-intensive operations.
 */
@Service
public class ComputeService {

    /**
     * Simulate CPU-intensive work for the specified duration.
     *
     * @param durationSeconds How long to run the computation
     * @param cpuIntensity    CPU usage intensity (0-100)
     */
    public void simulateCompute(double durationSeconds, double cpuIntensity) {
        long startTime = System.currentTimeMillis();
        long endTime = startTime + (long) (durationSeconds * 1000);

        while (System.currentTimeMillis() < endTime) {
            // Perform CPU work
            int workIterations = (int) (cpuIntensity * 1000);
            for (int i = 0; i < workIterations; i++) {
                Math.sqrt(Math.random() * 1000000);
            }

            // Small sleep to control CPU usage
            try {
                long sleepTime = (long) ((100 - cpuIntensity) / 10);
                Thread.sleep(sleepTime);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }
}

// Made with Bob

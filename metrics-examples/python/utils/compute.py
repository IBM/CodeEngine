"""Compute-intensive operation simulation."""

import time
import math
import random


def simulate_compute(duration_seconds: float, cpu_intensity: float) -> None:
    """
    Simulate CPU-intensive work for the specified duration.
    
    Args:
        duration_seconds: How long to run the computation
        cpu_intensity: CPU usage intensity (0-100)
    """
    start_time = time.time()
    end_time = start_time + duration_seconds
    
    while time.time() < end_time:
        # Perform CPU work
        work_iterations = int(cpu_intensity * 1000)
        for _ in range(work_iterations):
            _ = math.sqrt(random.random() * 1000000)
        
        # Small sleep to control CPU usage
        sleep_time = (100 - cpu_intensity) / 10000  # Convert to seconds
        time.sleep(sleep_time)

# Made with Bob

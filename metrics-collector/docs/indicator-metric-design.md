# Indicator Metric Design for Sysdig Dashboard Auto-Discovery

## Overview

This document analyzes the requirements and provides recommendations for implementing an indicator metric (`ibm_codeengine_instance_resources`) that Sysdig will use to automatically show built-in dashboards.

## Requirements Analysis

### Purpose
- Signal to Sysdig that Code Engine metrics are available
- Trigger automatic display of pre-configured dashboards
- Indicate the health/readiness status of the metrics collector

### Sysdig Recommendation
- **Metric Type**: Gauge
- **Metric Name**: `ibm_codeengine_instance_resources`
- **Status Label**: Should indicate readiness (value: `ready`)

## Design Recommendations

### ✅ YES - This Metric Makes Sense

**Reasons:**
1. **Dashboard Discovery**: Sysdig can detect the presence of Code Engine metrics and automatically enable relevant dashboards
2. **Health Indicator**: Provides a simple way to monitor if the metrics collector is functioning
3. **Low Cardinality**: When designed properly, it adds minimal overhead
4. **Industry Standard**: Similar patterns used by other monitoring integrations (e.g., `up` metric in Prometheus exporters)

### Metric Design

#### Recommended Approach: Single Instance Gauge

```prometheus
# HELP ibm_codeengine_instance_resources Indicator metric for IBM Code Engine resource monitoring
# TYPE ibm_codeengine_instance_resources gauge
ibm_codeengine_instance_resources{status="ready"} 1
```

**Characteristics:**
- **Value**: Always `1` when collector is running and healthy
- **Single time series**: Only one metric instance per collector
- **Minimal cardinality**: Only 1 time series regardless of number of pods/apps/jobs

#### Alternative Approach: Per-Namespace Gauge (If Multiple Namespaces)

```prometheus
# HELP ibm_codeengine_instance_resources Indicator metric for IBM Code Engine resource monitoring
# TYPE ibm_codeengine_instance_resources gauge
ibm_codeengine_instance_resources{namespace="my-project-namespace",status="ready"} 1
```

**Use this if:**
- You plan to monitor multiple Code Engine projects from a single collector
- You need namespace-level visibility

**Cardinality**: 1 time series per namespace (still very low)

### Label Design

#### Recommended Labels

**Minimal (Recommended):**
```go
status="ready"  // Indicates collector is operational
```

**Extended (Optional):**
```go
status="ready"                    // Collector status
namespace="my-project-namespace"  // Code Engine project namespace
collector_version="1.0.0"         // Collector version for troubleshooting
```

#### Status Values

| Status | Value | Meaning | Use Case |
|--------|-------|---------|----------|
| Ready | `ready` | Collector is operational and collecting metrics | Normal operation |
| Degraded | `degraded` | Collector is running but experiencing issues | Partial failures |
| Starting | `starting` | Collector is initializing | Startup phase |

**Recommendation**: Start with only `ready` status. Add others only if needed for operational visibility.

### Cardinality Analysis

#### Current Metrics Cardinality
Looking at your existing metrics:
```
ibm_codeengine_instance_cpu_usage_millicores{
    ibm_codeengine_instance_name="pod-xyz",
    ibm_codeengine_component_type="app",
    ibm_codeengine_component_name="my-app"
}
```

**Cardinality**: N time series (where N = number of pods)
- If you have 100 pods, you have 100 time series per metric type
- Total: 100 pods × 4 metrics = 400 time series

#### Indicator Metric Cardinality

**Option 1: Single Instance (Recommended)**
```
ibm_codeengine_instance_resources{status="ready"} 1
```
**Cardinality**: 1 time series (constant, regardless of pod count)
**Impact**: Negligible (~0.25% overhead for 100 pods)

**Option 2: Per-Namespace**
```
ibm_codeengine_instance_resources{namespace="ns1",status="ready"} 1
ibm_codeengine_instance_resources{namespace="ns2",status="ready"} 1
```
**Cardinality**: M time series (where M = number of namespaces)
**Impact**: Still negligible for typical use cases (1-10 namespaces)

**Option 3: Per-Component (NOT RECOMMENDED)**
```
ibm_codeengine_instance_resources{component_name="app1",status="ready"} 1
ibm_codeengine_instance_resources{component_name="app2",status="ready"} 1
```
**Cardinality**: K time series (where K = number of components)
**Impact**: Defeats the purpose of an indicator metric; use existing metrics instead

### Gauge Value Recommendations

#### Option 1: Binary Indicator (Recommended)
```go
Value: 1  // Collector is running
Value: 0  // Collector is stopped (metric disappears)
```

**Advantages:**
- Simple and clear
- Standard pattern (like Prometheus `up` metric)
- Easy to alert on: `ibm_codeengine_instance_resources == 0`

#### Option 2: Timestamp
```go
Value: 1710950400  // Unix timestamp of last successful collection
```

**Advantages:**
- Can detect stale metrics
- Useful for debugging collection delays

**Disadvantages:**
- More complex to interpret
- Not necessary if Prometheus already tracks metric timestamps

#### Option 3: Count of Monitored Resources
```go
Value: 42  // Number of pods being monitored
```

**Advantages:**
- Provides additional context
- Can alert on unexpected changes

**Disadvantages:**
- Adds complexity
- Information already available from other metrics

**Recommendation**: Use **Option 1 (Binary Indicator)** with value `1`

### Implementation Strategy

#### When to Emit the Metric

**Option A: Always Emit (Recommended)**
```go
// Emit on every metrics collection cycle
// Value: 1 (constant)
```

**Option B: Conditional Emit**
```go
// Only emit if collection was successful
// Value: 1 if success, 0 or absent if failure
```

**Recommendation**: Use Option A for simplicity. The metric's presence indicates the collector is running.

#### Where to Add in Code

Add to [`formatPrometheusMetrics()`](main.go:81) function after existing metrics:

```go
// After line 189 (after internal stats)
sb.WriteString("# HELP ibm_codeengine_instance_resources Indicator metric for IBM Code Engine resource monitoring\n")
sb.WriteString("# TYPE ibm_codeengine_instance_resources gauge\n")
sb.WriteString("ibm_codeengine_instance_resources{status=\"ready\"} 1\n")
sb.WriteString("\n")
```

### Complete Metric Specification

```prometheus
# HELP ibm_codeengine_instance_resources Indicator metric for IBM Code Engine resource monitoring
# TYPE ibm_codeengine_instance_resources gauge
ibm_codeengine_instance_resources{status="ready"} 1
```

**Metric Properties:**
- **Name**: `ibm_codeengine_instance_resources`
- **Type**: Gauge
- **Value**: `1` (constant)
- **Labels**: 
  - `status`: `"ready"` (indicates collector is operational)
- **Cardinality**: 1 time series per collector instance
- **Update Frequency**: Every metrics scrape (same as other metrics)

### Alerting Examples

Once implemented, you can create alerts:

```promql
# Alert if collector is down
absent(ibm_codeengine_instance_resources{status="ready"})

# Alert if collector hasn't reported in 5 minutes
time() - timestamp(ibm_codeengine_instance_resources{status="ready"}) > 300
```

### Dashboard Auto-Discovery

Sysdig will use this metric to:
1. Detect Code Engine metrics are available
2. Automatically enable the "IBM Code Engine - Container Resource Overview" dashboard
3. Show the dashboard in the user's dashboard list

**Detection Query Example:**
```promql
count(ibm_codeengine_instance_resources{status="ready"}) > 0
```

## Summary

### ✅ Recommended Implementation

```go
// Add to formatPrometheusMetrics() function
sb.WriteString("# HELP ibm_codeengine_instance_resources Indicator metric for IBM Code Engine resource monitoring\n")
sb.WriteString("# TYPE ibm_codeengine_instance_resources gauge\n")
sb.WriteString("ibm_codeengine_instance_resources{status=\"ready\"} 1\n")
sb.WriteString("\n")
```

### Key Benefits

1. **Minimal Cardinality**: Only 1 time series (0.25% overhead)
2. **Simple Design**: Binary indicator (value = 1)
3. **Standard Pattern**: Follows Prometheus exporter conventions
4. **Operational Value**: Can be used for health checks and alerting
5. **Dashboard Discovery**: Enables Sysdig auto-discovery feature

### Cardinality Impact

| Scenario | Existing Metrics | Indicator Metric | Total | Overhead |
|----------|------------------|------------------|-------|----------|
| 10 pods | 40 | 1 | 41 | 2.5% |
| 100 pods | 400 | 1 | 401 | 0.25% |
| 1000 pods | 4000 | 1 | 4001 | 0.025% |

**Conclusion**: The indicator metric adds negligible cardinality overhead while providing significant operational value.

## Next Steps

1. Implement the metric in [`main.go`](main.go:81)
2. Test with Sysdig to verify dashboard auto-discovery
3. Update documentation with the new metric
4. Consider adding to the dashboard JSON if needed for visibility

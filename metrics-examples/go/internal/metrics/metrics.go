package metrics

import (
	"os"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	prefix = getMetricsPrefix()

	// RequestsTotal tracks total requests by method and path
	RequestsTotal *prometheus.CounterVec

	// OutboundRequestDuration tracks duration of outbound HTTP requests
	OutboundRequestDuration *prometheus.HistogramVec

	// OutboundRequestsTotal tracks total outbound HTTP requests
	OutboundRequestsTotal *prometheus.CounterVec

	// DBQueryDuration tracks duration of database queries
	DBQueryDuration *prometheus.HistogramVec

	// DBQueriesTotal tracks total database queries
	DBQueriesTotal *prometheus.CounterVec

	// DBConnectionsActive tracks active database connections
	DBConnectionsActive prometheus.Gauge

	// ComputeDuration tracks duration of compute-intensive operations
	ComputeDuration *prometheus.HistogramVec
)

func getMetricsPrefix() string {
	prefix := os.Getenv("METRICS_NAME_PREFIX")
	if prefix == "" {
		prefix = "mymetrics_"
	}
	return prefix
}

// RegisterMetrics registers all application-specific metrics with the provided registry
func RegisterMetrics(reg *prometheus.Registry) {
	// RequestsTotal tracks total requests by method and path
	RequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: prefix + "requests_total",
			Help: "Total number of requests",
		},
		[]string{"method", "path"},
	)
	reg.MustRegister(RequestsTotal)

	// OutboundRequestDuration tracks duration of outbound HTTP requests
	OutboundRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    prefix + "outbound_request_duration_seconds",
			Help:    "Duration of outbound HTTP requests in seconds",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10},
		},
		[]string{"target", "method", "status_code"},
	)
	reg.MustRegister(OutboundRequestDuration)

	// OutboundRequestsTotal tracks total outbound HTTP requests
	OutboundRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: prefix + "outbound_requests_total",
			Help: "Total number of outbound HTTP requests",
		},
		[]string{"target", "method", "status_code"},
	)
	reg.MustRegister(OutboundRequestsTotal)

	// DBQueryDuration tracks duration of database queries
	DBQueryDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    prefix + "db_query_duration_seconds",
			Help:    "Duration of database queries in seconds",
			Buckets: []float64{0.01, 0.05, 0.1, 0.5, 1, 2, 5},
		},
		[]string{"operation", "table", "status"},
	)
	reg.MustRegister(DBQueryDuration)

	// DBQueriesTotal tracks total database queries
	DBQueriesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: prefix + "db_queries_total",
			Help: "Total number of database queries",
		},
		[]string{"operation", "table", "status"},
	)
	reg.MustRegister(DBQueriesTotal)

	// DBConnectionsActive tracks active database connections
	DBConnectionsActive = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: prefix + "db_connections_active",
			Help: "Number of active database connections",
		},
	)
	reg.MustRegister(DBConnectionsActive)

	// ComputeDuration tracks duration of compute-intensive operations
	ComputeDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    prefix + "compute_duration_seconds",
			Help:    "Duration of compute-intensive operations in seconds",
			Buckets: []float64{0.5, 1, 2, 3, 5},
		},
		[]string{"operation"},
	)
	reg.MustRegister(ComputeDuration)
}

// Made with Bob

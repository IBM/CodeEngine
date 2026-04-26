package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/IBM/CodeEngine/metrics-examples/go/internal/db"
	"github.com/IBM/CodeEngine/metrics-examples/go/internal/metrics"
	"github.com/gorilla/mux"
)

var httpbinBaseURL = getHTTPBinURL()

func getHTTPBinURL() string {
	url := os.Getenv("HTTPBIN_BASE_URL")
	if url == "" {
		url = "https://httpbin.org"
	}
	return url
}

// SimulateCompute performs CPU-intensive work for the specified duration
func SimulateCompute(durationSeconds float64, cpuIntensity float64) {
	startTime := time.Now()
	endTime := startTime.Add(time.Duration(durationSeconds * float64(time.Second)))

	for time.Now().Before(endTime) {
		// Perform CPU work
		workIterations := int(cpuIntensity * 1000)
		for i := 0; i < workIterations; i++ {
			_ = math.Sqrt(rand.Float64() * 1000000)
		}

		// Small sleep to control CPU usage
		sleepTime := time.Duration((100-cpuIntensity)/10) * time.Millisecond
		time.Sleep(sleepTime)
	}
}

// MakeOutboundCall makes an HTTP request and records metrics
func MakeOutboundCall(endpoint, method string) map[string]interface{} {
	url := httpbinBaseURL + endpoint
	startTime := time.Now()

	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		duration := time.Since(startTime).Seconds()
		metrics.OutboundRequestDuration.WithLabelValues(httpbinBaseURL, method, "error").Observe(duration)
		metrics.OutboundRequestsTotal.WithLabelValues(httpbinBaseURL, method, "error").Inc()
		return map[string]interface{}{
			"success":  false,
			"error":    err.Error(),
			"duration": duration,
		}
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		duration := time.Since(startTime).Seconds()
		metrics.OutboundRequestDuration.WithLabelValues(httpbinBaseURL, method, "error").Observe(duration)
		metrics.OutboundRequestsTotal.WithLabelValues(httpbinBaseURL, method, "error").Inc()
		return map[string]interface{}{
			"success":  false,
			"error":    err.Error(),
			"duration": duration,
		}
	}
	defer resp.Body.Close()

	duration := time.Since(startTime).Seconds()
	statusCode := strconv.Itoa(resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)

	metrics.OutboundRequestDuration.WithLabelValues(httpbinBaseURL, method, statusCode).Observe(duration)
	metrics.OutboundRequestsTotal.WithLabelValues(httpbinBaseURL, method, statusCode).Inc()

	return map[string]interface{}{
		"success":  true,
		"status":   resp.StatusCode,
		"duration": duration,
		"data":     string(body),
	}
}

// HealthHandler handles the root health check endpoint
func HealthHandler(w http.ResponseWriter, r *http.Request) {
	appName := os.Getenv("CE_APP")
	if appName == "" {
		appName = "metrics-example-app"
	}
	fmt.Fprintf(w, "app '%s' is ready!", appName)
}

// TestDBHandler tests database connectivity
func TestDBHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	pool, err := db.GetDBPool(ctx)
	if err != nil {
		http.Error(w, fmt.Sprintf("Could not connect to postgres instance: %v", err), http.StatusInternalServerError)
		return
	}

	metrics.DBConnectionsActive.Inc()
	defer metrics.DBConnectionsActive.Dec()

	// Execute query with metrics
	startTime := time.Now()
	status := "success"

	query := "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'"
	rows, err := pool.Query(ctx, query)
	if err != nil {
		status = "error"
		duration := time.Since(startTime).Seconds()
		metrics.DBQueryDuration.WithLabelValues("SELECT", "INFORMATION_SCHEMA.TABLES", status).Observe(duration)
		metrics.DBQueriesTotal.WithLabelValues("SELECT", "INFORMATION_SCHEMA.TABLES", status).Inc()
		http.Error(w, fmt.Sprintf("Could not connect to postgres instance: '%v'", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	duration := time.Since(startTime).Seconds()
	metrics.DBQueryDuration.WithLabelValues("SELECT", "INFORMATION_SCHEMA.TABLES", status).Observe(duration)
	metrics.DBQueriesTotal.WithLabelValues("SELECT", "INFORMATION_SCHEMA.TABLES", status).Inc()

	log.Printf("Successfully queried database in %.3fs", duration)
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "Successfully connected to postgres instance")
}

// OutboundDelayHandler handles requests with random delays and errors
func OutboundDelayHandler(w http.ResponseWriter, r *http.Request) {
	// Random delay between 0-2 seconds
	delay := rand.Float64() * 2

	// 5% error rate
	shouldError := rand.Float64() < 0.05

	var result map[string]interface{}
	if shouldError {
		result = MakeOutboundCall("/status/500", "GET")
	} else {
		result = MakeOutboundCall(fmt.Sprintf("/delay/%.1f", delay), "GET")
	}

	// Simulate compute-intensive data handling
	computeStart := time.Now()
	computeDuration := rand.Float64() * 3  // 0-3 seconds
	cpuIntensity := 40 + rand.Float64()*40 // 40-80%
	SimulateCompute(computeDuration, cpuIntensity)
	actualComputeDuration := time.Since(computeStart).Seconds()
	metrics.ComputeDuration.WithLabelValues("data_processing").Observe(actualComputeDuration)

	response := map[string]interface{}{
		"message":      "Outbound call completed",
		"delay":        delay,
		"outboundCall": result,
		"computeTime":  actualComputeDuration,
		"cpuIntensity": fmt.Sprintf("%.1f%%", cpuIntensity),
	}

	if shouldError {
		response["message"] = "Simulated error response"
		w.WriteHeader(http.StatusInternalServerError)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// OutboundGetHandler handles simple GET requests
func OutboundGetHandler(w http.ResponseWriter, r *http.Request) {
	result := MakeOutboundCall("/get", "GET")

	// Simulate compute-intensive data handling
	computeStart := time.Now()
	computeDuration := rand.Float64() * 3
	cpuIntensity := 40 + rand.Float64()*40
	SimulateCompute(computeDuration, cpuIntensity)
	actualComputeDuration := time.Since(computeStart).Seconds()
	metrics.ComputeDuration.WithLabelValues("data_processing").Observe(actualComputeDuration)

	response := map[string]interface{}{
		"message":      "Outbound GET call completed",
		"outboundCall": result,
		"computeTime":  actualComputeDuration,
		"cpuIntensity": fmt.Sprintf("%.1f%%", cpuIntensity),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// OutboundPostHandler handles POST requests
func OutboundPostHandler(w http.ResponseWriter, r *http.Request) {
	result := MakeOutboundCall("/post", "POST")

	// Simulate compute-intensive data handling
	computeStart := time.Now()
	computeDuration := rand.Float64() * 3
	cpuIntensity := 40 + rand.Float64()*40
	SimulateCompute(computeDuration, cpuIntensity)
	actualComputeDuration := time.Since(computeStart).Seconds()
	metrics.ComputeDuration.WithLabelValues("data_processing").Observe(actualComputeDuration)

	response := map[string]interface{}{
		"message":      "Outbound POST call completed",
		"outboundCall": result,
		"computeTime":  actualComputeDuration,
		"cpuIntensity": fmt.Sprintf("%.1f%%", cpuIntensity),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// OutboundStatusHandler handles requests for specific status codes
func OutboundStatusHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	statusCode := vars["code"]

	result := MakeOutboundCall("/status/"+statusCode, "GET")

	// Simulate compute-intensive data handling
	computeStart := time.Now()
	computeDuration := rand.Float64() * 3
	cpuIntensity := 40 + rand.Float64()*40
	SimulateCompute(computeDuration, cpuIntensity)
	actualComputeDuration := time.Since(computeStart).Seconds()
	metrics.ComputeDuration.WithLabelValues("data_processing").Observe(actualComputeDuration)

	response := map[string]interface{}{
		"message":         "Outbound call completed",
		"requestedStatus": statusCode,
		"outboundCall":    result,
		"computeTime":     actualComputeDuration,
		"cpuIntensity":    fmt.Sprintf("%.1f%%", cpuIntensity),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// MetricsMiddleware records request metrics
func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		metrics.RequestsTotal.WithLabelValues(r.Method, r.URL.Path).Inc()
		next.ServeHTTP(w, r)
	})
}

// Made with Bob

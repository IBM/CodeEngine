package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/IBM/CodeEngine/metrics-examples/go/internal/db"
	"github.com/IBM/CodeEngine/metrics-examples/go/internal/handlers"
	"github.com/IBM/CodeEngine/metrics-examples/go/internal/metrics"
	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	// Get configuration from environment
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	metricsPort := "2112"

	httpbinURL := os.Getenv("HTTPBIN_BASE_URL")
	if httpbinURL == "" {
		httpbinURL = "https://httpbin.org"
	}

	// Create main application router
	router := mux.NewRouter()
	router.Use(handlers.MetricsMiddleware)

	// Register application routes
	router.HandleFunc("/", handlers.HealthHandler).Methods("GET")
	router.HandleFunc("/test-db", handlers.TestDBHandler).Methods("GET")
	router.HandleFunc("/outbound/delay", handlers.OutboundDelayHandler).Methods("GET")
	router.HandleFunc("/outbound/get", handlers.OutboundGetHandler).Methods("GET")
	router.HandleFunc("/outbound/post", handlers.OutboundPostHandler).Methods("POST")
	router.HandleFunc("/outbound/status/{code}", handlers.OutboundStatusHandler).Methods("GET")

	// Create main application server
	appServer := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Create a new registry for metrics
	reg := prometheus.NewRegistry()

	// Register default Go runtime and process metrics if enabled
	if os.Getenv("METRICS_COLLECT_GO_METRICS_ENABLED") == "true" {
		// Register default Go runtime metrics (memory, goroutines, GC, etc.)
		reg.MustRegister(collectors.NewGoCollector())

		// Register process metrics (CPU, memory, file descriptors, etc.)
		reg.MustRegister(collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))

		log.Println("Go runtime and process metrics collection enabled")
	}

	// Register application-specific metrics
	metrics.RegisterMetrics(reg)

	// Create metrics server with custom registry
	metricsRouter := mux.NewRouter()
	metricsRouter.Handle("/metrics", promhttp.HandlerFor(reg, promhttp.HandlerOpts{
		EnableOpenMetrics: true,
	}))
	metricsServer := &http.Server{
		Addr:         ":" + metricsPort,
		Handler:      metricsRouter,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start servers in goroutines
	go func() {
		log.Printf("Application server is running at http://localhost:%s", port)
		log.Printf("Configured httpbin backend: %s", httpbinURL)
		if err := appServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Application server error: %v", err)
		}
	}()

	go func() {
		log.Printf("Metrics server is running at http://localhost:%s", metricsPort)
		if err := metricsServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Metrics server error: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the servers
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down servers...")

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Close database connections
	db.Close()

	// Shutdown metrics server
	if err := metricsServer.Shutdown(ctx); err != nil {
		log.Printf("Metrics server shutdown error: %v", err)
	} else {
		log.Println("Metrics server closed")
	}

	// Shutdown application server
	if err := appServer.Shutdown(ctx); err != nil {
		log.Printf("Application server shutdown error: %v", err)
	} else {
		log.Println("Application server closed")
	}

	log.Println("Servers exited")
}

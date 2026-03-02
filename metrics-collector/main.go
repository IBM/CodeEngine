package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
	"k8s.io/kubectl/pkg/scheme"

	"k8s.io/metrics/pkg/apis/metrics/v1beta1"
	metricsv "k8s.io/metrics/pkg/client/clientset/versioned"
)

// MetricsCache holds the latest collected metrics in a thread-safe manner
type MetricsCache struct {
	mu              sync.RWMutex
	metrics         []InstanceResourceStats
	namespace       string
	lastUpdate      time.Time
	collectionCount int64
	errorCount      int64
}

// CollectorStats tracks collector performance metrics
type CollectorStats struct {
	lastCollectionDuration atomic.Int64 // in milliseconds
	lastCollectionTime     atomic.Int64 // unix timestamp
	totalErrors            atomic.Int64
}

var (
	metricsCache   = &MetricsCache{}
	collectorStats = &CollectorStats{}
)

// setupHTTPHandlers configures the HTTP routes
func setupHTTPHandlers() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/metrics", metricsHandler)
	return mux
}

// metricsHandler serves Prometheus-formatted metrics
func metricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	metricsCache.mu.RLock()
	metrics := metricsCache.metrics
	namespace := metricsCache.namespace
	lastUpdate := metricsCache.lastUpdate
	metricsCache.mu.RUnlock()

	// Set content type for Prometheus
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

	// Write Prometheus metrics
	output := formatPrometheusMetrics(metrics, namespace, lastUpdate)
	w.Write([]byte(output))
}

// formatPrometheusMetrics converts metrics to Prometheus text format
func formatPrometheusMetrics(metrics []InstanceResourceStats, namespace string, lastUpdate time.Time) string {
	var sb strings.Builder

	// Helper function to escape label values
	escapeLabelValue := func(s string) string {
		s = strings.ReplaceAll(s, "\\", "\\\\")
		s = strings.ReplaceAll(s, "\"", "\\\"")
		s = strings.ReplaceAll(s, "\n", "\\n")
		return s
	}

	// Write container CPU usage metrics
	sb.WriteString("# HELP ibm_codeengine_instance_cpu_usage_millicores Current CPU usage in millicores\n")
	sb.WriteString("# TYPE ibm_codeengine_instance_cpu_usage_millicores gauge\n")
	for _, m := range metrics {
		labels := fmt.Sprintf("instance_name=\"%s\",component_type=\"%s\",component_name=\"%s\"",
			escapeLabelValue(m.Name),
			escapeLabelValue(m.ComponentType),
			escapeLabelValue(m.ComponentName))
		sb.WriteString(fmt.Sprintf("ibm_codeengine_instance_cpu_usage_millicores{%s} %d\n", labels, m.Cpu.Current))
	}
	sb.WriteString("\n")

	// Write container CPU limit metrics
	sb.WriteString("# HELP ibm_codeengine_instance_cpu_limit_millicores Configured CPU limit in millicores\n")
	sb.WriteString("# TYPE ibm_codeengine_instance_cpu_limit_millicores gauge\n")
	for _, m := range metrics {
		if m.Cpu.Configured > 0 {
			labels := fmt.Sprintf("instance_name=\"%s\",component_type=\"%s\",component_name=\"%s\"",
				escapeLabelValue(m.Name),
				escapeLabelValue(m.ComponentType),
				escapeLabelValue(m.ComponentName))
			sb.WriteString(fmt.Sprintf("ibm_codeengine_instance_cpu_limit_millicores{%s} %d\n", labels, m.Cpu.Configured))
		}
	}
	sb.WriteString("\n")

	// Write container memory usage metrics
	sb.WriteString("# HELP ibm_codeengine_instance_memory_usage_bytes Current memory usage in bytes\n")
	sb.WriteString("# TYPE ibm_codeengine_instance_memory_usage_bytes gauge\n")
	for _, m := range metrics {
		labels := fmt.Sprintf("instance_name=\"%s\",component_type=\"%s\",component_name=\"%s\"",
			escapeLabelValue(m.Name),
			escapeLabelValue(m.ComponentType),
			escapeLabelValue(m.ComponentName))
		// Convert MB to bytes
		sb.WriteString(fmt.Sprintf("ibm_codeengine_instance_memory_usage_bytes{%s} %d\n", labels, m.Memory.Current*1000*1000))
	}
	sb.WriteString("\n")

	// Write container memory limit metrics
	sb.WriteString("# HELP ibm_codeengine_instance_memory_limit_bytes Configured memory limit in bytes\n")
	sb.WriteString("# TYPE ibm_codeengine_instance_memory_limit_bytes gauge\n")
	for _, m := range metrics {
		if m.Memory.Configured > 0 {
			labels := fmt.Sprintf("instance_name=\"%s\",component_type=\"%s\",component_name=\"%s\"",
				escapeLabelValue(m.Name),
				escapeLabelValue(m.ComponentType),
				escapeLabelValue(m.ComponentName))
			// Convert MB to bytes
			sb.WriteString(fmt.Sprintf("ibm_codeengine_instance_memory_limit_bytes{%s} %d\n", labels, m.Memory.Configured*1000*1000))
		}
	}
	sb.WriteString("\n")

	// Write container ephemeral storage usage metrics (if available)
	hasStorageMetrics := false
	for _, m := range metrics {
		if m.DiskUsage.Current > 0 {
			hasStorageMetrics = true
			break
		}
	}

	if hasStorageMetrics {
		sb.WriteString("# HELP ibm_codeengine_instance_ephemeral_storage_usage_bytes Current ephemeral storage usage in bytes\n")
		sb.WriteString("# TYPE ibm_codeengine_instance_ephemeral_storage_usage_bytes gauge\n")
		for _, m := range metrics {
			if m.DiskUsage.Current > 0 {
				labels := fmt.Sprintf("instance_name=\"%s\",component_type=\"%s\",component_name=\"%s\"",
					escapeLabelValue(m.Name),
					escapeLabelValue(m.ComponentType),
					escapeLabelValue(m.ComponentName))
				// Convert MB to bytes
				sb.WriteString(fmt.Sprintf("ibm_codeengine_instance_ephemeral_storage_usage_bytes{%s} %d\n", labels, m.DiskUsage.Current*1000*1000))
			}
		}
		sb.WriteString("\n")
	}

	if os.Getenv("METRICS_INTERNAL_STATS") == "true" {
		// Write collector self-monitoring metrics
		sb.WriteString("# HELP codeengine_collector_collection_duration_seconds Time taken to collect metrics in seconds\n")
		sb.WriteString("# TYPE codeengine_collector_collection_duration_seconds gauge\n")
		durationMs := collectorStats.lastCollectionDuration.Load()
		sb.WriteString(fmt.Sprintf("codeengine_collector_collection_duration_seconds %.3f\n", float64(durationMs)/1000.0))
		sb.WriteString("\n")

		sb.WriteString("# HELP codeengine_collector_last_collection_timestamp_seconds Unix timestamp of last successful collection\n")
		sb.WriteString("# TYPE codeengine_collector_last_collection_timestamp_seconds gauge\n")
		lastCollectionTime := collectorStats.lastCollectionTime.Load()
		sb.WriteString(fmt.Sprintf("codeengine_collector_last_collection_timestamp_seconds %d\n", lastCollectionTime))
		sb.WriteString("\n")

		sb.WriteString("# HELP codeengine_collector_collection_errors_total Total number of collection errors\n")
		sb.WriteString("# TYPE codeengine_collector_collection_errors_total counter\n")
		totalErrors := collectorStats.totalErrors.Load()
		sb.WriteString(fmt.Sprintf("codeengine_collector_collection_errors_total %d\n", totalErrors))
		sb.WriteString("\n")
	}

	return sb.String()
}

func main() {
	jobMode := os.Getenv("JOB_MODE")

	// In task mode, collect the resource metrics once
	if jobMode == "task" {
		if err := collectInstanceMetrics(metricsCache); err != nil {
			fmt.Printf("Error collecting metrics: %v\n", err)
			os.Exit(1)
		}
		return
	}

	// If the 'INTERVAL' env var is set then sleep for that many seconds
	sleepDuration := 30
	if t := os.Getenv("INTERVAL"); t != "" {
		sleepDuration, _ = strconv.Atoi(t)
		if sleepDuration < 30 {
			sleepDuration = 30
		}
	}

	// Check if HTTP metrics server should be enabled
	metricsEnabled := os.Getenv("METRICS_ENABLED") == "true"

	// Get metrics port configuration
	metricsPort := "9100"
	if port := os.Getenv("METRICS_PORT"); port != "" {
		metricsPort = port
	}

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Setup signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start HTTP server only if METRICS_ENABLED=true
	var server *http.Server
	var serverErrors chan error

	if metricsEnabled {
		server = &http.Server{
			Addr:    ":" + metricsPort,
			Handler: setupHTTPHandlers(),
		}

		// Start HTTP server in a goroutine
		serverErrors = make(chan error, 1)
		go func() {
			fmt.Printf("Starting HTTP metrics server on port %s\n", metricsPort)
			if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				serverErrors <- fmt.Errorf("HTTP server error: %w", err)
			}
		}()
	} else {
		fmt.Println("HTTP metrics server disabled (METRICS_ENABLED not set to 'true')")
	}

	// Start metrics collection loop in a goroutine
	collectionDone := make(chan struct{})
	go func() {
		defer close(collectionDone)
		ticker := time.NewTicker(time.Duration(sleepDuration) * time.Second)
		defer ticker.Stop()

		// Collect metrics immediately on startup
		if err := collectInstanceMetrics(metricsCache); err != nil {
			fmt.Printf("Error collecting metrics: %v\n", err)
			collectorStats.totalErrors.Add(1)
		}

		for {
			select {
			case <-ctx.Done():
				fmt.Println("Stopping metrics collection...")
				return
			case <-ticker.C:
				if err := collectInstanceMetrics(metricsCache); err != nil {
					fmt.Printf("Error collecting metrics: %v\n", err)
					collectorStats.totalErrors.Add(1)
				}
			}
		}
	}()

	// Wait for shutdown signal or server error
	if metricsEnabled {
		select {
		case sig := <-sigChan:
			fmt.Printf("\nReceived signal %v, initiating graceful shutdown...\n", sig)
		case err := <-serverErrors:
			fmt.Printf("Server error: %v\n", err)
		}
	} else {
		// If server is not running, just wait for signal
		sig := <-sigChan
		fmt.Printf("\nReceived signal %v, initiating graceful shutdown...\n", sig)
	}

	// Cancel context to stop metrics collection
	cancel()

	// Shutdown HTTP server with timeout (only if it was started)
	if metricsEnabled && server != nil {
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer shutdownCancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			fmt.Printf("HTTP server shutdown error: %v\n", err)
		} else {
			fmt.Println("HTTP server stopped gracefully")
		}
	}

	// Wait for metrics collection to finish
	<-collectionDone
	fmt.Println("Metrics collection stopped")
	fmt.Println("Shutdown complete")
}

type ComponentType int64

const (
	Unknown ComponentType = iota
	App
	Job
	Build
)

func (s ComponentType) String() string {
	switch s {
	case App:
		return "app"
	case Job:
		return "job"
	case Build:
		return "build"
	}
	return "unknown"
}

type ResourceStats struct {
	Current    int64 `json:"current"`
	Configured int64 `json:"configured,omitempty"`
	Usage      int64 `json:"usage,omitempty"`
}

type InstanceResourceStats struct {
	Metric        string        `json:"metric"`
	Name          string        `json:"name"`
	Parent        string        `json:"parent"`
	ComponentType string        `json:"component_type"`
	ComponentName string        `json:"component_name"`
	Cpu           ResourceStats `json:"cpu"`
	Memory        ResourceStats `json:"memory"`
	DiskUsage     ResourceStats `json:"disk_usage"`
	Message       string        `json:"message"`
}

// buildPodMap creates a map of pod names to pod objects for O(1) lookup
func buildPodMap(pods *[]v1.Pod) map[string]*v1.Pod {
	podMap := make(map[string]*v1.Pod, len(*pods))
	for i := range *pods {
		podMap[(*pods)[i].Name] = &(*pods)[i]
	}
	return podMap
}

// extractComponentMetadata extracts component type, name, and parent from pod metric labels
func extractComponentMetadata(podMetric *v1beta1.PodMetrics) (componentType ComponentType, componentName, parent string) {
	componentType = determineComponentType(podMetric)

	switch componentType {
	case Job:
		if jobName, ok := podMetric.ObjectMeta.Labels["codeengine.cloud.ibm.com/job-definition-name"]; ok {
			componentName = jobName
		} else if jobRunName, ok := podMetric.ObjectMeta.Labels["codeengine.cloud.ibm.com/job-run"]; ok {
			componentName = jobRunName
		} else {
			componentName = "standalone"
		}
		parent = podMetric.ObjectMeta.Labels["codeengine.cloud.ibm.com/job-run"]
	case App:
		componentName = podMetric.ObjectMeta.Labels["serving.knative.dev/service"]
		parent = podMetric.ObjectMeta.Labels["serving.knative.dev/revision"]
	case Build:
		if buildName, ok := podMetric.ObjectMeta.Labels["build.shipwright.io/name"]; ok {
			componentName = buildName
		} else if buildRunName, ok := podMetric.ObjectMeta.Labels["buildrun.shipwright.io/name"]; ok {
			componentName = buildRunName
		} else {
			componentName = "standalone"
		}
		parent = podMetric.ObjectMeta.Labels["buildrun.shipwright.io/name"]
	default:
		componentName = "unknown"
	}

	return
}

// processMetric processes a single pod metric and outputs the JSON log line
func processMetric(
	podMetric *v1beta1.PodMetrics,
	podMap map[string]*v1.Pod,
	clientset *kubernetes.Clientset,
	namespace string,
	config *rest.Config,
) *InstanceResourceStats {
	// Extract component metadata
	componentType, componentName, parent := extractComponentMetadata(podMetric)

	// Determine the actual CPU and memory usage
	cpuCurrent := podMetric.Containers[0].Usage.Cpu().ToDec().AsApproximateFloat64() * 1000
	memoryCurrent := podMetric.Containers[0].Usage.Memory().ToDec().AsApproximateFloat64() / 1000 / 1000

	stats := InstanceResourceStats{
		Metric:        "instance-resources",
		Name:          podMetric.Name,
		Parent:        parent,
		ComponentType: componentType.String(),
		ComponentName: componentName,
		Cpu: ResourceStats{
			Current: int64(cpuCurrent),
		},
		Memory: ResourceStats{
			Current: int64(memoryCurrent),
		},
	}

	// Gather the configured resource limits and calculate the usage (in percent)
	pod := podMap[podMetric.Name]
	if pod != nil {
		userContainerName := getUserContainerName(componentType, pod)

		// determine the actual disk usage
		storageCurrent := obtainDiskUsage(clientset, namespace, podMetric.Name, userContainerName, config)
		stats.DiskUsage.Current = int64(storageCurrent)

		// extract memory and cpu limits
		cpu, memory := getCpuAndMemoryLimits(userContainerName, pod)

		cpuLimit := cpu.ToDec().AsApproximateFloat64() * 1000
		stats.Cpu.Configured = int64(cpuLimit)
		stats.Cpu.Usage = int64((cpuCurrent / cpuLimit) * 100)

		memoryLimit := memory.ToDec().AsApproximateFloat64() / 1000 / 1000
		stats.Memory.Configured = int64(memoryLimit)
		stats.Memory.Usage = int64(memoryCurrent / memoryLimit * 100)
	}

	// Compose the log line message
	stats.Message = "Captured metrics of " + stats.ComponentType + " instance '" + stats.Name + "': " + fmt.Sprintf("%d", stats.Cpu.Current) + "m vCPU, " + fmt.Sprintf("%d", stats.Memory.Current) + " MB memory, " + fmt.Sprintf("%d", stats.DiskUsage.Current) + " MB disk usage"

	// Write the stringified JSON struct and make use of IBM Cloud Logs built-in parsing mechanism,
	// which allows to annotate log lines by providing a JSON object instead of a simple string
	fmt.Println(ToJSONString(&stats))

	return &stats
}

// Helper function that retrieves all pods and all pod metrics
// this function creates a structured log line for each pod for which the kube metrics api provides a metric
func collectInstanceMetrics(cache *MetricsCache) error {
	startTime := time.Now()
	fmt.Println("Start to capture pod metrics ...")

	config, err := rest.InClusterConfig()
	if err != nil {
		return fmt.Errorf("failed to get cluster config: %w", err)
	}

	// obtain the kube namespace related to this Code Engine project
	nsBytes, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
	if err != nil {
		return fmt.Errorf("failed to read namespace: %w", err)
	}
	namespace := string(nsBytes)

	coreClientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create clientset: %w", err)
	}

	// fetches all pods
	pods := getAllPods(coreClientset, namespace, config)

	// fetch all pod metrics
	podMetrics := getAllPodMetrics(namespace, config)

	// Build pod map for O(1) lookup
	podMap := buildPodMap(pods)

	// Collect metrics into a slice
	var collectedMetrics []InstanceResourceStats
	var metricsMu sync.Mutex

	// Use semaphore to limit concurrent goroutines
	const maxConcurrency = 20
	sem := make(chan struct{}, maxConcurrency)
	var wg sync.WaitGroup

	for _, metric := range *podMetrics {
		wg.Add(1)
		sem <- struct{}{} // Acquire semaphore

		go func(podMetric *v1beta1.PodMetrics) {
			defer wg.Done()
			defer func() { <-sem }() // Release semaphore

			stats := processMetric(podMetric, podMap, coreClientset, namespace, config)
			if stats != nil {
				metricsMu.Lock()
				collectedMetrics = append(collectedMetrics, *stats)
				metricsMu.Unlock()
			}
		}(&metric)
	}

	wg.Wait()

	duration := time.Since(startTime)
	fmt.Println("Captured pod metrics in " + strconv.FormatInt(duration.Milliseconds(), 10) + " ms")

	// Update cache with collected metrics
	cache.mu.Lock()
	cache.metrics = collectedMetrics
	cache.namespace = namespace
	cache.lastUpdate = time.Now()
	cache.collectionCount++
	cache.mu.Unlock()

	// Update collector statistics
	collectorStats.lastCollectionDuration.Store(duration.Milliseconds())
	collectorStats.lastCollectionTime.Store(time.Now().Unix())

	return nil
}

// Helper function to determine the component type
func determineComponentType(podMetric *v1beta1.PodMetrics) ComponentType {
	if _, ok := podMetric.ObjectMeta.Labels["buildrun.shipwright.io/name"]; ok {
		return Build
	}
	if _, ok := podMetric.ObjectMeta.Labels["serving.knative.dev/service"]; ok {
		return App
	}
	if _, ok := podMetric.ObjectMeta.Labels["codeengine.cloud.ibm.com/job-run"]; ok {
		return Job
	}
	return Unknown
}

// Helper function to retrieve all pods from the Kube API
func getAllPods(coreClientset *kubernetes.Clientset, namespace string, config *rest.Config) *[]v1.Pod {

	// fetches all pods
	pods := []v1.Pod{}
	var podsContinueToken string
	podsPagelimit := int64(100)
	for {
		podList, err := coreClientset.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{Limit: podsPagelimit, Continue: podsContinueToken})
		if err != nil {
			fmt.Println("Failed to list pods" + err.Error())
			break
		}

		pods = append(pods, podList.Items...)

		podsContinueToken = podList.Continue
		if len(podsContinueToken) == 0 {
			break
		}
	}

	return &pods
}

// Helper function to retrieve all pods from the Kube API
func obtainDiskUsage(coreClientset *kubernetes.Clientset, namespace string, pod string, container string, config *rest.Config) float64 {

	// per default, we do not collect disk space statistics
	if os.Getenv("COLLECT_DISKUSAGE") != "true" {
		return 0
	}

	// Utilize `du -sm /` to calculate the disk usage
	cmd := []string{
		"du",
		"-sm",
		"/",
	}

	// Craft the rest client request
	req := coreClientset.CoreV1().RESTClient().Post().Resource("pods").Name(pod).Namespace(namespace).SubResource("exec")
	option := &v1.PodExecOptions{
		Container: container,
		Command:   cmd,
		Stdin:     false,
		Stdout:    true,
		Stderr:    true,
	}
	req.VersionedParams(
		option,
		scheme.ParameterCodec,
	)
	exec, reqErr := remotecommand.NewSPDYExecutor(config, "POST", req.URL())
	if reqErr != nil {
		fmt.Println("obtainDiskUsage of pod:" + pod + "/container:" + container + " failed POST err - " + reqErr.Error())
		return float64(0)
	}

	// Open a stream and wait for the exec operation to finish
	var outBuf bytes.Buffer
	var errBuf bytes.Buffer
	err := exec.StreamWithContext(context.TODO(), remotecommand.StreamOptions{
		Stdout: &outBuf,
		Stderr: &errBuf,
	})

	// Convert the output buffer to a string
	diskUsageOutputStr := outBuf.String()
	if len(diskUsageOutputStr) == 0 || diskUsageOutputStr == "<nil>" {

		// Render captured system error messages, in case the stdout stream did not receive any valid content
		if err != nil {
			if err.Error() == "Internal error occurred: failed calling webhook \"validating.webhook.pod-exec-auth-check.codeengine.cloud.ibm.com\": failed to call webhook: Post \"https://validating-webhook-serving.ibm-cfn-system.svc:443/validate/pod-exec?timeout=5s\": EOF" {
				// Do nothing and silently ignore this issue as it is most likely related to pod terminations
			} else {
				fmt.Println("obtainDiskUsage of pod:" + pod + "/container:" + container + " failed with a stream err - " + err.Error() + " - stderr: '" + errBuf.String() + "'")
			}
		}

		return float64(0)
	}

	// Parse the output "4000   /" by splitting the words
	diskUsageOutput := strings.Fields(strings.TrimSuffix(diskUsageOutputStr, "\n"))
	if len(diskUsageOutput) > 2 {
		fmt.Println("obtainDiskUsage of pod:" + pod + "/container:" + container + " - len(diskUsageOutput): '" + strconv.Itoa(len(diskUsageOutput)) + "'")
		return float64(0)
	}

	// Parse the integer string to a float64
	ephemeralStorage, parseErr := strconv.ParseFloat(diskUsageOutput[0], 64)
	if parseErr != nil {
		fmt.Println("obtainDiskUsage of pod:" + pod + "/container:" + container + " failed while parsing the output '" + diskUsageOutput[0] + "' - " + parseErr.Error())
		return float64(0)
	}

	return ephemeralStorage
}

// Helper function to retrieve all pod metrics from the Kube API
func getAllPodMetrics(namespace string, config *rest.Config) *[]v1beta1.PodMetrics {
	// obtain the metrics clientset
	metricsclientset, err := metricsv.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	// fetch all pod metrics
	podMetrics := []v1beta1.PodMetrics{}
	var metricsContinueToken string
	metricsPageLimit := int64(100)
	for {
		// fetch all pod metrics
		podMetricsList, err := metricsclientset.MetricsV1beta1().PodMetricses(namespace).List(context.TODO(), metav1.ListOptions{Limit: metricsPageLimit, Continue: metricsContinueToken})
		if err != nil {
			fmt.Println("Failed to list pod metrics" + err.Error())
			break
		}
		podMetrics = append(podMetrics, podMetricsList.Items...)

		metricsContinueToken = podMetricsList.Continue
		if len(metricsContinueToken) == 0 {
			break
		}
	}

	return &podMetrics
}

// Helper function to obtain the name of the user container (that should be observed)
func getUserContainerName(componentType ComponentType, pod *v1.Pod) string {
	if len(pod.Spec.Containers) == 0 {
		return ""
	}

	if componentType == App {
		return "user-container"
	}

	if componentType == Job || componentType == Build {
		return pod.Spec.Containers[0].Name
	}

	// for kube-native deployments, we pick the first container
	return pod.Spec.Containers[0].Name
}

// Helper function to extract CPU and Memory limits from the pod spec
func getCpuAndMemoryLimits(containerName string, pod *v1.Pod) (*resource.Quantity, *resource.Quantity) {

	if len(containerName) == 0 {
		return nil, nil
	}

	for _, container := range pod.Spec.Containers {
		if container.Name == containerName {
			cpuLimit := container.Resources.Limits.Cpu()
			if cpuLimit == nil {
				cpuLimit = container.Resources.Requests.Cpu()
			}
			memoryLimit := container.Resources.Limits.Memory()
			if memoryLimit == nil {
				memoryLimit = container.Resources.Requests.Memory()
			}
			return cpuLimit, memoryLimit
		}
	}

	return nil, nil
}

// Helper function that converts any object into a JSON string representation
func ToJSONString(obj interface{}) string {
	if obj == nil {
		return ""
	}

	bytes, err := json.Marshal(obj)
	if err != nil {
		return "marshal error"
	}

	return string(bytes)
}

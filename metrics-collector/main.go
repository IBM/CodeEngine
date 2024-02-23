package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
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

func main() {

	jobMode := os.Getenv("JOB_MODE")

	// In task mode, collect the resource metrics once
	if jobMode == "task" {
		collectInstanceMetrics()
		return
	}

	// If the 'INTERVAL' env var is set then sleep for that many seconds
	sleepDuration := 10
	if t := os.Getenv("INTERVAL"); t != "" {
		sleepDuration, _ = strconv.Atoi(t)
	}

	// In daemon mode, collect resource metrics in an endless loop
	for {
		collectInstanceMetrics()
		time.Sleep(time.Duration(sleepDuration) * time.Second)
	}
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
	Configured int64 `json:"configured"`
	Usage      int64 `json:"usage"`
}

type InstanceResourceStats struct {
	Metric           string        `json:"metric"`
	Name             string        `json:"name"`
	Parent           string        `json:"parent"`
	ComponentType    string        `json:"component_type"`
	ComponentName    string        `json:"component_name"`
	Cpu              ResourceStats `json:"cpu"`
	Memory           ResourceStats `json:"memory"`
	EphemeralStorage ResourceStats `json:"ephemeral_storage"`
	Message          string        `json:"message"`
}

// Helper function that retrieves all pods and all pod metrics
// this function creates a structured log line for each pod for which the kube metrics api provides a metric
func collectInstanceMetrics() {

	startTime := time.Now()
	fmt.Println("Start to capture pod metrics ...")

	config, err := rest.InClusterConfig()
	if err != nil {
		panic(err.Error())
	}

	// obtain the kube namespace related to this Code Engine project
	nsBytes, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
	if err != nil {
		panic(err.Error())
	}
	namespace := string(nsBytes)

	coreClientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	// fetches all pods
	pods := getAllPods(coreClientset, namespace, config)

	// fetch all pod metrics
	podMetrics := getAllPodMetrics(namespace, config)

	var wg sync.WaitGroup

	for _, metric := range podMetrics {
		wg.Add(1)

		go func(podMetric v1beta1.PodMetrics) {
			defer wg.Done()

			// Determine the component type (either app, job, build or unknown)
			componentType := determineComponentType(podMetric)

			// Determine the component name
			var componentName string
			var parent string
			switch componentType {
			case Job:
				if val, ok := podMetric.ObjectMeta.Labels["codeengine.cloud.ibm.com/job-definition-name"]; ok {
					componentName = val
				} else {
					componentName = "standalone"
				}
				parent = podMetric.ObjectMeta.Labels["codeengine.cloud.ibm.com/job-run"]
			case App:
				componentName = podMetric.ObjectMeta.Labels["serving.knative.dev/service"]
				parent = podMetric.ObjectMeta.Labels["serving.knative.dev/revision"]
			case Build:
				if val, ok := podMetric.ObjectMeta.Labels["build.shipwright.io/name"]; ok {
					componentName = val
				} else {
					componentName = "standalone"
				}

				parent = podMetric.ObjectMeta.Labels["buildrun.shipwright.io/name"]
			default:
				componentName = "unknown"
			}

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
			pod := getPod(podMetric.Name, pods)
			if pod != nil {

				userContainerName := getUserContainerName(componentType, *pod)

				// determine the actual ephemeral storage usage
				storageCurrent := obtainDiskUsage(coreClientset, namespace, podMetric.Name, userContainerName, config)
				stats.EphemeralStorage.Current = int64(storageCurrent)

				// extract memory, cpu and ephemeral storage limits
				cpu, memory, storage := getCpuMemoryAndStorageLimits(userContainerName, *pod)

				cpuLimit := cpu.ToDec().AsApproximateFloat64() * 1000
				stats.Cpu.Configured = int64(cpuLimit)
				stats.Cpu.Usage = int64((cpuCurrent / cpuLimit) * 100)

				memoryLimit := memory.ToDec().AsApproximateFloat64() / 1000 / 1000
				stats.Memory.Configured = int64(memoryLimit)
				stats.Memory.Usage = int64(memoryCurrent / memoryLimit * 100)

				storageLimit := storage.ToDec().AsApproximateFloat64() / 1000 / 1000
				stats.EphemeralStorage.Configured = int64(storageLimit)
				stats.EphemeralStorage.Usage = int64(storageCurrent / storageLimit * 100)

			}

			// Compose the log line message
			stats.Message = "Captured metrics of " + stats.ComponentType + " instance '" + stats.Name + "': " + fmt.Sprintf("%d", stats.Cpu.Current) + "m vCPU, " + fmt.Sprintf("%d", stats.Memory.Current) + " MB memory, " + fmt.Sprintf("%d", stats.EphemeralStorage.Current) + " MB ephemeral storage"

			// Write the stringified JSON struct and make use of IBM Cloud Logs built-in parsing mechanism,
			// which allows to annotate log lines by providing a JSON object instead of a simple string
			fmt.Println(ToJSONString(stats))

		}(metric)
	}

	wg.Wait()

	fmt.Println("Captured pod metrics in " + strconv.FormatInt(time.Since(startTime).Milliseconds(), 10) + "ms")
}

// Helper function to determine the component type
func determineComponentType(podMetric v1beta1.PodMetrics) ComponentType {
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

// Helper function to obtain a pod by its name from a slice of pods
func getPod(name string, pods []v1.Pod) *v1.Pod {
	for _, pod := range pods {
		if pod.Name == name {
			return &pod
		}
	}
	return nil
}

// Helper function to retrieve all pods from the Kube API
func getAllPods(coreClientset *kubernetes.Clientset, namespace string, config *rest.Config) []v1.Pod {

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

	return pods
}

// Helper function to retrieve all pods from the Kube API
func obtainDiskUsage(coreClientset *kubernetes.Clientset, namespace string, pod string, container string, config *rest.Config) float64 {
	// fmt.Println("obtainDiskUsage > pod: '" + pod + "', container: '" + container + "'")

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
	// fmt.Println("obtainDiskUsage - URL: '" + req.URL().String() + "'")
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
			fmt.Println("obtainDiskUsage of pod:" + pod + "/container:" + container + " failed with a stream err - " + err.Error() + " - stderr: '" + errBuf.String() + "'")
		}

		return float64(0)
	}
	// fmt.Println("obtainDiskUsage of pod:" + pod + "/container:" + container + ": '" + diskUsageOutputStr + "'")

	// Parse the output "4000   /" by splitting the words
	diskUsageOutput := strings.Fields(strings.TrimSuffix(diskUsageOutputStr, "\n"))
	if len(diskUsageOutput) > 2 {
		fmt.Println("obtainDiskUsage of pod:" + pod + "/container:" + container + " - len(diskUsageOutput): '" + strconv.Itoa(len(diskUsageOutput)) + "'")
		return float64(0)
	}

	// fmt.Println("obtainDiskUsage of pod:" + pod + "/container:" + container + " - diskUsageOutput[0]: '" + diskUsageOutput[0] + "', len(diskUsageOutput): " + strconv.Itoa(len(diskUsageOutput)))

	// Parse the integer string to a float64
	ephemeralStorage, parseErr := strconv.ParseFloat(diskUsageOutput[0], 64)
	if parseErr != nil {
		fmt.Println("obtainDiskUsage of pod:" + pod + "/container:" + container + " failed while parsing the output '" + diskUsageOutput[0] + "' - " + parseErr.Error())
		return float64(0)
	}

	return ephemeralStorage
}

// Helper function to retrieve all pod metrics from the Kube API
func getAllPodMetrics(namespace string, config *rest.Config) []v1beta1.PodMetrics {
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

	return podMetrics
}

// Helper function to obtain the name of the user container (that should be observed)
func getUserContainerName(componentType ComponentType, pod v1.Pod) string {
	if len(pod.Spec.Containers) == 0 {
		return ""
	}

	if componentType == App {
		return "user-container"
	}

	if componentType == Job || componentType == Build {
		return pod.Spec.Containers[0].Name
	}

	return ""
}

// Helper function to extract CPU and Memory limits from the pod spec
func getCpuMemoryAndStorageLimits(containerName string, pod v1.Pod) (*resource.Quantity, *resource.Quantity, *resource.Quantity) {

	if len(containerName) == 0 {
		return nil, nil, nil
	}

	for _, container := range pod.Spec.Containers {
		if container.Name == containerName {
			cpuLimit := container.Resources.Limits.Cpu()
			memoryLimit := container.Resources.Limits.Memory()
			storageLimit := container.Resources.Limits.StorageEphemeral()
			return cpuLimit, memoryLimit, storageLimit
		}
	}

	return nil, nil, nil
}

// Helper function that converts any object into a JSON string representation
func ToJSONString(obj interface{}) string {
	if obj == nil {
		return ""
	}

	bytes, err := json.Marshal(&obj)
	if err != nil {
		return "marshal error"
	}

	return string(bytes)
}

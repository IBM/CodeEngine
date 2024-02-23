# IBM Cloud Code Engine - Metrics Collector

Code Engine job that demonstrates how to collect resource metrics (CPU, memory and disk usage) of running Code Engine apps, jobs, and builds

## Installation

### Capture metrics every n seconds

* Create Code Engine job template
```
$ ibmcloud ce job create \
    --name metrics-collector \
    --src . \
    --mode daemon \
    --cpu 0.25 \
    --memory 0.5G
```

* Submit a daemon job that collects metrics in an endless loop. The daemon job queries the Metrics API every 10 seconds
```
$ ibmcloud ce jobrun submit \
    --job metrics-collector \
    --env INTERVAL=10 
```


### Capture metrics every n minutes

* Create Code Engine job template
```
$ ibmcloud ce job create \
    --name metrics-collector \
    --src . \
    --mode task \
    --cpu 0.25 \
    --memory 0.5G
```

* Submit a Code Engine cron subscription that triggers the metrics collector every minute to query the Metrics API
```
$ ibmcloud ce subscription cron create \
    --name collect-metrics-every-minute \
    --destination-type job \
    --destination metrics-collector \
    --schedule '*/1 * * * *'
```

## IBM Cloud Logs setup

Once your IBM Cloud Code Engine project has detected a corresponding IBM Cloud Logs instance, which is configured to receive platform logs, you can consume the resource metrics in IBM Cloud Logs. Use the filter `metric:instance-resources` to filter for log lines that print resource metrics for each detected IBM Cloud Code Engine instance that is running in a project.

### Log lines

Along with a human readable message, like `Captured metrics of app instance 'load-generator-00001-deployment-677d5b7754-ktcf6': 3m vCPU, 109 MB memory, 50 MB ephemeral storage`, each log line passes specific resource utilization details in a structured way allowing to apply advanced filters on them.

E.g.
- `cpu.usage:>80`: Filter for all log lines that noticed a CPU utilization of 80% or higher
- `memory-current:>1000`: Filter for all log lines that noticed an instance that used 1GB or higher of memory
- `component_type:app`: Filter only for app instances. Possible values are `app`, `job`, and `build`
- `component_name:<app-name>`: Filter for all instances of a specific app, job, or build
- `name:<instance-name>`: Filter for a specific instance

![IBM Cloud Logs](./images/ibm-cloud-logs--loglines.png)

### Log graphs

Best is to create IBM Cloud Logs Board, in order to visualize the CPU and Memory usage per Code Engine component.

1. In your log instance navigate to Boards
1. Give it a proper name, enter `metric:instance-resources` as query and submit by clicking `Add Graph`
![New Board](./images/new-board.png)
1. Now the graph shows the overall amount of logs captured for the specified query per time interval
![Count of metrics log lines ](./images/count-of-metrics-lines.png)
1. Click on the filter icon above the graph and put in `metric:instance-resources AND component_name:<app-name>`
1. Switch the metric of the Graph to `Maximums`
1. Below the graph Add a new plot`cpu.usage` as field and choose `ANY` as field values
![Configure Graph plots](./images/configure-plots.png)
1. Add another plot for the field `memory.usage` and values `ANY`
1. Add another plot for the field `ephemeral_storage.usage` and values `ANY`
1. Finally delete the plot `metrics:instance-resources` and adjust the plot colors to your likings
![Resource Usage graph](./images/resource-usage-graph.png)
1. The usage graph above renders the utilization in % of the CPU and Memory

#### Add CPU utilization
1. Duplicate the graph, change its name to CPU and replace its plots with `cpu.configured` and `cpu.current`.
- The resulting graph will render the actual CPU usage compared to the configured limit. The the unit is milli vCPUs (1000 -> 1 vCPU).
![](./images/cpu-utilization.png)


#### Add memory utilization
1. Duplicate the graph, change its name to Memory and replace its plots with `memory.configured` and `memory.current`.
1. The resulting graph will render the actual memory usage compared to the configured limit. The the unit is MB (1000 -> 1 GB).
![](./images/memory-utilization.png)



#### Add ephemaral storage utilization
1. Duplicate the graph, change its name to Memory and replace its plots with `ephemeral_storage.configured` and `ephemeral_storage.current`.
1. The resulting graph will render the actual ephemeral storage usage compared to the configured limit. The the unit is MB (1000 -> 1 GB).
![](./images/memory-utilization.png)


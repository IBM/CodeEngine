# Code Engine logging examples

The following sample provides recommended example to setup structured logging.

Use the following command to build and deploy all examples to the Code Engine project of your choice.
```
ibmcloud ce project select --name <your-project-name>

./run all
```

### Node

* Logging framework: [winston](https://www.npmjs.com/package/winston)
* Sample code:
    ```
    logger.debug("This is a simple log message");

    logger.info("A log entry that adds another key-value pair", {
        extra_key: "extra_value",
    });
    ```
* Format of a rendered log lines:
    ```
    { "level":"debug", "message":"This is a simple log message", "timestamp":"2025-05-20T10:30:02.407Z" }
    { "extra_key": "extra_value", "level":"info", "message":"A log entry that adds another key-value pair", "timestamp":"2025-05-20T10:30:02.407Z" }
    ```
* How to test the example in Code Engine
    ```
    ./run node
    ```
* How to test the example, locally
    ```
    cd node
    npm install
    node .
    ```


### Python


* Logging framework: [built-in logging](https://docs.python.org/3/library/logging.html)
* Sample code:
```
    logger.info("This is a structured log message")
    
    logger.debug("A structured log entry", extra={"extra_key": "extra_value"})
    
```
* Format of a rendered log lines:
    ```
    { "timestamp": "2025-05-20T10:34:00.318087+00:00", "level": "INFO", "message": "This is a structured log message" }
    { "timestamp": "2025-05-20T10:34:00.318087+00:00", "level": "DEBUG", "message": "A structured log entry", "extra_key": "extra_value" }
    ```
* How to test the example in Code Engine
    ```
    ./run python
    ```
* How to test the example, locally
    ```
    cd python
    python3 main.py
    ```

### Java


* Logging framework: [slf4j](https://www.slf4j.org/), [logback](https://logback.qos.ch/)
* Sample code:
    ```
    logger.atDebug().addKeyValue("extra_key", "extra_value").log("A log entry that adds another key-value pair");
    ```
* Format of a rendered log lines:
    ```
    { "timestamp": "2025-05-20T10:44:15.501372Z", "message":"A log entry that adds another key-value pair", "thread_name":"main", "level":"DEBUG", "extra_key":"extra_value" }
    ```
* How to test the example in Code Engine
    ```
    ./run java
    ```
* How to test the example, locally
    ```
    cd java
    mvn clean install
    java -jar target/logging-1.0.0-SNAPSHOT.jar
    ```


### Go

* Logging framework: [zap](https://github.com/uber-go/zap)
* Sample code:
    ```
    logger.Info("This is a simple log message")
    logger.Info("A log entry that adds another key-value pair",
            zap.String("extra_key", "extra_value"),
    )
    ```
* Format of a rendered log lines:
    ```
    {"level":"info","timestamp":"2025-05-20T15:32:12.563+0200","message":"This is a simple log message"}
    {"level":"info","timestamp":"2025-05-20T15:32:12.564+0200","message":"A log entry that adds another key-value pair","extra_key":"extra_value"}
    ```
* How to test the example in Code Engine
    ```
    ./run go
    ```
* How to test the example, locally
    ```
    cd go
    CGO_ENABLED=0 go build -o app main.go
    ./app
    ```
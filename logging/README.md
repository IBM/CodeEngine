# Code Engine logging examples

The following sample provides recommended example to demonstrate **unstructured** and **structured** logging.

Use the following command to build and deploy all examples to the Code Engine project of your choice.
```
ibmcloud ce project select --name <your-project-name>

./run all
```

For structured logs, following libraries have been used:
* Node.js: [winston](https://www.npmjs.com/package/winston)
* Python: [Loguru](https://github.com/Delgan/loguru)
* Java: [SLF4J](https://www.slf4j.org/), [Logback](https://logback.qos.ch/)
* Golang: [built-in slog](https://go.dev/blog/slog)

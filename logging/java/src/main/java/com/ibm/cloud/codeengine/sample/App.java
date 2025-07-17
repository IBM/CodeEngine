package com.ibm.cloud.codeengine.sample;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class App {

    public static void main(String[] args) {

        Logger logger = LoggerFactory.getLogger("my_logger");
        logger.info("A simple log message");
        logger.atDebug().addKeyValue("extra_key", "extra_value").log("A structured log entry");
    }
}

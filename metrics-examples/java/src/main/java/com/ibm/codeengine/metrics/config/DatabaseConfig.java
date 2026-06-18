package com.ibm.codeengine.metrics.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.util.Base64;

/**
 * Configuration for PostgreSQL database connection using service binding.
 * Only activated when DATABASES_FOR_POSTGRESQL_CONNECTION environment variable is present.
 */
@Configuration
public class DatabaseConfig {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseConfig.class);

    /**
     * Create DataSource from service binding credentials.
     * Only created when the environment variable is present.
     */
    @Bean
    @ConditionalOnProperty(name = "DATABASES_FOR_POSTGRESQL_CONNECTION")
    public DataSource dataSource() {
        String credentials = System.getenv("DATABASES_FOR_POSTGRESQL_CONNECTION");
        
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(credentials);
            
            // Extract connection details
            String username = root.path("postgres").path("authentication").path("username").asText();
            String password = root.path("cli").path("environment").path("PGPASSWORD").asText();
            String hostname = root.path("postgres").path("hosts").get(0).path("hostname").asText();
            int port = root.path("postgres").path("hosts").get(0).path("port").asInt();
            String database = root.path("postgres").path("database").asText();
            
            // Build JDBC URL with SSL
            String jdbcUrl = String.format(
                "jdbc:postgresql://%s:%d/%s?sslmode=require&ssl=true",
                hostname, port, database
            );
            
            // Configure HikariCP
            HikariConfig config = new HikariConfig();
            config.setJdbcUrl(jdbcUrl);
            config.setUsername(username);
            config.setPassword(password);
            config.setDriverClassName("org.postgresql.Driver");
            config.setMaximumPoolSize(10);
            config.setMinimumIdle(2);
            config.setConnectionTimeout(15000);
            config.setIdleTimeout(600000);
            config.setMaxLifetime(1800000);
            
            logger.info("PostgreSQL DataSource configured successfully");
            return new HikariDataSource(config);
            
        } catch (Exception e) {
            logger.error("Failed to configure PostgreSQL DataSource", e);
            throw new RuntimeException("Failed to configure PostgreSQL DataSource", e);
        }
    }
}

// Made with Bob

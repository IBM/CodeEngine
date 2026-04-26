package db

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var dbPool *pgxpool.Pool

// PostgresCredentials represents the structure of the service binding credentials
type PostgresCredentials struct {
	CLI struct {
		Environment struct {
			PGPASSWORD string `json:"PGPASSWORD"`
		} `json:"environment"`
	} `json:"cli"`
	Postgres struct {
		Authentication struct {
			Username string `json:"username"`
		} `json:"authentication"`
		Certificate struct {
			CertificateBase64 string `json:"certificate_base64"`
		} `json:"certificate"`
		Database string `json:"database"`
		Hosts    []struct {
			Hostname string `json:"hostname"`
			Port     int    `json:"port"`
		} `json:"hosts"`
	} `json:"postgres"`
}

// GetDBPool returns a connection pool to PostgreSQL
func GetDBPool(ctx context.Context) (*pgxpool.Pool, error) {
	if dbPool != nil {
		return dbPool, nil
	}

	pgServiceCredentials := os.Getenv("DATABASES_FOR_POSTGRESQL_CONNECTION")
	if pgServiceCredentials == "" {
		return nil, fmt.Errorf("DATABASES_FOR_POSTGRESQL_CONNECTION not set")
	}

	log.Println("Connecting to PostgreSQL instance...")

	var creds PostgresCredentials
	if err := json.Unmarshal([]byte(pgServiceCredentials), &creds); err != nil {
		return nil, fmt.Errorf("failed to parse credentials: %w", err)
	}

	// Decode certificate
	certBytes, err := base64.StdEncoding.DecodeString(creds.Postgres.Certificate.CertificateBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode certificate: %w", err)
	}

	// Create certificate pool
	certPool := x509.NewCertPool()
	if !certPool.AppendCertsFromPEM(certBytes) {
		return nil, fmt.Errorf("failed to append certificate")
	}

	// Build connection string
	connString := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=require",
		creds.Postgres.Authentication.Username,
		creds.CLI.Environment.PGPASSWORD,
		creds.Postgres.Hosts[0].Hostname,
		creds.Postgres.Hosts[0].Port,
		creds.Postgres.Database,
	)

	// Configure connection pool
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	config.ConnConfig.TLSConfig = &tls.Config{
		RootCAs:    certPool,
		ServerName: creds.Postgres.Hosts[0].Hostname,
	}
	config.MaxConns = 10
	config.MinConns = 2
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute
	config.HealthCheckPeriod = time.Minute

	// Create pool
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	dbPool = pool
	log.Println("Successfully connected to PostgreSQL")
	return dbPool, nil
}

// ExecuteQuery executes a query and returns the result
func ExecuteQuery(ctx context.Context, query string) (pgx.Rows, error) {
	if dbPool == nil {
		return nil, fmt.Errorf("database pool not initialized")
	}

	return dbPool.Query(ctx, query)
}

// Close closes the database connection pool
func Close() {
	if dbPool != nil {
		dbPool.Close()
		log.Println("DB connection closed")
	}
}

// Made with Bob

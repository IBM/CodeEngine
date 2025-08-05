package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

var dbClient = connectToDb()

type GuestbookEntry struct {
	Name     string `json:"name"`
	Created  int64  `json:"created"`
	Greeting string `json:"greeting"`
}

func Debug(format string, args ...interface{}) {
	format = time.Now().Format("2006-01-02 15:04:05 ") + format + "\n"
	fmt.Fprintf(os.Stderr, format, args...)
}

func connectToDb() *sql.DB {
	Debug("Connecting to PostgreSQL instance ...")
	dbClient, err := sql.Open("postgres", "postgres://"+os.Getenv("PGUSER")+":"+os.Getenv("PGPASSWORD")+"@"+os.Getenv("PGHOST")+":"+os.Getenv("PGPORT")+"/"+os.Getenv("PGDATABASE")+"?sslmode=disable")
	if err != nil {
		log.Panicf("Cannot open connection to database: %v", err)
	}
	Debug("Connecting to PostgreSQL instance [done]")
	return dbClient
}

// This func will handle all incoming HTTP requests
func HandleHTTP(w http.ResponseWriter, r *http.Request) {

	guestbookEntries := []GuestbookEntry{}
	var (
		name       string
		created_at int64
		greeting   string
	)
	Debug("Fetching all guestbook entries ...")
	rows, sqlErr := dbClient.Query("SELECT name, created_at, greeting FROM guestbook")
	if sqlErr != nil {
		log.Printf("Retrieving guestbook entries failed - err: " + sqlErr.Error())
		if strings.Contains(sqlErr.Error(), "dial tcp") {
			w.WriteHeader(502)
			fmt.Fprintf(w, "Can't reach '%s'", os.Getenv("PGHOST"))
			return
		}
		w.WriteHeader(500)
		fmt.Fprintf(w, "%s", sqlErr.Error())
		return
	}
	defer rows.Close()
	for rows.Next() {
		err := rows.Scan(&name, &created_at, &greeting)
		if err != nil {
			log.Printf("Scanning guestbook entries failed - err: " + err.Error())
			w.WriteHeader(500)
			fmt.Fprintf(w, "%s", err.Error())
			return
		}
		log.Println("Retrieved guestbook records", name, created_at, greeting)
		guestbookEntries = append(guestbookEntries, GuestbookEntry{Name: name, Created: created_at, Greeting: greeting})
	}

	Debug("Fetched %d guestbook entries", len(guestbookEntries))
	bytes, err := json.Marshal(&guestbookEntries)
	if err != nil {
		log.Printf("Failed to marshal response - err: " + err.Error())
		w.WriteHeader(500)
		fmt.Fprintf(w, "%s", err.Error())
		return
	}

	w.Header().Add("Content-Type", "application/json")
	fmt.Fprintf(w, "%s", string(bytes))
}

func main() {
	ctx := context.Background()
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)

	srv := &http.Server{Addr: ":8080"}

	// Debug the http handler for all requests
	http.HandleFunc("/", HandleHTTP)

	go func() {
		Debug("Listening on port 8080")

		if err := srv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("failed to start server: %v", err)
		}
	}()

	<-signals
	Debug("shutting down server")
	dbClient.Close()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("failed to shutdown server: %v", err)
	}
	Debug("shutdown done")
}

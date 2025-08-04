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
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

var dbClient = connectToDb()

type Friendship struct {
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

	friendships := []Friendship{}
	var (
		name       string
		created_at int64
		greeting   string
	)
	Debug("Fetching all friendship records ...")
	rows, sqlErr := dbClient.Query("SELECT name, created_at, greeting FROM myfriendships")
	if sqlErr != nil {
		log.Printf("Retrieving friendship records failed - err: " + sqlErr.Error())
		w.WriteHeader(500)
	}
	defer rows.Close()
	for rows.Next() {
		err := rows.Scan(&name, &created_at, &greeting)
		if err != nil {
			log.Printf("Scanning friendship record failed - err: " + err.Error())
			w.WriteHeader(500)
		}
		log.Println("Retrieved friendship records", name, created_at, greeting)
		friendships = append(friendships, Friendship{Name: name, Created: created_at, Greeting: greeting})
	}

	Debug("Fetched %d friendship records", len(friendships))
	bytes, err := json.Marshal(&friendships)
	if err != nil {
		log.Printf("Failed to marshal response - err: " + err.Error())
		w.WriteHeader(500)
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
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("failed to shutdown server: %v", err)
	}
	Debug("shutdown done")
}

package main

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	serverAddr = ":8080"
)

var csvPath = getCSVPath()

func getCSVPath() string {
	if path := os.Getenv("CSV_PATH"); path != "" {
		return path
	}
	return "fleet-register.csv"
}

var csvMu sync.Mutex

type workerRequest struct {
	WorkerName string `json:"worker_name"`
	WorkerIP   string `json:"worker_ip"`
}

type apiResponse struct {
	Message      string `json:"message"`
	WorkerName   string `json:"worker_name,omitempty"`
	WorkerIP     string `json:"worker_ip,omitempty"`
	Status       string `json:"status,omitempty"`
	RegisteredAt string `json:"registered_at,omitempty"`
	CompletedAt  string `json:"completed_at,omitempty"`
	File         string `json:"file,omitempty"`
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /register", registerHandler)
	mux.HandleFunc("POST /deregister", deregisterHandler)
	mux.HandleFunc("GET /download", downloadHandler)

	log.Printf("server listening on %s", serverAddr)
	if err := http.ListenAndServe(serverAddr, mux); err != nil {
		log.Fatal(err)
	}
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	req, err := decodeWorkerRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	csvMu.Lock()
	defer csvMu.Unlock()

	if err := appendWorkerRow(req, "running"); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to register worker: %v", err))
		return
	}

	writeJSON(w, http.StatusCreated, apiResponse{
		Message:    "worker registered",
		WorkerName: req.WorkerName,
		WorkerIP:   req.WorkerIP,
		Status:     "running",
		File:       csvPath,
	})
}

func deregisterHandler(w http.ResponseWriter, r *http.Request) {
	req, err := decodeWorkerRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	csvMu.Lock()
	defer csvMu.Unlock()

	updated, err := completeWorker(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to deregister worker: %v", err))
		return
	}

	message := "worker deregistered"
	if !updated {
		message = "worker deregistration added"
	}

	writeJSON(w, http.StatusOK, apiResponse{
		Message:    message,
		WorkerName: req.WorkerName,
		WorkerIP:   req.WorkerIP,
		Status:     "completed",
		File:       csvPath,
	})
}

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	csvMu.Lock()
	defer csvMu.Unlock()

	if err := ensureCSV(); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to prepare CSV: %v", err))
		return
	}

	content, err := os.ReadFile(csvPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to read CSV: %v", err))
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, csvPath))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(content)))
	w.WriteHeader(http.StatusOK)

	if _, err := w.Write(content); err != nil {
		log.Printf("failed to write download response: %v", err)
	}
}

func decodeWorkerRequest(r *http.Request) (workerRequest, error) {
	defer r.Body.Close()

	var req workerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return workerRequest{}, errors.New("invalid JSON body")
	}

	req.WorkerName = strings.TrimSpace(req.WorkerName)
	req.WorkerIP = strings.TrimSpace(req.WorkerIP)

	if req.WorkerName == "" {
		return workerRequest{}, errors.New("field \"worker_name\" is required")
	}

	if req.WorkerIP == "" {
		return workerRequest{}, errors.New("field \"worker_ip\" is required")
	}

	return req, nil
}

func appendWorkerRow(req workerRequest, status string) error {
	if err := ensureCSV(); err != nil {
		return err
	}

	file, err := os.OpenFile(csvPath, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	registeredAt := time.Now().Format(time.RFC3339)
	record := []string{req.WorkerName, req.WorkerIP, status, registeredAt, ""}

	return writer.Write(record)
}

func completeWorker(req workerRequest) (bool, error) {
	if err := ensureCSV(); err != nil {
		return false, err
	}

	// Read all records
	file, err := os.Open(csvPath)
	if err != nil {
		return false, err
	}

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	file.Close()
	if err != nil {
		return false, err
	}

	completedAt := time.Now().Format(time.RFC3339)
	updated := false

	// Update matching record
	for i := 1; i < len(records); i++ {
		if len(records[i]) >= 2 && records[i][0] == req.WorkerName && records[i][1] == req.WorkerIP {
			records[i][2] = "completed"
			records[i][4] = completedAt
			updated = true
			break
		}
	}

	// If not found, add new record
	if !updated {
		records = append(records, []string{req.WorkerName, req.WorkerIP, "completed", "", completedAt})
	}

	// Write all records back
	file, err = os.Create(csvPath)
	if err != nil {
		return false, err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	for _, record := range records {
		if err := writer.Write(record); err != nil {
			return false, err
		}
	}

	return updated, nil
}

func ensureCSV() error {
	if _, err := os.Stat(csvPath); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return err
	}

	file, err := os.Create(csvPath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	headers := []string{"worker_name", "worker_ip", "status", "registered_at", "completed_at"}
	return writer.Write(headers)
}

func writeJSON(w http.ResponseWriter, statusCode int, payload apiResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("failed to encode JSON response: %v", err)
	}
}

func writeError(w http.ResponseWriter, statusCode int, message string) {
	writeJSON(w, statusCode, apiResponse{Message: message})
}

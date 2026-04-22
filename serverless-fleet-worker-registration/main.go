package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/xuri/excelize/v2"
)

const (
	serverAddr = ":8080"
	sheetName  = "Workers"
)

var workbookPath = getWorkbookPath()

func getWorkbookPath() string {
	if path := os.Getenv("WORKBOOK_PATH"); path != "" {
		return path
	}
	return "fleet-register.xlsx"
}

var workbookMu sync.Mutex

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

	workbookMu.Lock()
	defer workbookMu.Unlock()

	if err := appendWorkerRow(req, "running"); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to register worker: %v", err))
		return
	}

	writeJSON(w, http.StatusCreated, apiResponse{
		Message:    "worker registered",
		WorkerName: req.WorkerName,
		WorkerIP:   req.WorkerIP,
		Status:     "running",
		File:       workbookPath,
	})
}

func deregisterHandler(w http.ResponseWriter, r *http.Request) {
	req, err := decodeWorkerRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	workbookMu.Lock()
	defer workbookMu.Unlock()

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
		File:       workbookPath,
	})
}

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	workbookMu.Lock()
	defer workbookMu.Unlock()

	if err := ensureWorkbook(); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to prepare workbook: %v", err))
		return
	}

	content, err := os.ReadFile(workbookPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to read workbook: %v", err))
		return
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, workbookPath))
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
	file, err := openWorkbook()
	if err != nil {
		return err
	}
	defer closeWorkbook(file)

	rows, err := file.GetRows(sheetName)
	if err != nil {
		return err
	}

	nextRow := len(rows) + 1
	registeredAt := time.Now().Format(time.RFC3339)
	values := []interface{}{req.WorkerName, req.WorkerIP, status, registeredAt, ""}

	cell, err := excelize.CoordinatesToCellName(1, nextRow)
	if err != nil {
		return err
	}

	if err := file.SetSheetRow(sheetName, cell, &values); err != nil {
		return err
	}

	return file.SaveAs(workbookPath)
}

func completeWorker(req workerRequest) (bool, error) {
	file, err := openWorkbook()
	if err != nil {
		return false, err
	}
	defer closeWorkbook(file)

	rows, err := file.GetRows(sheetName)
	if err != nil {
		return false, err
	}

	completedAt := time.Now().Format(time.RFC3339)

	for index := 1; index < len(rows); index++ {
		row := rows[index]
		if len(row) < 2 {
			continue
		}

		if row[0] == req.WorkerName && row[1] == req.WorkerIP {
			// Update status to completed (column 3)
			statusCell, err := excelize.CoordinatesToCellName(3, index+1)
			if err != nil {
				return false, err
			}

			if err := file.SetCellValue(sheetName, statusCell, "completed"); err != nil {
				return false, err
			}

			// Update completed_at timestamp (column 5)
			completedCell, err := excelize.CoordinatesToCellName(5, index+1)
			if err != nil {
				return false, err
			}

			if err := file.SetCellValue(sheetName, completedCell, completedAt); err != nil {
				return false, err
			}

			return true, file.SaveAs(workbookPath)
		}
	}

	// If worker not found, add new row with completed status
	values := []interface{}{req.WorkerName, req.WorkerIP, "completed", "", completedAt}
	nextRow := len(rows) + 1

	cell, err := excelize.CoordinatesToCellName(1, nextRow)
	if err != nil {
		return false, err
	}

	if err := file.SetSheetRow(sheetName, cell, &values); err != nil {
		return false, err
	}

	return false, file.SaveAs(workbookPath)
}

func ensureWorkbook() error {
	if _, err := os.Stat(workbookPath); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return err
	}

	file := excelize.NewFile()
	defaultSheet := file.GetSheetName(file.GetActiveSheetIndex())

	if defaultSheet != sheetName {
		file.SetSheetName(defaultSheet, sheetName)
	}

	headers := []interface{}{"worker_name", "worker_ip", "status", "registered_at", "completed_at"}
	if err := file.SetSheetRow(sheetName, "A1", &headers); err != nil {
		return err
	}

	return file.SaveAs(workbookPath)
}

func openWorkbook() (*excelize.File, error) {
	if err := ensureWorkbook(); err != nil {
		return nil, err
	}

	file, err := excelize.OpenFile(workbookPath)
	if err != nil {
		return nil, err
	}

	return file, nil
}

func closeWorkbook(file *excelize.File) {
	if err := file.Close(); err != nil {
		log.Printf("failed to close workbook: %v", err)
	}
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

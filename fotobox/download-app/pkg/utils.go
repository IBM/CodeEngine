package pkg

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func fileExists(filename string) bool {
	_, err := os.Stat(filename)
	if err == nil {
		return true // File exists
	}
	if os.IsNotExist(err) {
		return false // File does not exist
	}
	// Some other error occurred
	fmt.Println("Error:", err)
	return false
}

func checkShaInList(inputString string) bool {
	// Hash the input string using SHA-256
	hasher := sha256.New()
	hasher.Write([]byte(inputString))
	shaHash := hex.EncodeToString(hasher.Sum(nil))

	// Retrieve the environment variable "passwords", defaulting to an empty JSON array if not set
	// shaListStr := os.Getenv("passwords")
	// if shaListStr == "" {
	// 	shaListStr = "[]"
	// }

	// // Parse the JSON array
	// var shaList []string
	// err := json.Unmarshal([]byte(shaListStr), &shaList)
	// if err != nil {
	// 	return false // Handle the error (e.g., log it) or decide on a default behavior
	// }

	// Check if the hash is in the list
	// for _, hash := range shaList {
	// 	if hash == shaHash {
	// 		return true
	// 	}
	// }
	pwd := os.Getenv("passwords")
	if pwd == shaHash {
		return true
	}
	return false
}

// compressFiles compresses files with a specific prefix into a tar.gz or zip file.
func compressFiles(dir, prefix, outputFile string) error {

	files, err := filepath.Glob(filepath.Join(dir, prefix+"*"))
	if err != nil {
		return fmt.Errorf("failed to list files: %w", err)
	}
	if len(files) == 0 {
		return fmt.Errorf("no files found with prefix %s", prefix)
	}

	return createZip(files, outputFile)
}

// createZip creates a zip file from a list of files.
func createZip(files []string, outputFile string) error {
	outFile, err := os.Create(outputFile)
	if err != nil {
		return fmt.Errorf("failed to create zip file: %w", err)
	}
	defer outFile.Close()

	zipWriter := zip.NewWriter(outFile)
	defer zipWriter.Close()

	for _, file := range files {
		if !strings.HasPrefix(file, "thumbnail-") {
			err := addFileToZip(zipWriter, file)
			if err != nil {
				return fmt.Errorf("failed to add file %s to zip: %w", file, err)
			}
		}

	}
	return nil
}

// addFileToZip adds a file to a zip archive.
func addFileToZip(zipWriter *zip.Writer, file string) error {
	info, err := os.Stat(file)
	if err != nil {
		return fmt.Errorf("failed to stat file: %w", err)
	}
	if info.IsDir() {
		return nil // Skip directories
	}

	fileReader, err := os.Open(file)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer fileReader.Close()

	writer, err := zipWriter.Create(filepath.Base(file))
	if err != nil {
		return fmt.Errorf("failed to create zip entry: %w", err)
	}

	_, err = io.Copy(writer, fileReader)
	return err
}

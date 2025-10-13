package metadata

// This package deals with storing, retriving and deleting timestamp in a local file/Environment.
/*
import (
	"encoding/json"
	"log"
	"os"
)

const metadataFile = "metadata.json"

type Metadata struct {
	Objects map[string]string `json:"objects"` // ObjectKey -> LastModified
}

// Load metadata from local file
func LoadMetadata() (Metadata, error) {
	data := Metadata{Objects: make(map[string]string)}
	file, err := os.ReadFile(metadataFile)
	if err != nil {
		if os.IsNotExist(err) {
			return data, nil
		}
		return data, err
	}
	err = json.Unmarshal(file, &data)
	return data, err
}

// Save metadata to local file
func SaveMetadata(data Metadata) error {
	fileData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(metadataFile, fileData, 0644)
}

// Delete metadata file after processing
func DeleteMetadataFile() {
	err := os.Remove(metadataFile)
	if err != nil {
		log.Println("Error deleting metadata file:", err)
	} else {
		log.Println("Metadata file deleted successfully.")
	}
}
*/

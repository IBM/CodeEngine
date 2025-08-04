package pkg

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

var (
	imageprefix = os.Getenv("imageprefix")
)

// Simulate a simple session state
var isAuthenticated = false

// Struct to hold image metadata
type Image struct {
	Name     string `json:"name"`
	Original string `json:"original"`
}

func Serve() {
	// Initialize Gin router
	router := gin.Default()
	router.Use(cors.Default())
	// Route to list images (no authentication required for listing)

	// Route to authenticate the user
	router.POST("/login", authenticate)

	// Route to serve images (authentication required)
	authGroup := router.Group("/images")
	authGroup.Use(authenticationMiddleware)
	authGroup.GET("/", listImages)
	authGroup.GET("/:name", retrieveImage)
	authGroup.GET("/all", downloadAll)

	// Start server on port 8080
	router.Run(":8080")
}

// Endpoint to list image names and paths
func listImages(c *gin.Context) {
	images, err := getImages("./images") // Specify your images directory
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list images"})
		return
	}
	c.JSON(http.StatusOK, images)
}

// Endpoint to authenticate
func authenticate(c *gin.Context) {
	var loginData struct {
		Password string `json:"password"`
	}
	if err := c.BindJSON(&loginData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if checkShaInList(loginData.Password) {
		isAuthenticated = true
		c.JSON(http.StatusOK, gin.H{"message": "Login successful"})
	} else {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid password"})
	}
}

// Middleware to check authentication
func authenticationMiddleware(c *gin.Context) {
	if !isAuthenticated {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		c.Abort()
		return
	}
	c.Next()
}

// Endpoint to retrieve an image
func retrieveImage(c *gin.Context) {
	imageName := c.Param("name")
	imagePath := filepath.Join("./images", imageName)
	// Check if file exists
	if _, err := os.Stat(imagePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Image not found"})
		return
	}

	c.File(imagePath)
}

// Helper function to get image names and paths from the directory
func getImages(dir string) ([]Image, error) {
	files, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var images []Image
	for _, file := range files {
		if !file.IsDir() && strings.HasPrefix(file.Name(), "thumbnail-") {
			image := Image{
				Name:     file.Name(),
				Original: strings.TrimPrefix(file.Name(), "thumbnail-"),
				// Path: "/images/" + file.Name(),
			}
			images = append(images, image)
		}
	}
	return images, nil
}

func downloadAll(c *gin.Context) {
	// time.Now().Format("2006-01-02-15-04-05") // get current time formated for the file
	archiveName := fmt.Sprintf("images.zip")
	compressFiles("./images", imageprefix, archiveName)
	headerName := fmt.Sprintf("attachment; filename=%s", archiveName)
	c.Writer.Header().Set("Content-Disposition", headerName)
	c.Writer.Header().Set("Content-Type", "application/octet-stream")
	c.File(archiveName)
}

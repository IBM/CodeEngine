package main
import (
	"fmt"
	"log"
	"net/http"
)
// create function for the route
func helloworld(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Hello, World!")
}

func main() {
	// use helloworld on the root route
	http.HandleFunc("/", helloworld)
	// use port 8080
	log.Fatal(http.ListenAndServe(":8080", nil))
}

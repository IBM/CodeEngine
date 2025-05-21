package main

import (
	"context"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	ec "github.com/qu1queee/CodeEngine/grpc/ecommerce"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
)

func indexHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=UFT-8")
	json.NewEncoder(w).Encode("server is running")
}

func GetGroceryHandler(groceryClient ec.GroceryClient) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		GetHandler(w, r, groceryClient)
	}
}

func BuyGroceryHandler(groceryClient ec.GroceryClient) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		BuyHandler(w, r, groceryClient)
	}
}

func Fail(w http.ResponseWriter, msg string, err error) {
	fmt.Printf("%s: %v\n", msg, err)
	w.WriteHeader(http.StatusBadRequest)
	w.Write([]byte(fmt.Sprintf("%s\n", msg)))
}

func GetHandler(w http.ResponseWriter, r *http.Request, groceryClient ec.GroceryClient) {

	// Contact the server and print out its response.
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute*1)
	defer cancel()

	vars := mux.Vars(r)

	categoryName := vars["category"]

	category := ec.Category{
		Category: categoryName,
	}

	itemList, err := groceryClient.ListGrocery(ctx, &category)
	if err != nil {
		Fail(w, "failed to list groceries", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(itemList.Item)
}

func BuyHandler(w http.ResponseWriter, r *http.Request, groceryClient ec.GroceryClient) {
	vars := mux.Vars(r)

	itemName := vars["name"]
	pAmount := vars["amount"]
	categoryName := vars["category"]

	amount, err := strconv.ParseFloat(pAmount, 64)
	if err != nil {
		Fail(w, "invalid amount parameter", err)
	}

	category := ec.Category{
		Category: categoryName,
		Itemname: itemName,
	}

	item, err := groceryClient.GetGrocery(context.Background(), &category)
	if err != nil {
		Fail(w, fmt.Sprintf("failed to get grocery item by name: %v", category.Itemname), err)
		return
	}

	paymentRequest := ec.PaymentRequest{
		Amount: amount,
		Item:   item,
	}

	paymentResponse, _ := groceryClient.BuyGrocery(context.Background(), &paymentRequest)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(paymentResponse)
}

func main() {
	endpoint := os.Getenv("ENDPOINT_WITH_PORT")
	if endpoint == "" {
		log.Fatalf("no endpoint set: %s", endpoint)
	}
	certPool, err := x509.SystemCertPool()
	if err != nil {
		log.Fatalf("failed to get cert pool: %v", err)
	}
	creds := credentials.NewClientTLSFromCert(certPool, "")
	insArg := os.Getenv("INSECURE")
	if insArg != "" {
		unencrypted, err := strconv.ParseBool(insArg)
		if err != nil {
			log.Fatalf("could not parse %v: ", err)
		}
		if unencrypted {
			creds = insecure.NewCredentials()
		}
	}

	fmt.Printf("using endpoint: %s\n", endpoint)
	conn, err := grpc.Dial(endpoint, grpc.WithTransportCredentials(creds))
	if err != nil {
		log.Fatalf("failed to connect: %v", err)
	}

	defer conn.Close()

	c := ec.NewGroceryClient(conn)

	r := mux.NewRouter()
	r.HandleFunc("/", indexHandler).Methods("GET")
	r.HandleFunc("/listgroceries/{category}", GetGroceryHandler(c))
	r.HandleFunc("/buygrocery/{category}/{name}/{amount:[0-9]+\\.[0-9]+}", BuyGroceryHandler(c))
	fmt.Println("server app is running on :8080 .....")
	http.ListenAndServe(":8080", r)
}

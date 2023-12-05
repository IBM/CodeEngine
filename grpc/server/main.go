package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"

	ec "github.com/qu1queee/CodeEngine/grpc/ecommerce"
	"google.golang.org/grpc"
)

type GroceryServer struct {
	Products []Product
	ec.UnimplementedGroceryServer
}

type Product struct {
	Category string
	Name     string
	Quantity string
	Price    float64
}

func initGroceryServer() *GroceryServer {
	return &GroceryServer{
		Products: []Product{
			{
				Category: "food",
				Name:     "carrot",
				Quantity: "1",
				Price:    0.5,
			},
			{
				Category: "food",
				Name:     "apple",
				Quantity: "1",
				Price:    0.5,
			},
			{
				Category: "food",
				Name:     "banana",
				Quantity: "1",
				Price:    0.5,
			},
			{
				Category: "food",
				Name:     "lemon",
				Quantity: "1",
				Price:    0.5,
			},
			{
				Category: "clothes",
				Name:     "tshirt",
				Quantity: "1",
				Price:    25.0,
			},
			{
				Category: "clothes",
				Name:     "pants",
				Quantity: "1",
				Price:    65.0,
			},
			{
				Category: "clothes",
				Name:     "socks",
				Quantity: "1",
				Price:    5.0,
			},
			{
				Category: "electronics",
				Name:     "iphone",
				Quantity: "1",
				Price:    1200.99,
			},
			{
				Category: "electronics",
				Name:     "keyboard",
				Quantity: "1",
				Price:    100.99,
			},
			{
				Category: "electronics",
				Name:     "usb",
				Quantity: "1",
				Price:    2.5,
			},
		},
	}
}

func (gs *GroceryServer) GetGrocery(ctx context.Context, in *ec.Category) (*ec.Item, error) {
	for _, p := range gs.Products {
		if in.Category == p.Category {
			if in.Itemname == p.Name {
				// return the Item
				return &ec.Item{
					Name:     p.Name,
					Quantity: p.Quantity,
					Price:    p.Price,
				}, nil
			}
		}
	}

	return &ec.Item{}, errors.New("category item not found")
}

func (gs *GroceryServer) ListGrocery(ctx context.Context, in *ec.Category) (*ec.ItemList, error) {
	itemList := ec.ItemList{}
	for _, p := range gs.Products {
		if in.Category == p.Category {
			itemList.Item = append(itemList.Item, &ec.Item{
				Name:     p.Name,
				Quantity: p.Quantity,
				Price:    p.Price,
			})
		}
	}
	if itemList.Item != nil {
		return &itemList, nil
	}
	return &itemList, errors.New("category not found")
}

func (gs *GroceryServer) BuyGrocery(ctx context.Context, in *ec.PaymentRequest) (*ec.PaymentResponse, error) {
	amount := in.GetAmount()
	purchasedItem := in.GetItem()

	transactionSuccessfull := true
	var transactionDetails string

	change := amount - purchasedItem.Price

	if change < 0 {
		transactionSuccessfull = false
	}

	if transactionSuccessfull {
		transactionDetails = fmt.Sprintf("Transaction of amount %v is successful", amount)
	} else {
		transactionDetails = fmt.Sprintf("Transaction of amount %v failed, payment missmatch", amount)
	}

	return &ec.PaymentResponse{
		Success:       transactionSuccessfull,
		PurchasedItem: purchasedItem,
		Details:       transactionDetails,
		Change:        change,
	}, nil
}

func main() {
	lis, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", 8080))
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	s := grpc.NewServer()
	ec.RegisterGroceryServer(s, initGroceryServer())

	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to start server %v", err)
	}
}

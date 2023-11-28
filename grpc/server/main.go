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
				Category: "vegetables",
				Name:     "carrot",
				Quantity: "4",
				Price:    0.5,
			},
			{
				Category: "fruit",
				Name:     "apple",
				Quantity: "3",
				Price:    0.6,
			},
			{
				Category: "electronics",
				Name:     "iphone",
				Quantity: "1",
				Price:    1200.99,
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

	return &ec.Item{}, nil
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

func (gs *GroceryServer) MakePayment(ctx context.Context, in *ec.PaymentRequest) (*ec.PaymentResponse, error) {
	amount := in.GetAmount()
	purchasedItem := in.GetItem()

	transactionSuccessfull := true
	var transactionDetails string

	if transactionSuccessfull {
		transactionDetails = fmt.Sprintf("Transaction of amount %v is successful", amount)
	} else {
		transactionDetails = fmt.Sprintf("Transaction of amount %v failed", amount)
	}

	change := amount - purchasedItem.Price

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

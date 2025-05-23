package main

import (
	"cosapp/pkg"
	"flag"
	"fmt"
)

func main() {
	flag.Parse()

	args := flag.Args()
	fmt.Println(args)
	if len(args) == 1 && args[0] == "download" {
		pkg.DownloadIimagesWithPrefix()
	} else {
		go pkg.DownloadThumbnailsPeriodically()
		go pkg.DownloadImagesPeriodically()
		pkg.Serve()
	}

}

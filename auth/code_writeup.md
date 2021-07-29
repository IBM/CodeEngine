# Authorization Security Solution
Code Engine is a useful tool for quickly and easily developing applications to run on IBM’s cloud. Connecting these applications to an API Gateway can add functionality and security to the Code Engine application. However, the Code Engine application still has some vulnerabilities even when connected to an API Gateway. The Code Engine development team is working on a solution to add more security in these connections, but to bridge the gap between the present day and the release of that new feature, Doug Davis of the IBM Code Engine team has developed this example repository to demonstrate a workaround that allows you to get some security features on your Code Engine app. This repository can be broken up into 3 parts:
- The dockerfile portion
- The Nginx server
- The underlying Code Engine application.

## Dockerfile Portion
The dockerfile portion of the project is 2 files, Dockerfile.app and Dockerfile.nginx. These files are used when building the project. They organize the files that will be used to run the servers and replace lines in the code with protected information. The code for these files can be seen below.

### Dockerfile.app
            FROM golang:alpine
            COPY app.go /
            RUN go build -o /app /app.go

            # Copy the exe into a smaller base image
            FROM alpine
            COPY --from=0 /app /app
            CMD /app

### Dockerfile.nginx
            # A special NGINX image due to current limitations, should be removed soon
            FROM nginxinc/nginx-unprivileged
            USER 101

            # call-ngninx is just a script that'll replace "NS" in the config file with
            # the proper project ID
            COPY call-nginx /

            # htpasswd contains the user/password info - for auth
            COPY htpasswd /etc/apache2/.htpasswd

            # Use our custom nginx config file
            COPY nginx.conf /etc/nginx/conf.d/default.conf

            # At runtime, call the wrapper script to do the "NS" substitutions
            CMD ["/call-nginx"]


## Nginx Portion
The Nginx potion of the project acts like our middleman. This is the server that traffic from the API Gateway is directed to. The Nginx server has credentials that are specified in the htpasswd file, these credentials must be supplied by the user in order to be directed to the underlying app. The call-nginx file replaces a placeholder value in the nginx.conf file with the actual subdomain of the underlying app. This application domain is automatically set up by Code Engine itself and the code defines this domain as CE_SUBDOMAIN. The nginx.conf file sets up the configuration of the Nginx server, in this repository the configuration is fairly basic, this file can be expanded upon if desired however this is all that is required.

### call-nginx
            #!/bin/bash

            set -ex

            # Replace all "NS" in the config file with the Code Engine subdomain (k8s ns)
            sed -i "s/NS/$CE_SUBDOMAIN/g" /etc/nginx/conf.d/default.conf

            # Now run nginx
            nginx-debug -g "daemon off;"

### htpasswd
            # Sample basic auth user/password file. The values are:
            # admin:letmein
            # user:please

            admin:$apr1$YH9W13n4$u9DCsxvaObzIprCR4hb37/
            user:$apr1$LxEps0ig$6kMGGh5fdKxx.mzbGzs3U/

### nginx.conf
            access_log /dev/stdout main;
            server {
                listen 8080 ;
                server_name *.codeengine.appdomain.cloud ;

                location / {
		            # Send request on to Application called "app"
		            # The "NS" will be replaced by the "call-nginx" script at runtime
                    proxy_pass http://auth-app.NS.svc.cluster.local ;

		            # We need the Host header to point to the right Application
                    proxy_set_header Host auth-app.NS.svc.cluster.local ;

		            # Set some other headers
                    proxy_set_header X-Real-IP $remote_addr ;
                    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for ;

                    # Websocket stuff
                    proxy_http_version 1.1 ;
                    proxy_set_header Upgrade $http_upgrade ;
                    proxy_set_header Connection "upgrade" ;
                    proxy_set_header X-Scheme $scheme ;

		            # Misc stuff
                    proxy_cache_bypass $http_upgrade ;
                    proxy_redirect off ;

		            # Setup our Basic Auth stuff
                    auth_basic           "Protected Area" ;
                    auth_basic_user_file /etc/apache2/.htpasswd ;
                }
            }

## Code Engine Application Portion
The final portion of this repository is the app.go file. This is a placeholder file for whatever underlying Code Engine application that you are attempting to deploy at the moment. You can fill this portion of the project with whatever code you wrote to be deployed on Code Engine. 

### app.go
            package main

            import (
	            "fmt"
	            "net/http"
            )

            // This func will handle all incoming HTTP requests
            func HandleHTTP(w http.ResponseWriter, r *http.Request) {
	            fmt.Fprintf(w, "You made it to the real app!\n")
            }

            func main() {
	            fmt.Printf("Listening on port 8080\n")
	            http.HandleFunc("/", HandleHTTP)
	            http.ListenAndServe(":8080", nil)
            }
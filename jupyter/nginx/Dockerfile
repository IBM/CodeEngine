FROM registry.access.redhat.com/ubi9/nginx-124

# Start-nginx is a script that'll replace all environment variables in the nginx.conf file
COPY start-nginx /

# Add the nginx configuration files
COPY jupyter-template.conf /tmp/jupyter-template.conf
ADD nginx.conf "${NGINX_CONF_PATH}"

# At runtime, call the wrapper script to do the variable substitutions prior starting the NGINX server
ENTRYPOINT ["/start-nginx"]
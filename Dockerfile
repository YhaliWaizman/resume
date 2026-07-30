FROM nginx:alpine

# Serve the static resume page
COPY resume.html /usr/share/nginx/html/index.html

# nginx server config: apex domain, no www
COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

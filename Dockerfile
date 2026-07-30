FROM nginx:alpine

# Serve the static resume page
COPY resume.html /usr/share/nginx/html/index.html

EXPOSE 80

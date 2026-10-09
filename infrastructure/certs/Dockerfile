# One-shot generator for the local CA and the nginx server certificate.
# docker-compose.yml bind-mounts infrastructure/certs/out at /out.
FROM alpine

RUN apk add --no-cache openssl

COPY generate.sh /generate.sh

# Invoked via sh so the script's exec bit doesn't matter.
CMD ["/bin/sh", "/generate.sh"]

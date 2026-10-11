#!/bin/sh
# Creates a local CA and a localhost server certificate signed by it, in /out:
#   ca/rootCA.pem, ca/rootCA-key.pem          — imported once into the browser (README);
#                                               the key never leaves this directory
#   server/fullchain.pem, server/privkey.pem  — mounted read-only into nginx
# Existing certificates are never regenerated: the browser trusts this exact CA.
set -eu
umask 077

OUT=/out
CA_DIR="$OUT/ca"
SERVER_DIR="$OUT/server"

if [ -f "$SERVER_DIR/fullchain.pem" ] && [ -f "$SERVER_DIR/privkey.pem" ]; then
    echo "certs exist, skipping"
    exit 0
fi

mkdir -p "$CA_DIR" "$SERVER_DIR"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Reuse an existing CA so a browser that already imported it keeps trusting us.
if [ -f "$CA_DIR/rootCA.pem" ] && [ -f "$CA_DIR/rootCA-key.pem" ]; then
    echo "reusing existing CA: $CA_DIR/rootCA.pem"
else
    cat > "$TMP/ca.cnf" <<'EOF'
[req]
distinguished_name = dn
x509_extensions = v3_ca
prompt = no

[dn]
CN = Pawfect Match Local CA

[v3_ca]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always
EOF
    openssl genpkey -quiet -algorithm RSA -pkeyopt rsa_keygen_bits:4096 \
        -out "$CA_DIR/rootCA-key.pem"
    openssl req -x509 -new -sha256 -days 3650 -config "$TMP/ca.cnf" \
        -key "$CA_DIR/rootCA-key.pem" -out "$CA_DIR/rootCA.pem"
    chmod 600 "$CA_DIR/rootCA-key.pem"
    chmod 644 "$CA_DIR/rootCA.pem"
    echo "created CA: $CA_DIR/rootCA.pem (valid 10 years)"
fi

cat > "$TMP/server.ext" <<'EOF'
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = DNS:localhost, IP:127.0.0.1
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid, issuer
EOF

# privkey first, fullchain last: the skip check needs both, so an interrupted
# run is regenerated on the next start instead of skipped.
openssl genpkey -quiet -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
    -out "$SERVER_DIR/privkey.pem"
chmod 600 "$SERVER_DIR/privkey.pem"
openssl req -new -subj "/CN=localhost" \
    -key "$SERVER_DIR/privkey.pem" -out "$TMP/server.csr"
openssl x509 -req -sha256 -days 365 -in "$TMP/server.csr" \
    -CA "$CA_DIR/rootCA.pem" -CAkey "$CA_DIR/rootCA-key.pem" \
    -set_serial "0x$(openssl rand -hex 16)" \
    -extfile "$TMP/server.ext" -out "$SERVER_DIR/fullchain.pem"
chmod 644 "$SERVER_DIR/fullchain.pem"
echo "created server certificate: $SERVER_DIR/fullchain.pem (CN=localhost, valid 365 days)"

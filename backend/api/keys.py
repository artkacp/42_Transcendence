import hashlib
import hmac
import secrets


def hash_key(full_key):
    return hashlib.sha256(full_key.encode()).hexdigest()


# The plaintext key is returned to the caller once and never stored; only its hash is saved.
def generate_key():
    prefix = secrets.token_hex(4)
    full_key = f'{prefix}.{secrets.token_urlsafe(32)}'
    return full_key, prefix, hash_key(full_key)


def check_key(full_key, key_hash):
    return hmac.compare_digest(hash_key(full_key), key_hash)

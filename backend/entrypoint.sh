#!/bin/sh
# Apply migrations, reset presence and collect static files, then replace this
# shell with the container's command (Daphne by default) so it runs as PID 1 and
# receives signals directly.
set -e

python manage.py migrate --noinput
# Presence is in-process memory, so a fresh process starts with everyone offline
python manage.py reset_presence
python manage.py collectstatic --noinput

exec "$@"

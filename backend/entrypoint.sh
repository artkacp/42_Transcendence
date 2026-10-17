#!/bin/sh
# Apply migrations and collect static files, then replace this shell with the
# container's command (Daphne by default) so it runs as PID 1 and receives
# signals directly.
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec "$@"

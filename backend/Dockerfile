FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Apply migrations before handing off to CMD. Invoked via sh so it still runs
# when the dev bind mount replaces /app with host files (and host permissions).
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]

# Default command: a single Daphne ASGI process — never add workers (see CLAUDE.md).
# docker-compose.dev.yml overrides this for local development with Django's runserver.
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]

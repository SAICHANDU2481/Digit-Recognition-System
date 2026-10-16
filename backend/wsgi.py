"""
WSGI Entrypoint for Production Web Servers (Gunicorn / Waitress / uWSGI).

Render / Linux Production Start Command:
    gunicorn --bind 0.0.0.0:$PORT --workers 2 --threads 2 --timeout 120 wsgi:app
"""
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app import app

if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("FLASK_PORT", 5000)))
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    app.run(host=host, port=port)

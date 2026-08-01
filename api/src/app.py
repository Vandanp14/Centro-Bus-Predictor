from __future__ import annotations

import logging
import os

from flask import Flask
from flask_cors import CORS

from .config import allowed_cors_origins, load_local_environment
from .middleware.request_id import assign_request_id, json_error
from .routes import health, predictions, routes, vehicles, patterns, spa

LOGGER = logging.getLogger(__name__)


def create_app(*, testing=False):
    load_local_environment()

    app = Flask(__name__, static_folder=None)
    app.config.update(TESTING=testing)

    CORS(
        app,
        resources={r"/api/v1/*": {"origins": allowed_cors_origins()}},
        supports_credentials=False,
    )

    app.before_request(assign_request_id)

    @app.after_request
    def add_response_headers(response):
        from flask import g, request
        response.headers["X-Request-ID"] = getattr(g, "request_id", "")
        response.headers["X-Content-Type-Options"] = "nosniff"
        if request.path.startswith("/api/v1/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    from .services.centro_client import CentroAPIError
    from .routes.spa import _serve_spa

    @app.errorhandler(CentroAPIError)
    def handle_centro_error(error):
        return json_error("CENTRO_UNAVAILABLE", str(error), error.status_code)

    @app.errorhandler(404)
    def handle_not_found(_error_value):
        from flask import request
        if request.path.startswith("/api/"):
            return json_error("NOT_FOUND", "API endpoint not found.", 404)
        return _serve_spa(request.path.lstrip("/"))

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        from flask import g
        LOGGER.exception("Unhandled request %s", getattr(g, "request_id", None), exc_info=error)
        return json_error("INTERNAL_ERROR", "The server could not complete this request.", 500)

    app.register_blueprint(health.blueprint)
    app.register_blueprint(routes.blueprint)
    app.register_blueprint(predictions.blueprint)
    app.register_blueprint(vehicles.blueprint)
    app.register_blueprint(patterns.blueprint)
    app.register_blueprint(spa.blueprint)

    return app


app = create_app()


if __name__ == "__main__":
    from .config import is_debug, server_port
    app.run(host="0.0.0.0", port=server_port(), debug=is_debug())

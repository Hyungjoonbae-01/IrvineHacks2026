"""
ClearPath Drone Backend Server
Outdoor crowd congestion resolution via drone-mounted light system.

RED    → Shone onto congestion source
GREEN  → Circles red to indicate safe dispersal direction  
YELLOW → Shone onto low-congestion safe zones

Endpoints:
    GET  /health            - Server status
    POST /metrics           - Ingest AI perception data
    GET  /zones             - All zone states + directives
    POST /actuate           - Manual hardware command
    GET  /drone/priority    - Which zone drone should hover over
    GET  /drone/lights      - Current light color per zone
    POST /demo/force        - Force a zone into a specific state
    POST /demo/reset        - Reset all zones to NORMAL
    POST /scenario/<name>   - Switch scenario wording
"""

from flask import Flask
from flask_cors import CORS
from backend.api.routes import register_routes

# ─────────────────────────────────────────
# App Init
# ─────────────────────────────────────────

app = Flask(__name__)
CORS(app)

# Register all routes from routes.py
register_routes(app)

# ─────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
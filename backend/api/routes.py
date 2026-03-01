# backend/api/routes.py

from flask import jsonify, request
from backend.engine.state_machine import ZoneRegistry, ZoneState
from backend.engine.instruction_engine import InstructionEngine
from backend.engine.modality_policy import LightPolicy

registry = ZoneRegistry(zone_ids=["Z1","Z2","Z3","Z4","Z5","Z6"])
engine   = InstructionEngine(scenario="DEFAULT")
policy   = LightPolicy()

def register_routes(app):

    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status':   'ok',
            'service':  'ClearPath Drone Backend',
            'scenario': engine.scenario,
            'zones':    list(registry.machines.keys())
        })

    @app.route('/metrics', methods=['POST'])
    def receive_metrics():
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON payload received'}), 400
        required = ['zone', 'density', 'flow_stability', 'stop_go']
        missing  = [f for f in required if f not in data]
        if missing:
            return jsonify({'error': f'Missing fields: {missing}'}), 400
        zone_id = data['zone']
        if zone_id not in registry.machines:
            return jsonify({'error': f'Unknown zone: {zone_id}'}), 404
        new_state = registry.update_zone(zone_id, data)
        result    = engine.resolve(zone_id, new_state, data)
        return jsonify(result), 200

    @app.route('/zones', methods=['GET'])
    def get_zones():
        all_states = registry.get_all_states()
        output     = engine.resolve_all(all_states)
        return jsonify({'zones': output}), 200

    @app.route('/actuate', methods=['POST'])
    def actuate_hardware():
        data = request.get_json()
        if not data or 'command' not in data:
            return jsonify({'error': 'Missing command field'}), 400
        return jsonify({'status': 'actuated', 'command': data['command']}), 200

    # ── Drone-Specific Endpoints ──────────────────────────────────────

    @app.route('/drone/priority', methods=['GET'])
    def get_drone_priority():
        """
        Returns the zone the drone should prioritize hovering over.
        Polled by drone controller.
        """
        all_states = registry.get_all_states()
        priority   = engine.get_drone_priority(all_states)
        return jsonify(priority), 200

    @app.route('/drone/lights', methods=['GET'])
    def get_light_assignments():
        """
        Returns current light color assignment per zone.
        RED / GREEN / YELLOW / NONE
        """
        all_states = registry.get_all_states()
        lights     = {
            zone_id: policy.resolve(zone_id, ZoneState(ctx['state'])).value
            for zone_id, ctx in all_states.items()
        }
        return jsonify({
            'lights':      lights,
            'danger_zones': policy.get_danger_zones(all_states),
            'safe_zones':   policy.get_safe_zones(all_states),
        }), 200

    # ── Demo Controls ─────────────────────────────────────────────────

    @app.route('/demo/force', methods=['POST'])
    def force_zone_state():
        data = request.get_json()
        if not data or 'zone_id' not in data or 'state' not in data:
            return jsonify({'error': 'Missing zone_id or state'}), 400
        try:
            state   = ZoneState(data['state'].upper())
            zone_id = data['zone_id']
            registry.force_zone_state(zone_id, state)
            result  = engine.resolve(zone_id, state, {})
            return jsonify({'ok': True, 'zone': zone_id, 'forced_state': state.value}), 200
        except ValueError:
            return jsonify({'error': f"Invalid state: {data['state']}"}), 400

    @app.route('/demo/reset', methods=['POST'])
    def reset_all_zones():
        registry.reset_all()
        return jsonify({'ok': True, 'message': 'All zones reset to NORMAL'}), 200

    @app.route('/scenario/<name>', methods=['POST'])
    def set_scenario(name):
        valid = ["DEFAULT", "FESTIVAL", "PROTEST", "EVACUATION"]
        if name.upper() not in valid:
            return jsonify({'error': f'Invalid scenario. Choose from: {valid}'}), 400
        engine.set_scenario(name)
        return jsonify({'ok': True, 'scenario': name.upper()}), 200
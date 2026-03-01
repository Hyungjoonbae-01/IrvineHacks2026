# backend/engine/instruction_engine.py

from backend.engine.state_machine import ZoneState
from backend.engine.modality_policy import LightPolicy, LightOutput

# ─────────────────────────────────────────
# Drone Directives
# These represent what the drone physically does
# ─────────────────────────────────────────

class Directive:
    # Red light directives — shine onto congestion source
    EMIT_RED_HOLD     = ("EMIT_RED_HOLD",     "Drone holds position. Emitting red onto congestion source.")
    EMIT_RED_CIRCLE   = ("EMIT_RED_CIRCLE",   "Drone circling zone. Emitting red to mark danger area.")

    # Green light directives — circle around red to show exit direction
    EMIT_GREEN_NORTH  = ("EMIT_GREEN_NORTH",  "Green arc pointing north. Move toward Z1.")
    EMIT_GREEN_SOUTH  = ("EMIT_GREEN_SOUTH",  "Green arc pointing south. Move toward Z6.")
    EMIT_GREEN_EAST   = ("EMIT_GREEN_EAST",   "Green arc pointing east. Move toward Z4.")
    EMIT_GREEN_WEST   = ("EMIT_GREEN_WEST",   "Green arc pointing west. Move toward Z5.")

    # Yellow light directives — shine onto safe/low-density areas
    EMIT_YELLOW_PULSE = ("EMIT_YELLOW_PULSE", "Drone pulsing yellow. Area is safe to move toward.")
    EMIT_YELLOW_HOLD  = ("EMIT_YELLOW_HOLD",  "Drone holding yellow. Low congestion area.")

    # Standby
    STANDBY           = ("STANDBY",           "Drone on standby. No intervention required.")
    RECOVERY_SCAN     = ("RECOVERY_SCAN",      "Drone scanning. Congestion clearing.")

# ─────────────────────────────────────────
# Zone Types — outdoor grid
# ─────────────────────────────────────────

ZONE_TYPES = {
    "Z1": "HOTSPOT",    # historically high congestion
    "Z2": "HOTSPOT",
    "Z3": "CORRIDOR",   # transition zones between hotspot and safe
    "Z4": "CORRIDOR",
    "Z5": "SAFE",       # low density, target dispersal areas
    "Z6": "SAFE",
}

# Adjacency map — which safe zones are nearest each hotspot
# Used to pick the correct GREEN direction directive
ZONE_ADJACENCY = {
    "Z1": "Z5",   # Z1 congestion → direct crowd toward Z5
    "Z2": "Z6",
    "Z3": "Z5",
    "Z4": "Z6",
}

# ─────────────────────────────────────────
# Directive Table
# Zone type + State → Drone Directive
# ─────────────────────────────────────────

DIRECTIVE_TABLE = {
    ("HOTSPOT",  ZoneState.NORMAL):     Directive.STANDBY,
    ("HOTSPOT",  ZoneState.ELEVATED):   Directive.EMIT_YELLOW_PULSE,
    ("HOTSPOT",  ZoneState.OVERLOADED): Directive.EMIT_RED_HOLD,
    ("HOTSPOT",  ZoneState.RECOVERY):   Directive.RECOVERY_SCAN,

    ("CORRIDOR", ZoneState.NORMAL):     Directive.STANDBY,
    ("CORRIDOR", ZoneState.ELEVATED):   Directive.EMIT_YELLOW_PULSE,
    ("CORRIDOR", ZoneState.OVERLOADED): Directive.EMIT_RED_CIRCLE,
    ("CORRIDOR", ZoneState.RECOVERY):   Directive.RECOVERY_SCAN,

    ("SAFE",     ZoneState.NORMAL):     Directive.EMIT_YELLOW_HOLD,
    ("SAFE",     ZoneState.ELEVATED):   Directive.EMIT_YELLOW_HOLD,
    ("SAFE",     ZoneState.OVERLOADED): Directive.EMIT_RED_HOLD,   # safe zone overwhelmed
    ("SAFE",     ZoneState.RECOVERY):   Directive.EMIT_YELLOW_PULSE,
}

# ─────────────────────────────────────────
# Scenario Overrides
# ─────────────────────────────────────────

SCENARIO_OVERRIDES = {
    "FESTIVAL": {
        Directive.EMIT_RED_HOLD[0]:     "Drone holding red over festival crowd hotspot.",
        Directive.EMIT_YELLOW_HOLD[0]:  "Drone marking open festival grounds. Safe to move here.",
    },
    "PROTEST": {
        Directive.EMIT_RED_HOLD[0]:     "Drone marking high-density protest zone.",
        Directive.EMIT_GREEN_NORTH[0]:  "Dispersal route available to the north.",
    },
    "EVACUATION": {
        Directive.EMIT_RED_HOLD[0]:     "Drone marking blocked evacuation corridor.",
        Directive.EMIT_YELLOW_HOLD[0]:  "Drone marking clear evacuation path.",
        Directive.STANDBY[0]:           "Drone scanning evacuation perimeter.",
    },
}

# ─────────────────────────────────────────
# Instruction Engine
# ─────────────────────────────────────────

class InstructionEngine:

    def __init__(self, scenario: str = "DEFAULT"):
        self.scenario = scenario
        self.policy   = LightPolicy()

    def set_scenario(self, scenario: str):
        self.scenario = scenario.upper()

    def resolve(self, zone_id: str, state: ZoneState, metrics: dict) -> dict:
        zone_type = ZONE_TYPES.get(zone_id, "CORRIDOR")
        directive = DIRECTIVE_TABLE.get((zone_type, state), Directive.STANDBY)
        code, description = directive

        # Apply scenario override if available
        if self.scenario in SCENARIO_OVERRIDES:
            description = SCENARIO_OVERRIDES[self.scenario].get(code, description)

        # Resolve light output
        light = self.policy.resolve(zone_id, state)

        # If zone is overloaded, attach green direction toward nearest safe zone
        green_target  = None
        green_directive = None
        if state == ZoneState.OVERLOADED:
            green_target = ZONE_ADJACENCY.get(zone_id)
            if green_target:
                green_directive = f"Direct crowd toward {green_target} via green arc."

        # Format hardware command for STM32 / drone controller
        hw_command = f"{zone_id} {state.value} {light.value}"
        if green_target:
            hw_command += f" GREEN_TO_{green_target}"

        return {
            "zone_id":         zone_id,
            "state":           state.value,
            "zone_type":       zone_type,
            "directive":       code,
            "description":     description,
            "light":           light.value,
            "green_target":    green_target,
            "green_directive": green_directive,
            "hw_command":      hw_command,
        }

    def resolve_all(self, all_states: dict) -> dict:
        """
        Resolve directives for all zones at once.
        Used by /zones endpoint.
        """
        output = {}
        for zone_id, ctx in all_states.items():
            state          = ZoneState(ctx['state'])
            output[zone_id] = {
                **ctx,
                **self.resolve(zone_id, state, ctx)
            }
        return output

    def get_drone_priority(self, all_states: dict) -> dict:
        """
        Returns the zone the drone should prioritize hovering over.
        Highest density OVERLOADED zone wins.
        Exposed via /drone/priority endpoint.
        """
        overloaded = [
            (zone_id, ctx)
            for zone_id, ctx in all_states.items()
            if ctx['state'] == ZoneState.OVERLOADED.value
        ]
        if not overloaded:
            elevated = [
                (zone_id, ctx)
                for zone_id, ctx in all_states.items()
                if ctx['state'] == ZoneState.ELEVATED.value
            ]
            if not elevated:
                return {"priority_zone": None, "reason": "All zones nominal"}
            overloaded = elevated

        priority = max(overloaded, key=lambda x: x[1].get('density', 0))
        return {
            "priority_zone": priority[0],
            "state":         priority[1]['state'],
            "density":       priority[1].get('density', 0),
            "reason":        "Highest density zone"
        }
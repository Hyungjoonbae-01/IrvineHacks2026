# backend/engine/modality_policy.py

from enum import Enum
from backend.engine.state_machine import ZoneState

class LightOutput(Enum):
    RED    = "RED"     # Drone shines red onto congestion source
    GREEN  = "GREEN"   # Drone circles green to show safe direction
    YELLOW = "YELLOW"  # Drone shines yellow onto low-congestion areas
    NONE   = "NONE"    # No light output — zone is clear

# ─────────────────────────────────────────
# Light Policy Table
# Zone + State → Light Output
# ─────────────────────────────────────────

LIGHT_TABLE = {
    #        NORMAL           ELEVATED          OVERLOADED       RECOVERY
    "Z1": {
        ZoneState.NORMAL:     LightOutput.NONE,
        ZoneState.ELEVATED:   LightOutput.YELLOW,
        ZoneState.OVERLOADED: LightOutput.RED,
        ZoneState.RECOVERY:   LightOutput.GREEN,
    },
    "Z2": {
        ZoneState.NORMAL:     LightOutput.NONE,
        ZoneState.ELEVATED:   LightOutput.YELLOW,
        ZoneState.OVERLOADED: LightOutput.RED,
        ZoneState.RECOVERY:   LightOutput.GREEN,
    },
    "Z3": {
        ZoneState.NORMAL:     LightOutput.NONE,
        ZoneState.ELEVATED:   LightOutput.YELLOW,
        ZoneState.OVERLOADED: LightOutput.RED,
        ZoneState.RECOVERY:   LightOutput.GREEN,
    },
    "Z4": {
        ZoneState.NORMAL:     LightOutput.YELLOW,  # consistently low density — signal safety
        ZoneState.ELEVATED:   LightOutput.YELLOW,
        ZoneState.OVERLOADED: LightOutput.RED,
        ZoneState.RECOVERY:   LightOutput.GREEN,
    },
    "Z5": {
        ZoneState.NORMAL:     LightOutput.YELLOW,
        ZoneState.ELEVATED:   LightOutput.YELLOW,
        ZoneState.OVERLOADED: LightOutput.RED,
        ZoneState.RECOVERY:   LightOutput.GREEN,
    },
    "Z6": {
        ZoneState.NORMAL:     LightOutput.NONE,
        ZoneState.ELEVATED:   LightOutput.YELLOW,
        ZoneState.OVERLOADED: LightOutput.RED,
        ZoneState.RECOVERY:   LightOutput.GREEN,
    },
}

FALLBACK_LIGHT = LightOutput.NONE

class LightPolicy:

    def resolve(self, zone_id: str, state: ZoneState) -> LightOutput:
        zone_rules = LIGHT_TABLE.get(zone_id)
        if not zone_rules:
            return FALLBACK_LIGHT
        return zone_rules.get(state, FALLBACK_LIGHT)

    def get_safe_zones(self, all_states: dict) -> list:
        """
        Returns zones currently showing YELLOW —
        used by drone to know where to direct crowds toward.
        """
        return [
            zone_id for zone_id, ctx in all_states.items()
            if self.resolve(zone_id, ZoneState(ctx['state'])) == LightOutput.YELLOW
        ]

    def get_danger_zones(self, all_states: dict) -> list:
        """
        Returns zones currently showing RED —
        used by drone to prioritize where to hover.
        """
        return [
            zone_id for zone_id, ctx in all_states.items()
            if self.resolve(zone_id, ZoneState(ctx['state'])) == LightOutput.RED
        ]
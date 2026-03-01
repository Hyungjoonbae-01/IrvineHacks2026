# Zone State Machine
# States: NORMAL / ELEVATED / OVERLOADED / RECOVERY
# Manages state transitions and cooldown timers per zone

# TODO: Implement BE-1 - Zone State Machine
# Classes: 
#   ZoneState (Defines the 4 different states)
#   ZoneStateContext (
#   ZoneStateMachine, 
#   ZoneRegistry

import time
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional

# ─────────────────────────────────────────
# State Definitions
# ─────────────────────────────────────────

class ZoneState(Enum):
    NORMAL     = "NORMAL"
    ELEVATED   = "ELEVATED"
    OVERLOADED = "OVERLOADED"
    RECOVERY   = "RECOVERY"

# ─────────────────────────────────────────
# Thresholds 
# ─────────────────────────────────────────
# TODO: Tune parameters during calibration

THRESHOLDS = {
    "elevated": {
        "density":        0.50,   # 50% zone occupancy
        "flow_stability": 0.60,   # below this = unstable
    },
    "overloaded": {
        "density":        0.75,
        "flow_stability": 0.35,
        "stop_go":        True,
    },
    "recovery": {
        "density":        0.55,   # must drop below this to exit OVERLOADED
        "flow_stability": 0.55,
    },
    "cooldowns": {
        "overloaded_min_duration": 15,  # seconds — can't leave OVERLOADED before this
        "recovery_duration":       20,  # seconds — must stay in RECOVERY before NORMAL
        "elevated_min_duration":   10,
    }
}

# ─────────────────────────────────────────
# Zone State Object
# ─────────────────────────────────────────

@dataclass
class ZoneStateContext:
    zone_id:           str
    state:             ZoneState = ZoneState.NORMAL
    previous_state:    Optional[ZoneState] = None
    state_entered_at:  float = field(default_factory=time.time)
    last_updated_at:   float = field(default_factory=time.time)

    # Latest metrics snapshot
    density:           float = 0.0
    flow_stability:    float = 1.0
    stop_go:           bool  = False

    # Transition tracking
    transition_count:  int   = 0
    overload_count:    int   = 0   # how many times this zone has hit OVERLOADED

    def time_in_state(self) -> float:
        return time.time() - self.state_entered_at

    def to_dict(self) -> dict:
        return {
            "zone_id":          self.zone_id,
            "state":            self.state.value,
            "previous_state":   self.previous_state.value if self.previous_state else None,
            "time_in_state":    round(self.time_in_state(), 1),
            "density":          self.density,
            "flow_stability":   self.flow_stability,
            "stop_go":          self.stop_go,
            "overload_count":   self.overload_count,
            "last_updated_at":  self.last_updated_at,
        }

# ─────────────────────────────────────────
# State Machine
# ─────────────────────────────────────────

class ZoneStateMachine:

    def __init__(self, zone_id: str):
        self.ctx = ZoneStateContext(zone_id=zone_id)

    def update(self, metrics: dict) -> ZoneState:
        """
        Consume a metrics dict from AI-3 and transition state if needed.
        Returns the new (or unchanged) state.
        """
        # Update stored metrics
        self.ctx.density        = metrics.get("density", 0.0)
        self.ctx.flow_stability = metrics.get("flow_stability", 1.0)
        self.ctx.stop_go        = metrics.get("stop_go", False)
        self.ctx.last_updated_at = time.time()

        current = self.ctx.state

        if current == ZoneState.NORMAL:
            if self._should_elevate():
                self._transition(ZoneState.ELEVATED)

        elif current == ZoneState.ELEVATED:
            if self._should_overload():
                self._transition(ZoneState.OVERLOADED)
            elif self._should_normalize_from_elevated():
                self._transition(ZoneState.NORMAL)

        elif current == ZoneState.OVERLOADED:
            cooldown = THRESHOLDS["cooldowns"]["overloaded_min_duration"]
            if self.ctx.time_in_state() >= cooldown and self._should_recover():
                self._transition(ZoneState.RECOVERY)

        elif current == ZoneState.RECOVERY:
            recovery_duration = THRESHOLDS["cooldowns"]["recovery_duration"]
            if self._should_re_overload():
                self._transition(ZoneState.OVERLOADED)
            elif self.ctx.time_in_state() >= recovery_duration:
                self._transition(ZoneState.NORMAL)

        return self.ctx.state

    # ── Transition Conditions ──────────────────────────────────────────

    def _should_elevate(self) -> bool:
        t = THRESHOLDS["elevated"]
        return (
            self.ctx.density > t["density"] or
            self.ctx.flow_stability < t["flow_stability"]
        )

    def _should_overload(self) -> bool:
        t = THRESHOLDS["overloaded"]
        min_dur = THRESHOLDS["cooldowns"]["elevated_min_duration"]
        return (
            self.ctx.time_in_state() >= min_dur and
            self.ctx.density > t["density"] and
            self.ctx.flow_stability < t["flow_stability"] and
            self.ctx.stop_go == t["stop_go"]
        )

    def _should_normalize_from_elevated(self) -> bool:
        t = THRESHOLDS["elevated"]
        return (
            self.ctx.density < t["density"] * 0.85 and   # hysteresis band
            self.ctx.flow_stability > t["flow_stability"]
        )

    def _should_recover(self) -> bool:
        t = THRESHOLDS["recovery"]
        return (
            self.ctx.density < t["density"] and
            self.ctx.flow_stability > t["flow_stability"] and
            not self.ctx.stop_go
        )

    def _should_re_overload(self) -> bool:
        # If conditions worsen again during recovery, snap back
        t = THRESHOLDS["overloaded"]
        return (
            self.ctx.density > t["density"] and
            self.ctx.stop_go
        )

    # ── Transition Executor ───────────────────────────────────────────

    def _transition(self, new_state: ZoneState):
        print(f"[SM] {self.ctx.zone_id}: {self.ctx.state.value} → {new_state.value}")
        self.ctx.previous_state   = self.ctx.state
        self.ctx.state            = new_state
        self.ctx.state_entered_at = time.time()
        self.ctx.transition_count += 1
        if new_state == ZoneState.OVERLOADED:
            self.ctx.overload_count += 1

    def get_context(self) -> ZoneStateContext:
        return self.ctx

    def force_state(self, state: ZoneState):
        """Demo control panel override."""
        self._transition(state)

# ─────────────────────────────────────────
# Registry — one machine per zone
# ─────────────────────────────────────────

class ZoneRegistry:

    def __init__(self, zone_ids):
        self.machines: dict[str, ZoneStateMachine] = {
            zid: ZoneStateMachine(zid) for zid in zone_ids
        }

    def update_zone(self, zone_id: str, metrics: dict) -> ZoneState:
        if zone_id not in self.machines:
            raise ValueError(f"Unknown zone: {zone_id}")
        return self.machines[zone_id].update(metrics)

    def get_all_states(self) -> dict:
        return {
            zid: machine.get_context().to_dict()
            for zid, machine in self.machines.items()
        }

    def force_zone_state(self, zone_id: str, state: ZoneState):
        self.machines[zone_id].force_state(state)

    def reset_all(self):
        for machine in self.machines.values():
            machine.force_state(ZoneState.NORMAL)
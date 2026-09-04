#!/usr/bin/env python3
"""
FlowWatch Mock Publisher — Sprint 0
Simulates an ESP32 unit publishing to all SCHEMA.md §1 device→cloud topics.
Sensor values oscillate sinusoidally so they naturally cross blockage/flood
thresholds, triggering realistic alert and cycle events.

Usage:
    python mock_publisher.py --unit unit1 --username device_unit1 --password <pwd>
    python mock_publisher.py --unit unit2 --username device_unit2 --password <pwd>
"""

import argparse
import json
import math
import random
import sys
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

# ---------------------------------------------------------------------------
# SCHEMA.md §5 — Firmware config constants (single source of truth)
# ---------------------------------------------------------------------------
BLOCKAGE_THRESHOLD_CM = 8.0
FLOOD_THRESHOLD_CM = 22.0
SENSOR_PUBLISH_INTERVAL_S = 2.0  # SENSOR_PUBLISH_INTERVAL_MS = 2000

# ---------------------------------------------------------------------------
# SCHEMA.md §4 — Controlled vocabularies
# ---------------------------------------------------------------------------
FAULT_CODES = [
    "ACTUATOR_OVERCURRENT",
    "LIMIT_SWITCH_TIMEOUT",
    "CAMERA_UNAVAILABLE",
    "SENSOR_OUT_OF_RANGE",
]

# ---------------------------------------------------------------------------
# RULES.md §3 — Flat state machine: STANDBY → LIFTING → FLIPPING → LOWERING
# ---------------------------------------------------------------------------
CYCLE_STATES = ["STANDBY", "LIFTING", "FLIPPING", "LOWERING"]


def iso_now():
    """ISO 8601 timestamp — SCHEMA.md §1: every payload carries its own ts."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def simulate_distance(t):
    """Ultrasonic distance (cm) — oscillates so it periodically dips below
    BLOCKAGE_THRESHOLD_CM to trigger blockage events."""
    base = 12.0
    amplitude = 6.0
    noise = random.uniform(-0.5, 0.5)
    return round(base + amplitude * math.sin(t * 0.05) + noise, 2)


def simulate_water_level(t):
    """Water level (cm) — oscillates so it periodically exceeds
    FLOOD_THRESHOLD_CM to trigger flood alerts."""
    base = 18.0
    amplitude = 6.0
    noise = random.uniform(-0.3, 0.3)
    return round(base + amplitude * math.sin(t * 0.03 + 1.0) + noise, 2)


# ---------------------------------------------------------------------------
# MQTT callbacks
# ---------------------------------------------------------------------------

def on_connect(client, userdata, flags, rc):
    unit = userdata["unit"]
    if rc == 0:
        print(f"[{unit}] Connected to broker")
        # Subscribe to control topic — SCHEMA.md §1
        topic = f"flowwatch/{unit}/control/#"
        client.subscribe(topic, qos=1)
        print(f"[{unit}] Subscribed to {topic}")
    else:
        print(f"[{unit}] Connection failed (rc={rc})")
        sys.exit(1)


def on_message(client, userdata, msg):
    """Handle incoming control commands — FR-6."""
    unit = userdata["unit"]
    try:
        payload = json.loads(msg.payload.decode())
        print(f"[{unit}] << CONTROL: {msg.topic} -> {payload}")

        # Respond to manual mode command — SCHEMA.md §1: control/manual
        if "manual" in msg.topic and payload.get("action") == "activate":
            print(f"[{unit}] Manual mode activated — queueing cycle")
            userdata["force_cycle"] = True
    except Exception as e:
        print(f"[{unit}] Error parsing control message: {e}")


def on_disconnect(client, userdata, rc):
    unit = userdata["unit"]
    if rc != 0:
        print(f"[{unit}] Unexpected disconnect (rc={rc}), will auto-reconnect...")


# ---------------------------------------------------------------------------
# Main simulation loop
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="FlowWatch Mock ESP32 Publisher (Sprint 0)"
    )
    parser.add_argument("--unit", default="unit1",
                        help="Unit ID: unit1 or unit2 (default: unit1)")
    parser.add_argument("--host", default="localhost",
                        help="MQTT broker host (default: localhost)")
    parser.add_argument("--port", type=int, default=1883,
                        help="MQTT broker port (default: 1883)")
    parser.add_argument("--username", default=None,
                        help="MQTT username (e.g. device_unit1)")
    parser.add_argument("--password", default=None,
                        help="MQTT password")
    parser.add_argument("--tls-ca", default=None,
                        help="Path to CA certificate for TLS connections")
    args = parser.parse_args()

    unit = args.unit
    prefix = f"flowwatch/{unit}"
    userdata = {"unit": unit, "force_cycle": False}

    # ── MQTT client setup ──────────────────────────────────────────────
    client_id = f"mock-{unit}-{random.randint(1000, 9999)}"
    client = mqtt.Client(client_id=client_id, userdata=userdata)
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    if args.username:
        client.username_pw_set(args.username, args.password)
    if args.tls_ca:
        client.tls_set(ca_certs=args.tls_ca)

    print(f"[{unit}] Connecting to {args.host}:{args.port} as {client_id}...")
    try:
        client.connect(args.host, args.port, keepalive=60)
    except Exception as e:
        print(f"[{unit}] Failed to connect: {e}")
        sys.exit(1)

    client.loop_start()
    time.sleep(1)  # Allow connection to establish

    # ── Simulation state ───────────────────────────────────────────────
    t = 0
    cycle_index = 0       # Current index into CYCLE_STATES
    cycle_tick = 0         # Ticks spent in current cycle state
    TICKS_PER_STATE = 5    # 5 ticks × 2s = 10s per actuator state
    blockage_active = False
    flood_active = False

    print(f"[{unit}] Publishing every {SENSOR_PUBLISH_INTERVAL_S}s — Ctrl+C to stop")
    print(f"[{unit}] Thresholds: blockage < {BLOCKAGE_THRESHOLD_CM}cm, "
          f"flood > {FLOOD_THRESHOLD_CM}cm")
    print()

    try:
        while True:
            ts = iso_now()

            # ── Sensor readings ────────────────────────────────────────
            distance_cm = simulate_distance(t)
            water_level_cm = simulate_water_level(t)

            # SCHEMA.md §1: flowwatch/{unit}/sensor/ultrasonic
            client.publish(
                f"{prefix}/sensor/ultrasonic",
                json.dumps({"cm": distance_cm, "ts": ts}),
                qos=0,
            )

            # SCHEMA.md §1: flowwatch/{unit}/sensor/waterlevel
            client.publish(
                f"{prefix}/sensor/waterlevel",
                json.dumps({"cm": water_level_cm, "ts": ts}),
                qos=0,
            )

            # ── Threshold alerts ───────────────────────────────────────

            # Blockage detection — FR-1
            if distance_cm < BLOCKAGE_THRESHOLD_CM and not blockage_active:
                blockage_active = True
                client.publish(
                    f"{prefix}/alert/blockage",
                    json.dumps({"distance_cm": distance_cm, "ts": ts}),
                    qos=1,
                )
                print(f"[{unit}] !! BLOCKAGE: {distance_cm}cm "
                      f"(threshold: {BLOCKAGE_THRESHOLD_CM}cm)")
                # Auto-trigger removal cycle — FR-3
                if cycle_index == 0:
                    cycle_index = 1
                    cycle_tick = 0
                    print(f"[{unit}] -> Removal cycle started: LIFTING")
            elif distance_cm >= BLOCKAGE_THRESHOLD_CM + 1.0:
                blockage_active = False  # Hysteresis band

            # Flood detection — FR-2
            if water_level_cm > FLOOD_THRESHOLD_CM and not flood_active:
                flood_active = True
                client.publish(
                    f"{prefix}/alert/flood",
                    json.dumps({"level_cm": water_level_cm, "ts": ts}),
                    qos=1,
                )
                print(f"[{unit}] !! FLOOD: {water_level_cm}cm "
                      f"(threshold: {FLOOD_THRESHOLD_CM}cm)")
            elif water_level_cm <= FLOOD_THRESHOLD_CM - 1.0:
                flood_active = False  # Hysteresis band

            # ── Manual mode — FR-6 ──────────────────────────────────
            if userdata["force_cycle"] and cycle_index == 0:
                cycle_index = 1
                cycle_tick = 0
                userdata["force_cycle"] = False
                print(f"[{unit}] -> Manual mode: LIFTING")

            # ── Actuator state machine — RULES.md §3 ──────────────────
            state = CYCLE_STATES[cycle_index]

            if cycle_index > 0:
                cycle_tick += 1
                if cycle_tick >= TICKS_PER_STATE:
                    cycle_index = (cycle_index + 1) % len(CYCLE_STATES)
                    cycle_tick = 0
                    state = CYCLE_STATES[cycle_index]
                    if cycle_index == 0:
                        print(f"[{unit}] OK Cycle complete -> STANDBY")
                    else:
                        print(f"[{unit}] -> State: {state}")

            # Override display state for flood condition
            if flood_active and cycle_index == 0:
                state = "ALERT_FLOOD"

            # SCHEMA.md §1: flowwatch/{unit}/status/actuator (retained, QoS 1)
            client.publish(
                f"{prefix}/status/actuator",
                json.dumps({"state": state, "ts": ts}),
                qos=1,
                retain=True,
            )

            # SCHEMA.md §1: flowwatch/{unit}/status/connectivity (retained, QoS 1)
            client.publish(
                f"{prefix}/status/connectivity",
                json.dumps({"wifi": True, "ts": ts}),
                qos=1,
                retain=True,
            )

            # ── Console output ─────────────────────────────────────────
            indicator = (
                "[!!]" if state in ("FAULT", "ALERT_FLOOD")
                else "[..]" if state != "STANDBY"
                else "[OK]"
            )
            print(
                f"  {indicator} dist={distance_cm:6.2f}cm  "
                f"water={water_level_cm:6.2f}cm  state={state}"
            )

            t += 1
            time.sleep(SENSOR_PUBLISH_INTERVAL_S)

    except KeyboardInterrupt:
        print(f"\n[{unit}] Shutting down...")
        # Publish offline status before disconnecting
        client.publish(
            f"{prefix}/status/connectivity",
            json.dumps({"wifi": False, "ts": iso_now()}),
            qos=1,
            retain=True,
        )
        client.loop_stop()
        client.disconnect()
        print(f"[{unit}] Disconnected.")


if __name__ == "__main__":
    main()

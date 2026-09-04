# FlowWatch

IoT drainage channel monitoring and automated debris removal. Detects blockages, triggers mechanical removal cycles, and gives operators live remote visibility — all without anyone on-site.

## Language

### Physical Entities

**Unit**:
A physical device installed at a drainage site, with sensors, actuators, and connectivity.
_Avoid_: Device, node, station

**Site**:
A location containing one or more Units. Sites group Units in the dashboard sidebar but have no independent data model.
_Avoid_: Location, installation

**Fleet**:
The collection of all Sites and their Units. Single fleet, no sub-grouping.
_Avoid_: Network, cluster

### Data Concepts

**Alert**:
A real-time MQTT signal from a device. Alerts are transient — they exist on the wire and are consumed by Node-RED, which persists them as Events.
_Avoid_: Signal, notification

**Event**:
A durable record in MySQL caused by an alert or system action. Events are the audit trail. They have a configurable TTL and are auto-purged when expired.
_Avoid_: Log, record, entry

**Measurement**:
A type of sensor data stored in InfluxDB (e.g., `ultrasonic`, `waterlevel`). One measurement per InfluxDB bucket per unit.
_Aavoid_: Series, stream

**Reading**:
One data point within a measurement — a value and a timestamp. A reading is what the dashboard displays and the API returns.
_Avoid_: Sample, datapoint, value

### Actuator Concepts

**Cycle**:
One complete removal pass: standby → lifting → flipping → lowering → standby. A faulted run is an *aborted cycle*, not a cycle. The `cycle_complete` event fires only on full success.
_Avoid_: Removal, pass, sequence

**State**:
The actuator's operational mode. Values: `STANDBY`, `LIFTING`, `FLIPPING`, `LOWERING`, `ALERT_FLOOD`, `FAULT`.
_Aavoid_: Mode, phase

**Status**:
The MQTT topic category for reporting device conditions (`status/actuator`, `status/connectivity`). Status is the container; State is the value inside it.
_Avoid_: Condition, health

### Control Concepts

**Manual Mode**:
An operator-controlled toggle. When active, automatic blockage-triggered cycles are suppressed. Alerts are still logged but not acted on. Operator clicks to enter Manual Mode, clicks again to return to Auto.
_Avoid_: Override, manual control, operator mode

### Fault Concepts

**Critical Fault**:
A hardware-risk fault that halts all operation and requires manual reset. Examples: `ACTUATOR_OVERCURRENT`, `LIMIT_SWITCH_TIMEOUT`.
_Aavoid_: Hard fault, fatal error

**Transient Fault**:
A sensor or data fault that auto-retries on the next attempt without changing state. Examples: `CAMERA_UNAVAILABLE`, `SENSOR_OUT_OF_RANGE`.
_Avoid_: Soft fault, warning, temporary error

### Alert Types

**Blockage**:
Alert type indicating debris accumulation in the channel. Triggers an automatic removal cycle. This is the actionable trigger.
_Avoid_: Clog, obstruction, jam

**Flood**:
Alert type indicating dangerous water level. An informational escalation — may trigger SMS fallback if MQTT is unavailable. Independent of blockage.
_Avoid_: Overflow, high water, flood alert

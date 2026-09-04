# Rename Override to Manual Mode

The MQTT topic `control/override` and event `manual_override_triggered` imply bypassing something. The actual semantics are an operator taking direct control of the system — a mode toggle, not an override. "Manual Mode" accurately describes entering a state where the operator is in charge and automatic triggers are suppressed. The rename makes the domain model self-documenting and avoids the false implication that something is being overridden.

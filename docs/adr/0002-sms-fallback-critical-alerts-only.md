# SMS Fallback for Critical Alerts Only

The ESP32 has a SIM800L GSM module for SMS fallback when MQTT is unavailable. Not every event deserves an SMS — transient sensor warnings and routine status updates would create noise and burn through pay-per-message SIM credits. SMS triggers only for critical alerts (flood, critical fault) when MQTT is unreachable. This trades coverage for signal-to-noise: operators get notified for the events that actually require human intervention, and SMS costs stay predictable.

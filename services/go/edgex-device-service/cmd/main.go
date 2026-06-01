// EdgeX Foundry Device Service — Oil & Gas Field Sensors
// Spec: FRQ-001 — EdgeX device service for Modbus/OPC-UA/DNP3 sensor integration
//
// This service implements the EdgeX Device Service SDK to bridge field sensors
// (pressure, temperature, flow rate, ESP) into the EdgeX core services.
// It supports Modbus TCP, OPC-UA, and DNP3 protocols via the driver layer.

package main

import (
	"fmt"
	"os"

	"github.com/edgexfoundry/device-sdk-go/v3/pkg/startup"
	"og-rmm-platform/services/go/edgex-device-service/internal/driver"
)

const (
	serviceName    = "og-rmm-field-sensors"
	serviceVersion = "3.1.0"
)

func main() {
	d := driver.NewOGFieldSensorDriver()
	if err := startup.Bootstrap(serviceName, serviceVersion, d); err != nil {
		fmt.Fprintf(os.Stderr, "EdgeX device service failed to start: %v\n", err)
		os.Exit(1)
	}
}

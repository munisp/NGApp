// Package driver implements the EdgeX Device Service SDK driver interface
// for Oil & Gas field sensors (Modbus TCP, OPC-UA, DNP3).
package driver

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"strconv"
	"time"

	"github.com/edgexfoundry/device-sdk-go/v3/pkg/interfaces"
	"github.com/edgexfoundry/device-sdk-go/v3/pkg/models"
	"github.com/edgexfoundry/go-mod-core-contracts/v3/clients/logger"
	"github.com/edgexfoundry/go-mod-core-contracts/v3/common"
)

// ProtocolType represents the field bus protocol for a device.
type ProtocolType string

const (
	ProtocolModbusTCP ProtocolType = "MODBUS_TCP"
	ProtocolOPCUA     ProtocolType = "OPC_UA"
	ProtocolDNP3      ProtocolType = "DNP3"
)

// OGFieldSensorDriver implements the EdgeX ProtocolDriver interface.
type OGFieldSensorDriver struct {
	sdk     interfaces.DeviceServiceSDK
	lc      logger.LoggingClient
	asyncCh chan<- *models.AsyncValues
}

// NewOGFieldSensorDriver creates a new driver instance.
func NewOGFieldSensorDriver() *OGFieldSensorDriver {
	return &OGFieldSensorDriver{}
}

// Initialize is called by the EdgeX SDK on service startup.
func (d *OGFieldSensorDriver) Initialize(sdk interfaces.DeviceServiceSDK) error {
	d.sdk = sdk
	d.lc = sdk.LoggingClient()
	d.asyncCh = sdk.AsyncValuesChannel()

	d.lc.Info("[OG-EdgeX] Field sensor driver initialized")
	d.lc.Infof("[OG-EdgeX] Supported protocols: %s, %s, %s",
		ProtocolModbusTCP, ProtocolOPCUA, ProtocolDNP3)

	// Start background polling for async devices
	go d.startAsyncPolling(context.Background())

	return nil
}

// HandleReadCommands processes read requests from EdgeX core-command.
func (d *OGFieldSensorDriver) HandleReadCommands(
	deviceName string,
	protocols map[string]models.ProtocolProperties,
	reqs []models.CommandRequest,
) ([]*models.CommandValue, error) {
	d.lc.Debugf("[OG-EdgeX] HandleReadCommands: device=%s, reqs=%d", deviceName, len(reqs))

	protocol := d.detectProtocol(protocols)
	results := make([]*models.CommandValue, 0, len(reqs))

	for _, req := range reqs {
		val, err := d.readSensorValue(deviceName, protocol, req)
		if err != nil {
			d.lc.Errorf("[OG-EdgeX] Read failed: device=%s resource=%s err=%v",
				deviceName, req.DeviceResourceName, err)
			return nil, err
		}
		results = append(results, val)
	}

	return results, nil
}

// HandleWriteCommands processes write requests (e.g., setpoint changes, valve commands).
func (d *OGFieldSensorDriver) HandleWriteCommands(
	deviceName string,
	protocols map[string]models.ProtocolProperties,
	reqs []models.CommandRequest,
	params []*models.CommandValue,
) error {
	d.lc.Infof("[OG-EdgeX] HandleWriteCommands: device=%s, cmds=%d", deviceName, len(reqs))

	protocol := d.detectProtocol(protocols)

	for i, req := range reqs {
		if i >= len(params) {
			break
		}
		if err := d.writeSensorValue(deviceName, protocol, req, params[i]); err != nil {
			d.lc.Errorf("[OG-EdgeX] Write failed: device=%s resource=%s err=%v",
				deviceName, req.DeviceResourceName, err)
			return err
		}
	}

	return nil
}

// Stop is called by the EdgeX SDK on service shutdown.
func (d *OGFieldSensorDriver) Stop(force bool) error {
	d.lc.Info("[OG-EdgeX] Field sensor driver stopping")
	return nil
}

// AddDevice is called when a new device is added to EdgeX.
func (d *OGFieldSensorDriver) AddDevice(deviceName string, protocols map[string]models.ProtocolProperties, adminState models.AdminState) error {
	d.lc.Infof("[OG-EdgeX] Device added: %s (protocol=%s)", deviceName, d.detectProtocol(protocols))
	return nil
}

// UpdateDevice is called when a device is updated in EdgeX.
func (d *OGFieldSensorDriver) UpdateDevice(deviceName string, protocols map[string]models.ProtocolProperties, adminState models.AdminState) error {
	d.lc.Infof("[OG-EdgeX] Device updated: %s", deviceName)
	return nil
}

// RemoveDevice is called when a device is removed from EdgeX.
func (d *OGFieldSensorDriver) RemoveDevice(deviceName string, protocols map[string]models.ProtocolProperties) error {
	d.lc.Infof("[OG-EdgeX] Device removed: %s", deviceName)
	return nil
}

// Discover implements device auto-discovery (optional).
func (d *OGFieldSensorDriver) Discover() error {
	d.lc.Info("[OG-EdgeX] Device discovery started (Modbus TCP broadcast)")
	// In production: broadcast Modbus TCP discovery on the field network
	// and register discovered devices with EdgeX core-metadata
	return nil
}

// ValidateDevice validates device protocol properties.
func (d *OGFieldSensorDriver) ValidateDevice(device models.Device) error {
	protocol := d.detectProtocol(device.Protocols)
	if protocol == "" {
		return fmt.Errorf("device %s has no supported protocol (expected modbus_tcp, opc_ua, or dnp3)", device.Name)
	}
	return nil
}

// ─── Private helpers ──────────────────────────────────────────────────────────

func (d *OGFieldSensorDriver) detectProtocol(protocols map[string]models.ProtocolProperties) ProtocolType {
	if _, ok := protocols["modbus_tcp"]; ok {
		return ProtocolModbusTCP
	}
	if _, ok := protocols["opc_ua"]; ok {
		return ProtocolOPCUA
	}
	if _, ok := protocols["dnp3"]; ok {
		return ProtocolDNP3
	}
	return ""
}

func (d *OGFieldSensorDriver) readSensorValue(
	deviceName string,
	protocol ProtocolType,
	req models.CommandRequest,
) (*models.CommandValue, error) {
	// In production: route to the appropriate protocol handler
	// (Modbus TCP register read, OPC-UA node read, DNP3 analog input read)
	// For now: return simulated values based on resource name
	var value interface{}

	switch req.DeviceResourceName {
	case "Pressure":
		value = 2800.0 + rand.Float64()*400 // 2800-3200 psi
	case "Temperature":
		value = 65.0 + rand.Float64()*20 // 65-85°C
	case "FlowRate":
		value = 800.0 + rand.Float64()*200 // 800-1000 bbl/d
	case "WaterCut":
		value = 15.0 + rand.Float64()*10 // 15-25%
	case "GasOilRatio":
		value = 500.0 + rand.Float64()*100 // 500-600 scf/bbl
	case "ESPFrequency":
		value = 58.5 + rand.Float64()*3 // 58.5-61.5 Hz
	case "ESPCurrent":
		value = 42.0 + rand.Float64()*8 // 42-50 A
	case "ValvePosition":
		value = int32(75) // 75% open
	default:
		value = 0.0
	}

	cv, err := models.NewCommandValue(req.DeviceResourceName, common.ValueTypeFloat64, value)
	if err != nil {
		// Try int32 for valve position
		cv, err = models.NewCommandValue(req.DeviceResourceName, common.ValueTypeInt32, value)
		if err != nil {
			return nil, fmt.Errorf("failed to create command value for %s: %w", req.DeviceResourceName, err)
		}
	}

	return cv, nil
}

func (d *OGFieldSensorDriver) writeSensorValue(
	deviceName string,
	protocol ProtocolType,
	req models.CommandRequest,
	param *models.CommandValue,
) error {
	val, err := param.Float64Value()
	if err != nil {
		intVal, err2 := param.Int32Value()
		if err2 != nil {
			return fmt.Errorf("invalid value for %s: %w", req.DeviceResourceName, err)
		}
		val = float64(intVal)
	}

	d.lc.Infof("[OG-EdgeX] Write: device=%s resource=%s value=%.2f protocol=%s",
		deviceName, req.DeviceResourceName, val, protocol)

	// In production: route to protocol handler for actual register write
	return nil
}

// startAsyncPolling runs background polling for devices that push data asynchronously.
func (d *OGFieldSensorDriver) startAsyncPolling(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.publishAsyncReadings()
		}
	}
}

func (d *OGFieldSensorDriver) publishAsyncReadings() {
	// In production: poll Modbus TCP devices that don't support unsolicited reporting
	// For demo: publish simulated readings for registered devices
	devices := d.sdk.Devices()
	for _, device := range devices {
		if device.AdminState == models.Locked {
			continue
		}

		readings := map[string]interface{}{
			"Pressure":    2800.0 + rand.Float64()*400,
			"Temperature": 65.0 + rand.Float64()*20,
			"FlowRate":    800.0 + rand.Float64()*200,
		}

		cvs := make([]*models.CommandValue, 0, len(readings))
		for resource, val := range readings {
			cv, err := models.NewCommandValue(resource, common.ValueTypeFloat64, val)
			if err != nil {
				continue
			}
			cvs = append(cvs, cv)
		}

		if len(cvs) > 0 {
			asyncValues := &models.AsyncValues{
				DeviceName:    device.Name,
				CommandValues: cvs,
			}
			select {
			case d.asyncCh <- asyncValues:
			default:
				d.lc.Warnf("[OG-EdgeX] Async channel full, dropping readings for %s", device.Name)
			}
		}
	}
}

// DeviceProfile returns the device profile configuration for OG field sensors.
func DeviceProfile() map[string]interface{} {
	return map[string]interface{}{
		"name":         "og-field-sensor-profile",
		"manufacturer": "OG-RMM Platform",
		"model":        "OG-SENSOR-V3",
		"labels":       []string{"oil-gas", "field-sensor", "modbus", "opc-ua"},
		"deviceResources": []map[string]interface{}{
			{
				"name":        "Pressure",
				"description": "Wellhead pressure in psi",
				"properties": map[string]interface{}{
					"valueType": "Float64",
					"readWrite": "R",
					"units":     "psi",
					"minimum":   "0",
					"maximum":   "10000",
				},
			},
			{
				"name":        "Temperature",
				"description": "Wellhead temperature in degrees Celsius",
				"properties": map[string]interface{}{
					"valueType": "Float64",
					"readWrite": "R",
					"units":     "degC",
					"minimum":   "-40",
					"maximum":   "300",
				},
			},
			{
				"name":        "FlowRate",
				"description": "Oil flow rate in barrels per day",
				"properties": map[string]interface{}{
					"valueType": "Float64",
					"readWrite": "R",
					"units":     "bbl/d",
					"minimum":   "0",
					"maximum":   "5000",
				},
			},
			{
				"name":        "ValvePosition",
				"description": "Choke valve position (0-100%)",
				"properties": map[string]interface{}{
					"valueType": "Int32",
					"readWrite": "RW",
					"units":     "%",
					"minimum":   "0",
					"maximum":   "100",
				},
			},
		},
	}
}

// ProfileJSON returns the device profile as JSON bytes.
func ProfileJSON() ([]byte, error) {
	return json.Marshal(DeviceProfile())
}

// ParseModbusAddress parses a Modbus register address from protocol properties.
func ParseModbusAddress(props models.ProtocolProperties) (host string, port int, unitID int, err error) {
	host, _ = props["host"].(string)
	portStr, _ := props["port"].(string)
	unitStr, _ := props["unitID"].(string)

	if host == "" {
		return "", 0, 0, fmt.Errorf("missing modbus_tcp host")
	}

	port, err = strconv.Atoi(portStr)
	if err != nil {
		port = 502 // default Modbus TCP port
	}

	unitID, err = strconv.Atoi(unitStr)
	if err != nil {
		unitID = 1 // default unit ID
	}

	return host, port, unitID, nil
}

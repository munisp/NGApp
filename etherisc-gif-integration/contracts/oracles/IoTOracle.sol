// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title IoTOracle
 * @dev Oracle for IoT sensor data (soil moisture, temperature, GPS, etc.)
 * 
 * Use Cases:
 * - Agriculture: Soil moisture, pH, NPK levels
 * - Livestock: Animal health monitoring, location tracking
 * - Transportation: Vehicle telematics, GPS tracking
 * - Weather stations: Local weather data
 */
contract IoTOracle is 
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant ORACLE_OPERATOR_ROLE = keccak256("ORACLE_OPERATOR_ROLE");
    bytes32 public constant DEVICE_ROLE = keccak256("DEVICE_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    enum SensorType { SOIL_MOISTURE, TEMPERATURE, HUMIDITY, PH, NPK, GPS, ACCELEROMETER, RAIN_GAUGE }

    struct IoTDevice {
        string deviceId;              // Unique device identifier
        address owner;                // Device owner address
        SensorType sensorType;
        string location;              // GPS coordinates or location name
        bool active;                  // Whether device is active
        uint256 registeredAt;
        uint256 lastDataSubmission;
    }

    struct SensorData {
        bytes32 dataId;
        string deviceId;
        SensorType sensorType;
        uint256 value;                // Sensor reading (scaled appropriately)
        string unit;                  // Unit of measurement
        uint256 latitude;             // GPS latitude * 1e6
        uint256 longitude;            // GPS longitude * 1e6
        uint256 timestamp;            // Data timestamp
        address submittedBy;          // Who submitted the data
        bool verified;                // Whether data has been verified
        address verifiedBy;           // Verifier address
        uint256 verifiedAt;           // Verification timestamp
    }

    // Mappings
    mapping(string => IoTDevice) public devices;
    mapping(bytes32 => SensorData) public sensorData;
    mapping(string => bytes32[]) public deviceHistory;
    mapping(address => string[]) public ownerDevices;
    mapping(uint256 => bytes32[]) public dailyData;

    // Events
    event DeviceRegistered(
        string indexed deviceId,
        address indexed owner,
        SensorType sensorType,
        string location
    );

    event SensorDataSubmitted(
        bytes32 indexed dataId,
        string indexed deviceId,
        SensorType sensorType,
        uint256 value,
        uint256 timestamp
    );

    event SensorDataVerified(
        bytes32 indexed dataId,
        address indexed verifier,
        uint256 timestamp
    );

    event DeviceDeactivated(
        string indexed deviceId,
        address indexed owner
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_OPERATOR_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    /**
     * @dev Register a new IoT device
     */
    function registerDevice(
        string memory _deviceId,
        address _owner,
        SensorType _sensorType,
        string memory _location
    ) external onlyRole(ORACLE_OPERATOR_ROLE) {
        require(devices[_deviceId].registeredAt == 0, "Device already registered");

        devices[_deviceId] = IoTDevice({
            deviceId: _deviceId,
            owner: _owner,
            sensorType: _sensorType,
            location: _location,
            active: true,
            registeredAt: block.timestamp,
            lastDataSubmission: 0
        });

        ownerDevices[_owner].push(_deviceId);

        // Grant DEVICE_ROLE to the device owner
        _grantRole(DEVICE_ROLE, _owner);

        emit DeviceRegistered(_deviceId, _owner, _sensorType, _location);
    }

    /**
     * @dev Submit sensor data from IoT device
     */
    function submitSensorData(
        string memory _deviceId,
        uint256 _value,
        string memory _unit,
        uint256 _latitude,
        uint256 _longitude,
        uint256 _timestamp
    ) external onlyRole(DEVICE_ROLE) returns (bytes32) {
        IoTDevice storage device = devices[_deviceId];
        require(device.active, "Device not active");
        require(device.owner == msg.sender, "Not device owner");
        require(_timestamp <= block.timestamp, "Future timestamp not allowed");
        require(_value > 0, "Invalid sensor value");

        // Generate data ID
        bytes32 dataId = keccak256(
            abi.encodePacked(
                _deviceId,
                _timestamp,
                msg.sender,
                block.timestamp
            )
        );

        // Store sensor data
        sensorData[dataId] = SensorData({
            dataId: dataId,
            deviceId: _deviceId,
            sensorType: device.sensorType,
            value: _value,
            unit: _unit,
            latitude: _latitude,
            longitude: _longitude,
            timestamp: _timestamp,
            submittedBy: msg.sender,
            verified: false,
            verifiedBy: address(0),
            verifiedAt: 0
        });

        // Update device
        device.lastDataSubmission = block.timestamp;

        // Add to device history
        deviceHistory[_deviceId].push(dataId);

        // Add to daily data
        uint256 dayTimestamp = (_timestamp / 1 days) * 1 days;
        dailyData[dayTimestamp].push(dataId);

        emit SensorDataSubmitted(
            dataId,
            _deviceId,
            device.sensorType,
            _value,
            _timestamp
        );

        return dataId;
    }

    /**
     * @dev Verify sensor data
     */
    function verifySensorData(bytes32 _dataId) external onlyRole(VERIFIER_ROLE) {
        SensorData storage data = sensorData[_dataId];
        require(!data.verified, "Data already verified");
        require(data.timestamp > 0, "Data does not exist");

        data.verified = true;
        data.verifiedBy = msg.sender;
        data.verifiedAt = block.timestamp;

        emit SensorDataVerified(_dataId, msg.sender, block.timestamp);
    }

    /**
     * @dev Deactivate a device
     */
    function deactivateDevice(string memory _deviceId) external {
        IoTDevice storage device = devices[_deviceId];
        require(device.owner == msg.sender || hasRole(ORACLE_OPERATOR_ROLE, msg.sender), "Not authorized");
        require(device.active, "Device already inactive");

        device.active = false;

        emit DeviceDeactivated(_deviceId, device.owner);
    }

    /**
     * @dev Get device details
     */
    function getDevice(string memory _deviceId) external view returns (IoTDevice memory) {
        return devices[_deviceId];
    }

    /**
     * @dev Get sensor data by ID
     */
    function getSensorData(bytes32 _dataId) external view returns (SensorData memory) {
        return sensorData[_dataId];
    }

    /**
     * @dev Get device history
     */
    function getDeviceHistory(string memory _deviceId) external view returns (bytes32[] memory) {
        return deviceHistory[_deviceId];
    }

    /**
     * @dev Get owner devices
     */
    function getOwnerDevices(address _owner) external view returns (string[] memory) {
        return ownerDevices[_owner];
    }

    /**
     * @dev Get daily data for a specific day
     */
    function getDailyData(uint256 _dayTimestamp) external view returns (bytes32[] memory) {
        return dailyData[_dayTimestamp];
    }

    /**
     * @dev Get average sensor value for device over period
     */
    function getAverageSensorValue(
        string memory _deviceId,
        uint256 _startTimestamp,
        uint256 _endTimestamp
    ) external view returns (uint256) {
        bytes32[] memory history = deviceHistory[_deviceId];
        uint256 sum = 0;
        uint256 count = 0;

        for (uint256 i = 0; i < history.length; i++) {
            SensorData memory data = sensorData[history[i]];
            if (data.timestamp >= _startTimestamp && data.timestamp <= _endTimestamp && data.verified) {
                sum += data.value;
                count++;
            }
        }

        return count > 0 ? sum / count : 0;
    }

    /**
     * @dev Get minimum sensor value for device over period
     */
    function getMinSensorValue(
        string memory _deviceId,
        uint256 _startTimestamp,
        uint256 _endTimestamp
    ) external view returns (uint256) {
        bytes32[] memory history = deviceHistory[_deviceId];
        uint256 min = type(uint256).max;

        for (uint256 i = 0; i < history.length; i++) {
            SensorData memory data = sensorData[history[i]];
            if (data.timestamp >= _startTimestamp && data.timestamp <= _endTimestamp && data.verified) {
                if (data.value < min) {
                    min = data.value;
                }
            }
        }

        return min == type(uint256).max ? 0 : min;
    }

    /**
     * @dev Get maximum sensor value for device over period
     */
    function getMaxSensorValue(
        string memory _deviceId,
        uint256 _startTimestamp,
        uint256 _endTimestamp
    ) external view returns (uint256) {
        bytes32[] memory history = deviceHistory[_deviceId];
        uint256 max = 0;

        for (uint256 i = 0; i < history.length; i++) {
            SensorData memory data = sensorData[history[i]];
            if (data.timestamp >= _startTimestamp && data.timestamp <= _endTimestamp && data.verified) {
                if (data.value > max) {
                    max = data.value;
                }
            }
        }

        return max;
    }

    /**
     * @dev Authorize upgrade
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}

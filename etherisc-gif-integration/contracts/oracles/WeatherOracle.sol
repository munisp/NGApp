// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title WeatherOracle
 * @dev Oracle for weather data (temperature, rainfall, wind speed, humidity)
 * 
 * Data Sources:
 * - NiMet (Nigerian Meteorological Agency)
 * - OpenWeatherMap
 * - Weather stations
 * - IoT sensors
 */
contract WeatherOracle is 
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant ORACLE_OPERATOR_ROLE = keccak256("ORACLE_OPERATOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    struct WeatherData {
        string location;              // GPS coordinates or location name
        uint256 temperature;          // Temperature in Celsius * 100 (e.g., 2550 = 25.50°C)
        uint256 rainfall;             // Rainfall in millimeters
        uint256 windSpeed;            // Wind speed in km/h
        uint256 humidity;             // Humidity percentage (0-100)
        uint256 pressure;             // Atmospheric pressure in hPa
        string condition;             // Weather condition (sunny, rainy, cloudy, etc.)
        uint256 timestamp;            // Data timestamp
        address submittedBy;          // Oracle operator who submitted data
        bool verified;                // Whether data has been verified
        address verifiedBy;           // Verifier address
        uint256 verifiedAt;           // Verification timestamp
    }

    // Mappings
    mapping(bytes32 => WeatherData) public weatherData;
    mapping(string => bytes32[]) public locationHistory;
    mapping(uint256 => bytes32[]) public dailyData;

    // Events
    event WeatherDataSubmitted(
        bytes32 indexed dataId,
        string location,
        uint256 temperature,
        uint256 rainfall,
        uint256 windSpeed,
        uint256 timestamp
    );

    event WeatherDataVerified(
        bytes32 indexed dataId,
        address indexed verifier,
        uint256 timestamp
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
     * @dev Submit weather data
     */
    function submitWeatherData(
        string memory _location,
        uint256 _temperature,
        uint256 _rainfall,
        uint256 _windSpeed,
        uint256 _humidity,
        uint256 _pressure,
        string memory _condition,
        uint256 _timestamp
    ) external onlyRole(ORACLE_OPERATOR_ROLE) returns (bytes32) {
        require(_timestamp <= block.timestamp, "Future timestamp not allowed");
        require(_temperature > 0 && _temperature < 6000, "Invalid temperature"); // -10°C to 50°C
        require(_rainfall < 1000, "Invalid rainfall"); // Max 1000mm
        require(_windSpeed < 300, "Invalid wind speed"); // Max 300 km/h
        require(_humidity <= 100, "Invalid humidity");
        require(_pressure > 800 && _pressure < 1200, "Invalid pressure"); // 800-1200 hPa

        // Generate data ID
        bytes32 dataId = keccak256(
            abi.encodePacked(
                _location,
                _timestamp,
                msg.sender,
                block.timestamp
            )
        );

        // Store weather data
        weatherData[dataId] = WeatherData({
            location: _location,
            temperature: _temperature,
            rainfall: _rainfall,
            windSpeed: _windSpeed,
            humidity: _humidity,
            pressure: _pressure,
            condition: _condition,
            timestamp: _timestamp,
            submittedBy: msg.sender,
            verified: false,
            verifiedBy: address(0),
            verifiedAt: 0
        });

        // Add to location history
        locationHistory[_location].push(dataId);

        // Add to daily data
        uint256 dayTimestamp = (_timestamp / 1 days) * 1 days;
        dailyData[dayTimestamp].push(dataId);

        emit WeatherDataSubmitted(
            dataId,
            _location,
            _temperature,
            _rainfall,
            _windSpeed,
            _timestamp
        );

        return dataId;
    }

    /**
     * @dev Verify weather data
     */
    function verifyWeatherData(bytes32 _dataId) external onlyRole(VERIFIER_ROLE) {
        WeatherData storage data = weatherData[_dataId];
        require(!data.verified, "Data already verified");
        require(data.timestamp > 0, "Data does not exist");

        data.verified = true;
        data.verifiedBy = msg.sender;
        data.verifiedAt = block.timestamp;

        emit WeatherDataVerified(_dataId, msg.sender, block.timestamp);
    }

    /**
     * @dev Get weather data by ID
     */
    function getWeatherData(bytes32 _dataId) external view returns (WeatherData memory) {
        return weatherData[_dataId];
    }

    /**
     * @dev Get location history
     */
    function getLocationHistory(string memory _location) external view returns (bytes32[] memory) {
        return locationHistory[_location];
    }

    /**
     * @dev Get daily data for a specific day
     */
    function getDailyData(uint256 _dayTimestamp) external view returns (bytes32[] memory) {
        return dailyData[_dayTimestamp];
    }

    /**
     * @dev Get average temperature for location over period
     */
    function getAverageTemperature(
        string memory _location,
        uint256 _startTimestamp,
        uint256 _endTimestamp
    ) external view returns (uint256) {
        bytes32[] memory history = locationHistory[_location];
        uint256 sum = 0;
        uint256 count = 0;

        for (uint256 i = 0; i < history.length; i++) {
            WeatherData memory data = weatherData[history[i]];
            if (data.timestamp >= _startTimestamp && data.timestamp <= _endTimestamp && data.verified) {
                sum += data.temperature;
                count++;
            }
        }

        return count > 0 ? sum / count : 0;
    }

    /**
     * @dev Get total rainfall for location over period
     */
    function getTotalRainfall(
        string memory _location,
        uint256 _startTimestamp,
        uint256 _endTimestamp
    ) external view returns (uint256) {
        bytes32[] memory history = locationHistory[_location];
        uint256 total = 0;

        for (uint256 i = 0; i < history.length; i++) {
            WeatherData memory data = weatherData[history[i]];
            if (data.timestamp >= _startTimestamp && data.timestamp <= _endTimestamp && data.verified) {
                total += data.rainfall;
            }
        }

        return total;
    }

    /**
     * @dev Get maximum wind speed for location over period
     */
    function getMaxWindSpeed(
        string memory _location,
        uint256 _startTimestamp,
        uint256 _endTimestamp
    ) external view returns (uint256) {
        bytes32[] memory history = locationHistory[_location];
        uint256 max = 0;

        for (uint256 i = 0; i < history.length; i++) {
            WeatherData memory data = weatherData[history[i]];
            if (data.timestamp >= _startTimestamp && data.timestamp <= _endTimestamp && data.verified) {
                if (data.windSpeed > max) {
                    max = data.windSpeed;
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

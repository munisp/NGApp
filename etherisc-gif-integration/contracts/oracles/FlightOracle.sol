// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../interfaces/IOracle.sol";

/**
 * @title FlightOracle
 * @dev Oracle for flight delay data
 */
contract FlightOracle is 
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    IOracle 
{
    bytes32 public constant ORACLE_OPERATOR_ROLE = keccak256("ORACLE_OPERATOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    struct FlightData {
        OracleData baseData;
        string flightNumber;
        uint256 scheduledDepartureTime;
        uint256 actualDepartureTime;
        uint256 delayMinutes;
        string departureAirport;
        string arrivalAirport;
        string status; // "on-time", "delayed", "cancelled"
    }

    // Data storage
    mapping(bytes32 => FlightData) public flightData;
    mapping(string => bytes32[]) public flightNumberToDataIds;
    bytes32[] public allDataIds;

    // Statistics
    uint256 public totalDataSubmissions;
    uint256 public totalVerifiedData;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_OPERATOR_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    /**
     * @dev Submit flight data
     * @param data Encoded flight data
     * @return dataId Unique data identifier
     */
    function submitData(bytes calldata data) external override onlyRole(ORACLE_OPERATOR_ROLE) nonReentrant returns (bytes32 dataId) {
        // Decode flight data
        (
            string memory flightNumber,
            uint256 scheduledDepartureTime,
            uint256 actualDepartureTime,
            string memory departureAirport,
            string memory arrivalAirport,
            string memory status
        ) = abi.decode(data, (string, uint256, uint256, string, string, string));

        require(bytes(flightNumber).length > 0, "Invalid flight number");
        require(scheduledDepartureTime > 0, "Invalid scheduled departure time");
        require(actualDepartureTime > 0, "Invalid actual departure time");

        // Calculate delay in minutes
        uint256 delayMinutes = 0;
        if (actualDepartureTime > scheduledDepartureTime) {
            delayMinutes = (actualDepartureTime - scheduledDepartureTime) / 60;
        }

        // Generate data ID
        dataId = keccak256(
            abi.encodePacked(
                flightNumber,
                scheduledDepartureTime,
                actualDepartureTime,
                block.timestamp,
                totalDataSubmissions
            )
        );

        // Create oracle data
        OracleData memory baseData = OracleData({
            dataId: dataId,
            timestamp: block.timestamp,
            data: data,
            verified: false,
            submitter: msg.sender
        });

        FlightData memory flight = FlightData({
            baseData: baseData,
            flightNumber: flightNumber,
            scheduledDepartureTime: scheduledDepartureTime,
            actualDepartureTime: actualDepartureTime,
            delayMinutes: delayMinutes,
            departureAirport: departureAirport,
            arrivalAirport: arrivalAirport,
            status: status
        });

        flightData[dataId] = flight;
        flightNumberToDataIds[flightNumber].push(dataId);
        allDataIds.push(dataId);

        totalDataSubmissions++;

        emit DataSubmitted(dataId, block.timestamp, msg.sender);

        return dataId;
    }

    /**
     * @dev Verify submitted data
     * @param dataId Data identifier
     */
    function verifyData(bytes32 dataId) external override onlyRole(VERIFIER_ROLE) {
        FlightData storage flight = flightData[dataId];
        require(flight.baseData.dataId == dataId, "Data does not exist");
        require(!flight.baseData.verified, "Data already verified");

        flight.baseData.verified = true;
        totalVerifiedData++;

        emit DataVerified(dataId);
    }

    /**
     * @dev Get oracle data
     * @param dataId Data identifier
     * @return data OracleData struct
     */
    function getData(bytes32 dataId) external view override returns (OracleData memory data) {
        return flightData[dataId].baseData;
    }

    /**
     * @dev Get flight data
     * @param dataId Data identifier
     * @return flight FlightData struct
     */
    function getFlightData(bytes32 dataId) external view returns (FlightData memory flight) {
        return flightData[dataId];
    }

    /**
     * @dev Get flight data by flight number and scheduled departure time
     * @param flightNumber Flight number
     * @param scheduledDepartureTime Scheduled departure time
     * @return flight FlightData struct
     */
    function getFlightDataByFlight(
        string memory flightNumber,
        uint256 scheduledDepartureTime
    ) external view returns (FlightData memory flight) {
        bytes32[] memory dataIds = flightNumberToDataIds[flightNumber];
        
        for (uint256 i = 0; i < dataIds.length; i++) {
            FlightData memory fd = flightData[dataIds[i]];
            if (fd.scheduledDepartureTime == scheduledDepartureTime && fd.baseData.verified) {
                return fd;
            }
        }

        revert("Flight data not found");
    }

    /**
     * @dev Get latest data (most recent submission)
     * @return data OracleData struct
     */
    function getLatestData() external view override returns (OracleData memory data) {
        require(allDataIds.length > 0, "No data available");
        return flightData[allDataIds[allDataIds.length - 1]].baseData;
    }

    /**
     * @dev Check if data is verified
     * @param dataId Data identifier
     * @return verified True if data is verified
     */
    function isDataVerified(bytes32 dataId) external view override returns (bool verified) {
        return flightData[dataId].baseData.verified;
    }

    /**
     * @dev Get all data IDs for a flight number
     * @param flightNumber Flight number
     * @return dataIds Array of data IDs
     */
    function getFlightDataIds(string memory flightNumber) external view returns (bytes32[] memory dataIds) {
        return flightNumberToDataIds[flightNumber];
    }

    /**
     * @dev Get total number of data submissions
     * @return count Total data submissions
     */
    function getTotalDataSubmissions() external view returns (uint256 count) {
        return totalDataSubmissions;
    }

    /**
     * @dev Get total number of verified data
     * @return count Total verified data
     */
    function getTotalVerifiedData() external view returns (uint256 count) {
        return totalVerifiedData;
    }
}

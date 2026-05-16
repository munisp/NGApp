// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOracle
 * @dev Interface for oracle data providers
 */
interface IOracle {
    struct OracleData {
        bytes32 dataId;
        uint256 timestamp;
        bytes data;
        bool verified;
        address submitter;
    }

    event DataSubmitted(
        bytes32 indexed dataId,
        uint256 timestamp,
        address indexed submitter
    );

    event DataVerified(bytes32 indexed dataId);

    function submitData(bytes calldata data) external returns (bytes32 dataId);

    function verifyData(bytes32 dataId) external;

    function getData(bytes32 dataId) external view returns (OracleData memory);

    function getLatestData() external view returns (OracleData memory);

    function isDataVerified(bytes32 dataId) external view returns (bool);
}

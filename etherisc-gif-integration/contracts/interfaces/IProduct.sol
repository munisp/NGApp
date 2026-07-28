// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IProduct
 * @dev Interface for parametric insurance products
 */
interface IProduct {
    struct Policy {
        bytes32 policyId;
        address customer;
        uint256 premium;
        uint256 coverageAmount;
        uint256 startTime;
        uint256 endTime;
        bool active;
        bool claimed;
    }

    event PolicyCreated(
        bytes32 indexed policyId,
        address indexed customer,
        uint256 premium,
        uint256 coverageAmount,
        uint256 startTime,
        uint256 endTime
    );

    event PolicyActivated(bytes32 indexed policyId);
    
    event ClaimTriggered(
        bytes32 indexed policyId,
        address indexed customer,
        uint256 payoutAmount,
        string reason
    );

    event PayoutProcessed(
        bytes32 indexed policyId,
        address indexed customer,
        uint256 amount
    );

    function createPolicy(
        address customer,
        uint256 coverageAmount,
        uint256 duration,
        bytes calldata policyData
    ) external payable returns (bytes32 policyId);

    function activatePolicy(bytes32 policyId) external;

    function triggerClaim(bytes32 policyId, bytes calldata claimData) external;

    function getPolicy(bytes32 policyId) external view returns (Policy memory);

    function isPolicyActive(bytes32 policyId) external view returns (bool);
}

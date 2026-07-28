// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRiskPool
 * @dev Interface for risk pool management
 */
interface IRiskPool {
    struct PoolInfo {
        uint256 totalCapital;
        uint256 availableCapital;
        uint256 lockedCapital;
        uint256 totalPremiums;
        uint256 totalPayouts;
        uint256 minCapital;
        bool active;
    }

    event CapitalDeposited(address indexed investor, uint256 amount);
    
    event CapitalWithdrawn(address indexed investor, uint256 amount);
    
    event PremiumCollected(bytes32 indexed policyId, uint256 amount);
    
    event PayoutProcessed(bytes32 indexed policyId, uint256 amount);

    function depositCapital() external payable;

    function withdrawCapital(uint256 amount) external;

    function collectPremium(bytes32 policyId, uint256 amount) external;

    function processPayout(bytes32 policyId, address customer, uint256 amount) external;

    function getPoolInfo() external view returns (PoolInfo memory);

    function getInvestorBalance(address investor) external view returns (uint256);
}

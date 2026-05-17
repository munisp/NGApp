// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../interfaces/IRiskPool.sol";

/**
 * @title RiskPool
 * @dev Risk pool for parametric insurance products
 */
contract RiskPool is 
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    IRiskPool 
{
    bytes32 public constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE");
    bytes32 public constant PRODUCT_ROLE = keccak256("PRODUCT_ROLE");

    // Pool information
    PoolInfo public poolInfo;

    // Investor balances
    mapping(address => uint256) public investorBalances;
    mapping(address => uint256) public investorShares;
    address[] public investors;

    // Total shares
    uint256 public totalShares;

    // Minimum investment
    uint256 public minInvestment;

    // Lock period for withdrawals (in seconds)
    uint256 public lockPeriod;
    mapping(address => uint256) public investmentTimestamp;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 _minCapital, uint256 _minInvestment, uint256 _lockPeriod) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(POOL_MANAGER_ROLE, msg.sender);

        poolInfo = PoolInfo({
            totalCapital: 0,
            availableCapital: 0,
            lockedCapital: 0,
            totalPremiums: 0,
            totalPayouts: 0,
            minCapital: _minCapital,
            active: true
        });

        minInvestment = _minInvestment;
        lockPeriod = _lockPeriod;
    }

    /**
     * @dev Deposit capital into the risk pool
     */
    function depositCapital() external payable override nonReentrant whenNotPaused {
        require(msg.value >= minInvestment, "Investment below minimum");

        // Calculate shares
        uint256 shares;
        if (totalShares == 0) {
            shares = msg.value;
        } else {
            shares = (msg.value * totalShares) / poolInfo.totalCapital;
        }

        // Update investor balance
        if (investorBalances[msg.sender] == 0) {
            investors.push(msg.sender);
        }
        investorBalances[msg.sender] += msg.value;
        investorShares[msg.sender] += shares;
        investmentTimestamp[msg.sender] = block.timestamp;

        // Update pool info
        poolInfo.totalCapital += msg.value;
        poolInfo.availableCapital += msg.value;
        totalShares += shares;

        emit CapitalDeposited(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw capital from the risk pool
     * @param amount Amount to withdraw
     */
    function withdrawCapital(uint256 amount) external override nonReentrant {
        require(investorBalances[msg.sender] >= amount, "Insufficient balance");
        require(
            block.timestamp >= investmentTimestamp[msg.sender] + lockPeriod,
            "Capital still locked"
        );
        require(poolInfo.availableCapital >= amount, "Insufficient available capital");

        // Calculate shares to burn
        uint256 sharesToBurn = (amount * investorShares[msg.sender]) / investorBalances[msg.sender];

        // Update investor balance
        investorBalances[msg.sender] -= amount;
        investorShares[msg.sender] -= sharesToBurn;

        // Update pool info
        poolInfo.totalCapital -= amount;
        poolInfo.availableCapital -= amount;
        totalShares -= sharesToBurn;

        // Transfer funds
        payable(msg.sender).transfer(amount);

        emit CapitalWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Collect premium from a policy
     * @param policyId Policy identifier
     * @param amount Premium amount
     */
    function collectPremium(
        bytes32 policyId,
        uint256 amount
    ) external payable override onlyRole(PRODUCT_ROLE) nonReentrant {
        require(msg.value == amount, "Incorrect premium amount");

        // Update pool info
        poolInfo.totalCapital += amount;
        poolInfo.availableCapital += amount;
        poolInfo.totalPremiums += amount;

        emit PremiumCollected(policyId, amount);
    }

    /**
     * @dev Process payout for a claim
     * @param policyId Policy identifier
     * @param customer Customer address
     * @param amount Payout amount
     */
    function processPayout(
        bytes32 policyId,
        address customer,
        uint256 amount
    ) external override onlyRole(PRODUCT_ROLE) nonReentrant {
        require(poolInfo.availableCapital >= amount, "Insufficient available capital");
        require(customer != address(0), "Invalid customer address");

        // Update pool info
        poolInfo.availableCapital -= amount;
        poolInfo.totalPayouts += amount;

        // Transfer payout to customer
        payable(customer).transfer(amount);

        emit PayoutProcessed(policyId, amount);
    }

    /**
     * @dev Lock capital for a policy
     * @param amount Amount to lock
     */
    function lockCapital(uint256 amount) external onlyRole(PRODUCT_ROLE) {
        require(poolInfo.availableCapital >= amount, "Insufficient available capital");

        poolInfo.availableCapital -= amount;
        poolInfo.lockedCapital += amount;
    }

    /**
     * @dev Unlock capital from a policy
     * @param amount Amount to unlock
     */
    function unlockCapital(uint256 amount) external onlyRole(PRODUCT_ROLE) {
        require(poolInfo.lockedCapital >= amount, "Insufficient locked capital");

        poolInfo.lockedCapital -= amount;
        poolInfo.availableCapital += amount;
    }

    /**
     * @dev Get pool information
     * @return info PoolInfo struct
     */
    function getPoolInfo() external view override returns (PoolInfo memory info) {
        return poolInfo;
    }

    /**
     * @dev Get investor balance
     * @param investor Investor address
     * @return balance Investor balance
     */
    function getInvestorBalance(address investor) external view override returns (uint256 balance) {
        return investorBalances[investor];
    }

    /**
     * @dev Get investor shares
     * @param investor Investor address
     * @return shares Investor shares
     */
    function getInvestorShares(address investor) external view returns (uint256 shares) {
        return investorShares[investor];
    }

    /**
     * @dev Get total number of investors
     * @return count Total investors
     */
    function getTotalInvestors() external view returns (uint256 count) {
        return investors.length;
    }

    /**
     * @dev Get all investors
     * @return investorList Array of investor addresses
     */
    function getInvestors() external view returns (address[] memory investorList) {
        return investors;
    }

    /**
     * @dev Calculate investor's share of pool
     * @param investor Investor address
     * @return sharePercentage Share percentage in basis points (10000 = 100%)
     */
    function getInvestorSharePercentage(address investor) external view returns (uint256 sharePercentage) {
        if (totalShares == 0) {
            return 0;
        }
        return (investorShares[investor] * 10000) / totalShares;
    }

    /**
     * @dev Update minimum investment
     * @param _minInvestment New minimum investment
     */
    function updateMinInvestment(uint256 _minInvestment) external onlyRole(POOL_MANAGER_ROLE) {
        minInvestment = _minInvestment;
    }

    /**
     * @dev Update lock period
     * @param _lockPeriod New lock period
     */
    function updateLockPeriod(uint256 _lockPeriod) external onlyRole(POOL_MANAGER_ROLE) {
        lockPeriod = _lockPeriod;
    }

    /**
     * @dev Pause contract
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {
        poolInfo.totalCapital += msg.value;
        poolInfo.availableCapital += msg.value;
    }
}

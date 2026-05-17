// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../interfaces/IProduct.sol";
import "../interfaces/IOracle.sol";
import "../interfaces/IRiskPool.sol";

/**
 * @title FlightDelayProduct
 * @dev Parametric flight delay insurance product
 */
contract FlightDelayProduct is 
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    IProduct 
{
    bytes32 public constant UNDERWRITER_ROLE = keccak256("UNDERWRITER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    struct FlightPolicy {
        Policy basePolicy;
        string flightNumber;
        uint256 departureTime;
        uint256 delayThreshold; // in minutes
        string departureAirport;
        string arrivalAirport;
        uint256 payoutPercentage; // basis points (10000 = 100%)
    }

    // Policy storage
    mapping(bytes32 => FlightPolicy) public flightPolicies;
    mapping(address => bytes32[]) public customerPolicies;
    
    // Oracle and risk pool
    IOracle public flightOracle;
    IRiskPool public riskPool;

    // Pricing parameters
    uint256 public basePremiumRate; // basis points (100 = 1%)
    uint256 public minCoverageAmount;
    uint256 public maxCoverageAmount;
    uint256 public minDelayThreshold; // in minutes
    uint256 public maxDelayThreshold; // in minutes

    // Statistics
    uint256 public totalPoliciesIssued;
    uint256 public totalPremiumsCollected;
    uint256 public totalPayoutsProcessed;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _flightOracle,
        address _riskPool,
        uint256 _basePremiumRate
    ) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UNDERWRITER_ROLE, msg.sender);

        flightOracle = IOracle(_flightOracle);
        riskPool = IRiskPool(_riskPool);
        basePremiumRate = _basePremiumRate;

        // Set default parameters
        minCoverageAmount = 50000 * 10**6; // 50,000 USDC (6 decimals)
        maxCoverageAmount = 5000000 * 10**6; // 5,000,000 USDC
        minDelayThreshold = 120; // 2 hours
        maxDelayThreshold = 480; // 8 hours
    }

    /**
     * @dev Create a new flight delay insurance policy
     * @param customer Address of the customer
     * @param coverageAmount Coverage amount in USDC (6 decimals)
     * @param duration Policy duration in seconds
     * @param policyData Encoded policy data (flightNumber, departureTime, delayThreshold, airports)
     * @return policyId Unique policy identifier
     */
    function createPolicy(
        address customer,
        uint256 coverageAmount,
        uint256 duration,
        bytes calldata policyData
    ) external payable override nonReentrant whenNotPaused returns (bytes32 policyId) {
        require(customer != address(0), "Invalid customer address");
        require(
            coverageAmount >= minCoverageAmount && coverageAmount <= maxCoverageAmount,
            "Coverage amount out of range"
        );

        // Decode policy data
        (
            string memory flightNumber,
            uint256 departureTime,
            uint256 delayThreshold,
            string memory departureAirport,
            string memory arrivalAirport
        ) = abi.decode(policyData, (string, uint256, uint256, string, string));

        require(
            delayThreshold >= minDelayThreshold && delayThreshold <= maxDelayThreshold,
            "Delay threshold out of range"
        );
        require(departureTime > block.timestamp, "Departure time must be in the future");
        require(bytes(flightNumber).length > 0, "Invalid flight number");

        // Calculate premium
        uint256 premium = calculatePremium(coverageAmount, delayThreshold, duration);
        require(msg.value >= premium, "Insufficient premium payment");

        // Generate policy ID
        policyId = keccak256(
            abi.encodePacked(
                customer,
                flightNumber,
                departureTime,
                block.timestamp,
                totalPoliciesIssued
            )
        );

        // Calculate payout percentage based on delay threshold
        uint256 payoutPercentage = calculatePayoutPercentage(delayThreshold);

        // Create policy
        Policy memory basePolicy = Policy({
            policyId: policyId,
            customer: customer,
            premium: premium,
            coverageAmount: coverageAmount,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            active: true,
            claimed: false
        });

        FlightPolicy memory flightPolicy = FlightPolicy({
            basePolicy: basePolicy,
            flightNumber: flightNumber,
            departureTime: departureTime,
            delayThreshold: delayThreshold,
            departureAirport: departureAirport,
            arrivalAirport: arrivalAirport,
            payoutPercentage: payoutPercentage
        });

        flightPolicies[policyId] = flightPolicy;
        customerPolicies[customer].push(policyId);

        // Collect premium to risk pool
        riskPool.collectPremium{value: premium}(policyId, premium);

        // Update statistics
        totalPoliciesIssued++;
        totalPremiumsCollected += premium;

        // Refund excess payment
        if (msg.value > premium) {
            payable(msg.sender).transfer(msg.value - premium);
        }

        emit PolicyCreated(
            policyId,
            customer,
            premium,
            coverageAmount,
            block.timestamp,
            block.timestamp + duration
        );

        return policyId;
    }

    /**
     * @dev Activate a policy (automatic activation on creation)
     * @param policyId Policy identifier
     */
    function activatePolicy(bytes32 policyId) external override onlyRole(UNDERWRITER_ROLE) {
        FlightPolicy storage policy = flightPolicies[policyId];
        require(policy.basePolicy.policyId == policyId, "Policy does not exist");
        require(!policy.basePolicy.active, "Policy already active");

        policy.basePolicy.active = true;

        emit PolicyActivated(policyId);
    }

    /**
     * @dev Trigger a claim based on oracle data
     * @param policyId Policy identifier
     * @param claimData Encoded claim data (actualDepartureTime, delayMinutes)
     */
    function triggerClaim(
        bytes32 policyId,
        bytes calldata claimData
    ) external override onlyRole(ORACLE_ROLE) nonReentrant {
        FlightPolicy storage policy = flightPolicies[policyId];
        require(policy.basePolicy.policyId == policyId, "Policy does not exist");
        require(policy.basePolicy.active, "Policy not active");
        require(!policy.basePolicy.claimed, "Policy already claimed");
        require(block.timestamp <= policy.basePolicy.endTime, "Policy expired");

        // Decode claim data
        (uint256 actualDepartureTime, uint256 delayMinutes) = abi.decode(
            claimData,
            (uint256, uint256)
        );

        // Check if delay threshold is met
        require(delayMinutes >= policy.delayThreshold, "Delay threshold not met");

        // Calculate payout amount
        uint256 payoutAmount = (policy.basePolicy.coverageAmount * policy.payoutPercentage) / 10000;

        // Mark as claimed
        policy.basePolicy.claimed = true;

        // Process payout through risk pool
        riskPool.processPayout(
            policyId,
            policy.basePolicy.customer,
            payoutAmount
        );

        // Update statistics
        totalPayoutsProcessed += payoutAmount;

        emit ClaimTriggered(
            policyId,
            policy.basePolicy.customer,
            payoutAmount,
            string(abi.encodePacked("Flight delayed by ", uint2str(delayMinutes), " minutes"))
        );

        emit PayoutProcessed(policyId, policy.basePolicy.customer, payoutAmount);
    }

    /**
     * @dev Calculate premium based on coverage amount, delay threshold, and duration
     * @param coverageAmount Coverage amount
     * @param delayThreshold Delay threshold in minutes
     * @param duration Policy duration in seconds
     * @return premium Premium amount
     */
    function calculatePremium(
        uint256 coverageAmount,
        uint256 delayThreshold,
        uint256 duration
    ) public view returns (uint256 premium) {
        // Base premium calculation: coverageAmount * basePremiumRate / 10000
        uint256 basePremium = (coverageAmount * basePremiumRate) / 10000;

        // Adjust for delay threshold (lower threshold = higher premium)
        uint256 thresholdFactor = (maxDelayThreshold * 10000) / delayThreshold;
        uint256 adjustedPremium = (basePremium * thresholdFactor) / 10000;

        // Adjust for duration (longer duration = higher premium)
        uint256 durationDays = duration / 86400; // Convert to days
        uint256 durationFactor = 10000 + (durationDays * 100); // 1% per day
        premium = (adjustedPremium * durationFactor) / 10000;

        return premium;
    }

    /**
     * @dev Calculate payout percentage based on delay threshold
     * @param delayThreshold Delay threshold in minutes
     * @return payoutPercentage Payout percentage in basis points
     */
    function calculatePayoutPercentage(uint256 delayThreshold) public pure returns (uint256 payoutPercentage) {
        // Shorter delay threshold = higher payout percentage
        if (delayThreshold <= 120) {
            return 10000; // 100% payout for 2-hour delay
        } else if (delayThreshold <= 180) {
            return 7500; // 75% payout for 3-hour delay
        } else if (delayThreshold <= 240) {
            return 5000; // 50% payout for 4-hour delay
        } else {
            return 2500; // 25% payout for longer delays
        }
    }

    /**
     * @dev Get policy details
     * @param policyId Policy identifier
     * @return policy Policy struct
     */
    function getPolicy(bytes32 policyId) external view override returns (Policy memory policy) {
        return flightPolicies[policyId].basePolicy;
    }

    /**
     * @dev Get full flight policy details
     * @param policyId Policy identifier
     * @return flightPolicy FlightPolicy struct
     */
    function getFlightPolicy(bytes32 policyId) external view returns (FlightPolicy memory flightPolicy) {
        return flightPolicies[policyId];
    }

    /**
     * @dev Check if policy is active
     * @param policyId Policy identifier
     * @return active True if policy is active
     */
    function isPolicyActive(bytes32 policyId) external view override returns (bool active) {
        FlightPolicy storage policy = flightPolicies[policyId];
        return policy.basePolicy.active && 
               !policy.basePolicy.claimed && 
               block.timestamp <= policy.basePolicy.endTime;
    }

    /**
     * @dev Get customer policies
     * @param customer Customer address
     * @return policyIds Array of policy IDs
     */
    function getCustomerPolicies(address customer) external view returns (bytes32[] memory policyIds) {
        return customerPolicies[customer];
    }

    /**
     * @dev Update pricing parameters
     * @param _basePremiumRate New base premium rate
     */
    function updatePricingParameters(
        uint256 _basePremiumRate
    ) external onlyRole(UNDERWRITER_ROLE) {
        basePremiumRate = _basePremiumRate;
    }

    /**
     * @dev Update coverage limits
     * @param _minCoverageAmount New minimum coverage amount
     * @param _maxCoverageAmount New maximum coverage amount
     */
    function updateCoverageLimits(
        uint256 _minCoverageAmount,
        uint256 _maxCoverageAmount
    ) external onlyRole(UNDERWRITER_ROLE) {
        require(_minCoverageAmount < _maxCoverageAmount, "Invalid coverage limits");
        minCoverageAmount = _minCoverageAmount;
        maxCoverageAmount = _maxCoverageAmount;
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
     * @dev Convert uint to string
     * @param _i Unsigned integer
     * @return _uintAsString String representation
     */
    function uint2str(uint256 _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/IOracle.sol";
import "../interfaces/IRiskPool.sol";

/**
 * @title WeatherInsuranceProduct
 * @dev Parametric weather insurance for events, outdoor businesses, and tourism
 * 
 * Coverage Types:
 * - Excessive Heat: Temperature > threshold for consecutive days
 * - Heavy Rain: Rainfall > threshold causing event cancellation
 * - Strong Wind: Wind speed > threshold
 * - Low Temperature: Temperature < threshold (cold weather)
 * 
 * Use Cases:
 * - Event organizers (concerts, weddings, festivals)
 * - Outdoor businesses (restaurants, tourism)
 * - Construction projects
 * - Transportation services
 */
contract WeatherInsuranceProduct is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    enum WeatherEvent { EXCESSIVE_HEAT, HEAVY_RAIN, STRONG_WIND, LOW_TEMPERATURE }
    enum PolicyStatus { ACTIVE, CLAIMED, EXPIRED, CANCELLED }

    struct Policy {
        bytes32 policyId;
        address policyholder;
        uint256 coverageAmount;       // Coverage in USDC (6 decimals)
        uint256 premium;              // Premium paid in USDC
        WeatherEvent weatherEvent;
        string location;              // GPS coordinates or city name
        uint256 eventDate;            // Date of insured event
        uint256 thresholdValue;       // Trigger threshold (temp in Celsius*100, rain in mm, wind in km/h)
        uint256 consecutiveDays;      // Number of consecutive days for trigger
        uint256 startDate;            // Policy start timestamp
        uint256 endDate;              // Policy end timestamp
        PolicyStatus status;
        uint256 createdAt;
    }

    struct Claim {
        bytes32 claimId;
        bytes32 policyId;
        uint256 payoutAmount;
        uint256[] actualValues;       // Actual weather values recorded
        uint256[] recordedDates;      // Dates when values were recorded
        uint256 claimDate;
        bool paid;
    }

    // State variables
    IOracle public weatherOracle;
    IRiskPool public riskPool;
    
    uint256 public basePremiumRate;   // Premium rate in basis points (100 = 1%)
    uint256 public totalPoliciesIssued;
    uint256 public totalClaimsPaid;
    uint256 public totalPayoutAmount;

    // Mappings
    mapping(bytes32 => Policy) public policies;
    mapping(bytes32 => Claim) public claims;
    mapping(address => bytes32[]) public policyholderPolicies;
    mapping(bytes32 => bytes32[]) public policyClaims;

    // Events
    event PolicyCreated(
        bytes32 indexed policyId,
        address indexed policyholder,
        uint256 coverageAmount,
        uint256 premium,
        WeatherEvent weatherEvent,
        string location
    );
    
    event ClaimTriggered(
        bytes32 indexed claimId,
        bytes32 indexed policyId,
        uint256 payoutAmount
    );
    
    event PayoutProcessed(
        bytes32 indexed claimId,
        bytes32 indexed policyId,
        address indexed policyholder,
        uint256 amount
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _weatherOracle,
        address _riskPool,
        uint256 _basePremiumRate
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        weatherOracle = IOracle(_weatherOracle);
        riskPool = IRiskPool(_riskPool);
        basePremiumRate = _basePremiumRate;
    }

    /**
     * @dev Create a new weather insurance policy
     */
    function createPolicy(
        address _policyholder,
        uint256 _coverageAmount,
        WeatherEvent _weatherEvent,
        string memory _location,
        uint256 _eventDate,
        uint256 _thresholdValue,
        uint256 _consecutiveDays,
        uint256 _durationDays
    ) external whenNotPaused returns (bytes32) {
        require(_coverageAmount >= 50_000_000, "Coverage too low"); // Min 50 USDC
        require(_coverageAmount <= 50_000_000_000, "Coverage too high"); // Max 50,000 USDC
        require(_durationDays >= 1 && _durationDays <= 30, "Invalid duration");
        require(_eventDate > block.timestamp, "Event date must be in future");
        require(_consecutiveDays >= 1 && _consecutiveDays <= 7, "Invalid consecutive days");
        require(_thresholdValue > 0, "Invalid threshold");

        // Calculate premium
        uint256 premium = calculatePremium(
            _coverageAmount,
            _weatherEvent,
            _consecutiveDays,
            _durationDays
        );

        // Generate policy ID
        bytes32 policyId = keccak256(
            abi.encodePacked(
                _policyholder,
                _coverageAmount,
                _location,
                _eventDate,
                block.timestamp,
                totalPoliciesIssued
            )
        );

        // Create policy
        policies[policyId] = Policy({
            policyId: policyId,
            policyholder: _policyholder,
            coverageAmount: _coverageAmount,
            premium: premium,
            weatherEvent: _weatherEvent,
            location: _location,
            eventDate: _eventDate,
            thresholdValue: _thresholdValue,
            consecutiveDays: _consecutiveDays,
            startDate: block.timestamp,
            endDate: block.timestamp + (_durationDays * 1 days),
            status: PolicyStatus.ACTIVE,
            createdAt: block.timestamp
        });

        policyholderPolicies[_policyholder].push(policyId);
        totalPoliciesIssued++;

        // Collect premium from risk pool
        riskPool.collectPremium(policyId, premium);

        emit PolicyCreated(
            policyId,
            _policyholder,
            _coverageAmount,
            premium,
            _weatherEvent,
            _location
        );

        return policyId;
    }

    /**
     * @dev Calculate premium based on coverage and risk factors
     */
    function calculatePremium(
        uint256 _coverageAmount,
        WeatherEvent _weatherEvent,
        uint256 _consecutiveDays,
        uint256 _durationDays
    ) public view returns (uint256) {
        // Base premium: 3% of coverage
        uint256 premium = (_coverageAmount * basePremiumRate) / 10000;

        // Weather event multiplier
        if (_weatherEvent == WeatherEvent.HEAVY_RAIN) {
            premium = (premium * 120) / 100; // Rain is more common (higher risk)
        } else if (_weatherEvent == WeatherEvent.STRONG_WIND) {
            premium = (premium * 110) / 100;
        } else if (_weatherEvent == WeatherEvent.EXCESSIVE_HEAT) {
            premium = (premium * 90) / 100; // Heat is more predictable (lower risk)
        }

        // Consecutive days multiplier (more days = lower probability = lower premium)
        if (_consecutiveDays >= 5) {
            premium = (premium * 80) / 100; // 20% discount for 5+ consecutive days
        } else if (_consecutiveDays >= 3) {
            premium = (premium * 90) / 100; // 10% discount for 3+ consecutive days
        }

        // Duration multiplier
        premium = (premium * _durationDays) / 30;

        return premium;
    }

    /**
     * @dev Trigger claim based on weather data from oracle
     */
    function triggerClaim(
        bytes32 _policyId,
        uint256[] memory _actualValues,
        uint256[] memory _recordedDates
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        Policy storage policy = policies[_policyId];
        require(policy.status == PolicyStatus.ACTIVE, "Policy not active");
        require(block.timestamp >= policy.startDate, "Policy not started");
        require(block.timestamp <= policy.endDate, "Policy expired");
        require(_actualValues.length == _recordedDates.length, "Array length mismatch");
        require(_actualValues.length >= policy.consecutiveDays, "Insufficient data points");

        // Evaluate trigger conditions
        (bool triggered, uint256 payoutPercentage) = evaluateTrigger(
            policy.weatherEvent,
            policy.thresholdValue,
            policy.consecutiveDays,
            _actualValues
        );

        require(triggered, "Trigger conditions not met");

        // Calculate payout
        uint256 payoutAmount = (policy.coverageAmount * payoutPercentage) / 100;

        // Generate claim ID
        bytes32 claimId = keccak256(
            abi.encodePacked(
                _policyId,
                block.timestamp
            )
        );

        // Create claim
        claims[claimId] = Claim({
            claimId: claimId,
            policyId: _policyId,
            payoutAmount: payoutAmount,
            actualValues: _actualValues,
            recordedDates: _recordedDates,
            claimDate: block.timestamp,
            paid: false
        });

        policyClaims[_policyId].push(claimId);

        emit ClaimTriggered(claimId, _policyId, payoutAmount);

        // Process payout
        processPayout(claimId);
    }

    /**
     * @dev Evaluate trigger conditions based on weather data
     */
    function evaluateTrigger(
        WeatherEvent _weatherEvent,
        uint256 _thresholdValue,
        uint256 _consecutiveDays,
        uint256[] memory _actualValues
    ) internal pure returns (bool triggered, uint256 payoutPercentage) {
        uint256 consecutiveCount = 0;
        uint256 maxConsecutive = 0;

        // Count consecutive days meeting threshold
        for (uint256 i = 0; i < _actualValues.length; i++) {
            bool meetsThreshold = false;

            if (_weatherEvent == WeatherEvent.EXCESSIVE_HEAT || _weatherEvent == WeatherEvent.HEAVY_RAIN || _weatherEvent == WeatherEvent.STRONG_WIND) {
                // For these events, actual value must exceed threshold
                meetsThreshold = _actualValues[i] >= _thresholdValue;
            } else if (_weatherEvent == WeatherEvent.LOW_TEMPERATURE) {
                // For low temperature, actual value must be below threshold
                meetsThreshold = _actualValues[i] <= _thresholdValue;
            }

            if (meetsThreshold) {
                consecutiveCount++;
                if (consecutiveCount > maxConsecutive) {
                    maxConsecutive = consecutiveCount;
                }
            } else {
                consecutiveCount = 0;
            }
        }

        // Check if trigger condition met
        if (maxConsecutive >= _consecutiveDays) {
            // Calculate payout percentage based on severity
            if (maxConsecutive >= _consecutiveDays + 2) {
                return (true, 100); // 100% payout for severe (2+ extra days)
            } else if (maxConsecutive >= _consecutiveDays + 1) {
                return (true, 75); // 75% payout for moderate (1 extra day)
            } else {
                return (true, 50); // 50% payout for meeting minimum threshold
            }
        }

        return (false, 0);
    }

    /**
     * @dev Process payout to policyholder
     */
    function processPayout(bytes32 _claimId) internal {
        Claim storage claim = claims[_claimId];
        Policy storage policy = policies[claim.policyId];

        require(!claim.paid, "Claim already paid");
        require(policy.status == PolicyStatus.ACTIVE, "Policy not active");

        // Transfer payout from risk pool to policyholder
        riskPool.processPayout(claim.policyId, policy.policyholder, claim.payoutAmount);

        // Update claim status
        claim.paid = true;

        // Update policy status
        policy.status = PolicyStatus.CLAIMED;

        // Update statistics
        totalClaimsPaid++;
        totalPayoutAmount += claim.payoutAmount;

        emit PayoutProcessed(
            _claimId,
            claim.policyId,
            policy.policyholder,
            claim.payoutAmount
        );
    }

    /**
     * @dev Get policy details
     */
    function getPolicy(bytes32 _policyId) external view returns (Policy memory) {
        return policies[_policyId];
    }

    /**
     * @dev Get claim details
     */
    function getClaim(bytes32 _claimId) external view returns (Claim memory) {
        return claims[_claimId];
    }

    /**
     * @dev Get all policies for a policyholder
     */
    function getPolicyholderPolicies(address _policyholder) external view returns (bytes32[] memory) {
        return policyholderPolicies[_policyholder];
    }

    /**
     * @dev Get all claims for a policy
     */
    function getPolicyClaims(bytes32 _policyId) external view returns (bytes32[] memory) {
        return policyClaims[_policyId];
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
     * @dev Authorize upgrade
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}

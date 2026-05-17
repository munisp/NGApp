// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/IOracle.sol";
import "../interfaces/IRiskPool.sol";

/**
 * @title CropInsuranceProduct
 * @dev Parametric crop insurance product based on rainfall data
 * 
 * Coverage Types:
 * - Drought: Insufficient rainfall during growing season
 * - Flood: Excessive rainfall causing crop damage
 * - Pest Infestation: Triggered by weather conditions
 * 
 * Payout Triggers:
 * - Rainfall < 50mm/month for 2+ consecutive months = Drought (100% payout)
 * - Rainfall > 300mm/month = Flood (75% payout)
 * - Temperature > 35°C + Humidity > 80% = Pest risk (50% payout)
 */
contract CropInsuranceProduct is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    enum CropType { RICE, MAIZE, CASSAVA, YAM, SORGHUM, MILLET }
    enum CoverageType { DROUGHT, FLOOD, PEST, COMPREHENSIVE }
    enum PolicyStatus { ACTIVE, CLAIMED, EXPIRED, CANCELLED }

    struct Policy {
        bytes32 policyId;
        address policyholder;
        uint256 coverageAmount;      // Coverage in USDC (6 decimals)
        uint256 premium;              // Premium paid in USDC
        CropType cropType;
        CoverageType coverageType;
        string farmLocation;          // GPS coordinates or location name
        uint256 farmSizeHectares;     // Farm size in hectares
        uint256 startDate;            // Policy start timestamp
        uint256 endDate;              // Policy end timestamp
        uint256 plantingDate;         // Crop planting date
        uint256 harvestDate;          // Expected harvest date
        PolicyStatus status;
        uint256 createdAt;
    }

    struct Claim {
        bytes32 claimId;
        bytes32 policyId;
        uint256 payoutAmount;
        string triggerEvent;          // "drought", "flood", "pest"
        uint256 rainfallData;         // Actual rainfall in mm
        uint256 temperatureData;      // Temperature in Celsius * 100
        uint256 humidityData;         // Humidity percentage
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
        CropType cropType,
        CoverageType coverageType
    );
    
    event ClaimTriggered(
        bytes32 indexed claimId,
        bytes32 indexed policyId,
        uint256 payoutAmount,
        string triggerEvent
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
     * @dev Create a new crop insurance policy
     */
    function createPolicy(
        address _policyholder,
        uint256 _coverageAmount,
        CropType _cropType,
        CoverageType _coverageType,
        string memory _farmLocation,
        uint256 _farmSizeHectares,
        uint256 _durationDays,
        uint256 _plantingDate,
        uint256 _harvestDate
    ) external whenNotPaused returns (bytes32) {
        require(_coverageAmount >= 50_000_000, "Coverage too low"); // Min 50 USDC
        require(_coverageAmount <= 10_000_000_000, "Coverage too high"); // Max 10,000 USDC
        require(_durationDays >= 90 && _durationDays <= 365, "Invalid duration");
        require(_farmSizeHectares > 0 && _farmSizeHectares <= 1000, "Invalid farm size");
        require(_plantingDate < _harvestDate, "Invalid planting/harvest dates");

        // Calculate premium
        uint256 premium = calculatePremium(
            _coverageAmount,
            _cropType,
            _coverageType,
            _farmSizeHectares,
            _durationDays
        );

        // Generate policy ID
        bytes32 policyId = keccak256(
            abi.encodePacked(
                _policyholder,
                _coverageAmount,
                _farmLocation,
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
            cropType: _cropType,
            coverageType: _coverageType,
            farmLocation: _farmLocation,
            farmSizeHectares: _farmSizeHectares,
            startDate: block.timestamp,
            endDate: block.timestamp + (_durationDays * 1 days),
            plantingDate: _plantingDate,
            harvestDate: _harvestDate,
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
            _cropType,
            _coverageType
        );

        return policyId;
    }

    /**
     * @dev Calculate premium based on coverage, crop type, and risk factors
     */
    function calculatePremium(
        uint256 _coverageAmount,
        CropType _cropType,
        CoverageType _coverageType,
        uint256 _farmSizeHectares,
        uint256 _durationDays
    ) public view returns (uint256) {
        // Base premium: 5% of coverage
        uint256 premium = (_coverageAmount * basePremiumRate) / 10000;

        // Crop type multiplier
        if (_cropType == CropType.RICE) {
            premium = (premium * 120) / 100; // Rice is higher risk (flood-prone)
        } else if (_cropType == CropType.CASSAVA) {
            premium = (premium * 80) / 100; // Cassava is lower risk (drought-resistant)
        }

        // Coverage type multiplier
        if (_coverageType == CoverageType.COMPREHENSIVE) {
            premium = (premium * 150) / 100; // Comprehensive coverage costs more
        } else if (_coverageType == CoverageType.DROUGHT) {
            premium = (premium * 110) / 100;
        } else if (_coverageType == CoverageType.FLOOD) {
            premium = (premium * 120) / 100;
        }

        // Farm size multiplier (larger farms get discount)
        if (_farmSizeHectares >= 100) {
            premium = (premium * 90) / 100; // 10% discount for large farms
        } else if (_farmSizeHectares >= 50) {
            premium = (premium * 95) / 100; // 5% discount for medium farms
        }

        // Duration multiplier
        premium = (premium * _durationDays) / 365;

        return premium;
    }

    /**
     * @dev Trigger claim based on weather data from oracle
     */
    function triggerClaim(
        bytes32 _policyId,
        string memory _triggerEvent,
        uint256 _rainfallData,
        uint256 _temperatureData,
        uint256 _humidityData
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        Policy storage policy = policies[_policyId];
        require(policy.status == PolicyStatus.ACTIVE, "Policy not active");
        require(block.timestamp >= policy.startDate, "Policy not started");
        require(block.timestamp <= policy.endDate, "Policy expired");

        // Evaluate trigger conditions
        (bool triggered, uint256 payoutPercentage) = evaluateTrigger(
            policy.coverageType,
            _triggerEvent,
            _rainfallData,
            _temperatureData,
            _humidityData
        );

        require(triggered, "Trigger conditions not met");

        // Calculate payout
        uint256 payoutAmount = (policy.coverageAmount * payoutPercentage) / 100;

        // Generate claim ID
        bytes32 claimId = keccak256(
            abi.encodePacked(
                _policyId,
                _triggerEvent,
                block.timestamp
            )
        );

        // Create claim
        claims[claimId] = Claim({
            claimId: claimId,
            policyId: _policyId,
            payoutAmount: payoutAmount,
            triggerEvent: _triggerEvent,
            rainfallData: _rainfallData,
            temperatureData: _temperatureData,
            humidityData: _humidityData,
            claimDate: block.timestamp,
            paid: false
        });

        policyClaims[_policyId].push(claimId);

        emit ClaimTriggered(claimId, _policyId, payoutAmount, _triggerEvent);

        // Process payout
        processPayout(claimId);
    }

    /**
     * @dev Evaluate trigger conditions based on weather data
     */
    function evaluateTrigger(
        CoverageType _coverageType,
        string memory _triggerEvent,
        uint256 _rainfallData,
        uint256 _temperatureData,
        uint256 _humidityData
    ) internal pure returns (bool triggered, uint256 payoutPercentage) {
        bytes32 eventHash = keccak256(abi.encodePacked(_triggerEvent));

        // Drought trigger: Rainfall < 50mm/month
        if (eventHash == keccak256("drought")) {
            if (_coverageType == CoverageType.DROUGHT || _coverageType == CoverageType.COMPREHENSIVE) {
                if (_rainfallData < 50) {
                    return (true, 100); // 100% payout for severe drought
                } else if (_rainfallData < 75) {
                    return (true, 75); // 75% payout for moderate drought
                }
            }
        }

        // Flood trigger: Rainfall > 300mm/month
        if (eventHash == keccak256("flood")) {
            if (_coverageType == CoverageType.FLOOD || _coverageType == CoverageType.COMPREHENSIVE) {
                if (_rainfallData > 300) {
                    return (true, 100); // 100% payout for severe flood
                } else if (_rainfallData > 250) {
                    return (true, 75); // 75% payout for moderate flood
                }
            }
        }

        // Pest trigger: High temperature + high humidity
        if (eventHash == keccak256("pest")) {
            if (_coverageType == CoverageType.PEST || _coverageType == CoverageType.COMPREHENSIVE) {
                // Temperature > 35°C (3500 in contract) and Humidity > 80%
                if (_temperatureData > 3500 && _humidityData > 80) {
                    return (true, 50); // 50% payout for pest risk
                }
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

const hre = require("hardhat");

async function main() {
  console.log("Deploying Etherisc GIF Phase 2 & 3 contracts to Polygon Mumbai testnet...");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Load Phase 1 deployment addresses
  const fs = require("fs");
  let phase1Deployment;
  try {
    phase1Deployment = JSON.parse(fs.readFileSync("deployments/polygon-mumbai.json", "utf8"));
    console.log("\nPhase 1 contracts loaded:");
    console.log("  RiskPool:", phase1Deployment.contracts.RiskPool);
  } catch (error) {
    console.error("Error: Phase 1 contracts not deployed. Please deploy Phase 1 first.");
    process.exit(1);
  }

  const riskPoolAddress = phase1Deployment.contracts.RiskPool;

  // ========================================
  // PHASE 2: Crop Insurance + Weather Oracle
  // ========================================
  console.log("\n=== PHASE 2: Crop Insurance + Weather Oracle ===");

  // Deploy WeatherOracle
  console.log("\n1. Deploying WeatherOracle...");
  const WeatherOracle = await hre.ethers.getContractFactory("WeatherOracle");
  const weatherOracle = await hre.upgrades.deployProxy(WeatherOracle, [], {
    initializer: "initialize",
  });
  await weatherOracle.deployed();
  console.log("WeatherOracle deployed to:", weatherOracle.address);

  // Deploy CropInsuranceProduct
  console.log("\n2. Deploying CropInsuranceProduct...");
  const CropInsuranceProduct = await hre.ethers.getContractFactory("CropInsuranceProduct");
  const basePremiumRateCrop = 500; // 5% (500 basis points)
  const cropInsuranceProduct = await hre.upgrades.deployProxy(
    CropInsuranceProduct,
    [weatherOracle.address, riskPoolAddress, basePremiumRateCrop],
    { initializer: "initialize" }
  );
  await cropInsuranceProduct.deployed();
  console.log("CropInsuranceProduct deployed to:", cropInsuranceProduct.address);

  // ========================================
  // PHASE 3: Weather Insurance + IoT Oracle
  // ========================================
  console.log("\n=== PHASE 3: Weather Insurance + IoT Oracle ===");

  // Deploy IoTOracle
  console.log("\n3. Deploying IoTOracle...");
  const IoTOracle = await hre.ethers.getContractFactory("IoTOracle");
  const iotOracle = await hre.upgrades.deployProxy(IoTOracle, [], {
    initializer: "initialize",
  });
  await iotOracle.deployed();
  console.log("IoTOracle deployed to:", iotOracle.address);

  // Deploy WeatherInsuranceProduct
  console.log("\n4. Deploying WeatherInsuranceProduct...");
  const WeatherInsuranceProduct = await hre.ethers.getContractFactory("WeatherInsuranceProduct");
  const basePremiumRateWeather = 300; // 3% (300 basis points)
  const weatherInsuranceProduct = await hre.upgrades.deployProxy(
    WeatherInsuranceProduct,
    [weatherOracle.address, riskPoolAddress, basePremiumRateWeather],
    { initializer: "initialize" }
  );
  await weatherInsuranceProduct.deployed();
  console.log("WeatherInsuranceProduct deployed to:", weatherInsuranceProduct.address);

  // ========================================
  // Grant Roles
  // ========================================
  console.log("\n=== Granting Roles ===");

  // Grant ORACLE_ROLE to deployer (for testing)
  const ORACLE_ROLE_CROP = await cropInsuranceProduct.ORACLE_ROLE();
  await cropInsuranceProduct.grantRole(ORACLE_ROLE_CROP, deployer.address);
  console.log("✓ Granted ORACLE_ROLE to deployer on CropInsuranceProduct");

  const ORACLE_ROLE_WEATHER = await weatherInsuranceProduct.ORACLE_ROLE();
  await weatherInsuranceProduct.grantRole(ORACLE_ROLE_WEATHER, deployer.address);
  console.log("✓ Granted ORACLE_ROLE to deployer on WeatherInsuranceProduct");

  // Grant PRODUCT_ROLE to products on RiskPool
  const riskPool = await hre.ethers.getContractAt("RiskPool", riskPoolAddress);
  const PRODUCT_ROLE = await riskPool.PRODUCT_ROLE();
  await riskPool.grantRole(PRODUCT_ROLE, cropInsuranceProduct.address);
  console.log("✓ Granted PRODUCT_ROLE to CropInsuranceProduct on RiskPool");
  await riskPool.grantRole(PRODUCT_ROLE, weatherInsuranceProduct.address);
  console.log("✓ Granted PRODUCT_ROLE to WeatherInsuranceProduct on RiskPool");

  // Grant ORACLE_OPERATOR_ROLE to deployer on WeatherOracle
  const ORACLE_OPERATOR_ROLE_WEATHER = await weatherOracle.ORACLE_OPERATOR_ROLE();
  await weatherOracle.grantRole(ORACLE_OPERATOR_ROLE_WEATHER, deployer.address);
  console.log("✓ Granted ORACLE_OPERATOR_ROLE to deployer on WeatherOracle");

  // Grant VERIFIER_ROLE to deployer on WeatherOracle
  const VERIFIER_ROLE_WEATHER = await weatherOracle.VERIFIER_ROLE();
  await weatherOracle.grantRole(VERIFIER_ROLE_WEATHER, deployer.address);
  console.log("✓ Granted VERIFIER_ROLE to deployer on WeatherOracle");

  // Grant ORACLE_OPERATOR_ROLE to deployer on IoTOracle
  const ORACLE_OPERATOR_ROLE_IOT = await iotOracle.ORACLE_OPERATOR_ROLE();
  await iotOracle.grantRole(ORACLE_OPERATOR_ROLE_IOT, deployer.address);
  console.log("✓ Granted ORACLE_OPERATOR_ROLE to deployer on IoTOracle");

  // Grant VERIFIER_ROLE to deployer on IoTOracle
  const VERIFIER_ROLE_IOT = await iotOracle.VERIFIER_ROLE();
  await iotOracle.grantRole(VERIFIER_ROLE_IOT, deployer.address);
  console.log("✓ Granted VERIFIER_ROLE to deployer on IoTOracle");

  // ========================================
  // Save Deployment Addresses
  // ========================================
  console.log("\n=== Saving Deployment Addresses ===");
  
  const deploymentInfo = {
    network: "polygon-mumbai",
    deployer: deployer.address,
    phase1: phase1Deployment.contracts,
    phase2: {
      WeatherOracle: weatherOracle.address,
      CropInsuranceProduct: cropInsuranceProduct.address,
    },
    phase3: {
      IoTOracle: iotOracle.address,
      WeatherInsuranceProduct: weatherInsuranceProduct.address,
    },
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    "deployments/polygon-mumbai-phase2-phase3.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("✓ Deployment info saved to deployments/polygon-mumbai-phase2-phase3.json");

  // ========================================
  // Print Summary
  // ========================================
  console.log("\n=== Deployment Summary ===");
  console.log("Network: Polygon Mumbai Testnet");
  console.log("Deployer:", deployer.address);
  
  console.log("\nPhase 1 Contracts (Existing):");
  console.log("  RiskPool:", riskPoolAddress);
  
  console.log("\nPhase 2 Contracts (NEW):");
  console.log("  WeatherOracle:", weatherOracle.address);
  console.log("  CropInsuranceProduct:", cropInsuranceProduct.address);
  
  console.log("\nPhase 3 Contracts (NEW):");
  console.log("  IoTOracle:", iotOracle.address);
  console.log("  WeatherInsuranceProduct:", weatherInsuranceProduct.address);
  
  console.log("\nAll Products:");
  console.log("  1. FlightDelayProduct (Phase 1)");
  console.log("  2. CropInsuranceProduct (Phase 2) ✨ NEW");
  console.log("  3. WeatherInsuranceProduct (Phase 3) ✨ NEW");

  console.log("\nAll Oracles:");
  console.log("  1. FlightOracle (Phase 1)");
  console.log("  2. WeatherOracle (Phase 2) ✨ NEW");
  console.log("  3. IoTOracle (Phase 3) ✨ NEW");

  console.log("\nNext Steps:");
  console.log("1. Verify contracts on Polygonscan:");
  console.log(`   npx hardhat verify --network polygon-mumbai ${weatherOracle.address}`);
  console.log(`   npx hardhat verify --network polygon-mumbai ${cropInsuranceProduct.address}`);
  console.log(`   npx hardhat verify --network polygon-mumbai ${iotOracle.address}`);
  console.log(`   npx hardhat verify --network polygon-mumbai ${weatherInsuranceProduct.address}`);
  console.log("2. Update .env files with contract addresses");
  console.log("3. Deploy oracle and backend services for Phase 2 & 3");
  console.log("4. Register IoT devices on IoTOracle");
  console.log("5. Fund risk pool with additional capital for new products");
  console.log("6. Test crop insurance policy creation");
  console.log("7. Test weather insurance policy creation");
  console.log("8. Submit weather data and trigger claims");

  console.log("\n✅ Phase 2 & 3 deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

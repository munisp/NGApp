const hre = require("hardhat");

async function main() {
  console.log("Deploying Etherisc GIF contracts to Polygon Mumbai testnet...");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy FlightOracle
  console.log("\n1. Deploying FlightOracle...");
  const FlightOracle = await hre.ethers.getContractFactory("FlightOracle");
  const flightOracle = await hre.upgrades.deployProxy(FlightOracle, [], {
    initializer: "initialize",
  });
  await flightOracle.deployed();
  console.log("FlightOracle deployed to:", flightOracle.address);

  // Deploy RiskPool
  console.log("\n2. Deploying RiskPool...");
  const RiskPool = await hre.ethers.getContractFactory("RiskPool");
  const minCapital = hre.ethers.utils.parseUnits("100000", 6); // 100,000 USDC
  const minInvestment = hre.ethers.utils.parseUnits("1000", 6); // 1,000 USDC
  const lockPeriod = 30 * 24 * 60 * 60; // 30 days
  const riskPool = await hre.upgrades.deployProxy(
    RiskPool,
    [minCapital, minInvestment, lockPeriod],
    { initializer: "initialize" }
  );
  await riskPool.deployed();
  console.log("RiskPool deployed to:", riskPool.address);

  // Deploy FlightDelayProduct
  console.log("\n3. Deploying FlightDelayProduct...");
  const FlightDelayProduct = await hre.ethers.getContractFactory("FlightDelayProduct");
  const basePremiumRate = 100; // 1% (100 basis points)
  const flightDelayProduct = await hre.upgrades.deployProxy(
    FlightDelayProduct,
    [flightOracle.address, riskPool.address, basePremiumRate],
    { initializer: "initialize" }
  );
  await flightDelayProduct.deployed();
  console.log("FlightDelayProduct deployed to:", flightDelayProduct.address);

  // Grant roles
  console.log("\n4. Granting roles...");
  
  // Grant ORACLE_ROLE to deployer (for testing)
  const ORACLE_ROLE = await flightDelayProduct.ORACLE_ROLE();
  await flightDelayProduct.grantRole(ORACLE_ROLE, deployer.address);
  console.log("Granted ORACLE_ROLE to deployer");

  // Grant PRODUCT_ROLE to FlightDelayProduct on RiskPool
  const PRODUCT_ROLE = await riskPool.PRODUCT_ROLE();
  await riskPool.grantRole(PRODUCT_ROLE, flightDelayProduct.address);
  console.log("Granted PRODUCT_ROLE to FlightDelayProduct");

  // Grant ORACLE_OPERATOR_ROLE to deployer (for testing)
  const ORACLE_OPERATOR_ROLE = await flightOracle.ORACLE_OPERATOR_ROLE();
  await flightOracle.grantRole(ORACLE_OPERATOR_ROLE, deployer.address);
  console.log("Granted ORACLE_OPERATOR_ROLE to deployer");

  // Grant VERIFIER_ROLE to deployer (for testing)
  const VERIFIER_ROLE = await flightOracle.VERIFIER_ROLE();
  await flightOracle.grantRole(VERIFIER_ROLE, deployer.address);
  console.log("Granted VERIFIER_ROLE to deployer");

  // Save deployment addresses
  console.log("\n5. Saving deployment addresses...");
  const fs = require("fs");
  const deploymentInfo = {
    network: "polygon-mumbai",
    deployer: deployer.address,
    contracts: {
      FlightOracle: flightOracle.address,
      RiskPool: riskPool.address,
      FlightDelayProduct: flightDelayProduct.address,
    },
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    "deployments/polygon-mumbai.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("Deployment info saved to deployments/polygon-mumbai.json");

  // Print summary
  console.log("\n=== Deployment Summary ===");
  console.log("Network: Polygon Mumbai Testnet");
  console.log("Deployer:", deployer.address);
  console.log("\nContract Addresses:");
  console.log("  FlightOracle:", flightOracle.address);
  console.log("  RiskPool:", riskPool.address);
  console.log("  FlightDelayProduct:", flightDelayProduct.address);
  console.log("\nNext Steps:");
  console.log("1. Verify contracts on Polygonscan:");
  console.log(`   npx hardhat verify --network polygon-mumbai ${flightOracle.address}`);
  console.log(`   npx hardhat verify --network polygon-mumbai ${riskPool.address}`);
  console.log(`   npx hardhat verify --network polygon-mumbai ${flightDelayProduct.address}`);
  console.log("2. Update .env files with contract addresses");
  console.log("3. Deploy oracle and backend services");
  console.log("4. Fund risk pool with capital");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const ElectionRegistry = await ethers.getContractFactory("ElectionRegistry");
  const electionRegistry = await ElectionRegistry.deploy();

  await electionRegistry.waitForDeployment();
  const address = await electionRegistry.getAddress();

  console.log("ElectionRegistry deployed to:", address);

  const filePath = path.join(__dirname, "..", "deployed-address.json");
  fs.writeFileSync(
    filePath,
    JSON.stringify({ ElectionRegistry: address }, null, 2)
  );
  console.log(`Address written to ${filePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

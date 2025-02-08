import { ethers } from "ethers";
import * as dotenv from "dotenv";
const fs = require("fs");
const path = require("path");
dotenv.config();

// Setup env variables
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
/// TODO: Hack
let chainId = 31337;

const avsDeploymentData = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      `../contracts/deployments/analysis/${chainId}.json`
    ),
    "utf8"
  )
);
const analysisServiceManagerAddress =
  avsDeploymentData.addresses.analysisServiceManager;
const analysisServiceManagerABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../abis/AnalysisServiceManager.json"),
    "utf8"
  )
);
// Initialize contract objects from ABIs
const analysisServiceManager = new ethers.Contract(
  analysisServiceManagerAddress,
  analysisServiceManagerABI,
  wallet
);

async function createNewTask(taskName: string) {
  try {
    // Send a transaction to the createNewTask function
    const tx = await analysisServiceManager.createNewTask(taskName);

    // Wait for the transaction to be mined
    const receipt = await tx.wait();

    console.log(`Transaction successful with hash: ${receipt.hash}`);
  } catch (error) {
    console.error("Error sending transaction:", error);
  }
}

// Function to create a new task with a random wallet address to get analysis
function startCreatingTasks() {
  createNewTask("0x4552cBC00e49f8b4fDE477145557E2818Fe40F6b");
}

// Start the process
startCreatingTasks();

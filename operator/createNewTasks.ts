import { ethers } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup env variables
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
/// TODO: Hack
let chainId = 31337;

const filePath = path.resolve(
  process.cwd(),
  "contracts",
  "deployments",
  "analysis",
  `${chainId}.json`
);

const avsDeploymentData = JSON.parse(fs.readFileSync(filePath, "utf8"));

const analysisServiceManagerAddress =
  avsDeploymentData.addresses.analysisServiceManager;
const analysisServiceManagerABI = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "abis", "AnalysisServiceManager.json"),
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
  createNewTask("0xcD4bde67fe7C6Eb601d03a35Ea8a55eB2b136965");
}

// Start the process
startCreatingTasks();

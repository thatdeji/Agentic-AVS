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

// Function to generate random names
function generateRandomName(): string {
  const adjectives = ["Quick", "Lazy", "Sleepy", "Noisy", "Hungry"];
  const nouns = ["Fox", "Dog", "Cat", "Mouse", "Bear"];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomName = `${adjective}${noun}${Math.floor(Math.random() * 1000)}`;
  return randomName;
}

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

// Function to create a new task with a random name every 15 seconds
function startCreatingTasks() {
  // setInterval(() => {
  //   const randomName = generateRandomName();
  //   console.log(`Creating new task with name: ${randomName}`);
  //   createNewTask(randomName);
  // }, 24000);

  createNewTask("0x4552cBC00e49f8b4fDE477145557E2818Fe40F6b");
}

// Start the process
startCreatingTasks();

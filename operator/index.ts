import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { analyzeTransactions, generateWrappedImage } from "./agent.js";
import { generateCharts, generatePDFReport } from "./report.js";
import {
  fetchTransactionHistory,
  uploadJSONToPinata,
  uploadToIPFSWithPinata,
} from "./utils.js";
import {
  getEnsDomainsByAddress,
  getHopProtocolBridgeTransfersByAddress,
  getUniswapV3SwapsByAddress,
} from "./addressContext.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if the process.env object is empty
if (!Object.keys(process.env).length) {
  throw new Error("process.env object is empty");
}

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
// For core deployment data, also use process.cwd().
const coreDeploymentFilePath = path.resolve(
  process.cwd(),
  "contracts",
  "deployments",
  "core",
  `${chainId}.json`
);
const coreDeploymentData = JSON.parse(
  fs.readFileSync(coreDeploymentFilePath, "utf8")
);

const delegationManagerAddress = coreDeploymentData.addresses.delegation; // Reminder to fix the naming in the deployment file if needed.
const avsDirectoryAddress = coreDeploymentData.addresses.avsDirectory;
const analysisServiceManagerAddress =
  avsDeploymentData.addresses.analysisServiceManager;
const ecdsaStakeRegistryAddress = avsDeploymentData.addresses.stakeRegistry;

// Load ABIs using paths relative to the project root.
const delegationManagerABI = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "abis", "IDelegationManager.json"),
    "utf8"
  )
);
const ecdsaRegistryABI = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "abis", "ECDSAStakeRegistry.json"),
    "utf8"
  )
);
const analysisServiceManagerABI = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "abis", "AnalysisServiceManager.json"),
    "utf8"
  )
);
const avsDirectoryABI = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "abis", "IAVSDirectory.json"),
    "utf8"
  )
);

// Initialize contract objects from ABIs.
const delegationManager = new ethers.Contract(
  delegationManagerAddress,
  delegationManagerABI,
  wallet
);
const analysisServiceManager = new ethers.Contract(
  analysisServiceManagerAddress,
  analysisServiceManagerABI,
  wallet
);
const ecdsaRegistryContract = new ethers.Contract(
  ecdsaStakeRegistryAddress,
  ecdsaRegistryABI,
  wallet
);
const avsDirectory = new ethers.Contract(
  avsDirectoryAddress,
  avsDirectoryABI,
  wallet
);

const signAndRespondToTask = async (
  taskIndex: number,
  taskCreatedBlock: number,
  walletAdress: string
) => {
  const message = `${walletAdress}`;
  const messageHash = ethers.solidityPackedKeccak256(["address"], [message]);
  const messageBytes = ethers.getBytes(messageHash);
  const signature = await wallet.signMessage(messageBytes);

  const history = await fetchTransactionHistory(`${walletAdress}`);

  const swap: any = await getUniswapV3SwapsByAddress(walletAdress);
  const ens: any = await getEnsDomainsByAddress(walletAdress);
  const hop: any = await getHopProtocolBridgeTransfersByAddress(walletAdress);
  console.log(swap, ens, hop);

  const analysis = await analyzeTransactions({
    transactions: history,
    uniswapData: swap,
    hopData: hop,
    ensData: ens,
  });

  const imageUploadResult = await generateWrappedImage(
    JSON.stringify(analysis)
  );

  const charts = await generateCharts(analysis.charts);

  const pdfBuffer = await generatePDFReport(
    analysis.summary,
    analysis.metrics,
    charts
  );

  const pdfUrl = await uploadToIPFSWithPinata(pdfBuffer);

  const report = await uploadJSONToPinata({
    ...analysis,
    imageURL: imageUploadResult.url,
    pdfUrl: pdfUrl,
  });

  console.log(`Signing and responding to task ${taskIndex}`);
  console.log(report.url);

  const operators = [await wallet.getAddress()];
  const signatures = [signature];
  const signedTask = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address[]", "bytes[]", "uint32"],
    [
      operators,
      signatures,
      ethers.toBigInt((await provider.getBlockNumber()) - 1),
    ]
  );

  const tx = await analysisServiceManager.respondToTask(
    { walletAdress: walletAdress, taskCreatedBlock: taskCreatedBlock },
    taskIndex,
    signedTask,
    report.hash
  );
  await tx.wait();
  console.log(`Responded to task.`);
};

const registerOperator = async () => {
  // Registers as an Operator in EigenLayer.
  try {
    const tx1 = await delegationManager.registerAsOperator(
      {
        __deprecated_earningsReceiver: await wallet.address,
        delegationApprover: "0x0000000000000000000000000000000000000000",
        stakerOptOutWindowBlocks: 0,
      },
      ""
    );
    await tx1.wait();
    console.log("Operator registered to Core EigenLayer contracts");
  } catch (error) {
    console.error("Error in registering as operator:", error);
  }

  const salt = ethers.hexlify(ethers.randomBytes(32));
  const expiry = Math.floor(Date.now() / 1000) + 3600; // Example expiry, 1 hour from now

  // Define the output structure
  let operatorSignatureWithSaltAndExpiry = {
    signature: "",
    salt: salt,
    expiry: expiry,
  };

  // Calculate the digest hash, which is a unique value representing the operator, avs, unique value (salt) and expiration date.
  const operatorDigestHash =
    await avsDirectory.calculateOperatorAVSRegistrationDigestHash(
      wallet.address,
      await analysisServiceManager.getAddress(),
      salt,
      expiry
    );
  console.log(operatorDigestHash);

  // Sign the digest hash with the operator's private key
  console.log("Signing digest hash with operator's private key");
  const operatorSigningKey = new ethers.SigningKey(process.env.PRIVATE_KEY!);
  const operatorSignedDigestHash = operatorSigningKey.sign(operatorDigestHash);

  // Encode the signature in the required format
  operatorSignatureWithSaltAndExpiry.signature = ethers.Signature.from(
    operatorSignedDigestHash
  ).serialized;

  console.log("Registering Operator to AVS Registry contract");

  // Register Operator to AVS
  // Per release here: https://github.com/Layr-Labs/eigenlayer-middleware/blob/v0.2.1-mainnet-rewards/src/unaudited/ECDSAStakeRegistry.sol#L49
  const tx2 = await ecdsaRegistryContract.registerOperatorWithSignature(
    operatorSignatureWithSaltAndExpiry,
    wallet.address
  );
  await tx2.wait();
  console.log("Operator registered on AVS successfully");
};

const monitorNewTasks = async () => {
  analysisServiceManager.on(
    "NewTaskCreated",
    async (taskIndex: number, task: any) => {
      console.log(`New task detected: analyse ${task.walletAdress}`);
      await signAndRespondToTask(
        taskIndex,
        task.taskCreatedBlock,
        task.walletAdress
      );
    }
  );

  console.log("Monitoring for new tasks...");
};

const main = async () => {
  await registerOperator();
  monitorNewTasks().catch((error) => {
    console.error("Error monitoring tasks:", error);
  });
};

main().catch((error) => {
  console.error("Error in main function:", error);
});

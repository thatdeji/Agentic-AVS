import { ethers } from "ethers";
import * as dotenv from "dotenv";
import axios from "axios";
import OpenAI from "openai";
const fs = require("fs");
const path = require("path");
dotenv.config();

// Check if the process.env object is empty
if (!Object.keys(process.env).length) {
  throw new Error("process.env object is empty");
}

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
// Load core deployment data
const coreDeploymentData = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, `../contracts/deployments/core/${chainId}.json`),
    "utf8"
  )
);

const delegationManagerAddress = coreDeploymentData.addresses.delegation; // todo: reminder to fix the naming of this contract in the deployment file, change to delegationManager
const avsDirectoryAddress = coreDeploymentData.addresses.avsDirectory;
const analysisServiceManagerAddress =
  avsDeploymentData.addresses.analysisServiceManager;
const ecdsaStakeRegistryAddress = avsDeploymentData.addresses.stakeRegistry;

// Load ABIs
const delegationManagerABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../abis/IDelegationManager.json"),
    "utf8"
  )
);
const ecdsaRegistryABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../abis/ECDSAStakeRegistry.json"),
    "utf8"
  )
);
const analysisServiceManagerABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../abis/AnalysisServiceManager.json"),
    "utf8"
  )
);
const avsDirectoryABI = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../abis/IAVSDirectory.json"), "utf8")
);

// Initialize contract objects from ABIs
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
const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY,
});

const analyzeTransactions = async (transactions: any[]) => {
  const prompt = `
  You are a witty financial commentator known as a "big investor" who always keeps it real with your playful roasts, especially when it comes to users who spend like a miser. Analyze the following Ethereum transaction history and produce a response in **Markdown** format. Your response should include:

  - A **summary** of common transaction patterns.
  - Identification of any **suspicious or unusual activities**.
  - Highlights of **high-value transactions**.
  - Observations on any **unusual gas usage patterns**.
  - A playful roast at the end that humorously mocks the user's spending habits (feel free to mention something along the lines of "big investor, low spender" or any other witty remark).
  
  Make sure the entire output is in valid Markdown format so it can be directly written to a [dot]md file.
  
  **Transaction Data:**
  \`\`\`json
  ${JSON.stringify(transactions, null, 2)}
  \`\`\`
      
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Use GPT-4 turbo for better performance
      messages: [{ role: "system", content: prompt }],
      max_tokens: 1000,
    });

    return response.choices[0].message?.content || "No analysis available.";
  } catch (error) {
    console.error("Error analyzing transactions:", error);
    return "Error occurred while analyzing transactions.";
  }
};

const fetchTransactionHistory = async (walletAdress: string) => {
  try {
    const response = await axios.get(`https://api-sepolia.etherscan.io/api`, {
      params: {
        module: "account",
        action: "txlist",
        address: walletAdress,
        startblock: 0,
        page: 1,
        offset: 500,
        sort: "asc",
        apikey: process.env.ETHERSCAN_API_KEY,
      },
    });

    if (response.data.status === "1") {
      return response.data.result; // Array of transactions
    } else {
      throw new Error("Failed to fetch transaction history");
    }
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }
};

const writeMarkdownReport = (markdown: string) => {
  const outputPath = path.resolve(__dirname, "report.md");
  fs.writeFileSync(outputPath, markdown, { encoding: "utf8" });
  console.log(`Markdown report saved to ${outputPath}`);
};

const signAndRespondToTask = async (
  taskIndex: number,
  taskCreatedBlock: number,
  walletAdress: string
) => {
  const message = `${walletAdress}`;
  const messageHash = ethers.solidityPackedKeccak256(["string"], [message]);
  const messageBytes = ethers.getBytes(messageHash);
  const signature = await wallet.signMessage(messageBytes);

  const history = await fetchTransactionHistory(`${walletAdress}`);

  const analysisMarkdown = await analyzeTransactions(history);

  console.log(`Signing and responding to task ${taskIndex}`);

  // Write the markdown output to a file
  writeMarkdownReport(analysisMarkdown);

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
    analysisMarkdown
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

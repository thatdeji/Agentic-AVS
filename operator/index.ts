import { ethers } from "ethers";
import * as dotenv from "dotenv";
import axios from "axios";
import OpenAI from "openai";
import QuickChart from "quickchart-js";
import PDFDocument from "pdfkit";
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

const analyzeTransactions = async (
  transactions: any[]
): Promise<{ summary: string; metrics: any; charts: any }> => {
  const prompt = `
You are an experienced blockchain portfolio analyst. Analyze the following Ethereum transaction history and return your response in **valid JSON** with exactly three keys: "summary", "metrics", and "charts".

- "summary": A witty, concise plain text summary of the transaction history, including insightful analysis and a playful roast.
- "metrics": An object containing key metrics with the following structure:
  {
    "totalTransactions": number,
    "totalValueSentETH": number,
    "highestTransaction": { "hash": string, "valueETH": number, "from": string, "to": string },
    "errorTransactionsCount": number,
    "averageGasPriceGwei": number
    // You may include additional useful metrics.
  }
- "charts": An object containing chart datasets with exactly these keys:
  - "lineChart": An object with keys "labels" (an array of date strings) and "data" (an array of numbers representing transaction values in ETH over time).
  - "pieChart": An object with keys "labels" (e.g., ["Success", "Error"]) and "data" (an array of two numbers representing the count of successful and error transactions).
  - "barChart": An object with keys "labels" (an array of date strings) and "data" (an array of numbers representing the average gas price in Gwei per day).

**Transaction Data:**
\`\`\`json
${JSON.stringify(transactions, null, 2)}
\`\`\`

Return only the JSON object with these three keys and no additional text.
  `;

  let analysisData = { summary: "", metrics: {}, charts: {} };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Adjust as needed.
      messages: [{ role: "system", content: prompt }],
      max_tokens: 1000,
    });

    let responseContent = response.choices[0].message?.content;
    if (responseContent) {
      // First, remove any markdown code fences (including those with a language specifier such as ```json)
      // This regex matches code fences and captures the content inside.
      const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
      const fenceMatch = fenceRegex.exec(responseContent);
      if (fenceMatch && fenceMatch[1]) {
        responseContent = fenceMatch[1];
      } else {
        // If no code fence is found, remove any stray backticks.
        responseContent = responseContent.replace(/`/g, "");
      }

      // Next, trim any extra text outside the JSON object.
      const jsonStart = responseContent.indexOf("{");
      const jsonEnd = responseContent.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        responseContent = responseContent.substring(jsonStart, jsonEnd + 1);
      }

      // Log the cleaned JSON for debugging purposes.
      console.log("Cleaned response content:", responseContent);

      // Now attempt to parse the cleaned JSON string.
      analysisData = JSON.parse(responseContent);
    } else {
      analysisData = {
        summary: "No analysis available.",
        metrics: {},
        charts: {},
      };
    }
  } catch (error) {
    console.error("Error in OpenAI analysis:", error);
    analysisData = {
      summary: "Error occurred while generating analysis.",
      metrics: {},
      charts: {},
    };
  }
  return analysisData;
};

const generateChartImage = async (chartConfig: any): Promise<Buffer> => {
  // Create a new QuickChart instance
  const qc = new QuickChart();
  qc.setConfig(chartConfig);
  qc.setWidth(600);
  qc.setHeight(400);
  qc.setBackgroundColor("white");

  // Get the chart URL
  const chartUrl = qc.getUrl();
  console.log("Generated Chart URL:", chartUrl);

  // Fetch the image data from QuickChart
  const response = await axios.get(chartUrl, { responseType: "arraybuffer" });
  return Buffer.from(response.data, "binary");
};

const generateCharts = async (chartsData: {
  lineChart: { labels: string[]; data: number[] };
  pieChart: { labels: string[]; data: number[] };
  barChart: { labels: string[]; data: number[] };
}): Promise<{ lineChart: Buffer; pieChart: Buffer; barChart: Buffer }> => {
  // Define the Chart.js configurations for each chart type.
  const lineChartConfig = {
    type: "line",
    data: {
      labels: chartsData.lineChart.labels,
      datasets: [
        {
          label: "Transaction Value (ETH)",
          data: chartsData.lineChart.data,
          borderColor: "rgba(75, 192, 192, 1)",
          fill: false,
        },
      ],
    },
  };

  const pieChartConfig = {
    type: "pie",
    data: {
      labels: chartsData.pieChart.labels,
      datasets: [
        {
          data: chartsData.pieChart.data,
          backgroundColor: ["#36A2EB", "#FF6384"],
        },
      ],
    },
  };

  const barChartConfig = {
    type: "bar",
    data: {
      labels: chartsData.barChart.labels,
      datasets: [
        {
          label: "Average Gas Price (Gwei)",
          data: chartsData.barChart.data,
          backgroundColor: "rgba(153, 102, 255, 0.6)",
        },
      ],
    },
  };

  // Generate each chart image
  const [lineChartImage, pieChartImage, barChartImage] = await Promise.all([
    generateChartImage(lineChartConfig),
    generateChartImage(pieChartConfig),
    generateChartImage(barChartConfig),
  ]);

  return {
    lineChart: lineChartImage,
    pieChart: pieChartImage,
    barChart: barChartImage,
  };
};

const generatePDFReport = async (
  summary: string,
  charts: { lineChart: Buffer; pieChart: Buffer; barChart: Buffer }
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ autoFirstPage: false });
      const buffers: Uint8Array[] = [];

      // Collect the PDF data in memory.
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // --- Page 1: Summary ---
      doc.addPage({ size: "A4", margin: 50 });
      doc.fontSize(18).text("Transaction Analysis Report", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(summary, { align: "left" });
      doc.moveDown(2);

      // --- Page 2: Line Chart ---
      doc.addPage({ size: "A4", margin: 50 });
      doc
        .fontSize(14)
        .text("Transaction Value Over Time (ETH)", { align: "center" });
      doc.moveDown();
      // Embed the line chart image. Adjust 'fit' dimensions as needed.
      doc.image(charts.lineChart, {
        fit: [500, 300],
        align: "center",
        valign: "center",
      });
      doc.moveDown(1);

      // --- Page 3: Pie Chart ---
      doc.addPage({ size: "A4", margin: 50 });
      doc
        .fontSize(14)
        .text("Transaction Outcomes (Success vs. Error)", { align: "center" });
      doc.moveDown();
      doc.image(charts.pieChart, {
        fit: [500, 300],
        align: "center",
        valign: "center",
      });
      doc.moveDown(1);

      // --- Page 4: Bar Chart ---
      doc.addPage({ size: "A4", margin: 50 });
      doc
        .fontSize(14)
        .text("Average Gas Price per Day (Gwei)", { align: "center" });
      doc.moveDown();
      doc.image(charts.barChart, {
        fit: [500, 300],
        align: "center",
        valign: "center",
      });
      doc.moveDown(1);

      // Finalize the PDF and end the stream.
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
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

  const analysis = await analyzeTransactions(history);

  const charts = await generateCharts(analysis.charts);

  const pdf = await generatePDFReport(analysis.summary, charts);

  console.log(`Signing and responding to task ${taskIndex}`);

  // Write the markdown output to a file
  // writeMarkdownReport(analysisMarkdown);

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
    "analysisMarkdown"
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

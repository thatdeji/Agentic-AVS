import { ethers } from "ethers";
import * as dotenv from "dotenv";
import axios from "axios";
import OpenAI from "openai";
import QuickChart from "quickchart-js";
import PDFDocument from "pdfkit";
import FormData from "form-data";
const fs = require("fs");
const path = require("path");
dotenv.config();

type ChartsData = {
  lineChart: { labels: string[]; data: number[] };
  pieChart: { labels: string[]; data: number[] };
  barChart: { labels: string[]; data: number[] };
  scatterChart: { labels: string[]; data: number[] };
  polarAreaChart: { labels: string[]; data: number[] };
  yieldChart: { labels: string[]; data: number[] };
  radarChart: { labels: string[]; data: number[] };
  candlestickChart: {
    labels: string[];
    open: number[];
    high: number[];
    low: number[];
    close: number[];
  };
};

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
You are an experienced blockchain portfolio analyst with decades of expertise in both blockchain analytics and financial risk assessment. Your task is to analyze the Ethereum transaction history provided below and return your response in valid JSON with exactly three top-level keys: "summary", "metrics", and "charts". Your analysis must be precise, accurate, and insightful—leaving no mistakes.
(For reference: "riskScore" is a number between 0 and 100 indicating risk, "creditScore" is a number between 0 and 100 for financial credibility, etc. while roi, annualizedReturn, maxDrawdown, and sharpeRatio are percentages.)

Requirements:

1. "summary":
   - Provide a witty, concise plain text summary of the transaction history.
   - Include insightful analysis, key trends, anomalies, and a playful roast.
   - Offer predictions regarding potential future trends or performance.
   - Highlight portfolio yield performance, risk management, and areas for optimization.
   - Provide actionable recommendations and potential areas of improvement.
   - Capture the overall narrative in a manner that is both entertaining and informative.

2. "metrics":
   - An object containing key metrics. It must include the following properties:
       - "totalTransactions": number,
       - "totalValueSentETH": number,
       - "highestTransaction": an object with:
             - "hash": string,
             - "valueETH": number,
             - "from": string,
             - "to": string,
       - "errorTransactionsCount": number,
       - "averageGasPriceGwei": number,
       - "riskScore": number,
       - "creditScore": number,
       - "volatilityScore": number,
       - "engagementScore": number,
       - "frequencyScore": number,
       - "liquidityScore": number,
       - "roi": number,
       - "annualizedReturn": number,
       - "maxDrawdown": number,
       - "sharpeRatio": number,
   - Also include an optional "additionalMetrics" field, which is an object that can include further metrics.

3. "charts":
   - An object containing datasets for visualization. It must include exactly these keys:
       - "lineChart": an object with:
             - "labels": an array of date strings (time intervals),
             - "data": an array of numbers representing transaction values in ETH over time.
       - "pieChart": an object with:
             - "labels": an array of two strings, e.g., ["Success", "Error"],
             - "data": an array of two numbers representing the count of successful versus error transactions.
       - "barChart": an object with:
             - "labels": an array of date strings,
             - "data": an array of numbers representing the average gas price in Gwei per day.
       - "scatterChart": an object with:
             - "labels": an array of date strings,
             - "data": an array of numbers representing transaction values.
       - "polarAreaChart": an object with:
             - "labels": an array of category strings,
             - "data": an array of numbers.
       - "yieldChart": an object with:
             - "labels": an array of date strings,
             - "data": an array of numbers representing portfolio yield percentages over time.
       - "candlestickChart": an object with:
             - "labels": an array of date strings,
             - "open": an array of numbers,
             - "high": an array of numbers,
             - "low": an array of numbers,
             - "close": an array of numbers.
       - "radarChart": an object with:
             - "labels": an array of metric names,
             - "data": an array of numbers representing performance across multiple dimensions.
   - Also include an optional "additionalCharts" field, which is an object containing further chart datasets.

**Transaction Data:**
\`\`\`json
${JSON.stringify(transactions, null, 2)}
\`\`\`

Return only the JSON object with exactly these three keys ("summary", "metrics", "charts") and no additional text or markdown formatting.
  `;

  let analysisData = { summary: "", metrics: {}, charts: {} };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 2000, // Increased token limit
    });

    let responseContent = response.choices[0].message?.content;
    if (responseContent) {
      // Remove markdown code fences if present.
      const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
      const fenceMatch = fenceRegex.exec(responseContent);
      if (fenceMatch && fenceMatch[1]) {
        responseContent = fenceMatch[1];
      } else {
        // Remove inline comments (anything starting with // until a newline)
        responseContent = responseContent.replace(/\/\/.*(?=\n)/g, "");
      }

      // Trim any extra text outside the JSON object.
      const jsonStart = responseContent.indexOf("{");
      const jsonEnd = responseContent.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        responseContent = responseContent.substring(jsonStart, jsonEnd + 1);
      }

      console.log("Cleaned response content:", responseContent);

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
  qc.setVersion("3.9.1");

  // Get the chart URL
  const chartUrl = qc.getUrl();
  console.log("Generated Chart URL:", chartUrl);

  // Fetch the image data from QuickChart
  const response = await axios.get(chartUrl, { responseType: "arraybuffer" });
  return Buffer.from(response.data, "binary");
};

const generateCharts = async (
  chartsData: ChartsData
): Promise<{
  lineChart: Buffer;
  pieChart: Buffer;
  barChart: Buffer;
  scatterChart: Buffer;
  polarAreaChart: Buffer;
  yieldChart: Buffer;
  radarChart: Buffer;
  candlestickChart?: Buffer;
}> => {
  // Line Chart configuration
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

  // Pie Chart configuration
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

  // Bar Chart configuration
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

  // Scatter Chart configuration
  // Convert each label and corresponding data point into an {x, y} object.
  const scatterDataPoints = chartsData.scatterChart.data.map((value, i) => ({
    x: chartsData.scatterChart.labels[i],
    y: value,
  }));
  const scatterChartConfig = {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Scatter Chart",
          data: scatterDataPoints,
          backgroundColor: "rgba(255, 99, 132, 1)",
        },
      ],
    },
    options: {
      scales: {
        x: {
          type: "time", // Assumes your labels are date strings
          time: {
            unit: "day",
          },
        },
      },
    },
  };

  // Polar Area Chart configuration
  const polarAreaChartConfig = {
    type: "polarArea",
    data: {
      labels: chartsData.polarAreaChart.labels,
      datasets: [
        {
          data: chartsData.polarAreaChart.data,
          backgroundColor: [
            "rgba(255, 99, 132, 0.6)",
            "rgba(54, 162, 235, 0.6)",
            "rgba(255, 206, 86, 0.6)",
            "rgba(75, 192, 192, 0.6)",
            "rgba(153, 102, 255, 0.6)",
            "rgba(255, 159, 64, 0.6)",
          ],
        },
      ],
    },
  };

  // Yield Chart configuration (using a line chart to represent yield percentages)
  const yieldChartConfig = {
    type: "line",
    data: {
      labels: chartsData.yieldChart.labels,
      datasets: [
        {
          label: "Portfolio Yield (%)",
          data: chartsData.yieldChart.data,
          borderColor: "rgba(255, 205, 86, 1)",
          fill: false,
        },
      ],
    },
  };

  // Radar Chart configuration
  const radarChartConfig = {
    type: "radar",
    data: {
      labels: chartsData.radarChart.labels,
      datasets: [
        {
          label: "Performance Metrics",
          data: chartsData.radarChart.data,
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderColor: "rgba(75, 192, 192, 1)",
        },
      ],
    },
  };

  // Candlestick Chart configuration
  const candlestickData = chartsData.candlestickChart.labels.map(
    (label, i) => ({
      o: chartsData.candlestickChart.open[i],
      h: chartsData.candlestickChart.high[i],
      l: chartsData.candlestickChart.low[i],
      c: chartsData.candlestickChart.close[i],
    })
  );
  const candlestickChartConfig = {
    type: "candlestick",
    data: {
      labels: chartsData.candlestickChart.labels,
      datasets: [
        {
          label: "Candlestick Chart",
          data: candlestickData,
        },
      ],
    },
  };

  // Generate chart images concurrently using your helper function.
  const [
    lineChartImage,
    pieChartImage,
    barChartImage,
    scatterChartImage,
    polarAreaChartImage,
    yieldChartImage,
    radarChartImage,
    candlestickChartImage,
  ] = await Promise.all([
    generateChartImage(lineChartConfig),
    generateChartImage(pieChartConfig),
    generateChartImage(barChartConfig),
    generateChartImage(scatterChartConfig),
    generateChartImage(polarAreaChartConfig),
    generateChartImage(yieldChartConfig),
    generateChartImage(radarChartConfig),
    generateChartImage(candlestickChartConfig),
  ]);

  return {
    lineChart: lineChartImage,
    pieChart: pieChartImage,
    barChart: barChartImage,
    scatterChart: scatterChartImage,
    polarAreaChart: polarAreaChartImage,
    yieldChart: yieldChartImage,
    radarChart: radarChartImage,
    candlestickChart: candlestickChartImage,
  };
};

type ChartsDataBuffers = {
  lineChart: Buffer;
  pieChart: Buffer;
  barChart: Buffer;
  scatterChart?: Buffer;
  polarAreaChart?: Buffer;
  yieldChart?: Buffer;
  radarChart?: Buffer;
  candlestickChart?: Buffer;
};

const generatePDFReport = async (
  summary: string,
  metrics: any,
  charts: ChartsDataBuffers
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ autoFirstPage: false });
      const buffers: Uint8Array[] = [];

      // Collect PDF data into buffers
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // --- Page 1: Summary and Metrics ---
      doc.addPage({ size: "A4", margin: 50 });
      doc.fontSize(18).text("Transaction Analysis Report", { align: "center" });
      doc.moveDown();

      // Summary text
      doc.fontSize(12).text(summary, { align: "left" });
      doc.moveDown();

      // Render metrics in a simple tabular form
      doc.fontSize(14).text("Key Metrics:", { underline: true });
      doc.moveDown(0.5);
      // For each metric, display key and value on the same line
      Object.entries(metrics).forEach(([key, value]) => {
        doc.font("Helvetica-Bold").text(`${key}: `, { continued: true });
        doc.font("Helvetica").text(`${value}`);
      });
      doc.moveDown(2);

      // --- Page 2: Line Chart ---
      if (charts.lineChart) {
        doc.addPage({ size: "A4", margin: 50 });
        doc
          .fontSize(14)
          .text("Transaction Value Over Time (ETH)", { align: "center" });
        doc.moveDown();
        doc.image(charts.lineChart, {
          fit: [500, 300],
          align: "center",
          valign: "center",
        });
        doc.moveDown(1);
      }

      // --- Page 3: Pie Chart ---
      if (charts.pieChart) {
        doc.addPage({ size: "A4", margin: 50 });
        doc.fontSize(14).text("Transaction Outcomes (Success vs. Error)", {
          align: "center",
        });
        doc.moveDown();
        doc.image(charts.pieChart, {
          fit: [500, 300],
          align: "center",
          valign: "center",
        });
        doc.moveDown(1);
      }

      // --- Page 4: Bar Chart ---
      if (charts.barChart) {
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
      }

      // --- Page 5: Scatter Chart ---
      if (charts.scatterChart) {
        doc.addPage({ size: "A4", margin: 50 });
        doc
          .fontSize(14)
          .text("Scatter Chart of Transaction Values", { align: "center" });
        doc.moveDown();
        doc.image(charts.scatterChart, {
          fit: [500, 300],
          align: "center",
          valign: "center",
        });
        doc.moveDown(1);
      }

      // --- Page 6: Polar Area Chart ---
      if (charts.polarAreaChart) {
        doc.addPage({ size: "A4", margin: 50 });
        doc.fontSize(14).text("Polar Area Chart", { align: "center" });
        doc.moveDown();
        doc.image(charts.polarAreaChart, {
          fit: [500, 300],
          align: "center",
          valign: "center",
        });
        doc.moveDown(1);
      }

      // --- Page 7: Yield Chart ---
      if (charts.yieldChart) {
        doc.addPage({ size: "A4", margin: 50 });
        doc.fontSize(14).text("Portfolio Yield Over Time", { align: "center" });
        doc.moveDown();
        doc.image(charts.yieldChart, {
          fit: [500, 300],
          align: "center",
          valign: "center",
        });
        doc.moveDown(1);
      }

      // --- Page 8: Radar Chart ---
      if (charts.radarChart) {
        doc.addPage({ size: "A4", margin: 50 });
        doc.fontSize(14).text("Performance Radar Chart", { align: "center" });
        doc.moveDown();
        doc.image(charts.radarChart, {
          fit: [500, 300],
          align: "center",
          valign: "center",
        });
        doc.moveDown(1);
      }

      // --- Page 9: Candlestick Chart ---
      if (charts.candlestickChart) {
        doc.addPage({ size: "A4", margin: 50 });
        doc.fontSize(14).text("Candlestick Chart", { align: "center" });
        doc.moveDown();
        doc.image(charts.candlestickChart, {
          fit: [500, 300],
          align: "center",
          valign: "center",
        });
        doc.moveDown(1);
      }

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const uploadToIPFSWithPinata = async (pdfBuffer: Buffer): Promise<string> => {
  const formData = new FormData();
  formData.append("file", pdfBuffer, {
    filename: "report.pdf",
    contentType: "application/pdf",
  });

  // Replace with your Pinata API credentials
  const PINATA_API_KEY = process.env.PINATA_API_KEY;
  const PINATA_API_SECRET = process.env.PINATA_API_SECRET;

  if (!PINATA_API_KEY || !PINATA_API_SECRET) {
    throw new Error("Pinata API credentials are missing.");
  }

  try {
    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          ...formData.getHeaders(),
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_API_SECRET,
        },
      }
    );

    if (response.data && response.data.IpfsHash) {
      return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error("IPFS upload via Pinata failed:", error);
    throw error;
  }
};

const uploadBufferToPinata = async (
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<{ url: string; hash: string }> => {
  const formData = new FormData();
  formData.append("file", buffer, { filename, contentType });

  const PINATA_API_KEY = process.env.PINATA_API_KEY;
  const PINATA_API_SECRET = process.env.PINATA_API_SECRET;
  if (!PINATA_API_KEY || !PINATA_API_SECRET) {
    throw new Error("Pinata API credentials are missing.");
  }

  // Create basic authentication header
  const auth = Buffer.from(`${PINATA_API_KEY}:${PINATA_API_SECRET}`).toString(
    "base64"
  );

  try {
    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          ...formData.getHeaders(),
          Authorization: `Basic ${auth}`,
        },
      }
    );
    if (response.data && response.data.IpfsHash) {
      const ipfsHash = response.data.IpfsHash;
      const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
      return { url, hash: ipfsHash };
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error("Error uploading image to Pinata:", error);
    throw error;
  }
};

const generateWrappedImage = async (
  transactionJSON: any
): Promise<{ url: string }> => {
  const prompt = `
You are a creative blockchain portfolio analyst. Generate a clean, minimal, and eye-catching "Spotify Wrapped"-style image that summarizes the following Ethereum transaction history. The design should have basic flat colors and simple visual elements:
- Use simple cards to display key metrics such as total transactions, total ETH transferred, highest transaction details, risk score, and credit score.
- Include basic charts or icons that represent transaction volume and other key trends.
- Use clear, plain text labels and minimalistic design (no crazy colors or overly complex graphics).
  
Transaction Data:
${transactionJSON}
  `;

  try {
    // Call OpenAI's image generation API (DALL-E 3)
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024", // Adjust the size as needed
      response_format: "url",
    });

    // Extract the image URL from the response.
    const imageUrl = imageResponse.data[0].url;
    console.log("Generated image URL from OpenAI:", imageUrl);

    return { url: imageUrl ?? "" };
  } catch (error) {
    console.error("Error generating or uploading the image:", error);
    throw error;
  }
};

const uploadJSONToPinata = async (
  jsonData: any
): Promise<{ url: string; hash: string }> => {
  const PINATA_API_KEY = process.env.PINATA_API_KEY;
  const PINATA_API_SECRET = process.env.PINATA_API_SECRET;

  if (!PINATA_API_KEY || !PINATA_API_SECRET) {
    throw new Error("Pinata API credentials are missing.");
  }

  try {
    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      jsonData,
      {
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_API_SECRET,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.IpfsHash) {
      const ipfsHash = response.data.IpfsHash;
      const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
      return { url, hash: ipfsHash };
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error("Error uploading JSON to Pinata:", error);
    throw error;
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

  const imageUploadResult = await generateWrappedImage(
    JSON.stringify(analysis)
  );

  console.log("Final Image URL on IPFS:", imageUploadResult.url);

  const charts = await generateCharts(analysis.charts);

  const pdfBuffer = await generatePDFReport(
    analysis.summary,
    analysis.metrics,
    charts
  );

  const pdfUrl = await uploadToIPFSWithPinata(pdfBuffer);

  const uploadResult = await uploadJSONToPinata({
    ...analysis,
    imageURL: imageUploadResult.url,
    pdfUrl: pdfUrl,
  });

  console.log("Uploaded JSON is available at:", uploadResult.url);
  console.log("IPFS Hash:", uploadResult.hash);

  // console.log("Uploaded PDF is available at:", pdfUrl);

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
    uploadResult.hash
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

import axios from "axios";
import FormData from "form-data";
import * as dotenv from "dotenv";

dotenv.config();

export const uploadToIPFSWithPinata = async (
  pdfBuffer: Buffer
): Promise<string> => {
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

export const uploadBufferToPinata = async (
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

export const uploadJSONToPinata = async (
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

export const fetchTransactionHistory = async (walletAdress: string) => {
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

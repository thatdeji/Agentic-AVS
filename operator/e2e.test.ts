import { createAnvil, Anvil } from "@viem/anvil";
import { describe, beforeAll, afterAll, it, expect } from "@jest/globals";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import util from "util";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const execAsync = util.promisify(exec);

async function loadJsonFile(filePath: string): Promise<any> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading file ${filePath}:`, error);
    return null;
  }
}

async function loadDeployments(): Promise<Record<string, any>> {
  const coreFilePath = path.join(
    __dirname,
    "..",
    "contracts",
    "deployments",
    "core",
    "31337.json"
  );
  const analysisFilePath = path.join(
    __dirname,
    "..",
    "contracts",
    "deployments",
    "analysis",
    "31337.json"
  );

  const [coreDeployment, analysisDeployment] = await Promise.all([
    loadJsonFile(coreFilePath),
    loadJsonFile(analysisFilePath),
  ]);

  if (!coreDeployment || !analysisDeployment) {
    console.error("Error loading deployments");
    return {};
  }

  return {
    core: coreDeployment,
    analysis: analysisDeployment,
  };
}

describe("Operator Functionality", () => {
  let anvil: Anvil;
  let deployment: Record<string, any>;
  let provider: ethers.JsonRpcProvider;
  let signer: ethers.Wallet;
  let delegationManager: ethers.Contract;
  let analysisServiceManager: ethers.Contract;
  let ecdsaRegistryContract: ethers.Contract;
  let avsDirectory: ethers.Contract;

  beforeAll(async () => {
    anvil = createAnvil();
    await anvil.start();
    await execAsync("npm run deploy:core");
    await execAsync("npm run deploy:analysis");
    deployment = await loadDeployments();

    provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

    const delegationManagerABI = await loadJsonFile(
      path.join(__dirname, "..", "abis", "IDelegationManager.json")
    );
    const ecdsaRegistryABI = await loadJsonFile(
      path.join(__dirname, "..", "abis", "ECDSAStakeRegistry.json")
    );
    const analysisServiceManagerABI = await loadJsonFile(
      path.join(__dirname, "..", "abis", "AnalysisServiceManager.json")
    );
    const avsDirectoryABI = await loadJsonFile(
      path.join(__dirname, "..", "abis", "IAVSDirectory.json")
    );

    delegationManager = new ethers.Contract(
      deployment.core.addresses.delegation,
      delegationManagerABI,
      signer
    );
    analysisServiceManager = new ethers.Contract(
      deployment.analysis.addresses.analysisServiceManager,
      analysisServiceManagerABI,
      signer
    );
    ecdsaRegistryContract = new ethers.Contract(
      deployment.analysis.addresses.stakeRegistry,
      ecdsaRegistryABI,
      signer
    );
    avsDirectory = new ethers.Contract(
      deployment.core.addresses.avsDirectory,
      avsDirectoryABI,
      signer
    );
  });

  it("should register as an operator", async () => {
    const tx = await delegationManager.registerAsOperator(
      {
        __deprecated_earningsReceiver: await signer.getAddress(),
        delegationApprover: "0x0000000000000000000000000000000000000000",
        stakerOptOutWindowBlocks: 0,
      },
      ""
    );
    await tx.wait();

    const isOperator = await delegationManager.isOperator(signer.address);
    expect(isOperator).toBe(true);
  });

  it("should register operator to AVS", async () => {
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const expiry = Math.floor(Date.now() / 1000) + 3600;

    const operatorDigestHash =
      await avsDirectory.calculateOperatorAVSRegistrationDigestHash(
        signer.address,
        await analysisServiceManager.getAddress(),
        salt,
        expiry
      );

    const operatorSigningKey = new ethers.SigningKey(process.env.PRIVATE_KEY!);
    const operatorSignedDigestHash =
      operatorSigningKey.sign(operatorDigestHash);
    const operatorSignature = ethers.Signature.from(
      operatorSignedDigestHash
    ).serialized;

    const tx = await ecdsaRegistryContract.registerOperatorWithSignature(
      {
        signature: operatorSignature,
        salt: salt,
        expiry: expiry,
      },
      signer.address
    );
    await tx.wait();

    const isRegistered = await ecdsaRegistryContract.operatorRegistered(
      signer.address
    );
    expect(isRegistered).toBe(true);
  });

  it("should create a new task", async () => {
    const taskName = "Steven";

    const tx = await analysisServiceManager.createNewTask(taskName);
    await tx.wait();
  });

  it("should sign and respond to a task", async () => {
    const taskIndex = 0;
    const taskCreatedBlock = await provider.getBlockNumber();
    const taskName = "Steven";
    const message = `Hello, ${taskName}`;
    const messageHash = ethers.solidityPackedKeccak256(["string"], [message]);
    const messageBytes = ethers.getBytes(messageHash);
    const signature = await signer.signMessage(messageBytes);

    const operators = [await signer.getAddress()];
    const signatures = [signature];
    const signedTask = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address[]", "bytes[]", "uint32"],
      [operators, signatures, ethers.toBigInt(taskCreatedBlock)]
    );

    const tx = await analysisServiceManager.respondToTask(
      { name: taskName, taskCreatedBlock: taskCreatedBlock },
      taskIndex,
      signedTask
    );
    await tx.wait();
  });

  afterAll(async () => {
    await anvil.stop();
  });
});

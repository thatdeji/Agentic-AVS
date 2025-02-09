# EigenLayer AVS Operator & Transaction Analysis Agent
# This repo uses the [Hello World AVS](https://github.com/Layr-Labs/hello-world-avs/tree/master) template

This project is an agent built for the Agentic Ethereum Hackathon under EigenLayer AVS. The agent:

- **Fetches Ethereum transaction history** for a given wallet using the Etherscan API.
- **Analyzes transactions** using the OpenAI GPT-4 model.
- **Interacts with EigenLayer contracts** to register as an operator, monitor new tasks, and respond to them.
- **Report Generation** Generates engaging markdown with fun (even roast-style) commentary based on the analysis.

## Features

- **Transaction History Fetching:**  
  Retrieves up to 500 transactions for a given wallet from the Sepolia network using Etherscan.

- **AI-Powered Analysis:**  
  Sends the transaction data to OpenAI (using GPT-4) for analysis, which returns insights on common patterns, suspicious activities, high-value transactions, unusual gas usage, and humorous commentary.

- **EigenLayer Integration:**  
  Registers the operator with EigenLayer, monitors for new tasks, and responds to them with a signed message.

- **Future Enhancements:**
  - Generate PDF reports using `pdfkit`.
  - Create dynamic charts with `chart.js` and `canvas`.
  - Provide colorful and playful insights/roasts to the end user.

## Prerequisites

- **Node.js** (v14 or later)
- **npm** or **Yarn**
- **TypeScript** (if not installed globally, it’s included in your project dependencies)
- **Smart Contract Deployment Files:**  
  Ensure you have the deployment JSON files under the folders:
  - `../contracts/deployments/analysis/`
  - `../contracts/deployments/core/`
- **Environment Variables:**  
  You will need to set up:
  - `RPC_URL` — Your Ethereum RPC endpoint (e.g., Sepolia)
  - `PRIVATE_KEY` — The private key for signing transactions
  - `ETHERSCAN_API_KEY` — Your Etherscan API key
  - `OPEN_AI_KEY` — Your OpenAI API key

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/thatdeji/agentic-avs.git
   cd agentic-avs
   ```

2. **Install Dependencies:**

Using npm:

```
npm install
```

Or using Yarn:

```
yarn install
```

## Usage

### Start Anvil Chain

### In terminal window #1, execute the following commands:

```
# Start local anvil chain
npm run start:anvil
```

## Deploy Contracts and Start Operator

### Open a separate terminal window #2, execute the following commands

```
# Setup .env file

cp .env.example .env
cp contracts/.env.example contracts/.env

# Updates dependencies if necessary and builds the contracts

npm run build

# Deploy the EigenLayer contracts

npm run deploy:core

# Deploy the Hello World AVS contracts

npm run deploy:analysis

# (Optional) Update ABIs

npm run extract:abis

# Start the Operator application

npm run start:operator
```

## Create the Analysis Tasks

Open a separate terminal window #3, execute the following commands

```
# Start the createNewTasks application

npm run start:traffic
```

# Customization

## OpenAI Prompt

You can adjust the prompt in the analyzeTransactions() function to modify the insights and tone of the analysis. For example, you can add fun commentary or roast-style remarks.

## Contributing

Contributions and feedback are welcome! Please open an issue or submit a pull request if you have suggestions or improvements.

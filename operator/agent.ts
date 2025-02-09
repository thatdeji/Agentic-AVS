import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const analyzeTransactions = async (dataToAnalyze: {
  transactions: any[];
  uniswapData: any;
  hopData: any;
  ensData: any;
}): Promise<{ summary: string; metrics: any; charts: any }> => {
  const prompt = `
You are an experienced blockchain portfolio analyst with decades of expertise in both blockchain analytics and financial risk assessment. Your task is to analyze the Ethereum transaction history and additional on-chain data provided below and return your response in valid JSON with exactly three top-level keys: "summary", "metrics", and "charts". Your analysis must be precise, accurate, and insightful—leaving no mistakes.
(For reference: "riskScore" is a number between 0 and 100 indicating risk, "creditScore" is a number between 0 and 100 for financial credibility, etc. while roi, annualizedReturn, maxDrawdown, and sharpeRatio are percentages.)

Requirements:

1. "summary":
   - Provide a witty, concise plain text summary of the provided data.
   - Address the user using their ENS domain if available (e.g., "Hello, [ensDomain]!").
   - Include insightful analysis, key trends, anomalies, and a playful roast.
   - Offer predictions regarding potential future trends or performance.
   - Highlight portfolio yield performance, risk management, and areas for optimization.
   - Provide actionable recommendations and potential areas of improvement.
   - Capture the overall narrative in a manner that is both entertaining and informative.

2. "metrics":
   - An object containing key metrics. It must include the following properties:
         - "totalTransactions": number,
         - "totalValueSentETH": number,
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
         - "uniswapSwapVolumeUSD": number,
         - "numberOfSwaps": number,
         - "averageSwapSizeETH": number,
         - "hopBridgeVolumeUSD": number,
         - "numberOfBridges": number,
         - "averageBridgeSize": number,
         - "ensDomainCount": number,
         - "highestTransaction": an object with:
               - "hash": string,
               - "valueETH": number,
               - "from": string,
               - "to": string,
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
         - "uniswapVolumeChart": an object with:
               - "labels": an array of date strings,
               - "data": an array of numbers representing daily Uniswap swap volume in USD.
         - "hopBridgeChart": an object with:
               - "labels": an array of date strings,
               - "data": an array of numbers representing daily Hop Protocol transfer volume in USD.
   - Also include an optional "additionalCharts" field, which is an object containing further chart datasets if needed.

**Data to Analyze:**
\`\`\`json
${JSON.stringify(dataToAnalyze, null, 2)}
\`\`\`

Return only the JSON object with exactly these three keys ("summary", "metrics", "charts") and no additional text or markdown formatting.
  `;

  let analysisData = { summary: "", metrics: {}, charts: {} };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 2000,
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

export const generateWrappedImage = async (
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

    const imageUrl = imageResponse.data[0].url;
    console.log("Generated image URL from OpenAI:", imageUrl);

    return { url: imageUrl ?? "" };
  } catch (error) {
    console.error("Error generating or uploading the image:", error);
    throw error;
  }
};

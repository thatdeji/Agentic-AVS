import axios from "axios";
import QuickChart from "quickchart-js";
import PDFDocument from "pdfkit";
import * as dotenv from "dotenv";

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

type ChartsDataBuffers = {
  lineChart: Buffer;
  pieChart: Buffer;
  barChart: Buffer;
  scatterChart?: Buffer;
  polarAreaChart?: Buffer;
  yieldChart?: Buffer;
  radarChart?: Buffer;
  candlestickChart?: Buffer;
  uniswapVolumeChart?: Buffer;
  hopBridgeChart?: Buffer;
};

export const generateChartImage = async (chartConfig: any): Promise<Buffer> => {
  const qc = new QuickChart();
  qc.setConfig(chartConfig);
  qc.setWidth(600);
  qc.setHeight(400);
  qc.setBackgroundColor("white");
  qc.setVersion("3.9.1");

  const chartUrl = qc.getUrl();
  console.log("Generated Chart URL:", chartUrl);

  const response = await axios.get(chartUrl, { responseType: "arraybuffer" });
  return Buffer.from(response.data, "binary");
};

export const generateCharts = async (
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
  uniswapVolumeChart?: Buffer;
  hopBridgeChart?: Buffer;
}> => {
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

  const hopBridgeChartConfig = {
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

  const uniswapChartConfig = {
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
          type: "time",
          time: {
            unit: "day",
          },
        },
      },
    },
  };

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

  const [
    lineChartImage,
    pieChartImage,
    barChartImage,
    scatterChartImage,
    polarAreaChartImage,
    yieldChartImage,
    radarChartImage,
    candlestickChartImage,
    hopBridgeChartImage,
    uniswapChartImage,
  ] = await Promise.all([
    generateChartImage(lineChartConfig),
    generateChartImage(pieChartConfig),
    generateChartImage(barChartConfig),
    generateChartImage(scatterChartConfig),
    generateChartImage(polarAreaChartConfig),
    generateChartImage(yieldChartConfig),
    generateChartImage(radarChartConfig),
    generateChartImage(candlestickChartConfig),
    generateChartImage(hopBridgeChartConfig),
    generateChartImage(uniswapChartConfig),
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
    hopBridgeChart: hopBridgeChartImage,
    uniswapVolumeChart: uniswapChartImage,
  };
};

export const generatePDFReport = async (
  summary: string,
  metrics: any,
  charts: ChartsDataBuffers
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ autoFirstPage: false });
      const buffers: Uint8Array[] = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Page 1: Summary and Metrics
      doc.addPage({ size: "A4", margin: 50 });
      doc.fontSize(18).text("Transaction Analysis Report", { align: "center" });
      doc.moveDown();

      // Summary text
      doc.fontSize(12).text(summary, { align: "left" });
      doc.moveDown();

      // Render metrics in a simple tabular form
      doc.fontSize(14).text("Key Metrics:", { underline: true });
      doc.moveDown(0.5);
      Object.entries(metrics).forEach(([key, value]) => {
        doc.font("Helvetica-Bold").text(`${key}: `, { continued: true });
        doc.font("Helvetica").text(`${value}`);
      });
      doc.moveDown(2);

      //  Page 2: Line Chart
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

      //  Page 3: Pie Chart
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

      //  Page 4: Bar Chart
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

      //  Page 5: Scatter Chart
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

      // Page 6: Polar Area Chart
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

      //  Page 7: Yield Chart
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

      //  Page 8: Radar Chart
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

      //  Page 9: Candlestick Chart
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

      //  Page 10: Hop Bridge Chart
      if (charts.hopBridgeChart) {
        doc.addPage({ size: "A4", margin: 50 });
        doc
          .fontSize(14)
          .text("Hop Bridge Transfer Volume", { align: "center" });
        doc.moveDown();
        doc.image(charts.hopBridgeChart, {
          fit: [500, 300],
          align: "center",
          valign: "center",
        });
        doc.moveDown(1);
      }

      //  Page 11: Uniswap Volume Chart
      if (charts.uniswapVolumeChart) {
        doc.addPage({ size: "A4", margin: 50 });
        doc.fontSize(14).text("Uniswap Swap Volume", { align: "center" });
        doc.moveDown();
        doc.image(charts.uniswapVolumeChart, {
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

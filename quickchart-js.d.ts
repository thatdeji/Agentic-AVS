declare module "quickchart-js" {
  export default class QuickChart {
    setConfig(config: any): QuickChart;
    setWidth(width: number): QuickChart;
    setHeight(height: number): QuickChart;
    setBackgroundColor(color: string): QuickChart;
    setVersion(version: string): QuickChart;
    getUrl(): string;
  }
}

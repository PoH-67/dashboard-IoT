export type WidgetType = "switch" | "slider" | "label" | "table" | "image" | "chart" | "video";

export interface Datastream {
  pin: string; // e.g. "V0", "V1", "V2"
  name: string;
  displayName?: string;
  type: "Integer" | "Double" | "Enum" | "String";
  min: number;
  max: number;
  decimals?: string;
  defaultValue?: string | number;
  color?: string;
  icon?: string;
  semantic?: string;
  unit?: string;
  useScaling?: boolean;
  rawMin?: number;
  rawMax?: number;
  scaledMin?: number;
  scaledMax?: number;
  value?: number | string;
}

export interface CanvasWidget {
  id: string;
  type: WidgetType;
  title: string;
  deviceId?: string; // If in dashboard, which device it connects to
  vpin?: string;     // Virtual pin key, e.g. "V0", "V1" - optional until configured
  colSpan?: number;  // 1, 2, or 3
  unit?: string;
  min?: number;
  max?: number;
  value?: number | string;
}

export interface DeviceItem {
  id: string;
  name: string;
  type: string;
  authToken: string;
  owner: string;
  status: "online" | "offline";
  lastSeen: number | null;
  createdAt: number | null;
  datastreams?: Record<string, Datastream>;
  widgets?: CanvasWidget[];
}

export interface DashboardItem {
  id: string;
  name: string;
  createdAt: number;
  widgets?: CanvasWidget[];
}

export const DATASTREAM_SUGGESTIONS = [
  { name: "State control", type: "Integer", min: 0, max: 1, unit: "" },
  { name: "Automation Scenario JSON", type: "String", min: 0, max: 100, unit: "" },
  { name: "Automation Status", type: "Integer", min: 0, max: 1, unit: "" },
  { name: "Free Memory", type: "Integer", min: 0, max: 100000, unit: "kb" },
  { name: "Last Seen Timestamp", type: "Integer", min: 0, max: 2147483647, unit: "s" },
  { name: "Mode Display", type: "String", min: 0, max: 100, unit: "" },
  { name: "Operating State", type: "Integer", min: 0, max: 5, unit: "" },
  { name: "Sensor Status", type: "Integer", min: 0, max: 1, unit: "" },
  { name: "Status", type: "String", min: 0, max: 100, unit: "" },
  { name: "Sensor", type: "Double", min: 0, max: 100, unit: "" },
  { name: "Air Pollution", type: "Double", min: 0, max: 500, unit: "AQI" },
  { name: "Altitude", type: "Double", min: 0, max: 5000, unit: "m" },
  { name: "Battery Capacity", type: "Integer", min: 0, max: 100000, unit: "mA" },
  { name: "Battery Level", type: "Integer", min: 0, max: 100, unit: "%" },
  { name: "CPU Temperature", type: "Double", min: 0, max: 100, unit: "°C" },
];

export const AVAILABLE_VIRTUAL_PINS = Array.from({ length: 256 }, (_, i) => `V${i}`);

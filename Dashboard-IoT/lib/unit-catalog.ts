// Unit catalog, grouped like the Blynk.Console "Units" picker:
// Category -> (optional) system subgroup (Imperial / Metric) -> units.

export interface UnitOption {
  name: string;   // e.g. "Centimeter"
  symbol: string; // e.g. "cm"
}

export interface UnitSubgroup {
  label?: string; // e.g. "Imperial" | "Metric" (omit when the category has no subgroups)
  units: UnitOption[];
}

export interface UnitCategory {
  category: string; // e.g. "Length, Distance"
  groups: UnitSubgroup[];
}

export const UNIT_CATALOG: UnitCategory[] = [
  {
    category: "Length, Distance",
    groups: [
      {
        label: "Imperial",
        units: [
          { name: "Inch", symbol: "in" },
          { name: "Foot", symbol: "ft" },
          { name: "Yard", symbol: "yd" },
          { name: "Mile", symbol: "mi" },
          { name: "Square Feet", symbol: "sq ft" },
        ],
      },
      {
        label: "Metric",
        units: [
          { name: "Millimeter", symbol: "mm" },
          { name: "Centimeter", symbol: "cm" },
          { name: "Meter", symbol: "m" },
          { name: "Square Meter", symbol: "m²" },
          { name: "Kilometer", symbol: "km" },
        ],
      },
    ],
  },
  {
    category: "Mass",
    groups: [
      {
        label: "Imperial",
        units: [
          { name: "Ounce", symbol: "oz" },
          { name: "Pound", symbol: "lb" },
          { name: "Stone", symbol: "st" },
          { name: "Quarter", symbol: "qrt" },
          { name: "Hundredweight", symbol: "cwt" },
          { name: "Ton", symbol: "t" },
        ],
      },
      {
        label: "Metric",
        units: [
          { name: "Milligram", symbol: "mg" },
          { name: "Gram", symbol: "g" },
          { name: "Kilogram", symbol: "kg" },
          { name: "Metric Ton", symbol: "t" },
        ],
      },
    ],
  },
  {
    category: "Volume",
    groups: [
      {
        label: "Imperial",
        units: [
          { name: "Fluid Ounce", symbol: "fl oz" },
          { name: "Pint", symbol: "pt" },
          { name: "Quart", symbol: "qt" },
          { name: "Gallon", symbol: "gal" },
          { name: "Cubic Foot", symbol: "ft³" },
        ],
      },
      {
        label: "Metric",
        units: [
          { name: "Milliliter", symbol: "mL" },
          { name: "Liter", symbol: "L" },
          { name: "Cubic Meter", symbol: "m³" },
        ],
      },
    ],
  },
  {
    category: "Temperature",
    groups: [
      {
        units: [
          { name: "Celsius", symbol: "°C" },
          { name: "Fahrenheit", symbol: "°F" },
          { name: "Kelvin", symbol: "K" },
        ],
      },
    ],
  },
  {
    category: "Speed",
    groups: [
      {
        label: "Imperial",
        units: [
          { name: "Miles per Hour", symbol: "mph" },
          { name: "Feet per Second", symbol: "ft/s" },
          { name: "Knot", symbol: "kn" },
        ],
      },
      {
        label: "Metric",
        units: [
          { name: "Meters per Second", symbol: "m/s" },
          { name: "Kilometers per Hour", symbol: "km/h" },
        ],
      },
    ],
  },
  {
    category: "Pressure",
    groups: [
      {
        units: [
          { name: "Pascal", symbol: "Pa" },
          { name: "Hectopascal", symbol: "hPa" },
          { name: "Kilopascal", symbol: "kPa" },
          { name: "Bar", symbol: "bar" },
          { name: "Millibar", symbol: "mbar" },
          { name: "Pound per Square Inch", symbol: "psi" },
          { name: "Atmosphere", symbol: "atm" },
          { name: "Millimeter of Mercury", symbol: "mmHg" },
        ],
      },
    ],
  },
  {
    category: "Time",
    groups: [
      {
        units: [
          { name: "Millisecond", symbol: "ms" },
          { name: "Second", symbol: "s" },
          { name: "Minute", symbol: "min" },
          { name: "Hour", symbol: "h" },
          { name: "Day", symbol: "d" },
        ],
      },
    ],
  },
  {
    category: "Electricity",
    groups: [
      {
        units: [
          { name: "Millivolt", symbol: "mV" },
          { name: "Volt", symbol: "V" },
          { name: "Milliampere", symbol: "mA" },
          { name: "Ampere", symbol: "A" },
          { name: "Ohm", symbol: "Ω" },
          { name: "Kiloohm", symbol: "kΩ" },
        ],
      },
    ],
  },
  {
    category: "Power, Energy",
    groups: [
      {
        units: [
          { name: "Watt", symbol: "W" },
          { name: "Kilowatt", symbol: "kW" },
          { name: "Volt-Ampere", symbol: "VA" },
          { name: "Watt-hour", symbol: "Wh" },
          { name: "Kilowatt-hour", symbol: "kWh" },
          { name: "Joule", symbol: "J" },
          { name: "Calorie", symbol: "cal" },
        ],
      },
    ],
  },
  {
    category: "Frequency",
    groups: [
      {
        units: [
          { name: "Hertz", symbol: "Hz" },
          { name: "Kilohertz", symbol: "kHz" },
          { name: "Revolutions per Minute", symbol: "RPM" },
        ],
      },
    ],
  },
  {
    category: "Light",
    groups: [
      {
        units: [
          { name: "Lux", symbol: "lx" },
          { name: "Lumen", symbol: "lm" },
          { name: "Candela", symbol: "cd" },
        ],
      },
    ],
  },
  {
    category: "Concentration",
    groups: [
      {
        units: [
          { name: "Percentage", symbol: "%" },
          { name: "Parts per Million", symbol: "ppm" },
          { name: "Parts per Billion", symbol: "ppb" },
          { name: "Microgram per Cubic Meter", symbol: "µg/m³" },
          { name: "pH", symbol: "pH" },
        ],
      },
    ],
  },
  {
    category: "Data",
    groups: [
      {
        units: [
          { name: "Bit", symbol: "b" },
          { name: "Byte", symbol: "B" },
          { name: "Kilobyte", symbol: "KB" },
          { name: "Megabyte", symbol: "MB" },
          { name: "Gigabyte", symbol: "GB" },
        ],
      },
    ],
  },
  {
    category: "Angle",
    groups: [
      {
        units: [
          { name: "Degree", symbol: "°" },
          { name: "Radian", symbol: "rad" },
        ],
      },
    ],
  },
];

/** Find a unit by its display name (used to restore the selected value). */
export function findUnitByName(name: string): UnitOption | undefined {
  for (const cat of UNIT_CATALOG) {
    for (const g of cat.groups) {
      const hit = g.units.find((u) => u.name === name);
      if (hit) return hit;
    }
  }
  return undefined;
}

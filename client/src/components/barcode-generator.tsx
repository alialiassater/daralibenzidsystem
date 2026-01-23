import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeGeneratorProps {
  value: string;
  width?: number;
  height?: number;
}

export function BarcodeGenerator({
  value,
  width = 2,
  height = 80,
}: BarcodeGeneratorProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        // التأكد من أن القيمة لا تحتوي على أي نصوص إضافية
        const barcodeValue = value.replace(/^(BOOK|MAT)/, "");
        JsBarcode(svgRef.current, barcodeValue, {
          format: "CODE128",
          width,
          height,
          displayValue: true,
          font: "Cairo",
          fontSize: 14,
          textMargin: 5,
          margin: 10,
          background: "#ffffff",
          lineColor: "#000000",
        });
      } catch (error) {
        console.error("Barcode generation error:", error);
      }
    }
  }, [value, width, height]);

  if (!value) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-md border overflow-visible">
      <svg ref={svgRef} />
    </div>
  );
}

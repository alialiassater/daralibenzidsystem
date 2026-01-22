import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Download, Printer as PrinterIcon } from "lucide-react";

interface BarcodeGeneratorProps {
  value: string;
  width?: number;
  height?: number;
  showDownload?: boolean;
  showPrint?: boolean;
}

export function BarcodeGenerator({
  value,
  width = 2,
  height = 80,
  showDownload = true,
  showPrint = true,
}: BarcodeGeneratorProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
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

  const handleDownload = () => {
    if (!svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const link = document.createElement("a");
      link.download = `barcode-${value}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    if (!svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <title>طباعة الباركود</title>
          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              font-family: Cairo, sans-serif;
            }
            .barcode-container {
              text-align: center;
              padding: 20px;
            }
          </style>
        </head>
        <body>
          <div class="barcode-container">
            ${svgData}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (!value) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-md border">
      <svg ref={svgRef} />
      {(showDownload || showPrint) && (
        <div className="flex gap-2">
          {showDownload && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              data-testid="button-download-barcode"
            >
              <Download className="h-4 w-4 ml-1" />
              تحميل
            </Button>
          )}
          {showPrint && (
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              data-testid="button-print-barcode"
            >
              <PrinterIcon className="h-4 w-4 ml-1" />
              طباعة
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

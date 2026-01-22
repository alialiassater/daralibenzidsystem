import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Keyboard, ScanLine } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  placeholder?: string;
}

export function BarcodeScanner({ onScan, placeholder = "أدخل الباركود" }: BarcodeScannerProps) {
  const [manualInput, setManualInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsScanning(true);
    } catch (error) {
      setCameraError("لا يمكن الوصول إلى الكاميرا. يرجى التحقق من الصلاحيات.");
      console.error("Camera error:", error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput("");
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <Input
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
          data-testid="input-barcode-manual"
        />
        <Button type="submit" variant="secondary" data-testid="button-barcode-submit">
          <Keyboard className="h-4 w-4 ml-1" />
          إدخال
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" onClick={startCamera} data-testid="button-barcode-camera">
              <Camera className="h-4 w-4 ml-1" />
              الكاميرا
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ScanLine className="h-5 w-5" />
                مسح الباركود
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {cameraError ? (
                <div className="p-4 text-center text-destructive bg-destructive/10 rounded-md">
                  {cameraError}
                </div>
              ) : (
                <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3/4 h-1/3 border-2 border-primary rounded-md animate-pulse" />
                    </div>
                  )}
                </div>
              )}
              <p className="text-sm text-muted-foreground text-center">
                ضع الباركود أمام الكاميرا أو أدخله يدوياً
              </p>
              <div className="flex gap-2">
                <Input
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="أو أدخل الباركود يدوياً"
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    if (manualInput.trim()) {
                      onScan(manualInput.trim());
                      setManualInput("");
                      stopCamera();
                    }
                  }}
                >
                  تأكيد
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </form>
    </div>
  );
}

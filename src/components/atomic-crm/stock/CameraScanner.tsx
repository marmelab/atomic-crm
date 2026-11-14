import { useEffect, useRef, useState } from "react";
import { useTranslate } from "ra-core";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

const getDetector = (): BarcodeDetectorConstructor | undefined =>
  (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector;

/** Browsers that can read barcodes from the camera (Chrome on Android, mostly). */
const canScanWithCamera = (): boolean =>
  !!getDetector() && !!navigator.mediaDevices?.getUserMedia;

const SCAN_INTERVAL_MS = 300;

/**
 * "Scan with camera": opens the back camera and returns the first barcode it
 * reads. Shown only where the browser has a barcode detector; elsewhere a
 * barcode is typed or read by a scanner acting as a keyboard.
 */
export const CameraScanButton = ({
  onScan,
}: {
  onScan: (code: string) => void;
}) => {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  if (!canScanWithCamera()) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={translate("crm.inventory.scan")}
      >
        <Camera />
        <span className="hidden sm:inline">
          {translate("crm.inventory.scan")}
        </span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{translate("crm.inventory.scan")}</DialogTitle>
          </DialogHeader>
          {open ? (
            <CameraView
              onScan={(code) => {
                setOpen(false);
                onScan(code);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

const CameraView = ({ onScan }: { onScan: (code: string) => void }) => {
  const translate = useTranslate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const Detector = getDetector();
    if (!Detector) return;
    const detector = new Detector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"],
    });
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let done = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (media) => {
        stream = media;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = media;
        await video.play();
        timer = setInterval(async () => {
          if (done) return;
          const [first] = await detector.detect(video).catch(() => []);
          if (first?.rawValue) {
            done = true;
            onScan(first.rawValue);
          }
        }, SCAN_INTERVAL_MS);
      })
      .catch(() => setError(true));

    return () => {
      done = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onScan]);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {translate("crm.inventory.camera_denied")}
      </p>
    );
  }
  return (
    <video
      ref={videoRef}
      className="aspect-[4/3] w-full rounded-md bg-black object-cover"
      muted
      playsInline
    />
  );
};

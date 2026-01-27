import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
    const [status, setStatus] = useState<'loading' | 'active' | 'error' | 'permission' | 'insecure'>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [cameras, setCameras] = useState<any[]>([]);
    const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const regionId = "qr-reader";
    const isMounted = useRef(true);

    // Initial Setup
    useEffect(() => {
        isMounted.current = true;

        // Essential check for Camera API
        if (!window.isSecureContext && !window.location.hostname.includes('localhost')) {
            setStatus('insecure');
            return;
        }

        const initScanner = async () => {
            // Destroy existing instance if any
            if (scannerRef.current) {
                try {
                    if (scannerRef.current.isScanning) await scannerRef.current.stop();
                    scannerRef.current.clear();
                } catch (e) { console.warn("Cleanup error", e); }
            }

            const scanner = new Html5Qrcode(regionId);
            scannerRef.current = scanner;

            try {
                const devices = await Html5Qrcode.getCameras();
                if (!devices || devices.length === 0) {
                    throw new Error("Nenhuma câmera detectada.");
                }

                setCameras(devices);

                // Smart Selection: Try to find the back camera to start with
                let backCameraIndex = devices.findIndex(device =>
                    /back|rear|traseira|environment/i.test(device.label || '')
                );

                // If not found by label, usually the last one on mobile is back
                if (backCameraIndex === -1 && devices.length > 1) {
                    backCameraIndex = devices.length - 1;
                }

                // If still -1, default to 0
                const initialIndex = backCameraIndex === -1 ? 0 : backCameraIndex;
                setCurrentCameraIndex(initialIndex);

                startCamera(scanner, devices[initialIndex].id);

            } catch (err: any) {
                console.error("Init Error:", err);
                if (err?.toString().includes("NotAllowed") || err?.toString().includes("Permission")) {
                    setStatus('permission');
                } else {
                    setStatus('error');
                    setErrorMessage(err?.toString() || "Erro desconhecido");
                }
            }
        };

        const timer = setTimeout(initScanner, 300); // Slight delay for DOM

        return () => {
            isMounted.current = false;
            clearTimeout(timer);

            const cleanup = async () => {
                if (scannerRef.current) {
                    try {
                        if (scannerRef.current.isScanning) {
                            await scannerRef.current.stop();
                        }
                        scannerRef.current.clear();
                    } catch (e) {
                        console.warn("[QRScanner] Cleanup error:", e);
                    }
                }
            };
            cleanup();
        };
    }, []);

    const startCamera = async (scanner: Html5Qrcode, deviceId: string) => {
        if (!isMounted.current) return;
        setStatus('loading');

        const config = {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false
        };

        try {
            await scanner.start(
                deviceId,
                config,
                (text) => onScan(text),
                () => { }
            );
            setStatus('active');
        } catch (e) {
            console.warn("Start error:", e);
            if (isMounted.current) {
                // Try fallback to broad environment
                try {
                    await scanner.start(
                        { facingMode: "environment" },
                        config,
                        (text) => onScan(text),
                        () => { }
                    );
                    setStatus('active');
                } catch (err2) {
                    setStatus('error');
                    setErrorMessage("Falha ao iniciar câmera.");
                }
            }
        }
    };

    const switchCamera = async () => {
        if (cameras.length < 2 || !scannerRef.current) return;

        const nextIndex = (currentCameraIndex + 1) % cameras.length;
        setCurrentCameraIndex(nextIndex);

        try {
            if (scannerRef.current.isScanning) {
                await scannerRef.current.stop();
            }
            await startCamera(scannerRef.current, cameras[nextIndex].id);
        } catch (e) {
            console.error("Error switching:", e);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute top-8 right-8 z-[1001] flex gap-2">
                {cameras.length > 1 && (
                    <button onClick={switchCamera} className="size-12 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/20 active:scale-95 transition-all">
                        <span className="material-symbols-outlined">cameraswitch</span>
                    </button>
                )}
                <button onClick={onClose} className="size-12 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/20 active:scale-95 transition-all">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            <div className="w-full max-w-sm aspect-square rounded-[3rem] overflow-hidden border-4 border-primary/50 relative shadow-2xl bg-zinc-900">
                <div id={regionId} className="w-full h-full"></div>

                {status === 'loading' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 gap-4">
                        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Iniciando Câmera...</p>
                    </div>
                )}

                {status === 'insecure' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 p-8 text-center gap-4">
                        <span className="material-symbols-outlined text-4xl text-red-500">lock_open</span>
                        <p className="text-sm font-bold">Conexão Insegura</p>
                        <p className="text-[10px] text-white/40 uppercase font-black leading-relaxed">A câmera só pode ser acessada via HTTPS ou Localhost.</p>
                    </div>
                )}

                {status === 'permission' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 p-8 text-center gap-4">
                        <span className="material-symbols-outlined text-4xl text-yellow-500">videocam_off</span>
                        <p className="text-sm font-bold">Permissão Necessária</p>
                        <p className="text-[10px] text-white/40 uppercase font-black leading-relaxed">Autorize o acesso à câmera.</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 p-8 text-center gap-4 overflow-y-auto">
                        <span className="material-symbols-outlined text-4xl text-red-500">error</span>
                        <p className="text-sm font-bold">Erro</p>
                        <p className="text-[10px] text-white/40 uppercase font-black leading-relaxed break-all px-2">{errorMessage}</p>
                        <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest">Recarregar</button>
                    </div>
                )}

                {status === 'active' && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                        <div className="w-64 h-64 border-2 border-white/20 rounded-3xl relative">
                            {/* Target Corners */}
                            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
                            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary/40 animate-scan-line shadow-[0_0_15px_rgba(255,61,113,0.5)]" />
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-12 text-center space-y-4">
                <h3 className="text-2xl font-black italic uppercase italic">Escaneie o QR Code</h3>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest max-w-[200px]">
                    {cameras.length > 1 ? "Toque no ícone acima para trocar de câmera" : "Aponte sua câmera"}
                </p>
            </div>

            <style>{`
                @keyframes scan-line {
                    0% { transform: translateY(-120px); opacity: 0; }
                    50% { opacity: 1; }
                    100% { transform: translateY(120px); opacity: 0; }
                }
                .animate-scan-line {
                    animation: scan-line 2s infinite ease-in-out;
                }
                #qr-reader video {
                    object-fit: cover !important;
                    width: 100% !important;
                    height: 100% !important;
                    border-radius: 2.5rem;
                }
            `}</style>
        </div>
    );
};

export default QRScanner;

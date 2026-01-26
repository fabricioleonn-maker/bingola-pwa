import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [status, setStatus] = React.useState<'loading' | 'active' | 'error' | 'permission' | 'insecure'>('loading');
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const regionId = "qr-reader";

    useEffect(() => {
        // Essential check for Camera API
        if (!window.isSecureContext && !window.location.hostname.includes('localhost')) {
            setStatus('insecure');
            return;
        }

        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;

        const startScanner = async () => {
            try {
                const devices = await Html5Qrcode.getCameras();
                if (!devices || devices.length === 0) {
                    throw new Error("Nenhuma câmera detectada. Verifique se o app tem permissão de hardware.");
                }

                const isDesktop = /Win|Mac|Linux/i.test(navigator.platform);
                const config = {
                    fps: 15,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                };

                // Advanced Camera Selection Logic
                let selectedDeviceId = devices[0].id; // Default to first

                if (!isDesktop) {
                    // Try to find a back camera explicitly by label
                    const backCamera = devices.find(device =>
                        /back|rear|traseira|environment/i.test(device.label || '')
                    );

                    if (backCamera) {
                        selectedDeviceId = backCamera.id;
                    } else if (devices.length > 1) {
                        // Fallback: usually the last camera on Android/iOS is the primary rear one
                        selectedDeviceId = devices[devices.length - 1].id;
                    }
                }

                const finalConfig = {
                    ...config,
                    videoConstraints: isDesktop ? undefined : {
                        deviceId: { exact: selectedDeviceId }
                    }
                };

                // Try to start with specific device ID first (most reliable)
                try {
                    await scanner.start(selectedDeviceId, config, (text) => onScan(text), () => { });
                    setStatus('active');
                } catch (primaryErr) {
                    console.warn("[QR] Primary selection failed, trying environment fallback...", primaryErr);
                    // Fallback 1: Generic Environment Mode
                    try {
                        await scanner.start({ facingMode: "environment" }, config, (text) => onScan(text), () => { });
                        setStatus('active');
                    } catch (fallbackErr) {
                        console.warn("[QR] Environment failed, using system default.", fallbackErr);
                        // Fallback 2: Any available camera
                        await scanner.start(devices[0].id, config, (text) => onScan(text), () => { });
                        setStatus('active');
                    }
                }
            } catch (err: any) {
                console.error("Scanner error details:", err);
                const errStr = err?.toString() || "";

                if (errStr.includes("NotAllowedError") || errStr.includes("Permission denied")) {
                    setStatus('permission');
                } else {
                    setStatus('error');
                    setErrorMessage(errStr);
                }
            }
        };

        // Small delay to ensure DOM is fully ready
        const timer = setTimeout(startScanner, 200);

        return () => {
            clearTimeout(timer);
            if (scanner.isScanning) {
                scanner.stop().catch(e => console.error("Error stopping scanner", e));
            }
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute top-8 right-8 z-[1001]">
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
                        <p className="text-[10px] text-white/40 uppercase font-black leading-relaxed">A câmera só pode ser acessada via HTTPS ou Localhost. Verifique a URL do app.</p>
                    </div>
                )}

                {status === 'permission' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 p-8 text-center gap-4">
                        <span className="material-symbols-outlined text-4xl text-yellow-500">videocam_off</span>
                        <p className="text-sm font-bold">Permissão Necessária</p>
                        <p className="text-[10px] text-white/40 uppercase font-black leading-relaxed">Autorize o acesso à câmera nas configurações do navegador para escanear.</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 p-8 text-center gap-4 overflow-y-auto">
                        <span className="material-symbols-outlined text-4xl text-red-500">error</span>
                        <p className="text-sm font-bold">Detalhes do Erro</p>
                        <p className="text-[10px] text-white/40 uppercase font-black leading-relaxed break-all px-2">{errorMessage}</p>
                        <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest">Recarregar App</button>
                    </div>
                )}

                {status === 'active' && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                        <div className="w-64 h-64 border-2 border-white/20 rounded-3xl relative">
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
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest max-w-[200px]">Aponte a câmera para o QR Code na mesa do anfitrião</p>
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
                }
            `}</style>
        </div>
    );
};

export default QRScanner;

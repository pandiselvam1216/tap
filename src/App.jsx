import React, { useState, useRef, useCallback, useEffect } from 'react';

function App() {
    const [selectedImage, setSelectedImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [apiStatus, setApiStatus] = useState('checking');
    const [showInspector, setShowInspector] = useState(false);
    const [viewMode, setViewMode] = useState('canvas');
    const [inputMode, setInputMode] = useState('upload'); // 'upload' | 'webcam'

    // Webcam state
    const [camActive, setCamActive] = useState(false);
    const [camDetecting, setCamDetecting] = useState(false);
    const [camCount, setCamCount] = useState(null);

    const canvasRef = useRef(null);
    const videoRef = useRef(null);
    const camCanvasRef = useRef(null);
    const camOverlayRef = useRef(null);
    const camStreamRef = useRef(null);
    const camIntervalRef = useRef(null);

    // ─── Health Check ─────────────────────────────────
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                setApiStatus(data.status === 'online' ? 'active' : 'error');
            } catch {
                setApiStatus('offline');
            }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    // ─── Image Upload ─────────────────────────────────
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResults(null);
        }
    };

    // ─── Submit Image ─────────────────────────────────
    const handleSubmit = async () => {
        if (!selectedImage) return;
        setLoading(true);
        const formData = new FormData();
        formData.append('image', selectedImage);
        try {
            const response = await fetch('/api/detect', { method: 'POST', body: formData });
            const data = await response.json();
            setResults(data);
            drawDetections(data);
        } catch (error) {
            console.error('Detection failed:', error);
            alert('Error connecting to backend.');
        } finally {
            setLoading(false);
        }
    };

    // ─── Detection Parser ─────────────────────────────
    const findDetections = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj.error) return null;
        if (Array.isArray(obj.outputs) && obj.outputs.length > 0) return findDetections(obj.outputs[0]);
        if (Array.isArray(obj)) {
            if (obj.length > 0 && typeof obj[0] === 'object' &&
                (obj[0].x !== undefined || obj[0].confidence !== undefined)) return obj;
            for (const item of obj) { const f = findDetections(item); if (f) return f; }
        } else {
            if (Array.isArray(obj.predictions)) return obj.predictions;
            if (Array.isArray(obj.detections)) return obj.detections;
            if (Array.isArray(obj.results)) return findDetections(obj.results);
            for (const key in obj) {
                if (key === 'visualization' || key === 'image') continue;
                const f = findDetections(obj[key]); if (f) return f;
            }
        }
        return null;
    };

    // ─── Draw on Static Image ─────────────────────────
    const drawDetections = (data) => {
        const img = new Image();
        img.src = previewUrl;
        img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const dets = findDetections(data) || [];
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 4;
            ctx.font = '24px Outfit';
            ctx.fillStyle = '#2563eb';
            dets.forEach((det) => {
                const { x, y, width, height } = det;
                const label = det.class_name || det.class || 'Object';
                const left = x - width / 2;
                const top = y - height / 2;
                ctx.strokeRect(left, top, width, height);
                ctx.fillText(label, left, top > 30 ? top - 10 : top + 25);
            });
        };
    };

    // ─── Webcam: Start ────────────────────────────────
    const startWebcam = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            camStreamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setCamActive(true);
            setCamCount(null);
        } catch (err) {
            alert('Unable to access camera. Please check permissions.');
            console.error(err);
        }
    }, []);

    // ─── Webcam: Stop ─────────────────────────────────
    const stopWebcam = useCallback(() => {
        if (camIntervalRef.current) {
            clearInterval(camIntervalRef.current);
            camIntervalRef.current = null;
        }
        if (camStreamRef.current) {
            camStreamRef.current.getTracks().forEach(t => t.stop());
            camStreamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        setCamActive(false);
        setCamDetecting(false);
        setCamCount(null);
        // Clear overlay
        if (camOverlayRef.current) {
            const ctx = camOverlayRef.current.getContext('2d');
            ctx.clearRect(0, 0, camOverlayRef.current.width, camOverlayRef.current.height);
        }
    }, []);

    // ─── Webcam: Capture Frame & Detect ───────────────
    const captureAndDetect = useCallback(async () => {
        if (!videoRef.current || !camCanvasRef.current) return;
        const video = videoRef.current;
        const canvas = camCanvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const formData = new FormData();
            formData.append('image', blob, 'webcam-frame.jpg');
            try {
                const response = await fetch('/api/detect', { method: 'POST', body: formData });
                const data = await response.json();
                const dets = findDetections(data) || [];
                setCamCount(dets.length);

                // Draw overlay
                if (camOverlayRef.current) {
                    const overlay = camOverlayRef.current;
                    overlay.width = video.videoWidth;
                    overlay.height = video.videoHeight;
                    const octx = overlay.getContext('2d');
                    octx.clearRect(0, 0, overlay.width, overlay.height);
                    octx.strokeStyle = '#10b981';
                    octx.lineWidth = 3;
                    octx.font = '18px Outfit';
                    octx.fillStyle = '#10b981';
                    dets.forEach((det) => {
                        const { x, y, width, height } = det;
                        const label = det.class_name || det.class || 'Faucet';
                        const left = x - width / 2;
                        const top = y - height / 2;
                        octx.strokeRect(left, top, width, height);
                        octx.fillText(label, left, top > 25 ? top - 8 : top + 20);
                    });
                }
            } catch (err) {
                console.error('Webcam detect error:', err);
            }
        }, 'image/jpeg', 0.7);
    }, []);

    // ─── Webcam: Toggle Detection Loop ────────────────
    const toggleDetection = useCallback(() => {
        if (camDetecting) {
            clearInterval(camIntervalRef.current);
            camIntervalRef.current = null;
            setCamDetecting(false);
        } else {
            captureAndDetect();
            camIntervalRef.current = setInterval(captureAndDetect, 2500);
            setCamDetecting(true);
        }
    }, [camDetecting, captureAndDetect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopWebcam();
        };
    }, [stopWebcam]);

    // ─── Computed Values ──────────────────────────────
    const detectionsArray = findDetections(results) || [];
    const detectionCount = detectionsArray.length;

    // ─── Visualization Finder ─────────────────────────
    const findVisual = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj.visualization) {
            if (typeof obj.visualization === 'string') return obj.visualization;
            if (obj.visualization.value) return obj.visualization.value;
        }
        if (obj.image && typeof obj.image === 'string' && obj.image.length > 500) return obj.image;
        if (Array.isArray(obj.outputs) && obj.outputs.length > 0) return findVisual(obj.outputs[0]);
        if (Array.isArray(obj)) {
            for (const item of obj) { const f = findVisual(item); if (f) return f; }
        } else {
            for (const key in obj) {
                if (key === 'visualization' || key === 'image' || key === 'predictions') continue;
                const f = findVisual(obj[key]); if (f) return f;
            }
        }
        return null;
    };

    // ─── Render ───────────────────────────────────────
    return (
        <div className="app-container">
            {/* Header */}
            <header className="app-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '6px' }}>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 16.5C7 15.12 8.12 14 9.5 14H12V12H9.5C7.01 12 5 14.01 5 16.5V20H7V16.5Z" fill="#2563eb" />
                        <path d="M12 2C10.34 2 9 3.34 9 5V12H19V7C19 4.24 16.76 2 14 2H12ZM14 4H12V5H14V4ZM17 7V10H14V7V4.5C14 4.22 14.22 4 14.5 4H16.5C16.89 4 17.2 4.31 17.2 4.7V7H17Z" fill="#2563eb" />
                        <path d="M12 16C12 17.1 11.1 18 10 18C8.9 18 8 17.1 8 16C8 14.9 8.9 14 10 14C11.1 14 12 14.9 12 16ZM14 14V18H16V14H14Z" fill="#2563eb" />
                        <circle cx="10" cy="21" r="1" fill="#2563eb" />
                        <circle cx="14" cy="21" r="1" fill="#2563eb" />
                    </svg>
                    <h1>Faucet <span style={{ color: '#2563eb' }}>Vision</span></h1>
                </div>
                <p className="subtitle">Premium Autonomous Faucet Detection</p>
            </header>

            {/* Input Mode Tabs */}
            <div className="mode-tabs" style={{ maxWidth: '400px', margin: '0 auto 30px' }}>
                <button className={`mode-tab ${inputMode === 'upload' ? 'active' : ''}`} onClick={() => { setInputMode('upload'); stopWebcam(); }}>
                    📁 Upload
                </button>
                <button className={`mode-tab ${inputMode === 'webcam' ? 'active' : ''}`} onClick={() => setInputMode('webcam')}>
                    📷 Live Webcam
                </button>
            </div>

            <main className="main-grid">
                {/* ─── LEFT: Input Section ──────────────── */}
                <section className="glass-card" style={{ padding: '25px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                            {inputMode === 'upload' ? 'Input Intelligence' : 'Live Camera Feed'}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                            <div style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                backgroundColor: apiStatus === 'active' ? '#10b981' : (apiStatus === 'offline' ? '#ef4444' : '#f59e0b'),
                                boxShadow: apiStatus === 'active' ? '0 0 8px #10b981' : 'none'
                            }}></div>
                            <span style={{ fontWeight: 600, textTransform: 'uppercase', color: '#64748b' }}>
                                AI: {apiStatus}
                            </span>
                        </div>
                    </div>

                    {inputMode === 'upload' ? (
                        <>
                            {/* Upload Area */}
                            <div className={`upload-area ${selectedImage ? 'has-image' : ''}`}
                                onClick={() => document.getElementById('fileInput').click()}>
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                                ) : (
                                    <div style={{ color: '#94a3b8' }}>
                                        <p style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⚡</p>
                                        <p style={{ fontWeight: 500 }}>Deploy your image for analysis</p>
                                        <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Tap or click to browse</p>
                                    </div>
                                )}
                                <input id="fileInput" type="file" hidden accept="image/*" onChange={handleImageChange} />
                            </div>
                            <button className="btn-primary" style={{ marginTop: '16px' }} onClick={handleSubmit} disabled={!selectedImage || loading}>
                                {loading ? (<><div className="spinner"></div> Running Inference...</>) : (<><span>🚀</span> Detect Faucets</>)}
                            </button>
                            <button onClick={() => setShowInspector(!showInspector)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', marginTop: '12px', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline', display: 'block', width: '100%', textAlign: 'center' }}>
                                {showInspector ? 'Hide' : 'View'} Raw AI Debugger
                            </button>
                        </>
                    ) : (
                        <>
                            {/* Webcam Area */}
                            <div className="webcam-container">
                                <video ref={videoRef} playsInline muted style={{ display: camActive ? 'block' : 'none' }} />
                                <canvas ref={camCanvasRef} style={{ display: 'none' }} />
                                {camActive && <canvas ref={camOverlayRef} className="webcam-overlay-canvas" />}
                                {camDetecting && (
                                    <div className="live-badge">
                                        <div className="live-dot"></div> LIVE
                                    </div>
                                )}
                                {!camActive && (
                                    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                                        <p style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📷</p>
                                        <p style={{ fontWeight: 500 }}>Camera is off</p>
                                        <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Start camera to begin live detection</p>
                                    </div>
                                )}
                            </div>
                            <div className="webcam-controls">
                                {!camActive ? (
                                    <button className="btn-start-cam" onClick={startWebcam}>▶ Start Camera</button>
                                ) : (
                                    <>
                                        <button className={camDetecting ? 'btn-stop-cam' : 'btn-start-cam'} onClick={toggleDetection}>
                                            {camDetecting ? '⏹ Stop Detection' : '🔍 Start Detection'}
                                        </button>
                                        <button className="btn-stop-cam" onClick={stopWebcam}>✕ Close Camera</button>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </section>

                {/* ─── RIGHT: Results Section ──────────── */}
                <section className="glass-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Vision Results</h2>
                        <div className="badge">ENGINE ACTIVE</div>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <div className="faucet-count">
                            {inputMode === 'webcam'
                                ? (camCount !== null ? camCount : '--')
                                : (results ? (detectionCount || 0) : '--')}
                        </div>
                        <p style={{ color: '#64748b', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '4px', fontSize: '0.85rem' }}>
                            Faucets Identified
                        </p>
                    </div>

                    {inputMode === 'upload' && (
                        <>
                            <div style={{ width: '100%', display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                <button className={`toggle-btn ${viewMode === 'canvas' ? 'active' : ''}`}
                                    onClick={() => setViewMode('canvas')} disabled={!previewUrl}>
                                    Smart Canvas
                                </button>
                                <button className={`toggle-btn ${viewMode === 'visualization' ? 'active' : ''}`}
                                    onClick={() => setViewMode('visualization')} disabled={!results}>
                                    Model Vision
                                </button>
                            </div>

                            <div className="vision-display">
                                {loading && (
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                        <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
                                    </div>
                                )}
                                {!previewUrl ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                                        <p style={{ fontSize: '2rem' }}>👁️</p>
                                        <p>Awaiting input...</p>
                                    </div>
                                ) : (
                                    <>
                                        <canvas ref={canvasRef} style={{ display: viewMode === 'canvas' ? 'block' : 'none', maxWidth: '100%', height: 'auto', borderRadius: '8px' }} />
                                        {viewMode === 'visualization' && (
                                            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {(() => {
                                                    const visualData = findVisual(results);
                                                    if (visualData) {
                                                        const imgSrc = visualData.startsWith('data:') ? visualData : `data:image/jpeg;base64,${visualData}`;
                                                        return <img src={imgSrc} alt="Roboflow Visualization" style={{ maxWidth: '100%', borderRadius: '8px' }} />;
                                                    }
                                                    return (
                                                        <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
                                                            Visualization not available.<br />Using Smart Canvas instead.
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    )}

                    {inputMode === 'webcam' && (
                        <div className="vision-display" style={{ flexDirection: 'column', padding: '20px' }}>
                            {camDetecting ? (
                                <div style={{ textAlign: 'center', color: '#10b981' }}>
                                    <p style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔴 Live Detection Active</p>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Scanning every 2.5 seconds</p>
                                </div>
                            ) : camActive ? (
                                <div style={{ textAlign: 'center', color: '#64748b' }}>
                                    <p style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📷</p>
                                    <p>Camera ready. Press "Start Detection" to begin.</p>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                                    <p style={{ fontSize: '2rem' }}>👁️</p>
                                    <p>Start the camera to detect faucets live.</p>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </main>

            {/* Inspector */}
            {showInspector && results && (
                <section className="glass-card inspector-section">
                    <h3 style={{ marginBottom: '12px' }}>Raw AI Inspector</h3>
                    <pre className="inspector-pre">{JSON.stringify(results, null, 2)}</pre>
                </section>
            )}

            <footer className="app-footer">Powered by Neural Global</footer>
        </div>
    );
}

export default App;

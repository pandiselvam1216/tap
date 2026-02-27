import React, { useState, useRef } from 'react';

function App() {
    const [selectedImage, setSelectedImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [apiStatus, setApiStatus] = useState('checking');
    const [showInspector, setShowInspector] = useState(false);
    const [viewMode, setViewMode] = useState('canvas'); // 'canvas' or 'visualization'
    const canvasRef = useRef(null);

    React.useEffect(() => {
        const checkStatus = async () => {
            try {
                // Use relative path for Vercel deployment
                const response = await fetch('/api/health');
                const data = await response.json();
                setApiStatus(data.status === 'online' ? 'active' : 'error');
            } catch (error) {
                setApiStatus('offline');
            }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResults(null);
        }
    };

    const handleSubmit = async () => {
        if (!selectedImage) return;
        setLoading(true);

        const formData = new FormData();
        formData.append('image', selectedImage);

        try {
            const response = await fetch('/api/detect', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            setResults(data);
            drawDetections(data);
        } catch (error) {
            console.error('Detection failed:', error);
            alert('Error connecting to backend. Make sure it is running on port 8000.');
        } finally {
            setLoading(false);
        }
    };

    // Aggressive recursive search for detections
    const findDetections = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj.error) return null; // Handle backend error objects

        // Some workflow responses are inside an 'outputs' list
        if (Array.isArray(obj.outputs) && obj.outputs.length > 0) {
            return findDetections(obj.outputs[0]);
        }

        if (Array.isArray(obj)) {
            // Check if this array looks like a list of detections
            if (obj.length > 0 && typeof obj[0] === 'object' &&
                (obj[0].x !== undefined || obj[0].confidence !== undefined ||
                    obj[0].box_2d !== undefined || obj[0].box !== undefined)) {
                return obj;
            }
            for (const item of obj) {
                const found = findDetections(item);
                if (found) return found;
            }
        } else {
            // Check standard keys first
            if (Array.isArray(obj.predictions)) return obj.predictions;
            if (Array.isArray(obj.detections)) return obj.detections;
            if (Array.isArray(obj.results)) return findDetections(obj.results);

            for (const key in obj) {
                if (key === 'visualization' || key === 'image') continue; // Skip binary
                const found = findDetections(obj[key]);
                if (found) return found;
            }
        }
        return null;
    };

    const drawDetections = (data) => {
        const img = new Image();
        img.src = previewUrl;
        img.onload = () => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const foundDetections = findDetections(data) || [];
            console.log('Drawing Detections:', foundDetections);

            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 4;
            ctx.font = '24px Outfit';
            ctx.fillStyle = '#2563eb';

            foundDetections.forEach((det) => {
                const { x, y, width, height } = det;
                const label = det.class_name || det.class || 'Object';
                const left = x - width / 2;
                const top = y - height / 2;
                ctx.strokeRect(left, top, width, height);
                ctx.fillText(`${label}`, left, top > 30 ? top - 10 : top + 25);
            });
        };
    };

    const detectionsArray = findDetections(results) || [];
    const detectionCount = detectionsArray.length;
    console.log('Final Computed Count:', detectionCount, results);

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ textAlign: 'center', marginBottom: '60px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '10px' }}>
                    <svg width="50" height="50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 16.5C7 15.12 8.12 14 9.5 14H12V12H9.5C7.01 12 5 14.01 5 16.5V20H7V16.5Z" fill="#2563eb" />
                        <path d="M12 2C10.34 2 9 3.34 9 5V12H19V7C19 4.24 16.76 2 14 2H12ZM14 4H12V5H14V4ZM17 7V10H14V7V4.5C14 4.22 14.22 4 14.5 4H16.5C16.89 4 17.2 4.31 17.2 4.7V7H17Z" fill="#2563eb" />
                        <path d="M12 16C12 17.1 11.1 18 10 18C8.9 18 8 17.1 8 16C8 14.9 8.9 14 10 14C11.1 14 12 14.9 12 16ZM14 14V18H16V14H14Z" fill="#2563eb" />
                        <circle cx="10" cy="21" r="1" fill="#2563eb" />
                        <circle cx="14" cy="21" r="1" fill="#2563eb" />
                    </svg>
                    <h1 style={{ fontSize: '3.5rem', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>
                        Faucet <span style={{ color: '#2563eb' }}>Vision</span>
                    </h1>
                </div>
                <p style={{ color: '#64748b', fontSize: '1.2rem' }}>Premium Autonomous Faucet Detection</p>
            </header>

            <main style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                <section className="glass-card" style={{ padding: '30px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0 }}>Input Intelligence</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                            <div style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: apiStatus === 'active' ? '#10b981' : (apiStatus === 'offline' ? '#ef4444' : '#f59e0b'),
                                boxShadow: apiStatus === 'active' ? '0 0 10px #10b981' : 'none'
                            }}></div>
                            <span style={{ fontWeight: 600, textTransform: 'uppercase', color: '#64748b' }}>
                                AI SERVICE: {apiStatus}
                            </span>
                        </div>
                    </div>
                    <div
                        style={{
                            border: '2px dashed #cbd5e1',
                            borderRadius: '16px',
                            padding: '40px',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.3s ease',
                            backgroundColor: selectedImage ? '#f8fafc' : 'transparent'
                        }}
                        onClick={() => document.getElementById('fileInput').click()}
                    >
                        {previewUrl ? (
                            <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                        ) : (
                            <div style={{ color: '#94a3b8' }}>
                                <p style={{ fontSize: '3rem', marginBottom: '10px' }}>⚡</p>
                                <p style={{ fontWeight: 500 }}>Deploy your image for analysis</p>
                                <p style={{ fontSize: '0.8rem', marginTop: '5px' }}>Drag & Drop or click to browse</p>
                            </div>
                        )}
                        <input
                            id="fileInput"
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={handleImageChange}
                        />
                    </div>
                    <button
                        className="btn-primary"
                        style={{ marginTop: '20px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                        onClick={handleSubmit}
                        disabled={!selectedImage || loading}
                    >
                        {loading ? (
                            <>
                                <div className="spinner"></div>
                                Running Inference...
                            </>
                        ) : (
                            <>
                                <span>🚀</span>
                                Detect Faucets
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => setShowInspector(!showInspector)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', marginTop: '15px', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                    >
                        {showInspector ? 'Hide' : 'View'} Raw AI Debugger
                    </button>
                </section>

                <section className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0 }}>Vision Results</h2>
                        <div className="badge">ENGINE ACTIVE</div>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <div className="faucet-count" style={{ fontSize: '5rem', lineHeight: '1' }}>
                            {results ? (detectionCount || 0) : '--'}
                        </div>
                        <p style={{ color: '#64748b', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '5px' }}>
                            Faucets Identified
                        </p>
                    </div>

                    <div style={{ width: '100%', display: 'flex', gap: '10px', marginBottom: '20px' }}>
                        <button
                            className={`toggle-btn ${viewMode === 'canvas' ? 'active' : ''}`}
                            onClick={() => setViewMode('canvas')}
                            disabled={!previewUrl}
                        >
                            Smart Canvas
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'visualization' ? 'active' : ''}`}
                            onClick={() => setViewMode('visualization')}
                            disabled={!results}
                        >
                            Model Vision
                        </button>
                    </div>

                    <div style={{ width: '100%', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden' }}>
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
                                <canvas
                                    ref={canvasRef}
                                    style={{
                                        display: viewMode === 'canvas' ? 'block' : 'none',
                                        maxWidth: '100%',
                                        height: 'auto',
                                        borderRadius: '8px'
                                    }}
                                />
                                {viewMode === 'visualization' && (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {(() => {
                                            const findVisual = (obj) => {
                                                if (!obj || typeof obj !== 'object') return null;

                                                // 1. Direct search in common keys
                                                if (obj.visualization) {
                                                    if (typeof obj.visualization === 'string') return obj.visualization;
                                                    if (obj.visualization.value) return obj.visualization.value;
                                                }
                                                if (obj.image && typeof obj.image === 'string' && obj.image.length > 500) return obj.image;

                                                // 2. Workflow outputs shortcut
                                                if (Array.isArray(obj.outputs) && obj.outputs.length > 0) {
                                                    return findVisual(obj.outputs[0]);
                                                }

                                                // 3. Recursive search
                                                if (Array.isArray(obj)) {
                                                    for (const item of obj) {
                                                        const found = findVisual(item);
                                                        if (found) return found;
                                                    }
                                                } else {
                                                    for (const key in obj) {
                                                        if (key === 'visualization' || key === 'image' || key === 'predictions') continue;
                                                        const found = findVisual(obj[key]);
                                                        if (found) return found;
                                                    }
                                                }
                                                return null;
                                            };
                                            const visualData = findVisual(results);
                                            if (visualData) {
                                                const imgSrc = visualData.startsWith('data:') ? visualData : `data:image/jpeg;base64,${visualData}`;
                                                return (
                                                    <img
                                                        src={imgSrc}
                                                        alt="Roboflow Visualization"
                                                        style={{ maxWidth: '100%', borderRadius: '8px' }}
                                                    />
                                                );
                                            }
                                            return (
                                                <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
                                                    Visualization not available for this workflow.<br />Using Smart Canvas instead.
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </section>
            </main>

            {showInspector && results && (
                <section className="glass-card" style={{ marginTop: '40px', padding: '30px' }}>
                    <h3 style={{ marginBottom: '15px' }}>Raw AI Inspector</h3>
                    <pre style={{
                        backgroundColor: '#1e293b',
                        color: '#f8fafc',
                        padding: '20px',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        overflowX: 'auto',
                        maxHeight: '400px'
                    }}>
                        {JSON.stringify(results, null, 2)}
                    </pre>
                </section>
            )}

            <footer style={{ marginTop: '80px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                Powered by Neural Global
            </footer>
        </div>
    );
}

export default App;

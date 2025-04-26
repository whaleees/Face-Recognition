import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import  supabase  from '../utils/supabase';
import { useNavigate } from 'react-router-dom';


const App = () => {
  const [userName, setUserName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const webcamRef = useRef<Webcam>(null);
  const navigate = useNavigate();


  // Get available cameras
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameraDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Camera enumeration failed:', err);
      }
    };
    getCameras();
  }, []);

  // Initialize camera with selected device
  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedCamera,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (webcamRef.current?.video) {
        webcamRef.current.video.srcObject = stream;
        setCameraReady(true);
      }
    } catch (err) {
      handleCameraError(err);
    }
  };

  const handleCameraError = (error: unknown) => {
    let message = 'Camera access denied';
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          message = 'Please allow camera access in browser settings';
          break;
        case 'NotFoundError':
          message = 'No camera device found';
          break;
        case 'NotReadableError':
          message = 'Camera is already in use';
          break;
      }
    }
    setError(message);
    setCameraReady(false);
  };

  const capturePhoto = async (): Promise<Blob> => {
    if (!webcamRef.current || !cameraReady) {
      throw new Error('Camera not ready');
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) throw new Error('Failed to capture photo');

    const response = await fetch(imageSrc);
    return response.blob();
  };

  const handleSaveEmbedding = async () => {
    setLoading(true);
    setError('');

    try {
      if (!userName) throw new Error('Please enter your name');
      if (!cameraReady) throw new Error('Camera not initialized');

      const photoBlob = await capturePhoto();
      const formData = new FormData();
      formData.append('image', photoBlob, 'face.jpg');
      formData.append('email', userName);

      const response = await fetch('http://localhost:5000/register', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }

      navigate('/dashboard'); 
      setUserName('');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Face Registration</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Camera Selection */}
        <div className="mb-4">
          <label className="block mb-2 font-medium">
            Select Camera:
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="ml-2 p-2 border rounded"
            >
              {cameraDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={initializeCamera}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            {cameraReady ? 'Reinitialize Camera' : 'Start Camera'}
          </button>
        </div>

        {/* Webcam Preview */}
        {cameraReady ? (
          <div className="mb-4 relative">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                deviceId: selectedCamera,
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }}
              className="rounded-lg border-2 border-gray-200"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
        ) : (
          <div className="mb-4 p-4 bg-yellow-100 rounded-lg">
            {error || 'Camera not initialized. Click "Start Camera" above.'}
          </div>
        )}

        {/* Registration Form */}
        <div className="mb-4">
          <label className="block mb-2 font-medium">
            Your Name:
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="ml-2 p-2 border rounded w-full"
              placeholder="Enter your name"
            />
          </label>
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>}

        <button
          onClick={handleSaveEmbedding}
          disabled={!cameraReady || loading}
          className="w-full bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" strokeWidth="4" className="opacity-25"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Processing...
            </span>
          ) : (
            'Register Face'
          )}
        </button>
      </div>
    </div>
  );
};

export default App;
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const App = () => {
  const [email, setEmail] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const initializeCameraDevices = async () => {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach((track) => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setCameraDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
        setHasCameraPermission(true);
      } catch (err) {
        console.error('Camera initialization failed:', err);
        setError('Camera access is required for this feature');
      }
    };

    initializeCameraDevices();
  }, []);

  useEffect(() => {
    let mediaStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: selectedCamera ? { exact: selectedCamera } : undefined }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
        setStream(mediaStream);
      } catch (err: any) {
        console.error('Camera error:', err);
        let message = 'Camera access denied';
        if (err.name === 'NotAllowedError') message = 'Please allow camera access';
        else if (err.name === 'NotFoundError') message = 'No camera detected';
        else if (err.name === 'NotReadableError') message = 'Camera already in use';
        setError(message);
        setIsScanning(false);
      }
    };

    if (isScanning && selectedCamera) {
      startCamera();
    }

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    };
  }, [isScanning, selectedCamera]);

  const capturePhoto = async (): Promise<Blob> => {
    if (!videoRef.current) throw new Error('Camera not ready');
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    ctx.drawImage(videoRef.current, 0, 0);
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/jpeg');
    });
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Email is required');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsScanning(true);
  };

  const handleFaceOperation = async () => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      const photoBlob = await capturePhoto();
      const formData = new FormData();
      formData.append('image', photoBlob, 'face.jpg');

      if (!email) throw new Error('Please enter your email first');
      formData.append('email', email.trim().toLowerCase());

      const response = await fetch(
        `http://localhost:5000${isRegistering ? '/register' : '/recognize'}`,
        { method: 'POST', body: formData }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Operation failed');

      if (isRegistering) {
        setSuccess('Registration successful!');
        setTimeout(() => {
          setIsRegistering(false);
          setSuccess('');
        }, 3000);
      } else {
        if (data.result && data.result !== 'Unknown') {
          setIsAuthenticated(true);
        } else {
          setError('Face not recognized');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsScanning(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setIsScanning(false);
    setIsAuthenticated(false);
    setIsRegistering(false);
    setError('');
    setSuccess('');
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  if (isAuthenticated) {
    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 w-screen overflow-hidden">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-user-shield text-blue-600 text-2xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isRegistering ? 'Create Account' : 'Secure Login'}
          </h1>
          <p className="text-gray-600">
            {isRegistering ? 'Register with your email and face' : 'Use your email and face recognition'}
          </p>
        </div>

        {!isScanning ? (
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-envelope text-gray-400"></i>
                </div>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
            </div>

            {cameraDevices.length > 0 && (
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  Select Camera:
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="ml-2 p-2 border rounded"
                  >
                    {cameraDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <i className="fas fa-spinner fa-spin mr-2"></i>
              ) : (
                <i className={`fas ${isRegistering ? 'fa-user-plus' : 'fa-sign-in-alt'} mr-2`}></i>
              )}
              {isRegistering ? 'Register' : 'Continue'} with Face Recognition
            </button>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                {isRegistering ? 'Already have an account? Login here' : 'Need an account? Register here'}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                {isRegistering ? 'Face Registration' : 'Face Recognition'}
              </h2>
              <p className="text-gray-600">Please look directly at your camera</p>
            </div>

            <div className="relative mb-6">
              <div className="w-full h-full rounded-xl border-4 border-blue-500 overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              </div>
            </div>

            <button
              onClick={handleFaceOperation}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <i className="fas fa-spinner fa-spin mr-2"></i>
              ) : (
                <i className={`fas ${isRegistering ? 'fa-user-plus' : 'fa-sign-in-alt'} mr-2`}></i>
              )}
              {isRegistering ? 'Register Face' : 'Recognize Face'}
            </button>

            {success && (
              <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-lg">{success}</div>
            )}
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>
            )}

            <button
              onClick={resetForm}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-4 rounded-lg transition duration-200"
            >
              <i className="fas fa-arrow-left mr-2"></i> Go Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';

// Constants
const FILTERS = [
  { name: 'none', label: 'Original' },
  { name: 'warm', label: 'Warm' },
  { name: 'cool', label: 'Cool' },
  { name: 'vintage', label: 'Vintage' },
  { name: 'bw', label: 'B&W' }
];

const PHOTO_SESSION_CONFIG = {
  COUNTDOWN_DURATION: 3,
  INTERVAL_DURATION: 5
};

const PHOTO_MODES = {
  TWO_PHOTO: {
    totalPhotos: 2,
    aspectRatio: 16/9, // 16:9 for landscape photos
    layout: 'vertical'
  },
  FOUR_PHOTO: {
    totalPhotos: 4,
    aspectRatio: 1, // Square photos
    layout: 'grid'
  }
};

const COLLAGE_CONFIG = {
  FOUR_PHOTO: {
    PHOTO_WIDTH: 300,
    PHOTO_HEIGHT: 300,
    PADDING: 20,
    BORDER_WIDTH: 25,
    HEADER_HEIGHT: 90,
    CORNER_RADIUS: 15,
    BADGE_SIZE: 30,
    BADGE_RADIUS: 15
  },
  TWO_PHOTO: {
    PHOTO_WIDTH: 480, // 16:9 aspect ratio
    PHOTO_HEIGHT: 270,
    PADDING: 20,
    BORDER_WIDTH: 25,
    HEADER_HEIGHT: 90,
    CORNER_RADIUS: 15,
    BADGE_SIZE: 30,
    BADGE_RADIUS: 15
  }
};

// Utility Functions
const createRoundedRect = (ctx, x, y, width, height, radius) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);  
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};// Custom Hooks
const useCamera = () => {
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  const startCamera = useCallback(async () => {
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
          facingMode: 'user'
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
        };
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError(`Camera access failed: ${err.message}`);
      
      // Fallback with lower resolution
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.onloadedmetadata = () => {
            setCameraReady(true);
          };
        }
      } catch (fallbackErr) {
        setError(`Camera access failed: ${fallbackErr.message}`);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  return { cameraReady, error, videoRef, startCamera, stopCamera };
};

const usePhotoSession = () => {
  const [isPhotoSession, setIsPhotoSession] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [sessionCountdown, setSessionCountdown] = useState(null);

  const startSession = useCallback(() => {
    setIsPhotoSession(true);
    setCurrentPhotoIndex(0);
    setSessionCountdown(PHOTO_SESSION_CONFIG.INTERVAL_DURATION);
  }, []);

  const resetSession = useCallback(() => {
    setIsPhotoSession(false);
    setCurrentPhotoIndex(0);
    setSessionCountdown(null);
  }, []);

  return {
    isPhotoSession,
    currentPhotoIndex,
    sessionCountdown,
    startSession,
    resetSession,
    setCurrentPhotoIndex,
    setSessionCountdown
  };
};

// Utility function to get current day of year
const getDayOfYear = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return dayOfYear;
};

// Utility function to get total days in current year
const getTotalDaysInYear = () => {
  const year = new Date().getFullYear();
  return new Date(year, 11, 31).getDate() === 31 ? 365 + (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 1 : 0) : 365;
};

// Main Component
export default function Booth() {
  const { cameraReady, error, videoRef, startCamera, stopCamera } = useCamera();
  const { 
    isPhotoSession, 
    currentPhotoIndex, 
    sessionCountdown, 
    startSession, 
    resetSession,
    setCurrentPhotoIndex,
    setSessionCountdown 
  } = usePhotoSession();

  // Generate dynamic default event name
  const currentYear = new Date().getFullYear();
  const dayOfYear = getDayOfYear();
  const totalDaysInYear = getTotalDaysInYear();
  const defaultEventName = `🌞 Day ${dayOfYear}/${totalDaysInYear} in ${currentYear}`;

  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [collageURL, setCollageURL] = useState(null);
  const [filter, setFilter] = useState('none');
  const [countdown, setCountdown] = useState(null);
  const [stripTitle, setStripTitle] = useState(defaultEventName);
  const [photoMode, setPhotoMode] = useState('TWO_PHOTO'); // 'TWO_PHOTO' or 'FOUR_PHOTO'

  // Initialize camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Take snapshot function
  const takeSnapshot = useCallback(() => {
    if (!videoRef.current || !cameraReady) return;

    const currentMode = PHOTO_MODES[photoMode];
    
    // Prevent taking more than the allowed photos in a session
    if (isPhotoSession && currentPhotoIndex >= currentMode.totalPhotos) {
      return;
    }

    const video = videoRef.current;

    // Check if video has valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('Video dimensions not ready');
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Handle different aspect ratios based on photo mode
    let canvasWidth, canvasHeight, offsetX, offsetY, sourceWidth, sourceHeight;
    
    if (photoMode === 'TWO_PHOTO') {
      // 16:9 aspect ratio for 2-photo mode
      const aspectRatio = currentMode.aspectRatio;
      
      // Determine canvas size based on 16:9 ratio
      if (video.videoWidth / video.videoHeight > aspectRatio) {
        // Video is wider than 16:9, use full height
        canvasHeight = video.videoHeight;
        canvasWidth = canvasHeight * aspectRatio;
      } else {
        // Video is taller than 16:9, use full width
        canvasWidth = video.videoWidth;
        canvasHeight = canvasWidth / aspectRatio;
      }
      
      // Calculate source dimensions and offsets for cropping
      sourceWidth = canvasWidth;
      sourceHeight = canvasHeight;
      offsetX = (video.videoWidth - sourceWidth) / 2;
      offsetY = (video.videoHeight - sourceHeight) / 2;
    } else {
      // Square aspect ratio for 4-photo mode
      const size = Math.min(video.videoWidth, video.videoHeight);
      canvasWidth = size;
      canvasHeight = size;
      sourceWidth = size;
      sourceHeight = size;
      offsetX = (video.videoWidth - size) / 2;
      offsetY = (video.videoHeight - size) / 2;
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Draw video frame with appropriate cropping
    ctx.drawImage(video, offsetX, offsetY, sourceWidth, sourceHeight, 0, 0, canvasWidth, canvasHeight);

    // Apply filter effects
    if (filter !== 'none') {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        switch (filter) {
          case 'warm':
            data[i] = Math.min(255, data[i] * 1.2);
            data[i + 1] = Math.min(255, data[i + 1] * 1.1);
            break;
          case 'cool':
            data[i + 2] = Math.min(255, data[i + 2] * 1.2);
            break;
          case 'vintage':
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            data[i] = Math.min(255, avg + 40);
            data[i + 1] = Math.min(255, avg + 20);
            data[i + 2] = Math.min(255, avg - 20);
            break;
          case 'bw':
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = data[i + 1] = data[i + 2] = gray;
            break;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    const photoURL = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedPhotos(prev => [...prev, photoURL]);

    if (isPhotoSession) {
      setCurrentPhotoIndex(prev => prev + 1);
    }
  }, [videoRef, filter, cameraReady, isPhotoSession, currentPhotoIndex, photoMode]);

  // Collage creation function
  const createCollage = useCallback(() => {
    const currentMode = PHOTO_MODES[photoMode];
    if (capturedPhotos.length !== currentMode.totalPhotos) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const config = COLLAGE_CONFIG[photoMode];

    // Calculate canvas dimensions based on layout
    let canvasWidth, canvasHeight;
    
    if (photoMode === 'TWO_PHOTO') {
      // Vertical layout for 2 photos
      canvasWidth = config.PHOTO_WIDTH + (config.PADDING * 2) + (config.BORDER_WIDTH * 2);
      canvasHeight = (config.PHOTO_HEIGHT * 2) + (config.PADDING * 3) + (config.BORDER_WIDTH * 2) + config.HEADER_HEIGHT;
    } else {
      // 2x2 grid layout for 4 photos
      canvasWidth = (config.PHOTO_WIDTH * 2) + (config.PADDING * 3) + (config.BORDER_WIDTH * 2);
      canvasHeight = (config.PHOTO_HEIGHT * 2) + (config.PADDING * 3) + (config.BORDER_WIDTH * 2) + config.HEADER_HEIGHT;
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add title and timestamp
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(stripTitle, canvas.width / 2, 40);

    ctx.font = '14px Arial';
    ctx.fillStyle = '#6B7280';
    ctx.fillText(new Date().toLocaleString(), canvas.width / 2, 65);

    let photosLoaded = 0;
    const totalPhotos = capturedPhotos.length;

    capturedPhotos.forEach((photoURL, index) => {
      const img = new Image();
      img.onload = () => {
        let x, y;
        
        if (photoMode === 'TWO_PHOTO') {
          // Vertical layout: photos stacked top to bottom
          x = config.BORDER_WIDTH + config.PADDING;
          y = config.HEADER_HEIGHT + config.BORDER_WIDTH + config.PADDING + (index * (config.PHOTO_HEIGHT + config.PADDING));
        } else {
          // 2x2 grid layout
          const row = Math.floor(index / 2);
          const col = index % 2;
          x = config.BORDER_WIDTH + config.PADDING + (col * (config.PHOTO_WIDTH + config.PADDING));
          y = config.HEADER_HEIGHT + config.BORDER_WIDTH + config.PADDING + (row * (config.PHOTO_HEIGHT + config.PADDING));
        }

        // Draw photo with rounded corners
        ctx.save();
        createRoundedRect(ctx, x, y, config.PHOTO_WIDTH, config.PHOTO_HEIGHT, config.CORNER_RADIUS);
        ctx.clip();
        ctx.drawImage(img, x, y, config.PHOTO_WIDTH, config.PHOTO_HEIGHT);
        ctx.restore();

        // Add border
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 2;
        createRoundedRect(ctx, x, y, config.PHOTO_WIDTH, config.PHOTO_HEIGHT, config.CORNER_RADIUS);
        ctx.stroke();

        // Add photo number badge
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        createRoundedRect(ctx, x + 15, y + 15, config.BADGE_SIZE, config.BADGE_SIZE, config.BADGE_RADIUS);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${index + 1}`, x + 30, y + 35);

        photosLoaded++;
        if (photosLoaded === totalPhotos) {
          setCollageURL(canvas.toDataURL("image/jpeg", 0.9));
        }
      };
      img.onerror = () => {
        console.error(`Failed to load image ${index + 1}`);
        photosLoaded++;
        if (photosLoaded === totalPhotos) {
          setCollageURL(canvas.toDataURL("image/jpeg", 0.9));
        }
      };
      img.src = photoURL;
    });
  }, [capturedPhotos, stripTitle, photoMode]);

  // Update collage dependency to include stripTitle and photoMode
  useEffect(() => {
    const currentMode = PHOTO_MODES[photoMode];
    if (capturedPhotos.length === currentMode.totalPhotos) {
      createCollage();
      if (isPhotoSession) {
        resetSession();
      }
    }
  }, [capturedPhotos, stripTitle, createCollage, isPhotoSession, resetSession, photoMode]);

  // Reset photos function
  const resetPhotos = useCallback(() => {
    setCapturedPhotos([]);
    setCollageURL(null);
    setCurrentPhotoIndex(0);
    // Restart camera
    setTimeout(() => {
      startCamera();
    }, 100);
  }, [startCamera]);

  // Countdown effect for individual photos
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      takeSnapshot();
      setCountdown(null);
    }
  }, [countdown, takeSnapshot]);

  // Session countdown effect
  useEffect(() => {
    const currentMode = PHOTO_MODES[photoMode];
    if (sessionCountdown > 0) {
      const timer = setTimeout(() => setSessionCountdown(sessionCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (sessionCountdown === 0) {
      if (currentPhotoIndex < currentMode.totalPhotos) {
        setCountdown(PHOTO_SESSION_CONFIG.COUNTDOWN_DURATION);
        if (currentPhotoIndex < currentMode.totalPhotos - 1) {
          setSessionCountdown(PHOTO_SESSION_CONFIG.INTERVAL_DURATION);
        }
      }
    }
  }, [sessionCountdown, currentPhotoIndex, photoMode]);

  if (error) {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-2xl font-bold mb-4 text-red-600">Camera Error</h1>
            <p className="text-gray-700 mb-4">{error}</p>
            <Button onClick={startCamera} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600">
      <div className="flex flex-col">
        <h1 className="text-3xl font-bold text-white text-center py-4">
          📸 Hi-PhotoBooth
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 max-w-5xl mx-auto">
          {/* Camera Section - Takes most space */}
          <Card className="bg-white/90 backdrop-blur-sm lg:col-span-2 flex flex-col">
            <CardContent className="p-3 flex flex-col">
              <div className="relative flex items-center justify-center">
                <div className={`relative ${photoMode === 'TWO_PHOTO' ? 'w-full max-w-lg aspect-[16/9]' : 'w-full max-w-sm aspect-square'}`}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full ${photoMode === 'TWO_PHOTO' ? 'aspect-[16/9]' : 'aspect-square'} rounded-xl object-cover shadow-2xl border-4 border-white/20`}
                    style={{
                      transform: 'scaleX(-1)',
                      filter: filter !== 'none' ? `
                        ${filter === 'warm' ? 'sepia(0.5) saturate(1.2) hue-rotate(-15deg)' : ''}
                        ${filter === 'cool' ? 'hue-rotate(15deg) saturate(1.1)' : ''}
                        ${filter === 'vintage' ? 'sepia(0.8) contrast(1.2) brightness(1.1)' : ''}
                        ${filter === 'bw' ? 'grayscale(1)' : ''}
                      ` : 'none'
                    }}
                  />
                
                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                      <div className="text-white text-8xl font-bold animate-bounce">
                        {countdown}
                      </div>
                    </div>
                  )}

                  {sessionCountdown !== null && !countdown && (
                    <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                      Photo {currentPhotoIndex + 1} in {sessionCountdown}s
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="mt-2 space-y-2 bg-gray-50/50 rounded-lg p-2">
                {/* Strip Title - Close to viewfinder */}
                <div>
                  <div className="text-center mb-1">
                    <label className="font-medium text-xs text-gray-700 mr-2">Event Name:</label>
                    <input
                      type="text"
                      value={stripTitle}
                      onChange={(e) => setStripTitle(e.target.value)}
                      placeholder={defaultEventName}
                      className="px-2 py-1 border border-gray-300 rounded text-xs max-w-[160px] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                {/* Photo Mode Selector */}
                <div>
                  <h3 className="font-semibold mb-1 text-center text-sm text-gray-800">Photo Mode</h3>
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant={photoMode === 'TWO_PHOTO' ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setPhotoMode('TWO_PHOTO');
                        // Reset photos when changing mode
                        setCapturedPhotos([]);
                        setCollageURL(null);
                      }}
                      className="px-3 py-1 text-xs font-medium h-7 flex items-center justify-center"
                    >
                      📷 2 Photos (16:9)
                    </Button>
                    <Button
                      variant={photoMode === 'FOUR_PHOTO' ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setPhotoMode('FOUR_PHOTO');
                        // Reset photos when changing mode
                        setCapturedPhotos([]);
                        setCollageURL(null);
                      }}
                      className="px-3 py-1 text-xs font-medium h-7 flex items-center justify-center"
                    >
                      📸 4 Photos (Square)
                    </Button>
                  </div>
                </div>
                
                {/* Filters */}
                <div>
                  <h3 className="font-semibold mb-1 text-center text-sm text-gray-800">Filters</h3>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {FILTERS.map((f) => (
                      <Button
                        key={f.name}
                        variant={filter === f.name ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(f.name)}
                        className="min-w-[50px] px-2 py-1 text-xs font-medium h-7 flex items-center justify-center"
                      >
                        {f.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => setCountdown(3)}
                    disabled={!cameraReady || countdown !== null}
                    size="default"
                    className="px-6 py-2 text-sm font-medium"
                  >
                    📷 Take Photo
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={startSession}
                    disabled={!cameraReady || isPhotoSession}
                    size="default"
                    className="px-6 py-2 text-sm font-medium"
                  >
                    🎬 {PHOTO_MODES[photoMode].totalPhotos}-Photo Session
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Photos Section - Natural height */}
          <Card className="bg-white/90 backdrop-blur-sm flex flex-col">
            <CardContent className="p-2 flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-base font-semibold">
                  Photos ({capturedPhotos.length})
                </h2>
                {capturedPhotos.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetPhotos}
                    className="text-xs px-2 py-1 h-6 flex items-center justify-center"
                  >
                    🗑️ Clear Photos
                  </Button>
                )}
              </div>

              <div className="flex flex-col">
                <div className={`grid gap-1 mb-2 ${photoMode === 'TWO_PHOTO' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                  {Array.from({ length: PHOTO_MODES[photoMode].totalPhotos }, (_, index) => (
                    <div 
                      key={index} 
                      className={`relative bg-gray-100 rounded-sm border-2 border-dashed border-gray-300 ${
                        photoMode === 'TWO_PHOTO' ? 'aspect-[16/9]' : 'aspect-square'
                      }`}
                    >
                      {capturedPhotos[index] ? (
                        <>
                          <img
                            src={capturedPhotos[index]}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-full object-cover rounded-sm"
                          />
                          <div className="absolute top-0.5 left-0.5 bg-black/70 text-white w-3 h-3 rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-gray-400 text-xs">{index + 1}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {capturedPhotos.length === PHOTO_MODES[photoMode].totalPhotos && collageURL ? (
                  <div className="flex flex-col">
                    <div className="border-t border-gray-200 pt-1 mb-1">
                      <h3 className="font-semibold text-center text-xs">Your photo is done!</h3>
                    </div>
                    <div className="mb-2">
                      <img
                        src={collageURL}
                        alt="Photo collage"
                        className="w-full h-auto object-contain rounded-sm border border-gray-200"
                      />
                    </div>
                    <div>
                      <Button
                        className="w-full text-xs py-2 h-8 font-medium"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.download = `photo-booth-${Date.now()}.jpg`;
                          link.href = collageURL;
                          link.click();
                        }}
                      >
                        💾 Download Photo Strip
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-gray-400 py-8">
                    <div className="text-center">
                      <div className="text-2xl mb-1">📸</div>
                      <p className="text-xs">Take {PHOTO_MODES[photoMode].totalPhotos} photos for collage</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
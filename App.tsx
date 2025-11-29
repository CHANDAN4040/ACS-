import React, { useState, useEffect, useContext, createContext, useRef, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Images, 
  Scissors, 
  Layers, 
  Settings, 
  Home, 
  Zap, 
  Moon, 
  Sun, 
  Check, 
  X, 
  Upload, 
  Download, 
  Languages, 
  Eye,
  Loader2,
  Trash2,
  Minimize2,
  Camera,
  Wand2,
  Maximize,
  LogOut,
  User,
  ArrowRight
} from 'lucide-react';
import { AppLanguage, ThemeMode, AppState, PdfFile, ProcessingStatus } from './types';
import { TRANSLATIONS } from './constants';
import { imagesToPdf, mergePdfs, splitPdf, compressPdf, downloadPdf } from './services/pdfService';
import { performOCR, removeImageBackground } from './services/geminiService';

// --- Context ---

interface UserProfile {
  name: string;
  email: string;
  isLoggedIn: boolean;
}

const AppContext = createContext<AppState & { user: UserProfile, login: (email: string) => void, logout: () => void }>({} as any);

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<AppLanguage>(AppLanguage.ENGLISH);
  const [theme, setTheme] = useState<ThemeMode>(ThemeMode.SYSTEM);
  const [user, setUser] = useState<UserProfile>({ name: '', email: '', isLoggedIn: false });

  useEffect(() => {
    // Load from storage (simulated)
    const storedLang = localStorage.getItem('language') as AppLanguage;
    if (storedLang) setLanguage(storedLang);

    const storedTheme = localStorage.getItem('theme') as ThemeMode;
    if (storedTheme) setTheme(storedTheme);
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme(ThemeMode.DARK);

    const storedUser = localStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  useEffect(() => {
    localStorage.setItem('language', language);
    localStorage.setItem('theme', theme);

    if (theme === ThemeMode.DARK || (theme === ThemeMode.SYSTEM && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [language, theme]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === AppLanguage.ENGLISH ? AppLanguage.HINDI : AppLanguage.ENGLISH);
  };

  const login = (email: string) => {
    const newUser = { name: email.split('@')[0], email, isLoggedIn: true };
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser({ name: '', email: '', isLoggedIn: false });
    localStorage.removeItem('user');
  };

  return (
    <AppContext.Provider value={{ language, theme, toggleLanguage, setTheme, user, login, logout }}>
      {children}
    </AppContext.Provider>
  );
};

// --- Reusable UI Components ---

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}> = ({ children, variant = 'primary', size, className, ...props }) => {
  const baseStyle = "inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/30",
    secondary: "bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700",
    outline: "border-2 border-brand-600 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-800",
    ghost: "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-6 py-3",
    lg: "px-8 py-4 text-lg"
  };

  // Default sizes matching original styling
  const defaultSizeClass = variant === 'ghost' ? "px-4 py-2" : "px-6 py-3";
  const sizeClass = size ? sizes[size] : defaultSizeClass;

  return (
    <button className={`${baseStyle} ${variants[variant]} ${sizeClass} ${className || ''}`} {...props}>
      {children}
    </button>
  );
};

const Card: React.FC<{ children: React.ReactNode, className?: string, onClick?: () => void }> = ({ children, className, onClick }) => (
  <div onClick={onClick} className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 transition-all hover:shadow-md ${className || ''}`}>
    {children}
  </div>
);

const FileUploader: React.FC<{ onFilesSelected: (files: File[]) => void, accept: string, multiple?: boolean, label: string }> = ({ onFilesSelected, accept, multiple, label }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  return (
    <div 
      onClick={() => inputRef.current?.click()} 
      className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-slate-800/50 transition-colors group"
    >
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={handleChange} />
      <div className="bg-brand-100 dark:bg-slate-700 text-brand-600 dark:text-brand-400 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
        <Upload size={32} />
      </div>
      <p className="font-medium text-gray-700 dark:text-gray-200">{label}</p>
      <p className="text-sm text-gray-500 mt-2">Supports {accept.replace(/\./g, '').toUpperCase()}</p>
    </div>
  );
};

// --- Pages ---

const LoginScreen: React.FC = () => {
  const { language, login, user } = useContext(AppContext);
  const t = TRANSLATIONS[language];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user.isLoggedIn) navigate('/');
  }, [user, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      login(email);
      navigate('/');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-brand-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Zap size={32} className="text-brand-600" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{t.signIn}</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Access your PDF tools anywhere
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">{t.email}</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="relative block w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-gray-100 focus:z-10 focus:border-brand-500 focus:outline-none focus:ring-brand-500 sm:text-sm"
                placeholder={t.email}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">{t.password}</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="relative block w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-gray-900 dark:text-gray-100 focus:z-10 focus:border-brand-500 focus:outline-none focus:ring-brand-500 sm:text-sm"
                placeholder={t.password}
              />
            </div>
          </div>

          <div>
            <Button type="submit" className="w-full group relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <ArrowRight size={20} className="text-brand-300 group-hover:text-brand-200" />
              </span>
              {t.signIn}
            </Button>
          </div>
        </form>
        
        <div className="text-center mt-6">
          <Button variant="ghost" className="text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400">
             <Download className="mr-2 h-4 w-4" />
             {t.downloadApp}
          </Button>
        </div>
      </div>
    </div>
  );
};

const HomeScreen: React.FC = () => {
  const { language } = useContext(AppContext);
  const t = TRANSLATIONS[language];

  const features = [
    { id: 'compress', icon: Minimize2, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', title: t.compressPdf, desc: t.compressDesc, link: '/compress-pdf' },
    { id: 'img-pdf', icon: Images, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', title: t.imageToPdf, desc: t.imageToPdfDesc, link: '/image-to-pdf' },
    { id: 'camera-pdf', icon: Camera, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30', title: t.cameraToPdf, desc: t.cameraDesc, link: '/camera-pdf' },
    { id: 'merge', icon: Layers, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', title: t.mergePdf, desc: t.mergeDesc, link: '/merge-pdf' },
    { id: 'split', icon: Scissors, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', title: t.splitPdf, desc: t.splitDesc, link: '/split-pdf' },
    { id: 'bg-remove', icon: Wand2, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30', title: t.bgRemover, desc: t.bgRemoverDesc, link: '/bg-remover' },
    { id: 'resize', icon: Maximize, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30', title: t.resizeImage, desc: t.resizeDesc, link: '/resize-image' },
    { id: 'ocr', icon: Eye, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', title: t.ocrScanner, desc: t.ocrDesc, link: '/ocr' },
  ];

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center space-x-2 mb-2">
         <div className="h-2 w-10 bg-brand-500 rounded-full"></div>
         <h2 className="text-2xl font-bold tracking-tight">{t.home}</h2>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {features.map((f) => (
          <Link key={f.id} to={f.link}>
            <Card className="h-full hover:border-brand-500 dark:hover:border-brand-500 group">
              <div className="flex items-start space-x-4">
                <div className={`${f.bg} ${f.color} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                  <f.icon size={28} />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">{f.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

const CameraToPdfScreen: React.FC = () => {
  const { language } = useContext(AppContext);
  const t = TRANSLATIONS[language];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>('idle');

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');
    setCapturedImages(prev => [...prev, dataUrl]);
  };

  const convertToPdf = async () => {
    if (capturedImages.length === 0) return;
    setStatus('processing');
    stopCamera();
    
    try {
      // Convert Data URLs to Files
      const files = await Promise.all(capturedImages.map(async (url, idx) => {
        const res = await fetch(url);
        const blob = await res.blob();
        return new File([blob], `scan_${idx}.jpg`, { type: 'image/jpeg' });
      }));

      const pdfBytes = await imagesToPdf(files);
      downloadPdf(pdfBytes, `scan_${Date.now()}.pdf`);
      setStatus('success');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
       <div className="flex flex-col items-center justify-center p-12 bg-green-50 dark:bg-green-900/20 rounded-2xl text-center">
         <Check size={48} className="text-green-500 mb-4" />
         <h3 className="text-xl font-bold">{t.success}</h3>
         <Button onClick={() => { setCapturedImages([]); setStatus('idle'); }} className="mt-4" variant="outline">{t.cameraToPdf} Again</Button>
       </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 h-[80vh] flex flex-col">
      {!isCameraActive && capturedImages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-2xl">
          <Camera size={64} className="text-gray-400 mb-4" />
          <Button onClick={startCamera}>{t.capture} Photos</Button>
        </div>
      ) : (
        <div className="relative flex-1 bg-black rounded-2xl overflow-hidden flex flex-col">
           {isCameraActive ? (
             <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
           ) : (
             <div className="absolute inset-0 flex items-center justify-center text-white">
                <p>Preview Mode</p>
             </div>
           )}
           
           {/* Controls */}
           <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
              <div 
                className="w-12 h-12 rounded-lg bg-white/20 border border-white/40 overflow-hidden"
                onClick={() => {}}
              >
                {capturedImages.length > 0 && (
                  <img src={capturedImages[capturedImages.length - 1]} alt="last" className="w-full h-full object-cover" />
                )}
              </div>

              <button 
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center active:scale-90 transition-transform"
              >
                <div className="w-14 h-14 rounded-full border-2 border-black" />
              </button>

              <button 
                onClick={convertToPdf}
                disabled={capturedImages.length === 0}
                className="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center disabled:opacity-50"
              >
                <Check size={24} />
              </button>
           </div>
           
           <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
             {capturedImages.length} Pages
           </div>
           
           <button onClick={() => { stopCamera(); setCapturedImages([]); }} className="absolute top-4 left-4 p-2 bg-black/50 rounded-full text-white">
             <X size={20} />
           </button>
        </div>
      )}
    </div>
  );
};

const BgRemoverScreen: React.FC = () => {
  const { language } = useContext(AppContext);
  const t = TRANSLATIONS[language];
  const [file, setFile] = useState<File | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');

  const handleRemoveBg = async () => {
    if (!file) return;
    setStatus('processing');
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const newImageBase64 = await removeImageBackground(base64);
        setResultImage(`data:image/jpeg;base64,${newImageBase64}`);
        setStatus('success');
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  const handleDownload = () => {
    if (resultImage) {
      const link = document.createElement('a');
      link.href = resultImage;
      link.download = `bg_removed_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <h2 className="text-2xl font-bold">{t.bgRemover}</h2>
      
      {!file ? (
        <FileUploader label={t.selectFiles} accept=".jpg,.png,.jpeg" onFilesSelected={(fs) => setFile(fs[0])} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <p className="font-medium text-sm">Original</p>
                <div className="bg-gray-100 dark:bg-slate-800 rounded-xl overflow-hidden aspect-square border dark:border-slate-700">
                   <img src={URL.createObjectURL(file)} className="w-full h-full object-contain" alt="original" />
                </div>
             </div>
             
             {resultImage && (
               <div className="space-y-2">
                 <p className="font-medium text-sm">Result</p>
                 <div className="bg-[url('https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse1.mm.bing.net%2Fth%3Fid%3DOIP.U5F4q6YkK1b7Kk5F4q6YkK1b7K%26pid%3DApi&f=1&ipt=0e68d374438346387037703770377037')] bg-repeat bg-[length:20px_20px] rounded-xl overflow-hidden aspect-square border dark:border-slate-700">
                    <img src={resultImage} className="w-full h-full object-contain" alt="result" />
                 </div>
               </div>
             )}
          </div>

          {status === 'processing' ? (
             <div className="flex flex-col items-center py-8">
               <Loader2 className="animate-spin text-brand-600 mb-2" size={32} />
               <p className="text-sm text-gray-500">{t.removingBg}</p>
             </div>
          ) : resultImage ? (
             <div className="flex space-x-3">
               <Button onClick={() => { setFile(null); setResultImage(null); setStatus('idle'); }} variant="secondary" className="flex-1">{t.clear}</Button>
               <Button onClick={handleDownload} className="flex-1">{t.download}</Button>
             </div>
          ) : (
             <div className="flex space-x-3">
               <Button onClick={() => setFile(null)} variant="ghost" className="text-red-500"><Trash2 size={20}/></Button>
               <Button onClick={handleRemoveBg} className="flex-1">{t.removeBg}</Button>
             </div>
          )}
        </div>
      )}
    </div>
  );
};

const ImageResizeScreen: React.FC = () => {
  const { language } = useContext(AppContext);
  const t = TRANSLATIONS[language];
  const [file, setFile] = useState<File | null>(null);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [status, setStatus] = useState<ProcessingStatus>('idle');

  useEffect(() => {
    if (file) {
      const img = new Image();
      img.onload = () => {
        setWidth(img.width);
        setHeight(img.height);
        setAspectRatio(img.width / img.height);
      };
      img.src = URL.createObjectURL(file);
    }
  }, [file]);

  const handleWidthChange = (w: number) => {
    setWidth(w);
    if (maintainAspect) setHeight(Math.round(w / aspectRatio));
  };

  const handleHeightChange = (h: number) => {
    setHeight(h);
    if (maintainAspect) setWidth(Math.round(h * aspectRatio));
  };

  const handleResize = () => {
    if (!file || width <= 0 || height <= 0) return;
    setStatus('processing');
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `resized_${file.name}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setStatus('success');
        }
      }, file.type);
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div className="space-y-6 pb-24">
      <h2 className="text-2xl font-bold">{t.resizeImage}</h2>

      {status === 'success' ? (
         <div className="flex flex-col items-center justify-center p-12 bg-green-50 dark:bg-green-900/20 rounded-2xl text-center">
           <Check size={48} className="text-green-500 mb-4" />
           <h3 className="text-xl font-bold">{t.success}</h3>
           <Button onClick={() => { setFile(null); setStatus('idle'); }} className="mt-4" variant="outline">{t.resize} Another</Button>
         </div>
      ) : !file ? (
        <FileUploader label={t.selectFiles} accept=".jpg,.png,.jpeg" onFilesSelected={(fs) => setFile(fs[0])} />
      ) : (
        <div className="space-y-6">
          <div className="flex justify-center bg-gray-100 dark:bg-slate-800 rounded-xl p-4">
            <img src={URL.createObjectURL(file)} className="max-h-48 object-contain" alt="preview" />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-sm font-medium mb-1">{t.width}</label>
               <input 
                 type="number" 
                 value={width} 
                 onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                 className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800" 
               />
             </div>
             <div>
               <label className="block text-sm font-medium mb-1">{t.height}</label>
               <input 
                 type="number" 
                 value={height} 
                 onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                 className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800" 
               />
             </div>
          </div>

          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="aspect" 
              checked={maintainAspect} 
              onChange={(e) => setMaintainAspect(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded" 
            />
            <label htmlFor="aspect" className="text-sm">{t.maintainAspectRatio}</label>
          </div>

          <div className="flex space-x-3 pt-4">
             <Button onClick={() => setFile(null)} variant="secondary" className="flex-1">{t.clear}</Button>
             <Button onClick={handleResize} className="flex-1">{t.resize}</Button>
          </div>
        </div>
      )}
    </div>
  );
};

const CompressPdfScreen: React.FC = () => {
  const { language } = useContext(AppContext);
  const t = TRANSLATIONS[language];
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{ original: number, compressed: number } | null>(null);

  const qualityMap = {
    low: 0.8,    // High quality, Low compression
    medium: 0.6, // Medium quality
    high: 0.4    // Low quality, High compression
  };

  const handleCompress = async () => {
    if (!file) return;
    setStatus('processing');
    setProgress(0);
    try {
      const startTime = Date.now();
      const compressedBytes = await compressPdf(file, qualityMap[quality], (current, total) => {
        setProgress(Math.round((current / total) * 100));
      });
      
      const compressedSize = compressedBytes.length;
      setStats({
        original: file.size,
        compressed: compressedSize
      });
      
      // Artificial delay to show success animation if it was too fast
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) await new Promise(r => setTimeout(r, 1000));
      
      downloadPdf(compressedBytes, `compressed_${file.name}`);
      setStatus('success');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSavings = () => {
    if (!stats) return 0;
    const saving = ((stats.original - stats.compressed) / stats.original) * 100;
    return Math.max(0, saving).toFixed(1);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t.compressPdf}</h2>
        {file && status !== 'processing' && (
          <Button variant="ghost" onClick={() => { setFile(null); setStatus('idle'); setStats(null); }}>
            <Trash2 size={20} className="text-red-500" />
          </Button>
        )}
      </div>

      {status === 'success' && stats ? (
         <div className="flex flex-col items-center justify-center p-6 bg-green-50 dark:bg-green-900/20 rounded-2xl text-center border border-green-100 dark:border-green-900">
           <div className="bg-green-100 text-green-600 p-3 rounded-full mb-4 animate-bounce">
             <Check size={32} />
           </div>
           <h3 className="text-xl font-bold text-green-700 dark:text-green-300 mb-4">{t.success}</h3>
           
           <div className="grid grid-cols-2 gap-4 w-full mb-6">
             <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm">
               <p className="text-xs text-gray-500 uppercase">{t.originalSize}</p>
               <p className="text-lg font-bold text-gray-700 dark:text-gray-200">{formatSize(stats.original)}</p>
             </div>
             <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-2 border-green-500">
               <p className="text-xs text-green-600 uppercase">{t.compressedSize}</p>
               <p className="text-lg font-bold text-green-600">{formatSize(stats.compressed)}</p>
             </div>
           </div>
           
           <div className="inline-block bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200 px-4 py-1 rounded-full text-sm font-bold mb-6">
             {t.saved} {getSavings()}%!
           </div>

           <Button onClick={() => { setFile(null); setStatus('idle'); setStats(null); }} className="w-full" variant="outline">{t.compressPdf} Another</Button>
         </div>
      ) : status === 'processing' ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-brand-200 rounded-full animate-pulse-ring"></div>
            <div className="relative bg-white dark:bg-slate-700 p-4 rounded-full">
              <Loader2 size={48} className="animate-spin text-brand-600" />
            </div>
          </div>
          <p className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">{t.compressing}</p>
          <div className="w-full max-w-xs bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
            <div className="bg-brand-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="text-sm text-gray-500 mt-2">{progress}%</p>
        </div>
      ) : (
        <>
          {!file ? (
            <FileUploader label={t.selectFiles} accept=".pdf" onFilesSelected={(fs) => setFile(fs[0])} />
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <FileText className="text-red-500 shrink-0" size={28} />
                  <div className="overflow-hidden">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t.compressionLevel}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'low', label: t.low, desc: 'High Quality' }, 
                    { id: 'medium', label: t.medium, desc: 'Balanced' }, 
                    { id: 'high', label: t.high, desc: 'Max Compress' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setQuality(opt.id as any)}
                      className={`p-3 rounded-xl border-2 transition-all text-center ${quality === opt.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-transparent bg-white dark:bg-slate-800'}`}
                    >
                      <p className={`font-bold ${quality === opt.id ? 'text-brand-700 dark:text-brand-300' : ''}`}>{opt.label}</p>
                      <p className="text-[10px] text-gray-500">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleCompress} className="w-full text-lg shadow-xl shadow-brand-500/20">
                {t.compressNow}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ImageToPdfScreen: React.FC = () => {
  const { language } = useContext(AppContext);
  const t = TRANSLATIONS[language];
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>('idle');

  const handleConvert = async () => {
    if (files.length === 0) return;
    setStatus('processing');
    try {
      const pdfBytes = await imagesToPdf(files);
      downloadPdf(pdfBytes, `images_merged_${Date.now()}.pdf`);
      setStatus('success');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t.imageToPdf}</h2>
        {files.length > 0 && (
          <Button variant="ghost" onClick={() => { setFiles([]); setStatus('idle'); }} className="text-red-500 hover:bg-red-50">
            <Trash2 size={20} />
          </Button>
        )}
      </div>

      {status === 'success' ? (
        <div className="flex flex-col items-center justify-center p-12 bg-green-50 dark:bg-green-900/20 rounded-2xl text-center">
           <div className="bg-green-100 text-green-600 p-4 rounded-full mb-4">
             <Check size={48} />
           </div>
           <h3 className="text-xl font-bold text-green-700 dark:text-green-300 mb-2">{t.success}</h3>
           <Button onClick={() => { setFiles([]); setStatus('idle'); }} variant="outline" className="mt-4">
             {t.convert} {t.clear}
           </Button>
        </div>
      ) : status === 'processing' ? (
        <div className="flex flex-col items-center justify-center p-12">
          <Loader2 size={48} className="animate-spin text-brand-600 mb-4" />
          <p className="text-lg font-medium">{t.processing}</p>
        </div>
      ) : (
        <>
          <FileUploader 
            label={t.selectFiles} 
            accept=".jpg,.jpeg,.png" 
            multiple 
            onFilesSelected={(newFiles) => setFiles(prev => [...prev, ...newFiles])} 
          />

          {files.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative aspect-square bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden border dark:border-slate-600">
                    <img src={URL.createObjectURL(f)} alt="preview" className="w-full h-full object-cover" />
                    <div className="absolute top-1 right-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                      {i + 1}
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={handleConvert} className="w-full">
                {t.convert} ({files.length})
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const MergePdfScreen: React.FC = () => {
  const { language } = useContext(AppContext);
  const t = TRANSLATIONS[language];
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>('idle');

  const handleMerge = async () => {
    setStatus('processing');
    try {
      const pdfBytes = await mergePdfs(files);
      downloadPdf(pdfBytes, `merged_${Date.now()}.pdf`);
      setStatus('success');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t.mergePdf}</h2>
        {files.length > 0 && (
          <Button variant="ghost" onClick={() => { setFiles([]); setStatus('idle'); }}>
            <Trash2 size={20} className="text-red-500" />
          </Button>
        )}
      </div>

      {status === 'success' ? (
         <div className="flex flex-col items-center justify-center p-12 bg-green-50 dark:bg-green-900/20 rounded-2xl text-center">
          <Check size={48} className="text-green-500 mb-4" />
          <h3 className="text-xl font-bold">{t.success}</h3>
          <Button onClick={() => { setFiles([]); setStatus('idle'); }} className="mt-4" variant="outline">{t.convert} More</Button>
         </div>
      ) : status === 'processing' ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-brand-600" size={40}/></div>
      ) : (
        <>
          <FileUploader label={t.selectFiles} accept=".pdf" multiple onFilesSelected={(newFiles) => setFiles(p => [...p, ...newFiles])} />
          {files.length > 0 && (
            <div className="space-y-3">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <FileText className="text-red-500 shrink-0" size={24} />
                    <span className="truncate text-sm font-medium">{f.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              ))}
              <Button onClick={handleMerge} className="w-full mt-4">{t.mergePdf}</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const SplitPdfScreen: React.FC = () => {
  const { language } = useContext(AppContext);
  const t = TRANSLATIONS[language];
  const [file, setFile] = useState<File | null>(null);
  const [range, setRange] = useState('');
  const [status, setStatus] = useState<ProcessingStatus>('idle');

  const handleSplit = async () => {
    if (!file || !range) return;
    setStatus('processing');
    try {
      const pdfBytes = await splitPdf(file, range);
      downloadPdf(pdfBytes, `split_${Date.now()}.pdf`);
      setStatus('success');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <h2 className="text-2xl font-bold">{t.splitPdf}</h2>
      
      {status === 'success' ? (
        <div className="text-center p-8 bg-green-50 dark:bg-green-900/20 rounded-xl">
          <Check className="mx-auto text-green-500 mb-2" size={40} />
          <p className="font-bold">{t.success}</p>
          <Button onClick={() => { setFile(null); setRange(''); setStatus('idle'); }} className="mt-4" variant="outline">Reset</Button>
        </div>
      ) : status === 'processing' ? (
        <div className="flex justify-center"><Loader2 className="animate-spin text-brand-600" size={40}/></div>
      ) : (
        <>
          {!file ? (
             <FileUploader label={t.selectFiles} accept=".pdf" onFilesSelected={(fs) => setFile(fs[0])} />
          ) : (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex items-center space-x-3 mb-6">
                <FileText className="text-red-500" size={32} />
                <div className="overflow-hidden">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t.pageRange}
              </label>
              <input 
                type="text" 
                value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder="e.g. 1-3, 5, 8"
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none transition-all mb-4"
              />
              
              <div className="flex space-x-3">
                 <Button variant="secondary" onClick={() => setFile(null)} className="flex-1">{t.clear}</Button>
                 <Button onClick={handleSplit} disabled={!range} className="flex-1">{t.download}</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const OcrScannerScreen: React.FC = () => {
  const { language } = useContext(AppContext);
  const t = TRANSLATIONS[language];
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>('');
  const [status, setStatus] = useState<ProcessingStatus>('idle');

  const handleOcr = async () => {
    if (!file) return;
    setStatus('processing');
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const text = await performOCR(base64);
        setResult(text);
        setStatus('success');
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <h2 className="text-2xl font-bold">{t.ocrScanner}</h2>
      
      {!file ? (
        <FileUploader label={t.selectFiles} accept=".jpg,.png,.jpeg" onFilesSelected={(fs) => setFile(fs[0])} />
      ) : (
        <div className="space-y-4">
          <div className="relative h-48 w-full bg-gray-100 dark:bg-slate-800 rounded-xl overflow-hidden">
             <img src={URL.createObjectURL(file)} className="w-full h-full object-contain" alt="preview" />
          </div>
          
          {status === 'processing' ? (
             <div className="flex flex-col items-center py-8">
               <Loader2 className="animate-spin text-brand-600 mb-2" size={32} />
               <p className="text-sm text-gray-500">Gemini is reading...</p>
             </div>
          ) : result ? (
             <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
               <div className="flex justify-between items-center mb-2">
                 <h3 className="font-bold">Extracted Text</h3>
                 <Button variant="ghost" onClick={() => {navigator.clipboard.writeText(result)}} size="sm">Copy</Button>
               </div>
               <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg text-sm font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                 {result}
               </div>
               <Button onClick={() => { setFile(null); setResult(''); setStatus('idle'); }} variant="outline" className="w-full mt-4">Scan Another</Button>
             </div>
          ) : (
             <Button onClick={handleOcr} className="w-full">{t.convert}</Button>
          )}
        </div>
      )}
    </div>
  );
};

const SettingsScreen: React.FC = () => {
  const { language, toggleLanguage, theme, setTheme, user, logout } = useContext(AppContext);
  const t = TRANSLATIONS[language];
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t.settings}</h2>
      
      {user.isLoggedIn && (
        <Card className="flex items-center justify-between border-brand-200 dark:border-brand-900 bg-brand-50 dark:bg-brand-900/10">
          <div className="flex items-center space-x-3">
             <div className="h-10 w-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold">
               {user.name.charAt(0).toUpperCase()}
             </div>
             <div>
               <p className="font-bold">{user.name}</p>
               <p className="text-xs text-gray-500">{user.email}</p>
             </div>
          </div>
          <Button variant="ghost" onClick={() => { logout(); navigate('/login'); }} size="sm">
            <LogOut size={18} />
          </Button>
        </Card>
      )}

      <Card className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Languages className="text-brand-500" />
          <span className="font-medium">{t.language}</span>
        </div>
        <button 
          onClick={toggleLanguage}
          className="relative inline-flex h-8 w-14 items-center rounded-full bg-gray-200 dark:bg-slate-700 transition-colors"
        >
          <span className={`${language === AppLanguage.HINDI ? 'translate-x-7' : 'translate-x-1'} inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm flex items-center justify-center text-xs font-bold`}>
            {language === AppLanguage.HINDI ? 'Hi' : 'En'}
          </span>
        </button>
      </Card>

      <Card>
        <div className="flex items-center space-x-3 mb-4">
          <Moon className="text-brand-500" />
          <span className="font-medium">{t.darkMode}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[ThemeMode.LIGHT, ThemeMode.DARK, ThemeMode.SYSTEM].map((mode) => (
             <button
               key={mode}
               onClick={() => setTheme(mode)}
               className={`py-2 rounded-lg text-sm font-medium transition-all ${theme === mode ? 'bg-brand-600 text-white shadow-md' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'}`}
             >
               {mode.charAt(0).toUpperCase() + mode.slice(1)}
             </button>
          ))}
        </div>
      </Card>

      <div className="text-center text-xs text-gray-400 mt-12">
        <p>ACS PDF WALA v1.0.0</p>
        <p>Offline First • Privacy Focused</p>
      </div>
    </div>
  );
};

const Layout: React.FC = () => {
  const { language, user } = useContext(AppContext);
  const t = TRANSLATIONS[language];
  const location = useLocation();

  // Hide nav on Login
  if (location.pathname === '/login') {
     return (
       <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-200 p-6">
         <Routes>
           <Route path="/login" element={<LoginScreen />} />
         </Routes>
       </div>
     );
  }

  const navItems = [
    { path: '/', icon: Home, label: t.home },
    { path: '/settings', icon: Settings, label: t.settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-200 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link to="/">
              <div className="bg-brand-600 text-white p-1.5 rounded-lg">
                <Zap size={20} fill="currentColor" />
              </div>
            </Link>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-purple-600 dark:from-brand-400 dark:to-purple-400">
              {t.appName}
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            {!user.isLoggedIn ? (
              <Link to="/login" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                <User size={20} className="text-gray-600 dark:text-gray-300" />
              </Link>
            ) : (
              <Link to="/settings" className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 flex items-center justify-center text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-md mx-auto w-full p-6">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/image-to-pdf" element={<ImageToPdfScreen />} />
          <Route path="/merge-pdf" element={<MergePdfScreen />} />
          <Route path="/split-pdf" element={<SplitPdfScreen />} />
          <Route path="/compress-pdf" element={<CompressPdfScreen />} />
          <Route path="/ocr" element={<OcrScannerScreen />} />
          <Route path="/camera-pdf" element={<CameraToPdfScreen />} />
          <Route path="/bg-remover" element={<BgRemoverScreen />} />
          <Route path="/resize-image" element={<ImageResizeScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/login" element={<LoginScreen />} />
        </Routes>
      </main>

      {/* Bottom Navigation (Mobile First) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 pb-safe pt-2 px-6">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className="flex flex-col items-center justify-center w-full h-full space-y-1">
                <item.icon 
                  size={24} 
                  className={`transition-colors ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-slate-500'}`} 
                  fill={isActive ? "currentColor" : "none"}
                />
                <span className={`text-[10px] font-medium ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-slate-500'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <Router>
        <Layout />
      </Router>
    </AppProvider>
  );
};

export default App;
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { RenderOptions, RenderResultItem, UploadedFile } from './types';
import { DESIGN_STYLES, BUILDING_TYPES, CONTEXTS, WEATHERS, TIMES_OF_DAY, VIEWS } from './constants';
import { generateAutomaticPrompt, generateSketch, generateRender, generateRenderWithReference } from './services/geminiService';
import { UploadIcon, DownloadIcon, RefreshIcon, WandIcon, ZoomIcon, SaveIcon, DeleteIcon, CloseIcon, LockClosedIcon, LockOpenIcon } from './components/icons';

// Helper function
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

// --- Sub-components defined outside the main App component to prevent re-creation on re-renders ---

interface UploadAreaProps {
  onImageUpload: (file: UploadedFile) => void;
  uploadedImage: UploadedFile | null;
}
const UploadArea: React.FC<UploadAreaProps> = ({ onImageUpload, uploadedImage }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      fileToBase64(file).then(base64 => {
        onImageUpload({ base64, mimeType: file.type, name: file.name });
      });
    }
  }, [onImageUpload]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);
  
  const handleClick = () => inputRef.current?.click();

  return (
    <div className="bg-slate-800 p-4 rounded-xl shadow-lg">
      <h2 className="text-lg font-semibold text-white mb-3">Tải Lên Ảnh Phác Thảo (Optional)</h2>
      <div 
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-colors duration-200 ${isDragging ? 'border-blue-400 bg-slate-700' : 'border-gray-500'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input type="file" ref={inputRef} onChange={e => e.target.files && handleFile(e.target.files[0])} className="hidden" accept="image/png, image/jpeg, image/webp" />
        {uploadedImage ? (
            <img src={`data:${uploadedImage.mimeType};base64,${uploadedImage.base64}`} alt="Preview" className="max-h-24 rounded-md object-contain" />
        ) : (
          <>
            <UploadIcon className="w-10 h-10 text-gray-400 mb-2" />
            <p className="text-gray-300 text-center">Nhấp để tải ảnh lên hoặc kéo và thả</p>
            <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP (tối đa 30MB)</p>
          </>
        )}
      </div>
    </div>
  );
};

interface PromptInputProps {
  prompt: string;
  setPrompt: (p: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
}
const PromptInput: React.FC<PromptInputProps> = ({ prompt, setPrompt, onGenerate, isLoading }) => (
  <div className="bg-slate-800 p-4 rounded-xl shadow-lg">
    <h2 className="text-lg font-semibold text-white mb-3">Mô tả yêu cầu chính</h2>
    <div className="flex flex-col sm:flex-row gap-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Tạo một ảnh 3D thực tế từ hình ảnh này..."
        className="flex-grow bg-slate-900 text-gray-200 p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition h-24 sm:h-auto"
      />
      <button 
        onClick={onGenerate} 
        disabled={isLoading}
        className="flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:bg-blue-800 disabled:cursor-not-allowed"
      >
        <WandIcon className="w-5 h-5"/>
        {isLoading ? 'Đang tạo...' : 'Tạo tự động Prompt'}
      </button>
    </div>
  </div>
);

// --- CENTRALIZED CONTROL PANEL ---

interface AccordionProps {
  title: string;
  children: React.ReactNode;
}
const Accordion: React.FC<AccordionProps> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-3 bg-slate-700 hover:bg-slate-600 transition-colors"
      >
        <span className="font-semibold text-white">{title}</span>
        <svg className={`w-5 h-5 text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="p-4 bg-slate-800 border-t border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
};

const OptionSelect = ({ label, name, value, items, onChange }: { label: string, name: keyof RenderOptions, value: string, items: any[], onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void }) => (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <select name={name} value={value} onChange={onChange} className="w-full bg-slate-900 text-gray-200 p-2.5 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition">
        <option value="">Chưa chọn</option>
        {items.map(item => {
          if (typeof item === 'object' && item !== null && 'prompt' in item && 'name' in item) {
            return <option key={item.name} value={item.prompt}>{item.name}</option>;
          }
          return <option key={item} value={item}>{item}</option>;
        })}
      </select>
    </div>
);

interface ControlPanelProps {
  options: RenderOptions;
  onOptionsChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onRender: () => void;
  isLoading: boolean;
  isRenderDisabled: boolean;
  lockedStyle: RenderResultItem | null;
  onUnlock: () => void;
}
const ControlPanel: React.FC<ControlPanelProps> = ({ options, onOptionsChange, onRender, isLoading, isRenderDisabled, lockedStyle, onUnlock }) => {
    const [isOpen, setIsOpen] = useState(true); // Default open

    return (
        <div className="bg-slate-800 rounded-xl shadow-lg">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 bg-slate-800 hover:bg-slate-700/50 transition-colors rounded-xl"
                aria-expanded={isOpen}
                aria-controls="render-controls-panel"
            >
                <div className="flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <h2 className="text-lg font-semibold text-white">Render Kiến Trúc</h2>
                </div>
                <svg className={`w-6 h-6 text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            
            {isOpen && (
                <div id="render-controls-panel" className="p-4 border-t border-slate-700">
                    <h3 className="text-md font-semibold text-gray-300 mb-3">Tinh chỉnh tùy chọn</h3>
                    <div className="space-y-3">
                        <Accordion title="Phong cách & Loại hình">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <OptionSelect label="Phong cách thiết kế" name="style" value={options.style} items={DESIGN_STYLES} onChange={onOptionsChange} />
                                <OptionSelect label="Thể loại công trình" name="type" value={options.type} items={BUILDING_TYPES} onChange={onOptionsChange} />
                            </div>
                        </Accordion>
                        <Accordion title="Môi trường & Ánh sáng">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <OptionSelect label="Bối cảnh" name="context" value={options.context} items={CONTEXTS} onChange={onOptionsChange} />
                                <OptionSelect label="Ánh Sáng" name="weather" value={options.weather} items={WEATHERS} onChange={onOptionsChange} />
                                <OptionSelect label="Thời Tiết" name="time" value={options.time} items={TIMES_OF_DAY} onChange={onOptionsChange} />
                            </div>
                        </Accordion>
                        <Accordion title="Góc nhìn">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <OptionSelect label="View (Góc nhìn)" name="view" value={options.view} items={VIEWS} onChange={onOptionsChange}/>
                            </div>
                        </Accordion>
                    </div>

                    <div className="mt-6 flex flex-col gap-4">
                        <button
                            onClick={onRender}
                            disabled={isRenderDisabled}
                            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold px-6 py-3 rounded-full shadow-lg hover:scale-105 transform transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                            title="Tạo ảnh chất lượng cao"
                        >
                            <RefreshIcon className={`w-6 h-6 ${isLoading ? 'animate-spin' : ''}`}/>
                            {isLoading ? 'Đang Render...' : 'Render Final'}
                        </button>

                        <div className="bg-slate-900/50 border border-gray-700 p-3 rounded-lg flex items-center justify-between gap-4">
                            {lockedStyle ? (
                                 <>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <img 
                                            src={`data:image/png;base64,${lockedStyle.final}`}
                                            alt="Locked style thumbnail"
                                            className="w-12 h-12 object-cover rounded-md flex-shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <h4 className="font-semibold text-yellow-300 truncate">Phong cách đã khóa</h4>
                                            <p className="text-xs text-yellow-400 truncate">Render mới sẽ dùng phong cách này.</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                        <input type="checkbox" checked={true} onChange={onUnlock} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-yellow-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-yellow-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                                        <span className="ml-3 text-sm font-medium text-yellow-300 sr-only">Unlocked</span>
                                    </label>
                                 </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-12 h-12 bg-slate-700 rounded-md flex items-center justify-center flex-shrink-0">
                                            <LockOpenIcon className="w-6 h-6 text-gray-400"/>
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-semibold text-gray-400 truncate">Khóa phong cách</h4>
                                            <p className="text-xs text-gray-500 truncate">Khóa từ một ảnh đã tạo để nhất quán.</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-not-allowed flex-shrink-0">
                                        <input type="checkbox" checked={false} disabled className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-600 rounded-full peer after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-gray-400 after:border-gray-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                                        <span className="ml-3 text-sm font-medium text-gray-500 sr-only">Locked</span>
                                    </label>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- NEW SIDEBAR COMPONENT ---
const Sidebar: React.FC<ControlPanelProps> = (props) => (
    <aside className="bg-slate-900 p-4 hidden md:block h-screen sticky top-0 overflow-y-auto">
        <ControlPanel {...props} />
    </aside>
);


interface RenderResultProps {
  sketch: string | null;
  result: string | null;
  isLoading: boolean;
  loadingStep: string;
  currentRender: RenderResultItem | null;
  isSaved: boolean;
  onSave: (item: RenderResultItem) => void;
  onZoom: (imageBase64: string) => void;
  onToggleStyleLock: (item: RenderResultItem) => void;
  onDownload: (item: RenderResultItem, imageBase64: string) => void;
  isStyleLocked: boolean;
}
const RenderResult: React.FC<RenderResultProps> = ({ sketch, result, isLoading, loadingStep, currentRender, isSaved, onSave, onZoom, onToggleStyleLock, onDownload, isStyleLocked }) => {
  const [showSketch, setShowSketch] = useState(false);
  const imageToDisplay = showSketch ? sketch : result;

  const handleInternalDownload = () => {
    if (!imageToDisplay || !currentRender) return;
    onDownload(currentRender, imageToDisplay);
  };
  
  return (
    <div className="bg-slate-800 p-4 rounded-xl shadow-lg">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-white">Kết Quả Render</h2>
        {sketch && result && (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${!showSketch ? 'text-gray-400' : 'text-white'}`}>Sketch</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={!showSketch} onChange={() => setShowSketch(s => !s)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className={`text-sm font-medium ${showSketch ? 'text-gray-400' : 'text-white'}`}>Final</span>
          </div>
        )}
      </div>
      <div className="aspect-video bg-slate-900 rounded-lg flex items-center justify-center relative group overflow-hidden">
        {isLoading ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
            <p className="text-gray-300 mt-4">{loadingStep}</p>
          </div>
        ) : imageToDisplay ? (
          <>
            <img src={`data:image/png;base64,${imageToDisplay}`} alt="Render result" className="object-contain h-full w-full"/>
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center gap-4">
               <button onClick={() => onZoom(imageToDisplay)} className="opacity-0 group-hover:opacity-100 transition-opacity p-3 bg-white/20 rounded-full hover:bg-white/40">
                  <ZoomIcon className="w-6 h-6 text-white"/>
              </button>
              <button onClick={handleInternalDownload} className="opacity-0 group-hover:opacity-100 transition-opacity p-3 bg-white/20 rounded-full hover:bg-white/40">
                <DownloadIcon className="w-6 h-6 text-white"/>
              </button>
              {currentRender && (
                  <>
                  <button 
                    onClick={() => onToggleStyleLock(currentRender)} 
                    title={isStyleLocked ? "Mở khóa phong cách" : "Khóa phong cách này"}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-3 bg-white/20 rounded-full hover:bg-white/40"
                  >
                    {isStyleLocked ? <LockClosedIcon className="w-6 h-6 text-yellow-400" /> : <LockOpenIcon className="w-6 h-6 text-white" />}
                  </button>
                  <button 
                    onClick={() => onSave(currentRender)} 
                    disabled={isSaved}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-3 bg-white/20 rounded-full hover:bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSaved ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-white text-sm font-semibold">Đã lưu</span>
                      </>
                    ) : (
                      <SaveIcon className="w-6 h-6 text-white"/>
                    )}
                  </button>
                  </>
              )}
            </div>
          </>
        ) : (
          <p className="text-gray-500">Hiện tại chưa có kết quả hiển thị.</p>
        )}
      </div>
    </div>
  );
};


interface ImageGalleryProps {
    images: RenderResultItem[];
    onSelect: (item: RenderResultItem) => void;
    onDelete: (item: RenderResultItem) => void;
    onZoom: (imageBase64: string) => void;
    onToggleStyleLock: (item: RenderResultItem) => void;
    onDownload: (item: RenderResultItem, imageBase64: string) => void;
    lockedStyleId: string | null;
}
const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onSelect, onDelete, onZoom, onToggleStyleLock, onDownload, lockedStyleId }) => (
    <div className="bg-slate-800 p-4 rounded-xl shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-3">Thư viện hình ảnh</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {images.length === 0 ? (
                 <p className="text-gray-500 text-sm col-span-full">Chưa có ảnh nào được lưu.</p>
            ) : (
                images.map((item) => {
                    const isLocked = item.id === lockedStyleId;
                    return (
                        <div key={item.id} className={`relative aspect-video group transition-all duration-300 ${isLocked ? 'ring-4 ring-yellow-500 rounded-lg' : ''}`} >
                            <img 
                                src={`data:image/png;base64,${item.final}`} 
                                alt="Gallery item" 
                                className="w-full h-full object-cover rounded-md transition-transform duration-200 group-hover:scale-105 shadow-md cursor-pointer"
                                onClick={() => onSelect(item)}
                            />
                             <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all rounded-md flex items-center justify-center gap-2">
                                 <button 
                                    onClick={() => onToggleStyleLock(item)} 
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white/20 rounded-full hover:bg-white/40" 
                                    title={isLocked ? "Mở khóa phong cách" : "Khóa phong cách này"}
                                 >
                                    {isLocked ? <LockClosedIcon className="w-5 h-5 text-yellow-400"/> : <LockOpenIcon className="w-5 h-5 text-white"/>}
                                 </button>
                                 <button
                                     onClick={() => onDownload(item, item.final)}
                                     className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white/20 rounded-full hover:bg-white/40"
                                     title="Tải xuống"
                                 >
                                     <DownloadIcon className="w-5 h-5 text-white"/>
                                 </button>
                                 <button onClick={() => onZoom(item.final)} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white/20 rounded-full hover:bg-white/40" title="Phóng to">
                                     <ZoomIcon className="w-5 h-5 text-white"/>
                                 </button>
                                 <button onClick={() => onDelete(item)} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-red-500/50 rounded-full hover:bg-red-500/80" title="Xóa ảnh">
                                     <DeleteIcon className="w-5 h-5 text-white"/>
                                 </button>
                             </div>
                        </div>
                    );
                })
            )}
        </div>
    </div>
);

const ImagePreviewModal: React.FC<{ imageSrc: string; onClose: () => void }> = ({ imageSrc, onClose }) => {
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    
    const ZOOM_STEP = 0.25;
    const MIN_ZOOM = 0.25;
    const MAX_ZOOM = 10;
  
    // Reset on new image or on close
    useEffect(() => {
      setTransform({ scale: 1, x: 0, y: 0 });
    }, [imageSrc]);

    const applyZoom = (newScale: number, centerX: number, centerY: number) => {
        const clampedScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
        const currentScale = transform.scale;
    
        if (clampedScale === currentScale) return;
    
        const newX = centerX - (centerX - transform.x) * (clampedScale / currentScale);
        const newY = centerY - (centerY - transform.y) * (clampedScale / currentScale);
    
        setTransform({ scale: clampedScale, x: newX, y: newY });
    };

    const zoomWithButtons = (direction: 'in' | 'out') => {
        const currentStep = Math.round(transform.scale / ZOOM_STEP);
        const stepDirection = direction === 'in' ? 1 : -1;
        const nextStep = currentStep + stepDirection;
        const newScale = nextStep * ZOOM_STEP;

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        applyZoom(newScale, rect.width / 2, rect.height / 2);
    };
    
    const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      
      const { deltaY } = e;
      const currentStep = Math.round(transform.scale / ZOOM_STEP);
      const direction = deltaY < 0 ? 1 : -1; // 1 for zoom in, -1 for zoom out
      const nextStep = currentStep + direction;
      const newScale = nextStep * ZOOM_STEP;
  
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      applyZoom(newScale, mouseX, mouseY);
    };
    
    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsPanning(true);
      setStartPan({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    };
    
    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isPanning) return;
      e.preventDefault();
      const newX = e.clientX - startPan.x;
      const newY = e.clientY - startPan.y;
      setTransform(prev => ({ ...prev, x: newX, y: newY }));
    };
    
    const handleMouseUpOrLeave = () => {
      setIsPanning(false);
    };
  
    const resetZoom = () => {
      setTransform({ scale: 1, x: 0, y: 0 });
    };
  
    const cursorStyle = transform.scale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default';
  
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" 
        onClick={onClose}
      >
        <div 
          ref={containerRef}
          className="relative w-full h-full overflow-hidden" 
          onClick={(e) => e.stopPropagation()}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          style={{ cursor: cursorStyle }}
        >
          <img 
            src={`data:image/png;base64,${imageSrc}`} 
            alt="Preview" 
            className="absolute top-0 left-0"
            style={{ 
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: '0 0',
              willChange: 'transform',
              maxWidth: 'none',
              maxHeight: 'none',
            }}
          />
        </div>
  
        <button onClick={onClose} className="absolute top-4 right-4 bg-slate-600/50 p-2 rounded-full text-white hover:bg-slate-600/80 transition backdrop-blur-sm z-10">
          <CloseIcon className="w-6 h-6" />
        </button>
  
        <div className="absolute bottom-6 bg-slate-800/70 backdrop-blur-sm rounded-full shadow-lg p-2 flex items-center gap-2 z-10">
            <button
                onClick={() => zoomWithButtons('out')}
                className="w-10 h-10 flex items-center justify-center rounded-full text-white font-semibold text-2xl transition-colors hover:bg-slate-700"
                title="Thu nhỏ"
                aria-label="Thu nhỏ"
            >
                -
            </button>
            <div className="text-sm font-mono bg-slate-900/50 px-3 py-2 rounded-md w-24 text-center" aria-live="polite">
              {`${(transform.scale * 100).toFixed(0)}%`}
            </div>
             <button
                onClick={() => zoomWithButtons('in')}
                className="w-10 h-10 flex items-center justify-center rounded-full text-white font-semibold text-xl transition-colors hover:bg-slate-700"
                title="Phóng to"
                aria-label="Phóng to"
            >
                +
            </button>
             <div className="w-px h-6 bg-slate-600 mx-1"></div>
            <button
                onClick={resetZoom}
                className="h-10 px-4 rounded-full text-white font-semibold transition-colors hover:bg-slate-700"
                title="Reset Zoom"
            >
                Reset
            </button>
        </div>
      </div>
    );
  };
  
const ConfirmationDialog: React.FC<{ message: string; onConfirm: () => void; onCancel: () => void }> = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl text-white max-w-sm w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">⚠️ Xác nhận xóa</h3>
        <p className="mb-6 text-gray-300">{message}</p>
        <div className="flex justify-end gap-4">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition font-medium">Không</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition font-medium">Có, Xóa</button>
        </div>
      </div>
    </div>
);

const Toast: React.FC<{ message: string; type: 'success' | 'error' }> = ({ message, type }) => {
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    return (
        <div className={`fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-lg z-50 animate-pulse ${bgColor}`}>
            {message}
        </div>
    );
};


// --- Main App Component ---
export default function App() {
  const [uploadedImage, setUploadedImage] = useState<UploadedFile | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [options, setOptions] = useState<RenderOptions>({
    style: '', type: '', context: '', weather: '', time: '', view: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoPrompting, setIsAutoPrompting] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [sketchImage, setSketchImage] = useState<string | null>(null);
  const [renderedImage, setRenderedImage] = useState<string | null>(null);
  const [currentRender, setCurrentRender] = useState<RenderResultItem | null>(null);
  const [imageGallery, setImageGallery] = useState<RenderResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [imageToDelete, setImageToDelete] = useState<RenderResultItem | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'} | null>(null);
  const [lockedStyle, setLockedStyle] = useState<RenderResultItem | null>(null);

  const HUMAN_INSTRUCTION = "Hình ảnh cần xuất hiện con người thật với ngoại hình, cử chỉ và chuyển động tự nhiên — tuyệt đối không phải nhân vật 3D, hoạt hình hay anime. Biểu cảm đều phải chân thật, bình yên và hòa hợp với không gian kiến trúc và ánh sáng.";
  const QUALITY_INSTRUCTION = "Render with ultra-photorealistic quality, 8K resolution, sharp focus, detailed textures, and cinematic lighting, similar to a professional V-Ray or Corona render. The image must be high-resolution enough to allow zooming in to see fine details clearly.";
  const MATERIAL_CONSISTENCY_INSTRUCTION = "**MỆNH LỆNH VỀ TÍNH NHẤT QUÁN VẬT LIỆU:** Toàn bộ công trình phải tuân thủ một ngôn ngữ thiết kế vật liệu thống nhất. Các khối kiến trúc chính (architectural volumes) trong cùng một công trình phải chia sẻ cùng một bộ vật liệu chủ đạo. NGHIÊM CẤM việc áp dụng các bộ vật liệu chính hoàn toàn khác nhau cho các khối khác nhau (ví dụ: khối A dùng bê tông và kính, trong khi khối B lại ốp gỗ và gạch). Sự đồng bộ về vật liệu là yêu cầu bắt buộc.";


  useEffect(() => {
    if (toast) {
        const timer = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleOptionsChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setOptions(prev => ({ ...prev, [name as keyof RenderOptions]: value }));
  }, []);

  useEffect(() => {
    const promptParts = [
      options.style,
      options.type,
      options.context,
      options.weather,
      options.time,
      options.view,
    ].filter(Boolean);
    
    const generatedPrompt = promptParts.join(', ');
    setPrompt(generatedPrompt);
  }, [options]);
  
  const handleAutoPrompt = async () => {
    setIsAutoPrompting(true);
    setError(null);
    try {
      const newPrompt = await generateAutomaticPrompt(prompt, options);
      setPrompt(newPrompt);
    } catch (e) {
      setError('Không thể tạo prompt tự động.');
    } finally {
      setIsAutoPrompting(false);
    }
  };

  const handleToggleStyleLock = (itemToLock: RenderResultItem) => {
    if (lockedStyle?.id === itemToLock.id) {
      // If clicking the already locked item, unlock it
      setLockedStyle(null);
      setToast({ message: 'ℹ️ Đã mở khóa phong cách.', type: 'success' });
    } else {
      // Lock the new style using the CURRENT prompt from the textarea
      const styleToLock = {
        ...itemToLock,
        prompt: prompt, // Use the current prompt from the state.
      };
      setLockedStyle(styleToLock);
      
      // The prompt in the textarea is now considered "locked", so we don't change it.
      // Reset dropdown options to match the locked image for a consistent starting point.
      setOptions(itemToLock.options);
      setToast({ message: '🔒 Phong cách đã khóa. Prompt và tùy chọn đã được cập nhật.', type: 'success' });
    }
  };

  const handleUnlockStyle = () => {
    setLockedStyle(null);
    setToast({ message: 'ℹ️ Đã mở khóa phong cách.', type: 'success' });
  };

  const handleDownload = useCallback((itemToDownload: RenderResultItem, imageBase64: string) => {
    if (!itemToDownload || !imageBase64) return;

    const findName = (arr: { name: string; prompt: string }[], promptValue: string) =>
      arr.find(item => item.prompt === promptValue)?.name.split('(')[0].trim().replace(/[^a-zA-Z0-9]/g, '') || 'Custom';

    const { options } = itemToDownload;
    const style = findName(DESIGN_STYLES, options.style);
    const weather = findName(WEATHERS, options.weather);
    const time = findName(TIMES_OF_DAY, options.time);
    const view = findName(VIEWS, options.view);

    const fileName = `${style}_${weather}_${time}_${view}_Render_${Date.now()}.png`;

    const link = document.createElement('a');
    link.href = `data:image/png;base64,${imageBase64}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleRender = async () => {
    if (!uploadedImage) {
        setError('Vui lòng tải lên một hình ảnh.');
        return;
    }
    setIsLoading(true);
    setError(null);
    setSketchImage(null);
    setRenderedImage(null);
    setCurrentRender(null);

    try {
        let finalResult: string;
        let sketchForDisplay: string;
        let optionsForRecord: RenderOptions;

        // Condition 1: Style is locked. Highest priority for style consistency.
        if (lockedStyle) {
            setLoadingStep('Đang tạo phác thảo...');
            const sketchResult = await generateSketch(uploadedImage);
            sketchForDisplay = sketchResult;

            setLoadingStep('Đang render hình ảnh...');
            const sketchFile = { base64: sketchResult, mimeType: 'image/png', name: 'sketch.png' };
            const styleReferenceFile = { base64: lockedStyle.final, mimeType: 'image/png', name: 'reference.png' };
            
            const additionalOptionsText = [options.context, options.weather, options.time, options.view]
                .filter(Boolean)
                .join(', ');

            // The base prompt is whatever is in the textarea. Append new options to it.
            const combinedPrompt = additionalOptionsText ? `${prompt}, ${additionalOptionsText}` : prompt;

            const fullPrompt = `
**NHIỆM VỤ: CHUYỂN GIAO PHONG CÁCH KIẾN TRÚC**

**NGUỒN:**
1.  **ẢNH PHONG CÁCH (Ảnh 1 - Tham chiếu):** Hình ảnh này chứa PHONG CÁCH, VẬT LIỆU, ÁNH SÁNG, và MÀU SẮC cần được sao chép.
2.  **ẢNH PHÁC THẢO (Ảnh 2 - Mục tiêu):** Hình ảnh này chứa HÌNH KHỐI, BỐ CỤC, và TỶ LỆ kiến trúc cần được BẢO TOÀN NGUYÊN VẸN.

**MỆNH LỆNH:**
1.  **GIỮ NGUYÊN HÌNH KHỐI:** Render lại **Ảnh Phác Thảo (Ảnh 2)**. TUYỆT ĐỐI không thay đổi bất kỳ chi tiết kiến trúc nào: hình khối, bố cục, vị trí cửa sổ, ban công, mái nhà. Cấu trúc của Ảnh 2 là bất biến.
2.  **ÁP DỤNG PHONG CÁCH:** Lấy TOÀN BỘ phong cách từ **Ảnh Phong Cách (Ảnh 1)**—bao gồm vật liệu (bê tông, gỗ, kính), màu sắc, chất lượng ánh sáng (hướng nắng, độ gắt), và không khí tổng thể—và áp dụng nó lên hình khối của Ảnh 2.
3.  **KHÔNG TRỘN LẪN KIẾN TRÚC:** NGHIÊM CẤM sao chép bất kỳ YẾU TỐ KIẾN TRÚC nào từ Ảnh 1 sang Ảnh 2. Chỉ sao chép "lớp vỏ" (skin) phong cách, không sao chép "bộ khung" (structure).
4.  **TÍNH NHẤT QUÁN VẬT LIỆU:** Bộ vật liệu từ Ảnh 1 phải được áp dụng một cách đồng bộ và nhất quán trên TOÀN BỘ các khối kiến trúc của Ảnh 2. Đảm bảo toàn bộ công trình có một ngôn ngữ thiết kế vật liệu thống nhất.
5.  **KẾT QUẢ CUỐI CÙNG:** Phải là một ảnh render quang thực của kiến trúc trong Ảnh 2, nhưng mang 100% phong cách của Ảnh 1, tạo cảm giác hai ảnh là hai góc nhìn khác nhau của cùng một công trình.
6.  **YÊU CẦU BỔ SUNG CỦA NGƯỜI DÙNG:** ${combinedPrompt}. ${HUMAN_INSTRUCTION}
7.  **CHẤT LƯỢNG HÌNH ẢNH:** ${QUALITY_INSTRUCTION}
`.trim();
            finalResult = await generateRenderWithReference(styleReferenceFile, sketchFile, fullPrompt);
            optionsForRecord = options;
        } 
        // Condition 2: Refinement only. User wants to change environment/view without altering the building style.
        else if (!options.style && !options.type && (options.context || options.weather || options.time || options.view)) {
            setLoadingStep('Đang tinh chỉnh môi trường...');
            sketchForDisplay = uploadedImage.base64; // Use original image for before/after comparison
            
            const otherDetails = [prompt, options.context, options.weather, options.time, options.view].filter(Boolean).join(', ');
            const refinementPrompt = `**MỆNH LỆNH TINH CHỈNH QUANG CẢNH:** Giữ nguyên 100% kiến trúc, vật liệu, và màu sắc của công trình trong ảnh gốc. Chỉ thay đổi các yếu tố môi trường xung quanh dựa trên các yêu cầu sau: ${otherDetails}. ${HUMAN_INSTRUCTION}. Kết quả phải là một bức ảnh quang thực, thể hiện công trình gốc trong một bối cảnh mới.\n\n**CHẤT LƯỢNG HÌNH ẢNH:** ${QUALITY_INSTRUCTION}`;
            
            // Use the original uploaded image as the source for editing.
            finalResult = await generateRender(uploadedImage, refinementPrompt);
            optionsForRecord = options;
        } 
        // Condition 3: Default behavior - full re-render from sketch to apply new styles.
        else {
            setLoadingStep('Đang tạo phác thảo...');
            const sketchResult = await generateSketch(uploadedImage);
            sketchForDisplay = sketchResult;

            setLoadingStep('Đang render hình ảnh...');
            const sketchFile = { base64: sketchResult, mimeType: 'image/png', name: 'sketch.png' };
            const instruction = `
**MỆNH LỆNH TUYỆT ĐỐI: BẢO TOÀN KIẾN TRÚC GỐC.**
- **TUÂN THỦ 100%:** Giữ nguyên tuyệt đối hình khối, tỷ lệ, bố cục, vị trí và số lượng của tất cả các chi tiết kiến trúc (cửa sổ, ban công, mái nhà, cột, tường) từ ảnh phác thảo được cung cấp.
- **NGHIÊM CẤM:** Không được thêm, bớt, di chuyển, hay thay đổi kích thước bất kỳ yếu tố kiến trúc nào. Mọi sự sáng tạo làm thay đổi cấu trúc đều bị cấm.
- **NHIỆM VỤ CHÍNH:** Tập trung vào việc "tô màu" và "hoàn thiện" bản phác thảo. Áp dụng vật liệu, màu sắc, cảnh quan, và ánh sáng theo yêu cầu để tạo ra một bức ảnh render quang thực, sống động.
`.trim();

            const specificRequestParts = [
                prompt,
                options.style,
                options.type,
                options.context,
                options.weather,
                options.time,
                options.view
            ].filter(Boolean).join(', ');

            const fullPrompt = `${instruction}\n\n${MATERIAL_CONSISTENCY_INSTRUCTION}\n\n**YÊU CẦU CỤ THỂ:** ${specificRequestParts}. ${HUMAN_INSTRUCTION}\n\n**CHẤT LƯỢNG HÌNH ẢNH:** ${QUALITY_INSTRUCTION}`;
            
            finalResult = await generateRender(sketchFile, fullPrompt);
            optionsForRecord = options;
        }

        setSketchImage(sketchForDisplay);
        setRenderedImage(finalResult);

        const newItem: RenderResultItem = {
            id: new Date().toISOString(),
            sketch: sketchForDisplay,
            final: finalResult,
            prompt,
            options: optionsForRecord
        };
        setCurrentRender(newItem);

    } catch (e) {
        console.error(e);
        setError('Đã có lỗi xảy ra trong quá trình render.');
    } finally {
        setIsLoading(false);
        setLoadingStep('');
    }
};

  const handleGallerySelect = (item: RenderResultItem) => {
    // This function updates the main view with the selected gallery item's data.
    setSketchImage(item.sketch);
    setRenderedImage(item.final);
    setPrompt(item.prompt);
    setOptions(item.options);
    setCurrentRender(item);
  };
  
  const handleSave = (itemToSave: RenderResultItem) => {
    if (!imageGallery.some(item => item.id === itemToSave.id)) {
        setImageGallery(prev => [itemToSave, ...prev]);
        setToast({ message: '✅ Ảnh đã được lưu vào thư viện.', type: 'success' });
    }
  };

  const handleDeleteRequest = (itemToDelete: RenderResultItem) => {
    setImageToDelete(itemToDelete);
  };

  const handleConfirmDelete = () => {
    if (imageToDelete) {
        setImageGallery(prev => prev.filter(item => item.id !== imageToDelete.id));
        setToast({ message: '🗑️ Ảnh đã được xóa khỏi thư viện.', type: 'success' });
        setImageToDelete(null);
    }
  };

  const isRenderDisabled = isLoading || !uploadedImage;
  const isCurrentRenderSaved = imageGallery.some(img => img.id === currentRender?.id);

  return (
    <div className="min-h-screen font-sans text-white bg-slate-900">
      {zoomedImage && <ImagePreviewModal imageSrc={zoomedImage} onClose={() => setZoomedImage(null)} />}
      {imageToDelete && (
          <ConfirmationDialog
              message="Bạn có chắc muốn xóa hình ảnh này không?"
              onConfirm={handleConfirmDelete}
              onCancel={() => setImageToDelete(null)}
          />
      )}
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div className="md:grid md:grid-cols-[400px_1fr] xl:grid-cols-[450px_1fr]">
        <Sidebar
          options={options}
          onOptionsChange={handleOptionsChange}
          onRender={handleRender}
          isLoading={isLoading}
          isRenderDisabled={isRenderDisabled}
          lockedStyle={lockedStyle}
          onUnlock={handleUnlockStyle}
        />
        <main className="p-4 md:p-8 bg-slate-900 min-h-screen">
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            {error && <div className="bg-red-500 p-3 rounded-lg text-center">{error}</div>}
            <UploadArea onImageUpload={setUploadedImage} uploadedImage={uploadedImage} />
            <PromptInput prompt={prompt} setPrompt={setPrompt} onGenerate={handleAutoPrompt} isLoading={isAutoPrompting} />
            
            <RenderResult 
                sketch={sketchImage} 
                result={renderedImage} 
                isLoading={isLoading} 
                loadingStep={loadingStep}
                currentRender={currentRender}
                isSaved={isCurrentRenderSaved}
                onSave={handleSave}
                onZoom={setZoomedImage}
                onToggleStyleLock={handleToggleStyleLock}
                onDownload={handleDownload}
                isStyleLocked={currentRender?.id === lockedStyle?.id}
            />
            <ImageGallery 
                images={imageGallery} 
                onSelect={handleGallerySelect}
                onDelete={handleDeleteRequest}
                onZoom={setZoomedImage}
                onToggleStyleLock={handleToggleStyleLock}
                onDownload={handleDownload}
                lockedStyleId={lockedStyle?.id ?? null}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

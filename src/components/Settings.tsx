import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Save, ExternalLink, Database, CheckCircle2, AlertCircle, Moon, Sun, Globe, Smartphone, Instagram, Facebook, Tag, CreditCard, Music2, Plus, Trash2, Image, Layout, Upload, Loader2, Info, ShieldCheck, Mail } from 'lucide-react';
import { useInventoryContext } from '../contexts/InventoryContext';
import { StoreSettings, HeroSlide } from '../types';
import { v4 as uuidv4 } from 'uuid';
import imageCompression from 'browser-image-compression';

export default function Settings() {
  const { storeSettings, updateStoreSettings, isAdmin, products } = useInventoryContext();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [language, setLanguage] = useState(() => localStorage.getItem('janlu_language') || 'es');
  const [uploadingSlideId, setUploadingSlideId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const atmosphericFileInputRef = useRef<HTMLInputElement>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number | null>(null);
  
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [products]);

  const [localSettings, setLocalSettings] = useState<StoreSettings>({
    whatsappNumber: '',
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
    installmentsCount: 0,
    installmentsWithoutInterest: false,
    topBarText: '',
    heroSlides: [],
    shippingInfo: 'Los tiempos de envíos son APROXIMADOS ya que depende de los operadores logísticos.',
    returnsInfo: 'Si no te gusta, podés cambiarlo por otro o devolverlo.',
    wholesaleInfo: 'Ofrecemos precios especiales para compras por mayor con un monto mínimo de inversión.',
    transferDiscountPercentage: 0,
    cashDiscountPercentage: 0
  });

  const lastSyncedSettingsRef = useRef<string>('');

  useEffect(() => {
    if (storeSettings && status === 'idle') {
      const settingsStr = JSON.stringify(storeSettings);
      if (settingsStr !== lastSyncedSettingsRef.current) {
        setLocalSettings({
          ...storeSettings,
          heroSlides: storeSettings.heroSlides || []
        });
        lastSyncedSettingsRef.current = settingsStr;
      }
    }
  }, [storeSettings, status]);

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    localStorage.setItem('janlu_language', newLang);
    // In a real app, this would trigger a context update or reload
    // For now, we just save it and show a small alert or reload
    window.location.reload();
  };

  const handleSaveSettings = async () => {
    if (!isAdmin) return;
    
    // Check total size to prevent Firestore 1MB limit error
    const settingsSize = new Blob([JSON.stringify(localSettings)]).size;
    if (settingsSize > 1000000) { // Slightly less than 1MB to be safe
      console.error("Settings size too large:", settingsSize);
      alert("La configuración es demasiado pesada (excede 1MB). Por favor, reduce el tamaño de las imágenes del carrusel o elimina algunos slides.");
      setStatus('error');
      return;
    }

    console.log("Saving settings:", localSettings, "Size:", settingsSize);
    setStatus('saving');
    try {
      await updateStoreSettings(localSettings);
      lastSyncedSettingsRef.current = JSON.stringify(localSettings);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setStatus('error');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number, target: 'hero' | 'atmospheric' = 'hero') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const currentArray = target === 'hero' ? localSettings.heroSlides : localSettings.atmosphericBanners;
    const slideId = currentArray?.[index]?.id || 'temp';
    setUploadingSlideId(slideId);

    try {
      const options = {
        maxSizeMB: 0.1, 
        maxWidthOrHeight: 1280, 
        useWebWorker: true
      };
      
      const compressedFile = await imageCompression(file, options);
      const base64 = await imageCompression.getDataUrlFromFile(compressedFile);
      
      const newSlides = [...(currentArray || [])];
      newSlides[index] = { ...newSlides[index], image: base64 };
      if (target === 'hero') {
        setLocalSettings({ ...localSettings, heroSlides: newSlides });
      } else {
        setLocalSettings({ ...localSettings, atmosphericBanners: newSlides });
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Error al cargar la imagen. Intenta con un archivo más pequeño.");
    } finally {
      setUploadingSlideId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-8 pb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Configuración</h2>
        {isAdmin && (
          <button
            onClick={handleSaveSettings}
            disabled={status === 'saving'}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {status === 'saving' ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : status === 'saved' ? (
              <CheckCircle2 size={20} />
            ) : status === 'error' ? (
              <AlertCircle size={20} />
            ) : (
              <Save size={20} />
            )}
            <span>
              {status === 'saving' ? 'Guardando...' : status === 'saved' ? 'Guardado' : 'Guardar Cambios'}
            </span>
          </button>
        )}
      </div>

      {isAdmin && (
        <>
          <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
          <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
            <Smartphone size={24} />
            <h3 className="text-lg font-semibold">Redes Sociales y Contacto</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Número de WhatsApp
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Smartphone size={18} className="text-stone-400" />
                </div>
                <input
                  type="text"
                  value={localSettings.whatsappNumber}
                  onChange={(e) => setLocalSettings({ ...localSettings, whatsappNumber: e.target.value })}
                  placeholder="Ej: +5491112345678"
                  className="w-full pl-10 pr-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
              </div>
              <p className="text-xs text-stone-500 mt-1">Incluye el código de país (ej. +54 para Argentina).</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-stone-400" />
                </div>
                <input
                  type="email"
                  value={localSettings.email || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, email: e.target.value })}
                  placeholder="Ej: hola@janlu.com"
                  className="w-full pl-10 pr-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Enlace de Instagram
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Instagram size={18} className="text-stone-400" />
                </div>
                <input
                  type="url"
                  value={localSettings.instagramUrl}
                  onChange={(e) => setLocalSettings({ ...localSettings, instagramUrl: e.target.value })}
                  placeholder="Ej: https://instagram.com/tu_usuario"
                  className="w-full pl-10 pr-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Enlace de Facebook
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Facebook size={18} className="text-stone-400" />
                </div>
                <input
                  type="url"
                  value={localSettings.facebookUrl}
                  onChange={(e) => setLocalSettings({ ...localSettings, facebookUrl: e.target.value })}
                  placeholder="Ej: https://facebook.com/tu_pagina"
                  className="w-full pl-10 pr-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Enlace de TikTok
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Music2 size={18} className="text-stone-400" />
                </div>
                <input
                  type="url"
                  value={localSettings.tiktokUrl || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, tiktokUrl: e.target.value })}
                  placeholder="Ej: https://tiktok.com/@tu_usuario"
                  className="w-full pl-10 pr-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
          <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
            <Layout size={24} />
            <h3 className="text-lg font-semibold">Banner Superior (Anuncios)</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Texto del Banner
              </label>
              <textarea
                value={localSettings.topBarText || ''}
                onChange={(e) => setLocalSettings({ ...localSettings, topBarText: e.target.value })}
                placeholder="Ej: 20% OFF CON TRANSFERENCIA | ENVÍO GRATIS..."
                rows={2}
                className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
              <p className="text-xs text-stone-500 mt-1">Este texto aparecerá en la parte superior del catálogo.</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
              <Image size={24} />
              <h3 className="text-lg font-semibold">Carrusel Hero (Inicio)</h3>
            </div>
            <button
              onClick={() => {
                if ((localSettings.heroSlides || []).length >= 5) {
                  alert("Máximo 5 slides permitidos para mantener el rendimiento.");
                  return;
                }
                const newSlide: HeroSlide = {
                  id: uuidv4(),
                  image: '',
                  title: '',
                  subtitle: '',
                  buttonText: 'Ver Colección',
                  buttonLink: '#'
                };
                setLocalSettings({
                  ...localSettings,
                  heroSlides: [...(localSettings.heroSlides || []), newSlide]
                });
              }}
              className="flex items-center space-x-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
              disabled={(localSettings.heroSlides || []).length >= 5}
            >
              <Plus size={16} />
              <span>Agregar Slide</span>
            </button>
          </div>
          
          <div className="space-y-6">
            {(!localSettings.heroSlides || localSettings.heroSlides.length === 0) ? (
              <p className="text-sm text-stone-500 text-center py-4 italic">No hay slides configurados. Se mostrarán los de por defecto.</p>
            ) : (
              localSettings.heroSlides.map((slide, index) => (
                <div key={slide.id} className="p-4 border border-stone-100 dark:border-stone-800 rounded-xl space-y-4 bg-stone-50/50 dark:bg-stone-900/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Slide #{index + 1}</span>
                    <button
                      onClick={() => {
                        const newSlides = localSettings.heroSlides?.filter(s => s.id !== slide.id);
                        setLocalSettings({ ...localSettings, heroSlides: newSlides });
                      }}
                      className="text-rose-500 hover:text-rose-600 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Imagen</label>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-lg overflow-hidden flex-shrink-0 border border-stone-200 dark:border-stone-700">
                          {slide.image ? (
                            <img src={slide.image} alt="Preview" className={`w-full h-full object-cover object-${slide.objectPosition || 'center'}`} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-400">
                              <Image size={24} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setActiveSlideIndex(index);
                                fileInputRef.current?.click();
                              }}
                              disabled={uploadingSlideId === slide.id}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors disabled:opacity-50"
                            >
                              {uploadingSlideId === slide.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Upload size={14} />
                              )}
                              Cargar Archivo
                            </button>
                            <input
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => {
                                if (activeSlideIndex !== null) {
                                  handleImageUpload(e, activeSlideIndex);
                                }
                              }}
                            />
                          </div>
                          <input
                            type="url"
                            value={slide.image}
                            onChange={(e) => {
                              const newSlides = [...(localSettings.heroSlides || [])];
                              newSlides[index] = { ...slide, image: e.target.value };
                              setLocalSettings({ ...localSettings, heroSlides: newSlides });
                            }}
                            placeholder="O pega una URL: https://..."
                            className="w-full px-3 py-1.5 text-xs border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Título</label>
                      <input
                        type="text"
                        value={slide.title}
                        onChange={(e) => {
                          const newSlides = [...(localSettings.heroSlides || [])];
                          newSlides[index] = { ...slide, title: e.target.value };
                          setLocalSettings({ ...localSettings, heroSlides: newSlides });
                        }}
                        placeholder="Ej: Nuevas Fragancias"
                        className="w-full px-3 py-1.5 text-sm border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Subtítulo</label>
                      <input
                        type="text"
                        value={slide.subtitle}
                        onChange={(e) => {
                          const newSlides = [...(localSettings.heroSlides || [])];
                          newSlides[index] = { ...slide, subtitle: e.target.value };
                          setLocalSettings({ ...localSettings, heroSlides: newSlides });
                        }}
                        placeholder="Ej: Colección Esencial"
                        className="w-full px-3 py-1.5 text-sm border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Categoría / Texto Botón</label>
                        <select
                          value={slide.buttonText}
                          onChange={(e) => {
                            const newSlides = [...(localSettings.heroSlides || [])];
                            const selectedCat = e.target.value;
                            newSlides[index] = { 
                              ...slide, 
                              buttonText: selectedCat,
                              buttonLink: selectedCat === 'Ver Colección' ? '#' : `category:${selectedCat}`
                            };
                            setLocalSettings({ ...localSettings, heroSlides: newSlides });
                          }}
                          className="w-full px-3 py-1.5 text-sm border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                        >
                          <option value="Ver Colección">Ver Colección (General)</option>
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Posición Imagen</label>
                        <select
                          value={slide.objectPosition || 'center'}
                          onChange={(e) => {
                            const newSlides = [...(localSettings.heroSlides || [])];
                            newSlides[index] = { ...slide, objectPosition: e.target.value };
                            setLocalSettings({ ...localSettings, heroSlides: newSlides });
                          }}
                          className="w-full px-3 py-1.5 text-sm border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                        >
                          <option value="center">Centro</option>
                          <option value="top">Superior</option>
                          <option value="bottom">Inferior</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Link Botón (Auto)</label>
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={slide.buttonLink}
                          readOnly
                          className="w-full px-3 py-1.5 text-sm border border-stone-200 dark:border-stone-700 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-500 cursor-not-allowed"
                        />
                        <p className="text-[9px] text-stone-400 italic">
                          Se genera automáticamente basado en la categoría seleccionada.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
              <Image size={24} />
              <h3 className="text-lg font-semibold">Banners Separadores (Atmósfera)</h3>
            </div>
            <button
              onClick={() => {
                if ((localSettings.atmosphericBanners || []).length >= 10) {
                  alert("Máximo 10 banners permitidos para mantener el rendimiento.");
                  return;
                }
                const newSlide: HeroSlide = {
                  id: uuidv4(),
                  image: '',
                  title: '',
                  subtitle: ''
                };
                setLocalSettings({
                  ...localSettings,
                  atmosphericBanners: [...(localSettings.atmosphericBanners || []), newSlide]
                });
              }}
              className="flex items-center space-x-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
              disabled={(localSettings.atmosphericBanners || []).length >= 10}
            >
              <Plus size={16} />
              <span>Agregar Banner</span>
            </button>
          </div>
          
          <div className="space-y-6">
            {(!localSettings.atmosphericBanners || localSettings.atmosphericBanners.length === 0) ? (
              <p className="text-sm text-stone-500 text-center py-4 italic">No hay banners atmosféricos configurados. Se mostrarán 3 por defecto en el catálogo.</p>
            ) : (
              localSettings.atmosphericBanners.map((slide, index) => (
                <div key={slide.id} className="p-4 border border-stone-100 dark:border-stone-800 rounded-xl space-y-4 bg-stone-50/50 dark:bg-stone-900/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Banner #{index + 1}</span>
                    <button
                      onClick={() => {
                        const newSlides = localSettings.atmosphericBanners?.filter(s => s.id !== slide.id);
                        setLocalSettings({ ...localSettings, atmosphericBanners: newSlides });
                      }}
                      className="text-rose-500 hover:text-rose-600 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Imagen</label>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-lg overflow-hidden flex-shrink-0 border border-stone-200 dark:border-stone-700">
                          {slide.image ? (
                            <img src={slide.image} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-400">
                              <Image size={24} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setActiveSlideIndex(index);
                                atmosphericFileInputRef.current?.click();
                              }}
                              disabled={uploadingSlideId === slide.id}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors disabled:opacity-50"
                            >
                              {uploadingSlideId === slide.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Upload size={14} />
                              )}
                              Cargar Archivo
                            </button>
                            <input
                              type="file"
                              ref={atmosphericFileInputRef}
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => {
                                if (activeSlideIndex !== null) {
                                  handleImageUpload(e, activeSlideIndex, 'atmospheric');
                                }
                              }}
                            />
                          </div>
                          <input
                            type="url"
                            value={slide.image}
                            onChange={(e) => {
                              const newSlides = [...(localSettings.atmosphericBanners || [])];
                              newSlides[index] = { ...slide, image: e.target.value };
                              setLocalSettings({ ...localSettings, atmosphericBanners: newSlides });
                            }}
                            placeholder="O pega una URL: https://..."
                            className="w-full px-3 py-1.5 text-xs border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Título</label>
                      <input
                        type="text"
                        value={slide.title}
                        onChange={(e) => {
                          const newSlides = [...(localSettings.atmosphericBanners || [])];
                          newSlides[index] = { ...slide, title: e.target.value };
                          setLocalSettings({ ...localSettings, atmosphericBanners: newSlides });
                        }}
                        placeholder="Ej: ESENCIA NATURAL"
                        className="w-full px-3 py-1.5 text-sm border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Subtítulo</label>
                      <input
                        type="text"
                        value={slide.subtitle}
                        onChange={(e) => {
                          const newSlides = [...(localSettings.atmosphericBanners || [])];
                          newSlides[index] = { ...slide, subtitle: e.target.value };
                          setLocalSettings({ ...localSettings, atmosphericBanners: newSlides });
                        }}
                        placeholder="Ej: Aromas que transforman tu espacio"
                        className="w-full px-3 py-1.5 text-sm border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
          <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
            <ShieldCheck size={24} />
            <h3 className="text-lg font-semibold">Políticas del Sitio</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Política de Envíos
              </label>
              <textarea
                value={localSettings.shippingInfo || ''}
                onChange={(e) => setLocalSettings({ ...localSettings, shippingInfo: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 text-sm"
                placeholder="Describe los tiempos y métodos de envío..."
              />
              <p className="text-xs text-stone-500 mt-1">Este texto se muestra en la pestaña de Políticas y en el modal de cada producto.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Política de Cambios y Devoluciones
              </label>
              <textarea
                value={localSettings.returnsInfo || ''}
                onChange={(e) => setLocalSettings({ ...localSettings, returnsInfo: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 text-sm"
                placeholder="Describe las condiciones para cambios..."
              />
              <p className="text-xs text-stone-500 mt-1">Este texto se muestra en la pestaña de Políticas y en el modal de cada producto.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Información Mayorista
              </label>
              <textarea
                value={localSettings.wholesaleInfo || ''}
                onChange={(e) => setLocalSettings({ ...localSettings, wholesaleInfo: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 text-sm"
                placeholder="Describe las condiciones para compras mayoristas..."
              />
              <p className="text-xs text-stone-500 mt-1">Este texto se muestra en la pestaña Mayorista del catálogo.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Nota Global en Modal de Productos (Opcional)
              </label>
              <textarea
                value={localSettings.productModalNotice || ''}
                onChange={(e) => setLocalSettings({ ...localSettings, productModalNotice: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 text-sm"
                placeholder="Ej: Todos nuestros productos son artesanales..."
              />
              <p className="text-xs text-stone-500 mt-1">Este texto se mostrará en la parte inferior del modal de cada producto.</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
          <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
            <CreditCard size={24} />
            <h3 className="text-lg font-semibold">Opciones de Financiación</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Cantidad de Cuotas
              </label>
              <input
                type="number"
                min="0"
                max="48"
                value={localSettings.installmentsCount || 0}
                onChange={(e) => setLocalSettings({ ...localSettings, installmentsCount: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
              <p className="text-xs text-stone-500 mt-1">Usa 0 para desactivar la visualización de cuotas.</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Cuotas Sin Interés</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Marca si las cuotas ofrecidas no tienen recargo</p>
              </div>
              <button
                onClick={() => setLocalSettings({ ...localSettings, installmentsWithoutInterest: !localSettings.installmentsWithoutInterest })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  localSettings.installmentsWithoutInterest ? 'bg-indigo-600' : 'bg-stone-200 dark:bg-stone-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localSettings.installmentsWithoutInterest ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
          <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
            <Tag size={24} />
            <h3 className="text-lg font-semibold">Políticas de Descuento</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Descuento por pago en Efectivo (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={localSettings.cashDiscountPercentage || 0}
                onChange={(e) => setLocalSettings({ ...localSettings, cashDiscountPercentage: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
              <p className="text-xs text-stone-500 mt-1">
                Este descuento se aplica automáticamente al precio del producto cuando se selecciona efectivo. Usa 0 para desactivar.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Regla de Acumulación (Apilamiento)
              </label>
              <select
                value={localSettings.discountStackingPolicy || 'stack'}
                onChange={(e) => setLocalSettings({ ...localSettings, discountStackingPolicy: e.target.value as 'stack' | 'best_offer' })}
                className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 text-sm"
              >
                <option value="stack">Acumular (Sumar descuentos)</option>
                <option value="best_offer">Mejor Oferta (Aplicar solo el mayor descuento)</option>
              </select>
              <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                {localSettings.discountStackingPolicy === 'best_offer' 
                  ? 'Si un producto ya tiene oferta, el cupón solo se aplicará si ofrece un descuento mayor al actual.' 
                  : 'Los cupones se aplicarán sobre el precio ya rebajado de los productos.'}
              </p>
            </div>
          </div>
        </div>
      </>
    )}

      <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
        <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
          <Moon size={24} />
          <h3 className="text-lg font-semibold">Apariencia</h3>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Modo Oscuro</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Cambia el tema visual de la aplicación</p>
          </div>
          <button
            onClick={() => setIsDark(!isDark)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              isDark ? 'bg-indigo-600' : 'bg-stone-200 dark:bg-stone-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isDark ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
        <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
          <Globe size={24} />
          <h3 className="text-lg font-semibold">Idioma</h3>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Idioma de la interfaz</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Selecciona el idioma principal (requiere recargar)</p>
          </div>
          <select
            value={language}
            onChange={handleLanguageChange}
            className="px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 text-sm"
          >
            <option value="es">Español</option>
            <option value="en">English</option>
            <option value="pt">Português</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
        <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
          <Database size={24} />
          <h3 className="text-lg font-semibold">Integración con Google Sheets</h3>
        </div>

        <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
          La vinculación con Google Sheets ahora está configurada de forma segura a través de variables de entorno (<code>.env</code>).
        </p>

        <div className="pt-6 border-t border-stone-100 dark:border-stone-800">
          <h4 className="text-sm font-semibold text-stone-800 dark:text-stone-100 mb-3">Instrucciones de Vinculación:</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-stone-600 dark:text-stone-400">
            <li>Abre tu Google Sheet.</li>
            <li>Ve a <strong>Extensiones</strong> {'>'} <strong>Apps Script</strong>.</li>
            <li>Pega el código de inicialización que tienes.</li>
            <li>Haz clic en <strong>Implementar</strong> {'>'} <strong>Nueva implementación</strong>.</li>
            <li>Selecciona tipo <strong>Aplicación web</strong>.</li>
            <li>Configura "Quién tiene acceso" como <strong>Cualquier persona</strong>.</li>
            <li>Copia la URL generada y agrégala a tu archivo <code>.env</code> como <code>VITE_GOOGLE_SHEETS_URL</code>.</li>
          </ol>
          <a 
            href="https://script.google.com/home" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center mt-4 text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium"
          >
            Ir a Google Apps Script <ExternalLink size={14} className="ml-1" />
          </a>
        </div>
      </div>
        </div>
      </div>
      <div className="pt-8 border-t border-stone-100 dark:border-stone-800 flex justify-center">
        <button
          onClick={handleSaveSettings}
          disabled={status === 'saving'}
          className="flex items-center space-x-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 font-bold"
        >
          {status === 'saving' ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save size={20} />
          )}
          <span>{status === 'saving' ? 'Guardando...' : 'Guardar Todos los Cambios'}</span>
        </button>
      </div>
    </div>
  );
}

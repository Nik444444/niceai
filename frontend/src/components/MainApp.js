import React, { useState, useRef, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import UserProfile from './UserProfile';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

// Telegram Web App integration
const useTelegram = () => {
  const [tg, setTg] = useState(null);
  const [user, setUser] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if we're in Telegram Web App
    if (window.Telegram && window.Telegram.WebApp) {
      const telegram = window.Telegram.WebApp;
      telegram.ready();
      telegram.expand();
      setTg(telegram);
      setUser(telegram.initDataUnsafe?.user);
      
      // Set theme colors
      if (telegram.colorScheme === 'dark') {
        document.body.style.backgroundColor = '#1a1a1a';
      }
    }
    
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return { tg, user, isMobile };
};

const MainApp = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [language, setLanguage] = useState('ru');
  const [dragOver, setDragOver] = useState(false);
  const [llmProviders, setLlmProviders] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const fileInputRef = useRef(null);
  const { tg, user: telegramUser, isMobile } = useTelegram();
  const { user, isAuthenticated, getAuthHeaders, logout } = useContext(AuthContext);

  // Load LLM providers status on component mount
  useEffect(() => {
    const loadLlmStatus = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/llm-status`);
        const data = await response.json();
        setLlmProviders(data);
      } catch (error) {
        console.error('Failed to load LLM providers status:', error);
      }
    };
    
    loadLlmStatus();
  }, []);

  const translations = {
    en: {
      title: "German Letter AI Assistant",
      subtitle: "Upload German official letters and get instant AI-powered explanations",
      uploadTitle: "Upload Document",
      uploadDescription: "Drag and drop your German letter (PDF or image) or click to browse",
      browseBtnText: "Browse Files",
      languageLabel: "Choose Language:",
      analyzeBtnText: "Analyze Letter",
      analyzing: "Analyzing...",
      supportedFormats: "Supported formats: PDF, JPEG, PNG (max 10MB)",
      results: "Analysis Results",
      summary: "Summary",
      sender: "Sender",
      letterType: "Letter Type",
      mainContent: "Main Content",
      actionsNeeded: "Actions Needed",
      deadlines: "Important Deadlines",
      documentsRequired: "Documents Required",
      consequences: "Consequences if No Action",
      urgencyLevel: "Urgency Level",
      responseTemplate: "Response Template",
      noResponseNeeded: "No response needed",
      tryAnother: "Analyze Another Letter",
      error: "Error",
      noFile: "Please select a file first",
      uploadError: "Upload failed. Please try again.",
      llmProvider: "AI Provider Used",
      llmStatus: "AI Providers Status",
      activeProviders: "Active Providers",
      urgencyLevels: {
        LOW: "Low",
        MEDIUM: "Medium",
        HIGH: "High"
      }
    },
    ru: {
      title: "ИИ-помощник для немецких писем",
      subtitle: "Загрузите немецкие официальные письма и получите мгновенные объяснения с помощью ИИ",
      uploadTitle: "Загрузить документ",
      uploadDescription: "Перетащите немецкое письмо (PDF или изображение) или нажмите для выбора",
      browseBtnText: "Выбрать файлы",
      languageLabel: "Выберите язык:",
      analyzeBtnText: "Анализировать письмо",
      analyzing: "Анализирую...",
      supportedFormats: "Поддерживаемые форматы: PDF, JPEG, PNG (макс. 10МБ)",
      results: "Результаты анализа",
      summary: "Краткое описание",
      sender: "Отправитель",
      letterType: "Тип письма",
      mainContent: "Основное содержание",
      actionsNeeded: "Необходимые действия",
      deadlines: "Важные сроки",
      documentsRequired: "Требуемые документы",
      consequences: "Последствия бездействия",
      urgencyLevel: "Уровень срочности",
      responseTemplate: "Шаблон ответа",
      noResponseNeeded: "Ответ не требуется",
      tryAnother: "Анализировать другое письмо",
      error: "Ошибка",
      noFile: "Пожалуйста, сначала выберите файл",
      uploadError: "Ошибка загрузки. Попробуйте еще раз.",
      llmProvider: "Использован AI провайдер",
      llmStatus: "Статус AI провайдеров",
      activeProviders: "Активные провайдеры",
      urgencyLevels: {
        LOW: "Низкий",
        MEDIUM: "Средний",
        HIGH: "Высокий"
      }
    },
    de: {
      title: "KI-Assistent für deutsche Briefe",
      subtitle: "Laden Sie deutsche Amtsbriefe hoch und erhalten Sie sofortige KI-gestützte Erklärungen",
      uploadTitle: "Dokument hochladen",
      uploadDescription: "Ziehen Sie Ihren deutschen Brief (PDF oder Bild) hierhin oder klicken Sie zum Durchsuchen",
      browseBtnText: "Dateien durchsuchen",
      languageLabel: "Sprache wählen:",
      analyzeBtnText: "Brief analysieren",
      analyzing: "Analysiere...",
      supportedFormats: "Unterstützte Formate: PDF, JPEG, PNG (max. 10MB)",
      results: "Analyseergebnisse",
      summary: "Zusammenfassung",
      sender: "Absender",
      letterType: "Brieftyp",
      mainContent: "Hauptinhalt",
      actionsNeeded: "Erforderliche Maßnahmen",
      deadlines: "Wichtige Fristen",
      documentsRequired: "Erforderliche Dokumente",
      consequences: "Konsequenzen bei Untätigkeit",
      urgencyLevel: "Dringlichkeitsstufe",
      responseTemplate: "Antwortvorlage",
      noResponseNeeded: "Keine Antwort erforderlich",
      tryAnother: "Einen anderen Brief analysieren",
      error: "Fehler",
      noFile: "Bitte wählen Sie zuerst eine Datei aus",
      uploadError: "Upload fehlgeschlagen. Bitte versuchen Sie es erneut.",
      llmProvider: "Verwendeter AI-Anbieter",
      llmStatus: "AI-Anbieter Status",
      activeProviders: "Aktive Anbieter",
      urgencyLevels: {
        LOW: "Niedrig",
        MEDIUM: "Mittel",
        HIGH: "Hoch"
      }
    }
  };

  const t = translations[language];

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setError(null);
    setAnalysis(null);
    
    // Telegram haptic feedback
    if (tg && tg.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const analyzeFile = async () => {
    if (!selectedFile) {
      setError(t.noFile);
      return;
    }

    setLoading(true);
    setError(null);

    // Telegram haptic feedback
    if (tg && tg.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('language', language);

    try {
      const endpoint = isAuthenticated() ? '/api/analyze-file-with-user-keys' : '/api/analyze-file';
      const headers = isAuthenticated() ? getAuthHeaders() : {};

      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setAnalysis(result);
        
        // Telegram haptic feedback
        if (tg && tg.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('success');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || t.uploadError);
        
        // Telegram haptic feedback
        if (tg && tg.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('error');
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(t.uploadError);
      if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('error');
      }
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (level) => {
    switch (level) {
      case 'HIGH': return 'text-red-600 bg-gradient-to-r from-red-100 to-red-200 border-red-300';
      case 'MEDIUM': return 'text-yellow-600 bg-gradient-to-r from-yellow-100 to-yellow-200 border-yellow-300';
      case 'LOW': return 'text-green-600 bg-gradient-to-r from-green-100 to-green-200 border-green-300';
      default: return 'text-gray-600 bg-gradient-to-r from-gray-100 to-gray-200 border-gray-300';
    }
  };

  const resetAnalysis = () => {
    setSelectedFile(null);
    setAnalysis(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const LanguageIcon = ({ lang }) => {
    const flags = {
      en: '🇺🇸',
      ru: '🇷🇺',
      de: '🇩🇪'
    };
    return <span className="mr-2 text-lg">{flags[lang]}</span>;
  };

  // Mobile-optimized styles
  const containerClass = isMobile ? 'px-3 py-4' : 'px-4 py-8';
  const titleClass = isMobile ? 'text-3xl' : 'text-6xl';
  const subtitleClass = isMobile ? 'text-base' : 'text-xl';
  const cardPadding = isMobile ? 'p-4' : 'p-10';
  const gridClass = isMobile ? 'grid-cols-1' : 'grid-cols-3';

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden ${isMobile ? 'pb-safe' : ''}`}>
      {/* Background Animation - Reduced on mobile */}
      {!isMobile && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-indigo-400 to-pink-400 rounded-full opacity-20 animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-cyan-400 to-blue-400 rounded-full opacity-10 animate-spin-slow"></div>
        </div>
      )}

      <div className={`relative z-10 container mx-auto ${containerClass}`}>
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-block">
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              <h1 className={`${titleClass} font-bold mb-1 tracking-tight`}>
                {t.title}
              </h1>
            </div>
            <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 rounded-full mb-4 animate-shimmer"></div>
          </div>
          <p className={`${subtitleClass} text-gray-600 max-w-3xl mx-auto leading-relaxed font-light`}>
            {t.subtitle}
          </p>

          {/* Show user info if in Telegram or authenticated */}
          {telegramUser && (
            <div className="mt-3 text-sm text-gray-500">
              👋 Hello, {telegramUser.first_name}!
            </div>
          )}

          {isAuthenticated() && (
            <div className="mt-3 flex items-center justify-center space-x-4">
              <div className="text-sm text-gray-600">
                Добро пожаловать, {user.name}!
              </div>
              <button
                onClick={() => setShowProfile(true)}
                className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded-full transition-colors"
              >
                Профиль
              </button>
              {!user.has_gemini_api_key && (
                <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                  ⚠️ Добавьте API ключ
                </div>
              )}
            </div>
          )}

          {!isAuthenticated() && (
            <div className="mt-3">
              <p className="text-sm text-gray-500 mb-2">
                Войдите через Google и добавьте ваш Gemini API ключ для персонального использования
              </p>
              <p className="text-xs text-gray-400">
                Или используйте системные AI провайдеры для анализа без входа
              </p>
            </div>
          )}

          {/* LLM Providers Status */}
          {llmProviders && llmProviders.status === 'success' && (
            <div className="mt-4 text-sm text-gray-600">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-100 to-blue-100 border border-green-200">
                <svg className="w-4 h-4 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t.activeProviders}: {llmProviders.active_providers}/{llmProviders.total_providers}
              </div>
            </div>
          )}
        </div>

        {/* Language Selector */}
        <div className="flex justify-center mb-8 animate-slide-up">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-2xl p-4 border border-white/20">
            <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">
              {t.languageLabel}
            </label>
            <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'space-x-2'}`}>
              {['en', 'ru', 'de'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`flex items-center ${isMobile ? 'px-4 py-2 justify-center' : 'px-6 py-3'} rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                    language === lang
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <LanguageIcon lang={lang} />
                  {lang === 'en' && 'English'}
                  {lang === 'ru' && 'Русский'}
                  {lang === 'de' && 'Deutsch'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!analysis ? (
          /* Upload Section */
          <div className="max-w-4xl mx-auto animate-fade-in">
            <div className={`bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl ${cardPadding} border border-white/20 relative overflow-hidden`}>
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 transform rotate-45 scale-150"></div>
              </div>

              <div className="relative z-10">
                <div className="text-center mb-6">
                  <div className={`inline-flex items-center justify-center ${isMobile ? 'w-16 h-16' : 'w-20 h-20'} bg-gradient-to-r from-blue-500 to-purple-500 rounded-full shadow-lg mb-4 animate-bounce`}>
                    <svg className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-gray-900 mb-2`}>
                    {t.uploadTitle}
                  </h2>
                </div>

                <div
                  className={`border-3 border-dashed rounded-2xl ${isMobile ? 'p-8' : 'p-16'} text-center transition-all duration-300 transform hover:scale-102 ${
                    dragOver
                      ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-blue-50 shadow-xl scale-102'
                      : 'border-gray-300 hover:border-gray-400 bg-gradient-to-br from-gray-50 to-white'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <div className="mb-6">
                    <div className={`inline-flex items-center justify-center ${isMobile ? 'w-16 h-16' : 'w-24 h-24'} bg-gradient-to-r from-blue-100 to-purple-100 rounded-full mb-4 animate-pulse`}>
                      <svg className={`${isMobile ? 'w-8 h-8' : 'w-12 h-12'} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                  </div>

                  <p className={`${isMobile ? 'text-base' : 'text-xl'} text-gray-600 mb-6 font-medium`}>{t.uploadDescription}</p>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`bg-gradient-to-r from-blue-500 to-purple-500 text-white ${isMobile ? 'px-6 py-3' : 'px-10 py-4'} rounded-2xl font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl`}
                  >
                    <svg className="w-5 h-5 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {t.browseBtnText}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileInput}
                    className="hidden"
                  />

                  <p className="text-sm text-gray-500 mt-4 bg-gray-100 rounded-full px-4 py-2 inline-block">
                    {t.supportedFormats}
                  </p>
                </div>

                {selectedFile && (
                  <div className="mt-6 animate-slide-in">
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-4 border border-green-200 shadow-lg">
                      <div className={`flex items-center ${isMobile ? 'flex-col space-y-3' : 'justify-between'}`}>
                        <div className="flex items-center">
                          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-green-400 to-blue-400 rounded-full mr-3">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{selectedFile.name}</p>
                            <p className="text-xs text-gray-600 bg-white rounded-full px-2 py-1 inline-block mt-1">
                              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={analyzeFile}
                          disabled={loading}
                          className={`bg-gradient-to-r from-green-500 to-blue-500 text-white ${isMobile ? 'px-6 py-2 w-full' : 'px-8 py-3'} rounded-2xl font-semibold hover:from-green-600 hover:to-blue-600 transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {loading ? (
                            <div className="flex items-center justify-center">
                              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              {t.analyzing}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              {t.analyzeBtnText}
                            </div>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mt-4 animate-shake">
                    <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-4 shadow-lg">
                      <div className="flex items-center">
                        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-red-400 to-pink-400 rounded-full mr-3">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-bold text-red-800 text-sm">{t.error}</p>
                          <p className="text-red-600 text-sm">{error}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Results Section */
          <div className="max-w-5xl mx-auto animate-fade-in">
            <div className={`bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl ${cardPadding} border border-white/20 relative overflow-hidden`}>
              <div className="relative z-10">
                <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'justify-between items-center'} mb-6`}>
                  <h2 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-bold text-gray-900`}>{t.results}</h2>
                  <button
                    onClick={resetAnalysis}
                    className={`bg-gradient-to-r from-indigo-500 to-purple-500 text-white ${isMobile ? 'px-4 py-2 w-full' : 'px-6 py-3'} rounded-2xl font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-105 shadow-lg`}
                  >
                    {t.tryAnother}
                  </button>
                </div>

                {/* Display analysis results */}
                <div className="space-y-6">
                  {analysis.summary && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200 shadow-lg">
                      <h3 className="text-lg font-bold text-blue-900 mb-3">{t.summary}</h3>
                      <p className="text-blue-800 leading-relaxed">{analysis.summary}</p>
                    </div>
                  )}

                  {analysis.analysis && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analysis.analysis.sender && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-200 shadow-lg">
                          <h4 className="text-sm font-bold text-purple-900 mb-2">{t.sender}</h4>
                          <p className="text-purple-800 text-sm">{analysis.analysis.sender}</p>
                        </div>
                      )}

                      {analysis.analysis.letter_type && (
                        <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-2xl p-4 border border-green-200 shadow-lg">
                          <h4 className="text-sm font-bold text-green-900 mb-2">{t.letterType}</h4>
                          <p className="text-green-800 text-sm">{analysis.analysis.letter_type}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {analysis.analysis?.main_content && (
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 border border-yellow-200 shadow-lg">
                      <h4 className="text-lg font-bold text-yellow-900 mb-3">{t.mainContent}</h4>
                      <p className="text-yellow-800 leading-relaxed">{analysis.analysis.main_content}</p>
                    </div>
                  )}

                  {analysis.actions_needed && analysis.actions_needed.length > 0 && (
                    <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6 border border-red-200 shadow-lg">
                      <h4 className="text-lg font-bold text-red-900 mb-3">{t.actionsNeeded}</h4>
                      <ul className="space-y-2">
                        {analysis.actions_needed.map((action, index) => (
                          <li key={index} className="flex items-start">
                            <span className="flex items-center justify-center w-5 h-5 bg-red-100 rounded-full mr-2 mt-0.5 flex-shrink-0">
                              <span className="text-red-600 font-bold text-xs">{index + 1}</span>
                            </span>
                            <span className="text-red-800 text-sm">{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.response_template && (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-200 shadow-lg">
                      <h4 className="text-lg font-bold text-emerald-900 mb-3">{t.responseTemplate}</h4>
                      <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-inner">
                        <pre className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                          {analysis.response_template}
                        </pre>
                      </div>
                    </div>
                  )}

                  {analysis.llm_provider && (
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-4 border border-cyan-200 shadow-lg">
                      <h4 className="text-sm font-bold text-cyan-900 mb-2">{t.llmProvider}</h4>
                      <span className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full text-xs font-semibold uppercase tracking-wide">
                        {analysis.llm_provider}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Profile Modal */}
      {showProfile && (
        <UserProfile onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
};

export default MainApp;
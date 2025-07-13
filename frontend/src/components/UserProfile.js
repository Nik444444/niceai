import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const UserProfile = ({ onClose }) => {
  const { user, getAuthHeaders, updateUser, logout } = useContext(AuthContext);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSaveApiKey = async () => {
    if (!geminiApiKey.trim()) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/gemini-api-key`,
        { gemini_api_key: geminiApiKey },
        { headers: getAuthHeaders() }
      );

      setMessage({ type: 'success', text: 'API ключ успешно сохранен!' });
      setGeminiApiKey('');
      
      // Update user status
      const updatedUser = { ...user, has_gemini_api_key: true };
      updateUser(updatedUser);
      
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Ошибка при сохранении API ключа';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Профиль пользователя</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* User Info */}
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-4">
              {user.picture && (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-16 h-16 rounded-full border-2 border-blue-200"
                />
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
                <p className="text-gray-600">{user.email}</p>
                <p className="text-sm text-gray-500">
                  Провайдер: {user.oauth_provider}
                </p>
              </div>
            </div>
          </div>

          {/* API Key Section */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">Gemini API Key</h4>
                {user.has_gemini_api_key ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    ✓ Настроен
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                    ⚠ Не настроен
                  </span>
                )}
              </div>
              
              <p className="text-sm text-gray-600 mb-3">
                Добавьте свой Gemini API ключ для персонального использования и лучшего качества анализа.
              </p>
              
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Вставьте ваш Gemini API ключ"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                <button
                  onClick={handleSaveApiKey}
                  disabled={!geminiApiKey.trim() || saving}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 px-4 rounded-xl font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Сохранение...
                    </div>
                  ) : (
                    'Сохранить API ключ'
                  )}
                </button>
                
                <a
                  href="https://makersuite.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 block text-center"
                >
                  Получить Gemini API ключ →
                </a>
              </div>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-4 p-3 rounded-xl ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <p className="text-sm">{message.text}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Закрыть
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 bg-red-500 text-white py-2 px-4 rounded-xl font-medium hover:bg-red-600 transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
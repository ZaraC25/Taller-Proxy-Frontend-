import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

function App() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const fetchData = async () => {
    try {
      const resStatus = await axios.get(`${API_URL}/quota/status`);
      setStatus(resStatus.data);
      const resHistory = await axios.get(`${API_URL}/quota/history`);
      const formatted = resHistory.data.map((val, i) => ({ dia: `Día ${i+1}`, tokens: val }));
      setHistory(formatted);
    } catch (error) {
      console.error("Error fetching data", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSend = async () => {
    if (!prompt.trim() || loading || countdown > 0) return;

    setMessages((prev) => [...prev, { role: 'user', text: prompt }]);
    setLoading(true);
    const currentPrompt = prompt;
    setPrompt('');

    try {
      const res = await axios.post(`${API_URL}/ai/generate`, { prompt: currentPrompt });
      setMessages((prev) => [...prev, { role: 'ai', text: res.data.response }]);
      fetchData();
    } catch (error) {
      if (error.response?.status === 429) {
        setMessages((prev) => [...prev, { role: 'ai', text: "⚠️ Demasiadas peticiones. Espera un momento." }]);
        setCountdown(10);
      } else if (error.response?.status === 402) {
        setShowUpgrade(true);
      } else {
        setMessages((prev) => [...prev, { role: 'ai', text: "❌ Error en el servidor." }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      await axios.post(`${API_URL}/quota/upgrade`);
      setShowUpgrade(false);
      fetchData();
      alert("¡Upgrade exitoso a PRO!");
    } catch (error) {
      alert("Error al actualizar");
    }
  };

  const tokenEstimate = Math.ceil(prompt.length / 4);
  const planColor = status?.plan === 'FREE' ? 'bg-gray-500' : status?.plan === 'PRO' ? 'bg-blue-600' : 'bg-purple-600';

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow">
          <h1 className="text-2xl font-bold text-gray-800">Plataforma IA</h1>
          <div className={`px-4 py-2 rounded-full text-white font-bold ${planColor}`}>
            Plan: {status?.plan || '...'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="font-bold text-gray-700 mb-2">Uso de Tokens</h2>
            {status && (
              <div className="space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div 
                    className="bg-green-500 h-4 rounded-full" 
                    style={{ width: `${(status.usedTokens / (status.usedTokens + status.remainingTokens)) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600">
                  {status.usedTokens} / {status.usedTokens + status.remainingTokens} tokens usados
                </p>
                <p className="text-xs text-gray-400">Reinicio de cuota: {status.resetDate}</p>
              </div>
            )}
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="font-bold text-gray-700 mb-2">Historial (7 días)</h2>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={history}>
                  <XAxis dataKey="dia" hide />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="tokens" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg flex flex-col h-[500px]">
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-lg max-w-[80%] ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && <div className="text-gray-500 italic">IA escribiendo...</div>}
          </div>

          <div className="p-4 border-t bg-gray-50 flex flex-col gap-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Peticiones este minuto: {status?.requestsThisMinute} / {status?.maxRequestsPerMinute}</span>
              {countdown > 0 && <span className="text-red-500 font-bold">Bloqueado: {countdown}s</span>}
            </div>
            
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Escribe tu prompt aquí..."
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={countdown > 0}
                />
                {prompt.length > 0 && (
                  <span className="absolute right-3 top-3 text-xs text-gray-400">
                    ~{tokenEstimate} tokens
                  </span>
                )}
              </div>
              <button
                onClick={handleSend}
                disabled={loading || countdown > 0 || !prompt.trim()}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      </div>

      {showUpgrade && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Cuota Agotada</h2>
            <p className="text-gray-600 mb-6">
              Has agotado tus tokens mensuales del plan FREE. Actualiza a PRO para continuar generando texto.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowUpgrade(false)}
                className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button 
                onClick={handleUpgrade}
                className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 font-bold"
              >
                Simular Pago (PRO)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
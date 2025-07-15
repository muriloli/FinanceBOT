export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            FinanceFlow WhatsApp Bot
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            AI-powered personal finance assistant for WhatsApp
          </p>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              🤖 Backend Service Status
            </h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>Express Server</span>
                <span className="text-green-600 font-medium">✓ Running</span>
              </div>
              <div className="flex items-center justify-between">
                <span>WhatsApp Webhook</span>
                <span className="text-yellow-600 font-medium">⚠ Mock Mode</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Database</span>
                <span className="text-green-600 font-medium">✓ Connected</span>
              </div>
            </div>
          </div>
          
          <div className="text-left space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Features:</h3>
            <ul className="space-y-2 text-gray-600">
              <li>• Natural language transaction processing</li>
              <li>• Voice message transcription</li>
              <li>• Financial data queries and summaries</li>
              <li>• Integration with existing FinanceFlow database</li>
              <li>• Portuguese language support</li>
            </ul>
          </div>
          
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              This is a backend service for WhatsApp integration. To use the bot, configure your WhatsApp webhook to point to <code>/api/bot/webhook/whatsapp</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
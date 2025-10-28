import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-blue-50 to-white">
      <div className="text-center space-y-8 max-w-4xl">
        <h1 className="text-5xl font-bold text-gray-900">
          Curriculum Generator App
        </h1>
        <p className="text-xl text-gray-600">
          Welcome to the AGCQ Curriculum Generator
        </p>
        <p className="text-lg text-gray-500">
          AI-powered curriculum development for educational institutions
        </p>

        <div className="flex gap-6 justify-center mt-12">
          <Link
            href="/admin"
            className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold shadow-lg hover:shadow-xl"
          >
            Admin Dashboard
          </Link>
          <Link
            href="/student"
            className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold shadow-lg hover:shadow-xl"
          >
            Student Portal
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              📚 Program Management
            </h3>
            <p className="text-gray-600">
              Upload and manage educational programs with ease
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              🤖 AI Generation
            </h3>
            <p className="text-gray-600">
              Generate comprehensive curricula using advanced AI
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              📊 Analytics
            </h3>
            <p className="text-gray-600">
              Track performance and optimize learning outcomes
            </p>
          </div>
        </div>

        <div className="mt-12 text-sm text-gray-500">
          <p>Backend API: <span className="font-mono text-blue-600">http://localhost:4000</span></p>
          <p className="mt-2">
            <a 
              href="http://localhost:4000/health" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Check API Health →
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

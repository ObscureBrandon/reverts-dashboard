'use client';

import { useUserRole } from '@/lib/hooks/queries/useUserRole';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { role, isLoading, isMod } = useUserRole();
  const router = useRouter();

  // Redirect normal users to /my-tickets
  useEffect(() => {
    if (!isLoading && role === 'user') {
      router.replace('/my-tickets');
    }
  }, [role, isLoading, router]);

  // Show loading while determining role
  if (isLoading || role === 'user') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Mod view — full dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Reverts Dashboard
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Browse support tickets and search through messages
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Link
              href="/users"
              className="group block p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all duration-200 border-2 border-transparent hover:border-emerald-500"
            >
              <div className="flex items-center mb-4">
                <svg
                  className="w-10 h-10 text-emerald-500 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                  />
                </svg>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Users
                </h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                View and manage community members. Filter by role, assignment
                status, and more.
              </p>
              <div className="text-emerald-500 group-hover:text-emerald-600 font-medium flex items-center">
                Manage Users
                <svg
                  className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </div>
            </Link>

            <Link
              href="/tickets"
              className="group block p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all duration-200 border-2 border-transparent hover:border-blue-500"
            >
              <div className="flex items-center mb-4">
                <svg
                  className="w-10 h-10 text-blue-500 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                  />
                </svg>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Tickets
                </h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                View all support tickets with filtering and sorting options.
                Browse open, closed, and deleted tickets.
              </p>
              <div className="text-blue-500 group-hover:text-blue-600 font-medium flex items-center">
                Browse Tickets
                <svg
                  className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </div>
            </Link>

            <Link
              href="/messages"
              className="group block p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all duration-200 border-2 border-transparent hover:border-purple-500"
            >
              <div className="flex items-center mb-4">
                <svg
                  className="w-10 h-10 text-purple-500 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Messages
                </h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Search through all messages across tickets. Filter by staff
                members and search for specific content.
              </p>
              <div className="text-purple-500 group-hover:text-purple-600 font-medium flex items-center">
                Search Messages
                <svg
                  className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </div>
            </Link>
          </div>

          <div className="mt-12 text-center">
            <div className="inline-flex items-center px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <svg
                className="w-5 h-5 text-blue-500 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Navigate seamlessly between tickets and messages
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

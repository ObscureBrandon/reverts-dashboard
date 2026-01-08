'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Avatar } from '../../components/Avatar';
import { roleColorToHex } from '../../components/utils';
import { useUserPopoverData } from '@/lib/hooks/queries/useUsers';


type Props = {
  userId: string;
};

type UserRole = {
  id: string;
  name: string;
  color: number;
  position: number;
};

type RecentTicket = {
  id: number;
  sequence: number | null;
  status: string | null;
  createdAt: string;
};

type PopoverData = {
  user: {
    id: string;
    name: string;
    displayName: string | null;
    displayAvatar: string | null;
    nick: string | null;
    inGuild: boolean | null;
    isVerified: boolean | null;
    isVoiceVerified: boolean | null;
  };
  roles: UserRole[];
  ticketStats: {
    open: number;
    closed: number;
  };
  recentTickets: RecentTicket[];
};

export default function UserPageClient({ userId }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const { data, isLoading, error } = useUserPopoverData(userId);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Debug logging
  console.log('User Page - userId:', userId);
  console.log('User Page - isLoading:', isLoading);
  console.log('User Page - error:', error);
  console.log('User Page - data:', data);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading user…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-red-500">Failed to load user data</div>
          <div className="text-sm text-gray-500">{error?.message || 'Unknown error'}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">No user data found</div>
      </div>
    );
  }

  const userRoles = data.roles || [];
  const ticketStats = data.ticketStats;
  const recentTickets = data.recentTickets || [];
  const userDetails = data.user;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <Avatar 
            src={userDetails.displayAvatar}
            name={userDetails.displayName || userDetails.name}
            size={80}
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
              {userDetails.displayName || userDetails.name}
            </h1>
            <p className="text-base text-gray-500 dark:text-gray-400 truncate">
              @{userDetails.name}
            </p>
            {userDetails.nick && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Nickname: {userDetails.nick}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {userDetails.inGuild ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  In Server
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Left Server
                </span>
              )}
              {userDetails.isVerified && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              )}
              {userDetails.isVoiceVerified && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  Voice Verified
                </span>
              )}
            </div>
          </div>
        </div>

        {/* User ID */}
        <div className="mt-4">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            User ID
          </label>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-900 dark:text-white font-mono bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded flex-1">
              {userId}
            </p>
            <button
              onClick={() => copyToClipboard(userId)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Copy ID"
            >
              {copiedId === userId ? (
                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Roles Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Roles</h2>
        {userRoles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {userRoles.map(role => (
              <div
                key={role.id}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: role.color === 0 ? '#99AAB5' : roleColorToHex(role.color) }}
                />
                <span>{role.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400">No roles assigned</div>
        )}
      </div>

      {/* Tickets Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Support Tickets</h2>
        
        {ticketStats ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {ticketStats.open}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Open Tickets</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">
                  {ticketStats.closed}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Closed Tickets</div>
              </div>
            </div>
            
            {recentTickets.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Recent Tickets
                </h3>
                <div className="space-y-2">
                  {recentTickets.map(ticket => (
                    <Link
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="block px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-gray-200 dark:border-gray-700 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-base font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                            #{ticket.sequence !== null ? ticket.sequence : ticket.id}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            ticket.status === 'OPEN' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {ticket.status}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(ticket.createdAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            
            {(ticketStats.open > 0 || ticketStats.closed > 0) && (
              <Link
                href={`/tickets?author=${userId}`}
                className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <span>View All Tickets</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400">No tickets found</div>
        )}
      </div>
    </div>
  );
}
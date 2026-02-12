'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Avatar } from '../Avatar';
import { roleColorToHex } from '../utils';
import { PopoverWrapper, Position } from './PopoverWrapper';

export type UserPopoverData = {
  id: string;
  name: string;
  displayName: string | null;
  displayAvatar: string | null;
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

type UserPopoverProps = {
  isOpen: boolean;
  onClose: () => void;
  triggerPosition: Position | null;
  userData: UserPopoverData;
  popoverData: PopoverData;
};

export function UserPopover({ isOpen, onClose, triggerPosition, userData, popoverData }: UserPopoverProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const userRoles = popoverData.roles || [];
  const ticketStats = popoverData.ticketStats;
  const recentTickets = popoverData.recentTickets || [];
  const userDetails = popoverData.user;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <PopoverWrapper
      isOpen={isOpen}
      onClose={onClose}
      triggerPosition={triggerPosition}
      title="User"
      dependencies={[userRoles.length, recentTickets.length]}
    >
      <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
        <Avatar 
          src={userData.displayAvatar}
          name={userData.displayName || userData.name}
          size={64}
        />
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
            {userData.displayName || userData.name}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            @{userData.name}
          </p>
          {userDetails && (
            <div className="flex items-center gap-1.5 mt-1">
              {userDetails.inGuild ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  In Server
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Left Server
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">User ID</label>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-gray-900 dark:text-white font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded flex-1">
            {userData.id}
          </p>
          <button
            onClick={() => copyToClipboard(userData.id)}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            title="Copy ID"
          >
            {copiedId === userData.id ? (
              <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {/* Roles Section */}
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Roles
        </label>
        {userRoles.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {userRoles.map(role => (
              <div
                key={role.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: role.color === 0 ? '#99AAB5' : roleColorToHex(role.color) }}
                />
                <span>{role.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">No roles</div>
        )}
      </div>
      
      {/* Tickets Section */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Support Tickets
        </label>
        {ticketStats ? (
          <>
            <div className="flex gap-4 mt-2 mb-3">
              <div className="flex-1">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {ticketStats.open}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Open</div>
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {ticketStats.closed}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Closed</div>
              </div>
            </div>
            
            {recentTickets.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Recent Tickets
                </div>
                {recentTickets.map(ticket => (
                  <Link
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    className="block px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group"
                    onClick={onClose}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:underline">
                          #{ticket.sequence !== null ? ticket.sequence : ticket.id}
                        </span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                          ticket.status === 'OPEN' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            
            {(ticketStats.open > 0 || ticketStats.closed > 0) && (
              <Link
                href={`/tickets?author=${userData.id}`}
                className="mt-3 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                onClick={onClose}
              >
                <span>View All Tickets</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </>
        ) : (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">No tickets found</div>
        )}
      </div>
      <Link
        href={`/user/${userData.id}`}
        onClick={onClose}
        className="mt-4 flex items-center justify-center gap-2 w-full px-3 py-2
                  bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900
                  rounded-md hover:opacity-90 transition-opacity text-sm font-medium"
      >
        View Full Profile
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>

    </PopoverWrapper>
  );
}

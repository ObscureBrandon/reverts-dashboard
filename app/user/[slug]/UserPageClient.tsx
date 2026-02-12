'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Avatar } from '../../components/Avatar';
import { roleColorToHex } from '../../components/utils';
import { useUserPopoverData, useUserSupervisors } from '@/lib/hooks/queries/useUsers';
import { useUserSupportStatus } from '@/lib/hooks/queries/useUserSupportStatus';
import { mapSupportPresentation } from '@/lib/support/mapSupportPresentation';

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

const TONE_CLASSES: Record<string, string> = {
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

export default function UserPageClient({ userId }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading, error } = useUserPopoverData(userId);
  const { data: supervisorsData, isLoading: supervisorsLoading, error: supervisorsError } =
    useUserSupervisors(userId);
  const { data: supportStatus, isLoading: supportLoading, error: supportError } =
    useUserSupportStatus(userId);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading user…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Failed to load user
      </div>
    );
  }

  const { user, roles, ticketStats, recentTickets } = data;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
        <div className="flex gap-4 border-b pb-4">
          <Avatar
            src={user.displayAvatar}
            name={user.displayName || user.name}
            size={80}
          />

          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {user.displayName || user.name}
            </h1>
            <p className="text-gray-500">@{user.name}</p>
          </div>
        </div>

        {/* User ID */}
        <div className="mt-4">
          <label className="text-xs text-gray-500 uppercase">User ID</label>
          <div className="flex gap-2 mt-1">
            <p className="font-mono bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded flex-1">
              {userId}
            </p>
            <button onClick={() => copyToClipboard(userId)}>
              {copiedId === userId ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* Roles */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
        <h2 className="font-semibold mb-4">Roles</h2>
        <div className="flex flex-wrap gap-2">
          {roles.map(role => (
            <div
              key={role.id}
              className="flex items-center gap-2 px-3 py-2 rounded bg-gray-100 dark:bg-gray-700"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor:
                    role.color === 0 ? '#99AAB5' : roleColorToHex(role.color),
                }}
              />
              {role.name}
            </div>
          ))}
        </div>
      </div>

      {/* Tickets */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
        <h2 className="font-semibold mb-4">Support Tickets</h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded">
            <div className="text-3xl font-bold">{ticketStats.open}</div>
            <div className="text-sm text-gray-500">Open</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded">
            <div className="text-3xl font-bold">{ticketStats.closed}</div>
            <div className="text-sm text-gray-500">Closed</div>
          </div>
        </div>

        {/* Supervisors */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-sm uppercase text-gray-500 mb-3">Supervisors</h3>

          {supervisorsLoading && <div>Loading…</div>}
          {supervisorsError && <div className="text-red-500">Failed to load</div>}

          {!supervisorsLoading && supervisorsData?.presentSupervisor && (
            <div className="flex items-center gap-3">
              <Avatar
                src={supervisorsData.presentSupervisor.supervisor.displayAvatar}
                name={
                  supervisorsData.presentSupervisor.supervisor.displayName ||
                  supervisorsData.presentSupervisor.supervisor.name
                }
                size={36}
              />
              <div>
                <div className="font-medium">
                  {supervisorsData.presentSupervisor.supervisor.displayName ||
                    supervisorsData.presentSupervisor.supervisor.name}
                </div>
                <div className="text-xs text-gray-500">Present supervisor</div>
              </div>
            </div>
          )}
        </div>

        {/* Support Status */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-sm uppercase text-gray-500 mb-3">
            Support Status
          </h3>

          {supportLoading && <div>Loading support status…</div>}
          {supportError && <div className="text-red-500">Failed to load</div>}

          {!supportLoading && !supportError && supportStatus && (() => {
            const presentation = mapSupportPresentation(supportStatus.state);
            const isArchived = supportStatus.state === 'archived';

            return (
              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-1 rounded text-xs font-medium ${
                    TONE_CLASSES[presentation.tone]
                  }`}
                >
                  {presentation.label}
                </span>

                {!isArchived && supportStatus.data?.assignedAt && (
                  <span className="text-xs text-gray-500">
                    Assigned on{' '}
                    {new Date(
                      supportStatus.data.assignedAt
                    ).toLocaleDateString()}
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {(ticketStats.open > 0 || ticketStats.closed > 0) && (
          <Link
            href={`/tickets?author=${userId}`}
            className="mt-6 block text-center bg-blue-600 text-white py-3 rounded hover:bg-blue-700"
          >
            View All Tickets
          </Link>
        )}
      </div>
    </div>
  );
}

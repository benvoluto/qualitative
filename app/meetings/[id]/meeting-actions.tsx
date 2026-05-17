"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Meeting, Customer } from "@/lib/db/types";

interface MeetingActionsProps {
  meeting: Meeting;
  customers: Customer[];
  extractCount: number;
  linkedCustomer?: Customer | null;
}

export function MeetingActions({ meeting, customers, extractCount }: MeetingActionsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Form state
  const [name, setName] = useState(meeting.name || "");
  const [meetingDate, setMeetingDate] = useState(
    meeting.meeting_date
      ? new Date(meeting.meeting_date).toISOString().slice(0, 16)
      : ""
  );
  const [customerId, setCustomerId] = useState(meeting.customer_id || "");
  const [userNotes, setUserNotes] = useState(meeting.user_notes || "");
  const [hostName, setHostName] = useState(meeting.host_name || "");
  const [hostEmail, setHostEmail] = useState(meeting.host_email || "");

  async function handleSave() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || null,
          meeting_date: meetingDate ? new Date(meetingDate).toISOString() : null,
          customer_id: customerId || null,
          user_notes: userNotes || null,
          host_name: hostName || null,
          host_email: hostEmail || null,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to save changes");
      }
    } catch {
      setError("Failed to save changes");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meeting.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/meetings");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete meeting");
        setShowDeleteConfirm(false);
      }
    } catch {
      setError("Failed to delete meeting");
      setShowDeleteConfirm(false);
    } finally {
      setIsLoading(false);
    }
  }

  function handleCancel() {
    setName(meeting.name || "");
    setMeetingDate(
      meeting.meeting_date
        ? new Date(meeting.meeting_date).toISOString().slice(0, 16)
        : ""
    );
    setCustomerId(meeting.customer_id || "");
    setUserNotes(meeting.user_notes || "");
    setHostName(meeting.host_name || "");
    setHostEmail(meeting.host_email || "");
    setIsEditing(false);
    setError(null);
  }

  // Get selected customer's type
  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <>
      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {error && (
          <span className="text-sm text-red-600">{error}</span>
        )}
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Edit Meeting
            </h3>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Meeting name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Host Information */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Host Name
                  </label>
                  <input
                    type="text"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Host name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Host Email
                  </label>
                  <input
                    type="email"
                    value={hostEmail}
                    onChange={(e) => setHostEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="host@example.com"
                  />
                </div>
              </div>

              {/* Customer Selection with Meeting Type Display */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Customer / Company
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.customer_type === "deal" ? "Deal" : "Customer"})
                    </option>
                  ))}
                </select>
                {/* Show Meeting Type Badge */}
                {customerId && selectedCustomer && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Meeting Type:</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        selectedCustomer.customer_type === "deal"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      }`}
                    >
                      {selectedCustomer.customer_type === "deal" ? "Sales Call (Deal)" : "Customer Meeting"}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add notes about this meeting..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Meeting?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will permanently delete this meeting
              {extractCount > 0 && ` and ${extractCount} associated extract${extractCount !== 1 ? "s" : ""}`}.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isLoading}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? "Deleting..." : "Delete Meeting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

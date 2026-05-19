"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Customer } from "@/lib/db/types";

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface NewMeetingFormProps {
  customers: Customer[];
}

export function NewMeetingForm({ customers }: NewMeetingFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostEmail, setHostEmail] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);

  // New participant form
  const [newParticipantName, setNewParticipantName] = useState("");
  const [newParticipantEmail, setNewParticipantEmail] = useState("");

  function addParticipant() {
    if (!newParticipantName.trim() && !newParticipantEmail.trim()) return;

    setParticipants([
      ...participants,
      {
        id: crypto.randomUUID(),
        name: newParticipantName.trim(),
        email: newParticipantEmail.trim(),
      },
    ]);
    setNewParticipantName("");
    setNewParticipantEmail("");
  }

  function removeParticipant(id: string) {
    setParticipants(participants.filter((p) => p.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          meeting_date: meetingDate || null,
          host_name: hostName || null,
          host_email: hostEmail || null,
          customer_id: customerId || null,
          transcript: transcript || null,
          participants: participants.map((p) => ({
            name: p.name,
            email: p.email || null,
          })),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(`/meetings/${data.meeting.id}`);
      } else {
        setError(data.error || "Failed to create meeting");
      }
    } catch {
      setError("Failed to create meeting");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Meeting Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Meeting Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Weekly Team Sync"
        />
      </div>

      {/* Meeting Date */}
      <div>
        <label htmlFor="meeting_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Meeting Date & Time
        </label>
        <input
          type="datetime-local"
          id="meeting_date"
          value={meetingDate}
          onChange={(e) => setMeetingDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Host Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="host_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Host Name
          </label>
          <input
            type="text"
            id="host_name"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="John Smith"
          />
        </div>
        <div>
          <label htmlFor="host_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Host Email
          </label>
          <input
            type="email"
            id="host_email"
            value={hostEmail}
            onChange={(e) => setHostEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="john@example.com"
          />
        </div>
      </div>

      {/* Customer */}
      <div>
        <label htmlFor="customer" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Organization
        </label>
        <select
          id="customer"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select an organization (optional)</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name} {customer.customer_type === "deal" ? "(Secondary)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Participants */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Participants
        </label>

        {/* Existing participants */}
        {participants.length > 0 && (
          <div className="mb-3 space-y-2">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="text-sm">
                  <span className="text-gray-900 dark:text-white">{participant.name || "Unknown"}</span>
                  {participant.email && (
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      ({participant.email})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeParticipant(participant.id)}
                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add participant form */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newParticipantName}
            onChange={(e) => setNewParticipantName(e.target.value)}
            placeholder="Name"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <input
            type="email"
            value={newParticipantEmail}
            onChange={(e) => setNewParticipantEmail(e.target.value)}
            placeholder="Email (optional)"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addParticipant();
              }
            }}
          />
          <button
            type="button"
            onClick={addParticipant}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Add participants who attended the meeting (press Enter or click + to add)
        </p>
      </div>

      {/* Transcript */}
      <div>
        <label htmlFor="transcript" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Transcript
        </label>
        <textarea
          id="transcript"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={12}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          placeholder="Paste the meeting transcript here..."
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Paste the meeting transcript or notes. You can extract insights from this after creating the meeting.
        </p>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Creating..." : "Create Meeting"}
        </button>
      </div>
    </form>
  );
}

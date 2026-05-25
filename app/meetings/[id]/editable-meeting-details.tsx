"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Meeting, Customer, CustomerType, ParticipationStatus } from "@/lib/db/types";

interface ParticipantData {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  participation_status: ParticipationStatus;
}

interface EditableMeetingDetailsProps {
  meeting: Meeting;
  linkedCustomer: Customer | null;
  participants: ParticipantData[];
  allCustomers: Customer[];
  extractCount: number;
}

interface HubSpotContact {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  jobTitle: string | null;
}

export function EditableMeetingDetails({
  meeting,
  linkedCustomer,
  participants: initialParticipants,
  allCustomers,
  extractCount,
}: EditableMeetingDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [participants, setParticipants] = useState<ParticipantData[]>(initialParticipants);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete(): Promise<void> {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });
      if (response.ok) {
        router.push("/meetings");
        return;
      }
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Failed to delete meeting:", error);
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  }

  // Form state
  const [formData, setFormData] = useState({
    meeting_date: meeting.meeting_date
      ? new Date(meeting.meeting_date).toISOString().slice(0, 16)
      : "",
    customer_id: meeting.customer_id || "",
    customer_type: linkedCustomer?.customer_type || ("customer" as CustomerType),
    host_name: meeting.host_name || "",
    host_email: meeting.host_email || "",
  });

  // Search states
  const [customerSearch, setCustomerSearch] = useState("");
  const [hostSearch, setHostSearch] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [hubspotContacts, setHubspotContacts] = useState<HubSpotContact[]>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [personnelResults, setPersonnelResults] = useState<ParticipantData[]>([]);
  const [isSearchingPersonnel, setIsSearchingPersonnel] = useState(false);
  const [isCreatingPersonnel, setIsCreatingPersonnel] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showHostDropdown, setShowHostDropdown] = useState(false);
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);

  // Filtered customers based on search
  const filteredCustomers = allCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.domain?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Search HubSpot contacts (host field only)
  const searchHubSpotContacts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setHubspotContacts([]);
      return;
    }

    setIsSearchingContacts(true);
    try {
      const response = await fetch(`/api/hubspot/contacts/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setHubspotContacts(data.contacts || []);
      }
    } catch (error) {
      console.error("Failed to search contacts:", error);
    } finally {
      setIsSearchingContacts(false);
    }
  }, []);

  // Search existing personnel for the participant picker
  const searchLocalPersonnel = useCallback(async (query: string) => {
    if (query.length < 1) {
      setPersonnelResults([]);
      return;
    }
    setIsSearchingPersonnel(true);
    try {
      const response = await fetch(`/api/personnel?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        const results: ParticipantData[] = (data.personnel || []).map((p: ParticipantData) => ({
          id: p.id,
          name: p.name,
          email: p.email ?? null,
          title: p.title ?? null,
          participation_status: p.participation_status || "n/a",
        }));
        setPersonnelResults(results);
      }
    } catch (error) {
      console.error("Failed to search personnel:", error);
    } finally {
      setIsSearchingPersonnel(false);
    }
  }, []);

  // Debounce HubSpot host search and local personnel search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hostSearch.length >= 2 && showHostDropdown) {
        searchHubSpotContacts(hostSearch);
      }
      if (participantSearch.length >= 1 && showParticipantDropdown) {
        searchLocalPersonnel(participantSearch);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    hostSearch,
    participantSearch,
    showHostDropdown,
    showParticipantDropdown,
    searchHubSpotContacts,
    searchLocalPersonnel,
  ]);

  function handleCustomerSelect(customer: Customer) {
    setFormData({
      ...formData,
      customer_id: customer.id,
      customer_type: customer.customer_type,
    });
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  }

  async function handleHostSelect(contact: HubSpotContact) {
    setFormData({
      ...formData,
      host_name: contact.fullName || "",
      host_email: contact.email || "",
    });
    setHostSearch(contact.fullName || contact.email || "");
    setShowHostDropdown(false);
  }

  function handleAddExistingParticipant(person: ParticipantData) {
    if (!participants.find((p) => p.id === person.id)) {
      setParticipants([...participants, person]);
    }
    setParticipantSearch("");
    setPersonnelResults([]);
    setShowParticipantDropdown(false);
  }

  async function handleCreateParticipant(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName || isCreatingPersonnel) return;
    setIsCreatingPersonnel(true);
    try {
      const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedName);
      const response = await fetch("/api/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          looksLikeEmail
            ? { name: trimmedName, email: trimmedName }
            : { name: trimmedName }
        ),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("Failed to create participant:", error);
        return;
      }
      const data = await response.json();
      const created: ParticipantData = {
        id: data.personnel.id,
        name: data.personnel.name,
        email: data.personnel.email ?? null,
        title: data.personnel.title ?? null,
        participation_status: data.personnel.participation_status || "n/a",
      };
      if (!participants.find((p) => p.id === created.id)) {
        setParticipants([...participants, created]);
      }
      setParticipantSearch("");
      setPersonnelResults([]);
      setShowParticipantDropdown(false);
    } catch (error) {
      console.error("Failed to create participant:", error);
    } finally {
      setIsCreatingPersonnel(false);
    }
  }

  function handleRemoveParticipant(personnelId: string) {
    setParticipants(participants.filter((p) => p.id !== personnelId));
  }

  async function handleSave() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_date: formData.meeting_date || null,
          customer_id: formData.customer_id || null,
          customer_type: formData.customer_type,
          host_name: formData.host_name || null,
          host_email: formData.host_email || null,
          participant_ids: participants.map((p) => p.id),
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        router.refresh();
      } else {
        const error = await response.json();
        console.error("Failed to save:", error);
      }
    } catch (error) {
      console.error("Failed to save meeting:", error);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    // Reset form to original values
    setFormData({
      meeting_date: meeting.meeting_date
        ? new Date(meeting.meeting_date).toISOString().slice(0, 16)
        : "",
      customer_id: meeting.customer_id || "",
      customer_type: linkedCustomer?.customer_type || "customer",
      host_name: meeting.host_name || "",
      host_email: meeting.host_email || "",
    });
    setParticipants(initialParticipants);
    setIsEditing(false);
  }

  const selectedCustomer = allCustomers.find((c) => c.id === formData.customer_id);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
      {/* No Company Warning Banner */}
      {!linkedCustomer && !isEditing && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              No organization assigned to this meeting
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
              Extracts and insights won&apos;t be linked to an organization. Click &quot;Edit&quot; to assign one.
            </p>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm font-medium text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100 underline"
          >
            Assign Organization
          </button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Meeting Details
        </h2>
        {!isEditing ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              Delete
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date */}
        <div>
          <dt className="text-sm text-gray-500 dark:text-gray-400">Date</dt>
          <dd className="text-gray-900 dark:text-white">
            {isEditing ? (
              <input
                type="datetime-local"
                value={formData.meeting_date}
                onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
            ) : meeting.meeting_date ? (
              new Date(meeting.meeting_date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            ) : (
              "—"
            )}
          </dd>
        </div>

        {/* Host */}
        <div>
          <dt className="text-sm text-gray-500 dark:text-gray-400">Host</dt>
          <dd className="text-gray-900 dark:text-white">
            {isEditing ? (
              <div className="relative">
                <input
                  type="text"
                  value={hostSearch || formData.host_name}
                  onChange={(e) => {
                    setHostSearch(e.target.value);
                    setShowHostDropdown(true);
                  }}
                  onFocus={() => setShowHostDropdown(true)}
                  placeholder="Search HubSpot contacts..."
                  className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                {showHostDropdown && (hostSearch.length >= 2 || hubspotContacts.length > 0) && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {isSearchingContacts ? (
                      <div className="p-2 text-sm text-gray-500">Searching...</div>
                    ) : hubspotContacts.length > 0 ? (
                      hubspotContacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => handleHostSelect(contact)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <div className="font-medium">{contact.fullName || "No name"}</div>
                          {contact.email && (
                            <div className="text-xs text-gray-500">{contact.email}</div>
                          )}
                        </button>
                      ))
                    ) : hostSearch.length >= 2 ? (
                      <div className="p-2 text-sm text-gray-500">No contacts found</div>
                    ) : null}
                  </div>
                )}
                {formData.host_email && (
                  <div className="text-xs text-gray-500 mt-1">{formData.host_email}</div>
                )}
              </div>
            ) : meeting.host_name || meeting.host_email ? (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>
                  {meeting.host_name || "Unknown"}
                  {meeting.host_email && (
                    <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">
                      ({meeting.host_email})
                    </span>
                  )}
                </span>
              </div>
            ) : (
              "—"
            )}
          </dd>
        </div>

        {/* Organization */}
        <div>
          <dt className="text-sm text-gray-500 dark:text-gray-400">Organization</dt>
          <dd className="text-gray-900 dark:text-white">
            {isEditing ? (
              <div className="relative">
                <input
                  type="text"
                  value={customerSearch || selectedCustomer?.name || ""}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Search organizations..."
                  className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
                {showCustomerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.slice(0, 10).map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => handleCustomerSelect(customer)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{customer.name}</span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                customer.customer_type === "deal"
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              }`}
                            >
                              {customer.customer_type === "deal" ? "Secondary" : "Primary"}
                            </span>
                          </div>
                          {customer.domain && (
                            <div className="text-xs text-gray-500">{customer.domain}</div>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-gray-500">No organizations found</div>
                    )}
                  </div>
                )}
              </div>
            ) : linkedCustomer ? (
              <div className="flex items-center gap-2">
                <span>{linkedCustomer.name}</span>
                <MeetingTypeBadge customerType={linkedCustomer.customer_type} size="sm" />
              </div>
            ) : (
              "—"
            )}
          </dd>
        </div>

        {/* Customer Type / Deal Stage */}
        <div>
          <dt className="text-sm text-gray-500 dark:text-gray-400">Type</dt>
          <dd className="text-gray-900 dark:text-white">
            {isEditing && formData.customer_id ? (
              <select
                value={formData.customer_type}
                onChange={(e) =>
                  setFormData({ ...formData, customer_type: e.target.value as CustomerType })
                }
                className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="customer">Primary</option>
                <option value="deal">Secondary</option>
              </select>
            ) : linkedCustomer ? (
              <MeetingTypeBadge customerType={linkedCustomer.customer_type} />
            ) : (
              "—"
            )}
          </dd>
        </div>

        {/* Source */}
        <div>
          <dt className="text-sm text-gray-500 dark:text-gray-400">Source</dt>
          <dd className="text-gray-900 dark:text-white">
            {meeting.source === "google_meet" && "Google Meet"}
            {meeting.source === "hubspot" && "HubSpot"}
            {meeting.source === "zoom" && "Zoom"}
            {meeting.source === "teams" && "Microsoft Teams"}
            {meeting.source === "manual" && "Manual Upload"}
            {!meeting.source && "—"}
          </dd>
        </div>

        {/* Meeting Link */}
        {(meeting.meeting_url || (meeting.recording_url && !meeting.recording_url.startsWith("drive:"))) && (
          <div>
            <dt className="text-sm text-gray-500 dark:text-gray-400">Meeting Link</dt>
            <dd>
              {meeting.meeting_url ? (
                <a
                  href={meeting.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm inline-flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Meeting
                </a>
              ) : meeting.recording_url && !meeting.recording_url.startsWith("drive:") ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={meeting.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm inline-flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open Recording
                  </a>
                  {meeting.recording_passcode && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Passcode: {meeting.recording_passcode}
                    </span>
                  )}
                </div>
              ) : null}
            </dd>
          </div>
        )}

        {/* Status */}
        <div>
          <dt className="text-sm text-gray-500 dark:text-gray-400">Status</dt>
          <dd>
            <StatusBadge status={meeting.workflow_status} />
          </dd>
        </div>
      </dl>

      {/* Participants Section */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          Participants ({participants.length})
        </h3>

        {isEditing && (
          <div className="relative mb-3">
            <input
              type="text"
              value={participantSearch}
              onChange={(e) => {
                setParticipantSearch(e.target.value);
                setShowParticipantDropdown(true);
              }}
              onFocus={() => setShowParticipantDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && participantSearch.trim()) {
                  e.preventDefault();
                  const trimmed = participantSearch.trim();
                  const exactMatch = personnelResults.find(
                    (p) => p.name.toLowerCase() === trimmed.toLowerCase()
                  );
                  if (exactMatch) {
                    handleAddExistingParticipant(exactMatch);
                  } else {
                    handleCreateParticipant(trimmed);
                  }
                }
              }}
              placeholder="Type a name or email — pick from list or press Enter to add"
              className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
            />
            {showParticipantDropdown && participantSearch.length >= 1 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {isSearchingPersonnel ? (
                  <div className="p-2 text-sm text-gray-500">Searching...</div>
                ) : (
                  <>
                    {personnelResults
                      .filter((p) => !participants.find((existing) => existing.id === p.id))
                      .map((person) => (
                        <button
                          key={person.id}
                          onClick={() => handleAddExistingParticipant(person)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <div className="font-medium text-sm">{person.name}</div>
                          {person.email && (
                            <div className="text-xs text-gray-500">{person.email}</div>
                          )}
                        </button>
                      ))}
                    {!personnelResults.find(
                      (p) => p.name.toLowerCase() === participantSearch.trim().toLowerCase()
                    ) && (
                      <button
                        onClick={() => handleCreateParticipant(participantSearch)}
                        disabled={isCreatingPersonnel}
                        className="w-full text-left px-3 py-2 border-t border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-blue-600 dark:text-blue-400 disabled:opacity-50"
                      >
                        {isCreatingPersonnel
                          ? "Adding…"
                          : `+ Add “${participantSearch.trim()}” as new participant`}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {participants.length > 0 ? (
          <div className="space-y-2">
            {participants.map((person) => (
              <div
                key={person.id}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {person.name}
                    </span>
                    <ParticipationStatusBadge status={person.participation_status} />
                  </div>
                  {person.email && (
                    <div className="text-xs text-gray-500">{person.email}</div>
                  )}
                  {person.title && (
                    <div className="text-xs text-gray-400">{person.title}</div>
                  )}
                </div>
                {isEditing && (
                  <button
                    onClick={() => handleRemoveParticipant(person.id)}
                    className="text-red-500 hover:text-red-700"
                    title="Remove participant"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No participants added</p>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Meeting?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will permanently delete this meeting
              {extractCount > 0 &&
                ` and ${extractCount} associated extract${extractCount !== 1 ? "s" : ""}`}
              . This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Meeting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    transcribed: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        styles[status as keyof typeof styles] || styles.pending
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function MeetingTypeBadge({
  customerType,
  size = "default",
}: {
  customerType: "deal" | "customer";
  size?: "default" | "sm";
}) {
  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded font-medium ${sizeClasses} ${
        customerType === "deal"
          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
      }`}
    >
      {customerType === "deal" ? "Secondary" : "Primary"}
    </span>
  );
}

function ParticipationStatusBadge({ status }: { status: ParticipationStatus }) {
  const styles: Record<ParticipationStatus, { bg: string; label: string }> = {
    participated: {
      bg: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      label: "Participated",
    },
    invited: {
      bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
      label: "Invited",
    },
    "n/a": {
      bg: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
      label: "N/A",
    },
  };
  const { bg, label } = styles[status] || styles["n/a"];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${bg}`}>
      {label}
    </span>
  );
}

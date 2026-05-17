"use client";

interface IntegrationStatusProps {
  status: {
    googleMeet: boolean;
    zoom: boolean;
    teams: boolean;
    hubspot: boolean;
  };
  onClick?: () => void;
}

export function IntegrationStatus({ status, onClick }: IntegrationStatusProps) {
  const integrations = [
    {
      name: "Google Meet",
      connected: status.googleMeet,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill={status.googleMeet ? "#4285F4" : "currentColor"}
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill={status.googleMeet ? "#34A853" : "currentColor"}
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill={status.googleMeet ? "#FBBC05" : "currentColor"}
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill={status.googleMeet ? "#EA4335" : "currentColor"}
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      ),
    },
    {
      name: "Zoom",
      connected: status.zoom,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill={status.zoom ? "#2D8CFF" : "currentColor"}>
          <path d="M4.585 12.813c0-1.467.012-2.934-.006-4.4-.01-.794.333-1.363 1.01-1.756 2.048-1.19 4.085-2.398 6.128-3.596.648-.38 1.296-.38 1.944 0 2.048 1.201 4.092 2.41 6.139 3.607.657.384 1.006.944 1.003 1.722-.012 2.945-.012 5.89 0 8.835.003.793-.345 1.356-1.01 1.747-2.048 1.206-4.094 2.414-6.145 3.615-.64.374-1.278.374-1.918 0-2.059-1.206-4.116-2.415-6.175-3.621-.647-.38-.982-.944-.976-1.719.021-1.478.006-2.956.006-4.434zm7.418 1.53v3.244c0 .45.227.632.629.398 1.31-.764 2.618-1.532 3.923-2.304.229-.136.346-.298.344-.568-.006-1.544-.004-3.089-.002-4.633 0-.414-.205-.601-.59-.384-1.33.752-2.657 1.508-3.982 2.268-.22.13-.326.29-.323.543.007 1.145.001 2.29.001 3.436z" />
        </svg>
      ),
    },
    {
      name: "Teams",
      connected: status.teams,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill={status.teams ? "#6264A7" : "currentColor"}>
          <path d="M20.625 10.5h-6.75c-.621 0-1.125.504-1.125 1.125v6.75c0 .621.504 1.125 1.125 1.125h6.75c.621 0 1.125-.504 1.125-1.125v-6.75c0-.621-.504-1.125-1.125-1.125zM17.25 8.25c1.243 0 2.25-1.007 2.25-2.25S18.493 3.75 17.25 3.75 15 4.757 15 6s1.007 2.25 2.25 2.25zM12 9c1.657 0 3-1.343 3-3S13.657 3 12 3 9 4.343 9 6s1.343 3 3 3zm-1.5 1.5H3.375c-.621 0-1.125.504-1.125 1.125V18c0 1.657 1.343 3 3 3h6c.31 0 .609-.047.896-.131A2.981 2.981 0 0111.25 18.75v-7.125c0-.621-.504-1.125-1.125-1.125h-.625z" />
        </svg>
      ),
    },
    {
      name: "HubSpot",
      connected: status.hubspot,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill={status.hubspot ? "#FF7A59" : "currentColor"}>
          <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984v-.066A2.198 2.198 0 0017.233.836h-.066a2.198 2.198 0 00-2.198 2.198v.066c0 .865.503 1.612 1.232 1.968v2.862a5.76 5.76 0 00-2.615 1.09l-6.7-5.209A2.633 2.633 0 007.232 1.5a2.625 2.625 0 10-.756 5.128l.07-.002 6.396 4.972a5.715 5.715 0 00-.183 1.427c0 .54.076 1.062.216 1.558l-2.39 1.201a2.274 2.274 0 00-1.27-.39 2.286 2.286 0 100 4.573 2.286 2.286 0 002.143-3.088l2.242-1.127a5.75 5.75 0 109.504-7.413v-.001a5.722 5.722 0 00-3.04-1.408zm-.964 9.263a3.468 3.468 0 110-6.936 3.468 3.468 0 010 6.936z" />
        </svg>
      ),
    },
  ];

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
    >
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Integrations:</span>
      <div className="flex items-center gap-2">
        {integrations.map((integration) => (
          <div
            key={integration.name}
            className={`relative group ${!integration.connected ? "opacity-40" : ""}`}
            title={`${integration.name}: ${integration.connected ? "Connected" : "Not connected"}`}
          >
            {integration.icon}
            {integration.connected && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-800" />
            )}
          </div>
        ))}
      </div>
      <svg
        className="w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

import React, { useState, useEffect } from "react";

const AVATAR_COLORS = [
  "#1565C0", // Blue
  "#00796B", // Teal
  "#2E7D32", // Green
  "#6A1B9A", // Purple
  "#C2185B", // Pink
  "#E65100", // Orange
  "#455A64", // Blue Grey
];

function getInitials(name) {
  if (!name || typeof name !== "string") return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColorForName(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export default function CandidateAvatar({
  photoUrl,
  name,
  size = 34,
  style = {},
  className = "",
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [photoUrl]);

  const initials = getInitials(name);
  const bgColor = getColorForName(name);

  if (!photoUrl || hasError) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: bgColor,
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          fontSize: Math.max(11, Math.floor(size * 0.38)),
          userSelect: "none",
          flexShrink: 0,
          ...style,
        }}
        title={name || "Candidate Avatar"}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={name || "Candidate"}
      onError={() => setHasError(true)}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

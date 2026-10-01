// Ranks a slot's suggestions: most votes first, ties go to the earliest suggestion.
export function rankSuggestions(suggestions, votes) {
  const counts = {}
  for (const v of votes) counts[v.suggestion_id] = (counts[v.suggestion_id] || 0) + 1
  return suggestions
    .map((s) => ({ ...s, voteCount: counts[s.id] || 0 }))
    .sort((a, b) => b.voteCount - a.voteCount || a.created_at.localeCompare(b.created_at))
}

export const TRAVEL_MODES = ['walk', 'car', 'train', 'bus', 'flight', 'boat', 'other']
